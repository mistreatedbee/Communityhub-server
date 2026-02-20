import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadLogo, getLogo } from '../controllers/upload.controller.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use JPEG, PNG, GIF, or WebP.'));
    }
  }
});

router.post('/logo', auth, upload.single('file'), asyncHandler(uploadLogo));
router.get('/logo/:fileId', asyncHandler(getLogo));

export default router;
