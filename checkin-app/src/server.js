const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const env = require("./config/env");
const healthRouter = require("./routes/health");
const checkinsRouter = require("./routes/checkins");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const { createRateLimiter } = require("./middlewares/rateLimit");
const { isOriginAllowed } = require("./utils/corsPolicy");

const app = express();

fs.mkdirSync(env.uploadDirAbs, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, env.corsOrigins)) {
        return callback(null, true);
      }
      const err = new Error("CORS origin not allowed");
      err.code = "CORS_ORIGIN_DENIED";
      return callback(err);
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(env.uploadDirAbs));
app.use("/api/health", healthRouter);
app.use(
  "/api",
  createRateLimiter({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
  })
);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/checkins", checkinsRouter);

app.use(function (_req, res) {
  res.status(404).json({ code: 0, message: "not found" });
});

app.use(function (err, _req, res, _next) {
  if (err && err.code === "CORS_ORIGIN_DENIED") {
    return res.status(403).json({ code: 0, message: "origin not allowed" });
  }
  if (
    err &&
    (err.message === "Only JPEG, PNG and WebP images are allowed" ||
      err.message === "Unsupported image type")
  ) {
    return res.status(400).json({ code: 0, message: err.message });
  }
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ code: 0, message: "file too large" });
  }
  if (err && err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({ code: 0, message: "too many files" });
  }
  console.error("unhandled request error:", err);
  return res.status(500).json({ code: 0, message: "internal error" });
});

app.listen(env.port, function () {
  console.log(
    `checkin-app listening on ${env.port}, upload dir: ${path.relative(process.cwd(), env.uploadDirAbs)}`
  );
});
