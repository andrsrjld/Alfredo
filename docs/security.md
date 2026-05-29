# Security Notes

## Repository Hygiene

- Keep real environment files out of git: `.env`, `.env.local`, `.env.production`, `.envrc`, and server-only compose env files.
- Keep local memory, agent state, credentials, certificates, private keys, and service-account JSON files out of git.
- Run the tracked-file scanner before pushing:

```bash
npm run check:secrets
```

The `Security Checks` GitHub Actions workflow runs the same scanner on pushes and pull requests.

## If a Secret Was Committed

Removing the file in a later commit is not enough because git history still contains the old value.

1. Rotate the exposed secret in the provider dashboard.
2. Update production, Docker, GitHub Actions, and local env values.
3. Rewrite repository history only after coordinating with everyone using the repo, because it requires a force push.

For this app, prioritize rotating:

- Supabase service-role key
- Supabase anon key, if it appeared in an old env file
- WhatsApp/Fonnte/Evolution provider tokens
- GitLab PAT and webhook secrets
- AI provider API keys
- `ENCRYPTION_KEY` only if it was exposed; if rotated, re-save encrypted dashboard settings
