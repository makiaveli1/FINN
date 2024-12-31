$possiblePaths = @(
    "${env:LOCALAPPDATA}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "${env:ProgramFiles}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "${env:ProgramFiles(x86)}\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        Write-Host "Found gcloud at: $path"
    }
}

# Also search in Program Files
Get-ChildItem -Path "C:\Program Files" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "gcloud.cmd" } | ForEach-Object {
    Write-Host "Found gcloud at: $($_.FullName)"
}

# Search in Program Files (x86)
Get-ChildItem -Path "C:\Program Files (x86)" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "gcloud.cmd" } | ForEach-Object {
    Write-Host "Found gcloud at: $($_.FullName)"
}

# Search in AppData\Local
Get-ChildItem -Path "$env:LOCALAPPDATA" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq "gcloud.cmd" } | ForEach-Object {
    Write-Host "Found gcloud at: $($_.FullName)"
}
