// 개요: Incident Report 카드 → 유형·체인·주소 역할 카드 3장 → 검색·기간 → 사건 표.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtInt } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import AnimatedCard from "../components/AnimatedCard.jsx";
import ReportCard from "../components/ReportCard.jsx";
import IncidentTable from "../components/IncidentTable.jsx";
import { Pager, RangeSeg } from "../components/Controls.jsx";
import { TYPE_COLOR } from "../components/Icons.jsx";

const bucketize = (rows, days) => {
  const step = days === "7" ? 1 : days === "30" ? 1 : days === "90" ? 3 : 30;
  const keys = rows.map((r) => r.event_date || r.day).filter(Boolean).sort();
  if (!keys.length) return { labels: [], index: () => -1, count: 0 };
  const from = new Date(keys[0] + "T00:00:00Z");
  const to = new Date(keys[keys.length - 1] + "T00:00:00Z");
  const buckets = [];
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + step)) buckets.push(new Date(d));
  if (!buckets.length) buckets.push(from);
  const labels = buckets.map((d) => `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`);
  const index = (day) => {
    const t = new Date(day + "T00:00:00Z").getTime();
    const k = Math.floor((t - from.getTime()) / (step * 86400000));
    return Math.max(0, Math.min(buckets.length - 1, k));
  };
  return { labels, index, count: buckets.length };
};

export default function Overview() {
  const { t, typeName, roleName } = useI18n();
  const navigate = useNavigate();
  const [days, setDays] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [filters, setFilters] = useState({ type: "", chain: "" });
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [stats, setStats] = useState(null);
  const [flow, setFlow] = useState([]);
  const size = 20;

  useEffect(() => {
    const p = { days, q, type: filters.type, chain: filters.chain };
    api("/api/incidents", { ...p, page, size, sort: sort.key, dir: sort.dir }).then(setList).catch(() => setList({ items: [], total: 0 }));
  }, [days, q, filters.type, filters.chain, page, sort.key, sort.dir]);

  useEffect(() => {
    const p = { days, type: filters.type, chain: filters.chain };
    api("/api/stats", p).then(setStats).catch(() => {});
    api("/api/incidents", { ...p, size: 500, sort: "date", dir: "desc" })
      .then((r) => setFlow(r.items || []))
      .catch(() => setFlow([]));
  }, [days, filters.type, filters.chain]);

  const chart = useMemo(() => {
    if (!flow.length) return { series: [], labels: [] };
    const byType = {};
    flow.forEach((r) => (byType[r.type] = (byType[r.type] || 0) + 1));
    const top3 = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    const b = bucketize(flow, days);
    const series = top3.map((type, i) => {
      const values = new Array(b.count).fill(0);
      flow.filter((r) => r.type === type).forEach((r) => {
        const k = b.index(r.event_date || r.day);
        if (k >= 0) values[k] += 1;
      });
      return { key: typeName(type), color: ["#8c61ff", "#a78bfa", "#e9d5ff"][i], values };
    });
    return { series, labels: b.labels };
  }, [flow, days, typeName]);

  const ctl = {
    sort,
    filters,
    onSort: (key, dir) => {
      setSort({ key, dir });
      setPage(1);
    },
    onFilter: (key, value) => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    },
  };

  const donut = (entries, name, opts) => {
    const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
    const sorted = entries.slice().sort((a, b) => b[1] - a[1]);
    const p1 = ((sorted[0]?.[1] || 0) / total) * 100;
    const p2 = (((sorted[0]?.[1] || 0) + (sorted[1]?.[1] || 0)) / total) * 100;
    return {
      mainPct: Math.round(p1),
      hoverMainPct: Math.round(p1),
      hoverSecondaryPct: Math.round(p2),
      badgeTitle: sorted[0] ? `${name(sorted[0][0])} ${Math.round(p1)}%` : "–",
      badgeSub: `${fmtInt(total)}${opts?.unit || ""}`,
      pills: sorted.slice(0, 6).map(([k]) => name(k)),
      description: sorted
        .slice(0, 3)
        .map(([k, v]) => `${name(k)} ${Math.round((v / total) * 100)}%`)
        .join(" · "),
    };
  };

  return (
    <>
      <section className="hero hero-solo">
        <div id="reportCard">
          {chart.series.length > 0 && <ReportCard series={chart.series} labels={chart.labels} wide />}
        </div>
      </section>

      <section className="ac-row">
        {stats && (
          <>
            <AnimatedCard
              title={t("tab_type")}
              mainColor="#8b5cf6"
              secondaryColor="#fbbf24"
              onClick={() => navigate("/stats")}
              {...donut(stats.by_type.map((r) => [r.key, r.new]), typeName, { unit: t("unit") })}
            />
            <AnimatedCard
              title={t("tab_chain")}
              mainColor="#ff6900"
              secondaryColor="#f54900"
              onClick={() => navigate("/stats")}
              {...donut(stats.by_chain.map((r) => [r.key, r.new]), (k) => (k === "unknown" ? t("unknown") : k), { unit: t("unit") })}
            />
            <AnimatedCard
              title={t("roles")}
              mainColor="#34d399"
              secondaryColor="#40E5D1"
              onClick={() => navigate("/addresses")}
              {...donut(Object.entries(stats.roles || {}), roleName, {})}
            />
          </>
        )}
      </section>

      <div className="toolbar">
        <div className="search big lumos-search">
          <span className="ico">⌕</span>
          <input
            type="search"
            value={q}
            placeholder={t("search_ph")}
            onChange={(e) => {
              setQ(e.target.value.trim());
              setPage(1);
            }}
          />
        </div>
        <RangeSeg
          value={days}
          onChange={(v) => {
            setDays(v);
            setPage(1);
          }}
        />
      </div>

      <section className="card">
        <div className="table-wrap">
          <IncidentTable rows={list?.items || []} ctl={ctl} facets={list?.facets} />
        </div>
        <Pager page={page} size={size} total={list?.total || 0} onPage={setPage} />
      </section>
    </>
  );
}
