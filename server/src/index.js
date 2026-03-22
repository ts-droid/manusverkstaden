import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import chapterRoutes from './routes/chapters.js';
import suggestionRoutes from './routes/suggestions.js';
import aiRoutes from './routes/ai.js';
import billingRoutes from './routes/billing.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── MIDDLEWARE ───

// Stripe webhooks need raw body – must come before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// ─── API ROUTES ───

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── DEV ACCOUNT SETUP (runs once at startup) ───
import { PrismaClient } from '@prisma/client';
const prismaSetup = new PrismaClient();
(async () => {
  try {
    const devEmails = ['cecilia.svardsen@gmail.com'];
    for (const email of devEmails) {
      const user = await prismaSetup.user.findUnique({ where: { email } });
      if (user && user.plan !== 'FORLAG') {
        await prismaSetup.user.update({ where: { id: user.id }, data: { plan: 'FORLAG' } });
        console.log(`[setup] ${email} upgraded to FORLAG (dev account)`);
      }
    }
  } catch (err) {
    // Ignore - might not have DB yet
  } finally {
    await prismaSetup.$disconnect();
  }
})();

// ─── SERVE FRONTEND IN PRODUCTION ───

if (!config.isDev) {
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ─── ERROR HANDLER ───

app.use(errorHandler);

// ─── START ───

app.listen(config.port, () => {
  console.log(`🔧 Manusverkstaden API running on port ${config.port} (${config.nodeEnv})`);
});
