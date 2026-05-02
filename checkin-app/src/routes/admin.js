const express = require("express");
const db = require("../config/db");
const env = require("../config/env");

const router = express.Router();

async function verifyAdmin(openid) {
  if (!openid) return false;
  const [rows] = await db.query(
    "SELECT id FROM users WHERE openid = ? AND phone = ?",
    [openid, env.adminPhone]
  );
  return rows.length > 0;
}

// GET /api/admin/users?adminOpenid=xxx
// Returns all non-admin users for the admin to browse.
router.get("/users", async (req, res) => {
  try {
    const adminOpenid = (req.query.adminOpenid || "").trim();
    if (!(await verifyAdmin(adminOpenid))) {
      return res.status(403).json({ code: 0, message: "forbidden" });
    }
    const [rows] = await db.query(
      "SELECT openid, nickname, phone, created_at FROM users WHERE phone != ? ORDER BY created_at ASC",
      [env.adminPhone]
    );
    return res.json({ code: 1, data: rows });
  } catch (err) {
    console.error("admin/users error:", err);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

// GET /api/admin/checkins?adminOpenid=xxx&openid=yyy&limit=100
// Returns checkins for any user; requires admin verification.
router.get("/checkins", async (req, res) => {
  try {
    const adminOpenid = (req.query.adminOpenid || "").trim();
    if (!(await verifyAdmin(adminOpenid))) {
      return res.status(403).json({ code: 0, message: "forbidden" });
    }
    const openid = (req.query.openid || "").trim();
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isNaN(limitRaw) ? 100 : Math.max(1, Math.min(limitRaw, 500));

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
  } catch (err) {
    console.error("admin/checkins error:", err);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

module.exports = router;
