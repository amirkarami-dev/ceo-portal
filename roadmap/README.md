# Development roadmap board

A single-file, static **development status board** for the Mabhas19 portal. Pick a service,
see its work split across **Not started / In progress / Done** (plus a **Blocked** column when
needed), with search + area/priority filters, per-service and overall progress, and a dark/light
toggle.

```
roadmap/
├─ index.html     ← the board (self-contained HTML + CSS + JS, no build step, no dependencies)
├─ roadmap.json   ← the data — EDIT THIS to update the board
└─ README.md      ← this file
```

## Viewing it

`index.html` loads `roadmap.json` with `fetch()`, which browsers **block on `file://`**. So:

```bash
# from the repo root — any static server works
npx serve roadmap          # → http://localhost:3000
# or
python -m http.server -d roadmap 8080
```

Then open the printed URL. (On production, nginx serves the folder and it just works.)

## Updating the board

Edit **`roadmap.json`** and reload — no rebuild. Shape:

```jsonc
{
  "meta": { "title": "…", "updated": "YYYY-MM-DD", "statuses": ["not-started","in-progress","done","blocked"] },
  "services": [
    {
      "id": "analytic",                 // stable slug
      "name": "Analytics platform",
      "domain": "analytic.myceo.ir",
      "kind": "live",                   // "live" | "planned"
      "items": [
        {
          "id": "analytic-01",          // unique within the service
          "title": "Export engine (PDF / Excel)",
          "desc": "one short line (optional)",
          "status": "not-started",      // not-started | in-progress | done | blocked
          "area": "backend",            // backend | frontend | devops | infra | mobile | docs
          "priority": "high",           // high | med | low
          "effort": "M",                // XS | S | M | L
          "tags": ["export"],           // optional
          "notes": "anything (optional)"
        }
      ]
    }
  ]
}
```

- The **service selector** lists every `services[]` entry; `kind: "planned"` ones are marked and dashed.
- A service's **Blocked** column only appears when it has at least one `blocked` item.
- Progress = `done / total` per service, and across all services in the header.

## Deploying (optional)

This board exposes the internal roadmap, so **do not make it public**. Recommended posture
(mirrors `ADR-019`): host it as a **gated static site** behind the shared Traefik —
auth- or IP-restricted, **DNS-only (no CDN)** — e.g. a tiny nginx service on the analytics box
at `status.myceo.ir`. It's just three static files; no container build of its own is required
beyond an nginx `COPY`.
