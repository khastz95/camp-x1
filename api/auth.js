const { pinOk } = require("../lib/cloud");

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const pin = readBody(req).pin ?? "";
  if (!process.env.EDIT_PIN) {
    res.status(500).json({ ok: false, error: "EDIT_PIN não definido na Vercel" });
    return;
  }
  if (!pinOk(pin)) {
    res.status(401).json({ ok: false });
    return;
  }
  res.status(200).json({ ok: true });
};
