const crypto = require("crypto");

const ROW_ID = "main";

function pinOk(pin) {
  const expected = String(process.env.EDIT_PIN || "");
  if (!expected || pin == null || pin === "") return false;
  const a = Buffer.from(String(pin));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function rest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error("Supabase não configurado");
    err.status = 500;
    throw err;
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || "Erro no Supabase");
    err.status = res.status;
    throw err;
  }
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

async function getState() {
  const rows = await rest(`camp_state?id=eq.${ROW_ID}&select=id,data,updated_at`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function putState(data) {
  const payload = {
    id: ROW_ID,
    data,
    updated_at: new Date().toISOString()
  };
  const rows = await rest("camp_state", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = { pinOk, configured, getState, putState };
