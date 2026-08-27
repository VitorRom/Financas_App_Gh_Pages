import prisma from '../../shared/lib/prisma.js';

export function findAll(userId) {
  return prisma.planningItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export function findById(id, userId) {
  return prisma.planningItem.findFirst({ where: { id, userId } });
}

export function create(data) {
  return prisma.planningItem.create({ data });
}

export function update(id, data) {
  return prisma.planningItem.update({ where: { id }, data });
}

export function remove(id) {
  return prisma.planningItem.delete({ where: { id } });
}
