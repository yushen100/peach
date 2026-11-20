"""只读就绪检查；不创建账本，不修复或迁移数据。"""
import sqlite3
import re
from contextlib import closing

from . import distribution
from .config import MIGRATIONS_DIR, PeachSettings
from .migrations import applied, discover
from .repository import is_ledger_corruption


def inspect_schema(installed, directory) -> dict:
    """比较已登记迁移与当前程序，保留可公开的版本编号。"""
    versions = sorted(value for value in installed if isinstance(value, str) and re.fullmatch(r"\d{4}", value))
    result = {"version": versions[-1] if versions else None, "pending": [],
              "mismatched": [], "unknown_versions": 0, "schema": "unavailable"}
    try:
        expected = discover(directory)
    except (OSError, ValueError):
        return result
    known = {migration.version for migration in expected}
    result["unknown_versions"] = len(set(installed) - known)
    result["pending"] = [migration.version for migration in expected if migration.version not in installed]
    result["mismatched"] = [migration.version for migration in expected
                             if migration.version in installed and installed[migration.version] != migration.checksum]
    if not installed:
        result["schema"] = "empty"
    elif result["mismatched"] or result["unknown_versions"] or not expected:
        result["schema"] = "mismatch"
    else:
        result["schema"] = "pending" if result["pending"] else "current"
    return result


def inspect_database(path, directory=None, *, known_corruption=False) -> dict:
    """读取账本与迁移校验结果；错误只输出状态，不携带路径或 SQL。"""
    result = {"database": "missing", "readable": False, "schema": "unavailable",
              "version": None, "pending": [], "mismatched": [], "unknown_versions": 0}
    if known_corruption:
        return {**result, "database": "corrupt"}
    directory = MIGRATIONS_DIR if directory is None else directory
    if not path.is_file():
        return result
    try:
        with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True,
                                     timeout=1)) as connection:
            connection.execute("PRAGMA query_only=ON")
            installed = applied(connection)
            result["database"] = "available" if installed else "empty"
            result.update(inspect_schema(installed, directory))
            connection.execute("SELECT id FROM asset LIMIT 1").fetchone()
            result["readable"] = True
    except sqlite3.Error as error:
        if is_ledger_corruption(error):
            result.update(database="corrupt", readable=False, schema="unavailable")
        elif result["database"] == "missing":
            result["database"] = "unavailable"
    except OSError:
        result.update(database="unavailable", readable=False, schema="unavailable")
    return result


def database_status(path) -> str:
    return inspect_database(path)["database"]


def _web_ready(settings: PeachSettings) -> bool:
    """页面与界面文字都在：后端渲染的文字和前端读的是同一份语言资源（ADR-0159）。"""
    from .interface_text import InterfaceTextMissing, ensure_available
    try:
        ensure_available()
    except InterfaceTextMissing:
        return False
    return settings.page_path.is_file()


def readiness(settings: PeachSettings, *, background_ready: bool | None = None, migrating: bool = False,
              known_corruption=False) -> dict:
    """服务能不能用：已配置、页面在、账本可读且结构是最新的，后台任务按需也算进去。

    `migrating`：服务启动时正在迁移账本，这时不打开账本，数据库与结构两项直接记为未就绪。

    Docker 全新数据卷先起首次设置服务，等用户在页面上答题，这就是它此刻该在的状态：报就绪，
    另带 `setup: true`。否则镜像的 HEALTHCHECK 会在首启窗口里把容器标成 unhealthy，等它健康
    才启动的 Watchtower 也跟着卡住（ADR-0149）。
    """
    if not settings.configured and distribution.docker():
        return {"ready": True, "setup": True, "checks": {"web": _web_ready(settings)}}
    checks = {"configured": bool(settings.configured),
              "web": _web_ready(settings), "database": False, "schema": False}
    if not migrating:
        inspected = inspect_database(settings.db_path, known_corruption=known_corruption)
        checks.update(database=inspected["readable"], schema=inspected["schema"] == "current")
    if background_ready is not None:
        checks["background"] = background_ready
    return {"ready": all(checks.values()), "checks": checks}
