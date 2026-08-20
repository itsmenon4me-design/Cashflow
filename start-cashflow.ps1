# ============================================================
# CashFlow - Startup Script
# Menyalakan Docker stack (verify) + cek frontend dev server
# ============================================================

$ProjectRoot = "D:\Project 2\CashFlow"
$DockerDir = "$ProjectRoot\docker"

Write-Host ""
Write-Host "=== CashFlow Startup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Cek Docker Desktop sudah jalan
Write-Host "[1/4] Mengecek Docker Desktop..." -ForegroundColor Yellow
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Docker belum jalan. Silakan buka Docker Desktop terlebih dahulu, lalu jalankan script ini lagi." -ForegroundColor Red
        exit 1
    }
    Write-Host "  Docker Desktop aktif." -ForegroundColor Green
} catch {
    Write-Host "  Docker tidak ditemukan. Pastikan Docker Desktop sudah terinstall dan berjalan." -ForegroundColor Red
    exit 1
}

# 2. Cek & nyalakan stack verify (postgres, redis, minio, backend, frontend-verify, nginx)
Write-Host ""
Write-Host "[2/4] Mengecek & menyalakan container Docker (stack verify)..." -ForegroundColor Yellow
Set-Location $DockerDir
docker compose -f docker-compose.yml -f docker-compose.verify.yml --env-file .env.verify up -d
Write-Host "  Selesai." -ForegroundColor Green

# 3. Cek backend (port 3001) benar-benar hidup
Write-Host ""
Write-Host "[3/4] Mengecek backend di port 3001..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$backendCheck = netstat -ano | Select-String ":3001.*LISTENING"
if ($backendCheck) {
    Write-Host "  Backend hidup di port 3001." -ForegroundColor Green
} else {
    Write-Host "  Backend belum terdeteksi listening di 3001. Cek log dengan:" -ForegroundColor Red
    Write-Host "    docker logs cashflowverify_backend --tail 50" -ForegroundColor DarkGray
}

# 4. Cek frontend dev server (port 3000) - ini TIDAK auto-start, harus manual
Write-Host ""
Write-Host "[4/4] Mengecek frontend dev server di port 3000..." -ForegroundColor Yellow
$frontendCheck = netstat -ano | Select-String ":3000.*LISTENING"
if ($frontendCheck) {
    Write-Host "  Frontend dev server sudah jalan di port 3000." -ForegroundColor Green
} else {
    Write-Host "  Frontend dev server BELUM jalan. Ini perlu dinyalakan manual (tidak auto-start)." -ForegroundColor Red
    Write-Host ""
    $answer = Read-Host "  Mau saya nyalakan sekarang di jendela terpisah? (Y/N)"
    if ($answer -eq "Y" -or $answer -eq "y") {
        Write-Host "  Membuka terminal baru untuk frontend dev server..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; npm run dev -w frontend"
        Write-Host "  Terminal baru dibuka. JANGAN ditutup selama kamu kerja." -ForegroundColor Green
    } else {
        Write-Host "  Oke, jalankan manual nanti dengan:" -ForegroundColor DarkGray
        Write-Host "    cd '$ProjectRoot'; npm run dev -w frontend" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== Ringkasan ===" -ForegroundColor Cyan
Write-Host "  Frontend (dev, sehari-hari) : http://localhost:3000"
Write-Host "  Verify stack (via nginx)    : http://localhost:8080"
Write-Host ""
