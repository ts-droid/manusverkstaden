import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();
const prisma = new PrismaClient();

// Initialize Stripe only if key exists
const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

// ─── CREATE CHECKOUT SESSION ───
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Betalning är inte konfigurerad' });

    const { priceId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.frontendUrl}/?checkout=success`,
      cancel_url: `${config.frontendUrl}/?checkout=cancel`,
      metadata: { userId: user.id },
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// ─── CUSTOMER PORTAL ───
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Betalning är inte konfigurerad' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.stripeCustomerId) {
      return res.status(400).json({ error: 'Inget Stripe-konto kopplat' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.frontendUrl}/`,
    });

    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// ─── USAGE SUMMARY ───
router.get('/usage', requireAuth, async (req, res, next) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const usage = await prisma.usageRecord.groupBy({
      by: ['type'],
      where: { userId: req.user.id, createdAt: { gte: monthStart } },
      _sum: { wordCount: true, cost: true },
      _count: true,
    });

    const total = await prisma.usageRecord.aggregate({
      where: { userId: req.user.id, createdAt: { gte: monthStart } },
      _sum: { wordCount: true, cost: true },
      _count: true,
    });

    res.json({ usage, total: total._sum, count: total._count });
  } catch (err) { next(err); }
});

// ─── STRIPE WEBHOOK ───
router.post('/webhook', async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe not configured');

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'GRUND',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const user = await prisma.user.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: 'PROVA', stripeSubscriptionId: null },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`Payment failed for customer ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

export default router;
