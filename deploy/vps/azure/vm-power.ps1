# Azure Automation runbook. Execute in Azure, not in the VM being controlled.
# Requires a system-assigned managed identity and Az.Accounts / Az.Compute.
param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$VmName,

    [Parameter(Mandatory = $true)]
    [ValidateSet('Start', 'Deallocate')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
Disable-AzContextAutosave -Scope Process | Out-Null
$connection = Connect-AzAccount -Identity
$context = Set-AzContext -SubscriptionId $SubscriptionId -DefaultProfile $connection.Context

if ($Action -eq 'Start') {
    Start-AzVM -ResourceGroupName $ResourceGroupName -Name $VmName -DefaultProfile $context | Out-Null
} else {
    # Without -StayProvisioned, Stop-AzVM releases the compute allocation.
    Stop-AzVM -ResourceGroupName $ResourceGroupName -Name $VmName -Force -DefaultProfile $context | Out-Null
}

$vm = Get-AzVM -ResourceGroupName $ResourceGroupName -Name $VmName -Status -DefaultProfile $context
$powerState = $vm.Statuses | Where-Object { $_.Code -like 'PowerState/*' }
Write-Output "$VmName : $($powerState.Code)"
