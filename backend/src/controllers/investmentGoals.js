import { projectGoal } from '../utils/investmentCalculations.js';

export const listGoals = (prisma) => async (req, res) => {
  try {
    const goals = await prisma.investmentGoal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Enriquecer com progresso
    const enriched = goals.map((goal) => {
      const progressPct = Number(goal.targetAmount) > 0
        ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
        : 0;

      const now = new Date();
      const target = new Date(goal.targetDate);
      const monthsRemaining = Math.max(0,
        (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
      );

      return { ...goal, progressPct: Math.round(progressPct * 100) / 100, monthsRemaining };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createGoal = (prisma) => async (req, res) => {
  try {
    const { name, targetAmount, targetDate, monthlyContribution, expectedReturnRate, currentAmount, assetTypes } = req.body;

    if (!name || !targetAmount || !targetDate || !monthlyContribution || expectedReturnRate === undefined) {
      return res.status(400).json({ error: 'Nome, valor alvo, data alvo, aporte mensal e taxa de retorno são obrigatórios' });
    }

    const goal = await prisma.investmentGoal.create({
      data: {
        name,
        targetAmount: parseFloat(targetAmount),
        targetDate: new Date(targetDate),
        monthlyContribution: parseFloat(monthlyContribution),
        expectedReturnRate: parseFloat(expectedReturnRate),
        currentAmount: parseFloat(currentAmount || 0),
        assetTypes: assetTypes || [],
        userId: req.user.id,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGoal = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investmentGoal.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Meta não encontrada' });

    const { name, targetAmount, targetDate, monthlyContribution, expectedReturnRate, currentAmount, assetTypes } = req.body;

    const goal = await prisma.investmentGoal.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(targetAmount !== undefined && { targetAmount: parseFloat(targetAmount) }),
        ...(targetDate !== undefined && { targetDate: new Date(targetDate) }),
        ...(monthlyContribution !== undefined && { monthlyContribution: parseFloat(monthlyContribution) }),
        ...(expectedReturnRate !== undefined && { expectedReturnRate: parseFloat(expectedReturnRate) }),
        ...(currentAmount !== undefined && { currentAmount: parseFloat(currentAmount) }),
        ...(assetTypes !== undefined && { assetTypes }),
      },
    });

    res.json(goal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteGoal = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.investmentGoal.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) return res.status(404).json({ error: 'Meta não encontrada' });

    await prisma.investmentGoal.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjection = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const goal = await prisma.investmentGoal.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada' });

    const now = new Date();
    const target = new Date(goal.targetDate);
    const months = Math.max(1,
      (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    );

    const projections = projectGoal(
      Number(goal.currentAmount),
      Number(goal.monthlyContribution),
      Number(goal.expectedReturnRate),
      months
    );

    const finalBalance = projections[projections.length - 1]?.balance || 0;
    const reachesGoal = finalBalance >= Number(goal.targetAmount);

    res.json({
      goal,
      projections,
      finalBalance,
      reachesGoal,
      monthsToGoal: months,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
