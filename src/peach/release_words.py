"""GitHub Release 正文里应用要认的原文标记，写法见 `scripts/changelog.py`。

整份是内容数据（`scripts/check_backend_copy.py` 的 `CONTENT_FILES`），不是界面文字。
"""

#: 中文更新说明所在折叠段的标题。
CHINESE_SUMMARY = "简体中文"
#: 下载段折叠标题（英文、中文），这两段不算更新说明。
DOWNLOAD_SUMMARIES = ("Downloads", "下载")
#: 0.59.0 之前的正文里下载段的标题，之后都是下载说明。
LEGACY_DOWNLOADS_HEADING = "## 下载选择"
