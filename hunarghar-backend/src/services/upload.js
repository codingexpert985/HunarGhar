'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { badRequest } = require('../utils/AppError');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Accept only image types and a maximum size (SFR-10)
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP images are allowed'))
});

/** Sends the file to Cloudinary (if configured) or stores it on local disk. Returns the image URL. */
async function storeImage(file) {
  if (env.CLOUDINARY_ENABLED) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config(env.CLOUDINARY);
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'hunarghar/portfolio', resource_type: 'image' },
        (err, result) => (err ? reject(new Error('Image upload failed: ' + err.message)) : resolve(result.secure_url)));
      stream.end(file.buffer);
    });
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = crypto.randomBytes(12).toString('hex') + ALLOWED[file.mimetype];
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return `${env.PUBLIC_URL}/uploads/${name}`;
}

module.exports = { uploader, storeImage, UPLOAD_DIR };
