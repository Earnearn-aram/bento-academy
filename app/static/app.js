/* bento-academy front end. Plain JS, no build step.
   Routes:  #/                                   home
            #/learn/<course>/<module>/<lesson>/<step>
            #/quiz/<course>/<module>   #/design/<course>/<module>                       */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const app = document.getElementById("app");
const STEP_LABEL = {concept: "Concept", predict: "Predict", review: "Review", fix: "Fix", prove: "Prove", defend: "Defend"};
const MONACO_CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs";

/* ---------------------------------------------------------------- small utils */

const store = {  // per-viewer conveniences only; the app works without it
  get(k, d) { try { const v = localStorage.getItem("bento:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("bento:" + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

async function api(method, path, body) {
  const res = await fetch(path, {
    method, headers: body !== undefined ? {"Content-Type": "application/json"} : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) { const err = new Error((data && data.detail && (data.detail.message || data.detail)) || res.statusText); err.status = res.status; err.data = data; throw err; }
  return data;
}

function toast(msg, ms = 3200) {
  const t = document.createElement("div"); t.className = "toast px"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = () => { clearTimeout(t); return fn(); }; d.cancel = () => clearTimeout(t); return d; }

/* ---------------------------------------------------------------- theme */

function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; if (window.monaco) monaco.editor.setTheme(isDark() ? "bento-dark" : "bento-light"); }
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; }
applyTheme(store.get("theme", null));
$("#theme").onclick = () => { const t = isDark() ? "light" : "dark"; store.set("theme", t); applyTheme(t); };
$("#logo").innerHTML = sprite("bento", 2);

/* ---------------------------------------------------------------- code painting (read-only views) */

const KW = /\b(import|from|as|async|await|def|class|return|yield|for|in|if|elif|else|while|try|except|finally|raise|with|global|nonlocal|pass|lambda|not|and|or|is|None|True|False|break|continue)\b/;
function highlightLine(line, state) {
  // Tiny Python highlighter: strings, comments, decorators, keywords, numbers. state.tq tracks open triple quotes.
  let out = "", i = 0;
  if (state.tq) {
    const end = line.indexOf(state.tq);
    if (end === -1) return `<span class="tk-st">${esc(line)}</span>`;
    out += `<span class="tk-st">${esc(line.slice(0, end + 3))}</span>`; i = end + 3; state.tq = null;
  }
  const re = /(#.*$)|("""|''')|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w.]+)|([A-Za-z_]\w*)|(\b\d+(?:\.\d+)?\b)/g;
  re.lastIndex = i; let m, last = i;
  while ((m = re.exec(line))) {
    out += esc(line.slice(last, m.index));
    if (m[1]) out += `<span class="tk-cm">${esc(m[1])}</span>`;
    else if (m[2]) {
      const end = line.indexOf(m[2], m.index + 3);
      if (end === -1) { out += `<span class="tk-st">${esc(line.slice(m.index))}</span>`; state.tq = m[2]; return out; }
      out += `<span class="tk-st">${esc(line.slice(m.index, end + 3))}</span>`; re.lastIndex = end + 3;
    }
    else if (m[3]) out += `<span class="tk-st">${esc(m[3])}</span>`;
    else if (m[4]) out += `<span class="tk-de">${esc(m[4])}</span>`;
    else if (m[5]) out += KW.test(m[5]) && m[5].match(KW)[0] === m[5] ? `<span class="tk-kw">${m[5]}</span>` : esc(m[5]);
    else if (m[6]) out += `<span class="tk-nu">${m[6]}</span>`;
    last = re.lastIndex;
  }
  return out + esc(line.slice(last));
}
function paintCode(src) {
  const state = {};
  return src.replace(/\n$/, "").split("\n").map((l, i) =>
    `<div class="ln" data-l="${i + 1}"><span class="n">${i + 1}</span><span class="src">${highlightLine(l, state) || " "}</span></div>`).join("");
}

/* ---------------------------------------------------------------- editor (Monaco, or a textarea fallback) */

let monacoReady = null;
function loadMonaco() {
  if (monacoReady) return monacoReady;
  monacoReady = (async () => {
    let cfg = {}; try { cfg = await api("GET", "/api/config"); } catch { /* ignore */ }
    const bases = (cfg.monaco_local ? ["/vendor/monaco/vs"] : []).concat([MONACO_CDN]);
    for (const base of bases) {
      const ok = await new Promise(resolve => {
        const s = document.createElement("script"); s.src = base + "/loader.js";
        const timer = setTimeout(() => resolve(false), 8000);
        s.onerror = () => { clearTimeout(timer); resolve(false); };
        s.onload = () => {
          // Workers from another origin need a same-origin proxy script.
          window.MonacoEnvironment = {getWorkerUrl: () => "data:text/javascript;charset=utf-8," + encodeURIComponent(
            `self.MonacoEnvironment={baseUrl:'${new URL(base + "/..", location.href).href}/'};importScripts('${new URL(base, location.href).href}/base/worker/workerMain.js');`)};
          window.require.config({paths: {vs: base}});
          window.require(["vs/editor/editor.main"], () => { clearTimeout(timer); resolve(true); }, () => { clearTimeout(timer); resolve(false); });
        };
        document.head.appendChild(s);
      });
      if (ok && window.monaco) {
        const rules = [{token: "keyword", foreground: "f0a070"}, {token: "comment", foreground: "9fbf8a"}, {token: "string", foreground: "e9c98f"}, {token: "number", foreground: "f4a6b8"}];
        monaco.editor.defineTheme("bento-dark", {base: "vs-dark", inherit: true, rules, colors: {"editor.background": "#2e2a24", "editor.foreground": "#f1e7d3", "editorLineNumber.foreground": "#8a7d6a", "editor.lineHighlightBackground": "#3a332b"}});
        monaco.editor.defineTheme("bento-light", {base: "vs-dark", inherit: true, rules, colors: {"editor.background": "#2e2a24", "editor.foreground": "#f1e7d3", "editorLineNumber.foreground": "#8a7d6a", "editor.lineHighlightBackground": "#3a332b"}});
        return true;
      }
    }
    return false;
  })();
  return monacoReady;
}

async function createEditor(el, {value, onChange, onRun}) {
  const hasMonaco = await loadMonaco();
  if (hasMonaco) {
    const ed = monaco.editor.create(el, {
      value, language: "python", theme: isDark() ? "bento-dark" : "bento-light", automaticLayout: true,
      minimap: {enabled: false}, fontSize: 13, tabSize: 4, insertSpaces: true, scrollBeyondLastLine: false, renderWhitespace: "selection",
    });
    let silent = false;
    ed.onDidChangeModelContent(() => { if (!silent) onChange(ed.getValue()); });
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRun && onRun());
    return {
      get: () => ed.getValue(),
      set: v => { if (v === ed.getValue()) return; silent = true; const pos = ed.getPosition(); ed.setValue(v); if (pos) ed.setPosition(pos); silent = false; },
      dispose: () => ed.dispose(), kind: "monaco",
    };
  }
  const ta = document.createElement("textarea"); ta.spellcheck = false; ta.value = value; el.appendChild(ta);
  ta.addEventListener("input", () => onChange(ta.value));
  ta.addEventListener("keydown", e => {
    if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); onChange(ta.value); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun && onRun(); }
  });
  return {get: () => ta.value, set: v => { if (v !== ta.value) { const p = ta.selectionStart; ta.value = v; ta.selectionStart = ta.selectionEnd = Math.min(p, v.length); } }, dispose: () => {}, kind: "textarea"};
}

/* ---------------------------------------------------------------- shared pieces */

let current = null;  // state of the open lesson page
function teardown() {
  if (!current) return;
  current.es && current.es.close();
  current.save && current.save.flush && current.save.flush();
  current.editor && current.editor.dispose();
  current = null;
}

function courseSidebar(course, here) {
  let out = "";
  for (const m of course.modules) {
    out += `<h4>${sprite(m.icon, 1)}${esc(m.title)}</h4>`;
    for (const l of m.lessons) {
      const cur = here && here.module === m.id && here.lesson === l.id;
      out += `<a class="${cur ? "cur" : ""}" href="#/learn/${course.id}/${m.id}/${l.id}"><span class="box ${l.done ? "done" : ""}">${l.done ? "✓" : ""}</span>${esc(l.title)}${l.updated ? '<span class="upd" title="This lesson changed since you finished it">updated</span>' : ""}</a>`;
    }
    if (m.has_quiz) out += `<a class="extra ${here && here.quiz === m.id ? "cur" : ""}" href="#/quiz/${course.id}/${m.id}"><span class="box ${m.quiz_done ? "done" : ""}">${m.quiz_done ? "✓" : ""}</span>Quiz</a>`;
    if (m.has_design) out += `<a class="extra ${here && here.design === m.id ? "cur" : ""}" href="#/design/${course.id}/${m.id}"><span class="box ${m.design_viewed ? "done" : ""}">${m.design_viewed ? "✓" : ""}</span>System design question</a>`;
    if (!m.lessons.length) out += `<a class="extra">Coming soon</a>`;
  }
  return `<nav class="side" aria-label="Lessons">${out}</nav>`;
}

function checksHtml(run, title = "Tests") {
  if (!run) return "";
  const total = run.passed + run.failed;
  const head = run.error && !run.checks.length ? `<span class="bad">${esc(run.error)}</span>`
    : `<span>${title} · <span class="${run.ok ? "ok" : "bad"}">${run.passed} of ${total} passed</span></span>`;
  const rows = run.checks.map(c => `
    <div class="chk ${c.outcome}"><span class="ic">${c.outcome === "passed" ? "✓" : c.outcome === "skipped" ? "–" : "✗"}</span>
      <div>${esc(c.title)}${c.best_practice ? '<span class="tag">best practice</span>' : ""}
        ${c.outcome !== "passed" && c.message ? `<span class="why">${esc(c.message)}</span>` : ""}
        ${c.details ? `<details><summary>Show details</summary><pre>${esc(c.details)}</pre></details>` : ""}</div></div>`).join("");
  return `<h4>${head}<span class="note">${run.duration_s ? run.duration_s.toFixed(1) + " s" : ""}</span></h4>${rows}`;
}

function modal(title, bodyHtml, actions = "") {
  const bg = document.createElement("div"); bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal px" role="dialog" aria-label="${esc(title)}"><header>${esc(title)}<span class="spacer"></span>${actions}<button class="btn small" data-close>Close</button></header>${bodyHtml}</div>`;
  bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) bg.remove(); });
  document.body.appendChild(bg); return bg;
}

/* ---------------------------------------------------------------- home */

async function renderHome() {
  const courses = await api("GET", "/api/courses");
  let html = `<div class="home"><div class="brandline">${sprite("bento", 3)}<h1>bento-academy</h1></div><p class="sub">Learn one small box at a time.</p>`;
  if (!courses.length) html += `<div class="course px"><div class="empty">No courses yet. Add one under <code>courses/</code>.</div></div>`;
  courses.forEach((c, i) => {
    const firstOpen = m => (m.lessons.find(l => !l.done) || m.lessons[0]);
    html += `<div class="course px"><div class="head label">Course ${i + 1}</div>
      <div class="body">${sprite("mascot", 7)}<div>
        <h2>${esc(c.title)}</h2><p>${esc(c.description)}</p>
        <div class="stats">
          <span>Lessons</span><span>${c.lessons_done} / ${c.lessons_total}</span>
          <span>Quizzes</span><span>${c.quizzes_done} / ${c.quizzes_total}</span>
          <span>Review accuracy</span><span>${c.review_accuracy === null ? "–" : c.review_accuracy + "%"}</span>
          <span>Now</span><span>${esc(c.current_module || "–")}</span>
        </div>
        <div class="blocks">${Array.from({length: c.lessons_total}, (_, k) => `<i class="${k < c.lessons_done ? "f" : ""}"></i>`).join("")}</div>
      </div></div>
      <div class="modules">${c.modules.map(m => {
        const l = firstOpen(m); const href = l ? `#/learn/${c.id}/${m.id}/${l.id}` : "#/";
        const cls = m.done === m.total && m.total ? "" : (m.done > 0 || (c.last && c.last.module === m.id)) ? "cur" : "fresh";
        return `<a class="mod ${cls}" href="${href}"><div class="art">${sprite(m.icon, 3)}</div><div class="name">${esc(m.short)}</div><div class="st">${m.total ? `${m.done}/${m.total}${m.done === m.total ? " ✓" : ""}` : "soon"}</div></a>`;
      }).join("")}</div></div>`;
    const next = c.last || (() => { for (const m of c.modules) { const l = m.lessons.find(x => !x.done); if (l) return {module: m.id, lesson: l.id, title: l.title, step: null}; } return null; })();
    if (next) html += `<div class="continue px"><span>${c.last ? "Continue" : "Start"}: <b>${esc(next.title)}</b>${next.step ? ` · step ${STEP_LABEL[next.step] || next.step}` : ""}</span>
      <a class="btn primary drop" href="#/learn/${c.id}/${next.module}/${next.lesson}${next.step ? "/" + next.step : ""}">${c.last ? "Continue" : "Start"} ▸</a></div>`;
  });
  app.innerHTML = html + "</div>";
}

/* ---------------------------------------------------------------- lesson page */

async function renderLesson(courseId, moduleId, lessonId, step) {
  const base = `/api/courses/${courseId}/lessons/${moduleId}/${lessonId}`;
  const [L, course] = await Promise.all([api("GET", base), api("GET", `/api/courses/${courseId}`)]);
  const steps = L.lesson.steps;
  if (!steps.includes(step)) step = steps[0];
  api("POST", base + "/visit", {step}).catch(() => {});
  const done = s => !!(L.progress.steps[s] && L.progress.steps[s].done);
  const nextStep = steps[steps.indexOf(step) + 1];
  const href = s => `#/learn/${courseId}/${moduleId}/${lessonId}/${s}`;

  app.innerHTML = `
    <div class="top">
      <span class="crumbs"><a href="#/">${esc(L.course.title)}</a> › ${esc(L.module.title)} › <b>${esc(L.lesson.title)}</b></span>
      <span class="spacer"></span>
      <div class="steps">${steps.map(s => `<a class="step ${s === step ? "cur" : done(s) ? "done" : ""}" href="${href(s)}">${STEP_LABEL[s]}</a>`).join("")}</div>
    </div>
    <div class="layout">${courseSidebar(course, {module: moduleId, lesson: lessonId})}<div class="left md" id="left"></div><div class="right" id="right"></div></div>`;
  const left = $("#left"), right = $("#right");
  current = {base, L, courseId, moduleId, lessonId, step, href};
  const nextBtn = nextStep ? `<p style="margin-top:22px"><a class="btn primary drop" href="${href(nextStep)}">Next: ${STEP_LABEL[nextStep]} ▸</a></p>` : "";
  const views = {concept: viewConcept, predict: viewPredict, review: viewReview, fix: viewFix, prove: viewProve, defend: viewDefend};
  await views[step]({left, right, L, nextBtn, base, href, done});
  const cur = $(".side a.cur"); if (cur) cur.scrollIntoView({block: "center"});
}

async function refreshSidebar() {
  if (!current) return;
  const course = await api("GET", `/api/courses/${current.courseId}`);
  const side = $(".side"); if (!side) return;
  const scroll = side.scrollTop; side.outerHTML = courseSidebar(course, {module: current.moduleId, lesson: current.lessonId}); $(".side").scrollTop = scroll;
}
function markChip(step) { const chip = $$(".step").find(a => a.getAttribute("href").endsWith("/" + step)); if (chip && !chip.classList.contains("cur")) chip.classList.add("done"); }

/* --- concept */
async function viewConcept({left, right, L, nextBtn, base}) {
  left.innerHTML = L.concept + nextBtn;
  const labels = {concept: "Read the idea and the worked example.", predict: "Guess what some code does, then run it.",
    review: "Review a pull request and flag what's wrong.", fix: "Fix the code until the tests pass.",
    prove: "Write one test that catches the bug.", defend: "Answer senior interview questions."};
  right.innerHTML = `<div class="scroll md mission"><h2>${esc(L.lesson.title)}</h2><p class="note">${esc(L.lesson.summary)} · about ${L.lesson.minutes} min</p>
    <div class="task px"><span class="label">Your mission</span>${L.task}</div>
    <h3>How this lesson works</h3><ol>${L.lesson.steps.map(s => `<li><b>${STEP_LABEL[s]}</b>: ${labels[s]}</li>`).join("")}</ol>
    <div class="bubble">${sprite("mascot", 3)}<div class="say px">Your code lives in <code>${esc(L.exercise_dir)}/</code>. Edit it here or in your own IDE; both stay in sync.</div></div></div>`;
  if (!(L.progress.steps.concept && L.progress.steps.concept.done)) {
    api("POST", base + "/steps/concept/done").then(() => { markChip("concept"); refreshSidebar(); }).catch(() => {});
  }
}

/* --- predict */
async function viewPredict({left, right, L, nextBtn, base}) {
  const P = L.predict;
  const saved = L.progress.steps.predict && L.progress.steps.predict.data.answers;
  left.innerHTML = `<h2>Predict</h2>${P.intro}<form id="pf">${P.questions.map((q, qi) => `
    <div class="question" data-q="${qi}"><div class="prompt">${q.prompt}</div>
    ${q.options.map((o, oi) => `<label class="opt"><input type="radio" name="q${qi}" value="${oi}" ${saved && saved[qi] === oi ? "checked" : ""}>${o}</label>`).join("")}
    <div class="explain hidden"></div></div>`).join("")}
    <button class="btn primary drop" type="submit">Check my answers</button></form><div id="pnext" class="hidden">${nextBtn}</div>`;
  right.innerHTML = `<div class="tool"><span class="file">${esc(P.code ? "snippet.py · read-only" : "")}</span>${P.runnable ? '<button class="btn primary" id="runit">▶ Run it</button>' : ""}</div>
    <div class="codeview">${paintCode(P.code)}</div><div class="results" id="out"><h4>Output</h4><p class="note">Answer first, then press Run it.</p></div>`;
  $("#pf").onsubmit = async e => {
    e.preventDefault();
    const answers = P.questions.map((_, qi) => { const c = $(`input[name=q${qi}]:checked`); return c ? +c.value : null; });
    if (answers.includes(null)) return toast("Answer every question first.");
    const r = await api("POST", base + "/predict", {answers});
    r.results.forEach((res, qi) => {
      const box = $(`.question[data-q="${qi}"]`);
      $$(".opt", box).forEach((o, oi) => { o.classList.toggle("right-ans", oi === res.answer); o.classList.toggle("wrong-ans", oi === answers[qi] && !res.correct); });
      const ex = $(".explain", box); ex.innerHTML = (res.correct ? "<b>✓ Correct.</b> " : "<b>✗ Not quite.</b> ") + res.explain; ex.classList.remove("hidden");
    });
    toast(`${r.score} of ${r.total} correct`); $("#pnext").classList.remove("hidden"); markChip("predict"); refreshSidebar();
  };
  if (saved) $("#pnext").classList.remove("hidden");
  const run = $("#runit");
  if (run) run.onclick = async () => {
    run.disabled = true; $("#out").innerHTML = `<h4>Output<span class="spinner"></span></h4>`;
    try { const r = await api("POST", base + "/predict/run"); $("#out").innerHTML = `<h4>Output</h4><pre class="output">${esc(r.output)}</pre>`; }
    catch (err) { $("#out").innerHTML = `<h4>Output</h4><pre class="output">${esc(err.message)}</pre>`; }
    run.disabled = false;
  };
}

/* --- review */
async function viewReview({left, right, L, nextBtn, base}) {
  const R = L.review;
  const draftKey = `review:${L.course.id}:${L.lesson.key}`;
  const saved = L.progress.steps.review && L.progress.steps.review.data;
  let comments = store.get(draftKey, null) || (saved && saved.comments) || [];
  left.innerHTML = `<h2>Review the PR</h2>${R.description}
    <p class="note">Click a line to comment. Pick a severity and a category, then say why in one line.</p>
    <div class="task px"><span class="label">Goal</span>${esc(R.goal)} There are <b>${R.issue_count}</b> planted issues.</div>
    <div id="rres">${saved ? `<p class="note">Last time you found <b>${saved.found} of ${saved.total}</b>. Submit again to see the full breakdown.</p>` : ""}</div>
    <p style="margin-top:12px"><button class="btn primary drop" id="submit">Submit review</button></p><div id="rnext" class="${saved ? "" : "hidden"}">${nextBtn}</div>`;
  right.innerHTML = `<div class="pr"><b>${esc(R.title)}</b> by <b>${R.author === "ai" ? "ai-agent" : "junior-dev"}</b><span class="badge">${R.author === "ai" ? "AI-generated" : "junior dev"}</span> · ${esc(R.file)}</div>
    <div class="codeview review" id="code">${paintCode(R.code)}</div>`;
  const code = $("#code");
  const opts = (v, list) => list.map(o => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("");
  function draw() {
    $$(".comment", code).forEach(c => c.remove());
    $$(".ln", code).forEach(l => l.classList.remove("flag"));
    comments.sort((a, b) => a.line - b.line).forEach((c, i) => {
      const ln = $(`.ln[data-l="${c.line}"]`, code); if (!ln) return;
      ln.classList.add("flag");
      const box = document.createElement("div"); box.className = "comment px"; box.dataset.i = i;
      box.innerHTML = `<div class="row"><b>Line ${c.line}</b><select data-f="severity">${opts(c.severity, ["blocker", "major", "nit"])}</select>
        <select data-f="category">${opts(c.category, ["correctness", "security", "scale", "reliability", "style"])}</select>
        <button class="btn small del" title="Delete comment">✕</button></div><textarea data-f="text" placeholder="Why is this a problem?">${esc(c.text)}</textarea>`;
      let after = ln; while (after.nextElementSibling && after.nextElementSibling.classList.contains("comment")) after = after.nextElementSibling;
      after.after(box);
    });
    store.set(draftKey, comments);
  }
  code.addEventListener("click", e => {
    if (e.target.closest(".comment")) { if (e.target.closest(".del")) { comments.splice(+e.target.closest(".comment").dataset.i, 1); draw(); } return; }
    const ln = e.target.closest(".ln"); if (!ln) return;
    comments.push({line: +ln.dataset.l, severity: "major", category: "correctness", text: ""}); draw();
    const box = $$(".comment", code).filter(b => comments[+b.dataset.i].line === +ln.dataset.l).at(-1);
    box && $("textarea", box).focus();
  });
  code.addEventListener("input", e => { const box = e.target.closest(".comment"); if (!box) return; comments[+box.dataset.i][e.target.dataset.f] = e.target.value; store.set(draftKey, comments); });
  code.addEventListener("change", e => { const box = e.target.closest(".comment"); if (!box) return; comments[+box.dataset.i][e.target.dataset.f] = e.target.value; store.set(draftKey, comments); });
  draw();
  $("#submit").onclick = async () => {
    if (!comments.length) return toast("Leave at least one comment first: click a line.");
    const r = await api("POST", base + "/review", {comments});
    const missed = r.issues.filter(x => !x.found), found = r.issues.filter(x => x.found);
    $("#rres").innerHTML = `<h3>Your score</h3><div class="score">
        <div><b>${r.found.blocker}/${r.total.blocker}</b>blockers</div><div><b>${r.found.major}/${r.total.major}</b>majors</div><div><b>${r.false_alarms.length}</b>false alarm${r.false_alarms.length === 1 ? "" : "s"}</div></div>
      ${found.map(x => `<details class="fold px"><summary>✓ Found · line ${x.issue.lines[0]} · ${x.issue.severity}${x.category_match ? "" : ` <span class="lock">you said ${esc(x.your_comment.category)}, it's ${x.issue.category}</span>`}</summary><div class="body"><b>${esc(x.issue.title)}.</b> ${x.issue.explanation}</div></details>`).join("")}
      ${missed.map(x => `<details class="fold px" open><summary>✗ Missed · line ${x.issue.lines[0]} · ${x.issue.severity}</summary><div class="body"><b>${esc(x.issue.title)}.</b> ${x.issue.explanation}</div></details>`).join("")}
      ${r.false_alarms.map(c => `<details class="fold px"><summary>False alarm · line ${c.line}</summary><div class="body">Nothing planted here. If you still think it's a problem, say why in the PR; reviewers can be wrong too.</div></details>`).join("")}
      <details class="fold px"><summary>Model review (how a Lead would write it)</summary><div class="body">${r.model_review}</div></details>
      ${r.teaching_comment ? `<details class="fold px"><summary>One comment, written for a junior</summary><div class="body">${r.teaching_comment}</div></details>` : ""}`;
    $$(".ln", code).forEach(l => l.classList.remove("missed", "found"));
    r.issues.forEach(x => { for (let n = x.issue.lines[0]; n <= x.issue.lines[1]; n++) { const ln = $(`.ln[data-l="${n}"]`, code); ln && ln.classList.add(x.found ? "found" : "missed"); } });
    $("#rnext").classList.remove("hidden"); markChip("review"); refreshSidebar();
  };
}

/* --- editor-backed steps (fix, prove) */
async function mountEditor({right, L, base, fileName, toolbarHtml, onRun}) {
  const file = L.files.find(f => f.name === fileName);
  const st = {name: fileName, base: file.mtime_ns, dirty: false, saving: null};
  right.innerHTML = `<div class="tool"><span class="file" title="${esc(L.exercise_dir)}/${esc(fileName)}">${esc(L.exercise_dir)}/${esc(fileName)}</span><span class="sync" id="sync">■ synced</span></div>
    <div id="banner"></div><div class="tool">${toolbarHtml}</div><div class="editor" id="editor"></div><div class="results" id="results"><p class="note">Press Run (or Ctrl+Enter) to check your code.</p></div>`;
  const sync = (cls, text) => { const s = $("#sync"); if (s) { s.className = "sync " + cls; s.textContent = text; } };
  async function save(force = false) {
    if (!st.dirty || !current) return;
    const content = current.editor.get();
    st.lastSent = content;
    sync("saving", "saving…");
    try {
      const r = await api("PUT", `${base}/files/${fileName}`, {content, base_mtime_ns: force ? null : st.base});
      st.base = r.mtime_ns; if (current.editor.get() === content) { st.dirty = false; sync("", "■ saved"); }
    } catch (err) {
      if (err.status === 409) showConflict(err.data.detail); else { sync("conflict", "save failed"); toast("Could not save: " + err.message); }
    }
  }
  function showConflict(d) {
    sync("conflict", "■ changed on disk");
    $("#banner").innerHTML = `<div class="banner"><b>${esc(fileName)} changed on disk</b> (your IDE?) while you had unsaved edits here.
      <button class="btn small" id="usedisk">Use the disk version</button><button class="btn small" id="keepmine">Keep mine (overwrite disk)</button></div>`;
    $("#usedisk").onclick = () => { st.dirty = false; st.base = d.mtime_ns; current.editor.set(d.content); $("#banner").innerHTML = ""; sync("", "■ synced"); };
    $("#keepmine").onclick = async () => { $("#banner").innerHTML = ""; st.dirty = true; await save(true); };
  }
  const saver = debounce(() => save(), 600);
  current.editor = await createEditor($("#editor"), {value: file.content, onChange: () => { st.dirty = true; sync("saving", "editing…"); saver(); }, onRun});
  current.save = saver; current.fileState = st;
  // Live sync from disk: the server pushes a Server-Sent Event when the file changes.
  current.es = new EventSource(base + "/watch");
  current.es.addEventListener("file", ev => {
    const d = JSON.parse(ev.data);
    if (d.name !== fileName || d.mtime_ns === st.base) return;
    // Our own save echoing back (it can arrive before the PUT response): not a conflict.
    if (d.content === st.lastSent || d.content === current.editor.get()) { st.base = d.mtime_ns; return; }
    if (st.dirty) return showConflict(d);
    st.base = d.mtime_ns; current.editor.set(d.content); sync("", "■ synced from disk");
  });
  if (L.starter_changed) {
    $("#banner").innerHTML = `<div class="banner"><b>The starter for this lesson was updated</b> since you started.
      <button class="btn small" id="viewstarter">View new starter</button><button class="btn small" id="resetstarter">Reset to it</button><button class="btn small" id="keepcode">Keep my code</button></div>`;
    $("#viewstarter").onclick = async () => { const s = await api("GET", `${base}/starter/${fileName}`); modal("New starter: " + fileName, `<div class="codeview">${paintCode(s.content)}</div>`); };
    $("#resetstarter").onclick = async () => { if (confirm("Replace your code with the new starter?")) { await resetFiles(null); $("#banner").innerHTML = ""; } };
    $("#keepcode").onclick = async () => { await api("POST", base + "/reset", {keep_mine: true}); $("#banner").innerHTML = ""; };
  }
  async function resetFiles(name) {
    const r = await api("POST", base + "/reset", {name});
    const f = r.files.find(x => x.name === fileName); st.dirty = false; st.base = f.mtime_ns; current.editor.set(f.content); sync("", "■ reset");
  }
  return {flush: async () => { saver.cancel(); await save(); }, resetFiles};
}

/* --- fix */
async function viewFix({left, right, L, nextBtn, base, done}) {
  const fixed = done("fix");
  let hintsShown = L.progress.hints_shown || 0;
  const sources = L.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${s.note ? ` <span class="note">(${esc(s.note)})</span>` : ""}</li>`).join("");
  left.innerHTML = `<h2>${esc(L.lesson.title)}</h2>
    <div class="task px"><span class="label">Task</span>${L.task}</div>
    <details class="fold px" id="hints" ${hintsShown ? "open" : ""}><summary>Hints <span class="lock" id="hintcount"></span></summary><div class="body"><div id="hintlist"></div><button class="btn small" id="morehint">Show a hint</button></div></details>
    ${L.best_practice ? `<details class="fold px" id="bp" ${fixed ? "open" : ""}><summary>Best practice <span class="lock ${fixed ? "on" : ""}" id="bplock">${fixed ? "unlocked ✓" : "unlocks when tests pass · open early"}</span></summary><div class="body md">${L.best_practice}</div></details>` : ""}
    ${L.stretch ? `<details class="fold px"><summary>Stretch <span class="lock">${L.progress.stretch_done ? "done ✓" : "optional · own tests"}</span></summary><div class="body md">${L.stretch}${L.has_stretch_tests ? '<p><button class="btn" id="runstretch">▶ Run stretch tests</button></p>' : ""}</div></details>` : ""}
    <details class="fold px"><summary>Concept recap</summary><div class="body md">${L.concept}</div></details>
    <details class="fold px"><summary>Read more</summary><div class="body"><ul>${sources}</ul></div></details>
    <div id="fnext" class="${fixed ? "" : "hidden"}">${nextBtn}</div>`;
  function drawHints() {
    $("#hintlist").innerHTML = L.hints.slice(0, hintsShown).map((h, i) => `<div class="explain"><b>Hint ${i + 1}.</b> ${h}</div>`).join("");
    $("#hintcount").textContent = `${hintsShown} of ${L.hints.length}`;
    $("#morehint").classList.toggle("hidden", hintsShown >= L.hints.length);
    $("#morehint").textContent = `Show hint ${hintsShown + 1}`;
  }
  const nextHint = () => { if (hintsShown >= L.hints.length) return toast("No more hints. Try Show solution."); hintsShown++; drawHints(); $("#hints").open = true; api("POST", base + "/hints", {shown: hintsShown}).catch(() => {}); };
  $("#morehint").onclick = nextHint; drawHints();

  let running = false;
  async function runTests(kind = "core") {
    if (running) return; running = true;
    const btn = kind === "core" ? $("#run") : $("#runstretch"); btn && (btn.disabled = true);
    $("#results").innerHTML = `<h4>Running ${kind === "core" ? "tests" : "stretch tests"}<span class="spinner"></span></h4>`;
    try {
      await ed.flush();
      const r = await api("POST", base + "/run", {kind});
      $("#results").innerHTML = checksHtml(r, kind === "core" ? "Tests" : "Stretch tests");
      if (r.ok && kind === "core") {
        markChip("fix"); $("#fnext").classList.remove("hidden");
        const bp = $("#bp"); if (bp && !bp.open) { bp.open = true; $("#bplock").textContent = "unlocked ✓"; $("#bplock").classList.add("on"); toast("All tests pass. Best practice unlocked."); }
        refreshSidebar();
      }
    } catch (err) { $("#results").innerHTML = `<h4><span class="bad">${esc(err.message)}</span></h4>`; }
    finally { running = false; btn && (btn.disabled = false); }
  }
  const ed = await mountEditor({right, L, base, fileName: L.entry_file, onRun: () => runTests("core"),
    toolbarHtml: `<button class="btn primary drop" id="run">▶ Run tests <small>Ctrl+Enter</small></button><button class="btn" id="hint">Hint</button><button class="btn" id="sol">Solution</button><button class="btn" id="reset">Reset</button>`});
  $("#run").onclick = () => runTests("core");
  const rs = $("#runstretch"); if (rs) rs.onclick = () => runTests("stretch");
  $("#hint").onclick = nextHint;
  $("#sol").onclick = async () => {
    if (!confirm("Show the reference solution? Try a hint first if you haven't.")) return;
    const s = await api("GET", `${base}/solution/${L.entry_file}`);
    modal("Reference solution: " + L.entry_file, `<div class="codeview">${paintCode(s.content)}</div>`);
  };
  $("#reset").onclick = async () => { if (confirm("Reset main code to the starter? Your changes will be lost.")) await ed.resetFiles(L.entry_file); };
}

/* --- prove */
async function viewProve({left, right, L, nextBtn, base, done}) {
  left.innerHTML = `<h2>Prove it</h2>${L.prove_task || ""}
    <div class="task px"><span class="label">Pass condition</span>Your test <b>fails</b> on the buggy PR <i>and</i> <b>passes</b> on the reference fix.</div>
    <div id="pres"></div><div id="pnext" class="${done("prove") ? "" : "hidden"}">${nextBtn}</div>`;
  async function prove() {
    $("#run").disabled = true; $("#results").innerHTML = `<h4>Running your test against both versions<span class="spinner"></span></h4>`;
    try {
      await ed.flush();
      const r = await api("POST", base + "/prove");
      const b = r.against_buggy, s = r.against_solution;
      $("#results").innerHTML = `<h4><span class="${r.ok ? "ok" : "bad"}">${r.ok ? "✓ Proven" : "✗ Not proven yet"}</span></h4><p>${esc(r.message)}</p>
        <div class="prove-grid"><div>On the buggy PR: <span class="${b.failed ? "good" : "badtxt"}">${b.failed ? "failed ✓ (good)" : "passed ✗"}</span></div>
        <div>On the reference fix: <span class="${s.ok ? "good" : "badtxt"}">${s.ok ? "passed ✓ (good)" : "failed ✗"}</span></div></div>
        ${checksHtml(b, "Against the buggy PR")}${s.ok ? "" : checksHtml(s, "Against the fix")}`;
      if (r.ok) { markChip("prove"); $("#pnext").classList.remove("hidden"); refreshSidebar(); }
    } catch (err) { $("#results").innerHTML = `<h4><span class="bad">${esc(err.message)}</span></h4>`; }
    $("#run").disabled = false;
  }
  const ed = await mountEditor({right, L, base, fileName: L.prove_file, onRun: prove,
    toolbarHtml: `<button class="btn primary drop" id="run">▶ Run my test <small>Ctrl+Enter</small></button><button class="btn" id="sol">Reference test</button><button class="btn" id="reset">Reset</button>`});
  $("#run").onclick = prove;
  $("#sol").onclick = async () => { const s = await api("GET", `${base}/solution/${L.prove_file}`); modal("Reference test", `<div class="codeview">${paintCode(s.content)}</div>`); };
  $("#reset").onclick = async () => { if (confirm("Reset your test file to the starter?")) await ed.resetFiles(L.prove_file); };
}

/* --- defend */
async function viewDefend({left, right, L, base, done}) {
  const key = q => `answer:${L.course.id}:${L.lesson.key}:${q}`;
  left.innerHTML = `<h2>Defend it</h2><p class="note">Answer out loud or in the box, like in an interview. Then compare with the model answer.</p>
    ${L.interview.map((q, i) => `<h3>Interview ${i + 1}</h3>${q.prompt}<textarea class="answer px" data-k="${i}" placeholder="Your answer…">${esc(store.get(key(i), ""))}</textarea>
      <details class="fold px"><summary>Reveal model answer</summary><div class="body md">${q.answer}</div></details>`).join("")}
    <div id="win"></div>`;
  $$("textarea.answer", left).forEach(t => t.addEventListener("input", () => store.set(key(t.dataset.k), t.value)));
  const sources = L.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
  right.innerHTML = `<div class="tool"><span class="label">Best practice</span></div><div class="scroll md">${L.best_practice || "<p class='note'>No best-practice notes for this lesson.</p>"}<h3>Read more</h3><ul>${sources}</ul></div>`;
  function drawWin(lp) {
    const missing = L.lesson.steps.filter(s => !(lp.steps[s] && lp.steps[s].done));
    const next = L.next ? `<a class="btn primary drop" href="#/learn/${L.course.id}/${L.next.module}/${L.next.lesson}">Next lesson ▸</a>` : `<a class="btn primary drop" href="#/">Home ▸</a>`;
    $("#win").innerHTML = lp.completed
      ? `<div class="win px">${sprite("mascot", 3)}<div style="flex:1"><span class="label">Lesson complete!</span><br>${L.lesson.steps.map(s => "✓ " + STEP_LABEL[s]).join(" · ")}</div>${next}</div>`
      : `<div class="win px" style="background:var(--panel-2)">${sprite("mascot", 3)}<div style="flex:1"><span class="label">Almost there</span><br>${missing.filter(s => s !== "defend").length ? "Still to do: " + missing.filter(s => s !== "defend").map(s => `<a href="${current.href(s)}">${STEP_LABEL[s]}</a>`).join(", ") : "Done reading? Finish the lesson."}</div><button class="btn primary drop" id="finish">I've answered these ✓</button></div>`;
    const f = $("#finish"); if (f) f.onclick = async () => { const p = await api("POST", base + "/steps/defend/done"); markChip("defend"); drawWin(p); refreshSidebar(); };
  }
  drawWin(L.progress);
}

/* ---------------------------------------------------------------- quiz + design pages */

async function renderQuiz(courseId, moduleId) {
  const [Q, course] = await Promise.all([api("GET", `/api/courses/${courseId}/modules/${moduleId}/quiz`), api("GET", `/api/courses/${courseId}`)]);
  app.innerHTML = `<div class="top"><span class="crumbs"><a href="#/">${esc(course.title)}</a> › ${esc(Q.module.title)} › <b>Quiz</b></span></div>
    <div class="layout wide-left">${courseSidebar(course, {quiz: moduleId})}<div class="left md" style="grid-column:span 2"><div style="max-width:760px">
    <div class="brandline">${sprite(Q.module.icon, 3)}<h2>${esc(Q.module.title)}: quiz</h2></div>
    ${Q.saved ? `<p class="note">Last score: <b>${Q.saved.score}/${Q.saved.total}</b>. Take it again any time.</p>` : ""}
    <form id="qf">${Q.questions.map((q, qi) => `<div class="question" data-q="${qi}"><div class="prompt">${q.prompt}</div>
      ${q.options.map((o, oi) => `<label class="opt"><input type="radio" name="q${qi}" value="${oi}">${o}</label>`).join("")}<div class="explain hidden"></div></div>`).join("")}
      <button class="btn primary drop">Check answers</button></form><div id="qres"></div></div></div></div>`;
  $("#qf").onsubmit = async e => {
    e.preventDefault();
    const answers = Q.questions.map((_, qi) => { const c = $(`input[name=q${qi}]:checked`); return c ? +c.value : null; });
    if (answers.includes(null)) return toast("Answer every question first.");
    const r = await api("POST", `/api/courses/${courseId}/modules/${moduleId}/quiz`, {answers});
    r.results.forEach((res, qi) => {
      const box = $(`.question[data-q="${qi}"]`);
      $$(".opt", box).forEach((o, oi) => { o.classList.toggle("right-ans", oi === res.answer); o.classList.toggle("wrong-ans", oi === answers[qi] && !res.correct); });
      const ex = $(".explain", box); ex.innerHTML = (res.correct ? "<b>✓</b> " : "<b>✗</b> ") + res.explain; ex.classList.remove("hidden");
    });
    $("#qres").innerHTML = `<div class="win px">${sprite("mascot", 3)}<div><span class="label">${r.score} / ${r.total}</span></div></div>`;
    const side = $(".side"); if (side) { const c = await api("GET", `/api/courses/${courseId}`); side.outerHTML = courseSidebar(c, {quiz: moduleId}); }
  };
}

async function renderDesign(courseId, moduleId) {
  const [D, course] = await Promise.all([api("GET", `/api/courses/${courseId}/modules/${moduleId}/design`), api("GET", `/api/courses/${courseId}`)]);
  const key = `design:${courseId}:${moduleId}`;
  app.innerHTML = `<div class="top"><span class="crumbs"><a href="#/">${esc(course.title)}</a> › ${esc(D.module.title)} › <b>System design</b></span></div>
    <div class="layout wide-left">${courseSidebar(course, {design: moduleId})}<div class="left md" style="grid-column:span 2"><div style="max-width:780px">
    ${D.question}<h3>Your design</h3><p class="note">Sketch requirements, design, trade-offs and failure modes before you look.</p>
    <textarea class="answer px" style="min-height:220px" id="mine">${esc(store.get(key, ""))}</textarea>
    ${D.answer ? `<details class="fold px"><summary>Reveal model answer</summary><div class="body md">${D.answer}</div></details>` : ""}</div></div></div>`;
  $("#mine").addEventListener("input", e => store.set(key, e.target.value));
}

/* ---------------------------------------------------------------- router */

async function route() {
  teardown();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === "learn" && parts.length >= 4) await renderLesson(parts[1], parts[2], parts[3], parts[4]);
    else if (parts[0] === "quiz" && parts.length === 3) await renderQuiz(parts[1], parts[2]);
    else if (parts[0] === "design" && parts.length === 3) await renderDesign(parts[1], parts[2]);
    else await renderHome();
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="center"><div class="panel px"><h2>Something went wrong</h2><p>${esc(err.message)}</p><p><a class="btn" href="#/">Home</a></p></div></div>`;
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", () => { if (current && current.save) current.save.flush(); });
route();
