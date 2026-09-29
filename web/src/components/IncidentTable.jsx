// 사건 표: 사건 · 금액(등급 칩) · 사건일 · 유형 · 체인 · 출처 게이지. 머리글에서 정렬·필터.
import { useNavigate } from "react-router-dom";
import { fmtInt, money, moneyFull } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { Avatar, ChainPills, TypeBadge } from "./Icons.jsx";
import { ThFilter, ThSort, useChainOptions, useTypeOptions } from "./Controls.jsx";
import { Tip } from "./Tooltip.jsx";

const TIERS = [
  ["S", 1e8],
  ["A", 1e7],
  ["B", 1e6],
  ["C", 1e5],
  ["D", 0],
];
export const tierOf = (amount) => {
  if (amount == null || !(amount > 0)) return "";
  for (const [k, min] of TIERS) if (amount >= min) return k;
  return "D";
};
const TIER_TIP = {
  S: "S · $100M 이상",
  A: "A · $10M 이상",
  B: "B · $1M 이상",
  C: "C · $100K 이상",
  D: "D · $100K 미만",
};

export function TierChip({ amount }) {
  const k = tierOf(amount);
  if (!k) return null;
  return (
    <span className={`tier t-${k}`} title={`${TIER_TIP[k]} (${money(amount)})`}>
      {k}
    </span>
  );
}

const GAUGE_L = 86.39;
export function SourceGauge({ n }) {
  const { t } = useI18n();
  const score = Math.min(1, (n || 0) / 4);
  const col = score >= 1 ? "#34d399" : score >= 0.75 ? "#ffd74b" : score >= 0.5 ? "#ff9f43" : "#fa5b72";
  return (
    <span className="gauge" title={String(t("src_gauge_tip")).replace("{n}", n || 0)}>
      <svg viewBox="0 0 60 35" width="52" height="30">
        <path d="M2.5 30 A27.5 27.5 0 0 1 57.5 30" className="g-muted" />
        <path
          d="M2.5 30 A27.5 27.5 0 0 1 57.5 30"
          className="g-val"
          style={{ stroke: col }}
          strokeDasharray={GAUGE_L}
          strokeDashoffset={(GAUGE_L * (1 - score)).toFixed(2)}
        />
      </svg>
      <b>{n || 0}</b>
    </span>
  );
}

export function AmountCell({ row }) {
  const { t } = useI18n();
  if (row.amount_usd == null)
    return (
      <span className="faint" title={row.amount_text || ""}>
        {t("unknown")}
      </span>
    );
  return (
    <span className="amtwrap">
      <TierChip amount={row.amount_usd} />
      <span className="amt" title={moneyFull(row.amount_usd)}>
        <span className="cur">$</span>
        {fmtInt(row.amount_usd)}
      </span>
    </span>
  );
}

function Badges({ row }) {
  const { t } = useI18n();
  const f = (row.followups || []).length;
  return (
    <>
      {row.followup_of && (
        <span className="tag" title={`${t("legend_follow")} · ${row.followup_of.day || ""}`}>
          {t("follow")}
        </span>
      )}
      {f > 0 && (
        <span className="tag" title={String(t("follow_reports")).replace("{n}", f)}>
          {String(t("follow_n")).replace("{n}", f)}
        </span>
      )}
      {row.blacklist_hits > 0 && (
        <span className="tag warn" title={t("legend_bl")}>
          BL {row.blacklist_hits}
        </span>
      )}
    </>
  );
}

export default function IncidentTable({ rows, ctl, facets, onOpen }) {
  const { t, fmtDate } = useI18n();
  const navigate = useNavigate();
  const typeOptions = useTypeOptions(facets?.types);
  const chainOptions = useChainOptions(facets?.chains);
  const open = (row) => (onOpen ? onOpen(row) : navigate(`/incident/${row.uid}`));

  return (
    <table className="tbl lumos-tbl">
      <colgroup>
        <col className="c-name" />
        <col className="c-amt" />
        <col className="c-date" />
        <col className="c-type" />
        <col className="c-chain" />
        <col className="c-src" />
      </colgroup>
      <thead>
        <tr>
          <ThSort col="name" label={t("th_incident")} tip={t("tip_incident")} ctl={ctl} />
          <ThSort col="amount" label={t("th_amount")} tip={t("tip_amount")} ctl={ctl} className="num" />
          <ThSort col="date" label={t("th_date")} tip={t("tip_date")} ctl={ctl} />
          <ThFilter col="type" label={t("th_type")} tip={t("tip_type")} ctl={ctl} options={typeOptions} />
          <ThFilter col="chain" label={t("th_chain")} tip={t("tip_chain")} ctl={ctl} options={chainOptions} />
          <ThSort col="sources" label={t("th_sources")} tip={t("tip_sources")} ctl={ctl} className="center" />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={6} className="empty">
              {t("no_data")}
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const tk = tierOf(r.amount_usd);
          return (
            <tr key={r.uid} className={`link ${tk ? "row-" + tk : ""}`} onClick={() => open(r)}>
              <td className="nowrap">
                <Avatar type={r.type} />
                <a
                  className="name"
                  href={`#/incident/${r.uid}`}
                  onClick={(e) => {
                    e.preventDefault();
                    open(r);
                  }}
                >
                  {r.project}
                </a>
                <Badges row={r} />
              </td>
              <td className="num">
                <AmountCell row={r} />
              </td>
              <td className="date" title={`${t("th_report")} ${fmtDate(r.day)}`}>
                {fmtDate(r.event_date || r.incident_date || r.day)}
              </td>
              <td className="nowrap">
                <TypeBadge type={r.type} />
              </td>
              <td>
                <ChainPills chains={r.chains} />
              </td>
              <td className="center">
                <Tip text="">
                  <SourceGauge n={r.src_count || (r.sources || []).length} />
                </Tip>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
