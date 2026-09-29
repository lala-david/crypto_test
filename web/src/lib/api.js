// 데이터 접근: 로컬 백엔드(/api/*)가 있으면 실시간, 없으면 data/*.json 스냅샷(정적 배포)으로 같은 화면을 그린다.
import { filterRows, statsOf, listAddresses, sortRows, collapseFollowups } from "./static-engine.js";

let mode = null; // "live" | "static"
let snapshot = null;

const jsonOf = async (res) => {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

const liveGet = (path, params) => {
  const u = new URL(path, location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  });
  return fetch(u, { headers: { accept: "application/json" } }).then(jsonOf);
};

const staticUrl = (name) => new URL(`./data/${name}.json`, document.baseURI).toString();

async function loadSnapshot() {
  if (snapshot) return snapshot;
  // all.json = 전체 기간 slim(목록·통계), addresses.json = 전체 주소. 없으면 최근 90일 incidents.json 으로 떨어진다.
  const [all, addrs, briefings, meta] = await Promise.all([
    fetch(staticUrl("all")).then(jsonOf).catch(() => fetch(staticUrl("incidents")).then(jsonOf)),
    fetch(staticUrl("addresses")).then(jsonOf).catch(() => []),
    fetch(staticUrl("briefings")).then(jsonOf).catch(() => []),
    fetch(staticUrl("meta")).then(jsonOf).catch(() => ({})),
  ]);
  const rows = (Array.isArray(all) ? all : all.items || []).map((r) => ({ ...r, addresses: [], sources: [] }));
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  (addrs || []).forEach((a) => byUid.get(a.uid)?.addresses.push(a));
  snapshot = { rows, collapsed: collapseFollowups(rows), briefings, meta, byUid };
  return snapshot;
}

/** 상세는 월별 아카이브(archive/YYYY-MM.json)에서 필요할 때만 읽는다. */
const archiveCache = new Map();
async function loadArchive(month) {
  if (!archiveCache.has(month))
    archiveCache.set(
      month,
      fetch(new URL(`./data/archive/${month}.json`, document.baseURI).toString())
        .then(jsonOf)
        .catch(() => []),
    );
  return archiveCache.get(month);
}

export async function detectMode() {
  if (mode) return mode;
  try {
    await liveGet("/api/meta");
    mode = "live";
  } catch {
    mode = "static";
  }
  return mode;
}

export const isStatic = () => mode === "static";

/** 대시보드가 쓰는 엔드포인트. 정적 모드에서는 같은 규칙을 브라우저에서 계산한다. */
export async function api(path, params) {
  await detectMode();
  if (mode === "live") return liveGet(path, params);

  const snap = await loadSnapshot();
  const p = params || {};
  if (path === "/api/meta") return snap.meta;
  if (path === "/api/briefings") return snap.briefings;
  if (path.startsWith("/api/briefings/")) {
    const day = decodeURIComponent(path.split("/").pop());
    const b = snap.briefings.find((x) => x.day === day) || snap.briefings[0];
    if (!b) throw new Error("no briefing");
    return { ...b, incidents: snap.rows.filter((r) => r.day === b.day) };
  }
  if (path === "/api/incidents") {
    const rows = sortRows(filterRows(snap.collapsed, p), p.sort, p.dir);
    const size = Math.max(1, Math.min(Number(p.size) || 20, 500));
    const page = Math.max(1, Number(p.page) || 1);
    const base = rows.filter((r) => !r.followup_of);
    return {
      total: rows.length,
      new_total: base.length,
      followup_total: rows.reduce((a, r) => a + (r.followups || []).length, 0),
      amount_total: base.reduce((a, r) => a + (r.amount_usd || 0), 0),
      page,
      size,
      items: rows.slice((page - 1) * size, page * size),
      facets: facetsOf(rows),
    };
  }
  if (path.startsWith("/api/incidents/")) {
    const uid = decodeURIComponent(path.split("/").pop());
    const hit = snap.collapsed.find((r) => r.uid === uid) || snap.rows.find((r) => r.uid === uid);
    if (!hit) throw new Error("not found");
    const full = (await loadArchive(hit.month || String(hit.day).slice(0, 7))).find((r) => r.uid === uid);
    return { ...hit, ...(full || {}), addresses: full?.addresses || hit.addresses || [], related: [] };
  }
  if (path === "/api/stats") return statsOf(filterRows(snap.collapsed, p), p);
  if (path === "/api/addresses") return listAddresses(filterRows(snap.collapsed, p), p);
  if (path === "/api/addresses/lookup") {
    const q = String(p.q || "").toLowerCase();
    const matches = [];
    snap.collapsed.forEach((r) =>
      (r.addresses || []).forEach((a) => {
        if (a.address.toLowerCase().includes(q)) matches.push({ ...a, incident: r });
      }),
    );
    return { query: p.q, matches: matches.slice(0, 200), sdn: [], blacklist: null, found: matches.length > 0 };
  }
  throw new Error("unsupported in static mode: " + path);
}

function facetsOf(rows) {
  const types = {};
  const chains = {};
  const sources = {};
  rows.forEach((r) => {
    types[r.type] = (types[r.type] || 0) + 1;
    (r.chains || []).forEach((c) => (chains[c] = (chains[c] || 0) + 1));
    (r.sources || []).forEach((s) => {
      const n = s.source || s.name;
      if (n) sources[n] = (sources[n] || 0) + 1;
    });
  });
  const sorted = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  return { types: sorted(types), chains: sorted(chains), sources: sorted(sources) };
}
