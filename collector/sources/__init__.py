"""소스 레지스트리."""
from __future__ import annotations

from typing import Dict, List

from .base import Source, SourceContext
from .chainalysis_trm import ChainalysisSource, GenericRssSource, TrmSource
from .defihacklabs import DefiHackLabsSource
from .defillama import DefiLlamaSource
from .doj import DojSource
from .lumos import LumosSource
from .ofac import OfacRecentActionsSource, OfacSdnDiffSource
from .rekt import RektSource
from .scamsniffer import ScamSnifferSource
from .slowmist import SlowMistSource
from .zachxbt import ZachXbtSource

_SIMPLE = {
    "rekt": RektSource,
    "lumos": LumosSource,
    "defillama": DefiLlamaSource,
    "trm": TrmSource,
    "chainalysis": ChainalysisSource,
    "doj": DojSource,
    "slowmist": SlowMistSource,
    "zachxbt": ZachXbtSource,
    "scamsniffer": ScamSnifferSource,
    "defihacklabs": DefiHackLabsSource,
}


def build_sources(cfg: dict) -> List[Source]:
    scfg: Dict[str, dict] = cfg.get("sources", {})
    out: List[Source] = []

    def on(name: str) -> bool:
        return bool((scfg.get(name) or {}).get("enabled", False))

    for name, cls in _SIMPLE.items():
        if on(name):
            out.append(cls(scfg[name]))
    if on("ofac"):
        out.append(OfacRecentActionsSource(scfg["ofac"]))
        if scfg["ofac"].get("sdn_diff", True):
            out.append(OfacSdnDiffSource(scfg["ofac"]))
    for extra in scfg.get("extra_rss") or []:
        if extra.get("enabled", True):
            out.append(GenericRssSource(extra))
    return out


__all__ = ["Source", "SourceContext", "build_sources"]
