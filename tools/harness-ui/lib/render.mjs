/**
 * Model → one self-contained HTML page.
 *
 * Deliberately plain: step 2 proves the data reads correctly, step 3 is the design pass. What is
 * NOT deferred is honesty — a failed reader shows as a failed reader, a snapshot says when it was
 * taken, and nothing is drawn that the data does not support.
 *
 * Self-contained on purpose: inline CSS and JS, no CDN, no fonts fetched. The page has to open from
 * disk with no network.
 */

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const num = (n) => (n ?? 0).toLocaleString("en-US");
const k = (n) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n ?? 0));
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function dur(ms) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
}

const when = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "unknown");

/** Persian and English sit side by side in this data; let the browser decide direction per string. */
const bidi = (s) => `<span dir="auto">${esc(s)}</span>`;

// ── panels ───────────────────────────────────────────────────────────────────

function sourceChips(sources) {
  return sources.map((s) => {
    const counts = Object.entries(s.counts)
      .map(([key, v]) => `${esc(key)} ${key === "totalBytes" ? mb(v) : num(v)}`)
      .join(" · ");
    const warn = s.warnings.length ? ` title="${esc(s.warnings.join(" | "))}"` : "";
    return `<div class="chip ${s.ok ? "" : "bad"}"${warn}>
      <b>${esc(s.id)}</b>${s.volatile ? '<i class="vol" title="read from %TEMP% — mirrored into data/">volatile</i>' : ""}
      <span>${counts || "—"}</span>
      ${s.warnings.length ? `<i class="warn">${s.warnings.length} note${s.warnings.length > 1 ? "s" : ""}</i>` : ""}
    </div>`;
  }).join("");
}

function agentNode(a) {
  const state = a.state === "done" ? "ok" : a.state === "error" ? "bad" : "other";
  const body = [
    a.model && `<div><b>model</b> ${esc(a.model)}</div>`,
    `<div><b>state</b> ${esc(a.state ?? "?")}${a.attempt > 1 ? ` (attempt ${a.attempt})` : ""}</div>`,
    `<div><b>cost</b> ${num(a.tokens)} tokens · ${num(a.toolCalls)} tool calls · ${dur(a.durationMs)}</div>`,
    a.lastToolName && `<div><b>last tool</b> ${esc(a.lastToolName)}</div>`,
    a.promptPreview && `<div class="pre"><b>prompt</b>\n${esc(a.promptPreview)}</div>`,
    (a.returnPreview || a.resultPreview) &&
      `<div class="pre"><b>returned</b>${a.returnedStructured ? " (structured)" : ""}\n${esc(a.returnPreview || a.resultPreview)}</div>`,
  ].filter(Boolean).join("");

  return `<details class="agent ${state}">
    <summary><span class="dot"></span><span class="lbl">${esc(a.label ?? a.agentId ?? "agent")}</span><span class="tok">${k(a.tokens)}</span></summary>
    <div class="agentbody">${body}</div>
  </details>`;
}

function runCard(run) {
  const phases = run.phases.map((p) => `
    <div class="phase">
      <h4>${esc(p.title)} <span>${p.agentIndexes.length}</span></h4>
      ${p.agentIndexes.map((i) => agentNode(run.agents[i])).join("")}
    </div>`).join('<div class="arrow" aria-hidden="true">→</div>');

  const failed = run.agents.filter((a) => a.state && a.state !== "done").length;

  return `<article class="run">
    <header>
      <div>
        <h3>${esc(run.summary ?? run.taskId)}</h3>
        <p class="meta">${when(run.startedAt)} · ${run.agents.length} agents · ${k(run.totalTokens)} tokens ·
           ${num(run.totalToolCalls)} tool calls · ${dur((run.endedAt ?? 0) - (run.startedAt ?? 0))}
           ${failed ? `· <b class="bad-txt">${failed} not done</b>` : ""}</p>
      </div>
      <code>${esc(run.taskId)}</code>
    </header>
    ${run.logs.length ? `<ul class="logs">${run.logs.map((l) => `<li>${bidi(l)}</li>`).join("")}</ul>` : ""}
    <div class="phases">${phases}</div>
  </article>`;
}

function flowPanel(runs) {
  if (!runs.length) {
    return `<p class="empty">No workflow runs recorded yet. Runs appear here after a Workflow completes —
      and stay here even once %TEMP% is cleared, because they are mirrored into <code>data/</code>.</p>`;
  }
  return runs.map(runCard).join("");
}

function historyPanel(entries) {
  if (!entries.length) return `<p class="empty">No worklog entries parsed from <code>docs/worklog/README.md</code>.</p>`;

  return entries.map((e) => `
    <div class="entry${e.exists ? "" : " missing"}">
      <time>${esc(e.date)}</time>
      <div class="entrybody">
        <h4>${bidi(e.title)}${e.exists ? "" : ' <i class="warn">file missing</i>'}</h4>
        <p class="meta">${bidi(e.area)} · ${bidi(e.status)}</p>
        ${e.openItems.length ? `<details class="open">
          <summary>${e.openItems.length} open</summary>
          <ul>${e.openItems.map((i) => `<li>${bidi(i)}</li>`).join("")}</ul>
        </details>` : ""}
      </div>
      <code>${esc(e.file)}</code>
    </div>`).join("");
}

function statePanel(model) {
  const byType = {};
  for (const f of model.memory) (byType[f.type] ??= []).push(f);

  const memory = Object.entries(byType).map(([type, facts]) => `
    <div class="grp">
      <h4>${esc(type)} <span>${facts.length}</span></h4>
      ${facts.map((f) => `<details class="fact">
        <summary>${bidi(f.name)}</summary>
        <div class="agentbody">
          <div>${bidi(f.description)}</div>
          ${f.links.length ? `<div><b>links</b> ${f.links.map((l) => `<code>${esc(l)}</code>`).join(" ")}</div>` : ""}
          <div class="pre">${esc(f.excerpt)}</div>
        </div>
      </details>`).join("")}
    </div>`).join("");

  const list = (title, items) => `
    <div class="grp">
      <h4>${esc(title)} <span>${items.length}</span></h4>
      ${items.length ? `<ul class="plain">${items.map((i) => `<li><code>${esc(i)}</code></li>`).join("")}</ul>`
                     : `<p class="empty small">none</p>`}
    </div>`;

  const bytes = model.sessions.reduce((s, x) => s + x.bytes, 0);

  return `<div class="cols">
    ${memory || '<p class="empty">No memory files.</p>'}
    ${list("skills", model.config.skills)}
    ${list("agents", model.config.agents)}
    ${list("workflow scripts", model.config.workflowScripts.map((w) => w.name))}
    <div class="grp">
      <h4>sessions <span>${model.sessions.length}</span></h4>
      <p class="meta">${mb(bytes)} of transcripts. Counted, never read — they are far too large to render.</p>
    </div>
  </div>`;
}

// ── page ─────────────────────────────────────────────────────────────────────

const CSS = `
:root{--bg:#fbfbfa;--panel:#fff;--ink:#1b1b19;--dim:#6b6a66;--line:#e6e5e1;--ok:#2f7d63;--bad:#b0413e;--other:#9a7b32;--accent:#2f5d7d}
@media(prefers-color-scheme:dark){:root{--bg:#16171a;--panel:#1d1f23;--ink:#e8e8e6;--dim:#9a9a95;--line:#2c2f35;--ok:#5fbf9c;--bad:#e2807d;--other:#d4ac5a;--accent:#7fb3d5}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:20px;margin:0 0 2px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:36px 0 12px;font-weight:600}
h3{font-size:15px;margin:0 0 2px}
h4{font-size:13px;margin:0 0 8px;display:flex;align-items:center;gap:6px}
/* Count badge — scoped, NOT \`h4 span\`: worklog titles wrap their text in a <span dir="auto"> for
   mixed Persian/English, and a blanket rule turned every entry title into a grey pill. */
.phase>h4>span,.grp>h4>span{background:var(--line);border-radius:20px;padding:1px 7px;font-size:11px;color:var(--dim)}
p{margin:0}
code{font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dim);white-space:nowrap}
.meta{color:var(--dim);font-size:12.5px}
.small{font-size:12px}
.empty{color:var(--dim);background:var(--panel);border:1px dashed var(--line);border-radius:10px;padding:16px}
.bad-txt{color:var(--bad)}
.warn{color:var(--other);font-style:normal;font-size:11px;background:color-mix(in srgb,var(--other) 15%,transparent);border-radius:5px;padding:1px 5px}
.vol{color:var(--accent);font-style:normal;font-size:10px;border:1px solid var(--accent);border-radius:5px;padding:0 4px}

header.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:14px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.chip{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--ok);border-radius:8px;padding:7px 11px;font-size:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.chip.bad{border-left-color:var(--bad)}
.chip span{color:var(--dim)}

.run{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:14px}
.run>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
.logs{margin:0 0 12px;padding-left:18px;color:var(--dim);font-size:12.5px}
.phases{display:flex;gap:10px;align-items:flex-start;overflow-x:auto;padding-bottom:4px}
.phase{flex:1 1 0;min-width:190px;background:color-mix(in srgb,var(--line) 30%,transparent);border-radius:10px;padding:10px}
.arrow{color:var(--dim);align-self:center;flex:0 0 auto}

.agent{border:1px solid var(--line);background:var(--panel);border-radius:8px;margin-bottom:6px}
.agent>summary{cursor:pointer;padding:6px 9px;display:flex;align-items:center;gap:7px;font-size:12.5px;list-style:none}
.agent>summary::-webkit-details-marker{display:none}
.dot{width:7px;height:7px;border-radius:50%;background:var(--other);flex:0 0 auto}
.agent.ok .dot{background:var(--ok)} .agent.bad .dot{background:var(--bad)}
.lbl{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tok{color:var(--dim);font-size:11px}
.agentbody{padding:2px 10px 10px;font-size:12.5px;display:grid;gap:6px;border-top:1px solid var(--line)}
.agentbody b{color:var(--dim);font-weight:600;margin-right:5px}
.pre{white-space:pre-wrap;word-break:break-word;font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:color-mix(in srgb,var(--line) 35%,transparent);border-radius:6px;padding:8px;max-height:230px;overflow:auto}

.entry{display:grid;grid-template-columns:92px 1fr auto;gap:12px;align-items:start;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:11px 13px;margin-bottom:7px}
.entry.missing{border-color:var(--bad)}
.entry time{color:var(--dim);font:11.5px ui-monospace,monospace;padding-top:2px}
.entry h4{margin:0 0 2px;font-size:13.5px;font-weight:600}
.open>summary{cursor:pointer;color:var(--other);font-size:12px;margin-top:5px}
.open ul{margin:6px 0 0;padding-left:18px;color:var(--dim);font-size:12.5px}
.open li{margin-bottom:3px}

.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start}
.grp{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px}
.fact>summary{cursor:pointer;font-size:12.5px;padding:4px 0}
ul.plain{margin:0;padding-left:16px}
ul.plain li{margin-bottom:3px}

@media(max-width:640px){
  .wrap{padding:18px 13px 60px}
  .entry{grid-template-columns:1fr;gap:5px}
  .entry code,.run>header code{display:none}
  .phases{flex-direction:column}
  .arrow{transform:rotate(90deg);align-self:flex-start}
  /* <summary> is the only thing you tap here, and they measured 19-31px tall. 44px is the floor. */
  .agent>summary,.open>summary,.fact>summary{min-height:44px;display:flex;align-items:center;gap:7px}
  .agentbody{font-size:13px}
}`;

export function renderPage(model) {
  const totals = {
    runs: model.workflows.length,
    agents: model.workflows.reduce((s, r) => s + r.agents.length, 0),
    tokens: model.workflows.reduce((s, r) => s + (r.totalTokens ?? 0), 0),
    open: model.worklog.reduce((s, e) => s + e.openItems.length, 0),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>harness — ${esc(model.project.slug)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">

<header class="top">
  <div>
    <h1>Harness operations</h1>
    <p class="meta">${esc(model.project.root)}</p>
  </div>
  <div>
    <p class="meta">snapshot taken ${esc(model.generatedAt)}</p>
    <p class="meta">${totals.runs} runs · ${totals.agents} agents · ${k(totals.tokens)} tokens · ${totals.open} open threads</p>
  </div>
</header>

<div class="chips">${sourceChips(model.sources)}</div>

<h2>Flow</h2>
${flowPanel(model.workflows)}

<h2>History</h2>
${historyPanel(model.worklog)}

<h2>State</h2>
${statePanel(model)}

</div>
</body>
</html>
`;
}
