const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildCheckinPayload } = require("../src/utils/checkinPayload");
const {
  detectImageType,
  validateImageFile,
} = require("../src/utils/imageValidation");
const { createRateLimiter } = require("../src/middlewares/rateLimit");

test("check-in payload always uses server time instead of client-supplied time", () => {
  const serverNow = new Date("2026-08-28T12:34:56.000Z");
  const payload = buildCheckinPayload(
    {
      openid: "ou-test",
      latitude: "31.2304",
      longitude: "121.4737",
      address: "test address",
      checkin_time: "2000-01-01T00:00:00.000Z",
    },
    "photo.jpg",
    () => serverNow
  );

  assert.equal(payload.checkinTime.toISOString(), serverNow.toISOString());
  assert.notEqual(payload.checkinTime.toISOString(), "2000-01-01T00:00:00.000Z");
});

test("image signature detection accepts JPEG, PNG and WebP but rejects SVG text", () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(
    detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "png"
  );
  assert.equal(
    detectImageType(Buffer.from("RIFF1234WEBP", "ascii")),
    "webp"
  );
  assert.equal(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>")), null);
});

test("invalid uploaded image is rejected by file-content validation", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checkin-image-test-"));
  const file = path.join(dir, "fake.jpg");
  fs.writeFileSync(file, "not really an image");

  try {
    await assert.rejects(() => validateImageFile(file), /invalid image content/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rate limiter blocks requests after the configured maximum", () => {
  let now = 1_000;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => now });
  const req = { ip: "127.0.0.1", headers: {} };

  function invoke() {
    const result = { statusCode: 200, body: null, nextCalled: false };
    const res = {
      setHeader() {},
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(body) {
        result.body = body;
        return this;
      },
    };
    limiter(req, res, () => {
      result.nextCalled = true;
    });
    return result;
  }

  assert.equal(invoke().nextCalled, true);
  assert.equal(invoke().nextCalled, true);
  const blocked = invoke();
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.nextCalled, false);
  assert.match(blocked.body.message, /too many requests/i);

  now += 60_001;
  assert.equal(invoke().nextCalled, true);
});
