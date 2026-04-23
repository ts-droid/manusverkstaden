import 'dotenv/config';

// Railway uses DATABASE_PUBLIC_URL, Prisma expects DATABASE_URL
if (process.env.DATABASE_PUBLIC_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

// Log startup config (no secrets)
if (process.env.NODE_ENV === 'production') {
  console.log('[config] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
  console.log('[config] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING (using default)');
  console.log('[config] ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING');
  console.log('[config] OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');
  console.log('[config] STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING');
}

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',

  // Anthropic
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Default AI codeset (claude-only, openai-only, or dual-provider)
  defaultCodeset: process.env.DEFAULT_CODESET || 'claude-only',

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3001'],
};
