/**
 * One-time DB migration: fix broken paragraphs in all chapter content.
 *
 * Mammoth imports created \n\n between lines that belong to the same sentence.
 * This was fixed at import-time, but existing DB content still has the old format.
 * This migration applies the same merge logic to all existing chapters.
 *
 * Uses a marker in the DB to ensure it only runs once.
 */

import { PrismaClient } from '@prisma/client';
import { mergeBrokenParagraphs } from '../services/manuscriptParser.js';

const MIGRATION_KEY = 'migration:fix_broken_paragraphs_v1';

export async function fixBrokenParagraphs() {
  const prisma = new PrismaClient();

  try {
    // Check if migration already ran
    const existing = await prisma.promptConfig.findUnique({
      where: { key: MIGRATION_KEY },
    }).catch(() => null);

    if (existing) {
      console.log('[migration] fix-broken-paragraphs already applied, skipping');
      return;
    }

    console.log('[migration] Fixing broken paragraphs in all chapters...');

    const chapters = await prisma.chapter.findMany({
      select: { id: true, content: true, title: true },
    });

    let fixed = 0;
    let unchanged = 0;

    for (const chapter of chapters) {
      if (!chapter.content) {
        unchanged++;
        continue;
      }

      // Step 1: Join single \n within paragraphs (same as cleanTextForImport)
      let cleaned = chapter.content
        .replace(/([^\n])\n(?=[^\n])/g, '$1 ')
        .replace(/ {2,}/g, ' ');

      // Step 2: Merge broken paragraphs (same logic as import-time)
      const merged = mergeBrokenParagraphs(cleaned);

      if (merged !== chapter.content) {
        await prisma.chapter.update({
          where: { id: chapter.id },
          data: {
            content: merged,
            wordCount: merged.split(/\s+/).filter(w => w).length,
          },
        });
        fixed++;
      } else {
        unchanged++;
      }
    }

    // Mark migration as done
    await prisma.promptConfig.upsert({
      where: { key: MIGRATION_KEY },
      create: { key: MIGRATION_KEY, content: `Applied at ${new Date().toISOString()}. Fixed ${fixed} chapters.` },
      update: {},
    });

    console.log(`[migration] Done: ${fixed} chapters fixed, ${unchanged} unchanged`);
  } catch (err) {
    console.error('[migration] fix-broken-paragraphs failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}
