const fs = require("fs");
const path = require("path");
const postgres = require("postgres");

const sqlFile = path.join(__dirname, "..", "supabase.sql");

function connString() {
  return process.env.CAMPX1_POSTGRES_URL_NON_POOLING
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.CAMPX1_POSTGRES_URL
    || process.env.POSTGRES_URL
    || "";
}

(async () => {
  const url = connString();
  if (!url) {
    console.error("Sem URL do Postgres. Rode com: npx vercel env run -- node scripts/migrate.js");
    process.exit(1);
  }
  const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });
  try {
    const text = fs.readFileSync(sqlFile, "utf8");
    await sql.unsafe(text);
    const tables = await sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('players','matches','weeks','week_player_stats','tournaments')
      order by table_name
    `;
    console.log("tabelas:", tables.map((t) => t.table_name).join(", "));
    const players = await sql`select id from public.players order by sort_order`;
    const matches = await sql`select count(*)::int as n from public.matches`;
    console.log("jogadores:", players.map((p) => p.id).join(", "));
    console.log("partidas:", matches[0].n);

    const old = await sql`select data from public.camp_state where id = 'main'`;
    const data = old[0] && old[0].data;
    if (data && typeof data === "object" && Object.keys(data).length && Array.isArray(data.players)) {
      await sql`select public.save_camp_state(${sql.json(data)})`;
      console.log("estado anterior importado para as tabelas");
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
