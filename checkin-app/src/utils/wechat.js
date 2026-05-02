const https = require("https");
const env = require("../config/env");

let cachedToken = null;
let tokenExpiry = 0;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error("invalid JSON: " + buf.slice(0, 200)));
          }
        });
      })
      .on("error", reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          reject(new Error("invalid JSON: " + buf.slice(0, 200)));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.wx.appid}&secret=${env.wx.appsecret}`;
  const res = await httpGet(url);
  if (!res.access_token) {
    throw new Error("getAccessToken failed: " + JSON.stringify(res));
  }
  cachedToken = res.access_token;
  tokenExpiry = Date.now() + (res.expires_in - 300) * 1000;
  return cachedToken;
}

async function code2Session(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.wx.appid}&secret=${env.wx.appsecret}&js_code=${code}&grant_type=authorization_code`;
  return httpGet(url);
}

async function getPhoneNumber(code) {
  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${token}`;
  return httpPost(url, { code });
}

module.exports = { code2Session, getPhoneNumber };
