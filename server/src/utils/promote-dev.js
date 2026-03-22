/**
 * Promote a user to FORLAG (enterprise) plan for development purposes.
 *
 * Usage: DATABASE_URL=... node src/utils/promote-dev.js cecilia.svardsen@gmail.com
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// Railway uses DATABASE_PUBLIC_URL
if (process.env.DATABASE_PUBLIC_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
}

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node src/utils/promote-dev.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { plan: 'FORLAG' },
  });

  console.log(`✅ ${updated.email} upgraded to FORLAG (enterprise) plan`);
  console.log(`   Name: ${updated.name}`);
  console.log(`   Plan: ${updated.plan}`);
  console.log(`   No usage limits, no billing`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
