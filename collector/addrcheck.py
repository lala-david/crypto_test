"""지갑 주소 온체인 검증·분류 (EOA/CA · 토큰·풀·프록시·멀티시그 · 실제 활동 체인) + OKLink 라벨(선택).

무엇을 하나
- 형식 검증: EVM(EIP-55 체크섬), BTC(base58check/bech32·bech32m), Tron(base58check 0x41), Cosmos bech32(hrp), Solana(base58 32B), Monero(형식).
  `0x`+64 hex 는 주소가 아니라 트랜잭션 해시 → 카드의 tx_hashes 로 옮긴다.
- EVM: 후보 체인(사건 카드의 체인 힌트 → 기본 목록)에 eth_getCode / eth_getTransactionCount / eth_getBalance 배치 조회 → 활동이 있는 체인 → EOA/CA.
  CA 면 eth_call 로 유형: 토큰(ERC-20 symbol/decimals) · LP 풀(token0/token1) · V3 풀(fee) · Balancer 풀(getPoolId) · ERC-4626 볼트(asset)
  · aToken(UNDERLYING_ASSET_ADDRESS) · cToken/vToken(underlying) · 라우터(factory+WETH) · NFT(ERC-165 0x80ac58cd) · Safe 멀티시그(getOwners) · 프록시(EIP-1967 슬롯/implementation()).
- BTC: mempool.space(잔액·tx 수). Tron: trongrid getaccount/getcontract. Solana: getAccountInfo(jsonParsed) → 지갑/프로그램/토큰 민트/토큰 계정.
- OKLink(키가 있을 때만, ../vllm/oklink.txt 또는 OKLINK_API_KEY): address-summary(contractAddress/isAaAddress/tx 수/첫·마지막 거래) + entity-label.

결과는 data/address_labels.json 에 주소 기준으로 캐시하고, DataService 가 카드 주소에 kind/ctype/label/chain 을 붙인다.
카드 교정(사실만): 체인 정정, tx 해시 → tx_hashes 이동, 체크섬 깨진 주소 제거/대소문자 교정, 토큰·풀·라우터 컨트랙트에 붙은 attacker 역할 → unknown.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from datetime import datetime
from typing import Callable, Dict, Iterable, List, Optional, Tuple

import requests

from .addresses import _b58check, _b58decode
from .models import Address, Incident

log = logging.getLogger("collector.addrcheck")

# ---------------------------------------------------------------------------
# 체인 이름 정규화 (service.CHAIN_ALIAS 와 호환되는 표시 이름)
CHAIN_ALIAS = {
    "eth": "Ethereum", "ethereum": "Ethereum", "ether": "Ethereum", "ethereum mainnet": "Ethereum",
    "bsc": "BSC", "bnb": "BSC", "bnb chain": "BSC", "bnb smart chain": "BSC", "binance smart chain": "BSC", "binance chain": "BSC",
    "polygon": "Polygon", "matic": "Polygon", "polygon pos": "Polygon", "arbitrum": "Arbitrum", "arb": "Arbitrum", "arbitrum one": "Arbitrum",
    "optimism": "Optimism", "op": "Optimism", "base": "Base", "avalanche": "Avalanche", "avax": "Avalanche", "avalanche c-chain": "Avalanche",
    "hyperevm": "HyperEVM", "hyperliquid": "HyperEVM", "hyperliquid evm": "HyperEVM", "cronos": "Cronos", "sonic": "Sonic", "linea": "Linea",
    "trx": "Tron", "tron": "Tron", "btc": "Bitcoin", "bitcoin": "Bitcoin", "sol": "Solana", "solana": "Solana", "xmr": "Monero", "monero": "Monero",
    "osmosis": "Osmosis", "nomic": "Nomic", "noble": "Noble", "axelar": "Axelar", "cosmos": "Cosmos", "cosmos hub": "Cosmos",
}
COSMOS_HRP = {"osmo": "Osmosis", "nomic": "Nomic", "noble": "Noble", "axelar": "Axelar", "cosmos": "Cosmos", "celestia": "Celestia", "inj": "Injective", "sei": "Sei", "kava": "Kava", "juno": "Juno"}

DEFAULT_EVM_RPC: Dict[str, List[str]] = {
    "Ethereum": ["https://ethereum-rpc.publicnode.com"],
    "BSC": ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"],
    "Base": ["https://mainnet.base.org"],
    "Arbitrum": ["https://arb1.arbitrum.io/rpc"],
    "Optimism": ["https://mainnet.optimism.io"],
    "Polygon": ["https://polygon-bor-rpc.publicnode.com"],
    "Avalanche": ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
    "HyperEVM": ["https://rpc.hyperliquid.xyz/evm"],
    "Cronos": ["https://evm.cronos.org"],
    "Sonic": ["https://rpc.soniclabs.com"],
    "Linea": ["https://rpc.linea.build"],
}
DEFAULT_PROBE_ORDER = ["Ethereum", "BSC", "Base", "Arbitrum", "HyperEVM", "Polygon", "Optimism", "Avalanche", "Cronos", "Sonic", "Linea"]

# 컨트랙트 유형 판별용 함수 셀렉터 (keccak256(signature)[:4])
SEL = {
    "symbol": "0x95d89b41", "name": "0x06fdde03", "decimals": "0x313ce567", "totalSupply": "0x18160ddd",
    "token0": "0x0dfe1681", "token1": "0xd21220a7", "fee": "0xddca3f43", "getPoolId": "0x38fff2d0",
    "asset": "0x38d52e0f", "underlying": "0x6f307dc3", "UNDERLYING_ASSET_ADDRESS": "0xb16a19de",
    "getOwners": "0xa0e67e2b", "implementation": "0x5c60da1b", "factory": "0xc45a0155", "WETH": "0xad5c4648",
    "supportsInterface721": "0x01ffc9a780ac58cd00000000000000000000000000000000000000000000000000000000",
}
EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
INFRA_CTYPES = {"token", "lp_pool", "v3_pool", "balancer_pool", "router", "atoken", "ctoken", "vault", "nft"}

CTYPE_KO = {"token": "토큰", "lp_pool": "풀(LP)", "v3_pool": "풀(V3)", "balancer_pool": "풀(Balancer)", "vault": "볼트", "atoken": "aToken", "ctoken": "cToken",
            "proxy": "프록시", "safe": "멀티시그", "router": "라우터", "nft": "NFT", "contract": "컨트랙트", "program": "프로그램", "mint": "토큰 민트", "token_account": "토큰 계정"}

_TRON_GATE = threading.Semaphore(1)
# 주소 메모가 트랜잭션을 가리키는데(예: "attack tx") 어느 체인에도 활동이 없으면 → 64자리 tx 해시를 40자리로 잘라 쓴 것 (LLM 추출 오류)
_TX_NOTE_RE = re.compile(r"(?i)\b(tx|txn|transaction|hash)\b")
_PHANTOM_NOTE_RE = re.compile(r"(?i)\bcontract\b|exploit|orchestrator|borrower")


def norm_chain(c: str) -> str:
    s = (c or "").strip()
    return CHAIN_ALIAS.get(s.lower(), s)


# ---------------------------------------------------------------------------
# Keccak-256 (EIP-55 체크섬용, 의존성 없이)
_RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
       0x8000000080008081, 0x8000000000008009, 0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
       0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
       0x000000000000800A, 0x800000008000000A, 0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008]
_ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
_M64 = (1 << 64) - 1


def _rol(x: int, n: int) -> int:
    return ((x << n) | (x >> (64 - n))) & _M64 if n else x


def _keccak_f(st: List[List[int]]) -> List[List[int]]:
    for rc in _RC:
        c = [st[x][0] ^ st[x][1] ^ st[x][2] ^ st[x][3] ^ st[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        st = [[st[x][y] ^ d[x] for y in range(5)] for x in range(5)]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(st[x][y], _ROT[x][y])
        st = [[b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y]) for y in range(5)] for x in range(5)]
        st[0][0] ^= rc
    return st


def keccak256(data: bytes) -> bytes:
    rate = 136
    st = [[0] * 5 for _ in range(5)]
    msg = bytearray(data) + b"\x01"
    while len(msg) % rate:
        msg.append(0)
    msg[-1] |= 0x80
    for off in range(0, len(msg), rate):
        blk = msg[off:off + rate]
        for i in range(rate // 8):
            st[i % 5][i // 5] ^= int.from_bytes(blk[8 * i:8 * i + 8], "little")
        st = _keccak_f(st)
    return b"".join(st[i % 5][i // 5].to_bytes(8, "little") for i in range(4))


def eip55(address: str) -> str:
    """소문자 hex → EIP-55 체크섬 표기."""
    h = address[2:].lower()
    k = keccak256(h.encode()).hex()
    return "0x" + "".join(c.upper() if c in "abcdef" and int(k[i], 16) >= 8 else c for i, c in enumerate(h))


# ---------------------------------------------------------------------------
# 형식 검증
_BECH32_CH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_BECH32_GEN = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]


def _bech32_polymod(values: Iterable[int]) -> int:
    chk = 1
    for v in values:
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ v
        for i in range(5):
            chk ^= _BECH32_GEN[i] if (top >> i) & 1 else 0
    return chk


def bech32_verify(addr: str) -> Tuple[bool, str, str]:
    """(유효?, hrp, 'bech32'|'bech32m'|'') — 대소문자 혼용은 무효."""
    if addr != addr.lower() and addr != addr.upper():
        return False, "", ""
    a = addr.lower()
    if "1" not in a:
        return False, "", ""
    hrp, data = a.rsplit("1", 1)
    if not hrp or len(data) < 6 or any(c not in _BECH32_CH for c in data):
        return False, hrp, ""
    vals = [ord(c) >> 5 for c in hrp] + [0] + [ord(c) & 31 for c in hrp] + [_BECH32_CH.index(c) for c in data]
    pm = _bech32_polymod(vals)
    return (True, hrp, "bech32") if pm == 1 else (True, hrp, "bech32m") if pm == 0x2BC830A3 else (False, hrp, "")


def validate(address: str, chain_hint: str = "") -> dict:
    """형식·체크섬 검증. {family, valid, fixed(교정된 표기 또는 None), reason, chain(형식으로 확정되는 체인), kind_hint}"""
    a = (address or "").strip()
    out = {"family": "other", "valid": False, "fixed": None, "reason": "", "chain": "", "kind_hint": ""}
    if re.fullmatch(r"0x[0-9a-fA-F]{64}", a):
        out.update(family="evm", valid=False, reason="tx_hash", kind_hint="txhash")
        return out
    if re.fullmatch(r"0x[0-9a-fA-F]{40}", a):
        out["family"] = "evm"
        body = a[2:]
        if body == body.lower() or body == body.upper():
            out.update(valid=True, fixed=None if body == body.lower() else a.lower())
        elif eip55(a) == a:
            out["valid"] = True
        else:  # 대소문자 섞였는데 EIP-55 와 다름 → hex 자체는 살리고 소문자로 교정, 표시용으로 기록
            out.update(valid=True, fixed=a.lower(), reason="eip55_mismatch")
        return out
    if re.fullmatch(r"(?i)bc1[0-9a-z]{25,87}", a):
        out["family"] = "btc"
        ok, hrp, enc = bech32_verify(a)
        if not ok and a != a.lower():
            ok, hrp, enc = bech32_verify(a.lower())
            if ok:
                out["fixed"] = a.lower()
        out.update(valid=ok, reason="" if ok else "bech32_checksum", chain="Bitcoin",
                   kind_hint=("p2tr" if a.lower().startswith("bc1p") else "p2wsh" if len(a) == 62 else "p2wpkh") if ok else "")
        return out
    if re.fullmatch(r"[13][1-9A-HJ-NP-Za-km-z]{25,34}", a):
        ok = _b58check(a, [b"\x00", b"\x05"])
        out.update(family="btc", valid=ok, reason="" if ok else "base58_checksum", chain="Bitcoin", kind_hint="p2pkh" if a[0] == "1" else "p2sh")
        return out
    if re.fullmatch(r"T[1-9A-HJ-NP-Za-km-z]{33}", a):
        ok = _b58check(a, [b"\x41"])
        out.update(family="tron", valid=ok, reason="" if ok else "base58_checksum", chain="Tron")
        return out
    m = re.fullmatch(r"(?i)([a-z]{2,10})1[0-9a-z]{30,80}", a)
    if m and m.group(1).lower() in COSMOS_HRP:
        ok, hrp, enc = bech32_verify(a)
        if not ok and a != a.lower():
            ok, hrp, enc = bech32_verify(a.lower())
            if ok:
                out["fixed"] = a.lower()
        out.update(family="cosmos", valid=ok, reason="" if ok else "bech32_checksum", chain=COSMOS_HRP[m.group(1).lower()])
        return out
    if re.fullmatch(r"[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}", a):
        out.update(family="xmr", valid=True, chain="Monero")
        return out
    if re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", a):
        raw = _b58decode(a)
        ok = raw is not None and len(raw) == 32
        out.update(family="sol", valid=ok, reason="" if ok else "base58_len", chain="Solana")
        return out
    out.update(reason="unknown_format")
    return out


# ---------------------------------------------------------------------------
# ABI 디코딩 도우미
def _dec_uint(h: Optional[str]) -> Optional[int]:
    if not h or not h.startswith("0x") or len(h) < 66:
        return None
    try:
        return int(h[2:66], 16)
    except ValueError:
        return None


def _dec_addr(h: Optional[str]) -> Optional[str]:
    if not h or len(h) < 66:
        return None
    try:
        v = int(h[2:66], 16)
    except ValueError:
        return None
    if v == 0 or v >> 160:
        return None
    return "0x" + h[26:66].lower()


def _dec_bool(h: Optional[str]) -> bool:
    return _dec_uint(h) == 1


def _dec_string(h: Optional[str]) -> str:
    if not h or not h.startswith("0x") or len(h) < 66:
        return ""
    raw = bytes.fromhex(h[2:])
    try:
        if len(raw) == 32:  # bytes32 (MKR 식)
            return raw.rstrip(b"\x00").decode("utf-8", "ignore").strip()
        off = int.from_bytes(raw[:32], "big")
        ln = int.from_bytes(raw[off:off + 32], "big")
        return raw[off + 32:off + 32 + ln].decode("utf-8", "ignore").strip()
    except Exception:
        return ""


def _dec_addr_array_len(h: Optional[str]) -> int:
    if not h or len(h) < 130:
        return 0
    try:
        raw = bytes.fromhex(h[2:])
        off = int.from_bytes(raw[:32], "big")
        return int.from_bytes(raw[off:off + 32], "big")
    except Exception:
        return 0


def classify_contract(calls: Dict[str, Optional[str]], impl_slot: Optional[str] = None) -> dict:
    """eth_call 결과(셀렉터 이름 → hex 결과)로 컨트랙트 유형을 정한다. 네트워크 없이 단위 테스트 가능."""
    g = calls.get
    symbol, name, dec = _dec_string(g("symbol")), _dec_string(g("name")), _dec_uint(g("decimals"))
    t0, t1 = _dec_addr(g("token0")), _dec_addr(g("token1"))
    impl = _dec_addr(impl_slot) or _dec_addr(g("implementation"))
    out = {"ctype": "contract", "symbol": symbol[:24], "name": name[:60], "decimals": dec if dec is not None and dec <= 36 else None,
           "impl": impl, "proxy": bool(impl), "token0": t0, "token1": t1}
    owners = _dec_addr_array_len(g("getOwners"))
    if owners and g("getOwners") and not t0:
        out["ctype"] = "safe"; out["owners"] = owners
    elif t0 and t1:
        out["ctype"] = "v3_pool" if _dec_uint(g("fee")) not in (None, 0) and (_dec_uint(g("fee")) or 0) < 10 ** 6 else "lp_pool"
    elif g("getPoolId") and _dec_uint(g("getPoolId")):
        out["ctype"] = "balancer_pool"
    elif _dec_addr(g("UNDERLYING_ASSET_ADDRESS")):
        out["ctype"] = "atoken"; out["underlying"] = _dec_addr(g("UNDERLYING_ASSET_ADDRESS"))
    elif _dec_addr(g("asset")) and symbol:
        out["ctype"] = "vault"; out["underlying"] = _dec_addr(g("asset"))
    elif _dec_addr(g("underlying")) and symbol:
        out["ctype"] = "ctoken"; out["underlying"] = _dec_addr(g("underlying"))
    elif _dec_addr(g("factory")) and _dec_addr(g("WETH")):
        out["ctype"] = "router"
    elif _dec_bool(g("supportsInterface721")):
        out["ctype"] = "nft"
    elif symbol and out["decimals"] is not None:
        out["ctype"] = "token"
    elif impl:
        out["ctype"] = "proxy"
    return out


def parse_code(code_hex: str) -> Tuple[int, Optional[str]]:
    """eth_getCode 결과 → (컨트랙트 코드 길이, EIP-7702 위임 대상). 0xef0100+20바이트(23B)는 위임된 EOA 이므로 코드 길이 0 으로 본다."""
    h = (code_hex or "").lower()
    if not h.startswith("0x") or len(h) <= 2:
        return 0, None
    n = (len(h) - 2) // 2
    if n == 23 and h.startswith("0xef0100"):
        return 0, "0x" + h[8:48]
    return n, None


def pick_chain(active: Dict[str, dict], hints: List[str]) -> str:
    """활동 체인 중 하나를 고른다: 힌트 체인 우선(코드 > 활동), 없으면 코드가 있는 첫 체인, 없으면 nonce 가 가장 큰 체인."""
    if not active:
        return ""
    for h in hints:
        if h in active and (active[h].get("code") or active[h].get("nonce")):
            return h
    for h in hints:
        if h in active:
            return h
    with_code = [c for c in DEFAULT_PROBE_ORDER if c in active and active[c].get("code")]
    if with_code:
        return with_code[0]
    return max(active.items(), key=lambda kv: (kv[1].get("nonce", 0), kv[1].get("balance", 0)))[0]


# ---------------------------------------------------------------------------
class OKLink:
    """OKLink Onchain Data API (선택). 키: OKLINK_API_KEY 또는 api_key_file. 실패는 조용히 무시."""
    CHAIN = {"Ethereum": "eth", "BSC": "bsc", "Polygon": "polygon", "Arbitrum": "arbitrum", "Optimism": "op", "Base": "base", "Avalanche": "avaxc",
             "Tron": "tron", "Bitcoin": "btc", "Solana": "sol", "Linea": "linea", "Cronos": "cronos", "Sonic": "sonic"}

    def __init__(self, session: requests.Session, key: str, base: str = "https://www.oklink.com"):
        self.s, self.key, self.base = session, key, base.rstrip("/")
        self.calls = 0

    def _get(self, path: str, params: dict) -> Optional[list]:
        try:
            r = self.s.get(self.base + path, params=params, headers={"Ok-Access-Key": self.key, "Accept": "application/json"}, timeout=20)
            self.calls += 1
            if r.status_code != 200:
                return None
            j = r.json()
            if str(j.get("code")) != "0":
                return None
            return j.get("data") or []
        except Exception:
            return None

    def summary(self, chain: str, address: str) -> dict:
        cs = self.CHAIN.get(chain)
        if not cs:
            return {}
        d = self._get("/api/v5/explorer/address/address-summary", {"chainShortName": cs, "address": address})
        if not d:
            return {}
        x = d[0] if isinstance(d, list) else d
        return {k: x.get(k) for k in ("contractAddress", "isAaAddress", "transactionCount", "firstTransactionTime", "lastTransactionTime", "balance", "balanceSymbol", "token", "createContractAddress") if k in x}

    def labels(self, chain: str, address: str) -> List[str]:
        cs = self.CHAIN.get(chain)
        if not cs:
            return []
        d = self._get("/api/v5/explorer/address/entity-label", {"chainShortName": cs, "address": address})
        out: List[str] = []
        for x in d or []:
            for k in ("label", "entity", "entityLabel", "tag"):
                v = x.get(k) if isinstance(x, dict) else None
                if v and str(v) not in out:
                    out.append(str(v))
        return out[:5]


# ---------------------------------------------------------------------------
class AddrChecker:
    def __init__(self, data_dir: str, cfg: Optional[dict] = None):
        cfg = dict(cfg or {})
        self.rpc: Dict[str, List[str]] = {k: list(v) for k, v in DEFAULT_EVM_RPC.items()}
        for k, v in (cfg.get("rpc") or {}).items():
            self.rpc[norm_chain(k)] = [v] if isinstance(v, str) else list(v)
        self.probe_order = [norm_chain(c) for c in cfg.get("probe_order", DEFAULT_PROBE_ORDER) if norm_chain(c) in self.rpc]
        self.path = os.path.join(data_dir, "address_labels.json")
        self.cache: Dict[str, dict] = {}
        if os.path.exists(self.path):
            try:
                with open(self.path, encoding="utf-8") as f:
                    self.cache = json.load(f)
            except Exception:
                self.cache = {}
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": "crypto-incident-collector/0.1 (address verification)"})
        self.lock = threading.Lock()
        self.oklink: Optional[OKLink] = None
        key = os.environ.get(cfg.get("oklink_key_env", "OKLINK_API_KEY"), "")
        kf = cfg.get("oklink_key_file", "../vllm/oklink.txt")
        if not key and kf:
            p = kf if os.path.isabs(kf) else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), kf)
            if os.path.exists(p):
                key = open(p, encoding="utf-8").read().strip()
        if key:
            self.oklink = OKLink(self.s, key, cfg.get("oklink_base", "https://www.oklink.com"))
        self.stats = {"rpc_calls": 0, "rpc_errors": 0}

    # ---- 캐시 ----
    @staticmethod
    def key(address: str) -> str:
        a = (address or "").strip()
        return a.lower() if (a.startswith("0x") or re.match(r"(?i)^(bc1|ltc1|osmo1|nomic1|noble1|axelar1|cosmos1)", a)) else a

    def save(self) -> None:
        with self.lock:
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=0, sort_keys=True)
            os.replace(tmp, self.path)

    # ---- JSON-RPC ----
    def _rpc_batch(self, chain: str, calls: List[Tuple[str, list]]) -> List[Optional[str]]:
        body = [{"jsonrpc": "2.0", "id": i + 1, "method": m, "params": p} for i, (m, p) in enumerate(calls)]
        for url in self.rpc.get(chain, []):
            try:
                self.stats["rpc_calls"] += 1
                r = self.s.post(url, json=body, timeout=25)
                if r.status_code != 200:
                    continue
                j = r.json()
                if isinstance(j, dict):
                    j = [j]
                by = {x.get("id"): x for x in j if isinstance(x, dict)}
                if not by:
                    continue
                return [by.get(i + 1, {}).get("result") for i in range(len(calls))]
            except Exception:
                self.stats["rpc_errors"] += 1
                continue
        return [None] * len(calls)

    def _probe_chain(self, chain: str, addr: str) -> Optional[dict]:
        code, nonce, bal = self._rpc_batch(chain, [("eth_getCode", [addr, "latest"]), ("eth_getTransactionCount", [addr, "latest"]), ("eth_getBalance", [addr, "latest"])])
        if code is None and nonce is None:
            return None  # RPC 실패
        code_len, delegate = parse_code(code if isinstance(code, str) else "")
        n = int(nonce, 16) if isinstance(nonce, str) and nonce.startswith("0x") else 0
        b = int(bal, 16) if isinstance(bal, str) and bal.startswith("0x") else 0
        return {"code": code_len, "nonce": n, "balance": b / 1e18, "delegate": delegate}

    def _classify_evm(self, chain: str, addr: str) -> dict:
        names = ["symbol", "name", "decimals", "totalSupply", "token0", "token1", "fee", "getPoolId", "asset", "underlying", "UNDERLYING_ASSET_ADDRESS",
                 "getOwners", "implementation", "factory", "WETH", "supportsInterface721"]
        calls = [("eth_call", [{"to": addr, "data": SEL[n]}, "latest"]) for n in names] + [("eth_getStorageAt", [addr, EIP1967_IMPL_SLOT, "latest"])]
        res = self._rpc_batch(chain, calls)
        return classify_contract({n: res[i] for i, n in enumerate(names)}, impl_slot=res[-1])

    # ---- 패밀리별 조회 ----
    def _check_evm(self, addr: str, hints: List[str]) -> dict:
        order = [h for h in hints if h in self.rpc] + [c for c in self.probe_order if c not in hints]
        active: Dict[str, dict] = {}
        failed: List[str] = []
        for chain in order:
            p = self._probe_chain(chain, addr)
            if p is None:
                failed.append(chain)
                continue
            if p["code"] or p["nonce"] or p["balance"] > 0:
                active[chain] = p
            if chain in hints and (p["code"] or p["nonce"]):
                break  # 힌트 체인에서 활동 확인 → 나머지는 보지 않는다
        chain = pick_chain(active, hints)
        out = {"family": "evm", "chains_active": sorted(active), "chain": chain, "rpc_failed": failed}
        if not chain:
            out.update(kind="unknown" if failed and not active else "unfunded", tx_count=0)
            return out
        a = active[chain]
        out.update(tx_count=a["nonce"], balance=round(a["balance"], 6), code_size=a["code"])
        if a["code"]:
            out["kind"] = "contract"
            out.update(self._classify_evm(chain, addr))
        else:
            out["kind"] = "eoa"
            if a.get("delegate"):  # EIP-7702: EOA 가 스마트 계정 구현에 위임(0xef0100 + 주소). 컨트랙트가 아니다.
                out["delegated"] = a["delegate"]
        return out

    def _check_btc(self, addr: str) -> dict:
        out = {"family": "btc", "chain": "Bitcoin", "kind": "wallet"}
        for base in ("https://mempool.space/api/address/", "https://blockstream.info/api/address/"):
            try:
                r = self.s.get(base + addr, timeout=20)
                if r.status_code != 200:
                    continue
                j = r.json(); c = j.get("chain_stats", {})
                out.update(tx_count=c.get("tx_count", 0), balance=round((c.get("funded_txo_sum", 0) - c.get("spent_txo_sum", 0)) / 1e8, 8),
                           received_btc=round(c.get("funded_txo_sum", 0) / 1e8, 8))
                return out
            except Exception:
                continue
        out["kind"] = "unknown"
        return out

    def _check_tron(self, addr: str) -> dict:
        out = {"family": "tron", "chain": "Tron", "kind": "unknown"}
        j = None
        with _TRON_GATE:  # trongrid 는 키 없이 초당 몇 건만 허용 → 직렬 + 짧은 간격, 429/5xx 는 재시도
            for attempt in range(4):
                try:
                    r = self.s.post("https://api.trongrid.io/wallet/getaccount", json={"address": addr, "visible": True}, timeout=20)
                    if r.status_code == 200:
                        j = r.json()
                        break
                    if r.status_code in (429, 403) or r.status_code >= 500:
                        time.sleep(1.5 * (attempt + 1))
                        continue
                    break
                except Exception:
                    time.sleep(1.0)
                finally:
                    time.sleep(0.12)
        if j is None:
            return out
        if not j:
            out.update(kind="unfunded", tx_count=0)
            return out
        out.update(balance=round(int(j.get("balance", 0)) / 1e6, 6), first_seen=_ms(j.get("create_time")), last_seen=_ms(j.get("latest_opration_time")))
        if j.get("type") == "Contract":
            out["kind"] = "contract"; out["ctype"] = "contract"
            try:
                c = self.s.post("https://api.trongrid.io/wallet/getcontract", json={"value": addr, "visible": True}, timeout=20).json()
                out["name"] = (c.get("name") or "")[:60]
                abi = json.dumps(c.get("abi", {}))
                if '"symbol"' in abi and '"decimals"' in abi:
                    out["ctype"] = "token"
            except Exception:
                pass
        else:
            out["kind"] = "eoa"
        return out

    def _check_sol(self, addr: str) -> dict:
        out = {"family": "sol", "chain": "Solana", "kind": "unknown"}
        try:
            r = self.s.post("https://api.mainnet-beta.solana.com", json={"jsonrpc": "2.0", "id": 1, "method": "getAccountInfo", "params": [addr, {"encoding": "jsonParsed"}]}, timeout=20)
            v = (r.json().get("result") or {}).get("value")
        except Exception:
            return out
        if v is None:
            out.update(kind="unfunded")
            return out
        owner = v.get("owner", "")
        out["balance"] = round(v.get("lamports", 0) / 1e9, 6)
        if v.get("executable"):
            out.update(kind="contract", ctype="program")
        elif owner in ("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"):
            typ = ((v.get("data") or {}).get("parsed") or {}).get("type", "")
            out.update(kind="contract", ctype="mint" if typ == "mint" else "token_account")
        else:
            out.update(kind="eoa")
        return out

    # ---- 진입점 ----
    def check(self, address: str, hints: Optional[List[str]] = None, force: bool = False) -> dict:
        k = self.key(address)
        hints = [norm_chain(h) for h in (hints or []) if h]
        cached = self.cache.get(k)
        if cached and not force and cached.get("kind") not in ("unknown", "unfunded", None):
            return cached
        v = validate(address)
        res = {"address": address, "checked_at": datetime.now().isoformat(timespec="seconds"), "family": v["family"], "valid": v["valid"],
               "fixed": v["fixed"], "reason": v["reason"], "hints": hints}
        if v["kind_hint"] == "txhash":
            res.update(kind="txhash", chain="")
        elif not v["valid"]:
            res.update(kind="invalid", chain=v["chain"])
        elif v["family"] == "evm":
            res.update(self._check_evm(v["fixed"] or address.lower(), hints))
        elif v["family"] == "btc":
            res.update(self._check_btc(v["fixed"] or address)); res["btype"] = v["kind_hint"]
        elif v["family"] == "tron":
            res.update(self._check_tron(address))
        elif v["family"] == "sol":
            res.update(self._check_sol(address))
        else:
            res.update(kind="wallet", chain=v["chain"])
        if self.oklink and res.get("chain") and res.get("kind") in ("eoa", "contract", "wallet"):
            s = self.oklink.summary(res["chain"], v["fixed"] or address)
            if s:
                res["oklink"] = s
                if s.get("transactionCount") not in (None, "") and not res.get("tx_count"):
                    try:
                        res["tx_count"] = int(float(s["transactionCount"]))
                    except ValueError:
                        pass
                res["first_seen"] = _ms(s.get("firstTransactionTime")) or res.get("first_seen")
                res["last_seen"] = _ms(s.get("lastTransactionTime")) or res.get("last_seen")
            lb = self.oklink.labels(res["chain"], v["fixed"] or address)
            if lb:
                res["labels"] = lb
            time.sleep(0.25)
        res["label"] = _label(res)
        with self.lock:
            self.cache[k] = res
        return res


def _ms(v) -> str:
    try:
        n = int(v)
        return datetime.fromtimestamp(n / 1000).strftime("%Y-%m-%d") if n > 0 else ""
    except (TypeError, ValueError):
        return ""


def _label(r: dict) -> str:
    """표시용 한 줄 라벨: OKLink 엔티티 > 컨트랙트 이름/심볼 > 풀 구성."""
    if r.get("labels"):
        return r["labels"][0][:40]
    if r.get("kind") == "contract":
        sym, name = r.get("symbol") or "", r.get("name") or ""
        if r.get("ctype") in ("lp_pool", "v3_pool") and sym:
            return sym[:30]
        return (name or sym)[:40]
    return ""


# ---------------------------------------------------------------------------
# 카드 교정 + 보고서
def apply_to_incident(inc: Incident, results: Dict[str, dict]) -> List[str]:
    """검증 결과를 카드에 반영(사실 교정만). 변경 내역 문자열 목록을 돌려준다."""
    changes: List[str] = []
    keep: List[Address] = []
    for a in inc.addresses:
        r = results.get(AddrChecker.key(a.address))
        if not r:
            keep.append(a)
            continue
        if r.get("kind") == "txhash":
            if a.address not in inc.tx_hashes:
                inc.tx_hashes.append(a.address)
            changes.append(f"tx_hash_moved {a.address[:18]}…")
            continue
        if r.get("kind") == "invalid":
            changes.append(f"invalid_removed {a.address[:18]}… ({r.get('reason')})")
            continue
        if r.get("kind") == "unfunded" and r.get("family") == "evm" and not r.get("rpc_failed"):
            # 11개 EVM 체인 어디에도 코드·nonce·잔액이 없는 주소: 메모가 tx 를 가리키면 tx 해시를 40자로 자른 것, 컨트랙트라 하면 존재하지 않는 컨트랙트(코드가 있었다면 nonce≥1)
            if _TX_NOTE_RE.search(a.note or ""):
                changes.append(f"truncated_tx_removed {a.address[:18]}… ({(a.note or '')[:30]})")
                continue
            if _PHANTOM_NOTE_RE.search(a.note or ""):
                changes.append(f"phantom_contract_removed {a.address[:18]}… ({(a.note or '')[:30]})")
                continue
        if r.get("fixed") and r["fixed"] != a.address and r.get("reason") == "eip55_mismatch":
            changes.append(f"case_fixed {a.address[:14]}…"); a.address = r["fixed"]
        elif r.get("fixed") and r["fixed"] != a.address:
            changes.append(f"case_fixed {a.address[:14]}…"); a.address = r["fixed"]
        ch = r.get("chain")
        if ch and norm_chain(a.chain) != ch and r.get("kind") in ("eoa", "contract", "wallet"):
            changes.append(f"chain {a.address[:10]}… {norm_chain(a.chain) or '-'}→{ch}"); a.chain = ch
        # 주소 형식만으로 체인이 확정되는 패밀리(BTC·Tron·Cosmos bech32·Solana)는 카드의 체인 목록에도 반영한다 (EVM 은 여러 체인에 같은 주소가 있어 제외)
        if ch and r.get("family") in ("btc", "tron", "cosmos", "sol") and r.get("kind") in ("eoa", "contract", "wallet") and ch not in [norm_chain(c) for c in inc.chains]:
            inc.chains.append(ch); changes.append(f"chains += {ch}")
        if r.get("kind") == "contract" and r.get("ctype") in INFRA_CTYPES and a.role == "attacker":
            changes.append(f"role {a.address[:10]}… attacker→unknown ({r.get('ctype')})"); a.role = "unknown"
            tag = CTYPE_KO.get(r.get("ctype"), r.get("ctype"))
            if tag and tag not in (a.note or ""):
                a.note = ((a.note + " · ") if a.note else "") + f"컨트랙트({tag})"
        keep.append(a)
    inc.addresses = keep
    return changes


def run_addrcheck(store, data_dir: str, cfg: Optional[dict] = None, force: bool = False, limit: int = 0, cards: Optional[List[Incident]] = None,
                  report: bool = True, workers: int = 4) -> dict:
    """모든(또는 주어진) 카드의 주소를 검증하고 카드를 교정한다. 보고서: data/audits/addresses-<날짜>.md"""
    from concurrent.futures import ThreadPoolExecutor
    from .store import incident_from_dict

    ck = AddrChecker(data_dir, cfg)
    if cards is None:
        cards = [incident_from_dict(json.loads(r[0])) for r in store.conn.execute("SELECT json FROM incidents WHERE relevant=1 ORDER BY collected_at").fetchall()]
    jobs: Dict[str, Tuple[str, List[str]]] = {}
    for inc in cards:
        for a in inc.addresses:
            k = AddrChecker.key(a.address)
            if k not in jobs:
                jobs[k] = (a.address, list(inc.chains) + ([a.chain] if a.chain else []))
    if limit:
        jobs = dict(list(jobs.items())[:limit])
    todo = [(k, v) for k, v in jobs.items() if force or ck.cache.get(k, {}).get("kind") in (None, "unknown", "unfunded")]
    log.info("주소 검증: 대상 %d, 조회 %d (캐시 %d), OKLink=%s", len(jobs), len(todo), len(jobs) - len(todo), "on" if ck.oklink else "off")
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for _ in ex.map(lambda kv: ck.check(kv[1][0], kv[1][1], force=force), todo):
            done += 1
            if done % 25 == 0:
                ck.save()
    ck.save()
    results = {k: ck.cache[k] for k in jobs if k in ck.cache}
    # 카드 교정
    changed_days: set = set()
    change_log: List[Tuple[str, str, List[str]]] = []
    for inc in cards:
        ch = apply_to_incident(inc, results)
        if ch:
            _save_retry(store, inc)
            changed_days.add((inc.collected_at or "")[:10])
            change_log.append((inc.uid, inc.project or inc.title, ch))
    kinds = {}
    for r in results.values():
        k = r.get("kind") or "?"
        kinds[k] = kinds.get(k, 0) + 1
    ctypes = {}
    for r in results.values():
        if r.get("kind") == "contract":
            c = r.get("ctype") or "contract"
            ctypes[c] = ctypes.get(c, 0) + 1
    summ = {"addresses": len(jobs), "checked": len(todo), "kinds": kinds, "ctypes": ctypes, "cards_changed": len(change_log),
            "changes": sum(len(c[2]) for c in change_log), "days": sorted(d for d in changed_days if d), "rpc": ck.stats, "oklink": bool(ck.oklink)}
    if report:
        summ["report"] = write_report(data_dir, cards, results, change_log, summ)
    return summ


def _save_retry(store, inc: Incident) -> None:
    import sqlite3
    for _ in range(6):
        try:
            store.save_incident(inc)
            return
        except sqlite3.OperationalError:
            time.sleep(1)
    store.save_incident(inc)


def kind_text(r: dict) -> str:
    k = r.get("kind")
    if k == "contract":
        return "CA · " + CTYPE_KO.get(r.get("ctype") or "contract", r.get("ctype") or "컨트랙트")
    if k == "eoa" and r.get("delegated"):
        return "EOA · 7702"
    return {"eoa": "EOA", "wallet": "지갑", "txhash": "TX 해시", "invalid": "무효", "unfunded": "미사용", "unknown": "미확인"}.get(k or "", k or "-")


def write_report(data_dir: str, cards: List[Incident], results: Dict[str, dict], change_log, summ: dict) -> str:
    day = datetime.now().strftime("%Y-%m-%d")
    d = os.path.join(data_dir, "audits"); os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"addresses-{day}.md")
    owner: Dict[str, Tuple[str, str, str]] = {}
    for inc in cards:
        for a in inc.addresses:
            owner.setdefault(AddrChecker.key(a.address), (inc.project or inc.title, a.role, a.note or ""))
    L = [f"# 지갑 주소 검증 보고서 · {day}", "", f"- 주소 {summ['addresses']} · 이번 조회 {summ['checked']} · 카드 변경 {summ['cards_changed']} ({summ['changes']}건) · OKLink {'사용' if summ['oklink'] else '미사용(키 없음)'}",
         f"- 종류: " + ", ".join(f"{kind_text({'kind': k})} {v}" for k, v in sorted(summ["kinds"].items(), key=lambda x: -x[1])),
         f"- 컨트랙트 유형: " + (", ".join(f"{CTYPE_KO.get(k, k)} {v}" for k, v in sorted(summ["ctypes"].items(), key=lambda x: -x[1])) or "-"), ""]
    if change_log:
        L += ["## 카드 교정", ""]
        for uid, proj, ch in change_log:
            L.append(f"- **{proj}** (`{uid}`): " + "; ".join(ch))
        L.append("")
    L += ["## 주소별 결과", "", "| 주소 | 체인 | 종류 | 라벨 | 역할 | 사건 | tx | 비고 |", "|---|---|---|---|---|---|---:|---|"]
    def row_key(kv):
        r = kv[1]; return (0 if r.get("kind") in ("txhash", "invalid") else 1 if r.get("kind") == "contract" else 2, kv[0])
    for k, r in sorted(results.items(), key=row_key):
        proj, role, note = owner.get(k, ("", "", ""))
        extra = [] if k in owner else ["카드에서 제거됨"]
        if r.get("chains_active") and len(r["chains_active"]) > 1:
            extra.append("활동 체인: " + "/".join(r["chains_active"]))
        if r.get("proxy"):
            extra.append("proxy→" + (r.get("impl") or "")[:12])
        if r.get("reason"):
            extra.append(r["reason"])
        if r.get("oklink", {}).get("isAaAddress"):
            extra.append("AA")
        L.append(f"| `{r.get('address', k)[:46]}` | {r.get('chain') or '-'} | {kind_text(r)} | {r.get('label') or '-'} | {role} | {proj[:24]} | {r.get('tx_count', '') if r.get('tx_count') is not None else ''} | {'; '.join(extra)} |")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    with open(path[:-3] + ".json", "w", encoding="utf-8") as f:
        json.dump({"summary": summ, "changes": [{"uid": u, "project": p, "changes": c} for u, p, c in change_log]}, f, ensure_ascii=False, indent=1)
    return path
