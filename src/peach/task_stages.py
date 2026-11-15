"""后台任务的阶段名（ADR-0156 第三条、ADR-0159）：code 的登记表。

各域的状态字典里 `stage` 存按 zh-CN 渲染的一句，旁边的 `stage_code` 存 `<域>.<名>`。文字只在
`resources/locales/<语言>/server.json` 的 `stage.<code>`，界面按它取译文，任务中心的进度说明直接用这个键。

这个模块不依赖 `jobs`、`task_runs`，各域都能直接引用。
"""
from __future__ import annotations

from functools import lru_cache

from . import interface_text

STAGE_NAMES = {
    "library": ("startAll", "startScan", "startCollect", "startPreviews", "scanFiles", "checkCompanions",
                "probeMedia", "checkNetwork", "checkJunk", "recheckJunk", "prepareImages", "readImages",
                "preparePreviews", "makePreviews", "prepareMetadata", "prepareSources", "fetchMetadata",
                "saveCandidates", "fetchCovers", "collectResults", "fillPerformerProfiles", "finished"),
    "backup": ("prepareBackup", "copyLedger", "checkIntegrity", "backupDone", "prepareRestore", "copyBackup",
               "migrateBackup", "saveCurrent", "writeLedger", "restoreDone"),
    "diagnostics": ("prepare", "readSystem", "collectLogs", "collectEvidence", "readCandidates",
                    "collectSnapshots", "scrapingDone", "cancelling", "done", "cancelled"),
    "mediaRepair": ("scan", "repair", "done", "readTimestamps"),
    "organize": ("checkingPlan", "running", "rollingBack"),
    "thumbnails": ("fetch",),
    "download": ("isolateExtras", "probeMedia", "fetchMetadata", "organizeFiles"),
    "upgrade": ("updateMetadata", "displayDimensions", "displayDimensionsAll"),
    "job": ("waitingForUpdate", "cancelled", "stopped"),
}
STAGE_CODES = tuple(f"{domain}.{name}" for domain, names in STAGE_NAMES.items() for name in names)


def text(code: str) -> str:
    if code not in STAGE_CODES:
        raise KeyError(code)
    return interface_text.text(f"server:stage.{code}")


@lru_cache(maxsize=1)
def _reverse() -> dict[str, str]:
    """zh-CN 阶段名 → code，只给升级前留下的检查点用（它们只有中文）。"""
    return {text(code): code for code in STAGE_CODES}


def stage(code: str) -> dict:
    """写进状态字典的两项：`stage` 中文原文、`stage_code`。用 `update(job_id, **stage(...))` 展开。"""
    return {"stage": text(code), "stage_code": code}


def stage_code(state: dict) -> str:
    """状态此刻所在阶段的 code。

    `stage_code` 与 `stage` 对不上（某处只改了中文）就不认，免得界面把这一步译成上一步。
    升级前留下的检查点只有中文，按表认回 code，续跑时的判断与升级前一致。
    """
    current = str(state.get("stage") or "")
    code = str(state.get("stage_code") or "")
    if code and _reverse().get(current) == code:
        return code
    return _reverse().get(current, "") if not code else ""


def stage_progress(state: dict, fallback: str = "") -> dict:
    """把状态的阶段写成任务中心的进度说明：`label`、`code`、`params`。没有阶段时用 `fallback` 原文。"""
    label = str(state.get("stage") or fallback)
    code = stage_code(state) if state.get("stage") else ""
    return {"label": label, "code": f"stage.{code}" if code else None, "params": {}}


def stage_label(code: str) -> dict:
    """直接报一个阶段的进度说明，展开给 `handle.progress`。"""
    return stage_progress(stage(code))


#: 批量操作的 id。名字在 `server.json` 的 `batchOperation.<operation>`。按女优删除影片走自己的入口，也登记在这里。
BATCH_OPERATIONS = ("like", "seen", "later", "dispose", "restore", "delete", "dismiss-junk", "reconsider-junk",
                    "keep-duplicates", "reconsider-duplicates", "region", "performer-delete",
                    "revert-like", "revert-seen", "revert-later")


def batch_progress(operation: str) -> dict:
    """批量操作写进任务中心的进度说明：认得的操作带 `batchOperation.<operation>`，认不得的照原样。"""
    if operation not in BATCH_OPERATIONS:
        return {"label": operation, "code": None, "params": {}}
    return {"label": interface_text.text(f"server:batchOperation.{operation}"),
            "code": f"batchOperation.{operation}", "params": {}}
