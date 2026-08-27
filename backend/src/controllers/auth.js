import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from '../utils/password.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt.js';

const prisma = new PrismaClient();

export async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const passwordHash = await hashPassword(password);

    const freePlan = await prisma.plan.findUnique({
      where: { name: 'free' },
    });

    if (!freePlan) {
      return res.status(500).json({ error: 'Plano gratuito não encontrado. Execute o seed.' });
    }

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        subscription: {
          create: {
            planId: freePlan.id,
            status: 'active',
          },
        },
      },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.status(201).json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json({
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, email } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          NOT: { id: req.user.id },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      updateData.email = email.toLowerCase();
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
}