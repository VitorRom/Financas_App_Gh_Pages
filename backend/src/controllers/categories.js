// Controller para categorias

export const getCategories = (prisma) => async (req, res) => {
  try {
    const { type } = req.query;

    const where = { userId: req.user.id };
    if (type) where.type = type;

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCategory = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: { id, userId: req.user.id },
      include: {
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createCategory = (prisma) => async (req, res) => {
  try {
    const { name, type, color, icon } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        type,
        color: color || '#6366f1',
        icon: icon || 'tag',
        userId: req.user.id,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCategory = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, color, icon } = req.body;

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name, type, color, icon },
    });

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCategory = (prisma) => async (req, res) => {
  try {
    const { id } = req.params;

    const existingCategory = await prisma.category.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};