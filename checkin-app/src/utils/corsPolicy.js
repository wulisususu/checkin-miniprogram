function parseAllowedOrigins(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "*") return [];

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

module.exports = {
  parseAllowedOrigins,
  isOriginAllowed,
};
