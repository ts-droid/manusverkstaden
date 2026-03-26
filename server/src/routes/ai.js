import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { reviewChapter, generateDNAProfile, developText, translateText, finalCheck } from '../services/ai.js';
import { checkUsageLimit, recordUsage } from '../services/usage.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// ─── REVIEW CHAPTER ───
router.post('/review', async (req, res, next) => {
  try {
    const chapterId = String(req.body.chapterId);
    const { projectId } = req.body;

    // Verify ownership
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { project: { select: { userId: true, genres: true, modules: true } } },
    });
    if (!chapter || chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }

    // Check usage limits
    const limit = await checkUsageLimit(req.user.id, 'review', chapter.wordCount);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    // Update status
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWING' } });

    // Call AI
    const { result: suggestions, meta } = await reviewChapter(chapter.content, {
      genres: chapter.project.genres,
      modules: chapter.project.modules,
    });

    // Save suggestions – preserve accepted/rejected, only replace pending
    const existing = await prisma.suggestion.findMany({ where: { chapterId } });
    const kept = existing.filter(s => s.status === 'ACCEPTED' || s.status === 'REJECTED');
    const keptOriginals = new Set(kept.map(s => s.original?.trim().toLowerCase()).filter(Boolean));

    // Delete only pending suggestions
    await prisma.suggestion.deleteMany({
      where: { chapterId, status: 'PENDING' },
    });

    // Filter out new suggestions that duplicate kept ones (same original text)
    const newSuggestions = suggestions.filter(s => {
      const origKey = s.original?.trim().toLowerCase();
      return origKey && !keptOriginals.has(origKey);
    });

    const created = await Promise.all(
      newSuggestions.map(s =>
        prisma.suggestion.create({
          data: {
            type: s.type,
            priority: s.priority,
            level: s.level || 1,
            original: s.original,
            replacement: s.replacement,
            reason: s.reason,
            chapterId,
          },
        })
      )
    );

    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWED' } });

    // Record usage with real API cost
    await recordUsage(req.user.id, 'review', chapter.wordCount, meta);

    // Return ALL suggestions (kept + new) so frontend has full picture
    res.json({ suggestions: [...kept, ...created] });
  } catch (err) {
    console.error(`[AI Review Error] Chapter ${req.body?.chapterId}:`, err.message);
    // Reset chapter status so it doesn't stay stuck in REVIEWING
    try {
      if (req.body?.chapterId) {
        await prisma.chapter.update({
          where: { id: String(req.body.chapterId) },
          data: { status: 'PENDING' },
        });
      }
    } catch (resetErr) {
      console.error('[AI Review] Failed to reset chapter status:', resetErr.message);
    }
    next(err);
  }
});

// ─── DNA PROFILE ───
router.post('/dna-profile', async (req, res, next) => {
  try {
    const { projectId } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user.id },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    if (!project) return res.status(404).json({ error: 'Projektet hittades inte' });

    const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);
    const limit = await checkUsageLimit(req.user.id, 'dna_profile', totalWords);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const allText = project.chapters.map(c => c.content).join('\n\n---\n\n');
    const { result: profile, meta } = await generateDNAProfile(allText, { genres: project.genres });

    await prisma.project.update({ where: { id: projectId }, data: { dnaProfile: profile } });
    await recordUsage(req.user.id, 'dna_profile', totalWords, meta);

    res.json({ dnaProfile: profile });
  } catch (err) { next(err); }
});

// ─── DEVELOP TEXT ───
router.post('/develop', async (req, res, next) => {
  try {
    const { mode, input, context } = req.body;
    const chapterId = req.body.chapterId ? String(req.body.chapterId) : null;

    if (chapterId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { project: { select: { userId: true } } },
      });
      if (!chapter || chapter.project.userId !== req.user.id) {
        return res.status(404).json({ error: 'Kapitlet hittades inte' });
      }
    }

    const wordCount = input.trim().split(/\s+/).length;
    const limit = await checkUsageLimit(req.user.id, 'develop', wordCount);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const { result, meta } = await developText(mode, input, context);
    await recordUsage(req.user.id, 'develop', wordCount, meta);

    res.json({ result });
  } catch (err) { next(err); }
});

// ─── TRANSLATE ───
router.post('/translate', async (req, res, next) => {
  try {
    const chapterId = String(req.body.chapterId);
    const { language } = req.body;

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { project: { select: { userId: true } } },
    });
    if (!chapter || chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }

    const limit = await checkUsageLimit(req.user.id, 'translate', chapter.wordCount);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const { result: translation, meta } = await translateText(chapter.content, language);

    const saved = await prisma.translation.upsert({
      where: { id: `${chapterId}-${language}` },
      create: {
        id: `${chapterId}-${language}`,
        language,
        content: translation.content,
        comments: translation.comments,
        glossary: translation.glossary,
        chapterId,
      },
      update: {
        content: translation.content,
        comments: translation.comments,
        glossary: translation.glossary,
      },
    });

    await recordUsage(req.user.id, 'translate', chapter.wordCount, meta);

    res.json({ translation: saved });
  } catch (err) { next(err); }
});

// ─── FINAL CHECK (pre-export consistency review) ───
router.post('/final-check', async (req, res, next) => {
  try {
    const { projectId } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user.id },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    if (!project) return res.status(404).json({ error: 'Projektet hittades inte' });

    const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);
    const limit = await checkUsageLimit(req.user.id, 'review', totalWords);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const allText = project.chapters.map(c => `--- ${c.title} ---\n${c.content}`).join('\n\n');
    const { result, meta } = await finalCheck(allText, { genres: project.genres });

    await recordUsage(req.user.id, 'review', totalWords, meta);

    res.json({ issues: result });
  } catch (err) { next(err); }
});

export default router;
