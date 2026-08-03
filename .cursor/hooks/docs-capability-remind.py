#!/usr/bin/env python3
"""
stop hook：产品代码有改、模块卡未动时，提醒更新「已落地能力」。
fail-open：任何异常都不阻断会话结束。
"""
from __future__ import annotations

import json
import subprocess
import sys


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


def main() -> None:
    # 消费 stdin（Cursor 传入的 hook JSON），避免管道阻塞
    try:
        sys.stdin.read()
    except Exception:
        pass

    paths = git_porcelain()
    product = [p for p in paths if p.startswith(PRODUCT_PREFIXES)]
    modules = [p for p in paths if p.startswith(MODULE_PREFIX)]

    if product and not modules:
        msg = (
            "收工自检：检测到产品相关代码变更，但本轮未改 `docs/modules/`。"
            "若用户可见能力或横切行为变了，请同轮更新对应模块卡的「已落地能力」"
            "（companion / memory / permission / agent-runtime），并视需要更新 changelog。"
        )
        print(json.dumps({"followup_message": msg}, ensure_ascii=False))
    else:
        print("{}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("{}")
    sys.exit(0)
