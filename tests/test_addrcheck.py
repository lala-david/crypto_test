"""주소 검증 모듈: 네트워크 없이 형식 검증·EIP-55·bech32·컨트랙트 유형 판별·체인 선택·카드 교정."""
from collector.addrcheck import AddrChecker, apply_to_incident, classify_contract, eip55, keccak256, pick_chain, validate
from collector.models import Address, Incident


def test_keccak_and_eip55():
    assert keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
    assert eip55("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed") == "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"


def test_validate_formats():
    ok = validate("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"); assert ok["valid"] and ok["fixed"] is None
    bad = validate("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD"); assert bad["valid"] and bad["fixed"] == "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed" and bad["reason"] == "eip55_mismatch"
    assert validate("0x75b42eceb283eaa88303d23bca8f9ccc6c5579cdfc1e8c757ea1e33118dd125b")["kind_hint"] == "txhash"
    assert validate("bc1ql4mfu6aundtkksxklfajs2h3t9nzcd6gyqjlte")["valid"]
    assert not validate("bc1ql4mfu6aundtkksxklfajs2h3t9nzcd6gyqjltf")["valid"]
    v = validate("Nomic1rk07saqmvfle50h4h9hul00g67xzrcc5ytfxjm"); assert v["family"] == "cosmos" and v["valid"] and v["fixed"] == "nomic1rk07saqmvfle50h4h9hul00g67xzrcc5ytfxjm"
    assert validate("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")["valid"] and not validate("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u")["valid"]
    assert validate("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")["family"] == "sol"


def _str(s: str) -> str:
    b = s.encode(); return "0x" + (32).to_bytes(32, "big").hex() + len(b).to_bytes(32, "big").hex() + b.hex().ljust(64, "0")


def _addr(a: str) -> str:
    return "0x" + a[2:].lower().rjust(64, "0")


def _u(n: int) -> str:
    return "0x" + n.to_bytes(32, "big").hex()


def test_classify_contract():
    assert classify_contract({"symbol": _str("USDT"), "decimals": _u(6)})["ctype"] == "token"
    lp = classify_contract({"symbol": _str("Cake-LP"), "decimals": _u(18), "token0": _addr("0x" + "1" * 40), "token1": _addr("0x" + "2" * 40)})
    assert lp["ctype"] == "lp_pool"
    assert classify_contract({"token0": _addr("0x" + "1" * 40), "token1": _addr("0x" + "2" * 40), "fee": _u(3000)})["ctype"] == "v3_pool"
    assert classify_contract({"factory": _addr("0x" + "3" * 40), "WETH": _addr("0x" + "4" * 40)})["ctype"] == "router"
    assert classify_contract({"symbol": _str("aWHYPE"), "decimals": _u(18), "UNDERLYING_ASSET_ADDRESS": _addr("0x" + "5" * 40)})["ctype"] == "atoken"
    owners = "0x" + (32).to_bytes(32, "big").hex() + (2).to_bytes(32, "big").hex() + ("1" * 64) + ("2" * 64)
    assert classify_contract({"getOwners": owners})["ctype"] == "safe"
    px = classify_contract({}, impl_slot=_addr("0x" + "6" * 40)); assert px["ctype"] == "proxy" and px["proxy"]
    assert classify_contract({})["ctype"] == "contract"


def test_pick_chain_prefers_hint_then_code():
    active = {"Ethereum": {"code": 13520, "nonce": 1}, "BSC": {"code": 43874, "nonce": 1}}
    assert pick_chain(active, ["BSC"]) == "BSC"
    assert pick_chain(active, []) == "Ethereum"
    assert pick_chain({"Ethereum": {"code": 0, "nonce": 5}, "Base": {"code": 0, "nonce": 40}}, []) == "Base"
    assert pick_chain({}, ["BSC"]) == ""


def test_apply_to_incident_fixes_cards():
    inc = Incident(uid="u", source="s", source_id="1", url="u", title="t", published_at="2026-09-01", collected_at="2026-09-02T00:00:00", chains=["BSC"],
                   addresses=[Address(chain="ETH", address="0x10ed43c718714eb63d5aa57b78b54704e256024e", role="attacker", note="Router"),
                              Address(chain="ETH", address="0x75b42eceb283eaa88303d23bca8f9ccc6c5579cdfc1e8c757ea1e33118dd125b", role="unknown"),
                              Address(chain="NOMIC", address="Nomic1rk07saqmvfle50h4h9hul00g67xzrcc5ytfxjm", role="attacker"),
                              Address(chain="ETH", address="0xdeadbeef00000000000000000000000000000000", role="attacker")])
    res = {AddrChecker.key("0x10ed43c718714eb63d5aa57b78b54704e256024e"): {"kind": "contract", "ctype": "router", "chain": "BSC"},
           AddrChecker.key("0x75b42eceb283eaa88303d23bca8f9ccc6c5579cdfc1e8c757ea1e33118dd125b"): {"kind": "txhash"},
           AddrChecker.key("Nomic1rk07saqmvfle50h4h9hul00g67xzrcc5ytfxjm"): {"kind": "wallet", "chain": "Nomic", "fixed": "nomic1rk07saqmvfle50h4h9hul00g67xzrcc5ytfxjm"},
           AddrChecker.key("0xdeadbeef00000000000000000000000000000000"): {"kind": "eoa", "chain": "BSC"}}
    ch = apply_to_incident(inc, res)
    assert len(inc.addresses) == 3 and inc.tx_hashes == ["0x75b42eceb283eaa88303d23bca8f9ccc6c5579cdfc1e8c757ea1e33118dd125b"]
    router = inc.addresses[0]; assert router.chain == "BSC" and router.role == "unknown" and "라우터" in router.note
    assert inc.addresses[1].address.startswith("nomic1") and inc.addresses[2].chain == "BSC"
    assert any(c.startswith("tx_hash_moved") for c in ch) and any(c.startswith("role ") for c in ch)


def test_parse_code_eip7702_delegation_is_eoa():
    from collector.addrcheck import parse_code
    assert parse_code("0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b") == (0, "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b")
    assert parse_code("0x") == (0, None) and parse_code("") == (0, None)
    assert parse_code("0x6080604052" + "00" * 100)[0] == 105 and parse_code("0x6080604052" + "00" * 100)[1] is None


def test_merge_explorer_rules():
    from collector.addrcheck import merge_explorer
    # 7702 위임 EOA: Blockscout 가 is_contract=True 라 해도 EOA 유지, 구현체 이름은 라벨로
    r = merge_explorer({"kind": "eoa", "delegated": "0xabc", "tx_count": 17}, {"is_contract": True, "implementations": [{"name": "EIP7702StatelessDeleGator"}]})
    assert r["kind"] == "eoa" and r["impl_name"] == "EIP7702StatelessDeleGator"
    # 순수 EOA 인데 탐색기가 컨트랙트라 하고 nonce≥1 → 자기파괴 컨트랙트
    r = merge_explorer({"kind": "eoa", "tx_count": 1}, {"is_contract": True})
    assert r["kind"] == "contract" and r["ctype"] == "destroyed"
    # 순수 EOA + 탐색기 EOA + 총 tx 4418 → tx_count 갱신, scam 플래그
    r = merge_explorer({"kind": "eoa", "tx_count": 12}, {"is_contract": False, "is_scam": True, "_tx_total": 4418})
    assert r["tx_count"] == 4418 and r["scam"] is True
    # 컨트랙트 이름: Blockscout 이름 > 토큰 이름; Sourcify 는 이름 없을 때만
    r = merge_explorer({"kind": "contract", "ctype": "contract"}, {"is_contract": True, "name": "GnosisSafeProxy", "is_verified": True}, "Other")
    assert r["name"] == "GnosisSafeProxy" and r["verified"]
    r = merge_explorer({"kind": "contract", "ctype": "contract"}, None, "PancakeRouter")
    assert r["name"] == "PancakeRouter" and r["explorer"]["src"] == "sourcify"


def test_collapse_followups_folds_into_original():
    from collector.service import collapse_followups
    o = {"uid": "a", "day": "2026-09-15", "event_date": "2026-09-14", "project": "X", "title": "X hacked", "source": "slowmist", "url": "u1", "amount_usd": 1.0,
         "sources": [{"source": "slowmist", "url": "u1"}], "addresses": [{"address": "0xAA", "role": "victim"}], "tx_hashes": ["0x1"], "blacklist_detail": {}, "blacklist_hits": 0, "followup_of": None}
    f = {"uid": "b", "day": "2026-09-17", "event_date": "2026-09-14", "project": "X", "title": "X follow", "source": "rekt", "url": "u2", "amount_usd": 2.0,
         "sources": [{"source": "rekt", "url": "u2"}, {"source": "slowmist", "url": "u1"}], "addresses": [{"address": "0xaa", "role": "attacker"}, {"address": "0xBB", "role": "unknown"}],
         "tx_hashes": ["0x1", "0x2"], "blacklist_detail": {"0xBB": {"sources": ["x"]}}, "blacklist_hits": 1, "followup_of": {"uid": "a"}}
    orphan = {"uid": "c", "day": "2026-09-18", "event_date": None, "project": "Y", "title": "Y", "source": "doj", "url": "u3", "amount_usd": None,
              "sources": [], "addresses": [], "tx_hashes": [], "blacklist_detail": {}, "blacklist_hits": 0, "followup_of": {"uid": "zzz"}}
    out = collapse_followups([f, o, orphan])
    assert [r["uid"] for r in out] == ["a", "c"]
    a = out[0]
    assert a["followup_count"] == 1 and a["followups"][0]["uid"] == "b" and a["last_day"] == "2026-09-17"
    assert [x["source"] for x in a["sources"]] == ["slowmist", "rekt"]            # URL 기준 중복 제거
    assert len(a["addresses"]) == 2 and a["addresses"][0]["role"] == "attacker"   # 역할 우선순위 승격
    assert a["tx_hashes"] == ["0x1", "0x2"] and a["blacklist_hits"] == 1
