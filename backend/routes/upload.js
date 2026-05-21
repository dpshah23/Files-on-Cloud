const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const FileRecord = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomBytes(16).toString('hex') + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter to reject dangerous file types
const fileFilter = (req, file, cb) => {
  const dangerousTypes = [
    'application/x-msdownload', // .exe
    'application/x-msdos-program', // .exe
    'application/x-executable', // .exe
    'application/x-shockwave-flash', // .swf
    'application/java-archive', // .jar
    'application/x-ms-installer', // .msi
    'application/vnd.microsoft.portable-executable' // .exe
  ];

  if (dangerousTypes.includes(file.mimetype)) {
    return cb(new Error('File type not allowed for security reasons.'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: fileFilter
});

// Multer instance for chunk uploads (stores incoming chunks in a transient folder,
// then the route handler moves them into per-upload directories)
const incomingTempDir = path.join(__dirname, '..', '..', 'uploads', 'temp', '_incoming');
if (!fs.existsSync(incomingTempDir)) fs.mkdirSync(incomingTempDir, { recursive: true });

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(incomingTempDir)) fs.mkdirSync(incomingTempDir, { recursive: true });
    cb(null, incomingTempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname || '');
    cb(null, uniqueName);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // per-chunk limit: 100MB (configurable)
  fileFilter: fileFilter
});

// Helper function to generate unique code
const generateCode = async () => {
  let code, exists = true;
  while (exists) {
    code = Math.floor(10000 + Math.random() * 90000).toString();
    exists = await FileRecord.findOne({ code });
  }
  return code;
};

// Helper function to parse expiration time
const parseExpiration = (expiration) => {
  const now = Date.now();
  switch (expiration) {
    case '1h': return new Date(now + 1 * 60 * 60 * 1000);
    case '6h': return new Date(now + 6 * 60 * 60 * 1000);
    case '24h': return new Date(now + 24 * 60 * 60 * 1000);
    case '7d': return new Date(now + 7 * 24 * 60 * 60 * 1000);
    default: return new Date(now + 24 * 60 * 60 * 1000); // Default 24h
  }
};

// Upload file route
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let { code, password, expiration } = req.body;
    if (code) {
      if (!/^\d{5}$/.test(code)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Code must be exactly 5 digits.' });
      }
      const existingFile = await FileRecord.findOne({ code });
      if (existingFile) {
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ error: 'This code is already in use.' });
      }
    } else {
      code = await generateCode();
    }

    const expiresAt = parseExpiration(expiration);

    const newFileRecord = new FileRecord({
      code,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      password: password || undefined, // Only set if provided
      expiresAt,
      uploadedBy: req.user ? req.user._id : null
    });

    await newFileRecord.save();

    // Generate QR code
    const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
    const qrCodeDataURL = await QRCode.toDataURL(downloadUrl);

    console.log(`File saved to database with code: ${code}`);
    res.status(201).json({
      success: true,
      code,
      message: `File uploaded! Your code is: ${code}`,
      downloadUrl,
      qrCode: qrCodeDataURL,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Upload Error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error during file upload.' });
  }
});

  // Chunk upload route
  // Receives: chunk (file), chunkIndex, totalChunks, fileId, originalFileName
  // Temporarily stores chunks in uploads/temp/<fileId>/ as zero-padded part files
  router.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
    try {
      const { chunkIndex, totalChunks, fileId, originalFileName } = req.body || {};

      // Basic validations
      if (!req.file) {
        return res.status(400).json({ error: 'No chunk file provided.' });
      }

      if (!fileId || typeof fileId !== 'string' || !/^[A-Za-z0-9\-_]+$/.test(fileId)) {
        // cleanup incoming file
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid or missing fileId. Use alphanumeric, -, or _.' });
      }

      const total = parseInt(totalChunks, 10);
      const index = parseInt(chunkIndex, 10);
      if (Number.isNaN(total) || total <= 0) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid totalChunks value.' });
      }
      if (Number.isNaN(index) || index < 0 || index >= total) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid chunkIndex.' });
      }

      // Prepare destination folder for this upload
      const destDir = path.join(__dirname, '..', '..', 'uploads', 'temp', fileId);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      // Create zero-padded chunk filename
      const padWidth = Math.max(3, String(total - 1).length);
      const paddedIndex = String(index).padStart(padWidth, '0');
      const destPath = path.join(destDir, `${paddedIndex}.part`);

      const incomingPath = req.file.path;

      // If a chunk already exists and sizes match, treat as already uploaded (idempotent)
      if (fs.existsSync(destPath)) {
        const existingStat = fs.statSync(destPath);
        if (existingStat.size === req.file.size) {
          // remove the incoming duplicate
          await fs.promises.unlink(incomingPath);
          return res.status(200).json({ success: true, fileId, chunkIndex: index, message: 'Chunk already exists.' });
        }
        // otherwise replace existing chunk
        await fs.promises.unlink(destPath).catch(() => {});
      }

      // Move incoming chunk into final per-upload directory
      await fs.promises.rename(incomingPath, destPath);

      // Optionally persist metadata about the upload
      const metaPath = path.join(destDir, 'meta.json');
      const meta = {
        originalFileName: originalFileName || '',
        totalChunks: total,
        createdAt: new Date().toISOString()
      };
      // Write or update meta.json (atomic write)
      try {
        await fs.promises.writeFile(metaPath, JSON.stringify(meta));
      } catch (err) {
        console.warn('Failed to write meta.json for chunk upload', err);
      }

      return res.status(201).json({ success: true, fileId, chunkIndex: index });
    } catch (error) {
      console.error('Chunk upload error:', error);
      if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Server error while receiving chunk.' });
    }
  });

// Get file info route
router.get('/info/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const fileDoc = await FileRecord.findOne({ code }).select('-filename -__v -downloads');
    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found with this code.' });
    }

    res.json({
      originalName: fileDoc.originalName,
      size: fileDoc.size,
      uploadDate: fileDoc.uploadDate,
      downloadCount: fileDoc.downloadCount,
      sizeFormatted: (fileDoc.size / (1024 * 1024)).toFixed(2) + ' MB',
      hasPassword: !!fileDoc.password,
      expiresAt: fileDoc.expiresAt
    });
  } catch (error) {
    console.error('Info Error:', error);
    res.status(500).json({ error: 'Failed to retrieve file info.' });
  }
});

// Get analytics route
router.get('/analytics/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;
    const fileDoc = await FileRecord.findOne({ code });

    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found with this code.' });
    }

    // Check if user owns this file
    if (fileDoc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only view analytics for your own files.' });
    }

    const recentDownloads = fileDoc.downloads
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 10)
      .map(download => ({
        ip: download.ip,
        userAgent: download.userAgent,
        time: download.time
      }));

    res.json({
      totalDownloads: fileDoc.downloadCount,
      recentDownloads
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics.' });
  }
});
// Get all files uploaded by current user
router.get('/files/me', auth, async (req, res) => {
  try {
    const files = await FileRecord.find({ uploadedBy: req.user._id })
      .select('-__v -password') // exclude password hash and version
      .sort({ uploadDate: -1 });
    res.json({ files });
  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({ error: 'Failed to retrieve files.' });
  }
});

// Delete user file manually
router.delete('/files/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;
    const fileDoc = await FileRecord.findOne({ code });

    if (!fileDoc) {
      return res.status(404).json({ error: 'File not found.' });
    }

    if (!fileDoc.uploadedBy || fileDoc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own files.' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '..', '..', 'uploads', fileDoc.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from DB
    await FileRecord.deleteOne({ _id: fileDoc._id });

    res.json({ message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file.' });
  }
});

module.exports = router;

// Merge chunks route
// Expects JSON body: { fileId, originalFileName, totalChunks, code?, password?, expiration? }
router.post('/upload/merge', async (req, res) => {
  try {
    const { fileId, originalFileName, totalChunks } = req.body || {};

    if (!fileId || typeof fileId !== 'string' || !/^[A-Za-z0-9\-_]+$/.test(fileId)) {
      return res.status(400).json({ error: 'Invalid or missing fileId.' });
    }

    if (!originalFileName || typeof originalFileName !== 'string') {
      return res.status(400).json({ error: 'Missing originalFileName.' });
    }

    const total = parseInt(totalChunks, 10);
    if (Number.isNaN(total) || total <= 0) {
      return res.status(400).json({ error: 'Invalid totalChunks.' });
    }

    const destDir = path.join(__dirname, '..', '..', 'uploads', 'temp', fileId);
    if (!fs.existsSync(destDir)) {
      return res.status(404).json({ error: 'Upload not found or already removed.' });
    }

    // Validate presence of all chunks
    const padWidth = Math.max(3, String(total - 1).length);
    const missing = [];
    const chunkFiles = [];
    for (let i = 0; i < total; i++) {
      const name = String(i).padStart(padWidth, '0') + '.part';
      const p = path.join(destDir, name);
      if (!fs.existsSync(p)) missing.push(i);
      else chunkFiles.push(p);
    }

    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing chunks', missing });
    }

    // Acquire lock
    const lockPath = path.join(destDir, 'lock');
    try {
      const lockHandle = await fs.promises.open(lockPath, 'wx');
      await lockHandle.close();
    } catch (err) {
      return res.status(409).json({ error: 'Merge already in progress for this upload.' });
    }

    const mergeTmp = path.join(destDir, 'merge.tmp');

    // Merge using streams sequentially
    const writeStream = fs.createWriteStream(mergeTmp, { flags: 'w' });

    try {
      for (const chunkPath of chunkFiles) {
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(chunkPath);
          readStream.on('error', (err) => reject(err));
          readStream.on('end', () => resolve());
          readStream.pipe(writeStream, { end: false });
        });
      }

      // Close write stream and wait for finish
      await new Promise((resolve, reject) => {
        writeStream.end(() => {
          writeStream.once('close', resolve);
        });
        writeStream.on('error', reject);
      });

      // Validate merged size equals sum of chunk sizes
      let mergedStat;
      try {
        mergedStat = await fs.promises.stat(mergeTmp);
      } catch (err) {
        throw new Error('Merged file not found after merge.');
      }

      let totalSize = 0;
      for (const p of chunkFiles) {
        const st = await fs.promises.stat(p);
        totalSize += st.size;
      }

      if (mergedStat.size !== totalSize) {
        // Move to garbage for investigation
        const garbageDir = path.join(__dirname, '..', '..', 'uploads', '.garbage');
        if (!fs.existsSync(garbageDir)) fs.mkdirSync(garbageDir, { recursive: true });
        const garbagePath = path.join(garbageDir, `${fileId}-${Date.now()}.tmp`);
        await fs.promises.rename(mergeTmp, garbagePath).catch(() => {});
        throw new Error('Merged file size mismatch.');
      }

      // Move merged file to final uploads directory
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const finalName = crypto.randomBytes(16).toString('hex') + path.extname(originalFileName || '');
      const finalPath = path.join(uploadsDir, finalName);
      await fs.promises.rename(mergeTmp, finalPath);

      // Create DB record similar to single-file upload flow
      let { code, password, expiration } = req.body || {};
      if (code) {
        if (!/^\d{5}$/.test(code)) {
          // cleanup final file
          if (fs.existsSync(finalPath)) await fs.promises.unlink(finalPath).catch(() => {});
          return res.status(400).json({ error: 'Code must be exactly 5 digits.' });
        }
        const existingFile = await FileRecord.findOne({ code });
        if (existingFile) {
          if (fs.existsSync(finalPath)) await fs.promises.unlink(finalPath).catch(() => {});
          return res.status(409).json({ error: 'This code is already in use.' });
        }
      } else {
        code = await generateCode();
      }

      const expiresAt = parseExpiration(expiration);

      const newFileRecord = new FileRecord({
        code,
        originalName: originalFileName,
        filename: finalName,
        mimetype: 'application/octet-stream',
        size: mergedStat.size,
        password: password || undefined,
        expiresAt,
        uploadedBy: req.user ? req.user._id : null
      });

      await newFileRecord.save();

      // Delete chunk folder
      await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => {});

      // Generate QR and download URL
      const downloadUrl = `${req.protocol}://${req.get('host')}/download/${code}`;
      const qrCodeDataURL = await QRCode.toDataURL(downloadUrl);

      return res.status(201).json({ success: true, code, downloadUrl, qrCode: qrCodeDataURL, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      // Ensure lock removed
      try { await fs.promises.unlink(lockPath).catch(() => {}); } catch (e) {}
      console.error('Merge error:', err);
      return res.status(500).json({ error: 'Failed to merge chunks.', details: err.message });
    }
  } catch (error) {
    console.error('Merge route error:', error);
    return res.status(500).json({ error: 'Server error during merge.' });
  } finally {
    // best-effort remove lock if still present
    const destDir = path.join(__dirname, '..', '..', 'uploads', 'temp', req.body?.fileId || '');
    const lockPath = path.join(destDir, 'lock');
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch (e) {}
    }
  }
});