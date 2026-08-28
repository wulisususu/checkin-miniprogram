const path = require("path");

function buildCheckinPayload(body, uploadedFilename, now = () => new Date()) {
  const input = body || {};
  const openid = String(input.openid || "").trim();
  if (!openid || input.latitude === undefined || input.longitude === undefined || !uploadedFilename) {
    const err = new Error("openid, latitude, longitude and photo are required");
    err.statusCode = 400;
    throw err;
  }

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const err = new Error("latitude/longitude invalid");
    err.statusCode = 400;
    throw err;
  }

  const checkinTime = now();
  if (!(checkinTime instanceof Date) || Number.isNaN(checkinTime.getTime())) {
    throw new Error("server clock returned invalid time");
  }

  return {
    openid,
    latitude,
    longitude,
    address: String(input.address || "").trim(),
    photoFilename: path.basename(uploadedFilename),
    checkinTime,
  };
}

module.exports = { buildCheckinPayload };
