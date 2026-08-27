import { PrismaClient, Prisma } from '@prisma/client';

// Serialize Prisma Decimal as plain JS number in all JSON responses.
// Without this, Decimal fields would serialize as strings (e.g. "123.45"),
// breaking frontend arithmetic. Financial values in this app fit safely
// within Number's precision (up to ~999 billion with 2 decimal places).
Prisma.Decimal.prototype.toJSON = function () {
  return this.toNumber();
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
