import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getPlans(req, res) {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    const plansWithFeatures = plans.map((plan) => ({
      ...plan,
      features: JSON.parse(plan.features || '{}'),
    }));

    res.json(plansWithFeatures);
  } catch (error) {
    console.error('Error in getPlans:', error);
    res.status(500).json({ error: 'Erro ao buscar planos' });
  }
}

export async function getSubscription(req, res) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
      include: { plan: true },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    res.json({
      ...subscription,
      plan: {
        ...subscription.plan,
        features: JSON.parse(subscription.plan.features || '{}'),
      },
    });
  } catch (error) {
    console.error('Error in getSubscription:', error);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}

export async function subscribe(req, res) {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'ID do plano é obrigatório' });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      return res.status(400).json({ error: 'Plano não encontrado ou inativo' });
    }

    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (existingSubscription) {
      const updatedSubscription = await prisma.subscription.update({
        where: { userId: req.user.id },
        data: {
          planId,
          status: plan.price === 0 ? 'active' : 'active',
        },
        include: { plan: true },
      });

      return res.json({
        ...updatedSubscription,
        plan: {
          ...updatedSubscription.plan,
          features: JSON.parse(updatedSubscription.plan.features || '{}'),
        },
      });
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.id,
        planId,
        status: 'active',
      },
      include: { plan: true },
    });

    res.status(201).json({
      ...subscription,
      plan: {
        ...subscription.plan,
        features: JSON.parse(subscription.plan.features || '{}'),
      },
    });
  } catch (error) {
    console.error('Error in subscribe:', error);
    res.status(500).json({ error: 'Erro ao assinar plano' });
  }
}

export async function cancelSubscription(req, res) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const freePlan = await prisma.plan.findUnique({
      where: { name: 'free' },
    });

    if (!freePlan) {
      return res.status(500).json({ error: 'Plano gratuito não encontrado' });
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { userId: req.user.id },
      data: {
        planId: freePlan.id,
        status: 'canceled',
      },
      include: { plan: true },
    });

    res.json({
      ...updatedSubscription,
      plan: {
        ...updatedSubscription.plan,
        features: JSON.parse(updatedSubscription.plan.features || '{}'),
      },
    });
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
}