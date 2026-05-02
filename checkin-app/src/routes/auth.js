const express = require("express");
const db = require("../config/db");
const env = require("../config/env");
const { code2Session, getPhoneNumber } = require("../utils/wechat");

const router = express.Router();

function wxConfigured() {
  return env.wx.appid && env.wx.appsecret;
}

// POST /api/auth/login  { loginCode, phoneCode?, nickname? }
router.post("/login", async (req, res) => {
  if (!wxConfigured()) {
    return res.status(503).json({ code: 0, message: "WeChat credentials not configured" });
  }
  try {
    const { loginCode, phoneCode, nickname } = req.body;
    if (!loginCode) {
      return res.status(400).json({ code: 0, message: "loginCode is required" });
    }

    const wxRes = await code2Session(loginCode);
    if (wxRes.errcode || !wxRes.openid) {
      return res.status(401).json({ code: 0, message: "invalid loginCode", detail: wxRes });
    }

    const openid = wxRes.openid;
    let phone = null;

    if (phoneCode) {
      try {
        const phoneRes = await getPhoneNumber(phoneCode);
        if (phoneRes.errcode === 0 && phoneRes.phone_info) {
          phone = phoneRes.phone_info.phoneNumber || null;
        }
      } catch (_) {
        // phone optional; login still succeeds
      }
    }

    const nicknameVal = (nickname || "").trim() || null;

    await db.query(
      `INSERT INTO users (openid, phone, nickname) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone     = COALESCE(?, phone),
         nickname  = COALESCE(?, nickname),
         updated_at = NOW()`,
      [openid, phone, nicknameVal, phone, nicknameVal]
    );

    const isAdmin = phone === env.adminPhone;

    return res.json({ code: 1, data: { openid, phone, isAdmin } });
  } catch (err) {
    console.error("auth/login error:", err);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

// POST /api/auth/phone  { phoneCode, openid }
router.post("/phone", async (req, res) => {
  if (!wxConfigured()) {
    return res.status(503).json({ code: 0, message: "WeChat credentials not configured" });
  }
  try {
    const { phoneCode, openid } = req.body;
    if (!phoneCode || !openid) {
      return res.status(400).json({ code: 0, message: "phoneCode and openid are required" });
    }

    const phoneRes = await getPhoneNumber(phoneCode);
    if (phoneRes.errcode !== 0 || !phoneRes.phone_info) {
      return res.status(400).json({ code: 0, message: "failed to get phone", detail: phoneRes });
    }

    const phone = phoneRes.phone_info.phoneNumber;
    await db.query(
      "UPDATE users SET phone = ?, updated_at = NOW() WHERE openid = ?",
      [phone, openid]
    );

    const isAdmin = phone === env.adminPhone;
    return res.json({ code: 1, data: { phone, isAdmin } });
  } catch (err) {
    console.error("auth/phone error:", err);
    return res.status(500).json({ code: 0, message: "server error" });
  }
});

module.exports = router;
