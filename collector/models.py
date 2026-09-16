"""데이터 모델: 수집 원본(RawItem) → 분석 결과(Incident)."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field, asdict
from typing import List, Optional


ROLES = ("attacker", "laundering", "victim", "sanctioned", "unknown")

INCIDENT_TYPES = (
    "hack_exploit",                 # 스마트컨트랙트/프로토콜 익스플로잇
    "private_key_compromise",       # 개인키·서명키 탈취
    "rug_pull",                     # 러그풀·내부자 탈취
    "phishing_social_engineering",  # 피싱·소셜엔지니어링·주소 오염
    "scam_fraud",                   # 투자사기·돼지도살 등
    "ransomware",
    "sanctions_designation",        # OFAC 등 제재 지정
    "law_enforcement_action",       # 기소·체포·압수·몰수
    "laundering_report",            # 자금세탁 분석 보고
    "other",
)

INCIDENT_TYPE_KO = {
    "hack_exploit": "해킹/익스플로잇",
    "private_key_compromise": "개인키 탈취",
    "rug_pull": "러그풀",
    "phishing_social_engineering": "피싱/소셜엔지니어링",
    "scam_fraud": "사기",
    "ransomware": "랜섬웨어",
    "sanctions_designation": "제재 지정",
    "law_enforcement_action": "수사/기소/압수",
    "laundering_report": "자금세탁 분석",
    "other": "기타",
}

ROLE_KO = {
    "attacker": "공격자",
    "laundering": "세탁/경유",
    "victim": "피해자",
    "sanctioned": "제재 대상",
    "unknown": "미분류",
}


@dataclass
class Address:
    chain: str
    address: str
    role: str = "unknown"
    note: str = ""

    def key(self) -> tuple:
        addr = self.address.lower() if self.address.startswith("0x") else self.address
        return (self.chain.upper(), addr)


@dataclass
class RawItem:
    """소스에서 수집한 원본 항목."""

    source: str            # rekt | lumos | trm | chainalysis | ofac | ofac_sdn | doj | defillama | rss:<name>
    source_id: str         # 소스 내 고유값 (URL, slug, uid 등)
    url: str
    title: str
    published_at: str      # YYYY-MM-DD
    text: str = ""         # LLM에 전달할 본문
    summary_hint: str = "" # 메타 description / teaser
    structured: dict = field(default_factory=dict)  # 구조화 소스의 원본 필드
    addresses: List[Address] = field(default_factory=list)  # 소스가 명시한 주소
    tx_hashes: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    needs_llm: bool = True

    @property
    def uid(self) -> str:
        return hashlib.sha1(f"{self.source}|{self.source_id}".encode("utf-8")).hexdigest()[:16]


@dataclass
class Incident:
    """분석(요약)까지 끝난 사건 카드."""

    uid: str
    source: str
    source_id: str
    url: str
    title: str
    published_at: str
    collected_at: str

    relevant: bool = True
    relevance_reason: str = ""
    incident_type: str = "other"
    project: str = ""
    incident_date: Optional[str] = None
    chains: List[str] = field(default_factory=list)
    amount_usd: Optional[float] = None
    amount_text: str = ""
    attack_method_ko: str = ""
    background_ko: str = ""
    summary_ko: str = ""
    fund_flow_ko: str = ""
    attack_method_en: str = ""
    background_en: str = ""
    summary_en: str = ""
    fund_flow_en: str = ""
    actors: List[str] = field(default_factory=list)
    addresses: List[Address] = field(default_factory=list)
    tx_hashes: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    structured: dict = field(default_factory=dict)

    enriched: bool = False     # LLM 요약 성공 여부
    enrich_model: str = ""
    enrich_note: str = ""

    # 리포트 단계에서만 채워지는 필드 (DB 카드에는 비어 있음)
    merged_from: List[dict] = field(default_factory=list)   # 병합된 다른 소스 카드 [{uid, source, url, title, published_at}]
    blacklist_hits: dict = field(default_factory=dict)      # address → {sources, categories, labels} (crimial_hunter 대조)
    followup_of: Optional[dict] = None                      # 이전 날짜 사건의 후속 보도면 {uid, day, project, url, incident_date}

    def to_dict(self) -> dict:
        return asdict(self)

    def text(self, field_name: str, lang: str) -> str:
        """lang('ko'|'en')에 맞는 서술 필드. 없으면 다른 언어로 대체."""
        primary = getattr(self, f"{field_name}_{lang}", "")
        other = getattr(self, f"{field_name}_{'en' if lang == 'ko' else 'ko'}", "")
        return primary or other

    @property
    def group_key(self) -> str:
        """같은 사건을 여러 소스가 다룰 때 묶기 위한 키 (프로젝트명 정규화)."""
        import re
        name = (self.project or self.title or "").lower()
        name = re.sub(r"\b(finance|protocol|network|labs|dao|exchange|the)\b", " ", name)
        name = re.sub(r"[^a-z0-9가-힣]+", "", name)
        return name[:40]
