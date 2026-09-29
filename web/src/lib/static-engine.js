// 정적 배포(백엔드 없음)에서 API 와 같은 결과를 브라우저에서 계산한다.
// 규칙은 collector/service.py(필터·통계·주소 목록)와 server.py(정렬)를 그대로 옮긴 것이다.
const LEGAL = new Set(["law_enforcement_action", "sanctions_designation"]);
const ROLE_PRIORITY = { sanctioned: 0, attacker: 1, laundering: 2, victim: 3, unknown: 9 };

const dayKey = (r, basis) => (basis === "collected" ? r.day : r.event_date || r.incident_date || r.day);
const iso = (d) => d.toISOString().slice(0, 10);

function rangeOf(params, rows, basis) {
  if (params.from || params.to) return [params.from || "0000-00-00", params.to || "9999-99-99"];
  const days = params.days ?? "30";
  if (days === "all" || days === "") {
    const keys = rows.map((r) => dayKey(r, basis)).filter(Boolean).sort();
    return [keys[0] || "0000-00-00", keys[keys.length - 1] || "9999-99-99"];
  }
  const n = Number(days) || 30;
  const to = new Date();
  const from = new Date(to.getTime() - (n - 1) * 86400000);
  return [iso(from), iso(to)];
}

/** 후속 보도 행을 원 사건에 접는다(service.collapse_followups 와 같은 규칙). */
export function collapseFollowups(rows) {
  const byUid = new Map(rows.map((r) => [r.uid, { ...r, followups: [] }]));
  const out = [];
  for (const r of byUid.values()) {
    const parent = r.followup_of && byUid.get(r.followup_of.uid);
    if (parent) {
      parent.followups.push({ uid: r.uid, day: r.day, event_date: r.event_date, source: r.source, project: r.project });
      parent.last_day = r.day > (parent.last_day || parent.day) ? r.day : parent.last_day || parent.day;
      if (!parent.amount_usd && r.amount_usd) {
        parent.amount_usd = r.amount_usd;
        parent.amount_text = r.amount_text;
      }
      parent.chains = Array.from(new Set([...(parent.chains || []), ...(r.chains || [])]));
      parent.src_count = (parent.src_count || 1) + (r.src_count || 1);
      parent.blacklist_hits = (parent.blacklist_hits || 0) + (r.blacklist_hits || 0);
    } else out.push(r);
  }
  out.forEach((r) => (r.followups || []).sort((a, b) => (a.day < b.day ? -1 : 1)));
  return out;
}

export function filterRows(rows, params = {}) {
  const basis = params.basis === "collected" ? "collected" : "event";
  const [lo, hi] = rangeOf(params, rows, basis);
  const q = String(params.q || "").trim().toLowerCase();
  return rows.filter((r) => {
    const k = dayKey(r, basis);
    if (k < lo || k > hi) return false;
    if (params.type && r.type !== params.type) return false;
    if (params.chain && !(r.chains || []).includes(params.chain)) return false;
    if (params.source && r.source !== params.source) return false;
    if (Number(params.hide_followups) && r.followup_of) return false;
    if (q) {
      const hay = `${r.project} ${r.title || ""} ${(r.chains || []).join(" ")}`.toLowerCase();
      const inAddr = (r.addresses || []).some((a) => a.address.toLowerCase().includes(q));
      if (!hay.includes(q) && !inAddr) return false;
    }
    return true;
  });
}

const SORT_KEY = {
  amount: (r) => r.amount_usd,
  date: (r) => r.event_date || r.incident_date || r.day,
  day: (r) => r.day,
  name: (r) => (r.project || "").toLowerCase(),
  type: (r) => r.type || "",
  chain: (r) => ((r.chains || [])[0] || "~").toLowerCase(),
  sources: (r) => r.src_count || (r.sources || []).length,
  address: (r) => (r.address || "").toLowerCase(),
  kind: (r) => r.kind || "~",
  label: (r) => (r.label || "~").toLowerCase(),
  role: (r) => r.role || "~",
  incident: (r) => ((r.incidents || [{}])[0].project || "").toLowerCase(),
  tx: (r) => r.tx_count || 0,
};
const DESC_DEFAULT = new Set(["amount", "date", "day", "sources", "tx"]);

export function sortRows(rows, sort, dir) {
  const key = SORT_KEY[sort || ""];
  if (!key) return rows.slice().sort((a, b) => ((a.event_date || a.day) < (b.event_date || b.day) ? 1 : -1));
  const desc = dir === "asc" ? false : dir === "desc" ? true : DESC_DEFAULT.has(sort);
  const known = rows.filter((r) => key(r) !== null && key(r) !== undefined);
  const unknown = rows.filter((r) => key(r) === null || key(r) === undefined);
  known.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
  });
  return known.concat(unknown);
}

export function statsOf(rows, params = {}) {
  const basis = params.basis === "collected" ? "collected" : "event";
  const [lo, hi] = rangeOf(params, rows, basis);
  const base = rows.filter((r) => !r.followup_of);
  const known = base.filter((r) => r.amount_usd);
  const daily = new Map();
  const dailyAddr = new Map();
  const start = new Date(lo + "T00:00:00Z");
  const end = new Date(hi + "T00:00:00Z");
  if (!isNaN(start) && !isNaN(end)) {
    let guard = 0;
    for (let d = new Date(start); d <= end && guard < 4000; d.setUTCDate(d.getUTCDate() + 1), guard++) {
      daily.set(iso(d), { count: 0, new: 0, amount: 0, legal: 0, addresses: 0 });
    }
  }
  const byType = new Map();
  const byChain = new Map();
  const bump = (m, k) => {
    if (!m.has(k)) m.set(k, { count: 0, new: 0, known: 0, amount: 0 });
    return m.get(k);
  };
  rows.forEach((r) => {
    const fresh = !r.followup_of;
    const amt = fresh ? r.amount_usd || 0 : 0;
    const k = dayKey(r, basis);
    if (!daily.has(k)) daily.set(k, { count: 0, new: 0, amount: 0, legal: 0, addresses: 0 });
    const dd = daily.get(k);
    dd.count += 1;
    dd.new += fresh ? 1 : 0;
    dd.amount += amt;
    dd.legal += LEGAL.has(r.type) ? 1 : 0;
    if (!dailyAddr.has(k)) dailyAddr.set(k, new Set());
    (r.addresses || []).forEach((a) => dailyAddr.get(k).add(a.address.toLowerCase()));
    const bt = bump(byType, r.type);
    bt.count += 1;
    bt.new += fresh ? 1 : 0;
    bt.known += fresh && r.amount_usd ? 1 : 0;
    bt.amount += amt;
    const chains = (r.chains || []).length ? r.chains : ["unknown"];
    chains.forEach((c) => {
      const bc = bump(byChain, c);
      bc.count += 1;
      bc.new += fresh ? 1 : 0;
      bc.known += fresh && r.amount_usd ? 1 : 0;
      bc.amount += amt / chains.length;
    });
  });
  dailyAddr.forEach((set, k) => daily.has(k) && (daily.get(k).addresses = set.size));
  const roles = {};
  const rolesInc = {};
  const rolesBl = {};
  const best = new Map();
  rows.forEach((r) =>
    (r.addresses || []).forEach((a) => {
      const k = a.address.toLowerCase();
      if (!best.has(k) || (ROLE_PRIORITY[a.role] ?? 9) < (ROLE_PRIORITY[best.get(k).role] ?? 9))
        best.set(k, { role: a.role, uid: r.uid, bl: a.blacklist });
    }),
  );
  best.forEach((v) => {
    roles[v.role] = (roles[v.role] || 0) + 1;
    rolesInc[v.role] = (rolesInc[v.role] || 0) + 1;
    if (v.bl) rolesBl[v.role] = (rolesBl[v.role] || 0) + 1;
  });
  const loss = known.filter((r) => !LEGAL.has(r.type)).reduce((a, r) => a + r.amount_usd, 0);
  const legal = known.filter((r) => LEGAL.has(r.type)).reduce((a, r) => a + r.amount_usd, 0);
  const asList = (m) =>
    [...m.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.new - a.new || b.amount - a.amount);
  return {
    range: { from: lo, to: hi, basis },
    total_count: rows.length,
    new_count: base.length,
    followup_count: rows.length - base.length,
    known_amount_count: known.length,
    unknown_amount_count: base.length - known.length,
    total_amount: loss + legal,
    loss_amount: loss,
    legal_amount: legal,
    legal_count: base.filter((r) => LEGAL.has(r.type)).length,
    addresses: best.size,
    daily: [...daily.entries()].sort().map(([day, v]) => ({ day, ...v })),
    by_type: asList(byType),
    by_chain: asList(byChain),
    roles,
    roles_inc: rolesInc,
    roles_bl: rolesBl,
    top: known.slice().sort((a, b) => b.amount_usd - a.amount_usd).slice(0, 10),
  };
}

export function listAddresses(rows, params = {}) {
  const size = Math.max(1, Math.min(Number(params.size) || 50, 500));
  const page = Math.max(1, Number(params.page) || 1);
  const seen = new Map();
  rows.forEach((r) =>
    (r.addresses || []).forEach((a) => {
      if (params.role && a.role !== params.role) return;
      if (params.chain && (a.chain || "").toLowerCase() !== String(params.chain).toLowerCase()) return;
      if (params.kind && (a.kind || "unchecked") !== params.kind) return;
      const k = a.address.toLowerCase();
      if (!seen.has(k))
        seen.set(k, {
          address: a.address,
          chain: a.chain,
          role: a.role,
          note: a.note,
          blacklist: !!a.blacklist,
          kind: a.kind || "",
          ctype: a.ctype || "",
          label: a.label || "",
          tx_count: a.tx_count ?? null,
          incidents: [],
          first_day: r.day,
        });
      const e = seen.get(k);
      if ((ROLE_PRIORITY[a.role] ?? 9) < (ROLE_PRIORITY[e.role] ?? 9)) e.role = a.role;
      if (!e.incidents.some((x) => x.uid === r.uid))
        e.incidents.push({ uid: r.uid, project: r.project, type: r.type, day: r.day, event_date: r.event_date, amount_usd: r.amount_usd });
      if (r.day > e.first_day) e.first_day = r.day;
    }),
  );
  let items = [...seen.values()].sort((a, b) => (a.first_day < b.first_day ? 1 : -1));
  items = sortRows(items, params.sort, params.dir);
  const count = (fn) => {
    const m = {};
    items.forEach((x) => {
      const k = fn(x);
      if (k) m[k] = (m[k] || 0) + 1;
    });
    return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
  };
  return {
    total: items.length,
    page,
    size,
    items: items.slice((page - 1) * size, page * size),
    roles: count((x) => x.role),
    chains: count((x) => x.chain),
    kinds: count((x) => x.kind || "unchecked"),
  };
}

/** 유형별 시계열(개요 차트). service.timeseries 와 같은 규칙. */
export function timeseriesOf(rows, params = {}) {
  const basis = params.basis === "collected" ? "collected" : "event";
  const [lo, hi] = rangeOf(params, rows, basis);
  const span = Math.round((new Date(hi) - new Date(lo)) / 86400000) + 1;
  const unit = params.unit && params.unit !== "auto" ? params.unit : span <= 45 ? "day" : span <= 400 ? "week" : "month";
  const bucket = (d) => {
    if (unit === "month") return d.slice(0, 7);
    if (unit === "week") {
      const dt = new Date(d + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
      return dt.toISOString().slice(0, 10);
    }
    return d;
  };
  const labels = [];
  const seen = new Set();
  const step = unit === "day" ? 1 : unit === "week" ? 7 : 28;
  for (let d = new Date(lo + "T00:00:00Z"), end = new Date(hi + "T00:00:00Z"), g = 0; d <= end && g < 5000; d.setUTCDate(d.getUTCDate() + step), g++) {
    const b = bucket(d.toISOString().slice(0, 10));
    if (!seen.has(b)) { seen.add(b); labels.push(b); }
  }
  if (!seen.has(bucket(hi))) labels.push(bucket(hi));
  labels.sort();
  const idx = new Map(labels.map((b, i) => [b, i]));
  const counts = {};
  rows.forEach((r) => (counts[r.type] = (counts[r.type] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, Number(params.top) || 3)).map(([k]) => k);
  const series = Object.fromEntries(top.map((t) => [t, new Array(labels.length).fill(0)]));
  rows.forEach((r) => {
    if (!series[r.type]) return;
    const i = idx.get(bucket(dayKey(r, basis)));
    if (i != null) series[r.type][i] += 1;
  });
  return { unit, from: lo, to: hi, labels, total: rows.length, series: top.map((t) => ({ key: t, values: series[t] })) };
}
