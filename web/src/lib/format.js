// 숫자·날짜·주소 표기와 탐색기 링크. docs/common.js 의 규칙을 그대로 옮겼다.
export const fmtInt = (v) => Math.round(v || 0).toLocaleString("en-US");
export const fmtPct = (v, d = 1) => (isFinite(v) ? (v * 100).toFixed(d) + "%" : "-");
const trim0 = (s) => String(s).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");

export const money = (v) =>
  v == null
    ? "-"
    : v >= 1e9
      ? `$${trim0((v / 1e9).toFixed(2))}B`
      : v >= 1e6
        ? `$${trim0((v / 1e6).toFixed(1))}M`
        : v >= 1e3
          ? `$${trim0((v / 1e3).toFixed(0))}K`
          : `$${fmtInt(v)}`;

export const moneyFull = (v) => (v == null ? "-" : `$${fmtInt(v)}`);

export const fmtDate = (d, lang = "ko") => {
  if (!d) return "-";
  const [y, m, dd] = String(d).split("-");
  return lang === "ko" ? `${y}.${m}.${dd}` : `${m}/${dd}/${y}`;
};
export const fmtMD = (d) => (d ? String(d).slice(5).replace("-", ".") : "-");

// 주소 축약: 앞 6자 + … + 뒤 4자 (전체는 툴팁으로)
export const shortAddr = (a) => {
  const s = String(a || "");
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

const ADDR_RE = /\b(0x[0-9a-fA-F]{20,}|T[1-9A-HJ-NP-Za-km-z]{33}|bc1[0-9a-z]{20,}|[13][1-9A-HJ-NP-Za-km-z]{25,34}|4[0-9AB][1-9A-HJ-NP-Za-km-z]{93})\b/g;
export const stripAddr = (s) =>
  (s || "").replace(ADDR_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([,.)])/g, "$1").trim();

const EXPLORER = {
  ETH: "https://etherscan.io/address/",
  ETHEREUM: "https://etherscan.io/address/",
  BSC: "https://bscscan.com/address/",
  POLYGON: "https://polygonscan.com/address/",
  ARBITRUM: "https://arbiscan.io/address/",
  OPTIMISM: "https://optimistic.etherscan.io/address/",
  BASE: "https://basescan.org/address/",
  AVALANCHE: "https://snowtrace.io/address/",
  TRON: "https://tronscan.org/#/address/",
  TRX: "https://tronscan.org/#/address/",
  BTC: "https://mempool.space/address/",
  BITCOIN: "https://mempool.space/address/",
  SOL: "https://solscan.io/account/",
  SOLANA: "https://solscan.io/account/",
  LINEA: "https://lineascan.build/address/",
  SCROLL: "https://scrollscan.com/address/",
  CRONOS: "https://cronoscan.com/address/",
  FANTOM: "https://ftmscan.com/address/",
  GNOSIS: "https://gnosisscan.io/address/",
  BLAST: "https://blastscan.io/address/",
  MANTLE: "https://mantlescan.xyz/address/",
  SONIC: "https://sonicscan.org/address/",
  ZKSYNC: "https://explorer.zksync.io/address/",
  CELO: "https://celoscan.io/address/",
  MONERO: "https://xmrchain.net/search?value=",
  XMR: "https://xmrchain.net/search?value=",
};
const TX_EXPLORER = {
  ETH: "https://etherscan.io/tx/",
  ETHEREUM: "https://etherscan.io/tx/",
  BSC: "https://bscscan.com/tx/",
  POLYGON: "https://polygonscan.com/tx/",
  ARBITRUM: "https://arbiscan.io/tx/",
  OPTIMISM: "https://optimistic.etherscan.io/tx/",
  BASE: "https://basescan.org/tx/",
  AVALANCHE: "https://snowtrace.io/tx/",
  TRON: "https://tronscan.org/#/transaction/",
  BTC: "https://mempool.space/tx/",
  BITCOIN: "https://mempool.space/tx/",
  SOL: "https://solscan.io/tx/",
  SOLANA: "https://solscan.io/tx/",
};
export const explorer = (chain, addr) => {
  const base = EXPLORER[String(chain || "").toUpperCase()];
  return base && addr ? base + addr : "";
};
export const txExplorer = (chain, hash) => {
  const base = TX_EXPLORER[String(chain || "").toUpperCase()] || TX_EXPLORER.ETH;
  return hash ? base + hash : "";
};

// 마크다운(브리핑)은 불릿·굵게·링크만 쓴다 → 최소 변환
const escHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const mdToHtml = (md) =>
  (md || "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const body = escHtml(line.replace(/^[-*]\s+/, ""))
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return `<li>${body}</li>`;
    })
    .join("");
