/* 유형·역할·종류 아이콘 (직접 그린 24×24 라인 아이콘, stroke=currentColor). KL.typeIcon(type) · KL.roleIcon(role) · KL.avatar(i) · KL.roleBadge(role) */
(() => {
  "use strict";
  const { esc, typeName, typeFull, roleName, TYPE_COLOR } = KL;
  const wrap = (paths, extra = "") => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${paths}</svg>`;
  // 유형별: 해킹=깨진 방패 · 개인키=열쇠 · 피싱=낚싯바늘 · 러그풀=말린 카펫+화살 · 사기=가면 · 랜섬웨어=자물쇠 · 제재=금지 원 · 수사·기소=망치(가벨) · 세탁=순환 화살표+$ · 기타=점
  const TYPE_PATHS = {
    hack_exploit: '<path d="M12 3l7 3v5c0 5-3 8.6-7 10-4-1.4-7-5-7-10V6l7-3z"/><path d="M12 7.5l-2 3.5h4l-2 3.5"/>',
    private_key_compromise: '<circle cx="8" cy="15" r="3.5"/><path d="M10.6 12.4L20 3"/><path d="M16.5 6.5l2.5 2.5"/><path d="M13.5 9.5l2 2"/>',
    phishing_social_engineering: '<circle cx="12" cy="4" r="1.5"/><path d="M12 5.5V13"/><path d="M7.5 13a4.5 4.5 0 0 0 9 0v-1.5"/><path d="M14.5 11.5l2-1.5"/>',
    rug_pull: '<path d="M12 3v7"/><path d="M8.5 6.5L12 10l3.5-3.5"/><path d="M3 18c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0"/><circle cx="5" cy="14.5" r="1.8"/>',
    scam_fraud: '<path d="M4 8c3-2.8 13-2.8 16 0v6c0 4-4 7-8 7s-8-3-8-7V8z"/><circle cx="8.8" cy="12.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.2" cy="12.5" r="1.3" fill="currentColor" stroke="none"/><path d="M9.5 16.5c1.5.9 3.5.9 5 0"/>',
    ransomware: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><circle cx="12" cy="16" r="1.3" fill="currentColor" stroke="none"/>',
    sanctions_designation: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    law_enforcement_action: '<path d="M13 5l6 6"/><path d="M15 3l6 6"/><path d="M11 7l6 6"/><path d="M3 21l9-9"/><path d="M4 21h6"/>',
    laundering_report: '<path d="M4 12a8 8 0 0 1 13.5-5.8"/><path d="M20 12a8 8 0 0 1-13.5 5.8"/><path d="M17.5 3v3.5H14"/><path d="M6.5 21v-3.5H10"/><path d="M12 9v6M10.3 10.3h2.6a1.2 1.2 0 0 1 0 2.4h-1.8a1.2 1.2 0 0 0 0 2.4h2.6"/>',
    other: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  };
  // 역할: 제재=금지 · 공격자=조준선 · 세탁·경유=순환 · 피해자=방패 · 미분류=물음표
  const ROLE_PATHS = {
    sanctioned: TYPE_PATHS.sanctions_designation,
    attacker: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    laundering: '<path d="M4 12a8 8 0 0 1 13.5-5.8"/><path d="M20 12a8 8 0 0 1-13.5 5.8"/><path d="M17.5 3v3.5H14"/><path d="M6.5 21v-3.5H10"/>',
    victim: '<path d="M12 3l7 3v5c0 5-3 8.6-7 10-4-1.4-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    unknown: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  };
  const typeIcon = (type) => wrap(TYPE_PATHS[type] || TYPE_PATHS.other);
  const roleIcon = (role) => wrap(ROLE_PATHS[role] || ROLE_PATHS.unknown);
  const avatar = (i, size = "") => `<span class="avatar ${size}" style="--c:${TYPE_COLOR[i.type] || "var(--t-other)"}" title="${esc(typeFull(i.type))}">${typeIcon(i.type)}</span>`;
  const typeBadge = (type) => `<span class="badge tb" style="--c:${TYPE_COLOR[type] || "var(--t-other)"}" title="${esc(typeFull(type))}">${typeIcon(type)}${esc(typeName(type))}</span>`;
  const roleBadge = (role) => `<span class="role ${esc(role)}">${roleIcon(role)}${esc(roleName(role))}</span>`;
  Object.assign(KL, { typeIcon, roleIcon, avatar, typeBadge, roleBadge, TYPE_PATHS, ROLE_PATHS });
})();
