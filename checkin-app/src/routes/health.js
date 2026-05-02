const express = require("express");
const db = require("../config/db");

const router = express.Router();

router.get("/", async function (_req, res) {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, service: "checkin-app", db: "up" });
  } catch (error) {
    res.status(500).json({ ok: false, service: "checkin-app", db: "down" });
  }
});

module.exports = router;

