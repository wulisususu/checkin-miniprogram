const fs = require("fs");
const multer = require("multer");
const env = require("../config/env");

fs.mkdirSync(env.uploadDirAbs, { recursive: true });

const MIME_TO_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, env.uploadDirAbs);
  },
  filename: function (_req, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      return cb(new Error("Unsupported image type"));
    }
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: function (_req, file, cb) {
    if (!MIME_TO_EXT[file.mimetype]) {
      return cb(new Error("Only JPEG, PNG and WebP images are allowed"));
    }
    cb(null, true);
  },
});

module.exports = upload;
