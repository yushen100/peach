"""核对 npm 审计中已登记的临时补丁包及其依赖传播。"""
from __future__ import annotations

from base64 import b64encode
from datetime import datetime
from hashlib import sha512
import json
from pathlib import Path

REGISTRY = "scripts/npm-backports.json"
SEVERITIES = {"info", "low", "moderate", "high"}


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _nodes(lock: dict, package: str, version: str) -> set[str]:
    path = f"node_modules/{package}"
    return {name for name, pin in lock.items() if (name == path or name.endswith(f"/{path}"))
            and pin.get("version") == version}


def verified_nodes(project: Path, lock: dict, entry: dict) -> set[str]:
    """返回同包同版本且都锁到已登记压缩包的节点。"""
    artifact = entry["artifact"]
    package_file = (project / artifact).resolve()
    if not package_file.is_relative_to(project) or not entry["source"].startswith("https://"):
        return set()
    nodes = _nodes(lock, entry["package"], entry["version"])
    if not nodes:
        return set()
    for node in nodes:
        pin = lock[node]
        if pin.get("resolved") != f"file:{artifact}" or pin.get("integrity") != entry["integrity"]:
            return set()
    digest = b64encode(sha512(package_file.read_bytes()).digest()).decode("ascii")
    return nodes if f"sha512-{digest}" == entry["integrity"] else set()


def _verify_advisories(project: Path, lock: dict, active: list[dict], package: str,
                       advisories: set[str], nodes: list[str]) -> list[dict]:
    if not isinstance(nodes, list) or not nodes:
        return []
    by_version = {}
    for node in nodes:
        by_version.setdefault(lock[node]["version"], []).append(node)
    proofs = []
    for version, affected in by_version.items():
        candidates = [entry for entry in active if entry["package"] == package
                      and entry["version"] == version and advisories <= set(entry["advisories"])]
        if len(candidates) != 1 or verified_nodes(project, lock, candidates[0]) != set(affected):
            return []
        proofs.append({**candidates[0], "advisories": sorted(advisories)})
    return proofs


def verify(root: Path, project: Path, payload: dict, *, now: datetime) -> list[dict]:
    """每条高危传播路径都须终止于已验真的补丁。无法核对时沿用审计失败。"""
    try:
        if payload.get("auditReportVersion") != 2:
            return []
        vulnerabilities = payload["vulnerabilities"]
        counts = payload["metadata"]["vulnerabilities"]
        if counts["critical"] != 0 or any(item["severity"] not in SEVERITIES for item in vulnerabilities.values()):
            return []
        high = {name: item for name, item in vulnerabilities.items() if item["severity"] == "high"}
        if not high or counts["high"] != len(high):
            return []

        project = project.resolve()
        scope = project.relative_to(root.resolve()).as_posix()
        registry = _read(root / REGISTRY)
        active = [entry for entry in registry if entry["project"] == scope
                  and now < datetime.fromisoformat(entry["expires"])]
        if not active:
            return []
        lock = _read(project / "package-lock.json")["packages"]
        pending, proofs = {}, []
        for name, item in high.items():
            causes = item["via"]
            if not isinstance(causes, list) or not causes:
                return []
            parents = {cause for cause in causes if isinstance(cause, str)}
            advisories = {cause["url"] for cause in causes if not isinstance(cause, str)}
            if not parents <= high.keys():
                return []
            if advisories:
                verified = _verify_advisories(project, lock, active, name, advisories, item["nodes"])
                if not verified:
                    return []
                proofs.extend(verified)
            pending[name] = parents

        # 只从已核对的直接公告向上结算。未知来源、循环和没有公告的节点均不会通过。
        while pending:
            ready = {name for name, parents in pending.items() if not parents & pending.keys()}
            if not ready:
                return []
            for name in ready:
                del pending[name]
        return proofs
    except (OSError, ValueError, AttributeError, KeyError, TypeError):
        return []
