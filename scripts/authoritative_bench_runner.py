#!/usr/bin/env python3
"""
外部权威公开基准 -> My Agent 真实 Electron Runtime 统一评测运行器（无需 Docker）。

支持三大全球公认基准（官方原版数据集 + 官方确定性判分器）：
1. OpenAI HumanEval (`openai/openai_humaneval`) — 代码生成 + 官方隐藏单测 check(candidate)
2. Google IFEval (`google/IFEval`) — 精确指令遵循 + 官方 instruction_following_eval 严格/宽松四项指标
3. OpenAI GSM8K (`openai/gsm8k` main/test) — 多步数学推理 + 官方精确数值答案比对
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT / "eval-reports" / "external-eval-results.jsonl"
DEFAULT_URL = os.environ.get("MY_AGENT_EVAL_URL", "http://127.0.0.1:48768/run")

# 直连 127.0.0.1，避免 Windows 系统代理劫持本地环回请求
LOCAL_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def call_controller(url: str, task_id: str, prompt: str, timeout_sec: int = 180) -> dict[str, Any]:
    body = json.dumps({"id": task_id, "prompt": prompt}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with LOCAL_OPENER.open(req, timeout=timeout_sec) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
    if not data.get("ok"):
        raise RuntimeError(data.get("error") or "Controller returned not ok")
    return data


def sample_uniform(rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    if limit <= 0 or limit >= len(rows):
        return rows
    step = len(rows) / limit
    return [rows[int(i * step)] for i in range(limit)]


def append_jsonl(output_path: Path, record: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# 1. OpenAI HumanEval
# ---------------------------------------------------------------------------
def extract_python_code(text: str) -> str:
    blocks = re.findall(r"```(?:python|py)?\s*\n(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if blocks:
        return blocks[-1]
    return text


def verify_humaneval_solution(prompt_code: str, completion_text: str, test_code: str, entry_point: str) -> tuple[bool, str]:
    extracted = extract_python_code(completion_text)
    # 兼容两种返回形式：完整函数定义（含 def entry_point）或纯函数体缩进续写
    if re.search(rf"^\s*def\s+{re.escape(entry_point)}\b", extracted, flags=re.MULTILINE):
        full_code = f"{prompt_code}\n{extracted}\n{test_code}\ncheck({entry_point})\n"
    else:
        full_code = f"{prompt_code}{extracted}\n{test_code}\ncheck({entry_point})\n"

    with tempfile.NamedTemporaryFile("w", suffix=".py", encoding="utf-8", delete=False) as tf:
        tf.write(full_code)
        temp_path = tf.name
    try:
        proc = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            timeout=10,
        )
        if proc.returncode == 0:
            return True, "ok"
        err = proc.stderr.decode("utf-8", errors="replace").strip()
        return False, err[-300:] if err else f"exit={proc.returncode}"
    except subprocess.TimeoutExpired:
        return False, "timeout"
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass


def run_humaneval(url: str, limit: int, output: Path, delay_sec: float) -> dict[str, Any]:
    from huggingface_hub import hf_hub_download
    import pyarrow.parquet as pq

    parquet_path = hf_hub_download(
        repo_id="openai/openai_humaneval",
        filename="openai_humaneval/test-00000-of-00001.parquet",
        repo_type="dataset",
    )
    rows = pq.read_table(parquet_path).to_pylist()
    selected = sample_uniform(rows, limit)

    passed = 0
    errors = 0
    for idx, row in enumerate(selected, 1):
        task_id = row["task_id"]
        prompt = (
            "Read the following Python function signature and docstring, and fully implement "
            "the function described. Return ONLY the Python code in a single ```python code block "
            "(include the function definition and any needed imports), with no explanation.\n\n"
            + row["prompt"]
        )
        t0 = time.time()
        run_error = None
        ok = False
        reason = ""
        resp_data: dict[str, Any] = {}
        try:
            resp_data = call_controller(url, f"humaneval-{task_id.replace('/', '-')}", prompt)
            ok, reason = verify_humaneval_solution(
                row["prompt"],
                str(resp_data.get("result", "")),
                row["test"],
                row["entry_point"],
            )
        except Exception as exc:
            run_error = str(exc)
            reason = run_error
            errors += 1

        if ok:
            passed += 1
        rec = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "benchmark": "openai-humaneval",
            "taskId": task_id,
            "entryPoint": row["entry_point"],
            "ok": run_error is None,
            "pass": ok,
            "score": 1.0 if ok else 0.0,
            "reason": reason,
            "runError": run_error,
            "toolCalls": resp_data.get("toolCalls", []),
            "usage": resp_data.get("usage", {}),
            "durationMs": int((time.time() - t0) * 1000),
        }
        append_jsonl(output, rec)
        print(f"[HumanEval {idx:02d}/{len(selected)}] {task_id} -> {'PASS' if ok else 'FAIL'} ({rec['durationMs']}ms) {'' if ok else reason[:120]}")
        if idx < len(selected) and delay_sec > 0:
            time.sleep(delay_sec)

    summary = {"benchmark": "openai-humaneval", "passed": passed, "total": len(selected), "errors": errors, "passRate": round(passed / len(selected), 4)}
    print("SUMMARY:", json.dumps(summary, ensure_ascii=False))
    return summary


# ---------------------------------------------------------------------------
# 2. Google IFEval
# ---------------------------------------------------------------------------
def ensure_nltk_punkt() -> None:
    import nltk

    for pkg in ("punkt", "punkt_tab"):
        try:
            nltk.data.find(f"tokenizers/{pkg}")
        except LookupError:
            nltk.download(pkg, quiet=True)


def run_ifeval(url: str, limit: int, output: Path, delay_sec: float) -> dict[str, Any]:
    from huggingface_hub import hf_hub_download
    from instruction_following_eval.evaluation import (
        InputExample,
        test_instruction_following,
    )

    ensure_nltk_punkt()
    jsonl_path = hf_hub_download(
        repo_id="google/IFEval",
        filename="ifeval_input_data.jsonl",
        repo_type="dataset",
    )
    rows = [json.loads(line) for line in Path(jsonl_path).read_text(encoding="utf-8").splitlines() if line.strip()]
    selected = sample_uniform(rows, limit)

    p_strict = 0
    p_loose = 0
    i_strict_pass = 0
    i_loose_pass = 0
    i_total = 0
    errors = 0

    for idx, row in enumerate(selected, 1):
        key = str(row["key"])
        prompt = row["prompt"]
        t0 = time.time()
        run_error = None
        strict_ok = False
        loose_ok = False
        strict_list: list[bool] = []
        loose_list: list[bool] = []
        resp_data: dict[str, Any] = {}
        try:
            resp_data = call_controller(url, f"ifeval-{key}", prompt)
            response_text = str(resp_data.get("result", ""))
            inp = InputExample(
                key=int(row["key"]),
                instruction_id_list=row["instruction_id_list"],
                prompt=row["prompt"],
                kwargs=[{k: v for k, v in kw.items() if v is not None} for kw in row["kwargs"]],
            )
            r_strict = test_instruction_following(inp, response_text, strict=True)
            r_loose = test_instruction_following(inp, response_text, strict=False)
            strict_ok = bool(r_strict.follow_all_instructions)
            loose_ok = bool(r_loose.follow_all_instructions)
            strict_list = [bool(x) for x in r_strict.follow_instruction_list]
            loose_list = [bool(x) for x in r_loose.follow_instruction_list]
        except Exception as exc:
            run_error = str(exc)
            errors += 1

        if strict_ok:
            p_strict += 1
        if loose_ok:
            p_loose += 1
        i_strict_pass += sum(1 for x in strict_list if x)
        i_loose_pass += sum(1 for x in loose_list if x)
        i_total += len(row["instruction_id_list"])

        rec = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "benchmark": "google-ifeval",
            "taskId": f"ifeval-{key}",
            "instructionIds": row["instruction_id_list"],
            "ok": run_error is None,
            "pass": strict_ok,
            "passLoose": loose_ok,
            "score": 1.0 if strict_ok else (sum(1 for x in strict_list if x) / max(1, len(row["instruction_id_list"]))),
            "checks": {"strictList": strict_list, "looseList": loose_list},
            "runError": run_error,
            "toolCalls": resp_data.get("toolCalls", []),
            "usage": resp_data.get("usage", {}),
            "durationMs": int((time.time() - t0) * 1000),
        }
        append_jsonl(output, rec)
        print(
            f"[IFEval {idx:02d}/{len(selected)}] key={key} -> strict={'PASS' if strict_ok else 'FAIL'} "
            f"loose={'PASS' if loose_ok else 'FAIL'} ({rec['durationMs']}ms)"
        )
        if idx < len(selected) and delay_sec > 0:
            time.sleep(delay_sec)

    summary = {
        "benchmark": "google-ifeval",
        "total": len(selected),
        "errors": errors,
        "promptStrict": round(p_strict / len(selected), 4),
        "promptLoose": round(p_loose / len(selected), 4),
        "instStrict": round(i_strict_pass / max(1, i_total), 4),
        "instLoose": round(i_loose_pass / max(1, i_total), 4),
        "promptStrictCount": f"{p_strict}/{len(selected)}",
        "promptLooseCount": f"{p_loose}/{len(selected)}",
        "instStrictCount": f"{i_strict_pass}/{i_total}",
        "instLooseCount": f"{i_loose_pass}/{i_total}",
    }
    print("SUMMARY:", json.dumps(summary, ensure_ascii=False))
    return summary


# ---------------------------------------------------------------------------
# 3. OpenAI GSM8K
# ---------------------------------------------------------------------------
def normalize_num(raw: str) -> str | None:
    cleaned = raw.strip().replace(",", "").replace("$", "").replace("%", "").strip()
    m = re.search(r"-?\d+(?:\.\d+)?", cleaned)
    if not m:
        return None
    val = float(m.group(0))
    if val.is_integer():
        return str(int(val))
    return f"{val:.6f}".rstrip("0").rstrip(".")


def extract_gsm8k_gold(answer_field: str) -> str | None:
    m = re.search(r"####\s*(.+)$", answer_field, flags=re.MULTILINE)
    return normalize_num(m.group(1)) if m else None


def extract_gsm8k_pred(text: str) -> str | None:
    m = re.findall(r"ANSWER\s*:\s*([^\n]+)", text, flags=re.IGNORECASE)
    if m:
        return normalize_num(m[-1])
    nums = re.findall(r"-?\d[\d,]*(?:\.\d+)?", text)
    return normalize_num(nums[-1]) if nums else None


def run_gsm8k(url: str, limit: int, output: Path, delay_sec: float) -> dict[str, Any]:
    from huggingface_hub import hf_hub_download
    import pyarrow.parquet as pq

    parquet_path = hf_hub_download(
        repo_id="openai/gsm8k",
        filename="main/test-00000-of-00001.parquet",
        repo_type="dataset",
    )
    rows = pq.read_table(parquet_path).to_pylist()
    selected = sample_uniform(rows, limit)

    passed = 0
    errors = 0
    for idx, row in enumerate(selected, 1):
        gold = extract_gsm8k_gold(row["answer"])
        prompt = (
            "Solve the following math problem step by step. "
            'The last line of your response MUST be of the exact form "ANSWER: <number>" '
            "(without quotes or units).\n\n"
            + row["question"]
        )
        t0 = time.time()
        run_error = None
        pred = None
        ok = False
        resp_data: dict[str, Any] = {}
        try:
            resp_data = call_controller(url, f"gsm8k-{idx}", prompt)
            pred = extract_gsm8k_pred(str(resp_data.get("result", "")))
            ok = pred is not None and gold is not None and pred == gold
        except Exception as exc:
            run_error = str(exc)
            errors += 1

        if ok:
            passed += 1
        rec = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "benchmark": "openai-gsm8k",
            "taskId": f"gsm8k-{idx}",
            "ok": run_error is None,
            "pass": ok,
            "score": 1.0 if ok else 0.0,
            "checks": {"gold": gold, "pred": pred},
            "runError": run_error,
            "toolCalls": resp_data.get("toolCalls", []),
            "usage": resp_data.get("usage", {}),
            "durationMs": int((time.time() - t0) * 1000),
        }
        append_jsonl(output, rec)
        print(f"[GSM8K {idx:02d}/{len(selected)}] gold={gold} pred={pred} -> {'PASS' if ok else 'FAIL'} ({rec['durationMs']}ms)")
        if idx < len(selected) and delay_sec > 0:
            time.sleep(delay_sec)

    summary = {"benchmark": "openai-gsm8k", "passed": passed, "total": len(selected), "errors": errors, "passRate": round(passed / len(selected), 4)}
    print("SUMMARY:", json.dumps(summary, ensure_ascii=False))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", default="humaneval,ifeval,gsm8k")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--delay-sec", type=float, default=0.5)
    args = parser.parse_args()

    out_path = Path(args.output)
    suites = [s.strip().lower() for s in args.suite.split(",") if s.strip()]
    summaries = []
    for s in suites:
        print(f"\n=== Running authoritative suite: {s} (n={args.limit}) ===", flush=True)
        if s == "humaneval":
            summaries.append(run_humaneval(args.url, args.limit, out_path, args.delay_sec))
        elif s == "ifeval":
            summaries.append(run_ifeval(args.url, args.limit, out_path, args.delay_sec))
        elif s == "gsm8k":
            summaries.append(run_gsm8k(args.url, args.limit, out_path, args.delay_sec))
        else:
            raise SystemExit(f"Unknown suite: {s}")

    print("\n=== ALL AUTHORITATIVE SUMMARIES ===")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
