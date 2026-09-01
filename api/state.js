const { pinOk, configured, getState, putState } = require("../lib/cloud");

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  try {
    if (!configured()) {
      res.status(500).json({
        error: "Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel."
      });
      return;
    }

    if (req.method === "GET") {
      const row = await getState();
      res.status(200).json({ data: row?.data || null, updatedAt: row?.updated_at || null });
      return;
    }

    if (req.method === "PUT") {
      const body = readBody(req);
      const pin = req.headers["x-edit-pin"] || body.pin || "";
      if (!pinOk(pin)) {
        res.status(401).json({ error: "PIN inválido" });
        return;
      }
      const data = body.data;
      if (!data || typeof data !== "object") {
        res.status(400).json({ error: "Dados inválidos" });
        return;
      }
      const row = await putState(data);
      res.status(200).json({ ok: true, updatedAt: row?.updated_at || null });
      return;
    }

    res.status(405).json({ error: "Método não permitido" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Erro interno" });
  }
};
