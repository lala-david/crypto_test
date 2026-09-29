// 기간 세그먼트, 페이저, 표 머리글 정렬·필터 메뉴.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fmtInt } from "../lib/format.js";
import { useI18n } from "../lib/i18n.jsx";
import { ChainIcon, TypeIcon, RoleIcon, TYPE_COLOR } from "./Icons.jsx";

export function RangeSeg({ value, onChange }) {
  const { t } = useI18n();
  const dn = (n) => String(t("days_n")).replace("{n}", n);
  const opts = [
    ["7", dn(7)],
    ["30", dn(30)],
    ["90", dn(90)],
    ["all", t("all")],
  ];
  return (
    <div className="seg">
      {opts.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Pager({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pager">
      <span>
        {total ? (page - 1) * size + 1 : 0}–{Math.min(total, page * size)} / {fmtInt(total)}
      </span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="prev">
        ‹
      </button>
      <span>
        {page}/{pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="next">
        ›
      </button>
    </div>
  );
}

function Menu({ anchor, options, current, onPick, onClose }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ left: -9999, top: -9999 });

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const w = ref.current?.offsetWidth || 200;
    setPos({
      left: Math.min(Math.max(8, r.left), window.innerWidth - w - 8) + window.scrollX,
      top: r.bottom + 4 + window.scrollY,
    });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !anchor.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const many = options.length > 8;
  const shown = q ? options.filter((o) => (o.label + o.value).toLowerCase().includes(q.toLowerCase())) : options;

  return createPortal(
    <div className="hmenu" ref={ref} style={{ left: pos.left, top: pos.top }}>
      {many && (
        <input className="hm-q" type="search" autoFocus placeholder={t("filter_search")} value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="hm-list">
        <button type="button" className={`opt ${current ? "" : "on"}`} onClick={() => onPick("")}>
          <span className="ol">{t("filter_all")}</span>
        </button>
        {shown.map((o) => (
          <button key={o.value} type="button" className={`opt ${o.value === current ? "on" : ""}`} onClick={() => onPick(o.value)}>
            <span className="ol">
              {o.icon}
              {o.label}
            </span>
            {o.n != null && <span className="on">{fmtInt(o.n)}</span>}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** 정렬 가능한 머리글 */
export function ThSort({ col, label, tip, ctl, className = "" }) {
  const { t } = useI18n();
  const on = ctl.sort?.key === col;
  const dir = on ? ctl.sort.dir : "";
  const DESC_FIRST = ["amount", "date", "day", "sources", "tx"];
  return (
    <th
      className={`th-sort ${className} ${on ? "on" : ""}`}
      title={`${tip ? tip + " · " : ""}${t("th_sort_tip")}`}
      onClick={() => {
        const next = on ? (dir === "desc" ? "asc" : "desc") : DESC_FIRST.includes(col) ? "desc" : "asc";
        ctl.onSort(col, next);
      }}
    >
      <span className="th-l">{label}</span>
      <span className="th-ic">{dir === "asc" ? "↑" : dir === "desc" ? "↓" : "↕"}</span>
    </th>
  );
}

/** 필터 메뉴가 달린 머리글 */
export function ThFilter({ col, label, tip, ctl, options, className = "" }) {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState(null);
  const value = ctl.filters?.[col] || "";
  const opt = options.find((o) => o.value === value);
  return (
    <th
      className={`th-filter ${className} ${value ? "on" : ""}`}
      title={`${tip ? tip + " · " : ""}${t("th_filter_tip")}`}
      onClick={(e) => {
        if (e.target.closest(".th-x")) return;
        setAnchor((a) => (a ? null : e.currentTarget));
      }}
    >
      <span className="th-l">{label}</span>
      {value ? (
        <span className="th-val">
          {opt?.icon}
          {opt?.label || value}
          <button
            className="th-x"
            type="button"
            title={t("clear_filter")}
            onClick={(e) => {
              e.stopPropagation();
              setAnchor(null);
              ctl.onFilter(col, "");
            }}
          >
            ×
          </button>
        </span>
      ) : (
        <span className="th-ic">▾</span>
      )}
      {anchor && (
        <Menu
          anchor={anchor}
          options={options}
          current={value}
          onClose={() => setAnchor(null)}
          onPick={(v) => {
            setAnchor(null);
            ctl.onFilter(col, v);
          }}
        />
      )}
    </th>
  );
}

// 옵션 빌더
export function useTypeOptions(counts) {
  const { typeName } = useI18n();
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => ({
      value,
      n,
      label: typeName(value),
      icon: (
        <span className="oi" style={{ "--c": TYPE_COLOR[value] || "var(--t-other)" }}>
          <TypeIcon type={value} size={14} />
        </span>
      ),
    }));
}

export function useChainOptions(counts) {
  const { t } = useI18n();
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([value, n]) => {
      const label = value === "unknown" ? t("unknown") : value;
      return { value, n, label, icon: <ChainIcon name={label} size={14} /> };
    });
}

export function useRoleOptions(counts) {
  const { roleName } = useI18n();
  return ["sanctioned", "attacker", "laundering", "victim", "unknown"].map((value) => ({
    value,
    n: counts?.[value] || 0,
    label: roleName(value),
    icon: (
      <span className={`oi role-ic ${value}`}>
        <RoleIcon role={value} size={14} />
      </span>
    ),
  }));
}
