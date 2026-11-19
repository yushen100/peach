# Docker 部署

Peach 的 Docker 镜像用于单人 VPS 与 NAS，通过浏览器管理，镜像仓库为 [longmeidao/peach](https://hub.docker.com/r/longmeidao/peach)，同一镜像也发布到 [ghcr.io/peach-mitao/peach](https://github.com/peach-mitao/peach/pkgs/container/peach)，拉取受 Docker Hub 频率限制时可以改用后者；配置页的检查更新与 Watchtower 一键更新仍以 Docker Hub 为准。每次发布推送版本号标签，并把 `edge` 与 `latest` 更新为同一镜像；版本号标签对应发布提交。NAS 容器面板和不写标签的 `docker pull` 只认 `latest`，在 `.env` 写 `PEACH_VERSION=latest` 后面板能提示新版本，一键更新同样可用。镜像同时提供 `linux/amd64` 与 `linux/arm64`，Docker 按宿主机架构自动选择。2026-10-15 在 WSL 的独立 Docker Engine 中，用正式锁定依赖通过空数据卷初始化、非 root、鉴权、配置保存、合成视频扫描、HTTP Range、配置重载与重启持久化验收。

Docker 不使用桌面托盘。在网页配置中添加媒体目录时，只需填写容器内实际目录，例如 `/media`；Peach 自动保存所需的路径配置。Windows 安装包、macOS 源码运行和 Docker 的入口分别见 [下载与使用](../README.zh-CN.md#下载与使用)。

## NAS 快速开始

1. 在 `compose.yaml` 同目录创建 `.env`，写 `PEACH_MEDIA_ROOT=<宿主机媒体目录>` 和 `PEACH_BIND=<NAS 局域网 IP>`。Compose 默认只绑定 `127.0.0.1`，不改时只有 NAS 自己能打开，容器照样显示运行中。
2. 运行 `docker compose up -d`。
3. 在另一台电脑的浏览器打开 `http://<NAS 局域网 IP>:8900`，在首次设置页设访问密码或选择免登录。Peach 没有初始密码；`peach token` 显示的口令供用户脚本和 API 使用，不是登录密码。

各项的完整说明见下文[首次运行与访问](#首次运行与访问)。

## 数据与媒体

NAS 的 SMB 共享也可作为[SMB 媒体来源](SMB.md)直接连接，按账号权限读写，无需挂入媒体目录；Peach 数据卷仍单独保留。

`/data` 保存配置、SQLite 数据库、凭据和图片缓存，必须使用数据卷保存，重建容器时保留该卷。媒体目录单独挂到 `/media`；默认只读，扫描和播放不需要媒体写权限。整理、移动与删除需要使用者明确提供可写挂载。

CloudDrive2 与 Peach 分别运行。NAS 已有 CloudDrive2 时直接复用；全新机器按 [CloudDrive2 官方 Docker 指南](https://www.clouddrive2.com/docker.html) 安装并绑定网盘。让 Peach 容器也能读取 CloudDrive2 后续挂上的网盘目录，需要 Linux 宿主机支持 FUSE，并将 CloudDrive2 的挂载目录配置为可共享挂载变化；Compose 中的 `rslave` 用于让这些变化进入 Peach 容器。此机制不适用于 Docker Desktop，详见 [Docker 挂载传播说明](https://docs.docker.com/engine/storage/bind-mounts/#configure-bind-propagation)。Peach 容器不需要 FUSE 或特权模式。目录权限必须允许实际运行 Peach 的 UID/GID 读取；默认是 `1000:1000`。

需要云下载或推送发现时，Peach 配置中的 CloudDrive2 API 地址使用同一容器网络的服务名或可达的宿主机地址；容器里的 `127.0.0.1` 只指向 Peach 自己。

仓库根的 `compose.yaml` 使用 `PEACH_MEDIA_ROOT` 指定宿主机已有媒体根；容器中固定为 `/media`。先完成 CloudDrive2 挂载，再启动 Peach。命名卷 `peach-data` 保存 `/data`，不要执行删除该卷的操作。需要绑定现有数据目录时，先做完整备份并确保配置的 UID/GID 可写；不要让另一台 Peach 同时写这份 Peach 数据库。

### 运行 UID/GID

镜像默认以非 root 的 `1000:1000` 运行。NAS 目录由其他固定 UID/GID 持有时，在 Compose 的 `.env` 或 NAS 面板中设置：

```dotenv
PEACH_UID=1026
PEACH_GID=1027
```

这两个值必须是十进制数字，不能是用户名或组名。`PEACH_UID`/`PEACH_GID` 优先；未设置时可使用 `UID`/`GID`，两者同时出现且数值不同会拒绝启动。`0`、负数和超出 Linux ID 范围的值也会在 Peach 初始化前失败。

启动入口只在准备阶段使用 root。它会在必要时把 `/data` 和一键更新的令牌卷 `/update` 及其现有内容改为目标所有者，然后把补充组、GID 和 UID 固定下来，再以目标身份启动 Peach 及其子进程。`docker compose exec peach peach …` 进容器时是 root，`peach` 命令会先换成同一身份再执行，不会在 `/data` 留下 root 的文件。`/media` 不参与递归改所有者；媒体权限应通过宿主机所有者、ACL 或 `group_add` 提供。

绑定已有的 `/data` 宿主机目录前先停止 Peach 并完整备份。所有者迁移会修改宿主机文件的所有者；不愿接受时，应预先让该目录和内容对目标 UID/GID 可写。环境变量要写在持久的 `.env` 或 NAS 配置中，否则容器重建后会回到 `1000:1000`，并可能再次迁移数据所有者。

rootless Docker 和 `userns-remap` 仍受宿主机 ID 映射限制；容器内设置数值 ID 不会绕过映射范围外的 NAS ACL。需要先在目标机器确认 `PEACH_UID`/`PEACH_GID` 对应的宿主权限。

### 迁移数据目录

`/data` 的位置由宿主机上的挂载决定，容器里改不了，所以配置页「存储空间」不提供「更改位置」，改为列出下面几步。在宿主机上执行：

1. 查出数据卷的名字，以 `_peach-data` 结尾：`docker volume ls`。
2. 在 `compose.yaml` 所在目录停止 Peach：`docker compose down`。
3. 把数据卷复制到新文件夹；启动时入口会按 `PEACH_UID`/`PEACH_GID` 修正 `/data` 所有者：`docker run --rm -v <数据卷名>:/from -v <新文件夹>:/to alpine cp -a /from/. /to/`。
4. 把 `compose.yaml` 里的 `peach-data:/data` 改成 `<新文件夹>:/data`，再启动：`docker compose up -d`。

确认新位置一切正常之前，不要删除旧数据卷。

## 首次运行与访问

### 生成 NAS 安装配置

镜像中的生成器可以输出一份可导入 Container Station、Container Manager 或其他 NAS 容器管理器的 Compose。它不启动 Docker，不读取媒体，也不修改已有部署。无需在 NAS 上另装 Python。在新建的安装文件夹运行：

```sh
docker run --rm --entrypoint python longmeidao/peach:latest -m peach.nas_setup --bind 192.0.2.10 --media /srv/videos
```

把输出保存为新建的 `compose.yaml`，将示例 IP 与媒体目录替换为宿主机实际值，然后在该目录执行 `docker compose up -d`。也可以把生成内容导入 NAS 的 Compose 管理界面。容器内的媒体路径固定为 `/media`，数据保存在 `peach-data` 命名卷，媒体默认只读。文件夹不存在时拒绝启动，不自动创建空目录来掩盖挂载错误。

源码环境可用 `python -m peach.nas_setup ... --output compose.yaml` 保存；文件已存在时拒绝覆盖。`--port` 修改访问端口，`--image` 选择镜像，默认 `longmeidao/peach:latest`，NAS 面板按它提示更新；`--uid`、`--gid` 指定运行身份，见上文「运行 UID/GID」。生成器固定 `hostname` 为 `peach-nas`，重建容器后任务仍归同一执行端。已有安装迁入此配置时，先通过 `docker inspect --format '{{.Config.Hostname}}' <容器名>` 取得原名称，再用 `--hostname` 保留它；同时保留原 Compose 项目名和数据卷名称，不能用新项目误建空数据卷。

安装后打开 `http://<NAS IP>:<端口>`，按网页完成首次设置和访问密码设置；没有通用初始密码。已有部署沿用原来的访问设置，容器终端中的 `peach token` 可以查看内部访问口令。配置完成后运行 `docker compose exec peach peach doctor` 检查配置、数据库、工具和挂载。容器运行状态与来源网络连通性分别检查，见下文 amane 及采集说明。

### 飞牛、其他 NAS 与局域网访问

浏览器在另一台电脑上时，访问地址使用 NAS 的局域网 IP。Compose 默认的 `127.0.0.1` 只允许宿主机访问；容器显示运行成功不代表局域网端口已开放。

在 `compose.yaml` 同目录创建 `.env`，将下面的示例 IP 和目录换成 NAS 的实际值。`PEACH_PORT` 是浏览器使用的宿主机端口，可自行选择：

```dotenv
PEACH_BIND=192.0.2.10
PEACH_PORT=8900
PEACH_MEDIA_ROOT=/srv/videos
```

`192.0.2.10` 是文档示例地址，不能直接用于部署。NAS 管理界面支持 Compose 环境变量时，也可在那里填写这三个值。应用配置并重新创建容器后，打开 `http://<NAS 局域网 IP>:<PEACH_PORT>`。不要在另一台电脑上用 `127.0.0.1` 访问 NAS。

全新数据卷首次打开时，Peach 进入和 Windows、macOS 相同的首次设置：确认媒体目录（默认 `/media`），设访问密码或关掉开关选择免登录，选代理与是否立即扫描。数据目录固定为 `/data`，端口与访问地址由 Compose 决定，不在页面上出题。完成后服务自动切换到正常模式，页面稍后回到首页；设了密码时用它登录。

首次设置只接受宿主机或同一局域网设备打开的页面；经反向代理或公网打开时，页面会提示改从这些地址打开。局域网里第一个打开的人就能完成设置，介意时用下面的 `PEACH_ACCESS_PASSWORD` 预设密码。

### 初始化与管理

全新数据卷在首次设置完成前没有配置和数据库，服务以未配置状态运行；提交首次设置后，Peach 创建配置、数据库和随机访问口令。已有配置保持原值；如果已有数据库但缺少配置文件，服务拒绝启动，需要恢复配置文件。

已经配置过、但从没设过访问密码的部署，未登录的浏览器打开时会看到访问设置：设访问密码或选择免登录，来源要求与首次设置相同。

也可以在 `.env` 里写 `PEACH_ACCESS_PASSWORD=<8–256 个字符的密码>`，并取消 `compose.yaml` 中对应行的注释。还没有访问设置时，容器启动就用它设访问密码，首次设置页里访问那一项显示为已设置，日志不显示密码；已有访问设置时忽略它，改密码请到配置页。

访问口令仍会自动生成，供用户脚本和 API 使用，容器终端运行 `peach token`、宿主机运行 `docker compose exec peach peach token` 查看。配置页要求登录，并且连接必须来自容器本机或私有网络；携带代理转发头的管理请求会被拒绝。通过配置页保存后，服务自动读取配置；勾选扫描时会启动资料处理。

容器内 HTTP 端口固定为 8900，访问端口在 Compose 设置。默认只发布到宿主机 `127.0.0.1`，远程访问使用私有 VPN 或 SSH 隧道。需要局域网访问时，通过 `PEACH_BIND` 绑定宿主机的局域网地址，并设置访问密码。公网托管边界见 [安全说明](../SECURITY.md)。Docker 镜像不提供多人账号或租户隔离。

## 配置文件与路径

配置文件位于数据卷内的 `/data/config.toml`。在浏览器配置页的「媒体目录」中添加目录：填写 `/media` 或 `/media/115` 等容器内目录，选择媒体来源和读取策略，再保存。已有目录改了位置时，修改这一行的媒体目录；数据库路径的对应关系由 Peach 管理。

手动编辑配置文件前先备份，编辑后重启容器。更新镜像保留这个文件，因此已有文件的注释也保持原样。查看配置说明不需要重新初始化数据卷。

容器已更新并重新启动后，在 `compose.yaml` 所在目录运行以下命令，可查看新版注释与当前配置值；命令只显示内容，不改写 `/data/config.toml`：

```sh
docker compose exec peach python -c "from peach import settings_file as s; print(s.render(s.active()), end='')"
```

默认模板只包含初始值，不包含已有部署的媒体目录和自定义设置。用默认模板整份替换会同时替换这些值，可能使已有影片无法读取。只更新说明时可以替换注释，保留配置值；需要替换整个文件时，先备份并逐项核对差异。

以下说明供手动编辑配置或在多台 Peach 之间对应已有媒体目录时参考。网页保存时会处理 `[media.locations]` 和 `[media.mounts]`：前者保存数据库中的路径前缀，后者保存实际读取文件的目录。Peach 数据库在所有系统上都使用 Windows 格式保存影片路径；Linux 无需创建相同的盘符或目录。

全新配置不预设媒体目录。盘符不决定来源，115 与 PikPak 均可选择任意已挂载目录；容器内填写实际路径即可。文档中的盘符只是数据库路径示例。

以下三个路径各有用途。假设宿主机媒体目录为 `/srv/videos`，Compose 将它挂到容器 `/media`：

| 位置 | 示例 | 用途 |
| --- | --- | --- |
| 宿主机目录 | `/srv/videos` | 填在 Compose 的 `PEACH_MEDIA_ROOT`，目录必须已存在 |
| 容器内目录 | `/media` | 填在配置页的媒体目录或 `[media.mounts]`，Peach 实际读取这里 |
| 数据库中的目录前缀 | `R:\media` | `[media.locations]` 的示例值，对应数据库影片路径的开头；通常由 Peach 管理 |

手动配置全新本地馆藏时，可使用以下对应关系。网页自动生成的前缀可能不同，使用时无需改成示例值。将两个表中的条目合入已有配置，不要重复添加同名表：

```toml
[media.locations]
local = 'R:\media'

[media.mounts]
local = '/media'
```

扫描 `/media/a.mp4` 后，Peach 在数据库的影片 `path` 字段中保存 `R:\media\a.mp4`；播放时再把 `R:\media` 替换为 `/media`，读取容器中的 `/media/a.mp4`。数据库中的这段 Windows 路径是字符串，不是 Linux 上实际存在的文件名。

已有影片时，`[media.locations]` 必须继续匹配数据库中的路径前缀。把它改成 `/media` 不会同步修改已有影片记录，反而会使路径无法对应。只搬动实际媒体目录时，保留 `[media.locations]`，调整 `[media.mounts]` 和 Compose 的目录挂载。一个来源有多个目录时，两张表均使用数组，数量和顺序一一对应。

需要复用另一台 Peach 的数据库时，在配置文件的 `[media.locations]` 中填写与该数据库影片路径匹配的目录前缀，在 `[media.mounts]` 中填写这台容器能读取的目录，例如 `/media/115`；已有部署保留自身的对应关系。Compose 必须已挂入这些目录。CloudDrive2 是媒体来源之一，本地目录也可直接挂入 Peach。

容器中的服务固定在 8900 端口以双栈监听，宿主机访问地址和端口使用 Compose 的 `PEACH_BIND`、`PEACH_PORT`。`PEACH_BIND` 写 IPv6 地址时加方括号，例如 `[fd00::10]`；写 `0.0.0.0` 时 Docker 在宿主机的 IPv4 和 IPv6 地址上都发布端口。默认网络没有 IPv6，Docker 把宿主机 IPv6 端口转给容器的 IPv4 地址，容器看到的来源是 Docker 网关。要让容器看到客户端的 IPv6 地址，需要为网络开启 IPv6，并在 `PEACH_LAN_IPV6_PREFIXES` 里列出宿主机局域网的 IPv6 前缀，多个前缀用逗号分隔，例如 `2001:db8:1:2::/64`；不在这些前缀、ULA 或链路本地范围内的 IPv6 来源会收到 403。`[server]` 的 `host`、`port` 用于直接运行 `peach serve`。独立 Docker 部署保持 `[replication] enabled = false`，无需配置桌面托盘或 SMB 复制。

## 硬件转码（AMD / Intel VAAPI）

Linux 首次重编码时会探测实际可用的硬件编码器，整片 MP4 与 HLS 分片共享探测结果。AMD / Intel 使用 VAAPI；存在 NVIDIA 设备时探测 NVENC。探测失败的后端在当前服务进程内不再尝试，重启服务后重新探测。封装复制不需要硬件探测。

封面、九宫格与时间轴抽帧也使用同一渲染节点做 VAAPI 解码，范围限 H.264、HEVC、VP9、AV1；节点建不出 VAAPI 设备、编码不在范围内或本帧解码失败时改用软件解码。「抽帧解码方式」选软件时不探测。

镜像自带 OpenCV（`vision` 依赖组）和头像取景与比对用的人脸模型（YuNet 为 MIT，SFace 为 Apache-2.0，许可证在同一目录），位于 `/app/tools/face-models`，由 `PEACH_FACE_MODELS` 指向，容器不联网也能用。构建镜像时按固定地址下载并校验 SHA-256。

镜像包含 Debian FFmpeg、Mesa VAAPI 驱动、Intel iHD 驱动（`intel-media-va-driver`，仅 amd64 镜像）与 `vainfo`。宿主机仍须加载对应内核驱动（Intel `i915` / `xe`，AMD `amdgpu`）和固件，并提供 `/dev/dri/renderD*`。iHD 面向其支持的 Intel GPU，旧设备需要按型号选择驱动；安装用户态驱动不能替代宿主机内核支持。将下面的条目合入 Compose 的 `services.peach`，设备路径按宿主机调整：

```yaml
    devices:
      - /dev/dri/renderD128:/dev/dri/renderD128
    group_add:
      - "${PEACH_RENDER_GID}"
    environment:
      PEACH_TRANSCODE_BACKEND: auto
      PEACH_VAAPI_DEVICE: /dev/dri/renderD128
```

`PEACH_RENDER_GID` 填宿主机渲染节点所属组的数字 GID。运行用户（默认 `1000:1000`，也可由 `PEACH_UID`/`PEACH_GID` 指定）需要该节点的读写权限；入口降权时保留 Docker `group_add` 的补充组。只透传设备但没有组权限仍会初始化失败。Unraid 在容器设置中添加同样的设备映射、环境变量和额外组，无需开启特权模式。默认 Compose 不挂设备，无 GPU 的机器可直接运行。

生成器对应参数为 `--render-device /dev/dri/renderD128 --render-gid <数字 GID>`。若 NAS 节点模式为 `0600`，额外组也没有读写权限，可以显式改用 `--render-device /dev/dri/renderD128 --prepare-render`。生成的配置写入 `PEACH_VAAPI_PREPARE=1`：镜像入口在准备阶段核对透传节点为容器 `/dev` 文件系统中的独立 DRM 渲染节点，把它交给运行身份的主组读写，再和平时一样降权到 `PEACH_UID`/`PEACH_GID`（默认 1000）启动。非 root 的补充组保留，组 0 移除。媒体和数据卷不参与权限修改；宿主节点权限不变。绑定宿主机的 `/dev/dri`、符号链接、非 DRM 设备和未完成降权的启动均拒绝。

`--prepare-render` 必须搭配单节点 `devices` 透传，不能改为 bind mount，也不需要 `privileged`、`SYS_ADMIN` 或宿主机 PID 空间。已有安装可以选择 NAS 管理器提供的设备 ACL；入口不管理宿主机的 ACL 或内核驱动。生成器的 `--uid`、`--gid` 写入 `PEACH_UID`、`PEACH_GID`，与核显选项可以同时使用。

| 环境变量 | 值与用途 |
| --- | --- |
| `PEACH_TRANSCODE_BACKEND` | 默认 `auto`；可设为 `vaapi`、`nvenc` 或 `software`。指定硬件后端仍会验证能否编码，失败回退软件。 |
| `PEACH_VAAPI_DEVICE` | 指定容器内渲染节点；留空时按名称依次探测 `/dev/dri/renderD*`，使用第一个可用节点。 |

VAAPI 尝试顺序为硬件解码加 `scale_vaapi` / `h264_vaapi`、软件解码加 `hwupload` / `h264_vaapi`、`libx264`。解码能力还受 GPU 型号、片源编码与位深限制；硬件编码可用不能证明每个片源都能硬件解码。NVIDIA 透传还需宿主机驱动及 NVIDIA Container Toolkit，Mesa 不提供 CUDA / NVENC。

出现 CPU 高占用时，先查看日志中的「转码硬件后端」和「转码硬件探测失败」。完成日志「整片转码完成」或「HLS 分片完成」后的 `vaapi` 表示使用硬件解码和编码，`vaapi-encode` 表示软件解码加硬件编码，`libx264` 表示软件转码。再在同一容器、同一用户下检查设备权限与 `vainfo --display drm --device /dev/dri/renderD128` 的结果。`No VA display found` 需结合驱动和设备权限排查，不能仅凭节点存在排除权限问题。

`ffmpeg -hwaccels` 列出构建支持的硬件加速方式，`ffmpeg -h decoder=h264` 等列出对应解码器支持的硬件设备。VAAPI 解码通过普通解码器的硬件加速接口启用，`ffmpeg -decoders` 中没有名为 `vaapi` 的解码器不代表缺少 VAAPI 解码支持。参数含义见 [FFmpeg 官方文档](https://ffmpeg.org/ffmpeg.html#Advanced-Video-options)。目标 GPU 的实际解码、GPU 占用与播放效果需要在部署机器上验证。

## 健康检查与容器日志

镜像的 `HEALTHCHECK` 每 30 秒请求一次 `/healthz?ready=1`，超时 5 秒，启动后 60 秒内的失败不计，连续 3 次失败判为不健康。`compose.yaml` 的 `healthcheck` 只写时间参数，检查命令仍用镜像里的；它的值覆盖镜像的设置，`.env` 不填时与镜像相同。容器标准输出的日志由 `logging` 指定，默认 `json-file`，单个文件 10 MB，保留 3 个。Peach 自己的运行日志写在 `/data/logs`，诊断报告读取那里，不受这两项影响。

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `PEACH_HEALTHCHECK_INTERVAL` | `30s` | 两次健康检查的间隔 |
| `PEACH_HEALTHCHECK_TIMEOUT` | `5s` | 单次检查的超时 |
| `PEACH_HEALTHCHECK_START_PERIOD` | `60s` | 启动宽限期，期间的失败不计入重试 |
| `PEACH_HEALTHCHECK_RETRIES` | `3` | 连续失败几次判为不健康 |
| `PEACH_LOG_DRIVER` | `json-file` | 日志驱动，只能是 `json-file` 或 `local` |
| `PEACH_LOG_MAX_SIZE` | `10m` | 单个日志文件的上限 |
| `PEACH_LOG_MAX_FILE` | `3` | 保留的日志文件数 |

dockerd 每做一次健康检查，都会重写容器的 `config.v2.json` 并 fsync；2026-11-08 在 btrfs 系统盘的 NAS 上观察到每次约写入 1 MB。单块 SSD、btrfs 系统盘或群晖等写入敏感的宿主机，可以在 `.env` 中拉长检查间隔，并把日志驱动改为压缩存储的 `local`：

```dotenv
PEACH_HEALTHCHECK_INTERVAL=60s
PEACH_LOG_DRIVER=local
PEACH_LOG_MAX_SIZE=5m
PEACH_LOG_MAX_FILE=2
```

间隔越长，Peach 停止响应后被标为不健康就越晚。低于 25 版的 Docker Engine 在容器启动后等满一个间隔才做第一次检查，启用 Watchtower 时它随之晚一些启动。`local` 驱动的日志仍可用 `docker compose logs` 查看。群晖 Container Manager 默认的 `db` 驱动等其他驱动不接受上面的大小参数，需要在 `compose.override.yaml` 中改写 `logging`。修改后运行 `docker compose up -d` 重建容器才生效。不用 Compose 时，`docker run` 的 `--health-interval` 等参数与 `--log-driver`、`--log-opt` 是同样的设置。

## amane 刮削站点

镜像随附按 `tools/amane-bridge/uv.lock` 构建的 amane `0.27.1` 独立环境，位于 `/app/amane-runtime`，通过 `PEACH_AMANE_RUNTIME` 定位。全新 `/data` 卷可直接调用刮削站点，无需在首次运行时安装依赖。桥通过独立子进程调用，站点请求仍使用所选连接方式。

运行环境与镜像一起更新，`manifest.json` 记录固定 revision、版本和解释器相对路径。镜像构建阶段与最终运行阶段都会执行 `bridge.py --self-check`，离线载入运行时与全部 Peach 开放站点类。此检查不发站点请求；来源网络是否可达需在部署环境验证。环境损坏时重新拉取并创建对应镜像，保留 `/data` 卷。

`/app/amane-runtime` 同时包含 GPL-3.0 许可证、来源说明和 `amane-corresponding-source.zip`；归档包含固定 revision 的完整 amane 源码、Peach 桥、锁文件、构建入口，以及 certifi 的固定源码。依赖许可证保留在独立环境内。

## 导出诊断报告

Docker 部署使用网页「Peach 配置 → 系统诊断 → 下载诊断报告」，无需桌面托盘。已登录的私有网络客户端可以下载；通过反向代理或公网访问时，改用容器内导出。

网页不可用时，在 Compose 文件所在目录执行下面的命令，在正在运行的 `peach` 服务容器中生成脱敏 ZIP。目标文件已存在会拒绝覆盖；再次导出时同时更换两条命令中的文件名。

```text
docker compose exec peach python -m peach.support_bundle /tmp/peach-support.zip
```

将 ZIP 复制到当前目录：

```text
docker compose cp peach:/tmp/peach-support.zip ./peach-support.zip
```

报告包含版本、运行日志和任务状态，不包含数据库、媒体或配置原文。发送前检查内容，脱敏范围见 [日志与诊断](DIAGNOSTICS.md)。容器不连接宿主机桌面托盘；管理与诊断入口均在网页和 CLI 中提供。

## 更新与范围

配置页「检查更新」在容器里显示安装方式「Docker 镜像」。容器里的「有新版本」以 Docker Hub 为准：版本号标签已推送、`edge` 指向同一镜像才算；发布页已有新版而镜像还没推送时显示「镜像尚未发布」。检查只读镜像清单的摘要，不下载镜像。

没有启用下文的一键更新时，有新版本会列出宿主机上的两步：`docker compose pull` 拉取新镜像，`docker compose up -d` 重建容器。`.env` 把 `PEACH_VERSION` 固定成版本号的，先改成新版本再拉取。

更新镜像并重建容器时保留 `/data`。新容器启动时，已有数据库有待执行的迁移就先在 `/data/database/` 备份成 `ledger.pre-migrate-<时间>.db`，再执行迁移，完成后才启动服务；手动更新和一键更新都这样处理。迁移最多等 180 秒，失败或超时时容器退出，`restart: unless-stopped` 会反复重启，每次重启都会再备份一份，先用 `docker compose logs peach` 查原因，必要时 `docker compose stop peach` 停下。健康检查使用 `/healthz?ready=1`。

### 一键更新（可选 Watchtower）

容器换不掉自己。`compose.yaml` 的 `watchtower` profile 提供一个可选的 [Watchtower](https://github.com/nicholas-fedor/watchtower) 容器（`nickfedor/watchtower`，原 `containrrr/watchtower` 已停止维护）：配置页点「一键更新」后，Peach 请它拉取新镜像并按原配置重建 Peach 容器，`/data` 卷保留。它只管带 `com.centurylinklabs.watchtower.enable=true` 标签的 Peach 容器，只在收到请求时更新，不定时轮询，也不对宿主机发布端口。

Watchtower 挂着宿主机的 Docker socket，能创建、停止任何容器，等于宿主机 root 权限。只在信任这台宿主机上的 compose 配置时启用。Peach 容器本身不挂 socket，只持有 Watchtower 更新接口的令牌。

启用只需一步，不用在配置页填写任何内容：在 `compose.yaml` 所在目录运行 `docker compose --profile watchtower up -d`。之后的 `docker compose` 命令都带上 `--profile watchtower`，或在 `.env` 写 `COMPOSE_PROFILES=watchtower`。`.env` 不要把 `PEACH_VERSION` 固定成版本号：Watchtower 只会换同一标签的新镜像，标签是版本号时配置页会改为列出两步命令。

令牌由 Peach 首次启动时生成，放在 `peach-update` 卷里，之后不再更换。Watchtower 等 Peach 健康后才启动，只读挂这个卷，读不到 `/data`。`/data` 改成宿主机目录时不用改 Watchtower 的配置。不启用 profile 的部署只多一个装着令牌文件的小卷。点「一键更新」提示令牌不一致时，运行 `docker compose restart watchtower` 让它重新读取。

检查更新发现新镜像后，「一键更新」替代两步命令。点击并确认后，Peach 会断开一会儿；新版本启动后页面提示刷新。15 分钟内没有看到新版本时，用 `docker compose logs watchtower` 和 `docker compose logs peach` 查看原因。已经在宿主机上 `docker compose pull` 过新镜像、还没 `up -d` 时，旧容器的镜像可能已失去标签，Watchtower 日志显示 `Failed to retrieve image info` 并跳过；这时直接运行 `docker compose up -d`。

Watchtower 不在新容器起不来时自动回退。换上新镜像后它删除被替下的旧镜像，免得每次更新在 NAS 上多留一份；指向同一镜像的其他本地标签也一起删除。Docker Hub 保留每个版本号标签，回滚时重新拉取。回滚到旧版本前，先停下 Peach，用升级时生成的 `ledger.pre-migrate-<时间>.db` 替换 `ledger.db`，再把 `.env` 的 `PEACH_VERSION` 设为旧版本号并 `docker compose up -d`；旧版本不会写入它不认识的数据库结构。方案取舍见 [ADR-0140](adr/0140-docker-one-click-update-via-watchtower.md)。

2026-11-04 在 Windows 的 Docker Desktop（Engine 29.9.2，containerd 镜像库）上，运行中容器的镜像只有 `edge` 一个本机标签，把本地 registry 的 `edge` 换成版本号更高、多一个空表迁移的测试镜像，经配置页触发后通过验收：Watchtower 自己拉取新镜像，按 75 秒停止超时停下旧容器，11 秒内起了新容器；`/data` 里的标记文件保留，启动前生成 `ledger.pre-migrate-*.db` 并执行了新迁移，`/healthz?ready=1` 通过，旧镜像已清理。全新启动时 Watchtower 在 Peach 首次健康的同一秒启动，令牌文件属主为 `peach`、权限 600；两个容器同时重启后令牌仍然一致；改掉卷里的令牌后点「一键更新」得到要求重启 Watchtower 的提示，`docker compose restart watchtower` 后恢复。不带 profile 时 `docker compose up -d` 照常启动。Docker Hub 的真实拉取、ARM NAS 与 Docker Desktop 以外的 Linux 宿主机未取得。

Linux 容器不读取用户电脑上的浏览历史，也不包含交互式浏览器；需要本机浏览器完成验证的来源在此环境不可用。CloudDrive2 的真实账号登录、网盘流量与 NAS 实机挂载需在目标机器验证。

## 在网页中操作 NAS 目录

NAS 部署的文件位于服务器上。首启设置、媒体目录设置和整理目标中的「选择文件夹」会打开网页内的服务端目录选择器；桌面部署沿用系统对话框。Docker 可从 `/media` 开始，也可浏览已配置的媒体挂载目录。这里使用容器路径，例如宿主机 `/srv/videos` 映射为 `/media` 后，在 Peach 中填写 `/media`。

目录选择器只列出子目录，不读取视频，不创建、移动或删除文件。它不允许越过媒体根，也不跟随列表中的符号链接；单次最多读取 500 个条目，十秒未返回会终止本次读取。条目较多时点「继续读取」，也可输入完整子目录路径并按回车读取。旧路径失效或挂载离线时，弹层保留挂载目录入口供重新选择；浏览本地目录不会探测其他网盘根。新挂载尚未进入配置时，直接在媒体目录输入框填写容器内路径并保存。

「查看文件位置」和资产的定位动作在无桌面服务中显示服务端或容器内路径，媒体另显示已配置的媒体根和目录内位置。路径框可选中复制，在 NAS 文件管理器中打开对应共享文件夹后按目录内位置查找。容器无法自行得知宿主机的共享路径，不推测 File Station 地址或映射关系。垃圾队列、详情、图片浏览与设置中的位置入口使用相同回执。文件移动、整理与删除仍取决于容器的实际挂载权限，只读媒体挂载会拒绝写入。

数据目录与媒体目录分开处理。无桌面源码部署可在数据目录弹层手动填写服务端位置，保存与迁移继续执行既有目录校验；Docker 数据卷位置由宿主机容器配置决定，网页只提供说明，不提供容器内迁移入口。

## 镜像发布

构建使用官方 Python `3.14.8-slim-trixie` 与 uv `0.13.1`，应用依赖与 amane 独立依赖分别由各自的 `uv.lock` 锁定。应用以非 editable 包安装，包含 Web 与迁移资源。镜像默认以 UID/GID 1000 运行，可通过 `PEACH_UID`/`PEACH_GID` 覆盖；内置 FFmpeg、FFprobe、OpenSSL 和 amane 独立环境。uv 与 Git 只用于构建阶段。构建上下文只允许代码与资源，不包含工作树、媒体、真实 Peach 数据库或凭据。

GitHub Actions 的 `Docker` 工作流在拉取请求和主线上分别于 amd64 与 arm64 原生 runner 构建并运行临时卷验收，只验收不发布。版本提交的 `Release` 演练用同样方式构建两个架构的候选镜像并保存；标签流水线在 GitHub Release 成功后核对两个候选的 image ID，推送 `<版本>-amd64`、`<版本>-arm64`，再合成一个多架构 index，版本号、`edge` 与 `latest` 都指向它（[ADR-0121](adr/0121-release-rehearsal-and-atomic-publication.md)）。仓库变量 `DOCKERHUB_USERNAME` 和机密 `DOCKERHUB_TOKEN` 用于 Docker Hub 发布；机密只保存在 GitHub，不进入项目文件。未配置发布身份时仍执行构建验收。

Docker Hub 页面以英文为主，概览正文取自 [docs/dockerhub/README.md](dockerhub/README.md)，链接回 GitHub 的源码、本文和中文 README。简介填写 `Local-first video metadata scraper and media manager. Self-hosted web UI for VPS and NAS.`。发布流水线只推送镜像，概览与简介需要在 Docker Hub 仓库设置中手动更新；镜像、端口、目录或 Compose 示例变化时同批修改该文件。

## 安装后检查资料源与封面连接

完成首次设置、保存代理或来源 Cookie 后，打开「数据管理 → 来源和凭证」，在「连接检查」里点「全部检查」。检查在后台进行，页面显示已检查的来源数；离开页面不中断，回来仍能看到上一次的结果，任务中心也会留下这一轮记录。

只想重查几个来源，或需要机器可读的结果时，在容器管理器的终端执行同一检查：

```bash
python -m peach check-sources
python -m peach check-sources --source dmm --source javdb --json
```

检查在 NAS 容器内发起，使用该实例已有的来源网络设置、Cookie 与冷却记录。最多四个来源并发，每个来源限制请求次数、读取量与时间预算；只读取来源页面，以及 DMM、r18.dev、JavDB、JavBus、MGStage 各自图片主机上一张样图的前 64 KB（其余来源没有固定图片主机，图片一项标「未检查」），不读取影片、不启动桌面浏览器。结果保留到现有采集设置的来源连接记录；限流或拒绝访问沿用现有冷却机制，不自动关闭来源或修改代理。

网页与命令行的报告使用同一口径，逐项区分可连接、登录或人机验证、HTTP 错误、冷却与网络失败。正在冷却的来源直接报冷却，不再发请求。页面能连接仅说明检查地址可达，不代表全部作品资料、封面或登录会话可用；片商官网需要番号时标记为未检查，不计为连接失败。命令行在其余目标未通过时退出码为 1。更换 NAS 出口或代理后可再次检查；`--source` 可重复指定，仅重查关心的来源。
