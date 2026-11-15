"""Release 正文下载段的英文与中文模板，由 `package_windows_release.download_sections()` 填入地址。

整份是发布页文字数据（`check_backend_copy.DEV_CONTENT_FILES` 登记），不是开发工具的输出。
占位符：`{docs}` 文档目录，`{macos_guide}` macOS 说明，`{directory}` 本版下载目录，`{base}` Windows 包前缀，
`{version}` 版本号，`{lite}` 轻量安装包一行（没有时为空），`{images}` 两个镜像标签，`{tools}` 三个工具包链接，
`{face}` 人脸模型包地址，`{quarantine}` 去掉隔离标记的命令。
"""

TOOL_SEPARATOR = {"en": ", ", "zh-CN": "、"}

LITE_ROW = {
    "en": "| Windows x64 | [Lite installer]({base}-lite-setup.exe) | Without tools; reuses installed ones or "
          "downloads them during setup |\n",
    "zh-CN": "| Windows x64 | [轻量安装包]({base}-lite-setup.exe) | 不含工具，复用已装的或安装时联网下载 |\n",
}

SECTION = {
    "en": (
        "Windows installers, the portable ZIP and macOS DMGs bundle Python, FFmpeg, untrunc, cloudflared and the face "
        "models, so they work right after installing; the Docker image suits NAS and Linux servers. See the "
        "[Windows guide]({docs}/TESTING_DESKTOP.md), [macOS guide]({macos_guide}) and "
        "[Docker deployment]({docs}/DOCKER.md).\n\n"
        "| Platform | Download | Notes |\n| --- | --- | --- |\n"
        "| Windows x64 | [Installer]({base}-setup.exe) | Recommended for a first install |\n"
        "{lite}"
        "| Windows x64 | [Portable ZIP]({base}.zip) | Extract and run `Peach.exe` |\n"
        "| macOS Apple Silicon | [DMG]({directory}/Peach-{version}-macos-arm64.dmg) | M-series chips |\n"
        "| macOS Intel | [DMG]({directory}/Peach-{version}-macos-x86_64.dmg) | Intel processors |\n"
        "| Docker / NAS | {images} | Same image; use ghcr.io when Docker Hub pulls are limited |\n\n"
        "You do not need the other files: the Windows updater fetches `update.zip` and the {tools} and "
        "[face model]({face}) tool packages as needed; `*-corresponding-source.zip` is the "
        "corresponding source of third-party tools; `SHA256SUMS.txt` verifies the files.\n\n"
        "### Updating an existing install\n\n"
        "| Platform | How |\n| --- | --- |\n"
        "| Windows | Settings → App and maintenance → Check for updates, then confirm the restart; or run the new "
        "installer |\n"
        "| macOS | Menu bar → Version and updates → Check for updates; 0.53.0 and earlier install the new DMG once by "
        "hand |\n"
        "| Docker | Pull the new image and recreate the container; with Watchtower, Settings offers one-click "
        "updates. See [Docker deployment]({docs}/DOCKER.md) |\n\n"
        "### macOS first install\n\n"
        "Check the chip under About This Mac: Apple M-series takes Apple Silicon, Intel processors take Intel. Open "
        "the DMG, drag Peach to the Applications folder, then open it to finish setup.\n\n"
        "The app is ad-hoc signed and not yet notarized by Apple. If macOS says it is damaged and cannot be opened, "
        "run {quarantine} in Terminal and open it again; the password asked for is this Mac's login password and "
        "does not show while you type. The command only removes Peach's quarantine flag. Run it again after "
        "dragging in a new version by hand; installs through the in-app updater do not need it.\n\n"
        "### Docker\n\n"
        "The `edge` tag always points to the newest release; pin a version with the versioned tags in the table "
        "above. See [Docker deployment]({docs}/DOCKER.md) for setup, updates and rollback."
    ),
    "zh-CN": (
        "Windows 安装包、免安装包和 macOS DMG 都内置 Python、FFmpeg、untrunc、cloudflared 和人脸模型，装好即可使用；"
        "Docker 镜像适合 NAS 与 Linux 服务器。安装与使用见 "
        "[Windows 使用说明]({docs}/TESTING_DESKTOP.md)、[macOS 使用说明]({macos_guide})和 "
        "[Docker 部署]({docs}/DOCKER.md)。\n\n"
        "| 平台 | 下载 | 说明 |\n| --- | --- | --- |\n"
        "| Windows x64 | [安装包]({base}-setup.exe) | 首次安装推荐 |\n"
        "{lite}"
        "| Windows x64 | [免安装包（ZIP）]({base}.zip) | 解压后运行 `Peach.exe` |\n"
        "| macOS Apple Silicon | [DMG]({directory}/Peach-{version}-macos-arm64.dmg) | M 系列芯片 |\n"
        "| macOS Intel | [DMG]({directory}/Peach-{version}-macos-x86_64.dmg) | Intel 处理器 |\n"
        "| Docker / NAS | {images} | 同一镜像，Docker Hub 拉取受限时用 ghcr.io |\n\n"
        "其余文件不用手动下载：`update.zip` 和 {tools}、[人脸模型]({face}) 工具包"
        "由 Windows 更新器按需取用；`*-corresponding-source.zip` 是第三方工具的对应源码；`SHA256SUMS.txt` 用来核对文件。\n\n"
        "### 更新已有安装\n\n"
        "| 平台 | 方法 |\n| --- | --- |\n"
        "| Windows | 「配置 → 应用与维护」检查更新，下载完成后确认重启；也可以直接运行新安装包 |\n"
        "| macOS | 菜单栏「版本与更新」>「检查更新」；0.53.0 及更早版本先手动装一次新 DMG |\n"
        "| Docker | 拉取新镜像后重建容器，启用 Watchtower 时可在配置页一键更新，见 [Docker 部署]({docs}/DOCKER.md) |\n\n"
        "### macOS 首次安装\n\n"
        "不确定选哪个 DMG，在「关于本机」看芯片：Apple M 系列选 Apple Silicon，Intel 处理器选 Intel。"
        "打开 DMG，把 Peach 拖进「应用程序」，再打开应用完成首次设置。\n\n"
        "安装包使用 ad-hoc 签名，还没有完成 Apple 公证。提示「已损坏，无法打开」时，在终端执行 {quarantine} 后重新打开；"
        "要求输入的是这台 Mac 的登录密码，输入时屏幕不显示字符。这条命令只移除 Peach 的隔离标记。"
        "手动拖入新版本后要再执行一次，经应用内更新安装的不需要。\n\n"
        "### Docker\n\n"
        "`edge` 标签始终指向最新一版，要固定版本就用上表里带版本号的标签。部署、更新与回滚见 [Docker 部署]({docs}/DOCKER.md)。"
    ),
}

#: macOS 说明的锚点：文档标题是中文，锚点也就是中文。
MACOS_GUIDE_ANCHOR = "OPERATIONS.md#macos-独立测试包"
