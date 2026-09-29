// 통계: 시계열(기간이 길면 주·월 묶음) + 유형·주소 역할·체인 순위 막대.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtInt, fmtMD, fmtPct, money, moneyFull } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { RangeSeg } from "../components/Controls.jsx";
import { Avatar, ChainIcon, ChainPill, RoleIcon, chainColor } from "../components/Icons.jsx";
import Columns from "../components/Columns.jsx";

const TYPE_HEX = {
  hack_exploit: "#e0521c",
  private_key_compromise: "#8f66f0",
  rug_pull: "#b8800e",
  phishing_social_engineering: "#6aa018",
  scam_fraud: "#d9408a",
  ransomware: "#e83a5a",
  sanctions_designation: "#109e8c",
  law_enforcement_action: "#3f7fe8",
  laundering_report: "#1e9fd8",
  other: "#7a8290",
};
const ROLE_COLOR = {
  sanctioned: "var(--t-sanction)",
  attacker: "var(--up)",
  laundering: "var(--warn)",
  victim: "var(--t-law)",
  unknown: "var(--ink-3)",
};

function Rank({ icon, label, n, pct, right, color, sub, faint, muted, title }) {
  return (
    <div className={`rk ${faint ? "faint-row" : ""} ${muted ? "muted-row" : ""}`} title={title}>
      <div className="rk-h">
        <span className="rk-l">
          {icon}
          <span className="rk-t">{label}</span>
        </span>
        <span className="rk-n">
          <b>{fmtInt(n)}</b>
          <span className="pct">{fmtPct(pct)}</span>
          <span className="amt">{right}</span>
        </span>
      </div>
      <div className="rk-bar">
        <i style={{ width: `${(pct * 100).toFixed(1)}%`, background: color }} />
        {sub > 0 && <i className="sub" style={{ width: `${(sub * 100).toFixed(1)}%` }} />}
      </div>
    </div>
  );
}

export default function Stats() {
  const { t, typeName, typeFull, roleName, fmtDate } = useI18n();
  const [sp] = useSearchParams();
  const [days, setDays] = useState(sp.get("days") || "all");
  const [mode, setMode] = useState("amount");
  const [st, setSt] = useState(null);

  useEffect(() => {
    api("/api/stats", { days }).then(setSt).catch(() => setSt(null));
  }, [days]);

  const buckets = useMemo(() => {
    if (!st) return [];
    const span = st.daily.length;
    const unit = span > 200 ? "month" : span > 60 ? "week" : "day";
    const keyOf = (day) => {
      if (unit === "day") return day;
      if (unit === "month") return day.slice(0, 7);
      const d = new Date(day + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    };
    const agg = new Map();
    st.daily.forEach((d) => {
      const k = keyOf(d.day);
      const a = agg.get(k) || { amount: 0, count: 0 };
      a.amount += d.amount || 0;
      a.count += d.count || 0;
      agg.set(k, a);
    });
    return [...agg.entries()].map(([k, a]) => ({
      label: unit === "month" ? `${k.slice(2, 4)}.${k.slice(5, 7)}` : fmtMD(k),
      v: mode === "amount" ? a.amount : a.count,
      extra: mode === "amount" ? `${a.count}${t("unit")}` : money(a.amount),
      unit,
    }));
  }, [st, mode, t]);

  if (!st) return <div className="card empty">{t("no_data")}</div>;

  const unit = buckets[0]?.unit;
  const types = st.by_type.filter((r) => r.new);
  const tn = types.reduce((a, r) => a + r.new, 0) || 1;
  const chainsAll = st.by_chain
    .filter((r) => r.new)
    .sort((a, b) => (a.key === "unknown") - (b.key === "unknown") || b.new - a.new || b.amount - a.amount);
  const cn = chainsAll.reduce((a, r) => a + r.new, 0) || 1;
  const main = chainsAll.filter((r) => r.new >= 2 && r.key !== "unknown");
  const tail = chainsAll.filter((r) => r.new < 2 && r.key !== "unknown");
  const unk = chainsAll.find((r) => r.key === "unknown");
  const roles = Object.entries(st.roles || {}).sort((a, b) => b[1] - a[1]);
  const rt = roles.reduce((a, r) => a + r[1], 0) || 1;
  const amtOf = (r) => (r.known ? <span title={moneyFull(r.amount)}>{money(r.amount)}</span> : <span className="faint">–</span>);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{t("nav_stats")}</h1>
          <div className="sub">
            <span>
              {fmtDate(st.range.from)} – {fmtDate(st.range.to)}
            </span>
            <span className="m">
              {t("new_label")} {fmtInt(st.new_count)}
              {t("unit")}
            </span>
            <span className="m">
              {t("follow")} {fmtInt(st.followup_count)}
            </span>
            <span className="m" title={moneyFull(st.total_amount)}>
              {money(st.total_amount)}
            </span>
          </div>
        </div>
        <RangeSeg value={days} onChange={setDays} />
      </div>

      <section className="grid">
        <div className="card c12">
          <div className="card-h">
            <h2>
              {mode === "amount" ? t("daily_amount") : t("daily_count")}
              {unit === "month" ? ` · ${t("per_month")}` : unit === "week" ? ` · ${t("per_week")}` : ""}
            </h2>
            <div className="seg">
              <button type="button" className={mode === "amount" ? "on" : ""} onClick={() => setMode("amount")}>
                {t("mode_amount")}
              </button>
              <button type="button" className={mode === "count" ? "on" : ""} onClick={() => setMode("count")}>
                {t("mode_count")}
              </button>
            </div>
          </div>
          <div className="card-b plot">
            <Columns buckets={buckets} fmt={mode === "amount" ? money : (v) => String(Math.round(v))} height={240} />
          </div>
        </div>
      </section>

      <section className="grid start">
        <div className="card c6">
          <div className="card-h">
            <h2>{t("tab_type")}</h2>
            <span className="meta">{types.length}</span>
          </div>
          <div className="card-b rank">
            {types.map((r) => (
              <Rank
                key={r.key}
                icon={<Avatar type={r.key} size="sm" />}
                label={typeName(r.key)}
                title={typeFull(r.key)}
                n={r.new}
                pct={r.new / tn}
                right={amtOf(r)}
                color={TYPE_HEX[r.key] || "#7a8290"}
              />
            ))}
          </div>
        </div>

        <div className="card c6">
          <div className="card-h">
            <h2>{t("roles")}</h2>
            <span className="meta">
              {fmtInt(st.addresses)} {t("addresses")}
            </span>
          </div>
          <div className="card-b rank">
            {roles.map(([k, v]) => (
              <Rank
                key={k}
                icon={
                  <span className={`rk-ri ${k}`}>
                    <RoleIcon role={k} size={14} />
                  </span>
                }
                label={roleName(k)}
                n={v}
                pct={v / rt}
                sub={(st.roles_bl?.[k] || 0) / rt}
                right={st.roles_bl?.[k] ? <span className="bl">BL {fmtInt(st.roles_bl[k])}</span> : ""}
                color={ROLE_COLOR[k] || "var(--chart)"}
                faint={k === "unknown"}
              />
            ))}
          </div>
        </div>

        <div className="card c12">
          <div className="card-h">
            <h2>{t("tab_chain")}</h2>
            <span className="meta">{chainsAll.filter((r) => r.key !== "unknown").length}</span>
          </div>
          <div className="card-b chain-split">
            <div className="rank">
              {main.map((r) => (
                <Rank
                  key={r.key}
                  icon={<ChainIcon name={r.key} />}
                  label={r.key}
                  n={r.new}
                  pct={r.new / cn}
                  right={amtOf(r)}
                  color={chainColor(r.key)}
                />
              ))}
              {tail.length > 0 && (
                <Rank
                  icon={
                    <span className="rk-ci multi">
                      {tail.slice(0, 3).map((r) => (
                        <ChainIcon key={r.key} name={r.key} size={14} />
                      ))}
                    </span>
                  }
                  label={String(t("chains_single")).replace("{n}", tail.length)}
                  n={tail.reduce((a, r) => a + r.new, 0)}
                  pct={tail.reduce((a, r) => a + r.new, 0) / cn}
                  right={amtOf({ known: tail.some((r) => r.known), amount: tail.reduce((a, r) => a + r.amount, 0) })}
                  color="var(--ink-3)"
                  muted
                />
              )}
              {unk && (
                <Rank
                  icon={<ChainIcon name={t("unknown")} />}
                  label={t("unknown")}
                  title={t("tip_chain_unknown")}
                  n={unk.new}
                  pct={unk.new / cn}
                  right={amtOf(unk)}
                  color="var(--ink-3)"
                  faint
                />
              )}
            </div>
            {tail.length > 0 && (
              <div className="tail">
                <div className="tail-h">{String(t("chains_single")).replace("{n}", tail.length)}</div>
                <div className="chips-grid">
                  {tail.map((r) => (
                    <div className="chip2" key={r.key} title={`${r.key} · ${r.new}${t("unit")}`}>
                      <ChainIcon name={r.key} />
                      <span className="cn">{r.key}</span>
                      <span className="ca">{r.known ? money(r.amount) : "–"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
