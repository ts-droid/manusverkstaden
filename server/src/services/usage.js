import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cost per 1000 words in SEK (user-facing pricing / revenue)
const COST_TABLE = {
  review: 2.5,
  dna_profile: 0.25, // flat 19 SEK per analysis, approximated per 1k words
  develop: 5.0,
  brainstorm: 3.0,
  translate: 4.0,
};

// Anthropic API pricing in USD per million tokens
const API_PRICING = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 15, output: 75 },
  // Fallback for unknown models
  default: { input: 3, output: 15 },
};

/**
 * Calculate actual API cost in USD from token usage.
 */
function calculateApiCostUsd(inputTokens, outputTokens, model) {
  const pricing = API_PRICING[model] || API_PRICING.default;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal precision
}

/**
 * Check if user is within their plan's usage limits.
 */
export async function checkUsageLimit(userId, type, wordCount) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: 'Användaren hittades inte' };

  // Dev accounts bypass all usage limits
  if (user.isDevAccount) {
    return { allowed: true, wordsUsed: 0, costThisMonth: 0, estimatedCost: 0, devAccount: true };
  }

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
 * Record a usage event with optional API cost metadata.
 * @param {string} userId
 * @param {string} type
 * @param {number} wordCount
 * @param {{ inputTokens?: number, outputTokens?: number, model?: string }} [apiMeta]
 */
export async function recordUsage(userId, type, wordCount, apiMeta) {
  // Dev accounts skip cost tracking but still record API costs for monitoring
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isDev = user?.isDevAccount;

  const cost = isDev ? 0 : calculateCost(type, wordCount);

  const data = { userId, type, wordCount, cost };

  if (apiMeta) {
    data.apiInputTokens = apiMeta.inputTokens || 0;
    data.apiOutputTokens = apiMeta.outputTokens || 0;
    data.model = apiMeta.model || null;
    data.apiCostUsd = calculateApiCostUsd(
      apiMeta.inputTokens || 0,
      apiMeta.outputTokens || 0,
      apiMeta.model
    );
  }

  if (isDev) {
    // Still record for API cost monitoring even for dev accounts
    return prisma.usageRecord.create({ data });
  }

  return prisma.usageRecord.create({ data });
}

/**
 * Calculate cost in SEK for a given operation.
 */
function calculateCost(type, wordCount) {
  const ratePerThousand = COST_TABLE[type] || 0;
  return Math.round((wordCount / 1000) * ratePerThousand * 100) / 100;
}
