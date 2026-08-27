import { PrismaClient, Prisma } from '@prisma/client';

Prisma.Decimal.prototype.toJSON = function () {
  return this.toNumber();
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
