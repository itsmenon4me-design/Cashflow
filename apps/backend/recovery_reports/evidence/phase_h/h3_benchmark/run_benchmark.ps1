# Helper to run the benchmark with sensible defaults
param(
  [string]$ConfigPath
)

if(-not $env:TARGET_URL){
  $env:TARGET_URL = 'http://localhost:3001/api/v1'
}

if(-not (Get-Command node -ErrorAction SilentlyContinue)){
  Write-Error 'node not found on PATH. Install Node 18+ and try again.'; exit 2
}

$script = Join-Path $PSScriptRoot 'benchmark.js'
if($ConfigPath){
  node $script $ConfigPath
}else{
  node $script
}
