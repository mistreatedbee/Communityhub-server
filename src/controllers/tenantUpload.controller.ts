import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { MembershipModel } from '../models/Membership.js';
import { AppError } from '../utils/errors.js';
import { ok } from '../utils/response.js';

const TENANT_FILES_BUCKET = 'tenant-files';

const MAX_RESOURCE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_POST_MEDIA_SIZE = 5 * 1024 * 1024; // 5MB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const RESOURCE_TYPES = [
  ...IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];
const ATTACHMENT_TYPES = [...RESOURCE_TYPES];

async function ensureMembership(tenantId: string, userId: string) {
  const row = await MembershipModel.findOne({
    tenantId: new Types.ObjectId(tenantId),
    userId: new Types.ObjectId(userId),
    status: 'ACTIVE'
  }).lean();
  if (!row) throw new AppError('Not a tenant member', 403, 'FORBIDDEN');
}

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new AppError('Database not connected', 503, 'SERVICE_UNAVAILABLE');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: TENANT_FILES_BUCKET });
}

function streamToGridFS(
  bucket: mongoose.mongo.GridFSBucket,
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata: { tenantId: string; purpose: string; uploadedBy: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: {
        ...metadata,
        tenantId: metadata.tenantId
      }
    });
    uploadStream.once('finish', () => resolve(String(uploadStream.id)));
    uploadStream.once('error', reject);
    uploadStream.end(buffer);
  });
}

export async function uploadResource(req: any, res: any) {
  const tenantId = req.params.tenantId as string;
  const files = req.files as { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;
  const file = (files?.file?.[0] ?? req.file) as (Express.Multer.File & { buffer: Buffer }) | undefined;
  const thumbnailFile = files?.thumbnail?.[0] as (Express.Multer.File & { buffer: Buffer }) | undefined;

  if (!file?.buffer) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  if (file.size > MAX_RESOURCE_SIZE) {
    throw new AppError('Resource file must be 20MB or smaller', 400, 'VALIDATION_ERROR');
  }
  if (!RESOURCE_TYPES.includes(file.mimetype)) {
    throw new AppError('Invalid file type for resource', 400, 'VALIDATION_ERROR');
  }

  const bucket = getBucket();
  const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `resource-${Date.now()}-${safeName}`;
  const metadata = {
    tenantId,
    purpose: 'resource',
    uploadedBy: req.user?.sub ?? ''
  };

  const fileId = await streamToGridFS(bucket, file.buffer, filename, file.mimetype, metadata);
  const result: { fileId: string; fileName: string; mimeType: string; size: number; thumbnailFileId?: string } = {
    fileId,
    fileName: file.originalname || 'file',
    mimeType: file.mimetype,
    size: file.size
  };

  if (thumbnailFile?.buffer) {
    if (thumbnailFile.size > MAX_THUMBNAIL_SIZE) {
      throw new AppError('Thumbnail must be 2MB or smaller', 400, 'VALIDATION_ERROR');
    }
    if (!IMAGE_TYPES.includes(thumbnailFile.mimetype)) {
      throw new AppError('Thumbnail must be JPEG, PNG, GIF, or WebP', 400, 'VALIDATION_ERROR');
    }
    const thumbName = `resource-thumb-${Date.now()}-${(thumbnailFile.originalname || 'thumb').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const thumbId = await streamToGridFS(bucket, thumbnailFile.buffer, thumbName, thumbnailFile.mimetype, {
      ...metadata,
      purpose: 'resource-thumbnail'
    });
    result.thumbnailFileId = thumbId;
  }

  return ok(res, result, 201);
}

export async function uploadEventThumbnail(req: any, res: any) {
  const tenantId = req.params.tenantId as string;
  const file = req.file as Express.Multer.File & { buffer: Buffer };
  if (!file?.buffer) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  if (file.size > MAX_THUMBNAIL_SIZE) {
    throw new AppError('Thumbnail must be 2MB or smaller', 400, 'VALIDATION_ERROR');
  }
  if (!IMAGE_TYPES.includes(file.mimetype)) {
    throw new AppError('Thumbnail must be JPEG, PNG, GIF, or WebP', 400, 'VALIDATION_ERROR');
  }

  const bucket = getBucket();
  const safeName = (file.originalname || 'thumb').replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `event-thumb-${Date.now()}-${safeName}`;
  const fileId = await streamToGridFS(bucket, file.buffer, filename, file.mimetype, {
    tenantId,
    purpose: 'event-thumbnail',
    uploadedBy: req.user?.sub ?? ''
  });
  return ok(res, { fileId, fileName: file.originalname || 'thumb', mimeType: file.mimetype, size: file.size }, 201);
}

export async function uploadAnnouncementAttachment(req: any, res: any) {
  const tenantId = req.params.tenantId as string;
  const file = req.file as Express.Multer.File & { buffer: Buffer };
  if (!file?.buffer) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new AppError('Attachment must be 10MB or smaller', 400, 'VALIDATION_ERROR');
  }
  if (!ATTACHMENT_TYPES.includes(file.mimetype)) {
    throw new AppError('Invalid file type for attachment', 400, 'VALIDATION_ERROR');
  }

  const bucket = getBucket();
  const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `announcement-${Date.now()}-${safeName}`;
  const fileId = await streamToGridFS(bucket, file.buffer, filename, file.mimetype, {
    tenantId,
    purpose: 'announcement-attachment',
    uploadedBy: req.user?.sub ?? ''
  });
  return ok(res, { fileId, fileName: file.originalname || 'file', mimeType: file.mimetype, size: file.size }, 201);
}

export async function uploadPostMedia(req: any, res: any) {
  const tenantId = req.params.tenantId as string;
  const file = req.file as Express.Multer.File & { buffer: Buffer };
  if (!file?.buffer) {
    throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR');
  }
  if (file.size > MAX_POST_MEDIA_SIZE) {
    throw new AppError('Post media must be 5MB or smaller', 400, 'VALIDATION_ERROR');
  }
  if (!IMAGE_TYPES.includes(file.mimetype)) {
    throw new AppError('Post media must be JPEG, PNG, GIF, or WebP', 400, 'VALIDATION_ERROR');
  }

  const bucket = getBucket();
  const safeName = (file.originalname || 'media').replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `post-media-${Date.now()}-${safeName}`;
  const fileId = await streamToGridFS(bucket, file.buffer, filename, file.mimetype, {
    tenantId,
    purpose: 'post-media',
    uploadedBy: req.user?.sub ?? ''
  });
  return ok(res, { fileId, fileName: file.originalname || 'media', mimeType: file.mimetype, size: file.size }, 201);
}

export async function getTenantFile(req: any, res: any) {
  const tenantId = req.params.tenantId as string;
  const fileId = req.params.fileId as string;
  await ensureMembership(tenantId, req.user.sub);

  if (!fileId || !Types.ObjectId.isValid(fileId)) {
    throw new AppError('Invalid file id', 400, 'VALIDATION_ERROR');
  }

  const db = mongoose.connection.db;
  if (!db) throw new AppError('Database not connected', 503, 'SERVICE_UNAVAILABLE');
  const filesCol = db.collection(`${TENANT_FILES_BUCKET}.files`);
  const fileDoc = await filesCol.findOne({ _id: new Types.ObjectId(fileId) });
  if (!fileDoc) {
    throw new AppError('File not found', 404, 'NOT_FOUND');
  }

  const meta = (fileDoc as any).metadata || {};
  if (String(meta.tenantId) !== String(tenantId)) {
    throw new AppError('File not found', 404, 'NOT_FOUND');
  }

  const bucket = getBucket();
  res.setHeader('Content-Type', (fileDoc as any).contentType || 'application/octet-stream');
  const downloadStream = bucket.openDownloadStream(new Types.ObjectId(fileId));
  downloadStream.pipe(res);
}
