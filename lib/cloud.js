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

function asState(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { id: ROW_ID, data: {}, updated_at: null };
  }
  const { updatedAt, ...rest } = data;
  return { id: ROW_ID, data: rest, updated_at: updatedAt || null };
}

async function getState() {
  const loaded = await rest("rpc/load_camp_state", {
    method: "POST",
    body: "{}"
  });
  return asState(loaded);
}

async function putState(data) {
  const loaded = await rest("rpc/save_camp_state", {
    method: "POST",
    body: JSON.stringify({ payload: data })
  });
  return asState(loaded);
}

async function setPlayerPhoto(playerId, photoUrl) {
  const rows = await rest(`players?id=eq.${encodeURIComponent(playerId)}`, {
    method: "PATCH",
    body: JSON.stringify({ photo_url: photoUrl, updated_at: new Date().toISOString() })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function uploadPlayerPhoto(playerId, buffer, contentType) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const path = `player-photos/${playerId}`;
  const res = await fetch(`${url}/storage/v1/object/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: buffer
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || "Falha no upload da foto");
    err.status = res.status;
    throw err;
  }
  const publicUrl = `${url}/storage/v1/object/public/${path}?v=${Date.now()}`;
  await setPlayerPhoto(playerId, publicUrl);
  return publicUrl;
}

module.exports = { pinOk, configured, getState, putState, uploadPlayerPhoto };
