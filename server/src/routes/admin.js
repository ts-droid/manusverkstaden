import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// ─── MIDDLEWARE: SUPER ADMIN CHECK ───

async function requireSuperAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Åtkomst nekad – superadmin krävs' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

// All admin routes require auth + superadmin
router.use(requireAuth, requireSuperAdmin);

// ─── GET /overview ───
router.get('/overview', async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      usersByPlan,
      totalProjects,
      totalChapters,
      costThisMonth,
      costToday,
      activeUsersLast7Days,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['plan'], _count: true }),
      prisma.project.count(),
      prisma.chapter.count(),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { cost: true },
      }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { cost: true },
      }),
      prisma.usageRecord.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    res.json({
      totalUsers,
      usersByPlan: Object.fromEntries(usersByPlan.map((g) => [g.plan, g._count])),
      totalProjects,
      totalChapters,
      costThisMonth: costThisMonth._sum.cost || 0,
      costToday: costToday._sum.cost || 0,
      activeUsersLast7Days: activeUsersLast7Days.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /users ───
router.get('/users', async (req, res, next) => {
  try {
    const { search } = req.query;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        isDevAccount: true,
        disabled: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projects: true } },
        usageRecords: {
          where: { createdAt: { gte: monthStart } },
          select: { cost: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = users.map((u) => {
      const totalUsageCost = u.usageRecords.reduce((sum, r) => sum + r.cost, 0);
      const lastUsage = u.usageRecords.length
        ? u.usageRecords.reduce((latest, r) =>
            r.createdAt > latest ? r.createdAt : latest, u.usageRecords[0].createdAt)
        : null;

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        role: u.role,
        isDevAccount: u.isDevAccount,
        disabled: u.disabled,
        createdAt: u.createdAt,
        projectCount: u._count.projects,
        totalUsageCost: Math.round(totalUsageCost * 100) / 100,
        lastActive: lastUsage || u.updatedAt,
      };
    });

    res.json({ users: result });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/:id ───
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, isDevAccount, disabled } = req.body;

    const data = {};
    if (plan !== undefined) {
      if (!['PROVA', 'GRUND', 'FORLAG'].includes(plan)) {
        return res.status(400).json({ error: 'Ogiltig plan' });
      }
      data.plan = plan;
    }
    if (isDevAccount !== undefined) data.isDevAccount = Boolean(isDevAccount);
    if (disabled !== undefined) data.disabled = Boolean(disabled);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Inga fält att uppdatera' });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        role: true,
        isDevAccount: true,
        disabled: true,
      },
    });

    res.json({ user });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Användaren hittades inte' });
    }
    next(err);
  }
});

// ─── GET /usage ───
router.get('/usage', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [dailyCosts, byType, byModel, totalTokens] = await Promise.all([
      // Daily costs for last 30 days
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM(cost) as total_cost, COUNT(*) as count
        FROM "UsageRecord"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      // Breakdown by type
      prisma.usageRecord.groupBy({
        by: ['type'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { cost: true, wordCount: true },
        _count: true,
      }),
      // Breakdown by model (uses type as proxy since model isn't stored separately)
      prisma.usageRecord.groupBy({
        by: ['type'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { apiTokensUsed: true, cost: true },
        _count: true,
      }),
      // Total tokens
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { apiTokensUsed: true, cost: true, wordCount: true },
        _count: true,
      }),
    ]);

    res.json({
      dailyCosts: dailyCosts.map((d) => ({
        date: d.date,
        cost: Number(d.total_cost) || 0,
        count: Number(d.count) || 0,
      })),
      byType: byType.map((t) => ({
        type: t.type,
        cost: t._sum.cost || 0,
        wordCount: t._sum.wordCount || 0,
        count: t._count,
      })),
      byModel: byModel.map((m) => ({
        type: m.type,
        tokens: m._sum.apiTokensUsed || 0,
        cost: m._sum.cost || 0,
        count: m._count,
      })),
      totals: {
        tokens: totalTokens._sum.apiTokensUsed || 0,
        cost: totalTokens._sum.cost || 0,
        wordCount: totalTokens._sum.wordCount || 0,
        count: totalTokens._count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /prompts ───
router.get('/prompts', async (req, res, next) => {
  try {
    const prompts = await prisma.promptConfig.findMany({
      orderBy: { key: 'asc' },
    });
    res.json({ prompts });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /prompts/:key ───
router.put('/prompts/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Innehåll krävs' });
    }

    // Get existing prompt (if any)
    const existing = await prisma.promptConfig.findUnique({ where: { key } });
    const newVersion = existing ? existing.version + 1 : 1;

    // Save version history if there was a previous version
    if (existing) {
      await prisma.promptHistory.create({
        data: {
          key: existing.key,
          content: existing.content,
          version: existing.version,
          updatedBy: existing.updatedBy,
        },
      });
    }

    // Upsert the prompt config
    const prompt = await prisma.promptConfig.upsert({
      where: { key },
      update: {
        content,
        version: newVersion,
        updatedBy: req.user.email,
      },
      create: {
        key,
        content,
        version: 1,
        updatedBy: req.user.email,
      },
    });

    res.json({ prompt });
  } catch (err) {
    next(err);
  }
});

export default router;
