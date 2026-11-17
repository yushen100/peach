param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths,
    [string]$Language = 'en-US'
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot '../resources/ocr/windows.ps1') -Paths $Paths -Language $Language
