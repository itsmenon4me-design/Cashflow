$ErrorActionPreference = "Stop"
$API = "http://localhost:3001/api/v1"
$login = Invoke-RestMethod -Uri "$API/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "e2e.api.user@test.local"; password = "TestPass123!" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.data.accessToken)" }
$suffix = Get-Random -Maximum 99999
$CUR = @("IDR", "USD", "SGD", "JPY")

Write-Output "=== SETUP: buat 1 akun + 1 transaksi + 1 goal per currency ($($CUR -join ', ')) ==="
$accIds = @{}
$cats = (Invoke-RestMethod -Uri "$API/categories" -Headers $h).data
$expCat = ($cats | Where-Object { $_.type -eq "EXPENSE" } | Select-Object -First 1)
foreach ($c in $CUR) {
  $acc = (Invoke-RestMethod -Uri "$API/accounts" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "X4-$c-$suffix"; account_type = "CASH"; currency = $c; opening_balance_cents = 0 } | ConvertTo-Json)).data
  $accIds[$c] = $acc.id
  $null = Invoke-RestMethod -Uri "$API/transactions" -Method Post -Headers $h -ContentType "application/json" -Body (@{ account_id = $acc.id; category_id = $expCat.id; transaction_type = "EXPENSE"; amount_cents = 1000; transaction_date = "2026-08-25T10:00:00.000Z"; note = "X4-TX-$c-$suffix" } | ConvertTo-Json)
  $null = Invoke-RestMethod -Uri "$API/saving-goals" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "X4-GOAL-$c-$suffix"; target_amount_cents = 1000; start_date = "2026-08-25"; target_date = "2026-12-25"; currency = $c } | ConvertTo-Json)
  Write-Output "  seeded $c"
}

Write-Output ""
Write-Output "=== CROSS-PAIR ISOLATION MATRIX (akun) ==="
$lists = @{}
foreach ($c in $CUR) {
  $lists[$c] = ((Invoke-RestMethod -Uri "$API/accounts?currency=$c" -Headers $h).data | ForEach-Object { $_.name }) -join "|"
}
$allPass = $true
foreach ($a in $CUR) {
  foreach ($b in $CUR) {
    if ($a -eq $b) { continue }
    $aHasOwn = $lists[$a] -match "X4-$a-"
    $aHasB = $lists[$a] -match "X4-$b-"
    $verdict = if ($aHasOwn -and -not $aHasB) { "OK" } else { $allPass = $false; "FAIL" }
    Write-Output ("  view {0} punya akun {0}: {1} | bocor akun {2}: {3} => {4}" -f $a, $aHasOwn, $b, $aHasB, $verdict)
  }
}
Write-Output ""
Write-Output "=== CROSS-PAIR (transaksi) ==="
$txLists = @{}
foreach ($c in $CUR) {
  $txLists[$c] = ((Invoke-RestMethod -Uri "$API/transactions?currency=$c&limit=100" -Headers $h).data | ForEach-Object { $_.note }) -join "|"
}
foreach ($a in $CUR) {
  foreach ($b in $CUR) {
    if ($a -eq $b) { continue }
    $aHasOwn = $txLists[$a] -match "X4-TX-$a-"
    $aHasB = $txLists[$a] -match "X4-TX-$b-"
    $verdict = if ($aHasOwn -and -not $aHasB) { "OK" } else { $allPass = $false; "FAIL" }
    Write-Output ("  view {0} punya tx {0}: {1} | bocor tx {2}: {3} => {4}" -f $a, $aHasOwn, $b, $aHasB, $verdict)
  }
}
Write-Output ""
Write-Output "=== CROSS-PAIR (saving goals) ==="
$gLists = @{}
foreach ($c in $CUR) {
  $gLists[$c] = ((Invoke-RestMethod -Uri "$API/saving-goals?currency=$c" -Headers $h).data | ForEach-Object { $_.name }) -join "|"
}
foreach ($a in $CUR) {
  foreach ($b in $CUR) {
    if ($a -eq $b) { continue }
    $aHasOwn = $gLists[$a] -match "X4-GOAL-$a-"
    $aHasB = $gLists[$a] -match "X4-GOAL-$b-"
    $verdict = if ($aHasOwn -and -not $aHasB) { "OK" } else { $allPass = $false; "FAIL" }
    Write-Output ("  view {0} punya goal {0}: {1} | bocor goal {2}: {3} => {4}" -f $a, $aHasOwn, $b, $aHasB, $verdict)
  }
}
Write-Output ""
if ($allPass) { Write-Output "SEMUA PASANGAN ISOLASI OK" } else { Write-Output "ADA KEGAGALAN" }
