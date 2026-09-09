import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../shared/config/jwt.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.js';
import { AppError } from '../../shared/utils/errors.js';
import * as repo from './auth.repository.js';

function signToken(user) {
  // `tokenVersion` viaja no token: trocar a senha incrementa o valor no banco e
  // todos os tokens emitidos antes deixam de bater.
  return jwt.sign({ userId: user.id, tv: user.tokenVersion ?? 0 }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function stripPassword(user) {
  // `tokenVersion` é detalhe interno de sessão — não vai para o cliente.
  const { passwordHash, tokenVersion, ...rest } = user;
  return rest;
}

export async function register({ email, password, name }) {
  const normalizedEmail = email.toLowerCase();

  const existing = await repo.findByEmail(normalizedEmail);
  if (existing) throw new AppError('Email já cadastrado', 400);

  const freePlan = await repo.findFreePlan();
  if (!freePlan) throw new AppError('Plano gratuito não encontrado. Execute o seed.', 500);

  const passwordHash = await hashPassword(password);

  const user = await repo.create({
    email: normalizedEmail,
    passwordHash,
    name: name || null,
    subscription: {
      create: { planId: freePlan.id, status: 'active' },
    },
  });

  return { user: stripPassword(user), token: signToken(user) };
}

export async function login({ email, password }) {
  const user = await repo.findByEmail(email.toLowerCase());
  if (!user) throw new AppError('Credenciais inválidas', 401);

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new AppError('Credenciais inválidas', 401);

  return { user: stripPassword(user), token: signToken(user) };
}

export async function getMe(userId) {
  const user = await repo.findById(userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  return stripPassword(user);
}

export async function updateProfile(userId, { name, email }) {
  if (email) {
    const conflict = await repo.findByEmailExcluding(email.toLowerCase(), userId);
    if (conflict) throw new AppError('Email já cadastrado', 400);
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email.toLowerCase();

  const user = await repo.update(userId, data);
  return stripPassword(user);
}

/**
 * Marca a apresentação de primeiro uso como vista. Idempotente: chamar de novo
 * não muda a data original.
 */
export async function completeOnboarding(userId) {
  const user = await repo.findById(userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);
  if (user.onboardingCompletedAt) return stripPassword(user);

  const updated = await repo.update(userId, { onboardingCompletedAt: new Date() });
  return stripPassword(updated);
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await repo.findById(userId);
  if (!user) throw new AppError('Usuário não encontrado', 404);

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Senha atual incorreta', 401);

  const passwordHash = await hashPassword(newPassword);
  const updated = await repo.update(userId, {
    passwordHash,
    tokenVersion: { increment: 1 },
  });

  // O token atual acabou de ser invalidado junto com os outros; devolve um novo
  // para quem trocou a senha não ser deslogado.
  return { message: 'Senha alterada com sucesso', token: signToken(updated) };
}
