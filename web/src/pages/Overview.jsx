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

const fmtLabel = (key, unit) => {
  if (unit === "month") return `${key.slice(2, 4)}.${key.slice(5, 7)}`;
  return `${key.slice(5, 7)}.${key.slice(8, 10)}`;
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
  const [chartRange, setChartRange] = useState("all");
  const [ts, setTs] = useState(null);
  const size = 20;

  useEffect(() => {
    const p = { days, q, type: filters.type, chain: filters.chain };
    api("/api/incidents", { ...p, page, size, sort: sort.key, dir: sort.dir }).then(setList).catch(() => setList({ items: [], total: 0 }));
  }, [days, q, filters.type, filters.chain, page, sort.key, sort.dir]);

  useEffect(() => {
    api("/api/stats", { days, type: filters.type, chain: filters.chain }).then(setStats).catch(() => {});
  }, [days, filters.type, filters.chain]);

  // 차트는 표와 따로 기간을 고른다(전체 · 1년 · 한달)
  useEffect(() => {
    api("/api/timeseries", { days: chartRange, type: filters.type, chain: filters.chain, top: 3 })
      .then(setTs)
      .catch(() => setTs(null));
  }, [chartRange, filters.type, filters.chain]);

  const chart = useMemo(() => {
    if (!ts || !ts.labels?.length) return { series: [], labels: [] };
    return {
      labels: ts.labels.map((k) => fmtLabel(k, ts.unit)),
      series: (ts.series || []).map((s, i) => ({
        key: typeName(s.key),
        color: ["#8c61ff", "#a78bfa", "#e9d5ff"][i] || "#c4b5fd",
        values: s.values,
      })),
    };
  }, [ts, typeName]);

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
          {chart.series.length > 0 && (
            <ReportCard
              series={chart.series}
              labels={chart.labels}
              wide
              range={chartRange}
              onRange={setChartRange}
              ranges={[
                { value: "all", label: t("chart_all") },
                { value: "365", label: t("chart_1y") },
                { value: "30", label: t("chart_1m") },
              ]}
            />
          )}
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
