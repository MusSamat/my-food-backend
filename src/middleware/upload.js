const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const config = require('../config');

// Ensure upload dir exists
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Допустимые форматы: JPEG, PNG, WebP'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: config.upload.maxFileSize },
});

// Process uploaded image: resize + optimize + save
const processImage = async (file, options = {}) => {
    const { width = 800, height = 800, quality = 80 } = options;
    const filename = `${uuid()}.webp`;
    const filepath = path.join(uploadDir, filename);

    await sharp(file.buffer)
        .resize(width, height, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality })
        .toFile(filepath);

    return `/uploads/${filename}`;
};

module.exports = { upload, processImage };
