import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding PlanConfig...');

  await prisma.planConfig.upsert({
    where: { plan: 'PROVA' },
    create: {
      plan: 'PROVA',
      displayName: 'Prova',
      priceMonthly: 0,
      maxChaptersPerMonth: 1,
      maxWordsPerReview: 5000,
      includedReviews: 1,
      includedWords: 5000,
      features: { genres: true, export: false, develop: false, translate: false },
    },
    update: {},
  });

  await prisma.planConfig.upsert({
    where: { plan: 'GRUND' },
    create: {
      plan: 'GRUND',
      displayName: 'Grund',
      priceMonthly: 99,
      maxChaptersPerMonth: null,
      maxWordsPerReview: null,
      includedReviews: 1,
      includedWords: 50000,
      features: { genres: true, export: true, develop: true, translate: false },
    },
    update: {},
  });

  await prisma.planConfig.upsert({
    where: { plan: 'FORLAG' },
    create: {
      plan: 'FORLAG',
      displayName: 'Förlag',
      priceMonthly: 1500,
      maxChaptersPerMonth: null,
      maxWordsPerReview: null,
      includedReviews: -1, // unlimited
      includedWords: -1,
      features: { genres: true, export: true, develop: true, translate: true, api: true, sso: true },
    },
    update: {},
  });

  console.log('✓ PlanConfig seeded');
}

seed()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
