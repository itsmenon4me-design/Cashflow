$ErrorActionPreference = "Stop"
$API = "http://localhost:3001/api/v1"
$login = Invoke-RestMethod -Uri "$API/auth/login" -Method Post -ContentType "application/json" -Body (@{ email = "e2e.api.user@test.local"; password = "TestPass123!" } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.data.accessToken)" }
$suffix = Get-Random -Maximum 99999

Write-Output "=== SETUP: akun + kategori per currency ==="
$accIdr = (Invoke-RestMethod -Uri "$API/accounts" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "IsoAcc-IDR-$suffix"; account_type = "CASH"; currency = "IDR"; opening_balance_cents = 0 } | ConvertTo-Json)).data
$accUsd = (Invoke-RestMethod -Uri "$API/accounts" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "IsoAcc-USD-$suffix"; account_type = "CASH"; currency = "USD"; opening_balance_cents = 0 } | ConvertTo-Json)).data
$cats = (Invoke-RestMethod -Uri "$API/categories" -Headers $h).data
$food = ($cats | Where-Object { $_.type -eq "EXPENSE" } | Select-Object -First 1)
$bonus = ($cats | Where-Object { $_.type -eq "INCOME" } | Select-Object -First 1)
Write-Output "accounts: IDR=$($accIdr.id.Substring(0,8)) USD=$($accUsd.id.Substring(0,8))"

Write-Output "=== SETUP: transaksi IDR (expense) + USD (income) ==="
$null = Invoke-RestMethod -Uri "$API/transactions" -Method Post -Headers $h -ContentType "application/json" -Body (@{ account_id = $accIdr.id; category_id = $food.id; transaction_type = "EXPENSE"; amount_cents = 150000; transaction_date = "2026-08-25T10:00:00.000Z"; note = "IsoTx-IDR-$suffix" } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/transactions" -Method Post -Headers $h -ContentType "application/json" -Body (@{ account_id = $accUsd.id; category_id = $bonus.id; transaction_type = "INCOME"; amount_cents = 5000; transaction_date = "2026-08-25T10:00:00.000Z"; note = "IsoTx-USD-$suffix" } | ConvertTo-Json)

Write-Output "=== SETUP: budget, goal, investasi per currency ==="
$null = Invoke-RestMethod -Uri "$API/budgets" -Method Post -Headers $h -ContentType "application/json" -Body (@{ category_id = $food.id; currency = "IDR"; budget_amount_cents = 1000000; month = 9; year = 2026 } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/budgets" -Method Post -Headers $h -ContentType "application/json" -Body (@{ category_id = $food.id; currency = "USD"; budget_amount_cents = 10000; month = 9; year = 2026 } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/saving-goals" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "IsoGoal-IDR-$suffix"; target_amount_cents = 1000000; start_date = "2026-08-25"; target_date = "2026-12-25"; currency = "IDR" } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/saving-goals" -Method Post -Headers $h -ContentType "application/json" -Body (@{ name = "IsoGoal-USD-$suffix"; target_amount_cents = 10000; start_date = "2026-08-25"; target_date = "2026-12-25"; currency = "USD" } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/investments" -Method Post -Headers $h -ContentType "application/json" -Body (@{ investment_type = "Stock"; platform = "IsoPlat"; name = "IsoInv-IDR-$suffix"; quantity = 1; average_buy_price = 1000; current_price = 1100; purchase_date = "2026-08-25"; currency = "IDR" } | ConvertTo-Json)
$null = Invoke-RestMethod -Uri "$API/investments" -Method Post -Headers $h -ContentType "application/json" -Body (@{ investment_type = "Stock"; platform = "IsoPlat"; name = "IsoInv-USD-$suffix"; quantity = 1; average_buy_price = 10; current_price = 11; purchase_date = "2026-08-25"; currency = "USD" } | ConvertTo-Json)

Write-Output ""
Write-Output "=== ISOLATION CHECK (IDR vs USD) ==="
function Check($label, $idrList, $usdList, $idrNeedle, $usdNeedle) {
  $idrOk = (($idrList | ConvertTo-Json -Compress) -match $idrNeedle) -and (-not (($idrList | ConvertTo-Json -Compress) -match $usdNeedle))
  $usdOk = (($usdList | ConvertTo-Json -Compress) -match $usdNeedle) -and (-not (($usdList | ConvertTo-Json -Compress) -match $idrNeedle))
  $verdict = if ($idrOk -and $usdOk) { "OK" } else { "MIXED/FAIL" }
  Write-Output ("{0,-14} IDR-view punya IDR & bukan USD: {1} | USD-view punya USD & bukan IDR: {2} => {3}" -f $label, $idrOk, $usdOk, $verdict)
}

$idrAcc = (Invoke-RestMethod -Uri "$API/accounts?currency=IDR" -Headers $h).data | ForEach-Object { $_.name } | Out-String
$usdAcc = (Invoke-RestMethod -Uri "$API/accounts?currency=USD" -Headers $h).data | ForEach-Object { $_.name } | Out-String
Check "Akun" $idrAcc $usdAcc "IsoAcc-IDR" "IsoAcc-USD"

$idrTx = (Invoke-RestMethod -Uri "$API/transactions?currency=IDR&limit=50" -Headers $h).data | ForEach-Object { $_.note } | Out-String
$usdTx = (Invoke-RestMethod -Uri "$API/transactions?currency=USD&limit=50" -Headers $h).data | ForEach-Object { $_.note } | Out-String
Check "Transaksi" $idrTx $usdTx "IsoTx-IDR" "IsoTx-USD"

$idrBud = (Invoke-RestMethod -Uri "$API/budgets?currency=IDR" -Headers $h).data | ForEach-Object { $_.currency } | Out-String
$usdBud = (Invoke-RestMethod -Uri "$API/budgets?currency=USD" -Headers $h).data | ForEach-Object { $_.currency } | Out-String
Check "Anggaran" $idrBud $usdBud "^IDR" "^USD"

$idrGoal = (Invoke-RestMethod -Uri "$API/saving-goals?currency=IDR" -Headers $h).data | ForEach-Object { $_.name } | Out-String
$usdGoal = (Invoke-RestMethod -Uri "$API/saving-goals?currency=USD" -Headers $h).data | ForEach-Object { $_.name } | Out-String
Check "TargetTabungan" $idrGoal $usdGoal "IsoGoal-IDR" "IsoGoal-USD"

$idrInv = (Invoke-RestMethod -Uri "$API/investments?currency=IDR" -Headers $h).data | ForEach-Object { $_.name } | Out-String
$usdInv = (Invoke-RestMethod -Uri "$API/investments?currency=USD" -Headers $h).data | ForEach-Object { $_.name } | Out-String
Check "Investasi" $idrInv $usdInv "IsoInv-IDR" "IsoInv-USD"

$idrSum = Invoke-RestMethod -Uri "$API/dashboard/summary?currency=IDR" -Headers $h
$usdSum = Invoke-RestMethod -Uri "$API/dashboard/summary?currency=USD" -Headers $h
Write-Output ("Dashboard      IDR total_accounts={0} USD total_accounts={1} (masing-masing ledger)" -f $idrSum.data.total_accounts, $usdSum.data.total_accounts)

$idrAn = Invoke-RestMethod -Uri "$API/analytics/summary?startDate=2026-08-01&endDate=2026-08-31&currency=IDR" -Headers $h
$usdAn = Invoke-RestMethod -Uri "$API/analytics/summary?startDate=2026-08-01&endDate=2026-08-31&currency=USD" -Headers $h
Write-Output ("Analitik       IDR income={0} USD income={1}" -f $idrAn.data.total_income_cents, $usdAn.data.total_income_cents)

$idrNotif = (Invoke-RestMethod -Uri "$API/notifications?limit=50&currency=IDR" -Headers $h)
$usdNotif = (Invoke-RestMethod -Uri "$API/notifications?limit=50&currency=USD" -Headers $h)
$n1 = if ($idrNotif.data.items) { $idrNotif.data.items.Count } else { $idrNotif.data.Count }
$n2 = if ($usdNotif.data.items) { $usdNotif.data.items.Count } else { $usdNotif.data.Count }
Write-Output ("Notifikasi     IDR items={0} USD items={1} (ledger terpisah)" -f $n1, $n2)
