import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { parseUploadedFile } from '../services/manuscriptParser.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(requireAuth);

// ─── LIST PROJECTS ───
router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user.id },
      include: { chapters: { select: { id: true, number: true, title: true, wordCount: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ projects });
  } catch (err) { next(err); }
});

// ─── GET PROJECT ───
router.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
          include: { suggestions: true, translations: true },
        },
      },
    });
    if (!project) return res.status(404).json({ error: 'Projektet hittades inte' });
    res.json({ project });
  } catch (err) { next(err); }
});

// ─── CREATE PROJECT ───
router.post('/', async (req, res, next) => {
  try {
    const { title, genres, modules, transLanguages } = req.body;
    const project = await prisma.project.create({
      data: {
        title: title || 'Nytt projekt',
        genres: genres || [],
        modules: modules || [],
        transLanguages: transLanguages || [],
        userId: req.user.id,
      },
    });
    res.status(201).json({ project });
  } catch (err) { next(err); }
});

// ─── UPDATE PROJECT ───
router.patch('/:id', async (req, res, next) => {
  try {
    const { title, genres, modules, transLanguages, dnaProfile } = req.body;
    const project = await prisma.project.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        ...(title !== undefined && { title }),
        ...(genres !== undefined && { genres }),
        ...(modules !== undefined && { modules }),
        ...(transLanguages !== undefined && { transLanguages }),
        ...(dnaProfile !== undefined && { dnaProfile }),
      },
    });
    if (project.count === 0) return res.status(404).json({ error: 'Projektet hittades inte' });
    const updated = await prisma.project.findUnique({ where: { id: req.params.id } });
    res.json({ project: updated });
  } catch (err) { next(err); }
});

// ─── DELETE PROJECT ───
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.project.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Projektet hittades inte' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── UPLOAD MANUSCRIPT ───
router.post('/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Ingen fil bifogad' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Projektet hittades inte' });

    const chapters = await parseUploadedFile(req.file);

    // Delete existing chapters and create new ones
    await prisma.chapter.deleteMany({ where: { projectId: project.id } });
    const created = await Promise.all(
      chapters.map((ch, i) =>
        prisma.chapter.create({
          data: {
            number: i + 1,
            title: ch.title,
            content: ch.content,
            wordCount: ch.wordCount,
            projectId: project.id,
          },
        })
      )
    );

    res.json({ chapters: created });
  } catch (err) { next(err); }
});

export default router;
