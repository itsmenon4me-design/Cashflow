$api = 'http://localhost:3101/api/v1'

# Login
$loginBody = @{
  email = 'e2e.api.user@test.local'
  password = 'TestPass123!'
} | ConvertTo-Json

try {
  $login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body $loginBody -ContentType 'application/json' -ErrorAction Stop
} catch {
  Write-Host "Login failed:" $_.Exception.Response.Content.ReadAsStringAsync().Result
  exit 2
}
$token = $login.data.accessToken
Write-Host "Login succeeded; token length=" $token.Length
$headers = @{ Authorization = "Bearer $token" }

$expected = @{ 'IDR' = 4; 'USD' = 4; 'SGD' = 3; 'EUR' = 5 }

foreach ($c in $expected.Keys) {
  $uri = $api + '/transactions?currency=' + $c + '&limit=100'
  try {
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get -ErrorAction Stop
    $total = $null
    if ($resp.pagination -and $resp.pagination.totalItems) { $total = $resp.pagination.totalItems } elseif ($resp.data) { $total = ($resp.data | Measure-Object).Count }
    $foreign = 0
    if ($resp.data) {
      foreach ($t in $resp.data) {
        if ($t.account -and $t.account.currency -and $t.account.currency -ne $c) { $foreign++ }
      }
    }
    Write-Host "$c - expected=$($expected[$c]) actual=$total foreign=$foreign"
  } catch {
    Write-Host ("Error for " + $c + ":")
    try { Write-Host ($_.Exception.Response.Content.ReadAsStringAsync().Result) } catch { Write-Host $_.Exception.Message }
  }
}
