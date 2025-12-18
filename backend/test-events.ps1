# Script de test PowerShell pour envoyer des evenements au backend
# Simule les envois depuis les Raspberry Pi

$BACKEND_URL = "http://localhost:8000"

Write-Host "Test des evenements backend" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Test 1: Mouvement detecte
Write-Host ""
Write-Host "Test 1: Envoi evenement motion_detected..." -ForegroundColor Yellow
$body1 = @{
    type = "motion_detected"
    device_id = "raspberry-01"
    details = @{
        confidence = 0.95
        location = "entrance"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "$BACKEND_URL/api/events" -Method Post -Body $body1 -ContentType "application/json" | ConvertTo-Json

Start-Sleep -Seconds 2

# Test 2: Pression sur tapis
Write-Host ""
Write-Host "Test 2: Envoi evenement button_pressed..." -ForegroundColor Yellow
$body2 = @{
    type = "button_pressed"
    device_id = "raspberry-02"
    details = @{
        pressure = "high"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "$BACKEND_URL/api/events" -Method Post -Body $body2 -ContentType "application/json" | ConvertTo-Json

Start-Sleep -Seconds 2

# Test 3: Recuperer les evenements
Write-Host ""
Write-Host "Test 3: Recuperation des evenements recents..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BACKEND_URL/api/events?limit=5" | ConvertTo-Json

Write-Host ""
Write-Host "Tests termines!" -ForegroundColor Green
