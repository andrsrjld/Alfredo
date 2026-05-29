param(
  [string]$GitLabApi = $(if ($env:GITLAB_API) { $env:GITLAB_API } else { "https://gitlab.com/api/v4" }),
  [string]$GitLabPat = $env:GITLAB_PAT,
  [string]$GroupId = $env:GITLAB_GROUP_ID,
  [string]$WebhookUrl = $env:WEBHOOK_URL,
  [string]$Trigger = $(if ($env:TRIGGER) { $env:TRIGGER } else { "pipeline_events" })
)

$ErrorActionPreference = "Stop"

if (-not $GitLabPat) { throw "Set GITLAB_PAT with api scope." }
if (-not $GroupId) { throw "Set GITLAB_GROUP_ID." }
if (-not $WebhookUrl) { throw "Set WEBHOOK_URL, for example https://your-domain/api/webhook/gitlab." }

$headers = @{ "PRIVATE-TOKEN" = $GitLabPat }
$tested = 0
$missing = 0
$failed = 0
$page = 1

while ($true) {
  $projectsUri = "$GitLabApi/groups/$([uri]::EscapeDataString($GroupId))/projects?include_subgroups=true&per_page=100&page=$page"
  $projects = Invoke-RestMethod -Method Get -Uri $projectsUri -Headers $headers

  if (-not $projects -or $projects.Count -eq 0) { break }

  foreach ($project in $projects) {
    $hooks = Invoke-RestMethod -Method Get -Uri "$GitLabApi/projects/$($project.id)/hooks" -Headers $headers
    $hook = $hooks | Where-Object { $_.url -eq $WebhookUrl } | Select-Object -First 1

    if (-not $hook) {
      Write-Host "MISS  $($project.path_with_namespace) (no hook for $WebhookUrl)"
      $missing++
      continue
    }

    try {
      Invoke-RestMethod `
        -Method Post `
        -Uri "$GitLabApi/projects/$($project.id)/hooks/$($hook.id)/test/$Trigger" `
        -Headers $headers | Out-Null
      Write-Host "OK    $($project.path_with_namespace) hook=$($hook.id) trigger=$Trigger"
      $tested++
    } catch {
      Write-Host "FAIL  $($project.path_with_namespace) hook=$($hook.id) trigger=$Trigger :: $($_.Exception.Message)"
      $failed++
    }
  }

  $page++
}

Write-Host ""
Write-Host "Done: $tested tested, $missing missing, $failed failed"
