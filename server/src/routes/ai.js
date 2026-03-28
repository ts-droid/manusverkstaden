import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { reviewChapter, reviewChapterMultiPass, generateDNAProfile, developText, translateText, finalCheck } from '../services/ai.js';
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

    // Filter out new suggestions that duplicate kept ones (same or overlapping original text)
    const keptOriginalsArray = [...keptOriginals];
    const newSuggestions = suggestions.filter(s => {
      const origKey = s.original?.trim().toLowerCase();
      if (!origKey) return false;
      // Exact match
      if (keptOriginals.has(origKey)) return false;
      // Overlap: new original is subset of kept, or kept is subset of new
      for (const kept of keptOriginalsArray) {
        if (origKey.includes(kept) || kept.includes(origKey)) return false;
      }
      return true;
    });

    // Dedup within new suggestions: if two have overlapping originals, keep the longer one
    const deduped = [];
    for (const s of newSuggestions) {
      const origKey = s.original?.trim().toLowerCase();
      const isDuplicate = deduped.some(existing => {
        const exKey = existing.original?.trim().toLowerCase();
        return exKey && origKey && (exKey.includes(origKey) || origKey.includes(exKey));
      });
      if (!isDuplicate) deduped.push(s);
    }

    const created = await Promise.all(
      deduped.map(s =>
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

// ─── MULTI-PASS REVIEW ───
router.post('/review-multi', async (req, res, next) => {
  try {
    const chapterId = String(req.body.chapterId);
    const { projectId, level = 'basic' } = req.body;

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, project: { userId: req.user.id } },
      include: { project: { include: { chapters: { orderBy: { number: 'asc' } } } } },
    });
    if (!chapter) return res.status(404).json({ error: 'Kapitlet hittades inte' });

    const allowed = await checkUsageLimit(req.user.id);
    if (!allowed) return res.status(429).json({ error: 'API-gräns nådd för denna månad.' });

    // Update chapter status
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWING' } });

    // Get all text for DNA generation
    const allText = chapter.project.chapters.map(c => c.content).join('\n\n');
    const existingDna = chapter.project.dnaProfile;

    // Run multi-pass analysis
    const { result: suggestions, meta, dnaProfile, passCount } = await reviewChapterMultiPass(
      chapter.content,
      {
        genres: chapter.project.genres || [],
        level,
        dnaProfile: existingDna,
        allText,
      }
    );

    console.log(`[Multi-pass] ${level}: ${passCount} passes, ${suggestions.length} suggestions for chapter ${chapterId}`);

    // Save DNA if newly generated
    if (dnaProfile && !existingDna) {
      await prisma.project.update({
        where: { id: chapter.projectId },
        data: { dnaProfile },
      });
    }

    // Save suggestions — preserve accepted/rejected, only replace pending
    const existing = await prisma.suggestion.findMany({ where: { chapterId } });
    const kept = existing.filter(s => s.status === 'ACCEPTED' || s.status === 'REJECTED');
    const keptOriginals = new Set(kept.map(s => s.original?.trim().toLowerCase()).filter(Boolean));
    const keptOriginalsArray = [...keptOriginals];

    await prisma.suggestion.deleteMany({ where: { chapterId, status: 'PENDING' } });

    // Filter duplicates against kept + internal dedup
    const newSuggestions = suggestions.filter(s => {
      const origKey = s.original?.trim().toLowerCase();
      if (!origKey) return false;
      if (keptOriginals.has(origKey)) return false;
      for (const k of keptOriginalsArray) {
        if (origKey.includes(k) || k.includes(origKey)) return false;
      }
      return true;
    });

    const deduped = [];
    for (const s of newSuggestions) {
      const origKey = s.original?.trim().toLowerCase();
      const isDup = deduped.some(e => {
        const eKey = e.original?.trim().toLowerCase();
        return eKey && origKey && (eKey.includes(origKey) || origKey.includes(eKey));
      });
      if (!isDup) deduped.push(s);
    }

    const created = await Promise.all(
      deduped.map(s =>
        prisma.suggestion.create({
          data: {
            chapterId,
            type: s.type || 'grammar',
            priority: s.priority || 'yellow',
            level: s.level || 3,
            original: s.original || '',
            replacement: s.replacement || '',
            reason: s.reason || '',
            status: 'PENDING',
          },
        })
      )
    );

    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWED' } });

    // Record usage
    await recordUsage({
      userId: req.user.id,
      type: `review-multi-${level}`,
      model: meta.model,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      chapterId,
    });

    const allSuggestions = [...kept, ...created];
    res.json({
      suggestions: allSuggestions,
      dnaProfile,
      passCount,
      level,
      stats: { total: allSuggestions.length, new: created.length, kept: kept.length, validated: suggestions.length },
    });
  } catch (err) {
    try {
      const chapterId = String(req.body?.chapterId);
      if (chapterId) {
        await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'ERROR' } });
      }
    } catch (resetErr) {
      console.error('[Multi-pass] Failed to reset status:', resetErr.message);
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
    const { mode, input, context, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus } = req.body;
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

    const { result, meta } = await developText(mode, input, {
      context, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus,
    });
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
