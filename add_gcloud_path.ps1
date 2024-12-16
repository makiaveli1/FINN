# Get the current user's PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Add Google Cloud SDK paths
$gcloudPaths = @(
    "${env:LOCALAPPDATA}\Google\Cloud SDK\google-cloud-sdk\bin",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin",
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
)

foreach ($path in $gcloudPaths) {
    if (Test-Path $path) {
        if ($userPath -notlike "*$path*") {
            $userPath = "$userPath;$path"
            [Environment]::SetEnvironmentVariable("Path", $userPath, "User")
            Write-Host "Added $path to PATH"
            
            # Also add to current session
            $env:Path = "$env:Path;$path"
        }
    }
}

Write-Host "PATH update complete. Please restart your terminal and try 'gcloud init' again."
