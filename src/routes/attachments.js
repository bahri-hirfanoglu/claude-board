import { Router } from 'express';
import multer from 'multer';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = randomBytes(8).toString('hex');
    const ext = extname(file.originalname);
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/xml',
      'text/xml',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export default function attachmentRoutes({ attachmentQueries, queries, io }) {
  const router = Router();

  // Upload attachments for a task
  router.post(
    '/tasks/:taskId/attachments',
    upload.array('files', 10),
    asyncHandler(async (req, res) => {
      const task = queries.getTaskById.get(req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });

      const results = [];
      for (const file of req.files || []) {
        const result = attachmentQueries.create(task.id, file.filename, file.originalname, file.mimetype, file.size);
        const attachment = attachmentQueries.getById(result.lastInsertRowid);
        results.push(attachment);
      }

      io.emit('task:attachments', { taskId: task.id, attachments: results });
      res.status(201).json(results);
    }),
  );

  // Get attachments for a task
  router.get(
    '/tasks/:taskId/attachments',
    asyncHandler(async (req, res) => {
      res.json(attachmentQueries.getByTask(req.params.taskId));
    }),
  );

  // Delete an attachment
  router.delete(
    '/attachments/:id',
    asyncHandler(async (req, res) => {
      const attachment = attachmentQueries.getById(req.params.id);
      if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

      // Delete file from disk
      const filePath = join(UPLOADS_DIR, attachment.filename);
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {}
      }

      attachmentQueries.remove(attachment.id);
      io.emit('task:attachmentDeleted', { id: attachment.id, taskId: attachment.task_id });
      res.json({ ok: true });
    }),
  );

  return router;
}
