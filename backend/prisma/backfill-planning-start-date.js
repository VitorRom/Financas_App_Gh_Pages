/**
 * Converte `PlanningItem.startMonth` (deslocamento em meses relativo a "hoje")
 * para `startDate` (mês absoluto).
 *
 * O deslocamento era interpretado a partir da data corrente a cada renderização,
 * então o item andava para frente a cada virada de mês. A âncora correta é o
 * momento em que o usuário informou o valor:
 *
 *     startDate = primeiro dia do mês de createdAt + startMonth meses
 *
 * Rodar uma vez após `npm run db:push`. Idempotente: só toca em itens sem `startDate`.
 * Use `--dry-run` para apenas ver o mapeamento, sem gravar.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const mesAno = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

async function main() {
  const itens = await prisma.planningItem.findMany({ orderBy: { createdAt: 'asc' } });
  const agora = new Date();
  let atualizados = 0;

  console.log(dryRun ? 'SIMULAÇÃO — nada será gravado\n' : 'Aplicando backfill\n');

  for (const item of itens) {
    if (item.startDate) continue;

    const offset = item.startMonth ?? 0;

    // Mês em que o item foi criado, em UTC, mais o deslocamento informado.
    const startDate = new Date(
      Date.UTC(item.createdAt.getUTCFullYear(), item.createdAt.getUTCMonth() + offset, 1),
    );

    // Onde ele estaria aparecendo hoje, com a regra antiga — para mostrar o desvio.
    const comRegraAntiga = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + offset, 1));
    const desvio = startDate.getTime() !== comRegraAntiga.getTime();

    console.log(
      `${item.name.padEnd(26)} startMonth=${String(offset).padStart(2)}  ` +
        `→ ${mesAno(startDate)}` +
        (desvio ? `   (hoje estava indo para ${mesAno(comRegraAntiga)})` : ''),
    );

    if (!dryRun) {
      await prisma.planningItem.update({ where: { id: item.id }, data: { startDate } });
    }
    atualizados += 1;
  }

  console.log(
    `\n${atualizados} de ${itens.length} itens ${dryRun ? 'seriam ancorados' : 'ancorados'} a um mês absoluto.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
