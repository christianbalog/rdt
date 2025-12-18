# Script PowerShell pour tester le backend avec différents payloads
# Usage: .\test-backend-payloads.ps1 [motion|button|pressure|all]

param(
    [string]$TestType = "all"
)

$BackendUrl = "http://localhost:8000/api/events"

function Send-Payload {
    param(
        [string]$Name,
        [string]$Json
    )

    Write-Host "`n┌─────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host "│ 🧪 Test: $Name" -ForegroundColor Cyan
    Write-Host "├─────────────────────────────────────────────────" -ForegroundColor Cyan

    try {
        $response = Invoke-RestMethod -Uri $BackendUrl `
            -Method Post `
            -ContentType "application/json" `
            -Body $Json `
            -ErrorAction Stop

        Write-Host "│ ✅ Succès!" -ForegroundColor Green
        Write-Host "│ Réponse:" -ForegroundColor Green
        Write-Host "│   $($response | ConvertTo-Json -Compress)" -ForegroundColor White
        Write-Host "└─────────────────────────────────────────────────`n" -ForegroundColor Cyan
    }
    catch {
        Write-Host "│ ❌ Erreur!" -ForegroundColor Red
        Write-Host "│   $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "└─────────────────────────────────────────────────`n" -ForegroundColor Cyan
    }
}

# Test 1: Détection de mouvement (PIR)
$MotionPayload = @{
    type = "motion_detected"
    device_id = "raspberry-1"
    details = @{
        event_id = "evt-test-$(Get-Date -Format 'yyyyMMddHHmmss')-motion"
        source = "PIR"
        data = @{
            gpio_pin = 17
            state = "HIGH"
        }
        original_timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")
        mqtt_topic = "sensor/motion"
    }
} | ConvertTo-Json -Depth 10

# Test 2: Bouton pressé
$ButtonPayload = @{
    type = "button_pressed"
    device_id = "raspberry-1"
    details = @{
        event_id = "evt-test-$(Get-Date -Format 'yyyyMMddHHmmss')-button"
        source = "Button"
        data = @{
            gpio_pin = 23
            state = "PRESSED"
        }
        original_timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")
        mqtt_topic = "sensor/button"
    }
} | ConvertTo-Json -Depth 10

# Test 3: Tapis pressé
$PressurePayload = @{
    type = "button_pressed"
    device_id = "raspberry-1"
    details = @{
        event_id = "evt-test-$(Get-Date -Format 'yyyyMMddHHmmss')-pressure"
        source = "Pressure"
        data = @{
            gpio_pin = 24
            state = "PRESSED"
        }
        original_timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.ffffffZ")
        mqtt_topic = "sensor/pressure"
    }
} | ConvertTo-Json -Depth 10

# Test 4: Payload minimal (cas d'erreur potentiel)
$MinimalPayload = @{
    type = "motion_detected"
    device_id = "raspberry-2"
    details = @{
        event_id = "evt-minimal"
        source = "Test"
    }
} | ConvertTo-Json -Depth 10

# Test 5: Payload invalide (champ manquant)
$InvalidPayload = @{
    device_id = "raspberry-1"
    details = @{
        event_id = "evt-invalid"
    }
} | ConvertTo-Json -Depth 10

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  🧪 Test des Payloads Backend" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "Backend: $BackendUrl" -ForegroundColor White
Write-Host ""

# Vérifier que le backend est accessible
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -ErrorAction Stop
    Write-Host "✅ Backend accessible (status: $($health.status))" -ForegroundColor Green
}
catch {
    Write-Host "❌ Backend non accessible!" -ForegroundColor Red
    Write-Host "   Assurez-vous que le backend est démarré avec: cd backend && npm start" -ForegroundColor Yellow
    exit 1
}

# Exécuter les tests selon le paramètre
switch ($TestType.ToLower()) {
    "motion" {
        Send-Payload "Détection de mouvement (PIR)" $MotionPayload
    }
    "button" {
        Send-Payload "Bouton pressé" $ButtonPayload
    }
    "pressure" {
        Send-Payload "Tapis pressé (Pressure)" $PressurePayload
    }
    "all" {
        Send-Payload "1️⃣ Détection de mouvement (PIR)" $MotionPayload
        Start-Sleep -Seconds 1

        Send-Payload "2️⃣ Bouton pressé" $ButtonPayload
        Start-Sleep -Seconds 1

        Send-Payload "3️⃣ Tapis pressé (Pressure)" $PressurePayload
        Start-Sleep -Seconds 1

        Send-Payload "4️⃣ Payload minimal" $MinimalPayload
        Start-Sleep -Seconds 1

        Send-Payload "5️⃣ Payload invalide (doit échouer)" $InvalidPayload
    }
    default {
        Write-Host "Usage: .\test-backend-payloads.ps1 [motion|button|pressure|all]" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  ✅ Tests terminés!" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Pour voir les événements reçus:" -ForegroundColor Cyan
Write-Host "   curl http://localhost:8000/api/events" -ForegroundColor White
Write-Host ""
Write-Host "💡 Pour voir les logs du backend:" -ForegroundColor Cyan
Write-Host "   Consultez la console ou le backend s'execute" -ForegroundColor White
Write-Host ""
