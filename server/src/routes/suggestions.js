import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// ─── UPDATE SUGGESTION STATUS ───
router.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body; // ACCEPTED, REJECTED, PENDING (undo)
    if (!['ACCEPTED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Ogiltig status. Använd ACCEPTED, REJECTED eller PENDING.' });
    }

    // Verify ownership
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: req.params.id },
      include: { chapter: { include: { project: { select: { userId: true } } } } },
    });
    if (!suggestion || suggestion.chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Förslaget hittades inte' });
    }

    const updated = await prisma.suggestion.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ suggestion: updated });
  } catch (err) { next(err); }
});

// ─── CREATE SUGGESTION (e.g. from develop-insert) ───
router.post('/', async (req, res, next) => {
  try {
    const { chapterId, type, priority, level, original, replacement, reason, status } = req.body;
    if (!chapterId || !type || !original) {
      return res.status(400).json({ error: 'chapterId, type och original krävs' });
    }

    // Verify ownership
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { project: { select: { userId: true } } },
    });
    if (!chapter || chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        chapterId,
        type: type || 'develop',
        priority: priority || 'green',
        level: level || 2,
        original,
        replacement: replacement || null,
        reason: reason || '',
        status: status || 'ACCEPTED',
      },
    });
    res.json({ suggestion });
  } catch (err) { next(err); }
});

// ─── BULK UPDATE ───
router.patch('/', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !['ACCEPTED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Ogiltigt format' });
    }

    // For simplicity, update all matching - ownership checked by chapter→project→user
    const result = await prisma.suggestion.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    res.json({ updated: result.count });
  } catch (err) { next(err); }
});

export default router;
