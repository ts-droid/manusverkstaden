import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// ─── GET CHAPTER WITH SUGGESTIONS ───
router.get('/:id', async (req, res, next) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: {
        suggestions: { orderBy: { createdAt: 'asc' } },
        translations: true,
        project: { select: { userId: true } },
      },
    });
    if (!chapter || chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }
    res.json({ chapter });
  } catch (err) { next(err); }
});

// ─── UPDATE CHAPTER ───
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, content, status } = req.body;

    // Verify ownership
    const existing = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { userId: true } } },
    });
    if (!existing || existing.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }

    const wordCount = content
      ? content.trim().split(/\s+/).filter(w => w).length
      : existing.wordCount;

    const chapter = await prisma.chapter.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content, wordCount }),
        ...(status !== undefined && { status }),
      },
    });
    res.json({ chapter });
  } catch (err) { next(err); }
});

// ─── SPLIT CHAPTER ───
router.post('/:id/split', async (req, res, next) => {
  try {
    const { paragraphIndex } = req.body;
    const chapter = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { userId: true, id: true } } },
    });
    if (!chapter || chapter.project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Kapitlet hittades inte' });
    }

    const paragraphs = chapter.content.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length - 1) {
      return res.status(400).json({ error: 'Ogiltigt styckeindex' });
    }

    const firstContent = paragraphs.slice(0, paragraphIndex + 1).join('\n\n');
    const secondContent = paragraphs.slice(paragraphIndex + 1).join('\n\n');

    // Update current chapter
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        content: firstContent,
        wordCount: firstContent.trim().split(/\s+/).filter(w => w).length,
      },
    });

    // Shift subsequent chapters
    await prisma.$executeRaw`UPDATE "Chapter" SET number = number + 1 WHERE "projectId" = ${chapter.project.id} AND number > ${chapter.number}`;

    // Create new chapter
    const newChapter = await prisma.chapter.create({
      data: {
        number: chapter.number + 1,
        title: `Kapitel ${chapter.number + 1}`,
        content: secondContent,
        wordCount: secondContent.trim().split(/\s+/).filter(w => w).length,
        projectId: chapter.project.id,
      },
    });

    res.json({ original: chapter.id, newChapter });
  } catch (err) { next(err); }
});

export default router;
