# test-flow.ps1 - Complete UyirKappan End-to-End Test
Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  UyirKappan End-to-End Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login as Bystander
Write-Host "1. Logging in as Bystander..." -ForegroundColor Yellow
try {
    $login = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"email":"bystander@uyirkappan.demo","password":"password123"}'
    $token = $login.token
    Write-Host "   [OK] Bystander logged in" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Make sure the server is running on http://localhost:4000" -ForegroundColor Red
    exit
}

# Step 2: Create Emergency
Write-Host ""
Write-Host "2. Creating emergency request..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    emergencyType = "CARDIAC"
    victimCount = 1
    pickupLocation = @{
        latitude = 13.0827
        longitude = 80.2707
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/emergency" -Headers $headers -Body $body
    $requestId = $response.requestId
    $assignmentId = $response.assignmentId
    Write-Host "   [OK] Emergency created: $requestId" -ForegroundColor Green
    Write-Host "   Assignment: $assignmentId" -ForegroundColor Gray
    Write-Host "   Ambulance: $($response.ambulanceId)" -ForegroundColor Gray
    Write-Host "   ETA: $($response.eta) minutes" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Failed to create emergency: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 3: Login as Driver 1
Write-Host ""
Write-Host "3. Logging in as Driver 1..." -ForegroundColor Yellow
try {
    $driver1 = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"email":"driver1@uyirkappan.demo","password":"password123"}'
    $driver1Token = $driver1.token
    Write-Host "   [OK] Driver 1 logged in" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Driver 1 login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 4: Driver 1 rejects (triggers fallback)
Write-Host ""
Write-Host "4. Driver 1 rejecting assignment (triggering fallback)..." -ForegroundColor Yellow
$headers1 = @{
    "Authorization" = "Bearer $driver1Token"
}
try {
    $reject = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/assignments/$assignmentId/reject" -Headers $headers1
    Write-Host "   [OK] Driver 1 rejected - Fallback triggered!" -ForegroundColor Green
    Write-Host "   $($reject.message)" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Reject failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 5: Wait for fallback
Write-Host ""
Write-Host "5. Waiting for fallback to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Write-Host "   [OK] Done" -ForegroundColor Green

# Step 6: Login as Driver 2
Write-Host ""
Write-Host "6. Logging in as Driver 2..." -ForegroundColor Yellow
try {
    $driver2 = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"email":"driver2@uyirkappan.demo","password":"password123"}'
    $driver2Token = $driver2.token
    Write-Host "   [OK] Driver 2 logged in" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Driver 2 login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 7: Get Driver 2's assignment
Write-Host ""
Write-Host "7. Getting Driver 2's assignment..." -ForegroundColor Yellow
$headers2 = @{
    "Authorization" = "Bearer $driver2Token"
    "Content-Type" = "application/json"
}
try {
    $assignment2 = Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/driver/assignment" -Headers $headers2
    if ($assignment2.assignment) {
        $newAssignmentId = $assignment2.assignment.id
        Write-Host "   [OK] Driver 2 received assignment: $newAssignmentId" -ForegroundColor Green
        Write-Host "   Attempt: $($assignment2.assignment.attemptNumber)" -ForegroundColor Gray
        Write-Host "   Ambulance: $($assignment2.assignment.ambulanceId)" -ForegroundColor Gray
        Write-Host "   ETA: $($assignment2.assignment.estimatedETA) minutes" -ForegroundColor Gray
    } else {
        Write-Host "   [FAIL] No assignment found for Driver 2" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "   [FAIL] Failed to get assignment: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 8: Driver 2 accepts
Write-Host ""
Write-Host "8. Driver 2 accepting assignment..." -ForegroundColor Yellow
try {
    $accept = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/assignments/$newAssignmentId/accept" -Headers $headers2
    Write-Host "   [OK] Driver 2 accepted! ETA: $($accept.eta) minutes" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Accept failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Step 9: Status updates
Write-Host ""
Write-Host "9. Updating status through lifecycle..." -ForegroundColor Yellow
$statuses = @(
    "EN_ROUTE_TO_PATIENT",
    "ARRIVED_AT_PATIENT",
    "PATIENT_ONBOARD",
    "EN_ROUTE_TO_HOSPITAL",
    "ARRIVED_AT_HOSPITAL"
)
$counter = 1
$allPassed = $true
foreach ($s in $statuses) {
    # ✅ FIX: Use string body instead of ConvertTo-Json
    $statusBody = "{ `"status`": `"$s`" }"
    Write-Host "   Sending status: $s" -ForegroundColor Gray
    Write-Host "   Body: $statusBody" -ForegroundColor DarkGray
    try {
        $status = Invoke-RestMethod -Method Patch -Uri "http://localhost:4000/api/assignments/$newAssignmentId/status" -Headers $headers2 -Body $statusBody
        Write-Host "   $counter. [OK] Status: $s" -ForegroundColor Green
        $counter++
        Start-Sleep -Milliseconds 500
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host "   $counter. [FAIL] Failed to update status: $s" -ForegroundColor Red
        Write-Host "        Error: $errorMsg" -ForegroundColor DarkRed
        $allPassed = $false
        $counter++
    }
}

# Step 10: Location update
Write-Host ""
Write-Host "10. Sending location update..." -ForegroundColor Yellow
$locationBody = @{
    latitude = 13.06
    longitude = 80.25
    speed = 30
    heading = 90
} | ConvertTo-Json
try {
    $location = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/ambulances/AMB-02/location" -Headers $headers2 -Body $locationBody
    Write-Host "   [OK] Location sent! ETA: $($location.eta) minutes" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Location update failed: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# Step 11: Check final status
Write-Host ""
Write-Host "11. Checking final status..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 1
    $final = Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/emergency/$requestId" -Headers $headers
    Write-Host "   [OK] Final Status: $($final.request.status)" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Attempt History:" -ForegroundColor Cyan
    $final.request.attempts | ForEach-Object {
        Write-Host "      Attempt $($_.attemptNumber): $($_.ambulanceId) -> $($_.response)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [FAIL] Failed to get final status: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# Step 12: Check ambulance availability
Write-Host ""
Write-Host "12. Checking ambulance availability..." -ForegroundColor Yellow
try {
    $ambulance = Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/ambulances/AMB-02" -Headers $headers2
    Write-Host "   [OK] AMB-02 status: $($ambulance.ambulance.status)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Failed to check ambulance: $($_.Exception.Message)" -ForegroundColor Red
    $allPassed = $false
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  TEST PASSED!" -ForegroundColor Green
} else {
    Write-Host "  TEST COMPLETED WITH ERRORS" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "   Request ID: $requestId" -ForegroundColor Gray
Write-Host "   Status: $($final.request.status)" -ForegroundColor Gray
Write-Host "   Attempts: $($final.request.attempts.Count)" -ForegroundColor Gray
Write-Host "   Ambulance AMB-02: $($ambulance.ambulance.status)" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Complete! Check the results above." -ForegroundColor Cyan