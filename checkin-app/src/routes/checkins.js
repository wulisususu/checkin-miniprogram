const express = require("express");
const path = require("path");
const db = require("../config/db");
const env = require("../config/env");
const upload = require("../middlewares/upload");

const router = express.Router();

function buildPhotoUrl(filename) {
  return `${env.publicBaseUrl}/uploads/${filename}`;
}

router.post("/", upload.single("photo"), async function (req, res) {
  try {
    const { openid, latitude, longitude, address, checkin_time } = req.body;
    if (!openid || !latitude || !longitude || !req.file) {
      return res.status(400).json({
        code: 0,
        message: "openid, latitude, longitude and photo are required",
      });
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ code: 0, message: "latitude/longitude invalid" });
    }

    const checkinTime = checkin_time ? new Date(checkin_time) : new Date();
    if (Number.isNaN(checkinTime.getTime())) {
      return res.status(400).json({ code: 0, message: "checkin_time invalid" });
    }

    const photoFilename = path.basename(req.file.filename);
    const photoUrl = buildPhotoUrl(photoFilename);

    const sql =
      "INSERT INTO checkin_records (openid, latitude, longitude, address, photo_url, checkin_time) VALUES (?, ?, ?, ?, ?, ?)";
    const params = [openid, lat, lng, address || "", photoUrl, checkinTime];
    const [result] = await db.query(sql, params);

    return res.json({
      code: 1,
      data: {
        id: result.insertId,
        openid,
        latitude: lat,
        longitude: lng,
        address: address || "",
        photo_url: photoUrl,
        checkin_time: checkinTime.toISOString(),
      },
    });
  } catch (error) {
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
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

module.exports = router;
