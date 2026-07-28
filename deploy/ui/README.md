# Deploy console

A small local web UI for the **incremental** deploy described in
[`docs/ai/OPERATIONS.md`](../../docs/ai/OPERATIONS.md). One button per service. Each press runs the
same seven steps the runbook prescribes, and streams the real server output while it happens.

```powershell
$env:CEO_SERVER_PASS = [Environment]::GetEnvironmentVariable('CEO_SERVER_PASS','User')
node deploy/ui/server.js          # http://127.0.0.1:8099
```

Or start it from `.claude/launch.json` as **deploy-console**.

## What a deploy does

| # | Step | Command behind it |
|---|---|---|
| 1 | Package files from HEAD | `git archive HEAD <the service's build paths>` |
| 2 | Upload | `pscp` to `/tmp` |
| 3 | Extract | into `/data/apps/ceo-portal` |
| 4 | Tag `:rollback` | `docker tag ceo-portal-<svc>:newserver …:rollback` |
| 5 | Build | `docker compose build <svc>` — **only that service** |
| 6 | Recreate | `up -d --no-deps --force-recreate <svc>` |
| 7 | Verify | container status + public HTTPS code |

`--no-deps` is the important flag: SQL Server, MinIO, the API and every other SPA keep running.
The shared Docker daemon and Traefik are never restarted — other production stacks live on that box.

Step 1 packages **only the paths that service actually builds from**, taken from the
`build.context` / `dockerfile` pairs in `deploy/docker-compose.newserver.yml`. If you add a service
or change its context, update `SERVICES` in `server.js` or you will ship a stale image.

## Safety

- **Binds to `127.0.0.1` only.** A button that deploys production must never listen on a network
  interface. Do not "fix" this by binding `0.0.0.0`.
- The password is read from `CEO_SERVER_PASS`, is never sent to the browser, never logged, and
  never written to disk. Output lines are scrubbed before they reach the UI.
- Only services listed in `SERVICES` can be deployed — the name from the browser is checked against
  that allow-list before it is used.
- Every deploy asks for confirmation first.
- If a step fails, the run stops and **the old container keeps serving**. Roll back with the
  `:rollback` tag that step 4 created.

## Not covered

`sqlserver` and `minio` are deliberately absent. They hold state, and restarting them is a
migration-shaped job, not a button — see the volume-rename trap in
[`docs/ai/GOTCHAS.md`](../../docs/ai/GOTCHAS.md).
