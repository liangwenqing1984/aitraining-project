# Clear all Node.js processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Check for remaining processes
$remaining = Get-Process node -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "Found remaining Node processes:"
    $remaining | Format-List
    $remaining | Stop-Process -Force
} else {
    Write-Host "All Node processes cleaned"
}

# Clean npm processes
Get-Process npm -ErrorAction SilentlyContinue | Stop-Process -Force