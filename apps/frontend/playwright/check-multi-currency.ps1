# PowerShell API assertions for multi-currency acceptance
# Usage: set TEST_DATABASE_URL and run after seeding (psql -f prisma/multi_currency_seed.sql)

param(
  [string]$ApiBase = "http://localhost:3001/api/v1",
  [string]$Token = "",
  [string]$UserId = '3634cf2a-8973-491b-9518-bf44af639b4a'
)

function Check-TransactionsCurrency {
  param($currency, $expected)
  Write-Host "Checking /transactions?currency=$currency (expect $expected)"
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  try {
    $resp = Invoke-RestMethod -Uri "$ApiBase/transactions?currency=$currency&limit=100" -Headers $headers -Method Get -ErrorAction Stop
  } catch {
    Write-Host "ERROR: Request failed: $_"; return $false
  }
  $total = $null
  if ($resp.pagination -and $resp.pagination.totalItems) { $total = $resp.pagination.totalItems } else { $total = ($resp.data | Measure-Object).Count }
  $foreign = 0
  foreach ($t in $resp.data) {
    if ($t.account -and $t.account.currency) {
      if ($t.account.currency -ne $currency) { $foreign++ }
    }
  }
  Write-Host "actual=$total, foreign_currency_records=$foreign"
  if ($total -ne $expected -or $foreign -ne 0) { Write-Host "FAIL"; return $false }
  Write-Host "PASS"; return $true
}

$expected = @{ IDR = 4; USD = 4; SGD = 3; EUR = 5 }
$allPass = $true
foreach ($c in $expected.Keys) {
  $ok = Check-TransactionsCurrency -currency $c -expected $expected[$c]
  if (-not $ok) { $allPass = $false }
}
if ($allPass) { Write-Host "ALL PASSED"; exit 0 } else { Write-Host "SOME CHECKS FAILED"; exit 2 }
