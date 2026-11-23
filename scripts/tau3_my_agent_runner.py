"""Run one τ³-bench task through the local My Agent controller."""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task-file", required=True)
    parser.add_argument("--task-id", default="0")
    parser.add_argument("--url", default="http://127.0.0.1:48761/run")
    args = parser.parse_args()
    tasks = json.loads(Path(args.task_file).read_text(encoding="utf-8"))
    task = next(item for item in tasks if str(item.get("id")) == args.task_id)
    instructions = task["user_scenario"]["instructions"]
    prompt = "\n".join(str(instructions.get(key, "")) for key in ("task_instructions", "reason_for_call", "known_info"))
    payload = json.dumps({"id": f"tau3-{task['id']}", "prompt": prompt}).encode("utf-8")
    request = Request(args.url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=300) as response:
        result = json.loads(response.read().decode("utf-8"))
    print(json.dumps({"benchmark": "tau3-bench", "taskId": task["id"], **result}, ensure_ascii=False))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
