const { pinOk, configured, uploadPlayerPhoto } = require("../lib/cloud");

const MAX_BYTES = 1.5 * 1024 * 1024;
const TYPES = {
  "image/jpeg": true,
  "image/png": true,
  "image/webp": true,
  "image/gif": true
};

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Método não permitido" });
      return;
    }
    if (!configured()) {
      res.status(500).json({ error: "Supabase não configurado" });
      return;
    }

    const body = readBody(req);
    const pin = req.headers["x-edit-pin"] || body.pin || "";
    if (!pinOk(pin)) {
      res.status(401).json({ error: "PIN inválido" });
      return;
    }

    const playerId = String(body.playerId || "").trim();
    if (!playerId) {
      res.status(400).json({ error: "Jogador inválido" });
      return;
    }

    const mime = String(body.mime || "").toLowerCase();
    if (!TYPES[mime]) {
      res.status(400).json({ error: "Use JPG, PNG, WEBP ou GIF" });
      return;
    }

    const raw = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
    let buffer;
    try {
      buffer = Buffer.from(raw, "base64");
    } catch {
      res.status(400).json({ error: "Imagem inválida" });
      return;
    }
    if (!buffer.length || buffer.length > MAX_BYTES) {
      res.status(400).json({ error: "A foto deve ter até 1,5 MB" });
      return;
    }

    const photoUrl = await uploadPlayerPhoto(playerId, buffer, mime);
    res.status(200).json({ ok: true, url: photoUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Erro interno" });
  }
};
