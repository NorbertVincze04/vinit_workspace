import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../../config.js';
import { db } from '../../db/knex.js';
import { HttpError, notFound } from '../../http/errors.js';
import { parseParams } from '../../http/validate.js';
import { logActivity } from '../../lib/activity.js';
import { id, timestamp, uuid } from '../../lib/schemas.js';
import { kindOf } from './file-kinds.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileBytes, files: 1, fields: 10 },
});

const uploadFields = z.object({
  /** Kept when moving files from the browser, so links and order survive. */
  id: id.optional(),
  createdAt: timestamp.optional(),
  /** Sent separately because multipart file names are not reliably UTF-8 ("Fișă onboarding.pdf"). */
  name: z.string().trim().min(1).max(255).optional(),
  /** Attach to a salon and/or one of its contracts. */
  salonId: uuid.optional(),
  contractId: uuid.optional(),
});

const listQuery = z.object({ salonId: uuid.optional(), contractId: uuid.optional() });

const META = ['id', 'name', 'mime', 'sizeBytes', 'kind', 'uploadedBy', 'salonId', 'contractId', 'createdAt', 'updatedAt'] as const;

/** RFC 6266 header that keeps non-ASCII names intact. */
function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Shared files, stored in Postgres (bytes in file_blobs).
 *   GET    /files                 → { items }   (metadata only)
 *   POST   /files                 multipart "file" (+ optional id, createdAt, name) → { item }
 *   GET    /files/:id/download    → the bytes
 *   DELETE /files/:id             → 204
 */
export function filesRouter(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { salonId, contractId } = listQuery.parse(req.query ?? {});
    const q = db('files').select(META).orderBy('createdAt', 'desc');
    if (salonId) q.where({ salonId });
    if (contractId) q.where({ contractId });
    res.json({ items: await q });
  });

  router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, 'validation', 'Choose a file to upload.', { file: 'Required' });
    if (!file.size) throw new HttpError(400, 'validation', 'The file is empty.', { file: 'Empty file' });
    const fields = uploadFields.parse(req.body ?? {});
    const name = fields.name ?? Buffer.from(file.originalname, 'latin1').toString('utf8');

    const item = await db.transaction(async (trx) => {
      // A contract's file belongs to the contract's salon.
      let salonId = fields.salonId ?? null;
      if (fields.contractId) {
        const contract = await trx('contracts').where({ id: fields.contractId }).first('salonId');
        if (!contract) throw new HttpError(400, 'validation', 'This contract does not exist.', { contractId: 'Unknown contract' });
        if (salonId && salonId !== contract.salonId) throw new HttpError(400, 'validation', 'The contract belongs to another salon.', { contractId: 'Other salon' });
        salonId = contract.salonId;
      }
      const [row] = await trx('files')
        .insert({
          ...(fields.id ? { id: fields.id } : {}),
          ...(fields.createdAt ? { createdAt: fields.createdAt } : {}),
          name,
          mime: file.mimetype || '',
          sizeBytes: file.size,
          kind: kindOf(name, file.mimetype),
          uploadedBy: req.user?.id ?? null,
          salonId,
          contractId: fields.contractId ?? null,
        })
        .returning(META);
      await trx('file_blobs').insert({ fileId: row.id, bytes: file.buffer });
      await logActivity(trx, { userId: req.user?.id, entityType: 'files', entityId: row.id, salonId, action: 'uploaded', summary: name });
      return row;
    });
    res.status(201).json({ item });
  });

  router.get('/:id/download', async (req, res) => {
    const { id: fileId } = parseParams(z.object({ id }), req);
    const row = await db('files')
      .join('file_blobs', 'file_blobs.file_id', 'files.id')
      .where('files.id', fileId)
      .first('files.name', 'files.mime', 'file_blobs.bytes');
    if (!row) throw notFound('File');
    res.set({
      'Content-Type': row.mime || 'application/octet-stream',
      'Content-Disposition': contentDisposition(row.name),
      'Cache-Control': 'private, no-store',
    });
    res.send(row.bytes);
  });

  router.delete('/:id', async (req, res) => {
    const { id: fileId } = parseParams(z.object({ id }), req);
    const [row] = await db('files').where({ id: fileId }).delete().returning(['id', 'name']);
    if (!row) throw notFound('File');
    await logActivity(db, { userId: req.user?.id, entityType: 'files', entityId: fileId, action: 'deleted', summary: row.name });
    res.status(204).end();
  });

  return router;
}
