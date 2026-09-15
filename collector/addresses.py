"""지갑 주소 / 트랜잭션 해시 정규식 추출 + 체크섬 검증."""
from __future__ import annotations

import hashlib
import re
from typing import Iterable, List, Optional

from .models import Address

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_B58_INDEX = {c: i for i, c in enumerate(_B58)}
_BECH32_CHARSET = set("qpzry9x8gf2tvdw0s3jn54khce6mua7l")


def _b58decode(s: str) -> Optional[bytes]:
    n = 0
    for ch in s:
        if ch not in _B58_INDEX:
            return None
        n = n * 58 + _B58_INDEX[ch]
    full = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    pad = len(s) - len(s.lstrip("1"))
    return b"\x00" * pad + full


def _b58check(s: str, version_bytes: Iterable[bytes]) -> bool:
    raw = _b58decode(s)
    if raw is None or len(raw) < 5:
        return False
    payload, checksum = raw[:-4], raw[-4:]
    if hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4] != checksum:
        return False
    return any(payload.startswith(v) for v in version_bytes)


def _bech32_ok(s: str) -> bool:
    body = s.lower().split("1", 1)[1] if "1" in s else ""
    return 6 <= len(body) <= 90 and all(c in _BECH32_CHARSET for c in body)


# --- 정규식 ---------------------------------------------------------------
EVM_RE = re.compile(r"(?<![0-9a-zA-Z])0x[a-fA-F0-9]{40}(?![0-9a-zA-Z])")
EVM_TX_RE = re.compile(r"(?<![0-9a-zA-Z])0x[a-fA-F0-9]{64}(?![0-9a-zA-Z])")
BTC_LEGACY_RE = re.compile(r"(?<![0-9a-zA-Z])[13][1-9A-HJ-NP-Za-km-z]{25,34}(?![0-9a-zA-Z])")
BTC_BECH32_RE = re.compile(r"(?<![0-9a-zA-Z])bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,90}(?![0-9a-zA-Z])", re.I)
TRX_RE = re.compile(r"(?<![0-9a-zA-Z])T[1-9A-HJ-NP-Za-km-z]{33}(?![0-9a-zA-Z])")
LTC_LEGACY_RE = re.compile(r"(?<![0-9a-zA-Z])[LM][1-9A-HJ-NP-Za-km-z]{26,33}(?![0-9a-zA-Z])")
LTC_BECH32_RE = re.compile(r"(?<![0-9a-zA-Z])ltc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,90}(?![0-9a-zA-Z])", re.I)
XMR_RE = re.compile(r"(?<![0-9a-zA-Z])4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}(?![0-9a-zA-Z])")
SOL_RE = re.compile(r"(?<![0-9a-zA-Z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![0-9a-zA-Z])")
HEX64_RE = re.compile(r"(?<![0-9a-zA-Z])[a-fA-F0-9]{64}(?![0-9a-zA-Z])")

# OFAC idType → 체인 코드
OFAC_CHAIN_MAP = {
    "XBT": "BTC", "BTC": "BTC", "ETH": "ETH", "TRX": "TRX", "USDT": "USDT", "USDC": "USDC",
    "LTC": "LTC", "XMR": "XMR", "BCH": "BCH", "DASH": "DASH", "ZEC": "ZEC", "SOL": "SOL",
    "DOGE": "DOGE", "XVG": "XVG", "XRP": "XRP", "ETC": "ETC", "BTG": "BTG", "BSV": "BSV",
    "BSC": "BSC", "BNB": "BNB", "ARB": "ARB", "ARBITRUM": "ARB", "MATIC": "POLYGON", "POLYGON": "POLYGON",
    "AVAX": "AVAX", "TON": "TON", "BASE": "BASE", "OP": "OPTIMISM",
}


def infer_chain(address: str, hint: str = "") -> str:
    """주소 형식으로 체인 추정 (USDT처럼 토큰명이 온 경우 형식으로 재분류)."""
    h = (hint or "").upper()
    if address.startswith("0x") and len(address) == 42:
        return h if h in ("ETH", "BSC", "ARB", "POLYGON", "AVAX", "BASE", "OPTIMISM", "ETC") else "ETH"
    if address.startswith("T") and len(address) == 34:
        return "TRX"
    if address.lower().startswith("bc1") or address[0] in "13":
        return "BTC"
    if address.lower().startswith("ltc1") or address[0] in "LM":
        return "LTC"
    if address.startswith("4") and len(address) == 95:
        return "XMR"
    return h or "UNKNOWN"


def extract_addresses(text: str, hint_chains: Optional[Iterable[str]] = None) -> List[Address]:
    """본문에서 주소를 뽑는다. 체크섬 검증으로 오탐을 줄인다."""
    found: dict = {}
    hints = {c.upper() for c in (hint_chains or [])}
    low = text.lower()

    def add(chain: str, addr: str):
        a = Address(chain=chain, address=addr)
        found.setdefault(a.key(), a)

    for m in EVM_RE.finditer(text):
        add("ETH", m.group(0))
    for m in TRX_RE.finditer(text):
        if _b58check(m.group(0), [b"\x41"]):
            add("TRX", m.group(0))
    for m in BTC_LEGACY_RE.finditer(text):
        if _b58check(m.group(0), [b"\x00", b"\x05"]):
            add("BTC", m.group(0))
    for m in BTC_BECH32_RE.finditer(text):
        if _bech32_ok(m.group(0)):
            add("BTC", m.group(0))
    for m in LTC_LEGACY_RE.finditer(text):
        if _b58check(m.group(0), [b"\x30", b"\x32", b"\x05"]):
            add("LTC", m.group(0))
    for m in LTC_BECH32_RE.finditer(text):
        if _bech32_ok(m.group(0)):
            add("LTC", m.group(0))
    for m in XMR_RE.finditer(text):
        add("XMR", m.group(0))

    # 솔라나는 base58 32~44자라 오탐이 많아, 본문에 solana 언급이 있을 때만 + 다른 체인과 겹치지 않을 때만
    if "solana" in low or "SOL" in hints:
        for m in SOL_RE.finditer(text):
            s = m.group(0)
            if s.startswith("T") and len(s) == 34:
                continue
            decoded = _b58decode(s)
            if s[0] in "13LM" and decoded is not None and len(decoded) == 25:
                continue
            if not (any(c.isdigit() for c in s) and any(c.isupper() for c in s) and any(c.islower() for c in s)):
                continue
            add("SOL", s)

    return list(found.values())


def extract_tx_hashes(text: str, include_bare_hex: bool = False) -> List[str]:
    out = []
    seen = set()
    for m in EVM_TX_RE.finditer(text):
        h = m.group(0).lower()
        if h not in seen:
            seen.add(h)
            out.append(h)
    if include_bare_hex:
        for m in HEX64_RE.finditer(text):
            h = m.group(0).lower()
            if h not in seen:
                seen.add(h)
                out.append(h)
    return out


def merge_addresses(*lists: Iterable[Address]) -> List[Address]:
    """여러 출처의 주소 목록 병합. 앞선 목록의 역할(role)이 우선하되 unknown은 뒤 목록 값으로 대체."""
    merged: dict = {}
    for lst in lists:
        for a in lst:
            k = a.key()
            if k not in merged:
                merged[k] = Address(chain=a.chain.upper(), address=a.address, role=a.role or "unknown", note=a.note or "")
            else:
                cur = merged[k]
                if cur.role == "unknown" and a.role and a.role != "unknown":
                    cur.role = a.role
                if not cur.note and a.note:
                    cur.note = a.note
    return list(merged.values())
