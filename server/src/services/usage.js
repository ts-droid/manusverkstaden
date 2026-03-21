import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cost per 1000 words in SEK
const COST_TABLE = {
  review: 2.5,
  dna_profile: 0.25, // flat 19 SEK per analysis, approximated per 1k words
  develop: 5.0,
  brainstorm: 3.0,
  translate: 4.0,
};

/**
 * Check if user is within their plan's usage limits.
 */
export async function checkUsageLimit(userId, type, wordCount) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'Användaren hittades inte' };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthUsage = await prisma.usageRecord.aggregate({
    where: { userId, createdAt: { gte: monthStart } },
    _sum: { wordCount: true, cost: true },
    _count: true,
  });

  const totalWordsThisMonth = monthUsage._sum.wordCount || 0;
  const totalCostThisMonth = monthUsage._sum.cost || 0;

  // Plan-specific limits
  switch (user.plan) {
    case 'PROVA':
      // Max 1 chapter, max 5000 words total
      if (totalWordsThisMonth + wordCount > 5000) {
        return {
          allowed: false,
          reason: 'Gratis-planen tillåter max 5 000 ord. Uppgradera till Grund för mer.',
          usage: { wordsUsed: totalWordsThisMonth, limit: 5000 },
        };
      }
      break;

    case 'GRUND':
      // 50,000 words included, then usage-based
      // No hard limit, but track for billing
      break;

    case 'FORLAG':
      // Enterprise – no limits
      break;
  }

  return {
    allowed: true,
    wordsUsed: totalWordsThisMonth,
    costThisMonth: totalCostThisMonth,
    estimatedCost: calculateCost(type, wordCount),
  };
}

/**
 * Record a usage event.
 */
export async function recordUsage(userId, type, wordCount) {
  const cost = calculateCost(type, wordCount);

  return prisma.usageRecord.create({
    data: { userId, type, wordCount, cost },
  });
}

/**
 * Calculate cost in SEK for a given operation.
 */
function calculateCost(type, wordCount) {
  const ratePerThousand = COST_TABLE[type] || 0;
  return Math.round((wordCount / 1000) * ratePerThousand * 100) / 100;
}
