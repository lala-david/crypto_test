// 사건 케이스(LUMOS 스타일): 큰 금액 → 핵심 값 → 요약 → 경과 → 자금 흐름 → 출처.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { explorer, fmtInt, moneyFull, shortAddr, txExplorer } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { Avatar, ChainPill, RoleBadge, TypeBadge } from "../components/Icons.jsx";
import { TierChip } from "../components/IncidentTable.jsx";

export default function IncidentDetail() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { t, txt, fmtDate, srcLabel, kindName } = useI18n();
  const [inc, setInc] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setInc(null);
    setErr("");
    api(`/api/incidents/${uid}`)
      .then(setInc)
      .catch(() => setErr(t("not_found")));
  }, [uid, t]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && navigate(-1);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (err) return <div className="card empty">{err}</div>;
  if (!inc) return <div className="card empty">…</div>;

  const amountLabel = ["law_enforcement_action", "sanctions_designation"].includes(inc.type) ? t("k_legal") : t("loss_label");
  const addresses = inc.addresses || [];
  const eoa = addresses.filter((a) => a.kind === "eoa").length;
  const ca = addresses.filter((a) => a.kind === "contract").length;

  return (
    <div className="case" data-uid={inc.uid}>
      <div className="case-h">
        <div className="case-id">
          <Avatar type={inc.type} size="lg" />
          <div className="min0">
            <div className="case-name">{inc.project}</div>
            <div className="case-sub">
              <TierChip amount={inc.amount_usd} />
              <TypeBadge type={inc.type} />
              {(inc.chains || []).map((c, i) => (
                <ChainPill key={`${c}-${i}`} chain={c} />
              ))}
            </div>
          </div>
        </div>
        <div className="case-actions">
          <a className="btn" href={inc.url} target="_blank" rel="noopener">
            {t("open_page")}
          </a>
          <Link className="btn primary" to="/incidents">
            {t("back")}
          </Link>
        </div>
      </div>

      <div className="case-amt">
        <div>
          <div className="l">{amountLabel}</div>
          <div className="v">
            {inc.amount_usd != null ? (
              <>
                <span className="cur">$</span>
                {fmtInt(inc.amount_usd)}
              </>
            ) : (
              <span className="faint" style={{ fontSize: 18 }}>
                {t("amount_unknown")}
              </span>
            )}
          </div>
          {inc.amount_text && inc.amount_text.length <= 40 && <div className="s">{inc.amount_text}</div>}
        </div>
        <div className="case-mini">
          <div>
            <div className="l">{t("addresses")}</div>
            <div className="v">{fmtInt(addresses.length)}</div>
          </div>
          <div>
            <div className="l">{t("blacklist")}</div>
            <div className={`v ${inc.blacklist_hits ? "up" : ""}`}>{fmtInt(inc.blacklist_hits || 0)}</div>
          </div>
        </div>
      </div>

      <div className="case-kv">
        <div>
          <span className="k">{t("incident_date")}</span>
          <span className="val">{fmtDate(inc.incident_date)}</span>
        </div>
        <div>
          <span className="k">{t("case_code")}</span>
          <span className="val">
            <span className="code">{String(inc.uid).slice(0, 8).toUpperCase()}</span>
          </span>
        </div>
        <div>
          <span className="k">{t("report_date")}</span>
          <span className="val">{fmtDate(inc.day)}</span>
        </div>
        <div>
          <span className="k">{t("chain")}</span>
          <span className="val wrap">
            {(inc.chains || []).length ? (inc.chains || []).map((c, i) => <ChainPill key={i} chain={c} withName />) : "–"}
          </span>
        </div>
      </div>

      {txt(inc, "summary") && (
        <section className="case-sec">
          <h3>{t("summary")}</h3>
          <p className="prose">{txt(inc, "summary")}</p>
        </section>
      )}

      {txt(inc, "attack_method") && (
        <section className="case-sec">
          <h3>{t("method_short")}</h3>
          <p className="prose">{txt(inc, "attack_method")}</p>
        </section>
      )}

      {addresses.length > 0 && (
        <section className="case-sec">
          <h3>
            {t("flow")}
            <span className="meta">
              EOA {eoa} · CA {ca}
              {(inc.tx_hashes || []).length ? ` · TX ${inc.tx_hashes.length}` : ""}
            </span>
          </h3>
          <div className="case-flow">
            <table className="tbl case-tbl">
              <thead>
                <tr>
                  <th>{t("th_addr_tx")}</th>
                  <th>{t("th_kind")}</th>
                  <th>{t("addr_role")}</th>
                  <th className="num">{t("th_link")}</th>
                </tr>
              </thead>
              <tbody>
                {addresses.slice(0, 40).map((a, i) => (
                  <tr key={i}>
                    <td className="addr">
                      <span className="mono" title={a.address}>
                        {shortAddr(a.address)}
                      </span>
                    </td>
                    <td className="nowrap">{kindName(a) || <span className="faint">–</span>}</td>
                    <td className="nowrap">
                      <RoleBadge role={a.role} />
                    </td>
                    <td className="num">
                      {explorer(a.chain, a.address) ? (
                        <a className="go" href={explorer(a.chain, a.address)} target="_blank" rel="noopener">
                          ↗
                        </a>
                      ) : (
                        <span className="faint">–</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(inc.tx_hashes || []).slice(0, 10).map((h) => (
                  <tr key={h}>
                    <td className="addr">
                      <span className="mono" title={h}>
                        {shortAddr(h)}
                      </span>
                    </td>
                    <td className="nowrap">TX</td>
                    <td />
                    <td className="num">
                      <a className="go" href={txExplorer((inc.chains || [])[0], h)} target="_blank" rel="noopener">
                        ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="case-sec">
        <h3>
          {t("sources")}
          <span className="meta">{(inc.sources || []).length}</span>
        </h3>
        <div className="case-rows">
          {(inc.sources || []).map((s, i) => (
            <a className="case-row" key={i} href={s.url} target="_blank" rel="noopener">
              <span className="who">{srcLabel(s.source)}</span>
              <span className="what">{s.title}</span>
              <span className="go">↗</span>
            </a>
          ))}
        </div>
      </section>

      {inc.amount_usd != null && (
        <div className="case-foot faint small" title={moneyFull(inc.amount_usd)}>
          {t("tip_amount")}
        </div>
      )}
    </div>
  );
}
