// 상단 바(로고·탭·자원 카운터·테마/언어)와 페이지 틀.
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api, isStatic } from "../lib/api.js";
import { fmtInt, money } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { Tip } from "./Tooltip.jsx";

const RES_ICONS = {
  crystal: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 2l5 6-2 12H9L7 8z" />
      <path d="M7 8h10M12 2v18" />
    </svg>
  ),
  gas: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  ),
  supply: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z" />
      <path d="M12 7.5l4 2.3v4.4l-4 2.3-4-2.3V9.8z" />
    </svg>
  ),
};

function CountUp({ to, fmt = fmtInt, ms = 900 }) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      setV((1 - Math.pow(1 - p, 3)) * (to || 0));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [to, ms]);
  return <b>{fmt(v)}</b>;
}

function ResourceBar() {
  const { t } = useI18n();
  const [s, setS] = useState(null);
  useEffect(() => {
    api("/api/stats", { days: "all" }).then(setS).catch(() => {});
  }, []);
  if (!s) return <span className="resbar" />;
  return (
    <span className="resbar">
      <Tip text={t("tip_res_new")}>
        <span className="res r-crystal">
          {RES_ICONS.crystal}
          <span className="rl">{t("res_new")}</span>
          <CountUp to={s.new_count} />
        </span>
      </Tip>
      <Tip text={t("tip_res_loss")}>
        <span className="res r-gas">
          {RES_ICONS.gas}
          <span className="rl">{t("res_loss")}</span>
          <CountUp to={s.loss_amount} fmt={money} />
        </span>
      </Tip>
      <Tip text={t("tip_res_addr")}>
        <span className="res r-supply">
          {RES_ICONS.supply}
          <span className="rl">{t("res_addr")}</span>
          <CountUp to={s.addresses} />
        </span>
      </Tip>
    </span>
  );
}

const TABS = [
  ["/", "nav_home"],
  ["/incidents", "nav_incidents"],
  ["/stats", "nav_stats"],
  ["/briefings", "nav_briefings"],
  ["/addresses", "nav_addresses"],
];

export default function Layout() {
  const { t, lang, toggleLang, toggleTheme } = useI18n();
  return (
    <>
      <header className="nav">
        <NavLink className="brand" to="/">
          <img className="mark" src="./logo.svg" alt="" width="22" height="22" />
          <span>Incident Ledger</span>
        </NavLink>
        <nav className="tabs">
          {TABS.map(([to, key]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `tab ${isActive ? "on" : ""}`}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="nav-r">
          <ResourceBar />
          {isStatic() && (
            <Tip text={t("static_tip")}>
              <span className="tag">SNAPSHOT</span>
            </Tip>
          )}
          <button className="ibtn" type="button" onClick={toggleTheme} aria-label="theme">
            ◐
          </button>
          <button className="ibtn" type="button" onClick={toggleLang} aria-label="language">
            {lang === "ko" ? "EN" : "KO"}
          </button>
        </div>
      </header>
      <main className="page lumos">
        <Outlet />
      </main>
    </>
  );
}
