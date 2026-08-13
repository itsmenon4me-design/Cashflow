# PowerShell QA script for GLOBAL SAVE REGRESSION
# Interactive credentials, uses local backend at http://localhost:3001/api/v1
# Do not modify source code or DB. Script only for testing.

$ErrorActionPreference = 'Stop'

$baseUrl = 'http://localhost:3001/api/v1'

function Read-Creds {
    $email = Read-Host "Email"
    $securePwd = Read-Host "Password" -AsSecureString
    # convert to plain for request, then zero-out secure buffer
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
    try {
        $pwd = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    return @{ email = $email; password = $pwd }
}

function Send-ApiRequest {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )

    $uri = "$baseUrl$Path"
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }

    try {
        if ($null -eq $Body) {
            $resp = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -UseBasicParsing -ErrorAction Stop
        } else {
            $json = $Body | ConvertTo-Json -Depth 10
            $resp = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $json -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop
        }
        $status = $resp.StatusCode.value__
        $content = $null
        if ($resp.Content) {
            try { $content = $resp.Content | ConvertFrom-Json } catch { $content = $resp.Content }
        }
        return @{ ok = $true; status = $status; content = $content; raw = $resp.Content }
    } catch {
        $ex = $_.Exception
        if ($ex.Response -ne $null) {
            $r = $ex.Response
            $status = $r.StatusCode.value__
            $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
            $text = $sr.ReadToEnd()
            $parsed = $null
            try { $parsed = $text | ConvertFrom-Json } catch { $parsed = $text }
            return @{ ok = $false; status = $status; error = $parsed; raw = $text }
        } else {
            return @{ ok = $false; status = $null; error = $ex.Message }
        }
    }
}

# Helper to print result line
function Mark-Result([string]$name, [bool]$pass, [string]$msg = '') {
    $status = if ($pass) { 'PASS' } else { 'FAIL' }
    Write-Host "${name,-18} ${status} ${msg}"
}

# MAIN
$creds = Read-Creds
$email = $creds.email
$password = $creds.password

if ([string]::IsNullOrWhiteSpace($email) -or [string]::IsNullOrWhiteSpace($password)) {
    Write-Host "Email or password empty. Exiting."
    exit 1
}

Write-Host "Logging in..."
$loginPayload = @{ email = $email; password = $password }
$loginRes = Send-ApiRequest -Method 'POST' -Path '/auth/login' -Body $loginPayload

$summary = @{
    LOGIN = $false
    ACCOUNT_CREATE = $false
    CATEGORY_CREATE = $false
    BUDGET_CREATE = $false
    GOAL_CREATE = $false
    TX_CREATE = $false
    TX_UPDATE = $false
    TX_DELETE = $false
    BALANCE = $false
    DUPLICATE = $false
    AUTHORIZATION = $true
    CLEANUP = $false
}

if (-not $loginRes.ok) {
    Write-Host "Login failed. Status: $($loginRes.status)"
    Write-Host "Response: $($loginRes.error)"
    Write-Host "GLOBAL SAVE REGRESSION - PARTIAL"
    exit 1
}

# Extract accessToken
$token = $null
if ($loginRes.content -ne $null) {
    if ($loginRes.content.data -ne $null) {
        if ($loginRes.content.data.accessToken) { $token = $loginRes.content.data.accessToken }
        elseif ($loginRes.content.data.access_token) { $token = $loginRes.content.data.access_token }
    }
    if (-not $token) {
        # Some responses include data as top-level
        if ($loginRes.content.accessToken) { $token = $loginRes.content.accessToken }
    }
}
if (-not $token) {
    Write-Host "Login response did not include accessToken. Response:"
    Write-Host ($loginRes.content | ConvertTo-Json -Depth 5)
    Write-Host "GLOBAL SAVE REGRESSION - PARTIAL"
    exit 1
}

$summary.LOGIN = $true
Write-Host "Login: PASS"

# Helper to safe-get array content (body.data or body.data)
function Get-DataArray($resp) {
    if ($null -eq $resp) { return @() }
    if ($resp.content -ne $null) {
        if ($resp.content.data -ne $null) { return $resp.content.data }
        return $resp.content
    }
    return @()
}

# GET baseline lists
Write-Host "Fetching baseline lists..."
$accountsRes = Send-ApiRequest -Method 'GET' -Path '/accounts' -Token $token
$categoriesRes = Send-ApiRequest -Method 'GET' -Path '/categories' -Token $token
$budgetsRes = Send-ApiRequest -Method 'GET' -Path '/budgets' -Token $token
$savingRes = Send-ApiRequest -Method 'GET' -Path '/saving-goals' -Token $token
$txRes = Send-ApiRequest -Method 'GET' -Path '/transactions' -Token $token

$accountsList = Get-DataArray $accountsRes
$categoriesList = Get-DataArray $categoriesRes
$budgetsList = Get-DataArray $budgetsRes
$savingList = Get-DataArray $savingRes
$txList = Get-DataArray $txRes

$ts = (Get-Date).ToString('yyyyMMddHHmmss')

# 3. CREATE ACCOUNT
$qaAccountName = "QA Save Test Account $ts"
$accountPayload = @{ name = $qaAccountName; account_type = 'BANK'; currency = 'IDR'; opening_balance_cents = 100000 }
Write-Host "Creating account: $qaAccountName"
$accCreate = Send-ApiRequest -Method 'POST' -Path '/accounts' -Body $accountPayload -Token $token
if ($accCreate.ok -and $accCreate.content -and $accCreate.content.data) {
    $qaAccountId = $accCreate.content.data.id
    # verify by listing
    $verifyAcc = Send-ApiRequest -Method 'GET' -Path '/accounts' -Token $token
    $found = $false
    foreach ($a in Get-DataArray $verifyAcc) { if ($a.name -eq $qaAccountName) { $found = $true; break } }
    $summary.ACCOUNT_CREATE = $accCreate.ok -and $found
    Mark-Result 'ACCOUNT CREATE' $summary.ACCOUNT_CREATE "Status:$($accCreate.status)"
} else {
    Mark-Result 'ACCOUNT CREATE' $false "Status:$($accCreate.status) Error:$($accCreate.error)"
}

# 4. CREATE CATEGORY
$qaCategoryName = "QA Save Test Category $ts"
$categoryPayload = @{ name = $qaCategoryName; type = 'EXPENSE' }
Write-Host "Creating category: $qaCategoryName"
$catCreate = Send-ApiRequest -Method 'POST' -Path '/categories' -Body $categoryPayload -Token $token
if ($catCreate.ok -and $catCreate.content -and $catCreate.content.data) {
    $qaCategoryId = $catCreate.content.data.id
    $verifyCat = Send-ApiRequest -Method 'GET' -Path '/categories' -Token $token
    $found = $false
    foreach ($c in Get-DataArray $verifyCat) { if ($c.name -eq $qaCategoryName) { $found = $true; break } }
    $summary.CATEGORY_CREATE = $catCreate.ok -and $found
    Mark-Result 'CATEGORY CREATE' $summary.CATEGORY_CREATE "Status:$($catCreate.status)"
} else {
    Mark-Result 'CATEGORY CREATE' $false "Status:$($catCreate.status) Error:$($catCreate.error)"
}

# 5. CREATE BUDGET
$month = (Get-Date).Month
$year = (Get-Date).Year
$budgetPayload = @{ category_id = $qaCategoryId; budget_amount_cents = 1500000; month = $month; year = $year }
Write-Host "Creating budget for category id $qaCategoryId"
$budgetCreate = Send-ApiRequest -Method 'POST' -Path '/budgets' -Body $budgetPayload -Token $token
if ($budgetCreate.ok -and $budgetCreate.content -and $budgetCreate.content.data) {
    $qaBudgetId = $budgetCreate.content.data.id
    $verifyBudget = Send-ApiRequest -Method 'GET' -Path '/budgets' -Token $token
    $found = $false
    foreach ($b in Get-DataArray $verifyBudget) { if ($b.id -eq $qaBudgetId) { $found = $true; break } }
    $summary.BUDGET_CREATE = $budgetCreate.ok -and $found
    Mark-Result 'BUDGET CREATE' $summary.BUDGET_CREATE "Status:$($budgetCreate.status)"
} else {
    Mark-Result 'BUDGET CREATE' $false "Status:$($budgetCreate.status) Error:$($budgetCreate.error)"
}

# 6. CREATE SAVING GOAL
$qaGoalName = "QA Save Test Goal $ts"
$today = (Get-Date).ToString('yyyy-MM-dd')
$targetDate = (Get-Date).AddMonths(1).ToString('yyyy-MM-dd')
$goalPayload = @{ name = $qaGoalName; target_amount_cents = 1000000; start_date = $today; target_date = $targetDate }
Write-Host "Creating saving goal: $qaGoalName"
$goalCreate = Send-ApiRequest -Method 'POST' -Path '/saving-goals' -Body $goalPayload -Token $token
if ($goalCreate.ok -and $goalCreate.content -and $goalCreate.content.data) {
    $qaGoalId = $goalCreate.content.data.id
    $verifyGoal = Send-ApiRequest -Method 'GET' -Path '/saving-goals' -Token $token
    $found = $false
    foreach ($g in Get-DataArray $verifyGoal) { if ($g.name -eq $qaGoalName) { $found = $true; break } }
    $summary.GOAL_CREATE = $goalCreate.ok -and $found
    Mark-Result 'GOAL CREATE' $summary.GOAL_CREATE "Status:$($goalCreate.status)"
} else {
    Mark-Result 'GOAL CREATE' $false "Status:$($goalCreate.status) Error:$($goalCreate.error)"
}

# 7. CREATE TRANSACTION
# Use the QA account and QA category
if (-not $qaAccountId) { Write-Host "No QA account created; cannot create transaction" }

# get account balance before
$accBefore = $null
if ($qaAccountId) {
    $accGet = Send-ApiRequest -Method 'GET' -Path ("/accounts/$qaAccountId") -Token $token
    if ($accGet.ok -and $accGet.content -and $accGet.content.data) { $accBefore = $accGet.content.data }
}

$txPayload = @{ account_id = $qaAccountId; category_id = $qaCategoryId; transaction_type = 'EXPENSE'; amount_cents = 50000; transaction_date = $today; note = "QA test transaction $ts" }
Write-Host "Creating transaction..."
$txCreate = Send-ApiRequest -Method 'POST' -Path '/transactions' -Body $txPayload -Token $token
if ($txCreate.ok -and $txCreate.content -and $txCreate.content.data) {
    $qaTxId = $txCreate.content.data.id
    # verify via GET /transactions (search by id)
    $verifyTx = Send-ApiRequest -Method 'GET' -Path ("/transactions?limit=50") -Token $token
    $found = $false
    foreach ($t in Get-DataArray $verifyTx) { if ($t.id -eq $qaTxId) { $found = $true; break } }
    # check balance changed
    $accAfter = $null
    if ($qaAccountId) {
        $accGet2 = Send-ApiRequest -Method 'GET' -Path ("/accounts/$qaAccountId") -Token $token
        if ($accGet2.ok -and $accGet2.content -and $accGet2.content.data) { $accAfter = $accGet2.content.data }
    }
    $balancePass = $false
    if ($accBefore -and $accAfter) {
        $before = [int]$accBefore.current_balance_cents
        $after = [int]$accAfter.current_balance_cents
        # expense reduces balance by amount_cents
        if ($before - $after -eq $txPayload.amount_cents) { $balancePass = $true }
    }
    $summary.TX_CREATE = $txCreate.ok -and $found
    $summary.BALANCE = $balancePass
    Mark-Result 'TX CREATE' $summary.TX_CREATE "Status:$($txCreate.status)"
    Mark-Result 'BALANCE' $summary.BALANCE
} else {
    Mark-Result 'TX CREATE' $false "Status:$($txCreate.status) Error:$($txCreate.error)"
}

# 8. UPDATE TRANSACTION
if ($qaTxId) {
    $newAmount = 70000
    $updatePayload = @{ amount_cents = $newAmount }
    Write-Host "Updating transaction $qaTxId -> amount $newAmount"
    $txUpdate = Send-ApiRequest -Method 'PATCH' -Path ("/transactions/$qaTxId") -Body $updatePayload -Token $token
    if ($txUpdate.ok -and $txUpdate.content -and $txUpdate.content.data) {
        $updated = $txUpdate.content.data
        $summary.TX_UPDATE = ([int]$updated.amount_cents -eq $newAmount) -or ([string]([int]$updated.amount_cents) -eq [string]$newAmount)
        Mark-Result 'TX UPDATE' $summary.TX_UPDATE "Status:$($txUpdate.status)"
    } else {
        Mark-Result 'TX UPDATE' $false "Status:$($txUpdate.status) Error:$($txUpdate.error)"
    }
} else { Write-Host "No QA transaction id to update" }

# 9. DELETE TRANSACTION
if ($qaTxId) {
    Write-Host "Deleting transaction $qaTxId"
    $txDelete = Send-ApiRequest -Method 'DELETE' -Path ("/transactions/$qaTxId") -Token $token
    if ($txDelete.ok) {
        # verify it no longer appears in list
        $verifyTx2 = Send-ApiRequest -Method 'GET' -Path "/transactions?limit=50" -Token $token
        $found = $false
        foreach ($t in Get-DataArray $verifyTx2) { if ($t.id -eq $qaTxId) { $found = $true; break } }
        $summary.TX_DELETE = -not $found
        Mark-Result 'TX DELETE' $summary.TX_DELETE "Status:$($txDelete.status)"
    } else {
        Mark-Result 'TX DELETE' $false "Status:$($txDelete.status) Error:$($txDelete.error)"
    }
} else { Write-Host "No QA transaction id to delete" }

# 10. AUTHORIZATION check summary is implicit: if any mutation returned 401, we should catch it in responses
# We'll scan recorded responses for status 401
$authFail = $false
$checkResponses = @($accCreate, $catCreate, $budgetCreate, $goalCreate, $txCreate, $txUpdate, $txDelete)
foreach ($r in $checkResponses) {
    if ($r -and -not $r.ok -and $r.status -eq 401) { $authFail = $true }
}
if ($authFail) { $summary.AUTHORIZATION = $false }

# 11. CLEANUP
$cleanupOk = $true
try {
    if ($qaTxId) {
        # ensure deleted already
        # nothing
    }
    if ($qaBudgetId) {
        $del = Send-ApiRequest -Method 'DELETE' -Path ("/budgets/$qaBudgetId") -Token $token
        if (-not $del.ok) { $cleanupOk = $false }
    }
    if ($qaGoalId) {
        $del = Send-ApiRequest -Method 'DELETE' -Path ("/saving-goals/$qaGoalId") -Token $token
        if (-not $del.ok) { $cleanupOk = $false }
    }
    if ($qaCategoryId) {
        $del = Send-ApiRequest -Method 'DELETE' -Path ("/categories/$qaCategoryId") -Token $token
        if (-not $del.ok) { $cleanupOk = $false }
    }
    if ($qaAccountId) {
        $del = Send-ApiRequest -Method 'DELETE' -Path ("/accounts/$qaAccountId") -Token $token
        if (-not $del.ok) { $cleanupOk = $false }
    }
} catch {
    $cleanupOk = $false
}
$summary.CLEANUP = $cleanupOk
Mark-Result 'CLEANUP' $summary.CLEANUP

# 12. FINAL OUTPUT
Write-Host "`nGLOBAL SAVE REGRESSION"
Write-Host "======================"
Mark-Result 'LOGIN' $summary.LOGIN
Mark-Result 'ACCOUNT CREATE' $summary.ACCOUNT_CREATE
Mark-Result 'CATEGORY CREATE' $summary.CATEGORY_CREATE
Mark-Result 'BUDGET CREATE' $summary.BUDGET_CREATE
Mark-Result 'GOAL CREATE' $summary.GOAL_CREATE
Mark-Result 'TX CREATE' $summary.TX_CREATE
Mark-Result 'TX UPDATE' $summary.TX_UPDATE
Mark-Result 'TX DELETE' $summary.TX_DELETE
Mark-Result 'BALANCE' $summary.BALANCE
Mark-Result 'AUTHORIZATION' $summary.AUTHORIZATION
Mark-Result 'CLEANUP' $summary.CLEANUP

$allPass = $summary.LOGIN -and $summary.ACCOUNT_CREATE -and $summary.CATEGORY_CREATE -and $summary.BUDGET_CREATE -and $summary.GOAL_CREATE -and $summary.TX_CREATE -and $summary.TX_UPDATE -and $summary.TX_DELETE -and $summary.BALANCE -and $summary.AUTHORIZATION

if ($allPass) {
    Write-Host "`nFINAL: GLOBAL SAVE REGRESSION — PASS"
} else {
    Write-Host "`nFINAL: GLOBAL SAVE REGRESSION — PARTIAL"
    Write-Host "Please review the failed steps above."
}

# Zero out plain password variable
$password = $null
