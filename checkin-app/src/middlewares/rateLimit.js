function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs || 60_000);
  const max = Number(options.max || 120);
  const now = options.now || Date.now;
  const keyFn =
    options.keyFn ||
    ((req) => req.ip || (req.socket && req.socket.remoteAddress) || "unknown");

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("rate limit windowMs must be positive");
  }
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error("rate limit max must be positive");
  }

  const buckets = new Map();
  let lastSweep = 0;

  function sweepExpired(currentTime) {
    if (currentTime - lastSweep < windowMs) return;
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
    lastSweep = currentTime;
  }

  return function rateLimit(req, res, next) {
    const currentTime = Number(now());
    sweepExpired(currentTime);

    const key = String(keyFn(req) || "unknown");
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count >= max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))));
      return res.status(429).json({ code: 0, message: "too many requests" });
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = { createRateLimiter };
