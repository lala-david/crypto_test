"""DeFiHackLabs (SunWeb3Sec) — README 사고 목록 + PoC .sol 헤더 주석(공격자 EOA·공격 tx·피해 계약)."""
from __future__ import annotations

import re
from datetime import date
from typing import List

from ..models import Address, RawItem
from .base import Source, SourceContext

README = "https://raw.githubusercontent.com/SunWeb3Sec/DeFiHackLabs/main/README.md"
RAW = "https://raw.githubusercontent.com/SunWeb3Sec/DeFiHackLabs/main/"
WEB = "https://github.com/SunWeb3Sec/DeFiHackLabs/blob/main/"

_ENTRY = re.compile(r"^### (\d{8}) (.+?) - (.+)$", re.M)
_LOST = re.compile(r"^### Lost:\s*(.+)$", re.M)
_SOL = re.compile(r"\]\((?:\.\./)*(src/test/[^)]+\.sol)\)")   # 연도 아카이브는 ../../src/test/… 로 링크
_ADDR = re.compile(r"0x[a-fA-F0-9]{40}")
_TX = re.compile(r"0x[a-fA-F0-9]{64}")
_FORK = re.compile(r'createSelectFork\(\s*"([A-Za-z0-9_-]+)"')
_FORK_CHAIN = {"mainnet": "Ethereum", "eth": "Ethereum", "ethereum": "Ethereum", "bsc": "BSC", "bnb": "BSC", "arbitrum": "Arbitrum", "polygon": "Polygon", "matic": "Polygon", "base": "Base",
               "optimism": "Optimism", "avalanche": "Avalanche", "avax": "Avalanche", "fantom": "Fantom", "gnosis": "Gnosis", "blast": "Blast", "linea": "Linea", "scroll": "Scroll", "mantle": "Mantle",
               "zksync": "zkSync", "celo": "Celo", "moonriver": "Moonriver", "moonbeam": "Moonbeam", "cronos": "Cronos", "core": "Core", "opbnb": "opBNB", "sonic": "Sonic", "mode": "Mode", "sei": "Sei",
               "berachain": "Berachain", "zora": "Zora", "manta": "Manta", "kava": "Kava", "metis": "Metis", "harmony": "Harmony", "aurora": "Aurora", "boba": "Boba", "fuse": "Fuse", "telos": "Telos",
               "pulsechain": "PulseChain", "hyperevm": "HyperEVM", "unichain": "Unichain", "abstract": "Abstract", "ink": "Ink", "soneium": "Soneium", "worldchain": "World Chain", "ronin": "Ronin"}
_EXPLORER_CHAIN = {"etherscan.io": "Ethereum", "bscscan.com": "BSC", "arbiscan.io": "Arbitrum", "polygonscan.com": "Polygon", "basescan.org": "Base", "optimistic.etherscan.io": "Optimism",
                   "snowtrace.io": "Avalanche", "snowscan.xyz": "Avalanche", "ftmscan.com": "Fantom", "gnosisscan.io": "Gnosis", "blastscan.io": "Blast", "lineascan.build": "Linea", "scrollscan.com": "Scroll",
                   "mantlescan.xyz": "Mantle", "cronoscan.com": "Cronos", "explorer.zksync.io": "zkSync", "celoscan.io": "Celo", "moonriver.moonscan.io": "Moonriver", "opbnbscan.com": "opBNB",
                   "sonicscan.org": "Sonic", "seitrace.com": "Sei", "berascan.com": "Berachain", "kavascan.com": "Kava", "explorer.mantle.xyz": "Mantle", "hyperevmscan.io": "HyperEVM", "uniscan.xyz": "Unichain"}


def chains_from_sol(sol: str) -> List[str]:
    """PoC .sol 에서 체인 추정: createSelectFork("bsc") 또는 탐색기 도메인(bscscan.com …). 순서 유지, 중복 제거."""
    out: List[str] = []
    for m in _FORK.findall(sol or ""):
        c = _FORK_CHAIN.get(m.lower())
        if c and c not in out:
            out.append(c)
    if not out:
        for dom, c in _EXPLORER_CHAIN.items():
            if dom in (sol or "") and c not in out:
                out.append(c)
    return out


def _usd(text: str):
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:([KkMmBb])(?![A-Za-z]))?", text or "")   # '$56.9BNB' 의 B 를 십억으로 읽지 않게
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    u = (m.group(2) or "").lower()
    return v * {"k": 1e3, "m": 1e6, "b": 1e9}.get(u, 1)


def _header_comment(sol: str, max_lines: int = 80) -> str:
    lines = []
    for ln in sol.splitlines()[:max_lines]:
        s = ln.strip()
        if s.startswith("//") or s.startswith("/*") or s.startswith("*") or s.startswith("pragma") or not s:
            lines.append(ln)
        elif lines and s.startswith("import"):
            continue
        else:
            break
    return "\n".join(lines)


def year_archives(since: date, today: date) -> List[int]:
    """메인 README 는 올해 사고만 담고, 지난 연도는 past/<연도>/README.md 에 있다. since 가 지난 연도면 그 연도부터 작년까지."""
    return list(range(max(2021, since.year), today.year)) if since.year < today.year else []


class DefiHackLabsSource(Source):
    name = "defihacklabs"

    def collect(self, ctx: SourceContext) -> List[RawItem]:
        items = self._collect_md(ctx, ctx.http.get_text(README, cache_ttl_hours=1), "README")
        for y in year_archives(ctx.since, date.today()):
            try:
                md = ctx.http.get_text(f"{RAW}past/{y}/README.md", cache_ttl_hours=24 * 7)
            except Exception as e:
                ctx.log.warning("defihacklabs 연도 아카이브 %s 로드 실패: %s", y, e)
                continue
            items += self._collect_md(ctx, md, f"past/{y}", stop_early=False)
        return items

    def _collect_md(self, ctx: SourceContext, md: str, label: str, stop_early: bool = True) -> List[RawItem]:
        entries = list(_ENTRY.finditer(md))
        items: List[RawItem] = []
        for idx, m in enumerate(entries):
            ymd, name, tech = m.group(1), m.group(2).strip(), m.group(3).strip()
            day = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
            if day < ctx.since.isoformat():
                if stop_early and idx > 5:
                    break
                continue
            block = md[m.end(): entries[idx + 1].start() if idx + 1 < len(entries) else m.end() + 1500]
            lost = _LOST.search(block)
            lost_text = lost.group(1).strip() if lost else ""
            sol_m = _SOL.search(block)
            sol_path = sol_m.group(1) if sol_m else ""
            header, addrs, txs, chains = "", [], [], []
            if sol_path:
                try:
                    sol = ctx.http.get_text(RAW + sol_path, cache_ttl_hours=24 * 7)
                    header = _header_comment(sol)
                    chains = chains_from_sol(sol)
                    for ln in header.splitlines():
                        low = ln.lower()
                        role = "attacker" if "attacker" in low or "exploiter" in low else ("victim" if "victim" in low or "vulnerable" in low else "unknown")
                        for a in _ADDR.findall(ln):
                            if len(a) == 42:
                                addrs.append(Address(chain=(chains[0] if chains else "ETH"), address=a, role=role, note=re.sub(r"^//\s*", "", ln.split(":")[0]).strip()[:60]))
                        txs += [t.lower() for t in _TX.findall(ln)]
                except Exception as e:
                    ctx.log.warning("defihacklabs PoC 로드 실패 %s: %s", sol_path, e)
            structured = {"name": name, "incident_date": day, "amount_text": lost_text, "amount_usd": _usd(lost_text), "chains": chains,
                          "attack_method": tech, "incident_type": "hack_exploit",
                          "summary": f"DeFiHackLabs: {name} — {tech}. Lost: {lost_text}"}
            items.append(
                RawItem(
                    source=self.name, source_id=f"{ymd}|{name}", url=(WEB + sol_path) if sol_path else "https://github.com/SunWeb3Sec/DeFiHackLabs",
                    title=f"{name} — {tech}", published_at=day,
                    text=f"{name} ({day}) — {tech}\nLost: {lost_text}\n\nPoC header:\n{header[:6000]}",
                    summary_hint=f"{tech}. Lost: {lost_text}", structured=structured, addresses=addrs,
                    tx_hashes=sorted(set(txs)), tags=["defihacklabs"], needs_llm=True,
                )
            )
        ctx.log.info("defihacklabs: %s %d건 중 기간 내 %d건", label, len(entries), len(items))
        return items
