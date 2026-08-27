export const listPlanningItems = (prisma) => async (req, res) => {
  try {
    const items = await prisma.planningItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createPlanningItem = (prisma) => async (req, res) => {
  try {
    const { name, amount, type, dayOfMonth } = req.body || {};
    if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
    if (type !== 'income' && type !== 'expense') return res.status(400).json({ error: 'Tipo inválido' });

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return res.status(400).json({ error: 'Valor inválido' });

    const day = dayOfMonth ? Number.parseInt(dayOfMonth, 10) : 1;
    if (!Number.isFinite(day) || day < 1 || day > 31) return res.status(400).json({ error: 'Dia do mês inválido' });

    const item = await prisma.planningItem.create({
      data: { name, amount: parsedAmount, type, dayOfMonth: day, userId: req.user.id },
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePlanningItem = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existingItem = await prisma.planningItem.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    await prisma.planningItem.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};