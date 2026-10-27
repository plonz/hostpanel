const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const fileService = require('../services/fileService');

// Multer storage configuration for direct destination upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.body.destination || req.query.destination;
    const dest = fileService.normalizePath(uploadPath);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Preserve original filename
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit
});

// GET /api/files/drives
router.get('/drives', authMiddleware, (req, res) => {
  try {
    const drives = fileService.getAvailableDrives();
    res.json({ drives });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/list?path=...
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const targetPath = req.query.path;
    const data = await fileService.listDirectory(targetPath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/read?path=...
router.get('/read', authMiddleware, async (req, res) => {
  try {
    const targetPath = req.query.path;
    if (!targetPath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    const data = await fileService.readFileContent(targetPath);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/save
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const { path: targetPath, content } = req.body;
    if (!targetPath || typeof content !== 'string') {
      return res.status(400).json({ error: 'File path and content string are required' });
    }
    const result = await fileService.saveFileContent(targetPath, content);
    res.json({ message: 'File saved successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/create-file
router.post('/create-file', authMiddleware, async (req, res) => {
  try {
    const { parentDir, name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }
    const result = await fileService.createNewFile(parentDir, name);
    res.json({ message: 'File created successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/create-folder
router.post('/create-folder', authMiddleware, async (req, res) => {
  try {
    const { parentDir, name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    const result = await fileService.createNewFolder(parentDir, name);
    res.json({ message: 'Folder created successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/rename
router.post('/rename', authMiddleware, async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      return res.status(400).json({ error: 'Old path and new path are required' });
    }
    const result = await fileService.renameItem(oldPath, newPath);
    res.json({ message: 'Item renamed successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/delete
router.post('/delete', authMiddleware, async (req, res) => {
  try {
    const { path: targetPath } = req.body;
    if (!targetPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const result = await fileService.deleteItem(targetPath);
    res.json({ message: 'Item deleted successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/upload
router.post('/upload', authMiddleware, upload.array('files'), (req, res) => {
  try {
    const uploaded = (req.files || []).map(f => ({
      name: f.originalname,
      size: f.size,
      path: f.path
    }));
    res.json({ message: 'Files uploaded successfully', files: uploaded });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/download?path=...
router.get('/download', authMiddleware, (req, res) => {
  try {
    const targetPath = fileService.normalizePath(req.query.path);
    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot download a directory directly. Compress to zip first.' });
    }
    res.download(targetPath, path.basename(targetPath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/extract
router.post('/extract', authMiddleware, async (req, res) => {
  try {
    const { zipPath, destination } = req.body;
    if (!zipPath) {
      return res.status(400).json({ error: 'Zip path is required' });
    }
    const result = await fileService.extractZip(zipPath, destination);
    res.json({ message: 'Archive extracted successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/compress
router.post('/compress', authMiddleware, async (req, res) => {
  try {
    const { sourcePath, outputZipPath } = req.body;
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path is required' });
    }
    const result = await fileService.compressToZip(sourcePath, outputZipPath);
    res.json({ message: 'Compressed to zip successfully', result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
