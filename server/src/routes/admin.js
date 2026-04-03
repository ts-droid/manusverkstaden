import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { getRevenueStats } from '../services/stripe-revenue.js';

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
      apiCostUsdThisMonth,
      apiCostUsdToday,
      activeUsersLast7Days,
      stripeRevenue,
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
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { apiCostUsd: true },
      }),
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: todayStart } },
        _sum: { apiCostUsd: true },
      }),
      prisma.usageRecord.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      getRevenueStats(),
    ]);

    const planCounts = Object.fromEntries(usersByPlan.map((g) => [g.plan, g._count]));

    res.json({
      totalUsers,
      usersByPlan: planCounts,
      totalProjects,
      totalChapters,
      costThisMonth: costThisMonth._sum.cost || 0,
      costToday: costToday._sum.cost || 0,
      apiCostUsdThisMonth: apiCostUsdThisMonth._sum.apiCostUsd || 0,
      apiCostUsdToday: apiCostUsdToday._sum.apiCostUsd || 0,
      // Revenue from Stripe (null if not configured)
      revenueThisMonth: stripeRevenue?.revenueThisMonth ?? null,
      mrr: stripeRevenue?.mrr ?? null,
      activeSubscriptions: stripeRevenue?.activeSubscriptions ?? null,
      revenueCurrency: stripeRevenue?.currency ?? 'sek',
      revenueSource: stripeRevenue?.source ?? 'unavailable',
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
      // Daily costs for last 30 days (including real API cost)
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date,
               SUM(cost) as total_cost,
               SUM("apiCostUsd") as total_api_cost_usd,
               SUM("apiInputTokens") as total_input_tokens,
               SUM("apiOutputTokens") as total_output_tokens,
               COUNT(*) as count
        FROM "UsageRecord"
        WHERE "createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      // Breakdown by type
      prisma.usageRecord.groupBy({
        by: ['type'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { cost: true, wordCount: true, apiCostUsd: true, apiInputTokens: true, apiOutputTokens: true },
        _count: true,
      }),
      // Breakdown by model
      prisma.usageRecord.groupBy({
        by: ['model'],
        where: { createdAt: { gte: thirtyDaysAgo }, model: { not: null } },
        _sum: { apiInputTokens: true, apiOutputTokens: true, apiCostUsd: true },
        _count: true,
      }),
      // Totals
      prisma.usageRecord.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { apiTokensUsed: true, cost: true, wordCount: true, apiCostUsd: true, apiInputTokens: true, apiOutputTokens: true },
        _count: true,
      }),
    ]);

    res.json({
      dailyCosts: dailyCosts.map((d) => ({
        date: d.date,
        cost: Number(d.total_cost) || 0,
        apiCostUsd: Number(d.total_api_cost_usd) || 0,
        inputTokens: Number(d.total_input_tokens) || 0,
        outputTokens: Number(d.total_output_tokens) || 0,
        count: Number(d.count) || 0,
      })),
      byType: byType.map((t) => ({
        type: t.type,
        cost: t._sum.cost || 0,
        apiCostUsd: t._sum.apiCostUsd || 0,
        wordCount: t._sum.wordCount || 0,
        inputTokens: t._sum.apiInputTokens || 0,
        outputTokens: t._sum.apiOutputTokens || 0,
        count: t._count,
      })),
      byModel: byModel.map((m) => ({
        model: m.model,
        inputTokens: m._sum.apiInputTokens || 0,
        outputTokens: m._sum.apiOutputTokens || 0,
        apiCostUsd: m._sum.apiCostUsd || 0,
        count: m._count,
      })),
      totals: {
        tokens: totalTokens._sum.apiTokensUsed || 0,
        inputTokens: totalTokens._sum.apiInputTokens || 0,
        outputTokens: totalTokens._sum.apiOutputTokens || 0,
        cost: totalTokens._sum.cost || 0,
        apiCostUsd: totalTokens._sum.apiCostUsd || 0,
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

// ─── GET /word-list ───
router.get('/word-list', async (req, res, next) => {
  try {
    const entries = await prisma.wordListEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

// ─── POST /word-list ───
router.post('/word-list', async (req, res, next) => {
  try {
    const { word, correction, isCorrect = true, note, category = 'general' } = req.body;

    if (!word || !correction) {
      return res.status(400).json({ error: 'Ord och felaktig rättning krävs' });
    }

    const entry = await prisma.wordListEntry.upsert({
      where: { word_correction: { word: word.trim(), correction: correction.trim() } },
      update: { isCorrect, note, category, addedBy: req.user.email },
      create: {
        word: word.trim(),
        correction: correction.trim(),
        isCorrect,
        note,
        category,
        addedBy: req.user.email,
      },
    });

    res.json({ entry });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /word-list/:id ───
router.delete('/word-list/:id', async (req, res, next) => {
  try {
    await prisma.wordListEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Posten hittades inte' });
    }
    next(err);
  }
});

// ─── Extract the differing word(s) between two strings ───
function extractDiff(original, replacement) {
  if (!original || !replacement) return { word: original || '', correction: replacement || '' };

  const origWords = original.trim().split(/\s+/);
  const replWords = replacement.trim().split(/\s+/);

  // Find first diverging index from the start
  let start = 0;
  while (start < origWords.length && start < replWords.length && origWords[start] === replWords[start]) {
    start++;
  }

  // Find first diverging index from the end
  let endOrig = origWords.length - 1;
  let endRepl = replWords.length - 1;
  while (endOrig > start && endRepl > start && origWords[endOrig] === replWords[endRepl]) {
    endOrig--;
    endRepl--;
  }

  const word = origWords.slice(start, endOrig + 1).join(' ');
  const correction = replWords.slice(start, endRepl + 1).join(' ');

  // If diff is empty or identical, fall back to full strings (edge case)
  if (!word && !correction) return { word: original.trim(), correction: replacement.trim() };

  return { word, correction };
}

// ─── GET /rejected-suggestions (red suggestions that were rejected by users) ───
router.get('/rejected-suggestions', async (req, res, next) => {
  try {
    const suggestions = await prisma.suggestion.findMany({
      where: {
        status: 'REJECTED',
        priority: 'red',
      },
      select: {
        id: true,
        original: true,
        replacement: true,
        reason: true,
        type: true,
        createdAt: true,
        chapter: {
          select: {
            title: true,
            project: { select: { title: true, user: { select: { email: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Group by the actual differing word(s), not full sentences
    const patterns = {};
    for (const s of suggestions) {
      const { word, correction } = extractDiff(s.original, s.replacement);
      const key = `${word.toLowerCase()}→${correction.toLowerCase()}`;
      if (!patterns[key]) {
        patterns[key] = {
          original: word,
          replacement: correction,
          fullOriginal: s.original,
          fullReplacement: s.replacement,
          reason: s.reason,
          count: 0,
          examples: [],
        };
      }
      patterns[key].count++;
      if (patterns[key].examples.length < 3) {
        patterns[key].examples.push({
          chapter: s.chapter?.title,
          project: s.chapter?.project?.title,
          user: s.chapter?.project?.user?.email,
          date: s.createdAt,
        });
      }
    }

    // Sort by frequency (most rejected first)
    const sorted = Object.values(patterns).sort((a, b) => b.count - a.count);

    res.json({ patterns: sorted, total: suggestions.length });
  } catch (err) {
    next(err);
  }
});

export default router;
