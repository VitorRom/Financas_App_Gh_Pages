import { Router } from 'express';
import multer from 'multer';
import { AppError } from '../../shared/utils/errors.js';
import * as controller from './imports.controller.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — extrato bem maior que isso não existe
const ALLOWED_EXTENSIONS = /\.(pdf|xls|xlsx)$/i;

// O arquivo vai inteiro para a memória do processo, então o limite precisa vir
// antes do parsing: sem ele, um upload grande derruba a API.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.test(file.originalname)) {
      return cb(new AppError('Formato não suportado. Envie um arquivo PDF, XLS ou XLSX.', 400));
    }
    cb(null, true);
  },
});

/** Traduz os erros do multer para mensagens que fazem sentido para quem enviou. */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Arquivo muito grande. O limite é 10 MB.', 413));
    }
    return next(err);
  });
}

const router = Router();

router.post('/statement', handleUpload, controller.importStatement);
router.get('/batches', controller.listBatches);
router.delete('/batches/:id', controller.deleteBatch);

export default router;
