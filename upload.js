// Express + multer endpoint for image upload
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../miniappdlaprodazhi/images');
const FILES_DIR = path.join(__dirname, '../miniappdlaprodazhi/files');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random()*1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FILES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.round(Math.random()*1e6) + ext;
    cb(null, name);
  }
});
const fileUpload = multer({ storage: fileStorage });

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Возвращаем только имя файла
  const url = req.file.filename;
  res.json({ url });
});

router.post('/file', fileUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = req.file.filename;
  res.json({ url });
});

module.exports = router;
