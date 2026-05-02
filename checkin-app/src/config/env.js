const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "https://YOUR_DOMAIN/checkin-api").replace(/\/+$/, "");

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3100),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "checkin_prod",
    user: process.env.DB_USER || "checkin_user",
    password: process.env.DB_PASSWORD || "",
  },
  wx: {
    appid: process.env.WX_APPID || "",
    appsecret: process.env.WX_APPSECRET || "",
  },
  adminPhone: process.env.ADMIN_PHONE || "YOUR_ADMIN_PHONE",
  uploadDirAbs: path.isAbsolute(uploadDir)
    ? uploadDir
    : path.join(rootDir, uploadDir),
  publicBaseUrl,
};
