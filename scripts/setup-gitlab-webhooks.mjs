#!/usr/bin/env node

import { readFileSync } from 'fs'
import { join } from 'path'

const GITLAB_API = 'https://gitlab.com/api/v4'
const WEBHOOK_URL_BASE = process.env.WEBHOOK_URL_BASE || 'https://alfredo-pi.vercel.app'
const WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET
const GITLAB_PAT = process.env.GITLAB_PAT
const GROUP_ID = process.env.GITLAB_GROUP_ID

if (!GITLAB_PAT || !WEBHOOK_SECRET || !GROUP_ID) {
  console.error('Missing env vars. Set: GITLAB_PAT, GITLAB_WEBHOOK_SECRET, GITLAB_GROUP_ID')
  console.error('Optional: WEBHOOK_URL_BASE (default: https://alfredo-pi.vercel.app)')
  process.exit(1)
}

const WEBHOOK_URL = `${WEBHOOK_URL_BASE}/api/webhook/gitlab`

async function gitlabFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'PRIVATE-TOKEN': GITLAB_PAT,
      'Content-Type': 'application/json',
    },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${GITLAB_API}${path}`, opts)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`GitLab API ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

async function getGroupProjects(groupId) {
  const projects = []
  let page = 1
  while (true) {
    const data = await gitlabFetch(`/groups/${encodeURIComponent(groupId)}/projects?include_subgroups=true&per_page=100&page=${page}`)
    if (data.length === 0) break
    projects.push(...data)
    page++
  }
  return projects
}

async function getProjectWebhooks(projectId) {
  return gitlabFetch(`/projects/${projectId}/hooks`)
}

async function createWebhook(projectId) {
  return gitlabFetch(`/projects/${projectId}/hooks`, 'POST', {
    url: WEBHOOK_URL,
    token: WEBHOOK_SECRET,
    pipeline_events: true,
    push_events: false,
    merge_requests_events: false,
    tag_push_events: false,
    enable_ssl_verification: true,
  })
}

async function main() {
  console.log(`Fetching projects for group ${GROUP_ID}...`)
  const projects = await getGroupProjects(GROUP_ID)
  console.log(`Found ${projects.length} projects\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const project of projects) {
    const pid = project.id
    const path = project.path_with_namespace

    try {
      const hooks = await getProjectWebhooks(pid)
      const exists = hooks.some(h => h.url === WEBHOOK_URL)

      if (exists) {
        console.log(`SKIP  ${path} (webhook exists)`)
        skipped++
        continue
      }

      await createWebhook(pid)
      console.log(`OK    ${path}`)
      created++
    } catch (err) {
      console.error(`FAIL  ${path}: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})