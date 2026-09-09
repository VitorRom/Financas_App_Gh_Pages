/**
 * Preenche `initialBalance` das contas criadas antes do campo existir.
 *
 * O saldo atual de uma conta é `saldo de abertura + receitas - despesas`.
 * Como o saldo de abertura não era guardado, ele é reconstruído invertendo a conta:
 *
 *     initialBalance = balance - (receitas - despesas)
 *
 * Rodar uma única vez, logo após `npm run db:push`. É idempotente: só toca em
 * contas que ainda estão com initialBalance = 0.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    select: { id: true, name: true, type: true, balance: true, initialBalance: true },
  });

  let updated = 0;

  for (const account of accounts) {
    if (Number(account.initialBalance) !== 0) continue;

    // Conta de investimento tem saldo derivado — abertura é sempre 0.
    if (account.type === 'investment') continue;

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { accountId: account.id, type: 'income' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { accountId: account.id, type: 'expense' },
        _sum: { amount: true },
      }),
    ]);

    const movement = (Number(income._sum.amount) || 0) - (Number(expense._sum.amount) || 0);
    const initialBalance = Number(account.balance) - movement;

    if (initialBalance === 0) continue;

    await prisma.account.update({
      where: { id: account.id },
      data: { initialBalance },
    });

    console.log(
      `  ${account.name}: saldo ${Number(account.balance).toFixed(2)} ` +
        `- movimento ${movement.toFixed(2)} = abertura ${initialBalance.toFixed(2)}`,
    );
    updated += 1;
  }

  console.log(`\n${updated} de ${accounts.length} contas tiveram o saldo de abertura reconstruído.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
