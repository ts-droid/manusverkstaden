import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { parseUploadedFile } from '../services/manuscriptParser.js';
import { generateDNAProfile } from '../services/ai.js';

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

// ─── CREATE PROJECT (optionally with chapters) ───
router.post('/', async (req, res, next) => {
  try {
    const { title, genres, modules, transLanguages, dnaProfile, chapters } = req.body;
    const project = await prisma.project.create({
      data: {
        title: title || 'Nytt projekt',
        genres: genres || [],
        modules: modules || [],
        transLanguages: transLanguages || [],
        dnaProfile: dnaProfile || undefined,
        userId: req.user.id,
        ...(chapters?.length ? {
          chapters: {
            create: chapters.map((ch, i) => ({
              number: ch.number || i + 1,
              title: ch.title || `Kapitel ${i + 1}`,
              content: ch.content || '',
              wordCount: ch.wordCount || 0,
            })),
          },
        } : {}),
      },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    res.status(201).json({ id: project.id, project });
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

    // Return response immediately
    res.json({ chapters: created });

    // Generate DNA asynchronously in the background (don't block response)
    const allText = chapters.map(ch => ch.content).join('\n\n');
    if (allText.length > 500) {
      // Fetch existing author DNA so it accumulates across manuscripts
      const existingUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { authorDna: true },
      }).catch(() => null);

      console.log(`[DNA Auto] Generating DNA for project ${project.id} after upload (${chapters.length} chapters, existing author DNA: ${existingUser?.authorDna ? 'yes' : 'no'})`);
      generateDNAProfile(allText, { genres: project.genres || [], existingAuthorDna: existingUser?.authorDna || null })
        .then(async ({ storyDna, authorDna, result: combined }) => {
          // Save story DNA + combined profile on project
          await prisma.project.update({
            where: { id: project.id },
            data: { dnaProfile: combined, storyDna },
          });
          console.log(`[DNA Auto] Story DNA saved for project ${project.id}`);

          // Update cumulative author DNA on user
          if (authorDna) {
            const user = await prisma.user.findUnique({
              where: { id: req.user.id },
              select: { authorDnaVersion: true },
            });
            await prisma.user.update({
              where: { id: req.user.id },
              data: {
                authorDna,
                authorDnaVersion: (user?.authorDnaVersion || 0) + 1,
              },
            });
            console.log(`[DNA Auto] Author DNA updated for user ${req.user.id} (v${(user?.authorDnaVersion || 0) + 1})`);
          }
        })
        .catch(err => console.error(`[DNA Auto] Failed for project ${project.id}:`, err.message));
    }
  } catch (err) { next(err); }
});

// ─── DUPLICATE PROJECT (save as new version) ───
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    if (!project || project.userId !== req.user.id) {
      return res.status(404).json({ error: 'Projektet hittades inte' });
    }

    const newTitle = req.body.title || `${project.title} (kopia)`;

    const newProject = await prisma.project.create({
      data: {
        title: newTitle,
        genres: project.genres,
        modules: project.modules,
        userId: project.userId,
      },
    });

    const newChapters = await Promise.all(
      project.chapters.map(ch =>
        prisma.chapter.create({
          data: {
            number: ch.number,
            title: ch.title,
            content: ch.content,
            wordCount: ch.wordCount,
            projectId: newProject.id,
          },
        })
      )
    );

    res.json({ project: { ...newProject, chapters: newChapters } });
  } catch (err) { next(err); }
});

export default router;
