import prisma from '../../shared/lib/prisma.js';

export function findAll(userId, type) {
  return prisma.category.findMany({
    where: { userId, ...(type ? { type } : {}) },
    orderBy: { name: 'asc' },
  });
}

export function findById(id, userId) {
  return prisma.category.findFirst({
    where: { id, userId },
    include: { transactions: { take: 10, orderBy: { date: 'desc' } } },
  });
}

export function create(data) {
  return prisma.category.create({ data });
}

export function update(id, data) {
  return prisma.category.update({ where: { id }, data });
}

export function remove(id) {
  return prisma.category.delete({ where: { id } });
}
