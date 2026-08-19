param(
  [string]$EnvFile = ".env.verify",
  [int]$HealthRetries = 30,
  [int]$HealthDelaySec = 5
)

# Usage: Open PowerShell as Administrator and run:
# $env:CASHFLOW_ENV_FILE = ".env.verify"; .\docker\run_verify_and_playwright.ps1

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$evidenceDir = Join-Path -Path "$(Resolve-Path .).Path" -ChildPath "docker/recovery_reports/evidence/phase13_$timestamp"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
Write-Host "Evidence folder: $evidenceDir"

$composeFiles = @('docker/docker-compose.yml','docker/docker-compose.verify.yml')
$composeArgs = $composeFiles -join ' -f '

# Ensure env var for compose
$env:CASHFLOW_ENV_FILE = $EnvFile
Write-Host "Using CASHFLOW_ENV_FILE=$EnvFile"

function Run-Command($cmd) {
  Write-Host "=> $cmd"
  cmd.exe /c $cmd
}

try {
  # STEP 1: Inspect verify stack
  Write-Host "--- STEP 1: docker compose ps (verify) ---"
  Run-Command "docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile ps" | Tee-Object -FilePath (Join-Path $evidenceDir 'compose_ps.txt')

  # STEP 2: Rebuild frontend image with no-cache
  Write-Host "--- STEP 2: Build frontend image (no-cache) ---"
  Run-Command "docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile build --no-cache frontend" 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'build_frontend.log')

  # Recreate frontend + nginx only
  Write-Host "--- Recreate frontend and nginx (no-deps, force recreate) ---"
  Run-Command "docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile up -d --no-deps --force-recreate frontend nginx" 2>&1 | Tee-Object -FilePath (Join-Path $evidenceDir 'up_frontend_nginx.log')

  Start-Sleep -Seconds 3

  # STEP 3: Verify services
  Write-Host "--- STEP 3: Healthcheck endpoints ---"
  $baseUrl = 'http://localhost:8080'
  $apiHealth = 'http://localhost:3101/api/v1/health'
  $nginxHealth = "$baseUrl/api/v1/health"

  function Wait-Url($url, $retries, $delaySec) {
    for ($i=0; $i -lt $retries; $i++) {
      try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { Write-Host "OK: $url"; return $true }
      } catch {
        Write-Host "Waiting for $url ... ($($i+1)/$retries)"
      }
      Start-Sleep -Seconds $delaySec
    }
    return $false
  }

  $ok1 = Wait-Url $baseUrl $HealthRetries $HealthDelaySec
  $ok2 = Wait-Url $nginxHealth $HealthRetries $HealthDelaySec
  $ok3 = Wait-Url $apiHealth $HealthRetries $HealthDelaySec

  if (-not ($ok1 -and $ok2 -and $ok3)) {
    Write-Error "Healthchecks failed. See logs in $evidenceDir"
    docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile logs --no-color frontend nginx backend > (Join-Path $evidenceDir 'compose_logs.txt')
    exit 2
  }

  Write-Host "Services healthy. Continuing to Playwright run."

  # Dump container and image info
  docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile ps --all > (Join-Path $evidenceDir 'compose_ps_after.txt')
  docker images --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.CreatedAt}}" > (Join-Path $evidenceDir 'docker_images.txt')

  # STEP 4: Run Playwright canonical spec
  Write-Host "--- STEP 4: Running Playwright canonical spec ---"
  Push-Location 'apps/frontend'
  $env:BASE_URL = 'http://localhost:8080'
  $env:API_BASE = 'http://localhost:3101/api/v1'
  $env:TEST_DATABASE_URL = 'postgresql://postgres:verifypass@localhost:55432/cashflow?schema=public'

  $pwReportDir = Join-Path $evidenceDir 'playwright'
  New-Item -ItemType Directory -Force -Path $pwReportDir | Out-Null

  # Run playwright with trace retained on failure; output logged
  $pwCmd = "npx playwright test playwright/multi-currency-acceptance.final.spec.ts --workers=1 --trace=retain-on-failure --timeout=180000 --reporter=list --output=$pwReportDir"
  Write-Host "Playwright command: $pwCmd"
  cmd.exe /c $pwCmd 2>&1 | Tee-Object -FilePath (Join-Path $pwReportDir 'playwright_run.log')
  Pop-Location

  # Collect compose logs around test run
  docker compose -f $($composeFiles[0]) -f $($composeFiles[1]) --env-file docker/$EnvFile logs --no-color --since '5m' frontend nginx backend > (Join-Path $evidenceDir 'compose_logs_post_run.txt')

  Write-Host "Playwright run complete. Artifacts in: $pwReportDir"
  Write-Host "Evidence collection complete: $evidenceDir"
  Write-Host "Please attach the playwright log and any trace.zip files from $pwReportDir when reporting back."

} catch {
  Write-Error "Error during execution: $_"
  exit 1
}
