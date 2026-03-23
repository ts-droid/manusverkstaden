import Stripe from 'stripe';
import { config } from '../config.js';

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;

// In-memory cache (Stripe has rate limits)
let revenueCache = null;
let revenueCacheTime = 0;
const CACHE_TTL = 5 * 60_000; // 5 minutes

/**
 * Get revenue from paid invoices in a given period.
 * Returns amount in the invoice's currency (typically SEK).
 */
async function getMonthlyRevenue(monthStart, monthEnd) {
  if (!stripe) return null;

  const invoices = await stripe.invoices.list({
    created: {
      gte: Math.floor(monthStart.getTime() / 1000),
      lte: Math.floor(monthEnd.getTime() / 1000),
    },
    status: 'paid',
    limit: 100,
  });

  let totalRevenue = 0;
  let currency = 'sek';

  for (const invoice of invoices.data) {
    totalRevenue += invoice.amount_paid; // in smallest unit (öre for SEK)
    currency = invoice.currency;
  }

  // Convert from öre/cents to full units
  return { amount: totalRevenue / 100, currency, invoiceCount: invoices.data.length };
}

/**
 * Calculate MRR from active subscriptions.
 */
async function getMRR() {
  if (!stripe) return null;

  let mrr = 0;
  let activeCount = 0;
  let currency = 'sek';
  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const params = {
      status: 'active',
      limit: 100,
      expand: ['data.items'],
    };
    if (startingAfter) params.starting_after = startingAfter;

    const subscriptions = await stripe.subscriptions.list(params);

    for (const sub of subscriptions.data) {
      activeCount++;
      for (const item of sub.items.data) {
        const price = item.price;
        currency = price.currency;

        if (price.recurring?.interval === 'month') {
          mrr += (price.unit_amount * (item.quantity || 1));
        } else if (price.recurring?.interval === 'year') {
          mrr += (price.unit_amount * (item.quantity || 1)) / 12;
        }
      }
    }

    hasMore = subscriptions.has_more;
    if (hasMore && subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  // Convert from öre/cents to full units
  return { mrr: Math.round(mrr / 100), activeSubscriptions: activeCount, currency };
}

/**
 * Get complete revenue stats with caching.
 * Returns null if Stripe is not configured.
 */
export async function getRevenueStats() {
  if (!stripe) return null;

  const now = Date.now();
  if (revenueCache && (now - revenueCacheTime) < CACHE_TTL) {
    return revenueCache;
  }

  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date();

    const [revenue, mrrData] = await Promise.all([
      getMonthlyRevenue(monthStart, monthEnd),
      getMRR(),
    ]);

    const stats = {
      revenueThisMonth: revenue?.amount || 0,
      invoiceCount: revenue?.invoiceCount || 0,
      mrr: mrrData?.mrr || 0,
      activeSubscriptions: mrrData?.activeSubscriptions || 0,
      currency: revenue?.currency || mrrData?.currency || 'sek',
      source: 'stripe',
    };

    revenueCache = stats;
    revenueCacheTime = now;

    return stats;
  } catch (err) {
    console.error('[stripe-revenue] Failed to fetch revenue stats:', err.message);
    return null;
  }
}
