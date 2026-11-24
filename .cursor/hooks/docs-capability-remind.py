#!/usr/bin/env python3
"""
stop hook：产品代码有改、模块卡未动时，提醒更新「已落地能力」。
fail-open：任何异常都不阻断会话结束。

背景：Windows 默认 stdout 为 GBK，直接输出 ensure_ascii=False 会被 Cursor 按 UTF-8 解析为乱码；
且部分 Cursor 版本在 stop hook payload 中不递增 loop_count，会导致存量未提交改动反复触发死循环。
设计意图：输出强制走 UTF-8 + ensure_ascii=True，并按会话/仓库与当前产品文件变更指纹在临时目录去重，
同一变更快照只提醒一次。
关键约束：临时状态文件读写必须全量 try/except 兜底，任何异常都 fail-open 输出 {}。
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import tempfile


PRODUCT_PREFIXES = (
    "electron/main/companion/",
    "electron/main/memory/",
    "electron/main/sandbox/",
    "electron/main/agent/",
    "electron/main/tools/",
    "src/components/",
    "src/shared/",
)

MODULE_PREFIX = "docs/modules/"
STATE_FILE = os.path.join(tempfile.gettempdir(), "my-agent-cursor-stop-hook-state.json")


def emit(obj: dict) -> None:
    """强制以纯 ASCII JSON 输出，彻底规避 Windows GBK/UTF-8 编码错位乱码。"""
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(json.dumps(obj, ensure_ascii=True))


def git_porcelain() -> list[str]:
    try:
        out = subprocess.check_output(
            ["git", "status", "--porcelain"],
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except Exception:
        return []
    paths: list[str] = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        # status XY + space + path（含 rename）
        rest = line[3:].strip()
        if " -> " in rest:
            rest = rest.split(" -> ", 1)[1]
        paths.append(rest.replace("\\", "/"))
    return paths


def compute_snapshot_fingerprint(product_paths: list[str]) -> str:
    """结合产品变更列表与工作区 diff 摘要生成指纹，避免存量未提交改动反复刷屏。"""
    h = hashlib.sha256()
    for p in sorted(product_paths):
        h.update(p.encode("utf-8", errors="replace"))
        h.update(b"\n")
    try:
        diff_stat = subprocess.check_output(
            ["git", "diff", "--stat", "--", *product_paths],
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        h.update(diff_stat.encode("utf-8", errors="replace"))
    except Exception:
        pass
    return h.hexdigest()[:16]


def already_reminded(scope_key: str, fingerprint: str) -> bool:
    try:
        if not os.path.exists(STATE_FILE):
            return False
        with open(STATE_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            return False
        return data.get(scope_key) == fingerprint
    except Exception:
        return False


def record_reminded(scope_key: str, fingerprint: str) -> None:
    try:
        data: dict = {}
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r", encoding="utf-8") as fh:
                loaded = json.load(fh)
            if isinstance(loaded, dict):
                data = loaded
        data[scope_key] = fingerprint
        # 限制状态表体积，最多保留最近 32 条
        if len(data) > 32:
            for k in list(data.keys())[:-32]:
                data.pop(k, None)
        with open(STATE_FILE, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=True)
    except Exception:
        pass


def main() -> None:
    payload: dict = {}
    try:
        raw = sys.stdin.read().strip()
        if raw:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                payload = parsed
    except Exception:
        pass

    if int(payload.get("loop_count") or 0) >= 1:
        emit({})
        return

    paths = git_porcelain()
    product = [p for p in paths if p.startswith(PRODUCT_PREFIXES)]
    modules = [p for p in paths if p.startswith(MODULE_PREFIX)]

    if product and not modules:
        conv_id = str(payload.get("conversation_id") or payload.get("session_id") or os.getcwd())
        fingerprint = compute_snapshot_fingerprint(product)
        if already_reminded(conv_id, fingerprint):
            emit({})
            return
        record_reminded(conv_id, fingerprint)
        msg = (
            "收工自检：检测到产品相关代码变更，但本轮未改 `docs/modules/`。"
            "若用户可见能力或横切行为变了，请同轮更新对应模块卡的「已落地能力」"
            "（companion / memory / permission / agent-runtime），并视需要更新 changelog。"
        )
        emit({"followup_message": msg})
    else:
        emit({})


if __name__ == "__main__":
    try:
        main()
    except Exception:
        emit({})
    sys.exit(0)
