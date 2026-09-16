"""LLM 공급자 추상화: Ollama(LAN/로컬) · OpenRouter/OpenAI 호환 · Claude API.

모든 공급자는 두 가지만 제공한다.
  complete_json(system, user, schema, max_tokens) -> dict | None   (구조화 출력)
  complete_text(system, user, max_tokens) -> str                   (자유 텍스트)
구조화 출력은 '스키마 강제 → JSON 모드 → 프롬프트 지시' 순으로 한 단계씩 내려가며 재시도한다.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

import requests

log = logging.getLogger("collector.llm")


def parse_json_text(text: str) -> Optional[dict]:
    """<think> 블록, 코드펜스 등을 걷어내고 첫 JSON 객체를 파싱."""
    if not text:
        return None
    t = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.S).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    start = t.find("{")
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(t)):
        if t[i] == "{":
            depth += 1
        elif t[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(t[start : i + 1])
                except json.JSONDecodeError:
                    return None
    return None


_NBSP = {" ": " ", " ": " ", " ": " ", "‑": "-", "‐": "-", "−": "-"}
_MONEY_RE = re.compile(r"\$\s*(\d[\d,]*(?:\.\d+)?)\s*([KkMmBb])(?![A-Za-z])")
_TIMES_RE = re.compile(r"(\d)\s*×")


def clean_text(s: str) -> str:
    """모델 출력의 표기 잡티 정리: 특수 공백/하이픈, '$320 M' → '$320M', '300 ×' → '300x'."""
    if not s:
        return s
    for k, v in _NBSP.items():
        s = s.replace(k, v)
    s = _MONEY_RE.sub(lambda m: "$" + m.group(1) + m.group(2).upper(), s)
    s = _TIMES_RE.sub(lambda m: m.group(1) + "x", s)
    s = re.sub(r"[ 	]{2,}", " ", s)
    return s.strip()


def _schema_hint(schema: dict, lang_note: str = "") -> str:
    return ("\n\n반드시 아래 JSON 스키마를 만족하는 JSON 객체 하나만 출력하세요. 설명, 코드펜스, 다른 텍스트 금지.\n"
            + json.dumps(schema, ensure_ascii=False) + lang_note)


class LLMProvider:
    name = "base"
    model = ""

    def complete_json(self, system: str, user: str, schema: dict, max_tokens: int) -> Optional[dict]:  # pragma: no cover
        raise NotImplementedError

    def complete_text(self, system: str, user: str, max_tokens: int) -> str:  # pragma: no cover
        raise NotImplementedError

    def describe(self) -> str:
        return f"{self.name}:{self.model}"


# ---------------------------------------------------------------------------
class OllamaProvider(LLMProvider):
    """Ollama 네이티브 /api/chat — format(JSON 스키마)·num_ctx 지원."""

    name = "ollama"

    def __init__(self, cfg: dict):
        self.base_url = (cfg.get("base_url") or "http://127.0.0.1:11434").rstrip("/")
        self.model = cfg.get("model") or "qwen3:8b"
        self.num_ctx = int(cfg.get("num_ctx", 32768))
        self.think = bool(cfg.get("think", False))
        self.timeout = int(cfg.get("timeout", 600))
        self._mode = "schema"  # schema → json → text

    def _chat(self, system: str, user: str, max_tokens: int, fmt=None) -> str:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "think": self.think,
            "options": {"num_ctx": self.num_ctx, "temperature": 0, "num_predict": max_tokens},
        }
        if fmt is not None:
            body["format"] = fmt
        r = requests.post(self.base_url + "/api/chat", json=body, timeout=self.timeout)
        if r.status_code >= 400:
            raise RuntimeError(f"ollama {r.status_code}: {r.text[:300]}")
        data = r.json()
        if data.get("done_reason") == "length":
            log.warning("ollama: 출력이 num_predict(%d)에서 잘림", max_tokens)
        return (data.get("message") or {}).get("content") or ""

    def complete_json(self, system, user, schema, max_tokens):
        while True:
            try:
                if self._mode == "schema":
                    text = self._chat(system, user, max_tokens, fmt=schema)
                elif self._mode == "json":
                    text = self._chat(system + _schema_hint(schema), user, max_tokens, fmt="json")
                else:
                    text = self._chat(system + _schema_hint(schema), user, max_tokens)
            except RuntimeError as e:
                if self._mode != "text":
                    log.warning("ollama %s 모드 실패 → 단순화 (%s)", self._mode, str(e)[:160])
                    self._mode = "json" if self._mode == "schema" else "text"
                    continue
                raise
            data = parse_json_text(text)
            if data is None and self._mode != "text":
                log.warning("ollama %s 모드 출력이 JSON이 아님 → 단순화", self._mode)
                self._mode = "json" if self._mode == "schema" else "text"
                continue
            return data

    def complete_text(self, system, user, max_tokens):
        return re.sub(r"<think>.*?</think>", "", self._chat(system, user, max_tokens), flags=re.S).strip()


# ---------------------------------------------------------------------------
class OpenAICompatProvider(LLMProvider):
    """OpenRouter · vLLM · LM Studio 등 OpenAI 호환 /v1/chat/completions."""

    name = "openai_compat"

    def __init__(self, cfg: dict, name: str = "openai_compat"):
        from openai import OpenAI

        self.name = name
        self.base_url = cfg.get("base_url") or "https://openrouter.ai/api/v1"
        self.model = cfg.get("model") or "google/gemini-3.8-flash"
        self.timeout = int(cfg.get("timeout", 300))
        api_key = os.environ.get(cfg.get("api_key_env") or "OPENROUTER_API_KEY", "")
        key_file = cfg.get("api_key_file")
        if not api_key and key_file:
            p = key_file if os.path.isabs(key_file) else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), key_file)
            if os.path.exists(p):
                with open(p, encoding="utf-8") as f:
                    api_key = f.read().strip()
        if not api_key:
            api_key = "sk-no-key"  # vLLM/LM Studio처럼 키가 필요 없는 서버용
        headers = {"HTTP-Referer": "https://github.com/", "X-Title": "crypto-incident-collector"} if "openrouter" in self.base_url else None
        self.client = OpenAI(base_url=self.base_url, api_key=api_key, timeout=self.timeout, default_headers=headers)
        self._mode = "schema"

    def _chat(self, system: str, user: str, max_tokens: int, response_format=None) -> str:
        kwargs = dict(
            model=self.model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=max_tokens,
            temperature=0,
        )
        if response_format is not None:
            kwargs["response_format"] = response_format
        resp = self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        if choice.finish_reason == "length":
            log.warning("%s: 출력이 max_tokens(%d)에서 잘림", self.name, max_tokens)
        return choice.message.content or ""

    def complete_json(self, system, user, schema, max_tokens):
        import openai

        while True:
            try:
                if self._mode == "schema":
                    rf = {"type": "json_schema", "json_schema": {"name": "result", "strict": True, "schema": schema}}
                    text = self._chat(system, user, max_tokens, rf)
                elif self._mode == "json":
                    text = self._chat(system + _schema_hint(schema), user, max_tokens, {"type": "json_object"})
                else:
                    text = self._chat(system + _schema_hint(schema), user, max_tokens)
            except (openai.BadRequestError, openai.UnprocessableEntityError) as e:
                if self._mode != "text":
                    log.warning("%s %s 모드 거부 → 단순화 (%s)", self.name, self._mode, str(e)[:160])
                    self._mode = "json" if self._mode == "schema" else "text"
                    continue
                raise
            data = parse_json_text(text)
            if data is None and self._mode != "text":
                log.warning("%s %s 모드 출력이 JSON이 아님 → 단순화", self.name, self._mode)
                self._mode = "json" if self._mode == "schema" else "text"
                continue
            return data

    def complete_text(self, system, user, max_tokens):
        return self._chat(system, user, max_tokens).strip()


# ---------------------------------------------------------------------------
class ClaudeProvider(LLMProvider):
    """Anthropic Claude API (ANTHROPIC_API_KEY 필요)."""

    name = "claude"

    def __init__(self, cfg: dict):
        import anthropic

        self.model = cfg.get("model") or "claude-opus-5"
        self.effort = cfg.get("effort") or "medium"
        self.client = anthropic.Anthropic()
        self._mode = "beta_fallback_schema"

    def _create(self, system: str, user: str, max_tokens: int, schema: Optional[dict]):
        import anthropic

        base = dict(model=self.model, max_tokens=max_tokens, system=system,
                    messages=[{"role": "user", "content": user}])
        while True:
            try:
                if schema is None:
                    return self.client.messages.create(output_config={"effort": self.effort}, **base)
                if self._mode == "beta_fallback_schema":
                    return self.client.beta.messages.create(
                        betas=["server-side-fallback-2026-07-01"], extra_body={"fallbacks": "default"},
                        output_config={"effort": self.effort, "format": {"type": "json_schema", "schema": schema}}, **base)
                if self._mode == "plain_schema":
                    return self.client.messages.create(
                        output_config={"effort": self.effort, "format": {"type": "json_schema", "schema": schema}}, **base)
                return self.client.messages.create(
                    output_config={"effort": self.effort}, **{**base, "system": system + _schema_hint(schema)})
            except anthropic.BadRequestError as e:
                if self._mode == "beta_fallback_schema":
                    self._mode = "plain_schema"
                elif self._mode == "plain_schema":
                    self._mode = "plain_json"
                else:
                    raise
                log.warning("claude 호출 거부 → %s 로 전환 (%s)", self._mode, e.message[:160])

    def complete_json(self, system, user, schema, max_tokens):
        resp = self._create(system, user, max_tokens, schema)
        if resp.stop_reason == "refusal":
            log.warning("claude: 응답 거부 (%s)", getattr(getattr(resp, "stop_details", None), "category", None))
            return None
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return parse_json_text(text)

    def complete_text(self, system, user, max_tokens):
        resp = self._create(system, user, max_tokens, None)
        return next((b.text for b in resp.content if b.type == "text"), "").strip()


# ---------------------------------------------------------------------------
def build_provider(llm_cfg: dict, override: Optional[str] = None, model_override: Optional[str] = None) -> Optional[LLMProvider]:
    """config.llm 에서 공급자 생성. 실패하면 None (규칙 기반 폴백). model_override 로 같은 공급자의 다른 모델 사용."""
    if not llm_cfg or not llm_cfg.get("enabled", True):
        return None
    name = override or llm_cfg.get("provider") or "ollama"
    sub = dict(llm_cfg.get(name) or {})
    if model_override:
        sub["model"] = model_override
    try:
        if name == "ollama":
            p = OllamaProvider(sub)
            requests.get(p.base_url + "/api/tags", timeout=8).raise_for_status()  # 연결 확인
            return p
        if name == "claude":
            return ClaudeProvider(sub)
        return OpenAICompatProvider(sub, name=name)
    except Exception as e:
        log.error("LLM 공급자 %s 초기화 실패: %s", name, str(e)[:200])
        fallback = llm_cfg.get("fallback_provider")
        if fallback and fallback != name:
            log.warning("→ 대체 공급자 %s 시도", fallback)
            return build_provider({**llm_cfg, "fallback_provider": None}, override=fallback,
                                  model_override=(llm_cfg.get(fallback) or {}).get("dedupe_model") if model_override else None)
        return None
