param(
    [string]$ProfileDir = $(if ($env:VIBE_GIT_RESEARCH_PROFILE) { $env:VIBE_GIT_RESEARCH_PROFILE } else { Join-Path $env:LOCALAPPDATA 'VibeGit\team-research' }),
    [string]$HostUrl,
    [string]$JoinFile,
    [string]$ProjectId,
    [switch]$Captain,
    [switch]$SaveKey
)
$ErrorActionPreference = 'Stop'
$profilePath = [IO.Path]::GetFullPath($ProfileDir)
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($profilePath.Equals($projectPath, [StringComparison]::OrdinalIgnoreCase) -or $profilePath.StartsWith($projectPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw '成员凭据目录必须位于项目之外。'
}
if ($ProjectId -and $ProjectId -notmatch '^[a-zA-Z0-9_-]{1,120}$') { throw '项目 ID 格式不正确。' }
New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
$env:SCIENCEPAL_AUTH_FILE = Join-Path $profilePath 'sciencepal-auth.json'
$env:VIBE_GIT_MEMBER_FILE = Join-Path $profilePath 'member.json'
if ($Captain) {
    $dataPath = if ($env:VIBE_GIT_DATA_DIR) { $env:VIBE_GIT_DATA_DIR } else { Join-Path $projectPath 'data\sciencepal' }
    $env:VIBE_GIT_MEMBER_FILE = Join-Path $dataPath 'v20\captain.json'
    if (-not $HostUrl) { $HostUrl = 'http://127.0.0.1:8788' }
}
if ($HostUrl) { $env:VIBE_GIT_HOST = $HostUrl } else { Remove-Item Env:VIBE_GIT_HOST -ErrorAction SilentlyContinue }
if ($JoinFile) { $env:VIBE_GIT_JOIN_FILE = [IO.Path]::GetFullPath($JoinFile) }
if ($ProjectId) {
    $journalTool = Join-Path $projectPath 'apps\host\dist\sciencepal\member-main.js'
    if (-not (Test-Path -LiteralPath $journalTool)) { throw '请先 npm run build，再配置本人的项目环境。' }
    $journalResult = & node $journalTool journal-path $ProjectId $profilePath
    if ($LASTEXITCODE -ne 0) { throw '无法确认连接器日志；保留原文件，先核对上方错误。' }
    $env:VIBE_GIT_CONNECTOR_STATE = ([string]$journalResult).Trim()
}
if ($SaveKey) {
    if (Test-Path -LiteralPath $env:SCIENCEPAL_AUTH_FILE) { throw 'Key 文件已存在，不覆盖。复用时省略 -SaveKey；换 Key 请另选 ProfileDir。' }
    $secure = Read-Host '输入本人 SciencePAL API Key（隐藏输入，仅保存在本机）' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $file = $null
    $writer = $null
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Key 不能为空。' }
        $file = [IO.File]::Open($env:SCIENCEPAL_AUTH_FILE, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        $writer = [IO.StreamWriter]::new($file, [Text.UTF8Encoding]::new($false))
        $writer.Write((@{apiKey=$plain.Trim()} | ConvertTo-Json -Compress))
    } finally {
        if ($writer) { $writer.Dispose() } elseif ($file) { $file.Dispose() }
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        $plain = $null
        $secure.Dispose()
    }
}
Write-Host '当前终端已配置成员环境。新终端请重跑此脚本；已有 Key 时省略 -SaveKey。'
Write-Host '密钥、入队凭据和连接器日志留在个人目录，不发给队长。'
