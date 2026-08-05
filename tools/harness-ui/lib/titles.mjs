/**
 * Plain-word names for work the harness already recorded.
 *
 * The stored text is NOT edited. `data/workflows.json` keeps exactly what ran, and the page still
 * carries the original in a `title=` attribute, so hovering shows it. This file only decides what
 * the page SAYS — changing the record itself to read better would be dishonest, and the merge
 * would overwrite it on the next build anyway.
 *
 * When you write a NEW workflow, put plain words in `meta.description` and in the phase titles.
 * Then nothing needs to be added here.
 */

/** Run title, by task id. */
export const RUN_TITLE = {
  w5zvxlrid: "Check the plan: an admin gets only the services you give them",
  w016c45u2: "Find every place touched by the SuperUser role and the login-loop fix",
  wnn7q9vgr: "Phone check on every kurdnezam page, and what steps 1–6 missed",
  w3zt0whn6: "Move ارکان and the menu to the database, then check the plan",
  wf3zd4p6a: "Try to break the Bale voting bot (step 8)",
  wlns67jvw: "Try to find ways to cheat the vote (step 4)",
  wp0t2l42q: "Plan the election service: secret vote, who may vote, admin panel, Bale code",
};

/** Step name. Kept short — these are column headings. */
export const STEP_NAME = {
  Attack: "Break it",
  Audit: "Check",
  Critic: "What is missing",
  Design: "Plan",
  Find: "Find",
  Investigate: "Look into it",
  Judge: "Decide",
  Refute: "Prove it wrong",
  Review: "Review",
  Survey: "Look around",
  Synthesise: "Put together",
  Verify: "Make sure",
};

/**
 * The part of an agent label after the colon.
 *
 * Labels look like `refute:correctness`. The part before the colon only repeats the step heading
 * the agent already sits under, so the page drops it and shows the part that says what this one
 * agent looked at. The whole original stays in `title=`.
 */
const AGENT_PART = {
  correctness: "is it right",
  completeness: "what is missing",
  eligibility: "who may vote",
  lockout: "locked out",
  "engineer-safety": "safe for engineers",
  "blast-radius": "who it hits",
  regression: "what broke",
  "idp-gate": "login gate",
  idp: "login server",
  servicekeys: "service keys",
  "vms-app": "vms app",
  "admin-ui": "admin screen",
  spas: "web apps",
  synthesis: "put together",
  launcher: "app launcher",
  verify: "make sure",
};

/**
 * Whole words swapped inside the short note lines under a run.
 *
 * Deliberately tiny and unambiguous. It is never applied to a safety warning — rewording a warning
 * can change what it means, so those are left exactly as the harness wrote them.
 */
const NOTE_WORD = {
  defects: "problems",
  defect: "problem",
  refuted: "rejected",
  verification: "checking",
  hazards: "risks",
  investigators: "checkers",
  investigations: "checks",
  candidate: "possible",
  surveyed: "looked at",
  audited: "checked",
  scopes: "areas",
};

const NOTE_RE = new RegExp(`\\b(${Object.keys(NOTE_WORD).join("|")})\\b`, "gi");

/** A harness safety warning — passed through untouched. */
const isWarning = (s) => /safety classifier|unavailable when review|verify the subagent/i.test(s);

export const runTitle = (run) => RUN_TITLE[run.taskId] ?? run.summary ?? run.taskId;

export const stepName = (title) => STEP_NAME[title] ?? title;

export const noteText = (line) =>
  isWarning(line) ? line : line.replace(NOTE_RE, (m) => NOTE_WORD[m.toLowerCase()] ?? m);

export function agentLabel(label) {
  if (!label) return "one agent";
  const colon = label.indexOf(":");
  const part = colon === -1 ? label : label.slice(colon + 1);
  return AGENT_PART[part.toLowerCase()] ?? part.replace(/[-_]/g, " ");
}
