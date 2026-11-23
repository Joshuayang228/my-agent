"""RepoBench custom command target adapter for My Agent local eval controller.

背景：RepoBench 的 generic command harness 通过 {workspace} 与 {prompt_file} 调用任意本地 Agent CLI。
设计意图：把 RepoBench 的任务请求转发给 Electron 主进程本机评测 Controller (127.0.0.1:48761/run)，
          让 My Agent 在 RepoBench 提供的隔离仓库目录中完成真实代码修改，同时把运行指标写入统一评测报告。
关键约束：只向隔离 workspace 授权写入；标准输出仅打印最终结果文本以符合 RepoBench output: text 协议。
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

_DIRECT_OPENER = build_opener(ProxyHandler({}))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--task-id", default="repobench-task")
    parser.add_argument("--url", default=os.environ.get("MY_AGENT_EVAL_URL", "http://127.0.0.1:48761/run"))
    parser.add_argument("--output", default="eval-reports/external-eval-results.jsonl")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    workspace = str(Path(args.workspace).resolve())
    prompt = Path(args.prompt_file).read_text(encoding="utf-8")
    payload = json.dumps(
        {
            "id": f"repobench-{args.task_id}",
            "prompt": prompt,
            "workspaceRoot": workspace,
            "allowWorkspaceWrites": True,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = Request(args.url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with _DIRECT_OPENER.open(request, timeout=args.timeout) as response:
        result = json.loads(response.read().decode("utf-8"))

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "benchmark": "repobench",
        "taskId": args.task_id,
        "workspaceRoot": workspace,
        "ok": bool(result.get("ok")),
        "sessionId": result.get("sessionId"),
        "terminalReason": result.get("terminalReason"),
        "toolCalls": result.get("toolCalls", []),
        "usage": result.get("usage", {}),
        "compactEvents": result.get("compactEvents", 0),
        "durationMs": result.get("durationMs", 0),
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    sys.stdout.write(str(result.get("result", "")))
    return 0 if record["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
