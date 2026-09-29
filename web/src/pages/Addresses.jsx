// 지갑 주소: 역할 타일 + 주소 조회 + 수집 주소 표(주소 축약, 머리글 정렬·필터).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { explorer, fmtInt, shortAddr, stripAddr } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { Pager, RangeSeg, ThFilter, ThSort, useChainOptions, useRoleOptions } from "../components/Controls.jsx";
import { Avatar, ChainPill, RoleBadge, RoleIcon } from "../components/Icons.jsx";
import { Tip } from "../components/Tooltip.jsx";

const ROLES = ["sanctioned", "attacker", "laundering", "victim", "unknown"];

function AddrCell({ a }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const url = explorer(a.chain, a.address);
  const short = shortAddr(a.address);
  return (
    <>
      <Tip text={a.address}>
        <span className="addr short">
          {url ? (
            <a href={url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
              {short}
            </a>
          ) : (
            short
          )}
        </span>
      </Tip>
      <button
        className="copy"
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(a.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* 클립보드 권한 없음 */
          }
        }}
      >
        {copied ? t("copied") : t("copy")}
      </button>
      {a.blacklist && (
        <span className="tag warn" title={t("legend_bl")}>
          BL
        </span>
      )}
    </>
  );
}

export default function Addresses() {
  const { t, roleName, kindName } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [days, setDays] = useState("30");
  const [role, setRole] = useState("");
  const [filters, setFilters] = useState({ chain: "", kind: "" });
  const [sort, setSort] = useState({ key: "", dir: "" });
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [q, setQ] = useState(sp.get("q") || "");
  const [res, setRes] = useState(null);
  const size = 50;

  useEffect(() => {
    api("/api/addresses", { days, role, chain: filters.chain, kind: filters.kind, sort: sort.key, dir: sort.dir, page, size })
      .then(setList)
      .catch(() => setList({ items: [], total: 0, roles: {}, chains: {}, kinds: {} }));
  }, [days, role, filters.chain, filters.kind, sort.key, sort.dir, page]);

  const lookup = async (value) => {
    const v = value.trim();
    setQ(v);
    if (v.length < 6) {
      setRes(null);
      return;
    }
    setSp({ q: v }, { replace: true });
    try {
      setRes(await api("/api/addresses/lookup", { q: v }));
    } catch {
      setRes({ found: false, query: v, matches: [], sdn: [] });
    }
  };

  const chainOptions = useChainOptions(list?.chains);
  const roleOptions = useRoleOptions(list?.roles);
  const kindOptions = Object.entries(list?.kinds || {}).map(([value, n]) => ({ value, n, label: kindName({ kind: value }) || value }));
  const ctl = {
    sort,
    filters: { ...filters, role },
    onSort: (key, dir) => {
      setSort({ key, dir });
      setPage(1);
    },
    onFilter: (key, v) => {
      if (key === "role") setRole(v);
      else setFilters((f) => ({ ...f, [key]: v }));
      setPage(1);
    },
  };
  const total = Object.values(list?.roles || {}).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{t("nav_addresses")}</h1>
        </div>
        <div className="controls">
          <form className="search" style={{ minWidth: 320 }} onSubmit={(e) => e.preventDefault()}>
            <input type="search" value={q} placeholder={t("addr_ph")} onChange={(e) => lookup(e.target.value)} />
          </form>
          <RangeSeg
            value={days}
            onChange={(v) => {
              setDays(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      <section className="rtiles">
        {[["", total], ...ROLES.map((r) => [r, list?.roles?.[r] || 0])].map(([r, n]) => (
          <button
            key={r || "all"}
            type="button"
            className={`rtile ${r || "all"} ${role === r ? "on" : ""}`}
            onClick={() => {
              setRole(r);
              setPage(1);
            }}
          >
            <span className="ic">{r ? <RoleIcon role={r} size={18} /> : null}</span>
            <b>{fmtInt(n)}</b>
            <span className="l">{r ? roleName(r) : t("role_all")}</span>
          </button>
        ))}
      </section>

      {res && (
        <section className="card">
          <div className="card-h">
            <h2>{t("lookup_title")}</h2>
            <span className="meta">{res.matches.length}</span>
          </div>
          <div className="card-b flush table-wrap">
            {res.matches.length === 0 ? (
              <div className="empty">{t("addr_none")}</div>
            ) : (
              <table className="tbl lumos-tbl">
                <tbody>
                  {res.matches.slice(0, 30).map((m, i) => (
                    <tr key={i}>
                      <td className="nowrap">
                        <ChainPill chain={m.chain} />
                      </td>
                      <td>
                        <AddrCell a={{ ...m, blacklist: false }} />
                      </td>
                      <td className="nowrap">
                        <RoleBadge role={m.role} />
                      </td>
                      <td className="nowrap">
                        <Avatar type={m.incident.type} size="sm" />
                        {m.incident.project}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <h2>{t("all_addresses")}</h2>
          <span className="meta">{fmtInt(list?.total || 0)}</span>
        </div>
        <div className="table-wrap">
          <table className="tbl lumos-tbl" id="addrTable">
            <colgroup>
              <col className="a-addr" />
              <col className="a-chain" />
              <col className="a-kind" />
              <col className="a-label" />
              <col className="a-role" />
              <col className="a-inc" />
              <col className="a-tx" />
            </colgroup>
            <thead>
              <tr>
                <ThSort col="address" label={t("th_address")} tip={t("th_address_tip")} ctl={ctl} />
                <ThFilter col="chain" label={t("chain")} tip={t("tip_chain")} ctl={ctl} options={chainOptions} />
                <ThFilter col="kind" label={t("th_kind")} tip={t("th_kind_tip")} ctl={ctl} options={kindOptions} />
                <ThSort col="label" label={t("th_label")} tip={t("th_label_tip")} ctl={ctl} />
                <ThFilter col="role" label={t("addr_role")} tip={t("th_role_tip")} ctl={ctl} options={roleOptions} />
                <ThSort col="incident" label={t("th_incident")} tip={t("tip_incident")} ctl={ctl} />
                <ThSort col="tx" label={t("th_tx")} tip={t("th_tx_tip")} ctl={ctl} className="num" />
              </tr>
            </thead>
            <tbody>
              {(list?.items || []).map((a) => {
                const inc = a.incidents[0] || {};
                return (
                  <tr key={a.address} title={stripAddr(a.note)}>
                    <td className="nowrap">
                      <AddrCell a={a} />
                    </td>
                    <td className="nowrap">
                      <ChainPill chain={a.chain} />
                    </td>
                    <td className="nowrap">{kindName(a) || <span className="faint">–</span>}</td>
                    <td>{a.label || <span className="faint">–</span>}</td>
                    <td className="nowrap">
                      <RoleBadge role={a.role} />
                    </td>
                    <td className="nowrap">
                      <Avatar type={inc.type} size="sm" />
                      <a className="name" href={`#/incident/${inc.uid}`}>
                        {inc.project}
                      </a>
                      {a.incidents.length > 1 && <span className="faint small"> +{a.incidents.length - 1}</span>}
                    </td>
                    <td className="num">{a.tx_count != null ? fmtInt(a.tx_count) : <span className="faint">–</span>}</td>
                  </tr>
                );
              })}
              {!list?.items?.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    {t("no_data")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={page} size={size} total={list?.total || 0} onPage={setPage} />
      </section>
    </>
  );
}
