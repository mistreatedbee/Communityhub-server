import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';

const LOGO_BUCKET = 'logos';
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function uploadLogo(req: any, res: any) {
  if (!req.file || !req.file.buffer) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  const file = req.file as Express.Multer.File & { buffer: Buffer };
  if (file.size > MAX_SIZE) {
    throw new AppError('Logo must be 2MB or smaller', 400, 'VALIDATION_ERROR');
  }
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new AppError('Logo must be JPEG, PNG, GIF, or WebP', 400, 'VALIDATION_ERROR');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError('Database not connected', 503, 'SERVICE_UNAVAILABLE');
  }

  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: LOGO_BUCKET });
  const filename = `logo-${Date.now()}-${(file.originalname || 'logo').replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  return new Promise<void>((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: { uploadedBy: req.user?.sub }
    });

    uploadStream.once('finish', () => {
      const fileId = String(uploadStream.id);
      ok(res, { fileId }, 201);
      resolve();
    });
    uploadStream.once('error', (err) => {
      reject(err);
    });

    uploadStream.end(file.buffer);
  });
}

export async function getLogo(req: any, res: any) {
  const fileId = req.params.fileId;
  if (!fileId || !Types.ObjectId.isValid(fileId)) {
    throw new AppError('Invalid file id', 400, 'VALIDATION_ERROR');
  }
  const db = mongoose.connection.db;
  if (!db) {
    throw new AppError('Database not connected', 503, 'SERVICE_UNAVAILABLE');
  }
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: LOGO_BUCKET });
  const id = new Types.ObjectId(fileId);
  const fileDoc = await db.collection(`${LOGO_BUCKET}.files`).findOne({ _id: id });
  if (!fileDoc) {
    throw new AppError('Logo not found', 404, 'NOT_FOUND');
  }
  res.setHeader('Content-Type', (fileDoc as any).contentType || 'application/octet-stream');
  const downloadStream = bucket.openDownloadStream(id);
  downloadStream.pipe(res);
}
