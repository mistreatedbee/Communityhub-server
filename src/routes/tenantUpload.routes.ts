import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { requireTenantRole } from '../middleware/requireTenantRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  uploadResource,
  uploadEventThumbnail,
  uploadAnnouncementAttachment
} from '../controllers/tenantUpload.controller.js';

const router = Router({ mergeParams: true });

const storage = multer.memoryStorage();

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

const resourceUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isResource = RESOURCE_TYPES.includes(file.mimetype);
    const isImage = IMAGE_TYPES.includes(file.mimetype);
    if (file.fieldname === 'thumbnail') {
      if (isImage) cb(null, true);
      else cb(new Error('Thumbnail must be JPEG, PNG, GIF, or WebP.'));
    } else if (isResource) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for resource.'));
    }
  }
});

const thumbnailUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Thumbnail must be JPEG, PNG, GIF, or WebP.'));
  }
});

const attachmentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (RESOURCE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type for attachment.'));
  }
});

router.use(auth);
router.use(requireTenantRole(['OWNER', 'ADMIN', 'MODERATOR']));

router.post(
  '/resource',
  resourceUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  asyncHandler(uploadResource)
);
router.post('/event-thumbnail', thumbnailUpload.single('file'), asyncHandler(uploadEventThumbnail));
router.post('/announcement-attachment', attachmentUpload.single('file'), asyncHandler(uploadAnnouncementAttachment));

export default router;
