const STORAGE_KEY = "eternal-pratas-v3";
const TITLE = "CAMPEONATO 1v1 — ETERNAL PRATAS (CLOSED)";

function defaultPlayers() {
  return [
    { id: "s4mlz", name: "s4mlz", color: "#3ec7ff", photo: "" },
    { id: "fury", name: "fury", color: "#4f7dff", photo: "" },
    { id: "bill", name: "bill", color: "#7b8cff", photo: "" },
    { id: "khastz", name: "khastz", color: "#2a6dff", photo: "" },
    { id: "cadu", name: "cadu", color: "#5ad0ff", photo: "" }
  ];
}

function leagueBlueprint() {
  return [
    { id: "g1", round: 1, no: 1, p1: "s4mlz", p2: "fury", bye: "cadu", bestOf: 3 },
    { id: "g2", round: 1, no: 2, p1: "bill", p2: "khastz", bye: "cadu", bestOf: 3 },
    { id: "g3", round: 2, no: 3, p1: "s4mlz", p2: "bill", bye: "khastz", bestOf: 3 },
    { id: "g4", round: 2, no: 4, p1: "fury", p2: "cadu", bye: "khastz", bestOf: 3 },
    { id: "g5", round: 3, no: 5, p1: "s4mlz", p2: "khastz", bye: "fury", bestOf: 3 },
    { id: "g6", round: 3, no: 6, p1: "bill", p2: "cadu", bye: "fury", bestOf: 3 },
    { id: "g7", round: 4, no: 7, p1: "s4mlz", p2: "cadu", bye: "bill", bestOf: 3 },
    { id: "g8", round: 4, no: 8, p1: "fury", p2: "khastz", bye: "bill", bestOf: 3 },
    { id: "g9", round: 5, no: 9, p1: "fury", p2: "bill", bye: "s4mlz", bestOf: 3 },
    { id: "g10", round: 5, no: 10, p1: "khastz", p2: "cadu", bye: "s4mlz", bestOf: 3 }
  ];
}

function playoffBlueprint() {
  return [
    { id: "sf1", name: "Semifinal 1", sub: "1º × 4º", bestOf: 3, sourceA: { type: "seed", n: 1 }, sourceB: { type: "seed", n: 4 } },
    { id: "sf2", name: "Semifinal 2", sub: "2º × 3º", bestOf: 3, sourceA: { type: "seed", n: 2 }, sourceB: { type: "seed", n: 3 } },
    { id: "uf", name: "Final Upper", sub: "vencedores", bestOf: 3, sourceA: { type: "winner", of: "sf1" }, sourceB: { type: "winner", of: "sf2" } },
    { id: "rep1", name: "Lower 1", sub: "perdedores das semis", bestOf: 3, sourceA: { type: "loser", of: "sf1" }, sourceB: { type: "loser", of: "sf2" } },
    { id: "rf", name: "Final Lower", sub: "lower × perdedor upper", bestOf: 3, sourceA: { type: "winner", of: "rep1" }, sourceB: { type: "loser", of: "uf" } },
    { id: "gf", name: "Grande Final", sub: "MD5", bestOf: 5, sourceA: { type: "winner", of: "uf" }, sourceB: { type: "winner", of: "rf" } }
  ];
}

function blankMatch(meta) {
  return { ...meta, w1: "", w2: "", k1: "", d1: "", k2: "", d2: "" };
}

function defaultState() {
  return {
    title: TITLE,
    week: 1,
    weekLabel: "Semana 1",
    players: defaultPlayers(),
    league: leagueBlueprint().map(blankMatch),
    playoffs: playoffBlueprint().map(blankMatch),
    history: []
  };
}

let state = defaultState();
let cloud = false;
let canEdit = true;
let editPin = "";
let saveTimer = 0;

function hydrate(parsed) {
  if (!parsed || typeof parsed !== "object") return defaultState();
  const base = defaultState();
  return {
    ...base,
    ...parsed,
    title: TITLE,
    players: mergePlayers(parsed.players),
    league: mergeMatches(base.league, parsed.league),
    playoffs: mergeMatches(base.playoffs, parsed.playoffs),
    history: Array.isArray(parsed.history) ? parsed.history : []
  };
}

function loadLocal() {
  try {
    return hydrate(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return defaultState();
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function pullCloud() {
  const r = await fetch("/api/state");
  if (!r.ok) throw new Error("api");
  const json = await r.json();
  cloud = true;
  if (json.data && Object.keys(json.data).length) state = hydrate(json.data);
  saveLocal();
}

async function pushCloud() {
  if (!cloud || !canEdit || !editPin) return;
  const r = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-edit-pin": editPin },
    body: JSON.stringify({ data: state })
  });
  if (r.status === 401) {
    lockEdit();
    flash("PIN inválido");
    return false;
  }
  if (!r.ok) throw new Error("save");
  return true;
}

function save() {
  if (cloud && !canEdit) return;
  saveLocal();
  if (cloud && canEdit) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      pushCloud().catch(() => flash("Não salvou na nuvem"));
    }, 500);
  }
}

async function checkPin(pin) {
  const r = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin })
  });
  return r.ok;
}

function applyEditable() {
  document.body.classList.toggle("is-view", cloud && !canEdit);
  const unlock = document.getElementById("btn-unlock");
  const status = document.getElementById("cloud-status");
  const hint = document.getElementById("save-hint");
  if (unlock) unlock.textContent = cloud && canEdit ? "Sair" : "Editar";
  if (status) {
    status.className = "cloud-status";
    if (!cloud) {
      status.textContent = "Local";
    } else if (canEdit) {
      status.textContent = "Editando";
      status.classList.add("edit");
    } else {
      status.textContent = "Ao vivo";
      status.classList.add("live");
    }
  }
  if (hint) {
    hint.textContent = cloud
      ? "Visitantes só veem. Quem tem PIN edita para todos."
      : "API ausente. Salvando só neste navegador.";
  }
}

function lockEdit() {
  canEdit = !cloud;
  editPin = "";
  try { sessionStorage.removeItem("edit-pin"); } catch {}
  applyEditable();
}

function unlockEdit(pin) {
  canEdit = true;
  editPin = pin;
  try { sessionStorage.setItem("edit-pin", pin); } catch {}
  applyEditable();
}

function openPinModal(show) {
  const modal = document.getElementById("pin-modal");
  if (!modal) return;
  modal.hidden = !show;
  if (show) {
    const input = document.getElementById("pin-input");
    input.value = "";
    setTimeout(() => input.focus(), 50);
  }
}

function mergePlayers(saved) {
  return defaultPlayers().map((d) => {
    const f = Array.isArray(saved) ? saved.find((s) => s.id === d.id) : null;
    return f ? { ...d, ...f, id: d.id } : d;
  });
}

function mergeMatches(defaults, saved) {
  if (!Array.isArray(saved)) return defaults;
  return defaults.map((d) => {
    const f = saved.find((s) => s.id === d.id);
    if (!f) return d;
    return {
      ...d,
      w1: f.w1 ?? "",
      w2: f.w2 ?? "",
      k1: f.k1 ?? "",
      d1: f.d1 ?? "",
      k2: f.k2 ?? "",
      d2: f.d2 ?? ""
    };
  });
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function n(v) {
  if (v === "" || v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function player(id) {
  return state.players.find((p) => p.id === id) || { id, name: id || "TBD", color: "#555", photo: "" };
}

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function pic(p, cls = "") {
  const ph = `<span class="ph" style="background:${esc(p.color || "#3ec7ff")}">${esc(initials(p.name))}</span>`;
  if (!p.photo) return ph;
  return `<span class="pic">${ph}<img src="${esc(p.photo)}" alt="${esc(p.name)}" /></span>`;
}

function bindImgs() {
  document.querySelectorAll("img:not(.logo)").forEach((img) => {
    img.addEventListener("error", () => img.remove());
  });
}

function result(m) {
  const w1 = n(m.w1) || 0;
  const w2 = n(m.w2) || 0;
  const need = Math.ceil((m.bestOf || 3) / 2);
  const done = w1 >= need || w2 >= need;
  const live = !done && w1 + w2 > 0;
  return {
    w1,
    w2,
    done,
    live,
    winner: done ? (w1 > w2 ? m.p1 : m.p2) : null,
    loser: done ? (w1 > w2 ? m.p2 : m.p1) : null
  };
}

function standings() {
  const rows = state.players.map((p) => ({
    ...p, w: 0, l: 0, k: 0, d: 0
  }));
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const h2h = {};
  state.league.forEach((m) => {
    const r = result(m);
    if (!r.done) return;
    const a = by[m.p1];
    const b = by[m.p2];
    if (r.winner === m.p1) { a.w += 1; b.l += 1; } else { b.w += 1; a.l += 1; }
    a.k += n(m.k1) || 0;
    a.d += n(m.d1) || 0;
    b.k += n(m.k2) || 0;
    b.d += n(m.d2) || 0;
    h2h[`${m.p1}-${m.p2}`] = r.winner;
    h2h[`${m.p2}-${m.p1}`] = r.winner;
  });
  rows.sort((x, y) => {
    if (y.w !== x.w) return y.w - x.w;
    if (h2h[`${x.id}-${y.id}`] === x.id) return -1;
    if (h2h[`${x.id}-${y.id}`] === y.id) return 1;
    const kdx = x.d ? x.k / x.d : x.k;
    const kdy = y.d ? y.k / y.d : y.k;
    if (kdy !== kdx) return kdy - kdx;
    return x.name.localeCompare(y.name);
  });
  return rows.map((r, i) => ({ ...r, pos: i + 1 }));
}

function withPlayoffs() {
  const seeds = standings();
  const out = state.playoffs.map((m) => ({ ...m, p1: null, p2: null }));
  const by = Object.fromEntries(out.map((m) => [m.id, m]));
  function resolve(src) {
    if (!src) return null;
    if (src.type === "seed") return seeds[src.n - 1]?.id || null;
    const dep = by[src.of];
    const r = result(dep);
    if (!r.done) return null;
    return src.type === "winner" ? r.winner : r.loser;
  }
  ["sf1", "sf2", "rep1", "uf", "rf", "gf"].forEach((id) => {
    by[id].p1 = resolve(by[id].sourceA);
    by[id].p2 = resolve(by[id].sourceB);
  });
  return out;
}

function findMatch(id) {
  return state.league.find((m) => m.id === id) || state.playoffs.find((m) => m.id === id);
}

function syncHistory() {
  const finish = weekFinish();
  if (!finish) return;
  const champ = Object.keys(finish).find((id) => finish[id] === 1) || null;
  const vice = Object.keys(finish).find((id) => finish[id] === 2) || null;
  const last = Object.keys(finish).find((id) => finish[id] === 5) || null;
  const entry = {
    week: state.week,
    label: state.weekLabel || `Semana ${state.week}`,
    champion: champ,
    runnerUp: vice,
    last,
    finish,
    stats: weekBag(),
    date: new Date().toISOString()
  };
  const i = state.history.findIndex((h) => h.week === state.week);
  if (i >= 0) state.history[i] = entry;
  else state.history.push(entry);
}

function leagueDuel(a, b) {
  return state.league.find((m) =>
    (m.p1 === a && m.p2 === b) || (m.p1 === b && m.p2 === a)
  );
}

function kdText(k, d) {
  const kk = n(k);
  const dd = n(d);
  if (kk == null && dd == null) return "";
  const a = kk || 0;
  const b = dd || 0;
  if (!b) return a ? `${a.toFixed(2)} KD` : "";
  return `${(a / b).toFixed(2)} KD`;
}

function boutSide(m, pid, sideN, r, right) {
  const p = player(pid);
  const win = r.done && r.winner === pid;
  const lose = r.done && r.loser === pid;
  const k = sideN === 1 ? m.k1 : m.k2;
  const d = sideN === 1 ? m.d1 : m.d2;
  const ratio = kdText(k, d);
  return `
    <div class="bout-side ${right ? "right" : ""} ${win ? "win" : ""} ${lose ? "lose" : ""}">
      ${pic(p)}
      <div class="bout-who">
        <b>${esc(p.name)}</b>
      </div>
      <div class="kd-box">
        <label class="k">
          <span>Kills</span>
          <input data-m="${esc(m.id)}" data-f="${sideN === 1 ? "k1" : "k2"}" value="${esc(k)}" placeholder="0" inputmode="numeric" />
        </label>
        <label class="d">
          <span>Deaths</span>
          <input data-m="${esc(m.id)}" data-f="${sideN === 1 ? "d1" : "d2"}" value="${esc(d)}" placeholder="0" inputmode="numeric" />
        </label>
        <em>${esc(ratio || "K / D")}</em>
      </div>
    </div>`;
}

function bout(m) {
  const r = result(m);
  return `
    <article class="bout" id="node-${esc(m.id)}">
      ${boutSide(m, m.p1, 1, r, false)}
      <div class="bout-score">
        <input data-m="${esc(m.id)}" data-f="w1" value="${esc(m.w1)}" placeholder="0" inputmode="numeric" title="Mapas" />
        <span class="times">x</span>
        <input data-m="${esc(m.id)}" data-f="w2" value="${esc(m.w2)}" placeholder="0" inputmode="numeric" title="Mapas" />
      </div>
      ${boutSide(m, m.p2, 2, r, true)}
    </article>`;
}

function renderH2H() {
  const people = state.players;
  const head = `<th></th>${people.map((p) => `<th>${esc(p.name)}</th>`).join("")}`;
  const body = people.map((row) => {
    const cells = people.map((col) => {
      if (row.id === col.id) return `<td class="self">·</td>`;
      const m = leagueDuel(row.id, col.id);
      if (!m) return `<td>—</td>`;
      const r = result(m);
      const left = m.p1 === row.id ? (m.w1 || "0") : (m.w2 || "0");
      const right = m.p1 === row.id ? (m.w2 || "0") : (m.w1 || "0");
      const txt = r.done || m.w1 !== "" || m.w2 !== "" ? `${left}x${right}` : "jogar";
      return `<td><button type="button" class="${r.done ? "done" : "wait"}" data-jump="${esc(m.id)}">${esc(txt)}</button></td>`;
    }).join("");
    return `<tr><th>${esc(row.name)}</th>${cells}</tr>`;
  }).join("");
  return `<div class="h2h-wrap"><div class="h2h-cap">Confrontos · clique no placar para ir ao jogo</div><table class="h2h"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderLiga() {
  const played = state.league.filter((m) => result(m).done).length;
  const rounds = [1, 2, 3, 4, 5].map((rn) => {
    const games = state.league.filter((m) => m.round === rn);
    const bye = player(games[0]?.bye);
    return `<section class="round">
      <div class="round-h">
        <h3>Rodada ${rn} de 5</h3>
        <span class="round-count">2 jogos · 1 folga</span>
      </div>
      <div class="round-body">
        <div class="round-games">${games.map(bout).join("")}</div>
        <aside class="bye-card">
          <small>Folga</small>
          ${pic(bye)}
          <b>${esc(bye.name)}</b>
          <p>Não joga nesta rodada. Volta na próxima.</p>
        </aside>
      </div>
    </section>`;
  });
  const byeLine = [1, 2, 3, 4, 5].map((rn) => {
    const bye = player(state.league.find((m) => m.round === rn)?.bye);
    return `<div class="bye-mini"><em>R${rn}</em>${pic(bye)}<b>${esc(bye.name)}</b></div>`;
  }).join("");
  document.getElementById("tab-liga").innerHTML = `
    <div class="head">
      <h2>Fase de liga</h2>
      <p>Todos contra todos. Cada série vale 1 ponto. O placar é de mapas, no formato 2x1. Em cada rodada, um jogador fica de folga.</p>
    </div>
    <div class="liga-facts">
      <div><b>10</b><span>séries no total</span></div>
      <div><b>MD3</b><span>vence quem ganhar 2 mapas</span></div>
      <div><b>${played}/10</b><span>séries já definidas</span></div>
      <div><b>4 sobem</b><span>o 5º fica fora dos playoffs</span></div>
    </div>
    <div class="bye-strip">
      <strong>Quem folga</strong>
      <div class="bye-minis">${byeLine}</div>
    </div>
    ${renderH2H()}
    <div class="rounds">${rounds.join("")}</div>
  `;
}

function renderTabela() {
  const rows = standings();
  const cards = rows.map((r) => `
    <article class="rank-card ${r.pos === 5 ? "out" : ""}">
      ${pic(r)}
      <em>${r.pos === 5 ? "Eliminado" : r.pos + "º lugar"}</em>
      <b>${esc(r.name)}</b>
      <span>${r.w}W · ${r.l}L · ${r.k}/${r.d} K/D</span>
    </article>`).join("");
  const body = rows.map((r) => `
    <tr>
      <td class="${r.pos === 1 ? "p1" : r.pos === 5 ? "p5" : ""}">${r.pos}º</td>
      <td><div class="who">${pic(r)}<b>${esc(r.name)}</b></div></td>
      <td class="n">${r.w}</td>
      <td class="n">${r.l}</td>
      <td class="n k">${r.k}</td>
      <td class="n d">${r.d}</td>
      <td class="n">${r.d ? (r.k / r.d).toFixed(2) : r.k ? r.k.toFixed(2) : "—"}</td>
      <td>${r.pos === 5 ? "Eliminado" : "Playoffs"}</td>
    </tr>`).join("");
  document.getElementById("tab-tabela").innerHTML = `
    <div class="head"><h2>Classificação</h2><p>Os 4 primeiros avançam. O 5º é eliminado na liga.</p></div>
    <div class="rank-grid">${cards}</div>
    <div class="table-card">
      <table class="t">
        <thead><tr><th>#</th><th>Jogador</th><th class="n">W</th><th class="n">L</th><th class="n">K</th><th class="n">D</th><th class="n">K/D</th><th>Destino</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function seedChip(rank, p) {
  return `<div class="seed" id="node-seed${rank}">
    <i>${rank}</i>${p ? pic(p) : `<span class="ph" style="background:#2a3f8f">?</span>`}
    <b>${esc(p ? p.name : "Liga")}</b>
  </div>`;
}

function bracketSlot(m, gf = false) {
  const r = result(m);
  const row = (pid, sideN) => {
    const p = player(pid);
    const tbd = !pid;
    const win = r.done && r.winner === pid;
    const lose = r.done && r.loser === pid;
    const k = sideN === 1 ? m.k1 : m.k2;
    const d = sideN === 1 ? m.d1 : m.d2;
    const w = sideN === 1 ? m.w1 : m.w2;
    return `
      <div class="br-row ${win ? "win" : ""} ${lose ? "lose" : ""}">
        ${tbd ? `<span class="ph" style="background:#2a3f8f">?</span>` : pic(p)}
        <span class="name">${esc(tbd ? "Aguardando" : p.name)}</span>
        <input data-m="${esc(m.id)}" data-f="${sideN === 1 ? "k1" : "k2"}" value="${esc(k)}" placeholder="K" inputmode="numeric" title="Kills" />
        <input data-m="${esc(m.id)}" data-f="${sideN === 1 ? "d1" : "d2"}" value="${esc(d)}" placeholder="D" inputmode="numeric" title="Deaths" />
        <input class="br-sc" data-m="${esc(m.id)}" data-f="${sideN === 1 ? "w1" : "w2"}" value="${esc(w)}" placeholder="0" inputmode="numeric" title="Série" />
      </div>`;
  };
  return `
    <article class="br-slot ${gf ? "is-gf" : ""}" id="node-${esc(m.id)}">
      <div class="br-h">
        <span class="ttl"><b>${esc(m.name)}</b>${m.sub ? " · " + esc(m.sub) : ""}</span>
        <i>K</i><i>D</i><i>S</i>
      </div>
      ${row(m.p1, 1)}
      ${row(m.p2, 2)}
    </article>`;
}

function hook(destId, cls) {
  const m = withPlayoffs().find((x) => x.id === destId);
  const ready = Boolean(m && (m.p1 || m.p2));
  const on = ready && !(cls || "").includes("drop") ? " on" : "";
  return `<div class="hook ${cls || ""}${on}"></div>`;
}

function renderPlayoffs() {
  const seeds = standings();
  const m = Object.fromEntries(withPlayoffs().map((x) => [x.id, x]));
  const champ = result(m.gf);
  const champP = champ.winner ? player(champ.winner) : null;
  document.getElementById("tab-playoffs").innerHTML = `
    ${champP ? `<div class="champ">${pic(champP)} Campeão da ${esc(state.weekLabel)} · ${esc(champP.name)}</div>` : ""}
    <div class="head">
      <h2>Playoffs</h2>
      <p>1º × 4º e 2º × 3º no Upper. Quem perde cai no Lower. A Grande Final é MD5.</p>
    </div>
    <div class="po-seeds">
      ${seeds.map((r) => `
        <article class="po-seed ${r.pos === 5 ? "out" : ""}">
          <i>${r.pos === 5 ? "—" : r.pos}</i>
          ${pic(r)}
          <div>
            <b>${esc(r.name)}</b>
            <small>${r.pos === 5 ? "Eliminado na liga" : "Classificado"}</small>
          </div>
        </article>`).join("")}
    </div>
    <div class="tree-wrap">
      <div class="tree">
        <div class="lab t-ulab">Seed</div>
        <div class="lab t-sflab">Semifinais</div>
        <div class="lab t-uflab">Final Upper</div>
        <div class="lab gf t-gflab">Grande Final</div>

        <div class="t-s1">${seedChip(1, seeds[0])}</div>
        <div class="t-s4">${seedChip(4, seeds[3])}</div>
        ${hook("sf1", "t-h1")}
        <div class="t-sf1">${bracketSlot(m.sf1)}</div>

        <div class="t-s2">${seedChip(2, seeds[1])}</div>
        <div class="t-s3">${seedChip(3, seeds[2])}</div>
        ${hook("sf2", "t-h2")}
        <div class="t-sf2">${bracketSlot(m.sf2)}</div>

        ${hook("uf", "t-h-uf")}
        <div class="t-uf">${bracketSlot(m.uf)}</div>
        ${hook("gf", "t-h-gf")}
        <div class="t-gf">${bracketSlot(m.gf, true)}</div>

        <div class="lab t-llab">Lower bracket</div>
        <div class="t-drop"><p class="drop-note">Perdedores das semis entram aqui. O perdedor da Final Upper ainda tem uma chance na Final Lower.</p></div>
        ${hook("rep1", "t-h-lb drop")}
        <div class="t-lb">${bracketSlot(m.rep1)}</div>
        ${hook("rf", "t-h-lf")}
        <div class="t-lf">${bracketSlot(m.rf)}</div>
      </div>
    </div>
  `;
}

const FINISH_PTS = { 1: 5, 2: 3, 3: 2, 4: 1, 5: 0 };
const FINISH_NAME = {
  1: "Campeão",
  2: "Vice",
  3: "3º lugar",
  4: "4º lugar",
  5: "Eliminado na liga"
};

function kdNum(k, d) {
  if (!k && !d) return "—";
  return (d ? k / d : k).toFixed(2);
}

function emptyBag() {
  return Object.fromEntries(state.players.map((p) => [p.id, { k: 0, d: 0, w: 0, l: 0 }]));
}

function tallyMatch(bag, m) {
  if (!m.p1 || !m.p2 || !bag[m.p1] || !bag[m.p2]) return;
  bag[m.p1].k += n(m.k1) || 0;
  bag[m.p1].d += n(m.d1) || 0;
  bag[m.p2].k += n(m.k2) || 0;
  bag[m.p2].d += n(m.d2) || 0;
  const r = result(m);
  if (!r.done) return;
  if (r.winner === m.p1) {
    bag[m.p1].w += 1;
    bag[m.p2].l += 1;
  } else {
    bag[m.p2].w += 1;
    bag[m.p1].l += 1;
  }
}

function weekBag() {
  const bag = emptyBag();
  state.league.forEach((m) => tallyMatch(bag, m));
  withPlayoffs().forEach((m) => tallyMatch(bag, m));
  return bag;
}

function weekFinish() {
  const po = Object.fromEntries(withPlayoffs().map((x) => [x.id, x]));
  const gf = result(po.gf);
  const rf = result(po.rf);
  const lb = result(po.rep1);
  const fifth = standings()[4];
  if (!gf.winner) return null;
  const finish = { [gf.winner]: 1 };
  if (gf.loser) finish[gf.loser] = 2;
  if (rf.loser) finish[rf.loser] = 3;
  if (lb.loser) finish[lb.loser] = 4;
  if (fifth) finish[fifth.id] = 5;
  return finish;
}

function entryFinish(h) {
  const finish = { ...(h.finish || {}) };
  if (h.champion) finish[h.champion] = 1;
  if (h.runnerUp) finish[h.runnerUp] = 2;
  if (h.last) finish[h.last] = 5;
  return finish;
}

function currentWeekBoard() {
  const bag = weekBag();
  const finish = weekFinish();
  const league = standings();
  return state.players
    .map((p) => {
      const s = bag[p.id];
      const lg = league.find((x) => x.id === p.id);
      const place = finish ? finish[p.id] : null;
      return {
        p,
        place,
        leaguePos: lg?.pos || 9,
        pts: place ? FINISH_PTS[place] : 0,
        ...s,
        kd: kdNum(s.k, s.d)
      };
    })
    .sort((a, b) => {
      if (a.place && b.place) return a.place - b.place;
      if (a.place) return -1;
      if (b.place) return 1;
      return a.leaguePos - b.leaguePos;
    });
}

function careerBoard() {
  const rows = state.players.map((p) => ({
    p, pts: 0, titles: 0, vices: 0, third: 0, fourth: 0, fifth: 0, k: 0, d: 0, w: 0, l: 0
  }));
  const by = Object.fromEntries(rows.map((r) => [r.p.id, r]));
  state.history.forEach((h) => {
    Object.entries(entryFinish(h)).forEach(([id, pos]) => {
      const r = by[id];
      if (!r) return;
      r.pts += FINISH_PTS[pos] || 0;
      if (pos === 1) r.titles += 1;
      if (pos === 2) r.vices += 1;
      if (pos === 3) r.third += 1;
      if (pos === 4) r.fourth += 1;
      if (pos === 5) r.fifth += 1;
    });
    Object.entries(h.stats || {}).forEach(([id, s]) => {
      const r = by[id];
      if (!r || !s) return;
      r.k += s.k || 0;
      r.d += s.d || 0;
      r.w += s.w || 0;
      r.l += s.l || 0;
    });
  });
  rows.sort((a, b) =>
    b.pts - a.pts ||
    b.titles - a.titles ||
    b.vices - a.vices ||
    (b.d ? b.k / b.d : b.k) - (a.d ? a.k / a.d : a.k) ||
    a.p.name.localeCompare(b.p.name)
  );
  return rows.map((r, i) => ({ ...r, pos: i + 1, kd: kdNum(r.k, r.d) }));
}

function gloryLine(n) {
  if (!n) return "Ainda zero copa. O chão é o limite, literalmente.";
  if (n === 1) return "Uma coroa. Já pode falar 'ez' no chat.";
  if (n === 2) return "Bicampeão. Começou a ficar chato.";
  if (n === 3) return "Tricampeão. Alguém revisa o veto desse cara.";
  return `${n} títulos. Isso já é bullying institucional.`;
}

function shameLine(fifth, vice) {
  if (!fifth && !vice) return "Ficha limpa. Aproveita, não dura.";
  if (fifth >= 3) return `${fifth}x em 5º. Isso já é cargo CLT.`;
  if (fifth === 2) return "5º de novo. Tradição da casa.";
  if (fifth === 1 && vice) return "Eliminado na liga e vice na final. Combo completo.";
  if (fifth) return "5º lugar. F no chat, irmãos.";
  if (vice >= 2) return `${vice} vices. Sempre o pajero da grande final.`;
  return "Vice. Cheirou o título e levou ghost.";
}

function memePair(kind, fifth, vice, n) {
  if (kind === "win") {
    if (!n) return ["WAITING", "FOR ELO"];
    if (n >= 3) return ["UNSTOPPABLE", "NERF PLS"];
    if (n === 2) return ["EZ", "DIFF"];
    return ["GG", "GOAT"];
  }
  if (fifth >= 2) return ["CERTIFIED", "5º LUGAR"];
  if (fifth) return ["LIGA", "DISSE NÃO"];
  if (vice >= 2) return ["ETERNAL", "VICE"];
  if (vice) return ["TÃO PERTO", "TÃO L"];
  return ["AINDA", "LIMPO"];
}

function renderMurais() {
  const career = careerBoard();
  const week = currentWeekBoard();
  const done = Boolean(weekFinish());
  const weeks = [...state.history].filter((h) => h.champion).reverse();
  const latest = weeks[0];
  const champ = latest ? player(latest.champion) : null;
  const goat = career[0];
  const lastShame = [...career].sort((a, b) => b.fifth - a.fifth || b.vices - a.vices)[0];

  document.getElementById("tab-murais").innerHTML = `
    <div class="head">
      <h2>Ranking e murais</h2>
      <p>Pontos da semana: campeão 5, vice 3, 3º 2, 4º 1, 5º da liga 0. K e D somam liga + playoffs.</p>
    </div>
    <div class="score-legend">
      <div class="p1"><b>5</b><span>Campeão · venceu a Grande Final</span></div>
      <div><b>3</b><span>Vice · perdeu a Grande Final</span></div>
      <div><b>2</b><span>3º · perdeu a Final Lower</span></div>
      <div><b>1</b><span>4º · perdeu o Lower 1</span></div>
      <div class="p5"><b>0</b><span>5º · eliminado na liga</span></div>
    </div>

    <section class="board-block">
      <h3>Semana atual · ${esc(state.weekLabel)}</h3>
      <p>${done ? "Colocação final da semana, do 1º ao 5º." : "Enquanto a Grande Final não fecha, a ordem segue a liga. O vice e o 3º/4º saem dos playoffs."}</p>
      <div class="table-card">
        <table class="t">
          <thead>
            <tr>
              <th>#</th><th>Jogador</th><th>Colocação</th>
              <th class="n">Pts</th><th class="n">W</th><th class="n">L</th>
              <th class="n">K</th><th class="n">D</th><th class="n">K/D</th>
            </tr>
          </thead>
          <tbody>
            ${week.map((r, i) => {
              const rank = r.place || r.leaguePos;
              const label = r.place ? FINISH_NAME[r.place] : (r.leaguePos === 5 ? "Eliminado na liga" : r.leaguePos + "º na liga");
              return `<tr>
                <td class="${rank === 1 ? "p1" : rank === 5 ? "p5" : ""}">${rank}º</td>
                <td><div class="who">${pic(r.p)}<b>${esc(r.p.name)}</b></div></td>
                <td>${esc(label)}</td>
                <td class="n">${r.pts}</td>
                <td class="n">${r.w}</td>
                <td class="n">${r.l}</td>
                <td class="n k">${r.k}</td>
                <td class="n d">${r.d}</td>
                <td class="n">${r.kd}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="board-block">
      <h3>Ranking geral</h3>
      <p>Acumulado de todas as semanas arquivadas. Quem mais pontua fica em cima; desempate por títulos, vices e K/D.</p>
      <div class="table-card">
        <table class="t">
          <thead>
            <tr>
              <th>#</th><th>Jogador</th>
              <th class="n">Pts</th><th class="n">Títulos</th><th class="n">Vice</th>
              <th class="n">3º</th><th class="n">4º</th><th class="n">5º</th>
              <th class="n">K</th><th class="n">D</th><th class="n">K/D</th>
            </tr>
          </thead>
          <tbody>
            ${career.map((r) => `
              <tr>
                <td class="${r.pos === 1 ? "p1" : r.pos === career.length ? "p5" : ""}">${r.pos}º</td>
                <td><div class="who">${pic(r.p)}<b>${esc(r.p.name)}</b></div></td>
                <td class="n">${r.pts}</td>
                <td class="n">${r.titles}</td>
                <td class="n">${r.vices}</td>
                <td class="n">${r.third}</td>
                <td class="n">${r.fourth}</td>
                <td class="n">${r.fifth}</td>
                <td class="n k">${r.k}</td>
                <td class="n d">${r.d}</td>
                <td class="n">${r.kd}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>

    ${weeks.length ? `
    <section class="board-block">
      <h3>Semanas anteriores</h3>
      <div class="week-log">
        ${weeks.map((h) => {
          const c = player(h.champion);
          const v = h.runnerUp ? player(h.runnerUp) : null;
          const l = h.last ? player(h.last) : null;
          return `<article class="week-card">
            <small>${esc(h.label)}</small>
            <p><b>1º ${esc(c.name)}</b></p>
            <p>${v ? "2º " + esc(v.name) : "Vice indefinido"}</p>
            <p class="hint">${l ? "5º " + esc(l.name) : ""}</p>
          </article>`;
        }).join("")}
      </div>
    </section>` : ""}

    <div class="murals">
      <section class="mural win">
        <div class="mural-kicker">Hall of Fame</div>
        <div class="head">
          <h2>Mural dos Deuses</h2>
          <p>Aqui mora quem fechou a Grande Final. O resto que lute.</p>
        </div>
        <div class="hero glow">
          ${champ ? pic(champ) : `<span class="ph" style="background:#2a3f8f">?</span>`}
          <div>
            <small>${champ ? "Rei da última semana" : "Trono vazio"}</small>
            <strong>${esc(champ ? champ.name : "Aguardando a final")}</strong>
            <p class="hint">${latest ? esc(latest.label) + " · pode falar ez." : "Fecha a Grande Final e a gente grava o crime."}</p>
          </div>
        </div>
        <div class="tiles">
          ${weeks.length ? weeks.map((h) => {
            const p = player(h.champion);
            const n = career.find((x) => x.p.id === p.id)?.titles || 0;
            const [top, bot] = memePair("win", 0, 0, n);
            return `<article class="tile meme">
              <div class="meme-pic">${pic(p)}<span class="meme-top">${top}</span><span class="meme-bot">${bot}</span></div>
              <p>${esc(p.name)}<small>${esc(h.label)}</small></p>
            </article>`;
          }).join("") : `<p class="hint">Nenhum título ainda. Tá todo mundo 50/50 na vida.</p>`}
        </div>
        <div class="rank-list">
          ${career.map((x) => `
            <div class="rank-row">
              ${pic(x.p)}
              <div>
                <b>${esc(x.p.name)}</b>
                <small class="roast">${esc(gloryLine(x.titles))}</small>
              </div>
              <em>${x.titles} título${x.titles === 1 ? "" : "s"}</em>
            </div>`).join("")}
        </div>
        ${goat && goat.titles ? `<p class="stamp gold">GOAT da casa: ${esc(goat.p.name)}</p>` : ""}
      </section>
      <section class="mural shame">
        <div class="mural-kicker">Hall of Shame</div>
        <div class="head">
          <h2>Cemitério dos Pratas</h2>
          <p>5º da liga e vice da final. F no chat. Respeitosamente, sem respeito.</p>
        </div>
        <div class="tiles">
          ${career.filter((x) => x.fifth + x.vices > 0).map((x) => {
            const [top, bot] = memePair("shame", x.fifth, x.vices, 0);
            return `<article class="tile meme sad">
              <div class="meme-pic">${pic(x.p)}<span class="meme-top">${top}</span><span class="meme-bot">${bot}</span></div>
              <p>${esc(x.p.name)}<small>${x.fifth} elim. · ${x.vices} vice${x.vices === 1 ? "" : "s"}</small></p>
            </article>`;
          }).join("") || `<p class="hint">Ninguém no mural. Estranho. Alguém vai cair.</p>`}
        </div>
        <div class="rank-list">
          ${[...career].sort((a, b) => b.fifth - a.fifth || b.vices - a.vices).map((x) => `
            <div class="rank-row">
              ${pic(x.p)}
              <div>
                <b>${esc(x.p.name)}</b>
                <small class="roast">${esc(shameLine(x.fifth, x.vices))}</small>
              </div>
              <em>${x.fifth}x 5º · ${x.vices}x vice</em>
            </div>`).join("")}
        </div>
        ${lastShame && (lastShame.fifth || lastShame.vices) ? `<p class="stamp red">MVP do L: ${esc(lastShame.p.name)}</p>` : ""}
      </section>
    </div>
  `;
}

function renderPlayers() {
  document.getElementById("tab-players").innerHTML = `
    <div class="head"><h2>Elenco</h2><p>Envie a foto ou cole um link. Ela aparece na liga, na tabela, nos playoffs e nos murais.</p></div>
    <div class="players">
      ${state.players.map((p) => `
        <article class="pcard">
          ${pic(p)}
          <h3>${esc(p.name)}</h3>
          <label>Nick<input data-p="${esc(p.id)}" data-k="name" value="${esc(p.name)}" /></label>
          <label class="file photo-file editor-only">Enviar foto<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-p="${esc(p.id)}" data-k="photo-file" hidden /></label>
          <label>Foto URL<input data-p="${esc(p.id)}" data-k="photo" value="${esc(p.photo)}" placeholder="https://" /></label>
          <label>Cor<input type="color" data-p="${esc(p.id)}" data-k="color" value="${esc(p.color)}" /></label>
        </article>`).join("")}
    </div>
  `;
}

function renderAll() {
  document.getElementById("week-label").value = state.weekLabel;
  renderLiga();
  renderTabela();
  renderPlayoffs();
  renderMurais();
  renderPlayers();
  bindImgs();
  applyEditable();
}

function flash(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => t.classList.remove("is-on"), 1800);
}

function setField(id, field, value) {
  if (cloud && !canEdit) return;
  const m = findMatch(id);
  if (!m) return;
  m[field] = value;
  if (field === "w1" || field === "w2") syncHistory();
  save();
}

function showTab(id) {
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === id));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("is-on", p.id === `tab-${id}`));
  try { sessionStorage.setItem("tab", id); } catch {}
}

document.querySelector(".nav").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !btn.dataset.tab) return;
  showTab(btn.dataset.tab);
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  const map = { 1: "liga", 2: "tabela", 3: "playoffs", 4: "murais", 5: "players" };
  if (map[e.key]) showTab(map[e.key]);
});

document.addEventListener("click", (e) => {
  const more = document.querySelector(".more");
  if (more && more.open && !more.contains(e.target)) more.open = false;
});

document.querySelector("main").addEventListener("input", (e) => {
  const t = e.target;
  if (!t.dataset.m) return;
  setField(t.dataset.m, t.dataset.f, t.value);
  const box = t.closest(".kd-box");
  if (box) {
    const inputs = [...box.querySelectorAll("input")];
    const em = box.querySelector("em");
    if (em && inputs.length >= 2) em.textContent = kdText(inputs[0].value, inputs[1].value) || "K / D";
  }
});

document.querySelector("main").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.m && (t.dataset.f === "w1" || t.dataset.f === "w2")) renderAll();
});

document.querySelector("main").addEventListener("click", (e) => {
  const jump = e.target.closest("[data-jump]");
  if (!jump) return;
  const node = document.getElementById(`node-${jump.dataset.jump}`);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("btn-save").addEventListener("click", async () => {
  if (cloud && !canEdit) return;
  saveLocal();
  if (cloud) {
    try {
      const ok = await pushCloud();
      if (ok) flash("Salvo para todos");
    } catch {
      flash("Não salvou na nuvem");
    }
  } else {
    flash("Salvo neste navegador");
  }
});

document.getElementById("btn-unlock").addEventListener("click", () => {
  if (!cloud) {
    flash("Modo local: já pode editar");
    return;
  }
  if (canEdit) {
    lockEdit();
    flash("Saiu da edição");
    return;
  }
  openPinModal(true);
});

document.getElementById("pin-cancel").addEventListener("click", () => openPinModal(false));
document.getElementById("pin-modal").addEventListener("click", (e) => {
  if (e.target.id === "pin-modal") openPinModal(false);
});
document.getElementById("pin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = document.getElementById("pin-input").value.trim();
  if (!pin) return;
  const ok = await checkPin(pin);
  if (!ok) {
    flash("PIN inválido");
    return;
  }
  unlockEdit(pin);
  openPinModal(false);
  flash("Modo edição");
});

document.getElementById("tab-players").addEventListener("input", (e) => {
  if (cloud && !canEdit) return;
  const t = e.target;
  if (!t.dataset.p || t.dataset.k === "photo-file") return;
  const p = state.players.find((x) => x.id === t.dataset.p);
  if (!p) return;
  p[t.dataset.k] = t.value;
  save();
  if (t.dataset.k === "color") renderAll();
});

document.getElementById("tab-players").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.k === "photo-file") {
    const file = t.files && t.files[0];
    t.value = "";
    if (file) uploadPhoto(t.dataset.p, file);
    return;
  }
  if (t.dataset.p && (t.dataset.k === "name" || t.dataset.k === "photo")) renderAll();
});

async function uploadPhoto(playerId, file) {
  if (cloud && !canEdit) return;
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return;
  if (file.size > 1.5 * 1024 * 1024) {
    flash("A foto deve ter até 1,5 MB");
    return;
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  if (!cloud) {
    p.photo = data;
    save();
    renderAll();
    flash("Foto salva neste navegador");
    return;
  }
  try {
    const r = await fetch("/api/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-edit-pin": editPin },
      body: JSON.stringify({ playerId, mime: file.type, data, pin: editPin })
    });
    const json = await r.json().catch(() => ({}));
    if (r.status === 401) {
      lockEdit();
      flash("PIN inválido");
      return;
    }
    if (!r.ok) {
      flash(json.error || "Não enviou a foto");
      return;
    }
    p.photo = json.url;
    save();
    renderAll();
    flash("Foto no banco");
  } catch {
    flash("Não enviou a foto");
  }
}

document.getElementById("week-label").addEventListener("input", (e) => {
  if (cloud && !canEdit) return;
  state.weekLabel = e.target.value || `Semana ${state.week}`;
  save();
});

document.getElementById("btn-new-week").addEventListener("click", () => {
  if (cloud && !canEdit) return;
  if (!confirm("Arquivar a semana atual no mural e zerar os placares?")) return;
  syncHistory();
  state.week += 1;
  state.weekLabel = `Semana ${state.week}`;
  state.league = leagueBlueprint().map(blankMatch);
  state.playoffs = playoffBlueprint().map(blankMatch);
  save();
  renderAll();
  flash("Nova semana começada");
});

document.getElementById("btn-export").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  a.download = "eternal-pratas.json";
  a.click();
  URL.revokeObjectURL(a.href);
  flash("Backup baixado");
});

document.getElementById("input-import").addEventListener("change", async (e) => {
  if (cloud && !canEdit) return;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const base = defaultState();
    state = {
      ...base,
      ...parsed,
      title: TITLE,
      players: mergePlayers(parsed.players),
      league: mergeMatches(base.league, parsed.league),
      playoffs: mergeMatches(base.playoffs, parsed.playoffs),
      history: parsed.history || []
    };
    save();
    renderAll();
    flash(cloud ? "Backup carregado para todos" : "Backup carregado");
  } catch {
    alert("Arquivo inválido. Use o JSON baixado em Baixar backup.");
  }
  e.target.value = "";
});

document.getElementById("btn-reset").addEventListener("click", () => {
  if (cloud && !canEdit) return;
  if (!confirm(cloud ? "Zerar o campeonato para todo mundo?" : "Apagar placares, murais e fotos salvos neste navegador?")) return;
  state = defaultState();
  save();
  renderAll();
  flash(cloud ? "Campeonato zerado para todos" : "Campeonato zerado");
});

async function refreshIfViewer() {
  if (!cloud || canEdit) return;
  if (document.activeElement && document.activeElement.matches("input, textarea")) return;
  try {
    await pullCloud();
    renderAll();
    applyEditable();
  } catch {}
}

async function boot() {
  applyEditable();
  try {
    await pullCloud();
    canEdit = false;
    const savedPin = sessionStorage.getItem("edit-pin") || "";
    if (savedPin && await checkPin(savedPin)) unlockEdit(savedPin);
  } catch {
    cloud = false;
    canEdit = true;
    state = loadLocal();
  }
  renderAll();
  applyEditable();
  try {
    const tab = sessionStorage.getItem("tab");
    if (tab) showTab(tab);
  } catch {}
  if (cloud) setInterval(refreshIfViewer, 8000);
}

boot();
