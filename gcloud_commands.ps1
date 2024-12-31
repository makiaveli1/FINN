# Set the path to gcloud
$GCLOUD = "C:\Users\likwi\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"

# Authentication and setup
function Initialize-GCloud {
    & $GCLOUD init
}

function Connect-GCloud {
    & $GCLOUD auth login
}

function Set-GCloudProject {
    param([string]$ProjectId)
    & $GCLOUD config set project $ProjectId
}

# App Engine commands
function Deploy-AppEngine {
    param([string]$AppYamlPath = "app.yaml")
    & $GCLOUD app deploy $AppYamlPath
}

function Start-AppEngineLocal {
    & $GCLOUD app run
}

function Get-AppEngineServices {
    & $GCLOUD app services list
}

# Cloud Run commands
function Deploy-CloudRun {
    param(
        [string]$ServiceName,
        [string]$Image,
        [string]$Region = "us-central1"
    )
    & $GCLOUD run deploy $ServiceName --image $Image --region $Region --platform managed
}

function Get-CloudRunServices {
    param([string]$Region = "us-central1")
    & $GCLOUD run services list --region $Region
}

# Cloud Storage commands
function Create-StorageBucket {
    param([string]$BucketName)
    & $GCLOUD storage buckets create gs://$BucketName
}

function Copy-ToStorage {
    param(
        [string]$Source,
        [string]$Bucket
    )
    & $GCLOUD storage cp $Source gs://$Bucket
}

function Get-StorageBuckets {
    & $GCLOUD storage buckets list
}

# Cloud Functions commands
function Deploy-Function {
    param(
        [string]$FunctionName,
        [string]$Runtime = "python39",
        [string]$Trigger = "http"
    )
    & $GCLOUD functions deploy $FunctionName --runtime $Runtime --trigger-$Trigger
}

function Get-Functions {
    & $GCLOUD functions list
}

# IAM commands
function Get-IAMServiceAccounts {
    & $GCLOUD iam service-accounts list
}

function Create-IAMServiceAccount {
    param(
        [string]$Name,
        [string]$DisplayName
    )
    & $GCLOUD iam service-accounts create $Name --display-name $DisplayName
}

# Compute Engine commands
function Get-ComputeInstances {
    & $GCLOUD compute instances list
}

function Start-ComputeInstance {
    param([string]$InstanceName)
    & $GCLOUD compute instances start $InstanceName
}

function Stop-ComputeInstance {
    param([string]$InstanceName)
    & $GCLOUD compute instances stop $InstanceName
}

# Kubernetes Engine commands
function Get-GKEClusters {
    & $GCLOUD container clusters list
}

function Create-GKECluster {
    param(
        [string]$ClusterName,
        [string]$Zone = "us-central1-a"
    )
    & $GCLOUD container clusters create $ClusterName --zone $Zone
}

# Helper functions
function Get-GCloudConfig {
    & $GCLOUD config list
}

function Get-GCloudComponents {
    & $GCLOUD components list
}

function Install-GCloudComponent {
    param([string]$ComponentName)
    & $GCLOUD components install $ComponentName
}

# Example usage:
Write-Host "GCloud command wrapper loaded! Here are some example commands:"
Write-Host "Initialize-GCloud                     # Initialize gcloud"
Write-Host "Connect-GCloud                        # Login to Google Cloud"
Write-Host "Set-GCloudProject 'my-project'       # Set active project"
Write-Host "Deploy-AppEngine                      # Deploy app to App Engine"
Write-Host "Deploy-CloudRun 'my-service' 'my-image'  # Deploy to Cloud Run"
Write-Host "Get-StorageBuckets                    # List storage buckets"
Write-Host "Get-ComputeInstances                  # List Compute Engine VMs"
