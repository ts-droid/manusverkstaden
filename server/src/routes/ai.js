import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { reviewChapter, reviewChapterMultiPass, reviewChapterAddon, generateDNAProfile, aggregateSuggestionFeedback, developText, translateText, finalCheck } from '../services/ai.js';
import { checkUsageLimit, recordUsage } from '../services/usage.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// ─── REVIEW CHAPTER ───
router.post('/review', async (req, res, next) => {
  try {
    const chapterId = String(req.body.chapterId);
    const { projectId, level = 'standard' } = req.body;

    // Verify ownership — include all chapters for allText and dnaProfile
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { project: { select: { userId: true, genres: true, modules: true, dnaProfile: true, storyDna: true, chapters: { select: { content: true }, orderBy: { number: 'asc' } } } } },
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

    // Use all chapter text for DNA profiling context
    const allText = chapter.project.chapters.map(c => c.content).join('\n\n');
    const existingDna = chapter.project.dnaProfile;

    // Call AI — multi-pass analysis with stored DNA
    console.log(`[AI Review] Starting ${level} analysis for chapter ${chapterId} (${chapter.wordCount} words, DNA: ${existingDna ? 'yes' : 'no'})`);
    const { result: suggestions, meta, dnaProfile: dna } = await reviewChapterMultiPass(chapter.content, {
      genres: chapter.project.genres,
      level,
      dnaProfile: existingDna,
      storyDna: chapter.project.storyDna,
      allText,
    });

    // Save DNA if newly generated and not stored yet
    if (dna && !existingDna) {
      await prisma.project.update({
        where: { id: chapter.projectId },
        data: { dnaProfile: dna },
      });
    }

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

    // Filter out no-op suggestions (original ≈ replacement, or "no change needed")
    const normS = str => str?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
    const meaningful = deduped.filter(s => {
      if (s.original && s.replacement && normS(s.original) === normS(s.replacement)) return false;
      if (s.reason && /ingen ändring|korrekt form|redan korrekt|behövs inte/i.test(s.reason)) return false;
      // Verify original text actually exists in the chapter — reject hallucinated quotes
      if (s.original && chapter?.content) {
        const chapterContent = chapter.content;
        const origNorm = normS(s.original);
        const contentNorm = normS(chapterContent);
        if (!contentNorm.includes(origNorm)) {
          // Try shorter prefix match (AI may have truncated)
          const prefix = origNorm.substring(0, 30);
          if (prefix.length >= 10 && !contentNorm.includes(prefix)) {
            console.warn(`[AI Filter] Rejected hallucinated suggestion — original not found: "${s.original.slice(0, 60)}..."`);
            return false;
          }
        }
      }
      return true;
    });

    const created = await Promise.all(
      meaningful.map(s =>
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
      include: { project: { select: { id: true, genres: true, dnaProfile: true, storyDna: true, chapters: { orderBy: [{ number: 'asc' }, { createdAt: 'asc' }] } } } },
    });
    if (!chapter) return res.status(404).json({ error: 'Kapitlet hittades inte' });

    const limit = await checkUsageLimit(req.user.id, 'review', chapter.wordCount || 0);
    if (!limit.allowed) return res.status(429).json({ error: limit.reason, usage: limit });

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
        storyDna: chapter.project.storyDna,
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
    await recordUsage(req.user.id, `review-${level}`, chapter.wordCount, meta);

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
        await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'PENDING' } });
      }
    } catch (resetErr) {
      console.error('[Multi-pass] Failed to reset status:', resetErr.message);
    }
    next(err);
  }
});

// ─── REVIEW ADDON (add pass 3/4 to already-reviewed chapter) ───
router.post('/review-addon', async (req, res, next) => {
  try {
    const chapterId = String(req.body.chapterId);
    const { projectId, passes = ['pass3'] } = req.body;

    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, project: { userId: req.user.id } },
      include: { project: { select: { id: true, genres: true, dnaProfile: true, storyDna: true, chapters: { orderBy: [{ number: 'asc' }, { createdAt: 'asc' }] } } } },
    });
    if (!chapter) return res.status(404).json({ error: 'Kapitlet hittades inte' });

    const limit = await checkUsageLimit(req.user.id, 'review', chapter.wordCount || 0);
    if (!limit.allowed) return res.status(429).json({ error: limit.reason, usage: limit });

    // Update chapter status
    await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWING' } });

    // Get existing suggestions for context (so addon doesn't duplicate)
    const existingSuggestions = await prisma.suggestion.findMany({ where: { chapterId } });
    const existingDna = chapter.project.dnaProfile;

    console.log(`[Review Addon] Running ${passes.join(', ')} for chapter ${chapterId} (${chapter.wordCount} words, DNA: ${existingDna ? 'yes' : 'no'})`);

    // Run only the requested passes
    const { result: suggestions, meta, passesRun } = await reviewChapterAddon(
      chapter.content,
      {
        passes,
        dnaProfile: existingDna,
        storyDna: chapter.project.storyDna,
        existingSuggestions: existingSuggestions.map(s => ({
          original: s.original,
          replacement: s.replacement,
          reason: s.reason,
          priority: s.priority,
        })),
        genres: chapter.project.genres || [],
      }
    );

    console.log(`[Review Addon] ${passesRun.join(', ')}: ${suggestions.length} new suggestions for chapter ${chapterId}`);

    // Dedup against existing suggestions
    const existingOriginals = new Set(existingSuggestions.map(s => s.original?.trim().toLowerCase()).filter(Boolean));
    const newSuggestions = suggestions.filter(s => {
      const origKey = s.original?.trim().toLowerCase();
      if (!origKey) return false;
      if (existingOriginals.has(origKey)) return false;
      for (const k of existingOriginals) {
        if (origKey.includes(k) || k.includes(origKey)) return false;
      }
      return true;
    });

    // Internal dedup
    const deduped = [];
    for (const s of newSuggestions) {
      const origKey = s.original?.trim().toLowerCase();
      const isDup = deduped.some(e => {
        const eKey = e.original?.trim().toLowerCase();
        return eKey && origKey && (eKey.includes(origKey) || origKey.includes(eKey));
      });
      if (!isDup) deduped.push(s);
    }

    // Create new suggestions in DB
    const created = await Promise.all(
      deduped.map(s =>
        prisma.suggestion.create({
          data: {
            chapterId,
            type: s.type || 'style',
            priority: s.priority || 'yellow',
            level: s.level || 2,
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
    const passLabel = passes.includes('pass4') ? 'review-deep-addon' : 'review-standard-addon';
    await recordUsage(req.user.id, passLabel, chapter.wordCount, meta);

    // Return ALL suggestions (existing + new) so frontend has full picture
    const allSuggestions = [...existingSuggestions, ...created];
    res.json({
      suggestions: allSuggestions,
      passesRun,
      stats: { total: allSuggestions.length, new: created.length, existing: existingSuggestions.length },
    });
  } catch (err) {
    try {
      const chapterId = String(req.body?.chapterId);
      if (chapterId) {
        await prisma.chapter.update({ where: { id: chapterId }, data: { status: 'REVIEWED' } });
      }
    } catch (resetErr) {
      console.error('[Review Addon] Failed to reset status:', resetErr.message);
    }
    next(err);
  }
});

// ─── DNA PROFILE (two-part: story DNA + author DNA) ───
router.post('/dna-profile', async (req, res, next) => {
  try {
    const { projectId } = req.body;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user.id },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    if (!project) return res.status(404).json({ error: 'Projektet hittades inte' });

    // Fetch existing author DNA for cumulative building
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { authorDna: true, authorDnaVersion: true },
    });

    const totalWords = project.chapters.reduce((s, c) => s + c.wordCount, 0);
    const limit = await checkUsageLimit(req.user.id, 'dna_profile', totalWords);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const allText = project.chapters.map(c => c.content).join('\n\n---\n\n');

    // Aggregate feedback from previous accept/reject decisions
    const feedbackSummary = await aggregateSuggestionFeedback(req.user.id);
    if (feedbackSummary) {
      console.log(`[DNA Profile] Including feedback from ${feedbackSummary.totalReviewed} reviewed suggestions (${feedbackSummary.acceptRate}% accept rate)`);
    }

    const { storyDna, authorDna, result: combined, meta } = await generateDNAProfile(allText, {
      genres: project.genres,
      existingAuthorDna: user?.authorDna || null,
      feedbackSummary,
    });

    // Save story DNA to project, combined profile for backward compat
    await prisma.project.update({
      where: { id: projectId },
      data: {
        dnaProfile: combined,
        storyDna: storyDna,
      },
    });

    // Save/update cumulative author DNA on user
    if (authorDna) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          authorDna: authorDna,
          authorDnaVersion: (user?.authorDnaVersion || 0) + 1,
        },
      });
    }

    await recordUsage(req.user.id, 'dna_profile', totalWords, meta);

    res.json({
      dnaProfile: combined,
      storyDna,
      authorDna,
      authorDnaVersion: (user?.authorDnaVersion || 0) + 1,
    });
  } catch (err) { next(err); }
});

// ─── DEVELOP TEXT ───
router.post('/develop', async (req, res, next) => {
  try {
    const { mode, input, context, dnaProfile, emotionMap, chapterTitle, userInstruction, rewriteFocus } = req.body;
    const chapterId = req.body.chapterId ? String(req.body.chapterId) : null;

    // Fetch full DNA from database — don't rely on what frontend sends
    let fullStoryDna = null;
    let fullAuthorDna = null;
    let fullDnaProfile = dnaProfile; // fallback to frontend-sent

    if (chapterId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { project: { select: { userId: true, dnaProfile: true, storyDna: true } } },
      });
      if (!chapter || chapter.project.userId !== req.user.id) {
        return res.status(404).json({ error: 'Kapitlet hittades inte' });
      }
      fullDnaProfile = chapter.project.dnaProfile || dnaProfile;
      fullStoryDna = chapter.project.storyDna;
    }

    // Fetch author DNA from user record
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { authorDna: true },
    });
    fullAuthorDna = user?.authorDna || null;

    const wordCount = input.trim().split(/\s+/).length;
    const limit = await checkUsageLimit(req.user.id, 'develop', wordCount);
    if (!limit.allowed) {
      return res.status(429).json({ error: limit.reason, usage: limit });
    }

    const { result, meta } = await developText(mode, input, {
      context, dnaProfile: fullDnaProfile, storyDna: fullStoryDna, authorDna: fullAuthorDna,
      emotionMap, chapterTitle, userInstruction, rewriteFocus,
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
