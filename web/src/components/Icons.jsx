// 유형·역할·체인 아이콘 React 래퍼. SVG 내부는 icon-data.js 의 문자열을 그대로 넣는다.
import { TYPE_PATHS, ROLE_PATHS, chainIconHtml, chainColor } from "../lib/icon-data.js";
import { useI18n } from "../lib/i18n.jsx";
import { Tip } from "./Tooltip.jsx";

export const TYPE_COLOR = {
  hack_exploit: "var(--t-hack)",
  private_key_compromise: "var(--t-key)",
  rug_pull: "var(--t-rug)",
  phishing_social_engineering: "var(--t-phish)",
  scam_fraud: "var(--t-scam)",
  ransomware: "var(--t-ransom)",
  sanctions_designation: "var(--t-sanction)",
  law_enforcement_action: "var(--t-law)",
  laundering_report: "var(--t-launder)",
  other: "var(--t-other)",
};

export function TypeIcon({ type, size = 16 }) {
  const html = TYPE_PATHS[type] || TYPE_PATHS.other;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="none" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export function RoleIcon({ role, size = 16 }) {
  const html = ROLE_PATHS[role] || ROLE_PATHS.unknown;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="none" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** 사건 이름 앞 육각 타일 */
export function Avatar({ type, size = "" }) {
  const { typeFull } = useI18n();
  return (
    <span className={`avatar ${size}`} style={{ "--c": TYPE_COLOR[type] || "var(--t-other)" }} title={typeFull(type)}>
      <TypeIcon type={type} />
    </span>
  );
}

export function TypeBadge({ type }) {
  const { typeName, typeFull } = useI18n();
  return (
    <span className="badge tb" style={{ "--c": TYPE_COLOR[type] || "var(--t-other)" }} title={typeFull(type)}>
      <TypeIcon type={type} />
      {typeName(type)}
    </span>
  );
}

export function RoleBadge({ role }) {
  const { t, roleName } = useI18n();
  return (
    <span className={`role ${role}`} title={t("tip_role_" + role) || roleName(role)}>
      <RoleIcon role={role} />
      {roleName(role)}
    </span>
  );
}

export function ChainIcon({ name, size = 18 }) {
  return <span className="rk-ci" dangerouslySetInnerHTML={{ __html: chainIconHtml(name, size) }} />;
}

/** 표에서는 아이콘만, 마우스를 올리면 체인 이름 툴팁 */
export function ChainPill({ chain, withName = false }) {
  const { t } = useI18n();
  const name = chain === "unknown" ? t("unknown") : chain;
  if (withName)
    return (
      <span className="chain named" style={{ "--cc": chainColor(name) }}>
        <span dangerouslySetInnerHTML={{ __html: chainIconHtml(name, 16) }} />
        <span>{name}</span>
      </span>
    );
  return (
    <Tip text={name}>
      <span className="chain ic" aria-label={name} dangerouslySetInnerHTML={{ __html: chainIconHtml(name, 20) }} />
    </Tip>
  );
}

export function ChainPills({ chains, max = 4 }) {
  const list = chains || [];
  const rest = list.slice(max);
  if (!list.length) return <span className="faint">–</span>;
  return (
    <>
      {list.slice(0, max).map((c, i) => (
        <ChainPill key={`${c}-${i}`} chain={c} />
      ))}
      {rest.length > 0 && (
        <Tip text={rest.join(" · ")}>
          <span className="faint small more">+{rest.length}</span>
        </Tip>
      )}
    </>
  );
}

export { chainColor };
