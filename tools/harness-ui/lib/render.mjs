/**
 * Model → one self-contained HTML page.
 *
 * Operate surface: someone opens this to answer "what did the AI do, and what is still not
 * finished". Scanning beats expression, so the page keeps one type family, one accent, and a
 * status vocabulary that never changes meaning. No CDN, no fetched fonts — it opens from disk with
 * no network.
 *
 * Words are kept simple on purpose. The person reading this does not have English as a first
 * language, so short common words win over exact-but-rare ones, everywhere on the page.
 */

import { runTitle, stepName, noteText, agentLabel } from "./titles.mjs";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const num = (n) => (n ?? 0).toLocaleString("en-US");
const k = (n) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n ?? 0));
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const plural = (n, one, many = one + "s") => `${num(n)} ${n === 1 ? one : many}`;

function dur(ms) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} sec` : `${m} min`;
}

const when = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "time not known");

/** Persian and English sit side by side in this data; let the browser pick direction per string. */
const bidi = (s) => `<span dir="auto">${esc(s)}</span>`;

/** Drawn, not a text glyph — one stroke weight shared by every icon on the page. */
const icon = {
  chevron: `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>`,
  down: `<svg class="ic caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.5 8 10.5 12 6.5"/></svg>`,
};

// ── header ───────────────────────────────────────────────────────────────────

/**
 * Model keys are code names. On screen they get plain words — "nonWorkflowOutputs" tells a reader
 * nothing, and leaving it there is the same jargon leak `clarify` exists to stop.
 */
const COUNT_LABEL = {
  runs: "runs", agents: "agents",
  taskOutputs: "task files", nonWorkflowOutputs: "not workflows",
  entries: "entries", withOpenItems: "have jobs left", openItems: "jobs left",
  facts: "notes", feedback: "about how I work", project: "about the project",
  user: "about you", reference: "links",
  skills: "skills", workflowScripts: "scripts",
  sessions: "chat files", totalBytes: "size",
};

function sourceRows(sources) {
  return sources.map((s) => {
    const counts = Object.entries(s.counts)
      .map(([key, v]) => `${esc(COUNT_LABEL[key] ?? key)} <b>${key === "totalBytes" ? mb(v) : num(v)}</b>`)
      .join("<span class=\"sep\">·</span>");

    const notes = s.warnings.length
      ? `<p class="note">${s.warnings.map(esc).join("<br>")}</p>`
      : "";

    return `<div class="src${s.ok ? "" : " is-bad"}">
      <div class="srchead">
        <span class="dot ${s.ok ? "ok" : "bad"}"></span>
        <b class="srcname">${esc(s.id)}</b>
        ${s.volatile ? '<span class="tag" title="Read from the temp folder. Windows can delete it, so a copy is kept in data/.">from temp</span>' : ""}
      </div>
      <p class="counts">${counts || "nothing"}</p>
      ${notes}
    </div>`;
  }).join("");
}

// ── flow ─────────────────────────────────────────────────────────────────────

function agentRow(a) {
  const state = a.state === "done" ? "ok" : a.state === "error" ? "bad" : "warn";
  const rows = [
    a.model && ["model", esc(a.model)],
    ["result", `${esc(a.state ?? "not known")}${a.attempt > 1 ? ` · try ${a.attempt}` : ""}`],
    ["used", `${num(a.tokens)} tokens · ${plural(a.toolCalls, "tool call")} · ${dur(a.durationMs)}`],
    a.lastToolName && ["last tool", esc(a.lastToolName)],
  ].filter(Boolean);

  const blocks = [
    a.promptPreview && ["What it was asked", a.promptPreview],
    (a.returnPreview || a.resultPreview) && ["What it sent back", a.returnPreview || a.resultPreview],
  ].filter(Boolean);

  const shown = agentLabel(a.label);

  return `<details class="agent">
    <summary${a.label && shown !== a.label ? ` title="${esc(a.label)}"` : ""}>
      <span class="dot ${state}"></span>
      <span class="alabel">${esc(shown)}</span>
      <span class="atok">${k(a.tokens)}</span>
      ${icon.down}
    </summary>
    <div class="adetail">
      <dl>${rows.map(([t, v]) => `<dt>${t}</dt><dd>${v}</dd>`).join("")}</dl>
      ${blocks.map(([t, v]) => `<figure><figcaption>${t}</figcaption><pre>${esc(v)}</pre></figure>`).join("")}
    </div>
  </details>`;
}

function runSection(run) {
  const unfinished = run.agents.filter((a) => a.state && a.state !== "done").length;

  // Plain words on screen; the words the harness actually recorded stay in `title=`, so nothing
  // is hidden — hover any heading to see the original.
  const phases = run.phases.map((p, i) => `
    ${i ? `<div class="link" aria-hidden="true">${icon.chevron}</div>` : ""}
    <section class="phase">
      <h4${stepName(p.title) !== p.title ? ` title="${esc(p.title)}"` : ""}>${esc(stepName(p.title))}<span class="pcount">${plural(p.agentIndexes.length, "agent")}</span></h4>
      ${p.agentIndexes.map((n) => agentRow(run.agents[n])).join("")}
    </section>`).join("");

  const shown = runTitle(run);

  return `<article class="run">
    <header class="runhead">
      <h3${shown !== run.summary && run.summary ? ` title="${esc(run.summary)}"` : ""}>${bidi(shown)}</h3>
      <p class="facts">
        <time>${when(run.startedAt)}</time><span class="sep">·</span>
        ${plural(run.agents.length, "agent")}<span class="sep">·</span>
        ${k(run.totalTokens)} tokens<span class="sep">·</span>
        ${dur((run.endedAt ?? 0) - (run.startedAt ?? 0))}
        ${unfinished ? `<span class="sep">·</span><b class="txt-bad">${num(unfinished)} did not finish</b>` : ""}
      </p>
    </header>
    ${run.logs.length ? `<ul class="notes">${run.logs.map((l) => `<li>${bidi(noteText(l))}</li>`).join("")}</ul>` : ""}
    <div class="phases">${phases}</div>
  </article>`;
}

function flowPanel(runs) {
  if (!runs.length) {
    return `<div class="blank">
      <p><b>No workflow has run yet.</b></p>
      <p>When one finishes it shows up here — and it stays, even after Windows clears the temp folder,
         because a copy is saved in <code>data/</code>.</p>
    </div>`;
  }
  return runs.map(runSection).join("");
}

// ── work log ─────────────────────────────────────────────────────────────────

function logPanel(entries) {
  if (!entries.length) {
    return `<div class="blank"><p><b>No work log entries.</b></p>
      <p>They are read from <code>docs/worklog/README.md</code>.</p></div>`;
  }

  return `<ol class="log">${entries.map((e) => `
    <li class="item${e.exists ? "" : " is-bad"}">
      <time datetime="${esc(e.date)}">${esc(e.date)}</time>
      <div class="itembody">
        <h4>${bidi(e.title)}${e.exists ? "" : ' <span class="tag bad">file not found</span>'}</h4>
        <p class="facts">${bidi(e.area)}<span class="sep">·</span>${bidi(e.status)}</p>
        ${e.openItems.length ? `<details class="todo">
          <summary>${plural(e.openItems.length, "job")} still to do ${icon.down}</summary>
          <ul>${e.openItems.map((i) => `<li>${bidi(i)}</li>`).join("")}</ul>
        </details>` : ""}
      </div>
      <code class="path">${esc(e.file)}</code>
    </li>`).join("")}</ol>`;
}

// ── what is set up ───────────────────────────────────────────────────────────

function setupPanel(model) {
  const byType = {};
  for (const f of model.memory) (byType[f.type] ??= []).push(f);

  const memory = Object.entries(byType).map(([type, facts]) => `
    <section class="grp">
      <h4>${esc(type)} notes<span class="pcount">${num(facts.length)}</span></h4>
      ${facts.map((f) => `<details class="agent">
        <summary><span class="alabel">${bidi(f.name)}</span>${icon.down}</summary>
        <div class="adetail">
          <p>${bidi(f.description)}</p>
          ${f.links.length ? `<p class="facts">points to ${f.links.map((l) => `<code>${esc(l)}</code>`).join(" ")}</p>` : ""}
          <figure><pre>${esc(f.excerpt)}</pre></figure>
        </div>
      </details>`).join("")}
    </section>`).join("");

  const list = (title, items, empty) => `
    <section class="grp">
      <h4>${esc(title)}<span class="pcount">${num(items.length)}</span></h4>
      ${items.length
        ? `<ul class="tags">${items.map((i) => `<li><code>${esc(i)}</code></li>`).join("")}</ul>`
        : `<p class="facts">${esc(empty)}</p>`}
    </section>`;

  const bytes = model.sessions.reduce((s, x) => s + x.bytes, 0);

  return `<div class="grid">
    ${memory || '<section class="grp"><h4>notes<span class="pcount">0</span></h4><p class="facts">None saved yet.</p></section>'}
    ${list("skills", model.config.skills, "None in .claude/skills.")}
    ${list("agents", model.config.agents, "None in .claude/agents.")}
    ${list("workflow scripts", model.config.workflowScripts.map((w) => w.name), "None saved yet.")}
    <section class="grp">
      <h4>chat files<span class="pcount">${num(model.sessions.length)}</span></h4>
      <p class="facts">${mb(bytes)} in total. Only counted — they are far too big to show here.</p>
    </section>
  </div>`;
}

// ── styles ───────────────────────────────────────────────────────────────────

const CSS = `
:root{
  --bg:#faf9f7; --sunk:#f2f0eb; --ink:#191917; --dim:#57564f; --line:#e2e0d9;
  --ok:#1d6a4e; --bad:#9c2f2b; --warn:#7a5a12; --accent:#1f5f4b;
  --focus:#1f5f4b;
  --r:10px;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#141518; --sunk:#1b1d21; --ink:#eae9e5; --dim:#a5a49d; --line:#2b2e34;
    --ok:#6fc79f; --bad:#ef8a86; --warn:#d9b45f; --accent:#7fc7ad;
    --focus:#7fc7ad;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.6 ui-sans-serif,system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-variant-numeric:tabular-nums;
}
.wrap{max-width:1120px;margin:0 auto;padding:40px 24px 96px}

h1{font-size:1.5rem;line-height:1.25;margin:0;letter-spacing:-.01em}
h2{font-size:1.05rem;margin:0;letter-spacing:-.005em}
h3{font-size:1.05rem;line-height:1.35;margin:0;letter-spacing:-.005em;max-width:62ch}
h4{font-size:.8125rem;margin:0 0 10px;display:flex;align-items:baseline;gap:8px;
   text-transform:uppercase;letter-spacing:.07em;color:var(--dim);font-weight:650}
p{margin:0}
b{font-weight:650}
code{font:.75rem/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.sep{color:var(--line);margin:0 .5em}
.facts{color:var(--dim);font-size:.8125rem}
.txt-bad{color:var(--bad)}
.pcount{margin-left:auto;font-weight:450;letter-spacing:0;text-transform:none;font-size:.75rem}

.ic{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.75;
    stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}

/* status vocabulary — one meaning per colour, everywhere on the page */
.dot{width:7px;height:7px;border-radius:50%;background:var(--dim);flex:0 0 auto}
.dot.ok{background:var(--ok)} .dot.bad{background:var(--bad)} .dot.warn{background:var(--warn)}

/* header */
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;flex-wrap:wrap}
.top .facts{margin-top:4px}
.srcs{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;
      background:var(--line);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin:26px 0 8px}
.src{background:var(--bg);padding:12px 14px}
.srchead{display:flex;align-items:center;gap:7px}
.srcname{font-size:.8125rem}
.counts{color:var(--dim);font-size:.75rem;margin-top:3px}
.counts b{color:var(--ink);font-weight:600}
.tag{font-size:.6875rem;color:var(--dim);border:1px solid var(--line);border-radius:5px;padding:1px 6px;margin-left:auto}
.tag.bad{color:var(--bad);border-color:currentColor;margin-left:0}
.note{font-size:.75rem;color:var(--warn);margin-top:6px;max-width:52ch}
.src.is-bad .srcname{color:var(--bad)}

/* section headings */
.band{display:flex;align-items:baseline;gap:12px;margin:52px 0 16px;padding-bottom:9px;border-bottom:1px solid var(--line)}
.band p{color:var(--dim);font-size:.8125rem}

/* flow — sections on the page, never boxes inside boxes */
.run{padding:22px 0;border-top:1px solid var(--line)}
.run:first-of-type{border-top:0;padding-top:4px}
.runhead .facts{margin-top:5px}
.notes{margin:12px 0 0;padding-left:18px;color:var(--dim);font-size:.8125rem;max-width:78ch}
.notes li{margin-bottom:3px}
/* This text comes out of files, so it can hold a long command or path with nothing to break on.
   Two of them ran 460px wide on a 375px screen before this. */
.notes li,.todo li,.item h4,.adetail dd{overflow-wrap:anywhere}
.phases{display:flex;gap:18px;align-items:flex-start;margin-top:16px}
.phase{flex:1 1 0;min-width:0}
.phase h4{padding-bottom:7px;border-bottom:1px solid var(--line)}
/* Carries real information — the steps run in this order — so it has to be readable, not a hint. */
.link{align-self:center;color:var(--dim);opacity:.6;display:flex;padding-top:22px}

/* one row style, reused by agents and notes — same shape everywhere */
.agent{border-bottom:1px solid var(--line)}
.agent:last-child{border-bottom:0}
.agent>summary{
  display:flex;align-items:center;gap:9px;cursor:pointer;list-style:none;
  padding:9px 4px;font-size:.8125rem;border-radius:6px;
  transition:background .12s ease-out,color .12s ease-out;
}
.agent>summary::-webkit-details-marker{display:none}
.agent>summary:hover{background:var(--sunk)}
.agent>summary:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
.agent[open]>summary{color:var(--ink)}
.alabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atok{color:var(--dim);font-size:.75rem}
.caret{color:var(--dim);transition:transform .15s ease-out}
.agent[open]>summary .caret{transform:rotate(180deg)}
.adetail{padding:2px 4px 14px}
.adetail dl{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:0 0 10px;font-size:.8125rem}
.adetail dt{color:var(--dim)}
.adetail dd{margin:0}
figure{margin:0 0 8px}
figcaption{font-size:.75rem;color:var(--dim);margin-bottom:4px}
pre{
  margin:0;white-space:pre-wrap;word-break:break-word;
  font:.75rem/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  background:var(--sunk);border-radius:8px;padding:10px 12px;max-height:240px;overflow:auto;
}

/* work log — a real timeline, not a stack of cards */
.log{list-style:none;margin:0;padding:0}
.item{display:grid;grid-template-columns:88px minmax(0,1fr) auto;gap:16px;align-items:baseline;
      padding:13px 4px;border-top:1px solid var(--line)}
.item:first-child{border-top:0}
.item:hover{background:var(--sunk)}
.item>time{color:var(--dim);font-size:.75rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.item h4{font-size:.9375rem;text-transform:none;letter-spacing:0;color:var(--ink);
         font-weight:600;margin:0 0 2px;display:block;max-width:66ch}
.item.is-bad h4{color:var(--bad)}
.path{color:var(--dim);white-space:nowrap;font-size:.6875rem}
.todo>summary{display:inline-flex;align-items:center;gap:6px;cursor:pointer;list-style:none;
              color:var(--warn);font-size:.8125rem;margin-top:6px;border-radius:6px;padding:2px 4px}
.todo>summary::-webkit-details-marker{display:none}
.todo>summary:hover{background:var(--sunk)}
.todo>summary:focus-visible{outline:2px solid var(--focus);outline-offset:1px}
.todo[open]>summary .caret{transform:rotate(180deg)}
.todo ul{margin:7px 0 2px;padding-left:18px;color:var(--dim);font-size:.8125rem;max-width:76ch}
.todo li{margin-bottom:5px}

/* what is set up */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:26px 32px;align-items:start}
.grp h4{border-bottom:1px solid var(--line);padding-bottom:7px}
ul.tags{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
ul.tags code{border:1px solid var(--line);border-radius:6px;padding:2px 7px;color:var(--dim)}

.blank{border:1px dashed var(--line);border-radius:var(--r);padding:20px;color:var(--dim);max-width:64ch}
.blank b{color:var(--ink)}
.blank p+p{margin-top:5px}

@media(prefers-reduced-motion:reduce){*{transition:none!important}}

@media(max-width:760px){
  .wrap{padding:24px 16px 64px}
  .phases{display:block}
  .phase+.phase,.phase{margin-top:18px}
  .link{display:none}
  .band{display:block;margin:40px 0 14px}
  .band p{margin-top:3px}
  .item{grid-template-columns:1fr;gap:2px}
  .item>time{font-size:.6875rem}
  .path{display:none}
  /* <summary> is the only thing you tap here; they measured 19–31px before this rule. */
  .agent>summary,.todo>summary{min-height:44px}
  .adetail dl{grid-template-columns:1fr;gap:0 0}
  .adetail dt{margin-top:6px}
}`;

// ── page ─────────────────────────────────────────────────────────────────────

export function renderPage(model) {
  const agents = model.workflows.reduce((s, r) => s + r.agents.length, 0);
  const tokens = model.workflows.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
  const todo = model.worklog.reduce((s, e) => s + e.openItems.length, 0);
  const readAt = model.generatedAt.slice(0, 16).replace("T", " ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI work — ${esc(model.project.slug)}</title>
<style>${CSS}</style>
</head>
<body>
<main class="wrap">

<header class="top">
  <div>
    <h1>AI work in this project</h1>
    <p class="facts">${esc(model.project.root)}</p>
  </div>
  <div>
    <p class="facts">read at ${esc(readAt)}</p>
    <p class="facts">${plural(model.workflows.length, "run")}<span class="sep">·</span>${plural(agents, "agent")}<span class="sep">·</span>${k(tokens)} tokens<span class="sep">·</span>${plural(todo, "job")} still to do</p>
  </div>
</header>

<div class="srcs">${sourceRows(model.sources)}</div>
<p class="facts">This page is a copy taken at the time above. Reload to read the folders again.</p>

<div class="band"><h2>Workflow runs</h2><p>Each run, the steps it had, and every agent inside it.</p></div>
${flowPanel(model.workflows)}

<div class="band"><h2>Work log</h2><p>One line per finished job, newest first, with what is left.</p></div>
${logPanel(model.worklog)}

<div class="band"><h2>What is set up</h2><p>Saved notes, skills, agents and scripts this project can use.</p></div>
${setupPanel(model)}

</main>
</body>
</html>
`;
}
