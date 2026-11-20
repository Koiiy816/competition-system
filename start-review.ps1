param([string]$NodePath, [int]$ApiPort = 5002, [int]$WebPort = 5178)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if (-not $NodePath) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($nodeCommand) { $NodePath = $nodeCommand.Source }
  elseif ($env:CODEX_PRIMARY_RUNTIME_NODE) { $NodePath = $env:CODEX_PRIMARY_RUNTIME_NODE }
  else {
    $runtime = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' | Select-Object -First 1
    if ($runtime) { $NodePath = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe' }
  }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) { throw 'Node.js was not found. Run with -NodePath <path-to-node.exe>.' }
function Test-ReviewPort([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $task = $client.ConnectAsync('127.0.0.1', $Port); return ($task.Wait(500) -and $client.Connected) }
  catch { return $false }
  finally { $client.Dispose() }
}
foreach ($port in @($ApiPort, $WebPort)) {
  if (Test-ReviewPort $port) { throw "Review port $port is already in use. Existing services have been left running." }
}
$logDir = Join-Path $projectRoot '.tmp\review-services'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (-not (Test-ReviewPort 27017)) {
  $mongoCandidates = @(
    (Join-Path $projectRoot 'backend\.local\mongodb\mongodb-win32-x86_64-windows-8.3.7\bin\mongod.exe'),
    (Join-Path $projectRoot '.local-tools\mongodb-win32-x86_64-windows-8.0.28\bin\mongod.exe')
  )
  $mongo = $mongoCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $mongo) { throw 'MongoDB is not running on port 27017. Start the local database first.' }
  $dataDir = Join-Path $projectRoot '.local-data\mongo'
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  Start-Process -FilePath $mongo -ArgumentList "--dbpath `"$dataDir`" --port 27017 --bind_ip 127.0.0.1 --logpath `"$logDir\mongodb.log`"" -WindowStyle Hidden | Out-Null
  for ($i = 0; $i -lt 20 -and -not (Test-ReviewPort 27017); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-ReviewPort 27017)) { throw "MongoDB did not start. Check $logDir\mongodb.log" }
}
$backendScript = Join-Path $projectRoot 'backend\scripts\local-review.js'
$frontendScript = Join-Path $projectRoot 'frontend\scripts\local-review.mjs'
$api = Start-Process -FilePath $NodePath -ArgumentList "`"$backendScript`" $ApiPort" -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'backend.log') -RedirectStandardError (Join-Path $logDir 'backend-error.log') -PassThru
$web = Start-Process -FilePath $NodePath -ArgumentList "`"$frontendScript`" $ApiPort $WebPort" -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log') -PassThru
for ($i = 0; $i -lt 30; $i++) {
  if ((Test-ReviewPort $ApiPort) -and (Test-ReviewPort $WebPort)) { break }
  Start-Sleep -Milliseconds 500
}
if (-not (Test-ReviewPort $ApiPort) -or -not (Test-ReviewPort $WebPort)) {
  throw "Review services did not start. Check logs in $logDir"
}
@{ backend = $api.Id; frontend = $web.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDir 'processes.json')
Write-Host "Review frontend: http://127.0.0.1:$WebPort"
Write-Host "Review backend:  http://127.0.0.1:$ApiPort"
