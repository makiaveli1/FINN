# Download Google Cloud SDK installer
$installerUrl = "https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe"
$installerPath = "$env:TEMP\GoogleCloudSDKInstaller.exe"

Write-Host "Downloading Google Cloud SDK installer..."
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

Write-Host "Running installer..."
Start-Process -FilePath $installerPath -Wait

Write-Host "Installation complete! Please restart your terminal and run:"
Write-Host "gcloud init"
Write-Host "gcloud config set project impactful-arbor-399011"
