// 사건 목록: 검색·기간·후속 제외 + 머리글 정렬/필터 + 페이지.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtInt, money, moneyFull } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import IncidentTable from "../components/IncidentTable.jsx";
import { Pager, RangeSeg } from "../components/Controls.jsx";

export default function Incidents() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [days, setDays] = useState(sp.get("days") || "all");
  const [q, setQ] = useState(sp.get("q") || "");
  const [hide, setHide] = useState(false);
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [filters, setFilters] = useState({ type: sp.get("type") || "", chain: sp.get("chain") || "" });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [facets, setFacets] = useState(null);
  const size = 25;

  useEffect(() => {
    api("/api/incidents", {
      days,
      q,
      type: filters.type,
      chain: filters.chain,
      hide_followups: hide ? 1 : 0,
      page,
      size,
      sort: sort.key,
      dir: sort.dir,
      basis: sort.key === "day" ? "collected" : "event",
    })
      .then((r) => {
        setRes(r);
        if (!facets || (!filters.type && !filters.chain && !q)) setFacets(r.facets);
      })
      .catch(() => setRes({ items: [], total: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, q, filters.type, filters.chain, hide, page, sort.key, sort.dir]);

  useEffect(() => {
    const next = {};
    if (days !== "all") next.days = days;
    if (q) next.q = q;
    if (filters.type) next.type = filters.type;
    if (filters.chain) next.chain = filters.chain;
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, q, filters.type, filters.chain]);

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

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{t("nav_incidents")}</h1>
          <div className="sub">
            {res && (
              <>
                <span className="m">{String(t("page_total")).replace("{n}", fmtInt(res.total))}</span>
                {res.followup_total > 0 && (
                  <span className="m">{String(t("follow_n")).replace("{n}", fmtInt(res.followup_total))}</span>
                )}
                <span className="m" title={moneyFull(res.amount_total)}>
                  {String(t("total_amount")).replace("{v}", money(res.amount_total))}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="controls">
          <div className="search">
            <input
              type="search"
              value={q}
              placeholder={t("search_ph")}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <label className="chk">
            <input
              type="checkbox"
              checked={hide}
              onChange={(e) => {
                setHide(e.target.checked);
                setPage(1);
              }}
            />
            <span>{t("hide_follow")}</span>
          </label>
          <RangeSeg
            value={days}
            onChange={(v) => {
              setDays(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <IncidentTable rows={res?.items || []} ctl={ctl} facets={facets || res?.facets} />
        </div>
        <Pager page={page} size={size} total={res?.total || 0} onPage={setPage} />
      </section>
    </>
  );
}
