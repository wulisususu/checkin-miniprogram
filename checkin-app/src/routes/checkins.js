const express = require("express");
const fs = require("fs");
const db = require("../config/db");
const env = require("../config/env");
const upload = require("../middlewares/upload");
const { buildCheckinPayload } = require("../utils/checkinPayload");
const { validateImageFile } = require("../utils/imageValidation");

const router = express.Router();

function buildPhotoUrl(filename) {
  return `${env.publicBaseUrl}/uploads/${filename}`;
}

async function removeUploadedFile(file) {
  if (!file || !file.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (err) {
    if (err && err.code !== "ENOENT") {
      console.error("failed to remove rejected upload:", err);
    }
  }
}

router.post("/", upload.single("photo"), async function (req, res) {
  let keepUploadedFile = false;
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 0,
        message: "openid, latitude, longitude and photo are required",
      });
    }

    await validateImageFile(req.file.path, req.file.mimetype);

    const payload = buildCheckinPayload(req.body, req.file.filename);
    const photoUrl = buildPhotoUrl(payload.photoFilename);

    const sql =
      "INSERT INTO checkin_records (openid, latitude, longitude, address, photo_url, checkin_time) VALUES (?, ?, ?, ?, ?, ?)";
    const params = [
      payload.openid,
      payload.latitude,
      payload.longitude,
      payload.address,
      photoUrl,
      payload.checkinTime,
    ];
    const [result] = await db.query(sql, params);
    keepUploadedFile = true;

    return res.json({
      code: 1,
      data: {
        id: result.insertId,
        openid: payload.openid,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        photo_url: photoUrl,
        checkin_time: payload.checkinTime.toISOString(),
      },
    });
  } catch (error) {
    if (!keepUploadedFile) {
      await removeUploadedFile(req.file);
    }

    if (error && error.code === "INVALID_IMAGE_CONTENT") {
      return res.status(400).json({ code: 0, message: error.message });
    }
    if (error && error.statusCode === 400) {
      return res.status(400).json({ code: 0, message: error.message });
    }

    console.error("checkins POST error:", error);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

router.get("/", async function (req, res) {
  try {
    const openid = (req.query.openid || "").trim();
    const limitRaw = Number(req.query.limit || 50);
    const limit = Number.isNaN(limitRaw) ? 50 : Math.max(1, Math.min(limitRaw, 200));

    let sql =
      "SELECT id, openid, latitude, longitude, address, photo_url, checkin_time, created_at FROM checkin_records";
    const params = [];
    if (openid) {
      sql += " WHERE openid = ?";
      params.push(openid);
    }
    sql += " ORDER BY checkin_time DESC LIMIT ?";
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return res.json({ code: 1, data: rows });
  } catch (error) {
    console.error("checkins GET error:", error);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

router.delete("/", async function (req, res) {
  try {
    const openid = (req.query.openid || "").trim();
    if (!openid) {
      return res.status(400).json({ code: 0, message: "openid is required" });
    }
    const [result] = await db.query("DELETE FROM checkin_records WHERE openid = ?", [openid]);
    return res.json({ code: 1, data: { deleted: result.affectedRows } });
  } catch (error) {
    console.error("checkins DELETE error:", error);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

module.exports = router;
