// 커서를 따라다니는 툴팁 하나를 앱 전체가 공유한다(기존 #tip 과 같은 동작).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const Ctx = createContext({ show: () => {}, hide: () => {} });

export function TooltipHost({ children }) {
  const ref = useRef(null);
  const [state, setState] = useState({ text: "", x: 0, y: 0, on: false, below: false });

  const show = useCallback((text, e) => {
    if (!text) return;
    setState({ text, x: e.clientX, y: e.clientY < 70 ? e.clientY + 14 : e.clientY - 8, on: true, below: e.clientY < 70 });
  }, []);
  const hide = useCallback(() => setState((s) => (s.on ? { ...s, on: false } : s)), []);

  useEffect(() => {
    const onScroll = () => hide();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [hide]);

  return (
    <Ctx.Provider value={{ show, hide }}>
      {children}
      <div
        ref={ref}
        className={`tooltip${state.on ? " show" : ""}${state.below ? " below" : ""}`}
        style={{ left: state.x, top: state.y }}
        role="tooltip"
      >
        {state.text}
      </div>
    </Ctx.Provider>
  );
}

export const useTip = () => useContext(Ctx);

/** 자식 하나를 감싸 마우스를 올리면 툴팁을 띄운다. */
export function Tip({ text, children, as: As = "span", className = "" }) {
  const { show, hide } = useTip();
  return (
    <As className={className} onMouseMove={(e) => show(text, e)} onMouseLeave={hide}>
      {children}
    </As>
  );
}
