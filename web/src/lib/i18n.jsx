// 한/영 전환 + 테마. 문구 사전은 i18n-dict.js(기존 화면과 동일).
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { I18N, SOURCE_LABEL } from "./i18n-dict.js";
import { fmtDate as fmtDateRaw } from "./format.js";

const Ctx = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ko");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
  }, [lang]);

  const value = useMemo(() => {
    const dict = I18N[lang] || I18N.ko;
    const t = (k) => dict[k] ?? I18N.ko[k] ?? k;
    return {
      lang,
      theme,
      setLang,
      toggleLang: () => setLang((l) => (l === "ko" ? "en" : "ko")),
      toggleTheme: () => setTheme((v) => (v === "dark" ? "light" : "dark")),
      t,
      typeName: (k) => dict.types?.[k] || k,
      typeFull: (k) => dict.types_full?.[k] || k,
      roleName: (k) => dict.roles_map?.[k] || k,
      kindName: (a) => {
        if (!a || !a.kind) return "";
        if (a.kind === "eoa" && a.delegated) return `${dict.kinds_map.eoa} · 7702`;
        if (a.kind === "contract") return [dict.kinds_map.contract, dict.ctypes_map?.[a.ctype]].filter(Boolean).join(" · ");
        return dict.kinds_map?.[a.kind] || a.kind;
      },
      srcLabel: (s) => SOURCE_LABEL[s] || String(s || "").replace(/^rss:/, ""),
      fmtDate: (d) => fmtDateRaw(d, lang),
      txt: (o, field) => o?.[`${field}_${lang}`] || o?.[`${field}_${lang === "ko" ? "en" : "ko"}`] || "",
    };
  }, [lang, theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("I18nProvider 밖에서 useI18n 을 썼습니다");
  return v;
};

/** 문구에 {n}/{v}/{d} 를 끼워 넣는다 */
export const fill = (s, vars) =>
  Object.entries(vars || {}).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), String(s ?? ""));
