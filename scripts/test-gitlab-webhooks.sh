#!/usr/bin/env bash
set -euo pipefail

GITLAB_API="${GITLAB_API:-https://gitlab.com/api/v4}"
GITLAB_PAT="${GITLAB_PAT:?Set GITLAB_PAT with api scope}"
GITLAB_GROUP_ID="${GITLAB_GROUP_ID:?Set GITLAB_GROUP_ID}"
WEBHOOK_URL="${WEBHOOK_URL:-https://alfredo-pi.vercel.app/api/webhook/gitlab}"
TRIGGER="${TRIGGER:-pipeline_events}"

page=1
tested=0
missing=0
failed=0

while :; do
  projects="$(
    curl -fsS \
      --header "PRIVATE-TOKEN: ${GITLAB_PAT}" \
      "${GITLAB_API}/groups/${GITLAB_GROUP_ID}/projects?include_subgroups=true&per_page=100&page=${page}"
  )"

  count="$(printf '%s' "$projects" | jq 'length')"
  [ "$count" -eq 0 ] && break

  while IFS=$'\t' read -r project_id project_path; do
    hooks="$(
      curl -fsS \
        --header "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        "${GITLAB_API}/projects/${project_id}/hooks"
    )"

    hook_id="$(printf '%s' "$hooks" | jq -r --arg url "$WEBHOOK_URL" '.[] | select(.url == $url) | .id' | head -n 1)"

    if [ -z "$hook_id" ]; then
      printf 'MISS  %s (no hook for %s)\n' "$project_path" "$WEBHOOK_URL"
      missing=$((missing + 1))
      continue
    fi

    if curl -fsS \
      --request POST \
      --header "PRIVATE-TOKEN: ${GITLAB_PAT}" \
      "${GITLAB_API}/projects/${project_id}/hooks/${hook_id}/test/${TRIGGER}" >/dev/null; then
      printf 'OK    %s hook=%s trigger=%s\n' "$project_path" "$hook_id" "$TRIGGER"
      tested=$((tested + 1))
    else
      printf 'FAIL  %s hook=%s trigger=%s\n' "$project_path" "$hook_id" "$TRIGGER"
      failed=$((failed + 1))
    fi
  done < <(printf '%s' "$projects" | jq -r '.[] | [.id, .path_with_namespace] | @tsv')

  page=$((page + 1))
done

printf '\nDone: %s tested, %s missing, %s failed\n' "$tested" "$missing" "$failed"
