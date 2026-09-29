// 브리핑 아카이브: 날짜 카드(피해액 막대) + 그날 브리핑 + 당일 사건 표.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtInt, mdToHtml, money, moneyFull } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import IncidentTable from "../components/IncidentTable.jsx";

export default function Briefings() {
  const { t, lang, fmtDate } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [days, setDays] = useState([]);
  const [cur, setCur] = useState(null);
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [filters, setFilters] = useState({ type: "", chain: "" });

  useEffect(() => {
    api("/api/briefings")
      .then((list) => {
        setDays(list);
        const want = sp.get("day");
        const day = want && list.some((d) => d.day === want) ? want : list[0]?.day;
        if (day) return api(`/api/briefings/${day}`).then(setCur);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = (day) => {
    setSp({ day }, { replace: true });
    api(`/api/briefings/${day}`).then(setCur);
  };

  const totN = days.reduce((a, b) => a + (b.new || b.relevant || 0), 0);
  const totA = days.reduce((a, b) => a + (b.amount_usd || 0), 0);
  const mxA = Math.max(...days.map((b) => b.amount_usd || 0), 1);

  const rows = (cur?.incidents || []).filter(
    (r) => (!filters.type || r.type === filters.type) && (!filters.chain || (r.chains || []).includes(filters.chain)),
  );
  const facets = {
    types: rows.reduce((m, r) => ({ ...m, [r.type]: (m[r.type] || 0) + 1 }), {}),
    chains: (cur?.incidents || []).reduce((m, r) => {
      (r.chains || []).forEach((c) => (m[c] = (m[c] || 0) + 1));
      return m;
    }, {}),
  };
  const ctl = { sort, filters, onSort: (key, dir) => setSort({ key, dir }), onFilter: (key, v) => setFilters((f) => ({ ...f, [key]: v })) };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{t("nav_briefings")}</h1>
          <div className="sub">
            <span className="m">{String(t("collected_days")).replace("{n}", days.length)}</span>
            <span className="m">
              {t("new_label")} {fmtInt(totN)}
              {t("unit")}
            </span>
            <span className="m" title={moneyFull(totA)}>
              {String(t("total_amount")).replace("{v}", money(totA))}
            </span>
          </div>
        </div>
      </div>

      <section className="grid start">
        <div className="card c4">
          <div className="card-h">
            <h2>{t("date")}</h2>
            <span className="meta">{days.length}</span>
          </div>
          <ul className="day-list">
            {days.map((b) => (
              <li key={b.day} className={cur?.day === b.day ? "on" : ""} onClick={() => show(b.day)}>
                <div className="dl-top">
                  <b>{fmtDate(b.day)}</b>
                  <span className="dl-amt">{money(b.amount_usd)}</span>
                </div>
                <div className="dl-bar">
                  <i style={{ width: `${(((b.amount_usd || 0) / mxA) * 100).toFixed(1)}%` }} />
                </div>
                <div className="dl-sub">
                  <span>
                    {t("new_label")} {fmtInt(b.new ?? b.relevant ?? 0)}
                  </span>
                  {b.followups > 0 && (
                    <span>
                      {t("follow")} {fmtInt(b.followups)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card c8">
          <div className="card-h">
            <h2>{cur ? `${t("briefing")} · ${fmtDate(cur.day)}` : t("briefing")}</h2>
          </div>
          {cur && (
            <div className="card-b">
              <h3 className="brief-h">{cur[`headline_${lang}`] || cur.headline_ko}</h3>
              <ul className="brief" dangerouslySetInnerHTML={{ __html: mdToHtml(cur[`briefing_${lang}`] || cur.briefing_ko) }} />
            </div>
          )}
        </div>
      </section>

      {cur && (
        <section className="card">
          <div className="card-h">
            <h2>{t("day_incidents")}</h2>
            <span className="meta">
              {rows.length}
              {t("unit")}
            </span>
          </div>
          <div className="card-b flush table-wrap">
            <IncidentTable rows={rows} ctl={ctl} facets={facets} />
          </div>
        </section>
      )}
    </>
  );
}
