const fs = require("fs");

const TYPE_TO_MIME = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function detectImageType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  return null;
}

async function validateImageFile(filePath, declaredMime) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const type = detectImageType(header.subarray(0, bytesRead));
    if (!type) {
      const err = new Error("invalid image content");
      err.code = "INVALID_IMAGE_CONTENT";
      throw err;
    }

    const actualMime = TYPE_TO_MIME[type];
    if (declaredMime && declaredMime !== actualMime) {
      const err = new Error("image MIME type does not match file content");
      err.code = "INVALID_IMAGE_CONTENT";
      throw err;
    }

    return { type, mime: actualMime };
  } finally {
    await handle.close();
  }
}

module.exports = {
  TYPE_TO_MIME,
  detectImageType,
  validateImageFile,
};
