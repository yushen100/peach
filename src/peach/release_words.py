"""GitHub Release 正文里应用要认的原文标记，写法见 `scripts/changelog.py`。

整份是内容数据（`scripts/check_backend_copy.py` 的 `CONTENT_FILES`），不是界面文字。
"""

#: 中文更新说明所在折叠段的标题。
CHINESE_SUMMARY = "简体中文"
#: 重点条目的分组标题（英文、中文）；检查更新只显示这一组，内容取自这一版的升级公告。
HIGHLIGHTS = ("Highlights", "重点")
#: 下载段折叠标题（英文、中文），这两段不算更新说明。
DOWNLOAD_SUMMARIES = ("Downloads", "下载")
