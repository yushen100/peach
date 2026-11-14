param([ValidateSet('verify', 'build', 'smoke', 'docker-build', 'docker-push')][string]$Mode = 'verify',
      # verify 默认全量；changed 只跑改动域与平台敏感用例，供主线推送使用（ADR-0119）。
      [ValidateSet('full', 'changed')][string]$Coverage = 'full')
$ErrorActionPreference = 'Stop'

function Assert-Exit([string]$Message) {
    if ($LASTEXITCODE -ne 0) { throw $Message }
}

# 标签流水线核对标签与版本号一致；版本提交的演练（ADR-0121）还没有标签，由流水线规则保证是版本提交。
function Assert-ReleaseRef([string]$Version) {
    if ($env:PEACH_RELEASE_REHEARSAL -eq '1') { return }
    if ($env:CI_COMMIT_TAG -ne "v$Version") { throw 'Tag 与版本不一致' }
}

if ($Mode -eq 'verify' -or $Mode -eq 'build') {
    uv sync --locked --all-extras --python 3.14
    Assert-Exit '锁定依赖安装失败'
    uv pip check --python .venv/Scripts/python.exe
    Assert-Exit '依赖检查失败'
    & .venv/Scripts/python.exe -X utf8 scripts/npm_ci.py --ignore-scripts
    Assert-Exit '根目录 npm 安装失败'
    & .venv/Scripts/python.exe -X utf8 scripts/npm_ci.py --prefix frontend
    Assert-Exit '前端依赖安装失败'
}

if ($Mode -eq 'verify') {
    $env:PEACH_E2E_CHROME = Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'
    $Plan = @('full')
    if ($Coverage -eq 'changed') {
        $Plan = @(& .venv/Scripts/python.exe -X utf8 scripts/ci_scope.py --platform windows)
        Assert-Exit '无法判定主线选测范围'
    }
    if ($Plan[0] -eq 'full') {
        & ./scripts/test.ps1 -Scope full -Resume
        Assert-Exit 'Windows 全量回归未通过'
        exit 0
    }
    & ./scripts/test.ps1 -Scope auto -Base $Plan[0]
    Assert-Exit 'Windows 改动域回归未通过'
    & ./scripts/test.ps1 -Focus @($Plan | Select-Object -Skip 1)
    Assert-Exit 'Windows 平台敏感用例未通过'
    exit 0
}

if ($Mode -eq 'build') {
    $LocalCompiler = Join-Path $env:LOCALAPPDATA 'Programs/Inno Setup 6/ISCC.exe'
    if (-not $env:PEACH_ISCC -and (Test-Path -LiteralPath $LocalCompiler)) { $env:PEACH_ISCC = $LocalCompiler }
    $Version = (& .venv/Scripts/python.exe -c 'from peach import __version__; print(__version__)').Trim()
    Assert-Exit '无法读取发布版本'
    Assert-ReleaseRef $Version
    $Changes = git status --porcelain --untracked-files=all
    Assert-Exit '无法核对提交状态'
    if ($Changes) { throw '构建必须使用干净提交' }
    & ./scripts/fetch_cloudflared.ps1 -OutputPath build/cloudflared.exe
    Assert-Exit 'cloudflared 校验失败'
    & ./scripts/test.ps1 -Scope packaging -Focus test_desktop_installer
    Assert-Exit '安装目录保护回归失败'
    & ./scripts/build_windows.ps1 -Installer -RequireReporting -CloudflaredPath build/cloudflared.exe -FFmpegPath build/ffmpeg-windows/ffmpeg -UntruncPath build/untrunc-windows/untrunc
    Assert-Exit 'Windows 构建失败'
    New-Item -ItemType Directory -Path release -Force | Out-Null
    & .venv/Scripts/python.exe scripts/package_windows_release.py --source dist/Peach --output release --version $Version --lite-installer
    Assert-Exit '发行包拆分失败'
    & .venv/Scripts/python.exe scripts/update_compat.py --packages release --version $Version
    Assert-Exit '支持范围内的旧版客户端装不上这一版'
    Copy-Item -LiteralPath "dist/Peach-$Version-windows-x64-setup.exe" -Destination release/
    Copy-Item -LiteralPath dist/ffmpeg-corresponding-source.zip, dist/untrunc-corresponding-source.zip -Destination release/
    Copy-Item -LiteralPath scripts/smoke_desktop.py, scripts/smoke_update_tasks.py, scripts/smoke_split_update.py, scripts/ci_windows.ps1 -Destination release/
    & .venv/Scripts/python.exe scripts/changelog.py --notes $Version --to release/RELEASE_NOTES.md
    Assert-Exit '缺少发布说明'
    $Version | Set-Content -LiteralPath release/version.txt -Encoding utf8
    exit 0
}

if ($Mode -eq 'docker-build' -or $Mode -eq 'docker-push') {
    # Linux 平台 Runner 不提供 Docker 守护进程；镜像在本机 Docker Desktop 构建、验收，
    # 留在本机等 publish-release 成功后再推（同一条流水线只有这一台 Windows runner）。
    $Match = Select-String -LiteralPath src/peach/__init__.py -Pattern '^__version__ = "([^"]+)"'
    if (-not $Match) { throw '无法读取发布版本' }
    $Version = $Match.Matches[0].Groups[1].Value
    Assert-ReleaseRef $Version
    $Endpoint = (docker context inspect --format '{{.Endpoints.docker.Host}}')
    Assert-Exit '需要运行 Docker Desktop'
    $SourcePipeline = $env:CI_PIPELINE_ID
    if ($Mode -eq 'docker-push') {
        $CandidateReceipt = Get-Content -LiteralPath build/ci-artifacts/release-candidate.json -Raw -Encoding utf8 | ConvertFrom-Json
        if ($CandidateReceipt.target.pipeline -ne $env:CI_PIPELINE_ID -or $CandidateReceipt.target.commit -ne $env:CI_COMMIT_SHA) { throw '镜像晋级回执不属于当前发布' }
        $SourcePipeline = $CandidateReceipt.candidate.identity.pipeline
    }
    $Candidate = "peach-ci:$Version-$SourcePipeline"
}

if ($Mode -eq 'docker-build') {
    $Revision = (git rev-parse HEAD).Trim()
    Assert-Exit '无法读取提交'
    if ((Test-Path -LiteralPath build/ci-artifacts/docker-release-resume.json) -and (Get-Content -LiteralPath build/ci-artifacts/docker-release-resume.json -Raw | ConvertFrom-Json).restored) {
        $Verified = Get-Content -LiteralPath build/ci-artifacts/docker-image.json -Raw -Encoding utf8 | ConvertFrom-Json
        $Existing = docker image inspect --format '{{json .}}' $Candidate | ConvertFrom-Json
        Assert-Exit '已登记的候选镜像不在本机，请重新执行演练'
        if ($Existing.Id -ne $Verified.image_id -or $Existing.Config.Labels.'org.opencontainers.image.revision' -ne $Revision -or $Existing.Config.Labels.'org.opencontainers.image.version' -ne $Version) { throw '本机候选镜像与验收回执不一致' }
        exit 0
    }
    docker build --pull --label "org.opencontainers.image.version=$Version" --label "org.opencontainers.image.revision=$Revision" `
        --build-arg PEACH_SENTRY_DSN --build-arg PEACH_LIBRARY_SENTRY_DSN --build-arg PEACH_REQUIRE_REPORTING=1 -t $Candidate .
    Assert-Exit '镜像构建失败'
    try {
        & (Get-Command python.exe).Source -X utf8 scripts/smoke_docker.py $Candidate
        Assert-Exit '镜像验收失败'
        docker run --rm --entrypoint python $Candidate -c 'from peach import library_sharing, remote_reporting, reporting_identity; assert remote_reporting.dsn() and library_sharing.target() and reporting_identity.distribution() == ''docker'''
        Assert-Exit '镜像内 Sentry DSN 或分发标记缺失'
    } catch {
        docker image rm $Candidate | Out-Null
        throw
    }
    $ImageId = (docker image inspect --format '{{.Id}}' $Candidate).Trim()
    Assert-Exit '无法读取已验收镜像摘要'
    New-Item -ItemType Directory -Path build/ci-artifacts -Force | Out-Null
    @{image=$Candidate; image_id=$ImageId; version=$Version; commit=$Revision; pipeline=$env:CI_PIPELINE_ID} | ConvertTo-Json | Set-Content -LiteralPath build/ci-artifacts/docker-image.json -Encoding utf8
    exit 0
}

if ($Mode -eq 'docker-push') {
    if (-not $env:DOCKERHUB_USERNAME -or -not $env:DOCKERHUB_TOKEN) { throw '缺少 Docker Hub 发布变量' }
    docker image inspect $Candidate | Out-Null
    Assert-Exit "本机没有 docker-build 验收过的 $Candidate；重试 docker-build 后再推送"
    $ActualImage = (docker image inspect --format '{{json .}}' $Candidate | ConvertFrom-Json)
    Assert-Exit '无法读取候选镜像身份'
    if ($ActualImage.Id -ne $CandidateReceipt.candidate.docker.image_id -or $ActualImage.Config.Labels.'org.opencontainers.image.revision' -ne $env:CI_COMMIT_SHA -or $ActualImage.Config.Labels.'org.opencontainers.image.version' -ne $Version) { throw '候选镜像与已验收的摘要、提交或版本不一致' }
    # 登录写进作业专用配置目录，不改动宿主用户的 Docker 登录。
    $SavedConfig, $SavedHost = $env:DOCKER_CONFIG, $env:DOCKER_HOST
    $env:DOCKER_HOST = $Endpoint
    $env:DOCKER_CONFIG = Join-Path ([IO.Path]::GetTempPath()) ('peach-docker-config-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $env:DOCKER_CONFIG | Out-Null
    try {
        $env:DOCKERHUB_TOKEN | docker login --username $env:DOCKERHUB_USERNAME --password-stdin
        Assert-Exit 'Docker Hub 登录失败'
        foreach ($Tag in @($Version, 'edge')) {
            docker tag $Candidate "longmeidao/peach:$Tag"
            Assert-Exit '镜像标签失败'
            docker push "longmeidao/peach:$Tag"
            Assert-Exit "推送 longmeidao/peach:$Tag 失败"
        }
    } finally {
        docker logout | Out-Null
        Remove-Item -LiteralPath $env:DOCKER_CONFIG -Recurse -Force -ErrorAction SilentlyContinue
        $env:DOCKER_CONFIG, $env:DOCKER_HOST = $SavedConfig, $SavedHost
    }
    docker image rm $Candidate | Out-Null
    exit 0
}

$Version = (Get-Content -LiteralPath release/version.txt -Raw -Encoding utf8).Trim()
$Packages = (Resolve-Path release).Path
$ValidationScripts = (Resolve-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts')).Path
if (-not (Test-Path -LiteralPath (Join-Path $ValidationScripts 'build_amane_runtime.py'))) {
    throw '独立制品验收缺少同一检出下的辅助模块'
}
$PreviousValidationPythonPath = $env:PYTHONPATH
$Evidence = Join-Path ([IO.Path]::GetTempPath()) ('peach-release-smoke-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Evidence | Out-Null
$Python = (Get-Command python.exe).Source
$Key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{02D9748A-78F6-4866-AC75-918177194DAB}_is1'
$Menu = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/Peach.lnk'
if ((Test-Path -LiteralPath $Key) -or (Test-Path -LiteralPath $Menu)) { throw '现有 Peach 安装登记需要保留，不能覆盖安装验收' }
Push-Location $Evidence
try {
    # 验收宿主使用同一检出的辅助模块；被测应用清除 PYTHONPATH。
    $env:PYTHONPATH = $ValidationScripts
    Expand-Archive -LiteralPath "$Packages/Peach-$Version-windows-x64.zip" -DestinationPath candidate
    & $Python "$Packages/smoke_desktop.py" candidate/Peach/Peach.exe
    Assert-Exit '完整包运行验收失败'
    & $Python "$Packages/smoke_split_update.py" --root $Packages --version $Version --destination split-candidate --prepare-with-app
    Assert-Exit '拆分包重建失败'
    & $Python "$Packages/smoke_desktop.py" split-candidate/Peach/Peach.exe
    Assert-Exit '拆分包运行验收失败'
    foreach ($Suffix in @('-setup.exe', '-lite-setup.exe')) {
        $Installed = Join-Path $Evidence ('安装验收/自定义目录' + $Suffix)
        $Setup = Start-Process -FilePath "$Packages/Peach-$Version-windows-x64$Suffix" -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/DIR=`"$Installed`"") -WindowStyle Hidden -Wait -PassThru
        if ($Setup.ExitCode -ne 0) { throw "安装包退出码 $($Setup.ExitCode)" }
        if (-not (Test-Path -LiteralPath $Key) -or -not (Test-Path -LiteralPath $Menu)) { throw '缺少安装登记或开始菜单项' }
        & $Python "$Packages/smoke_desktop.py" (Join-Path $Installed 'Peach.exe')
        Assert-Exit '安装包运行验收失败'
        Start-Process -FilePath (Join-Path $Installed 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -WindowStyle Hidden -Wait
        $Deadline = (Get-Date).AddSeconds(120)
        while ((Test-Path -LiteralPath $Installed) -and (Get-Date) -lt $Deadline) { Start-Sleep -Seconds 1 }
        if ((Test-Path -LiteralPath $Installed) -or (Test-Path -LiteralPath $Key) -or (Test-Path -LiteralPath $Menu)) { throw '卸载验收未通过' }
    }
    & $Python "$Packages/smoke_update_tasks.py" candidate/Peach/Peach.exe --installer "$Packages/Peach-$Version-windows-x64-setup.exe" --apply
    Assert-Exit '任务保护与安装恢复验收失败'
} finally {
    $env:PYTHONPATH = $PreviousValidationPythonPath
    Pop-Location
    Write-Host "独立制品验收目录：$Evidence"
}
