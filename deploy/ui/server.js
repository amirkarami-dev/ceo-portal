/* Deploy console for ceo-portal — a small local web UI that runs the SAME incremental deploy
 * documented in docs/ai/OPERATIONS.md: tag :rollback, build one service, recreate it with
 * --no-deps, then verify. It never touches sqlserver, minio, the shared Docker daemon or Traefik.
 *
 *   node deploy/ui/server.js        ->  http://127.0.0.1:8099
 *
 * Safety notes, all deliberate:
 *  - Binds to 127.0.0.1 ONLY. A button that deploys production must never listen on the network.
 *  - The server password is read from CEO_SERVER_PASS and is never sent to the browser, never
 *    logged, and never written to disk. Output lines are scrubbed just in case.
 *  - Only services in SERVICES can be deployed; the name is never interpolated into a shell
 *    string without passing this allow-list first.
 *  - No dependencies. Node's stdlib only.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

const PORT = 8099;
const HOST = "127.0.0.1";
const REPO = path.resolve(__dirname, "..", "..");
const APP_PATH = "/data/apps/ceo-portal";
const COMPOSE = "deploy/docker-compose.newserver.yml";
const SERVER = { ip: "185.206.94.116", user: "ubuntu", hostkey: "SHA256:avswocM1nU3e0FnKQsQDoKSfs6mb/dkRG/8r7iTLEps" };
const PLINK = "C:\\Program Files\\PuTTY\\plink.exe";
const PSCP = "C:\\Program Files\\PuTTY\\pscp.exe";
const PASS = process.env.CEO_SERVER_PASS || "";

/* Per service: which tracked paths make up its build context, the container to watch, and a public
 * host to curl afterwards. Paths come straight from the build.context/dockerfile pairs in
 * deploy/docker-compose.newserver.yml — get these wrong and you ship a stale image. */
const SERVICES = {
  "kurdnezam-web": { label: "Kurdnezam public site", container: "ceo-portal-kurdnezam-web", host: "kurdnezam.ir", paths: ["kurdnezam-web"] },
  "portal-web": { label: "MyCEO portal", container: "ceo-portal-portal-web", host: "myceo.ir", paths: ["portal-web"] },
  "analytics-web": { label: "Analytics", container: "ceo-portal-analytics-web", host: "analytic.myceo.ir", paths: ["analytics-web"] },
  "walfare-web": { label: "Engineers' welfare", container: "ceo-portal-walfare-web", host: "refahi.kurdnezam.ir", paths: ["walfare-web"] },
  "mun-sanandaj-web": { label: "Sanandaj municipality", container: "ceo-portal-mun-sanandaj-web", host: "mun-sanandaj.myceo.ir", paths: ["mun-sanandaj-web"] },
  "election-web": { label: "Elections", container: "ceo-portal-election-web", host: "election.myceo.ir", paths: ["election-web"] },
  "landing-panel": { label: "Kurdnezam CMS", container: "ceo-portal-landing-panel", host: "landing-panel.myceo.ir", paths: ["landing-panel"] },
  "admin-web": { label: "User admin", container: "ceo-portal-admin-web", host: "admin.myceo.ir", paths: ["admin-web"] },
  "mabhas19-web": { label: "Mabhas19 web", container: "mabhas19-web", host: "mabhas19.myceo.ir", paths: ["mabhas19-web", "packages", "package.json", "package-lock.json", "deploy/Dockerfile.web"] },
  api: { label: "API", container: "ceo-portal-api", host: "api.myceo.ir", heavy: true, paths: ["src", "packages", "Directory.Build.props", "Directory.Packages.props", "ceo-portal.slnx", "deploy/Dockerfile.api"] },
  auth: { label: "Auth (OIDC IdP)", container: "ceo-portal-auth", host: "auth.myceo.ir", heavy: true, paths: ["src", "Directory.Build.props", "Directory.Packages.props", "ceo-portal.slnx", "deploy/Dockerfile.auth"] },
};

const scrub = (s) => (PASS ? String(s).split(PASS).join("********") : String(s));

/* ---------- remote helpers ---------------------------------------------------------------- */

function runStreaming(cmd, args, onLine) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let buf = "";
    const flush = (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.filter((l) => l.trim()).forEach((l) => onLine(scrub(l)));
    };
    p.stdout.on("data", flush);
    p.stderr.on("data", flush);
    p.on("error", (e) => { onLine("spawn failed: " + e.message); resolve(1); });
    p.on("close", (code) => { if (buf.trim()) onLine(scrub(buf)); resolve(code === null ? 1 : code); });
  });
}

const remote = (script, onLine) =>
  runStreaming(PLINK, ["-batch", "-hostkey", SERVER.hostkey, "-pw", PASS, `${SERVER.user}@${SERVER.ip}`, script], onLine);

/* Read-only status for the cards. Runs once per page load, not on a timer, so it never hammers
 * a box that is also serving other production stacks. */
function fetchStatus() {
  if (!PASS) return {};
  const r = spawnSync(PLINK, ["-batch", "-hostkey", SERVER.hostkey, "-pw", PASS,
    `${SERVER.user}@${SERVER.ip}`,
    "docker ps --format '{{.Names}}|{{.Status}}'"], { encoding: "utf8", windowsHide: true, timeout: 45000 });
  const out = {};
  String(r.stdout || "").split(/\r?\n/).forEach((line) => {
    const [name, status] = line.split("|");
    if (name && status) out[name.trim()] = status.trim();
  });
  return out;
}

/* ---------- the deploy job ---------------------------------------------------------------- */

const jobs = new Map(); // id -> { events: [], done: bool, listeners: Set }

function emit(job, type, payload) {
  const ev = { type, ...payload, t: Date.now() };
  job.events.push(ev);
  job.listeners.forEach((res) => res.write(`data: ${JSON.stringify(ev)}\n\n`));
}

async function runDeploy(job, key) {
  const svc = SERVICES[key];
  const C = `docker compose -f ${COMPOSE} --env-file deploy/.env`;
  const tar = path.join(os.tmpdir(), `ceo-deploy-${key}-${job.id}.tgz`);
  const step = (i, name) => emit(job, "step", { index: i, name, state: "running" });
  const ok = (i) => emit(job, "step", { index: i, state: "ok" });
  const fail = (i, why) => { emit(job, "step", { index: i, state: "fail" }); emit(job, "done", { ok: false, error: why }); job.done = true; };
  const log = (line) => emit(job, "log", { line });

  try {
    // 1 — package exactly the tracked paths this service builds from, straight out of HEAD.
    step(0, "Package files from HEAD");
    const ga = spawnSync("git", ["archive", "--format=tar.gz", "-o", tar, "HEAD", ...svc.paths],
      { cwd: REPO, encoding: "utf8", windowsHide: true });
    if (ga.status !== 0) return fail(0, "git archive failed: " + (ga.stderr || "").trim());
    log(`packaged ${svc.paths.length} path(s) -> ${(fs.statSync(tar).size / 1024).toFixed(0)} KB`);
    ok(0);

    // 2 — upload
    step(1, "Upload to server");
    let code = await runStreaming(PSCP, ["-batch", "-hostkey", SERVER.hostkey, "-pw", PASS, tar,
      `${SERVER.user}@${SERVER.ip}:/tmp/ceo-deploy.tgz`], log);
    if (code !== 0) return fail(1, "upload failed");
    ok(1);

    // 3 — extract
    step(2, "Extract on server");
    code = await remote(`cd ${APP_PATH} && tar -xzf /tmp/ceo-deploy.tgz -C ${APP_PATH} && rm -f /tmp/ceo-deploy.tgz && echo extracted`, log);
    if (code !== 0) return fail(2, "extract failed");
    ok(2);

    // 4 — keep a way back before anything is replaced
    step(3, "Tag current image :rollback");
    await remote(`docker tag ceo-portal-${key}:newserver ceo-portal-${key}:rollback 2>/dev/null || echo 'no current image to tag'`, log);
    ok(3);

    // 5 — build ONLY this service
    step(4, "Build image");
    code = await remote(`cd ${APP_PATH} && ${C} build ${key} 2>&1; echo BUILD_EXIT=\${PIPESTATUS[0]}`, (l) => {
      log(l);
      if (/^BUILD_EXIT=/.test(l) && l.trim() !== "BUILD_EXIT=0") job._buildFailed = true;
    });
    if (code !== 0 || job._buildFailed) return fail(4, "build failed");
    ok(4);

    // 6 — recreate ONLY this container. --no-deps is what keeps sqlserver/minio/api untouched.
    step(5, "Recreate container (--no-deps)");
    code = await remote(`cd ${APP_PATH} && ${C} up -d --no-deps --force-recreate ${key} 2>&1; echo UP_EXIT=\${PIPESTATUS[0]}`, log);
    if (code !== 0) return fail(5, "recreate failed");
    ok(5);

    // 7 — a build that finishes is not a deploy that works
    step(6, "Verify");
    await remote(
      `sleep 25; docker ps --filter name=${svc.container} --format 'container: {{.Names}} {{.Status}}'; ` +
      `printf 'https://${svc.host} -> '; curl -k -s -o /dev/null -w '%{http_code}\\n' --max-time 15 --resolve ${svc.host}:443:127.0.0.1 https://${svc.host}/`,
      log);
    ok(6);

    emit(job, "done", { ok: true });
    job.done = true;
  } catch (e) {
    emit(job, "done", { ok: false, error: scrub(e.message) });
    job.done = true;
  } finally {
    fs.existsSync(tar) && fs.unlinkSync(tar);
  }
}

/* ---------- http ---------------------------------------------------------------------------- */

const send = (res, code, type, body) => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return send(res, 200, "text/html; charset=utf-8", fs.readFileSync(path.join(__dirname, "index.html")));
  }

  if (url.pathname === "/api/services") {
    const live = fetchStatus();
    const list = Object.entries(SERVICES).map(([key, s]) => ({
      key, label: s.label, host: s.host, heavy: !!s.heavy, status: live[s.container] || null,
    }));
    return send(res, 200, "application/json", JSON.stringify({ hasPassword: !!PASS, services: list }));
  }

  if (url.pathname === "/api/deploy" && req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let key;
      try { key = JSON.parse(body).service; } catch { return send(res, 400, "application/json", '{"error":"bad json"}'); }
      if (!SERVICES[key]) return send(res, 400, "application/json", '{"error":"unknown service"}');
      if (!PASS) return send(res, 400, "application/json", '{"error":"CEO_SERVER_PASS is not set"}');
      const id = Math.random().toString(36).slice(2, 10);
      const job = { id, events: [], listeners: new Set(), done: false };
      jobs.set(id, job);
      runDeploy(job, key);
      send(res, 200, "application/json", JSON.stringify({ jobId: id }));
    });
    return;
  }

  if (url.pathname === "/api/events") {
    const job = jobs.get(url.searchParams.get("job"));
    if (!job) return send(res, 404, "text/plain", "no such job");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    job.events.forEach((ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`)); // replay
    job.listeners.add(res);
    req.on("close", () => job.listeners.delete(res));
    return;
  }

  send(res, 404, "text/plain", "not found");
}).listen(PORT, HOST, () => {
  console.log(`Deploy console: http://${HOST}:${PORT}`);
  if (!PASS) {
    console.log("\nWARNING: CEO_SERVER_PASS is not set - the buttons will refuse to run.");
    console.log("  $env:CEO_SERVER_PASS = [Environment]::GetEnvironmentVariable('CEO_SERVER_PASS','User')\n");
  }
});
