"""每个发布版本给使用者看的更新公告；不是变更日志的副本。

一版一条，只写使用者需要知道的：新入口、更新后自动进行的事、需要自己动手的事。每条说明一句短话；
修复与完整清单留给 Release 页的变更日志。`features` 同时是 Release 正文开头的重点（`scripts/changelog.py`
的 `highlights()`），旧版本检查更新时只显示这一组。

放哪些条目（0.58.0 起由 `tests/test_release_updates.py` 检查）：
- `features` 只放使用者一打开就能明显感知的变化：新入口、默认行为变了、换了用法。修复、提速、内部改进、
  文案调整都不放；确实只有两条就只放两条。任一平台上显示的 `features` 不超过 `FEATURE_LIMIT` 条。
- `automatic` 是升级时改了使用者数据的事，每条都带 `when`，本机确实改了才显示。
- `attention` 是要使用者自己动手的事。
- `icon` 从 `ICON_MEANINGS` 里按含义挑：一个键只表示一种含义，新含义就登记新键并在前端 `ICONS` 补上同名图标，
  不借用含义相近的旧键；泛泛的「新功能」图标（`GENERIC_ICONS`）不再使用。

条目字段：
- `id`：条目在这一版里的稳定 id。这一版的总标题和每条的标题、说明只写在 `resources/locales/<语言>/server.json` 的
  `releaseNotes.v<版本，点换成连字符>`（`headline`、`items.<id>.title`、`items.<id>.body`，ADR-0159）；
  `tests/test_user_messages.py` 核对每条都有中英文。
- `platforms`：只对这些平台或安装方式显示，取值见 `release_notice.PLATFORM_TOKENS`，`+` 连接表示同时满足（如 `macos+standalone`）；省略表示全部。
- `when`：只在这台机器的数据满足条件时显示，取值见 `release_notice.FACTS`；省略表示总是显示。
- `route`：「查看」跳转的应用内路径。
- `icon`：前端 `release-notice.tsx` 的 `ICONS` 里的键。
- `refs`：对应的 issue 或 PR，写成 `#123` 或 `owner/repo#123`；有 issue 写 issue，没有才写 PR，
  只对得上合批 PR 的不写。只用于 Release 正文的重点。

`level` 为 `quiet` 的版本不弹窗，只在设置页留记录。只写有制品的版本；minor 版本没有公告时
`scripts/release_tag.py --bump` 拒绝定版。
"""
from __future__ import annotations

#: 任一平台上一版最多显示几条 `features`。
FEATURE_LIMIT = 4
#: 从这一版起按上面的规则检查；更早的公告保持原样。
RULES_SINCE = "0.58.0"
#: 图标键与它表示的含义；前端 `release-notice.tsx` 的 `ICONS` 必须同名同集。
ICON_MEANINGS = {
    "storage": "storage and disk space",
    "reorder": "drag to reorder",
    "library": "media libraries and folders",
    "select": "multi-select",
    "resize": "video dimensions and orientation",
    "server": "server, NAS and system files",
    "person": "performers and people",
    "shield": "access, sign-in and security",
    "stack": "Docker images and packaging",
    "switch": "switching between sources or hosts",
    "speed": "speed and performance",
    "refresh": "updates, repairs and re-runs",
    "database": "ledger and backups",
    "sparkle": "generic new feature (retired)",
    "translate": "interface language",
    "download": "downloads and intake",
}
#: 说不清含义的泛用图标，`RULES_SINCE` 起不再使用。
GENERIC_ICONS = frozenset({"sparkle"})

NOTICES: dict[str, dict] = {
    "0.58.0": {
        "level": "notice",
        "features": [
            {"id": "english-interface", "refs": ["#398"], "icon": "translate"},
            {"id": "browser-intake", "refs": ["#634", "#638"], "icon": "download"},
            {"id": "docker-arm64", "refs": ["#152", "#586"], "icon": "stack", "platforms": ["docker"]},
            {"id": "docker-nas-setup", "refs": ["#203", "#376"], "icon": "server", "platforms": ["docker"]},
        ],
    },
    "0.57.0": {
        "level": "notice",
        "features": [
            {"id": "storage-budget", "refs": ["#467"], "icon": "storage",
             "route": "/settings/maintenance#storageBudgetSettings"},
            {"id": "reorder", "refs": ["#462"], "icon": "reorder"},
            {"id": "library-sync", "refs": ["#462"], "icon": "library", "route": "/data-cleanup"},
            {"id": "new-releases-multiselect", "refs": ["#474"], "icon": "select", "route": "/jav"},
            {"id": "repair-center", "icon": "refresh",
             "route": "/settings/maintenance/repairs"},
        ],
        "automatic": [
            {"id": "display-dimensions", "icon": "resize", "when": "display_reprobe"},
            {"id": "system-files", "icon": "server", "when": "system_files"},
            {"id": "garbled-performers", "icon": "person", "when": "garbled_performers"},
            {"id": "javdb-entries", "icon": "switch", "when": "javdb_entries"},
        ],
        "attention": [
            {"id": "cloud-display-repair", "when": "display_cloud_pending",
             "route": "/settings/maintenance/repairs"},
        ],
    },
    "0.56.0": {
        "level": "notice",
        "features": [
            {"id": "docker-first-setup", "refs": ["#425"], "icon": "shield", "platforms": ["docker"]},
            {"id": "ghcr-image", "refs": ["#420"], "icon": "stack", "platforms": ["docker"]},
            {"id": "javdb-host-rotation", "refs": ["#315"], "icon": "switch"},
            {"id": "faster-pages", "icon": "speed"},
        ],
    },
    "0.55.1": {"level": "quiet"},
    "0.55.0": {
        "level": "notice",
        "features": [
            {"id": "docker-one-click", "icon": "stack", "platforms": ["docker"]},
            {"id": "ledger-backup", "refs": ["#355"], "icon": "database"},
        ],
    },
    "0.54.0": {
        "level": "notice",
        "features": [
            {"id": "new-releases", "icon": "sparkle"},
            {"id": "macos-in-app-update", "refs": ["#287"], "icon": "refresh", "platforms": ["macos+standalone"]},
            {"id": "smb-faster-scan", "refs": ["#306"], "icon": "speed"},
        ],
    },
}
