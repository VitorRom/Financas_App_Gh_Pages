function parseNumberBR(value) {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function pmtFromFutureValue({ targetFinalValue, monthlyRatePct, months }) {
  const r = monthlyRatePct / 100;
  if (months <= 0) return 0;
  if (r === 0) return targetFinalValue / months;
  return (targetFinalValue * r) / (Math.pow(1 + r, months) - 1);
}

function monthLabel(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long' });
}

function buildInstallments({ startDate, years, monthlyRatePct, monthlyContribution }) {
  const months = years * 12;
  const r = monthlyRatePct / 100;
  const rows = [];
  let invested = 0;
  let balance = 0;

  for (let i = 0; i < months; i++) {
    const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, startDate.getDate());
    const interest = balance * r;
    invested += monthlyContribution;
    balance = balance + interest + monthlyContribution;

    rows.push({
      monthIndex: i + 1,
      paymentDate,
      monthLabel: monthLabel(paymentDate),
      contribution: monthlyContribution,
      ratePct: monthlyRatePct,
      investedTotal: invested,
      projectedBalance: balance,
      status: 'Pendente',
    });
  }

  return rows;
}

export const listGoals = (prisma) => async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        installments: {
          orderBy: { monthIndex: 'asc' },
        },
      },
    });
    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createGoal = (prisma) => async (req, res) => {
  try {
    const { name, years, monthlyRatePct, targetFinalValue, startDate } = req.body || {};

    const parsedYears = Number.parseInt(years, 10);
    const rate = parseNumberBR(monthlyRatePct);
    const target = parseNumberBR(targetFinalValue);
    const start = startDate ? new Date(startDate) : new Date();

    if (!name || !parsedYears || parsedYears <= 0) return res.status(400).json({ error: 'Prazo (anos) inválido' });
    if (rate === null || rate < 0) return res.status(400).json({ error: 'Juros (%) inválido' });
    if (target === null || target <= 0) return res.status(400).json({ error: 'Valor final (R$) inválido' });
    if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Data inicial inválida' });

    const months = parsedYears * 12;
    const monthlyContribution = pmtFromFutureValue({ targetFinalValue: target, monthlyRatePct: rate, months });

    const installments = buildInstallments({
      startDate: start,
      years: parsedYears,
      monthlyRatePct: rate,
      monthlyContribution,
    });

    const goal = await prisma.goal.create({
      data: {
        name,
        years: parsedYears,
        monthlyRatePct: rate,
        targetFinalValue: target,
        monthlyContribution,
        startDate: start,
        userId: req.user.id,
        installments: {
          createMany: {
            data: installments,
          },
        },
      },
      include: {
        installments: {
          orderBy: { monthIndex: 'asc' },
        },
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteGoal = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existingGoal = await prisma.goal.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Meta não encontrada' });
    }

    await prisma.goal.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGoalInstallment = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ['Pendente', 'Ok'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Status inválido (use Pendente ou Ok)' });
    }

    // Verify ownership through goal
    const installment = await prisma.goalInstallment.findUnique({
      where: { id },
      include: { goal: true },
    });

    if (!installment || installment.goal.userId !== req.user.id) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }

    const updated = await prisma.goalInstallment.update({
      where: { id },
      data: {
        status: status || undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};