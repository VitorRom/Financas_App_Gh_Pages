import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultPlans = [
  {
    name: 'free',
    displayName: 'Gratuito',
    price: 0,
    maxTransactions: 100,
    maxAccounts: 2,
    features: JSON.stringify({
      transactions: 100,
      accounts: 2,
      goals: true,
      planning: true,
      imports: false,
      export: false,
    }),
  },
  {
    name: 'pro',
    displayName: 'Pro',
    price: 2900, // R$ 29,00 em centavos
    maxTransactions: null, // ilimitado
    maxAccounts: 10,
    features: JSON.stringify({
      transactions: 'ilimitado',
      accounts: 10,
      goals: true,
      planning: true,
      imports: true,
      export: true,
      merchantRules: true,
    }),
  },
  {
    name: 'premium',
    displayName: 'Premium',
    price: 5900, // R$ 59,00 em centavos
    maxTransactions: null,
    maxAccounts: null,
    features: JSON.stringify({
      transactions: 'ilimitado',
      accounts: 'ilimitado',
      goals: true,
      planning: true,
      imports: true,
      export: true,
      merchantRules: true,
      analytics: true,
      apiAccess: true,
    }),
  },
];

async function main() {
  console.log('Seeding plans...');

  for (const plan of defaultPlans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log('Plans seeded successfully!');
  console.log('Available plans:');
  console.log('  - Free: Gratuito (até 100 transações, 2 contas)');
  console.log('  - Pro: R$ 29/mês (transações ilimitadas, 10 contas)');
  console.log('  - Premium: R$ 59/mês (tudo ilimitado)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });