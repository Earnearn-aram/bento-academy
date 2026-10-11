/* bento-academy front end. Plain JS, no build step.
   Routes:  #/                                   home
            #/learn/<course>/<module>/<lesson>/<step>
            #/quiz/<course>/<module>   #/design/<course>/<module>                       */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");  // plain text with `code`
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

/* Slide deck: one idea per page. Back/Next, dots, and the ← → keys. Remembers the last slide per page.
   slides: [{title, html, kind}]. Returns {el(i)} so callers can mount widgets into a slide. */
function deck(el, slides, {key, finalNote = ""}) {
  let i = Math.min(Math.max(+store.get("slide:" + key, 0) || 0, 0), slides.length - 1);
  el.innerHTML = `<div class="deck">
    <div class="deck-top"><span class="deck-count"></span><div class="dots">${slides.map((_, n) => `<button class="dot" data-n="${n}" aria-label="Slide ${n + 1}"></button>`).join("")}</div></div>
    <div class="deck-viewport"><div class="deck-track">${slides.map(s => { const story = s.kind === "story" || s.title === "The story";
      return `<section class="slide md">${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${story ? `<div class="story px">${s.html}</div>` : s.html}</section>`; }).join("")}</div></div>
    <div class="deck-nav"><button class="btn" data-prev>◀ Back</button><span class="spacer"></span><span class="note deck-final">${finalNote}</span><button class="btn primary" data-next>Next ▶</button></div></div>`;
  const track = $(".deck-track", el), viewport = $(".deck-viewport", el), secs = $$(".slide", el);
  function go(n) {
    i = Math.min(Math.max(n, 0), slides.length - 1);
    track.style.transform = `translateX(-${i * 100}%)`;
    viewport.style.height = secs[i].offsetHeight + "px";
    secs.forEach((s, k) => s.setAttribute("aria-hidden", k !== i));
    $$(".dot", el).forEach((d, k) => d.classList.toggle("on", k <= i));
    $(".deck-count", el).textContent = `${i + 1} / ${slides.length}`;
    $("[data-prev]", el).disabled = i === 0;
    $("[data-next]", el).classList.toggle("hidden", i === slides.length - 1);
    $(".deck-final", el).classList.toggle("hidden", i !== slides.length - 1);
    store.set("slide:" + key, i);
    const scroller = el.closest(".left"); if (scroller) scroller.scrollTop = 0;
  }
  $("[data-prev]", el).onclick = () => go(i - 1);
  $("[data-next]", el).onclick = () => go(i + 1);
  $$(".dot", el).forEach(d => d.onclick = () => go(+d.dataset.n));
  const onKey = e => {
    if (!document.body.contains(el)) return document.removeEventListener("keydown", onKey);
    if (e.target.closest("input,textarea,select,.monaco-editor")) return;
    if (e.key === "ArrowRight") go(i + 1); else if (e.key === "ArrowLeft") go(i - 1);
  };
  document.addEventListener("keydown", onKey);
  const ro = new ResizeObserver(() => { viewport.style.height = secs[i].offsetHeight + "px"; });
  secs.forEach(s => ro.observe(s));
  requestAnimationFrame(() => go(i));
  return {el: n => secs[n], resize: () => { viewport.style.height = secs[i].offsetHeight + "px"; }};
}

/* One question per slide. Each "Check" grades that question at once (gradeOne);
   when every question is answered, saveAll(answers) records the result. */
function questionSlides(prefix, questions) {
  return questions.map((q, qi) => ({
    title: `Quick check ${qi + 1} of ${questions.length}`, kind: "check",
    html: `<div class="question" id="${prefix}${qi}"><div class="prompt">${q.prompt}</div>
      ${q.options.map((o, oi) => `<label class="opt"><input type="radio" name="${prefix}${qi}" value="${oi}">${o}</label>`).join("")}
      <button class="btn primary" type="button" data-check>Check</button><div class="explain hidden"></div></div>`,
  }));
}
function wireQuestionSlides(prefix, questions, {saved, gradeOne, saveAll, onDone, resize}) {
  const answers = questions.map((_, qi) => (saved ? saved[qi] : null));
  const show = (qi, res, picked) => {
    const box = $("#" + prefix + qi);
    $$(".opt", box).forEach((o, oi) => { o.classList.toggle("right-ans", oi === res.answer); o.classList.toggle("wrong-ans", oi === picked && !res.correct); });
    const ex = $(".explain", box); ex.innerHTML = (res.correct ? "<b>✓ Correct.</b> " : "<b>✗ Not quite.</b> ") + res.explain; ex.classList.remove("hidden");
    resize && resize();
  };
  questions.forEach((_, qi) => {
    const box = $("#" + prefix + qi);
    if (saved && saved[qi] != null) { const r = $(`input[value="${saved[qi]}"]`, box); if (r) r.checked = true; }
    $("[data-check]", box).onclick = async () => {
      const c = $(`input[name=${prefix}${qi}]:checked`, box);
      if (!c) return toast("Pick an answer first.");
      answers[qi] = +c.value;
      show(qi, await gradeOne(qi, answers[qi]), answers[qi]);
      if (!answers.includes(null)) { const r = await saveAll(answers); onDone && onDone(r); }
    };
  });
}

function courseSidebar(course, here) {
  let out = "";
  for (const m of course.modules) {
    out += `<h4>${sprite(m.icon, 1)}${esc(m.title)}</h4>`;
    if (m.has_intro) out += `<a class="extra ${here && here.intro === m.id ? "cur" : ""}" href="#/intro/${course.id}/${m.id}"><span class="box ${m.intro_done ? "done" : ""}">${m.intro_done ? "✓" : ""}</span>Introduction</a>`;
    for (const l of m.lessons) {
      const cur = here && here.module === m.id && here.lesson === l.id;
      out += `<a class="${cur ? "cur" : ""}" href="#/learn/${course.id}/${m.id}/${l.id}"><span class="box ${l.done ? "done" : ""}">${l.done ? "✓" : ""}</span>${esc(l.title)}${l.bonus_done ? '<span class="star" title="Bonus steps done">⭐</span>' : ""}${l.updated ? '<span class="upd" title="This lesson changed since you finished it">updated</span>' : ""}</a>`;
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

/* ---------------------------------------------------------------- glossary
   The first use of a glossary term in each slide (or box marked .gl-scope) gets a dotted
   underline; hover, focus or tap it for the plain meaning. Terms come from glossary.toml. */

const glossary = {course: null, terms: [], re: null};
async function loadGlossary(courseId) {
  if (!courseId || glossary.course === courseId) return;
  glossary.course = courseId; glossary.terms = []; glossary.re = null;
  try { glossary.terms = await api("GET", `/api/courses/${courseId}/glossary`); } catch { return; }
  const index = new Map();
  glossary.terms.forEach((t, i) => [t.term, ...t.aliases].forEach(w => {
    index.set(w, i);
    // Lower-case words also match at the start of a sentence; CAPS words (GET, API) match only as written.
    if (w === w.toLowerCase() && /^[a-z]/.test(w)) index.set(w[0].toUpperCase() + w.slice(1), i);
  }));
  const words = [...index.keys()].sort((a, b) => b.length - a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  glossary.index = index;
  glossary.re = words.length ? new RegExp(`(?<![\\w/{.-])(${words.join("|")})(?![\\w}-])`, "g") : null;
}
const GL_SKIP = "code,pre,a,button,h1,h2,textarea,input,select,summary,.gl,.codeview,.label";
function glossify(root) {
  if (!glossary.re) return;
  for (const scope of $$(".slide, .gl-scope", root)) {
    if (scope.dataset.gl) continue; scope.dataset.gl = "1";
    const seen = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {acceptNode: n =>
      n.parentElement.closest(GL_SKIP) || (n.parentElement.closest(".slide, .gl-scope") !== scope) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue; glossary.re.lastIndex = 0;
      let m, last = 0; const frag = document.createDocumentFragment();
      while ((m = glossary.re.exec(text))) {
        const i = glossary.index.get(m[1]);
        if (seen.has(i)) continue; seen.add(i);
        frag.append(text.slice(last, m.index));
        const span = document.createElement("span"); span.className = "gl"; span.tabIndex = 0; span.dataset.t = i; span.textContent = m[1];
        frag.append(span); last = m.index + m[1].length;
      }
      if (last) { frag.append(text.slice(last)); node.replaceWith(frag); }
    }
  }
}
function glossPop(span) {
  let pop = $("#glpop");
  if (!span) { pop && pop.remove(); return; }
  const t = glossary.terms[+span.dataset.t]; if (!t) return;
  if (!pop) { pop = document.createElement("div"); pop.id = "glpop"; pop.className = "glpop px"; pop.setAttribute("role", "tooltip"); document.body.appendChild(pop); }
  pop.innerHTML = `<b>${esc(t.term)}</b><p>${esc(t.plain)}</p>${t.analogy ? `<p class="an">Like: ${esc(t.analogy)}</p>` : ""}${t.example ? `<pre>${esc(t.example)}</pre>` : ""}`;
  const r = span.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
  pop.style.width = w + "px";
  pop.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + "px";
  const below = r.bottom + 8, h = pop.offsetHeight;
  pop.style.top = (below + h < innerHeight - 8 ? below : Math.max(8, r.top - h - 8)) + "px";
}
document.addEventListener("mouseover", e => { const s = e.target.closest(".gl"); if (s) glossPop(s); else if (!e.target.closest("#glpop") && $("#glpop") && !$("#glpop").dataset.pinned) glossPop(null); });
document.addEventListener("focusin", e => { const s = e.target.closest(".gl"); if (s) glossPop(s); });
document.addEventListener("focusout", e => { if (e.target.closest(".gl")) glossPop(null); });
document.addEventListener("click", e => {  // tap support for touch screens
  const s = e.target.closest(".gl");
  if (s) { glossPop(s); $("#glpop").dataset.pinned = "1"; } else if (!e.target.closest("#glpop")) glossPop(null);
});
document.addEventListener("scroll", () => glossPop(null), true);

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
        const l = firstOpen(m);
        const href = m.has_intro && !m.intro_done ? `#/intro/${c.id}/${m.id}` : l ? `#/learn/${c.id}/${m.id}/${l.id}` : "#/";
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
  const bonus = s => (L.lesson.optional_steps || []).includes(s);
  const nextLesson = L.next ? `<a class="btn primary drop" href="#/learn/${courseId}/${L.next.module}/${L.next.lesson}">Next lesson: ${esc(L.next.title)} ▸</a>` : `<a class="btn primary drop" href="#/">Home ▸</a>`;

  app.innerHTML = `
    <div class="top">
      <span class="crumbs"><a href="#/">${esc(L.course.title)}</a> › ${esc(L.module.title)} › <b>${esc(L.lesson.title)}</b></span>
      <span class="spacer"></span>
      <div class="steps">${steps.map(s => `<a class="step ${s === step ? "cur" : done(s) ? "done" : ""} ${bonus(s) ? "bonus" : ""}" href="${href(s)}" ${bonus(s) ? 'title="Bonus step: optional"' : ""}>${STEP_LABEL[s]}${bonus(s) ? "<small>⭐ bonus</small>" : ""}</a>`).join("")}</div>
    </div>
    <div class="layout">${courseSidebar(course, {module: moduleId, lesson: lessonId})}<div class="left md" id="left"></div><div class="right" id="right"></div></div>`;
  const left = $("#left"), right = $("#right");
  current = {base, L, courseId, moduleId, lessonId, step, href};
  // After the last required step the lesson is complete: offer the bonus step and the next lesson side by side.
  const nextBtn = !nextStep ? `<p style="margin-top:22px">${nextLesson}</p>`
    : bonus(nextStep) ? `<div class="win px" style="margin-top:22px">${sprite("mascot", 3)}<div style="flex:1"><span class="label">Lesson complete!</span><br>Want more? <b>${STEP_LABEL[nextStep]}</b> is a bonus step: optional, for extra depth.</div></div>
        <p style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">${nextLesson}<a class="btn drop" href="${href(nextStep)}">⭐ Bonus: ${STEP_LABEL[nextStep]} ▸</a></p>`
    : `<p style="margin-top:22px"><a class="btn primary drop" href="${href(nextStep)}">Next: ${STEP_LABEL[nextStep]} ▸</a></p>`;
  const views = {concept: viewConcept, predict: viewPredict, review: viewReview, fix: viewFix, prove: viewProve, defend: viewDefend};
  await views[step]({left, right, L, nextBtn, base, href, done, bonus});
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
  const introNudge = L.module_intro.has && !L.module_intro.done
    ? `<div class="banner-card px">New to <b>${esc(L.module.title)}</b>? Read the <a href="#/intro/${L.course.id}/${L.module.id}">module introduction</a> first: the story and why it matters.</div>` : "";
  const saved = L.progress.steps.concept && L.progress.steps.concept.data.answers;
  const slides = L.slides.slice();
  slides.push(...questionSlides("cq", L.check));
  slides.push({title: "Next up", html: `<p>You've got the idea. Now use it: predict what some code does, then review a real PR.</p><div id="cnext" class="${L.check.length && !saved ? "hidden" : ""}">${nextBtn}</div>${L.check.length && !saved ? `<p class="note" id="cwait">Answer the quick checks on the previous slides to continue.</p>` : ""}`, kind: "end"});
  left.innerHTML = introNudge + `<div id="deck"></div>`;
  const d = deck($("#deck"), slides, {key: `${L.course.id}:${L.lesson.key}:concept`});
  if (L.check.length) wireQuestionSlides("cq", L.check, {saved, resize: () => d.resize(),
    gradeOne: (qi, answer) => api("POST", `${base}/check/${qi}`, {answer}),
    saveAll: answers => api("POST", base + "/check", {answers}),
    onDone: () => { $("#cnext").classList.remove("hidden"); const w = $("#cwait"); w && w.remove(); d.resize(); markChip("concept"); refreshSidebar(); }});
  const labels = {concept: "Read the story, the idea and a worked example, then answer a quick check.", predict: "Guess what some code does, then run it.",
    review: "Review a pull request and flag what's wrong.", fix: "Fix the code until the tests pass.",
    prove: "Write one test that catches the bug.", defend: "Answer senior interview questions."};
  right.innerHTML = `<div class="scroll md mission"><h2>${esc(L.lesson.title)}</h2><p class="note">${esc(L.lesson.summary)} · about ${L.lesson.minutes} min</p>
    <div class="task px gl-scope"><span class="label">Your mission</span>${L.task}</div>
    <h3>How this lesson works</h3><ol class="gl-scope">${L.lesson.steps.map(s => `<li><b>${STEP_LABEL[s]}</b>${(L.lesson.optional_steps || []).includes(s) ? " ⭐ <i>bonus</i>" : ""}: ${labels[s]}</li>`).join("")}</ol>
    <div class="bubble">${sprite("mascot", 3)}<div class="say px">Your code lives in <code>${esc(L.exercise_dir)}/</code>. Edit it here or in your own IDE; both stay in sync.</div></div></div>`;
  if (!L.check.length && !(L.progress.steps.concept && L.progress.steps.concept.done)) {
    api("POST", base + "/steps/concept/done").then(() => { markChip("concept"); refreshSidebar(); }).catch(() => {});
  }
}

/* --- predict */
async function viewPredict({left, right, L, nextBtn, base}) {
  const P = L.predict;
  const saved = L.progress.steps.predict && L.progress.steps.predict.data.answers;
  left.innerHTML = `<h2>Predict</h2><div class="gl-scope">${P.intro}</div><form id="pf" class="gl-scope">${P.questions.map((q, qi) => `
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
// Plain words for the review labels. The value is what review.toml and the grader use.
const SEVERITY = [
  {v: "blocker", label: "🔴 Must fix", desc: "Breaks things for users, loses data or is unsafe. The PR can't be merged until it's fixed."},
  {v: "major", label: "🟠 Should fix", desc: "A real bug or risk, but not an emergency. Fix it in this PR if you can."},
  {v: "nit", label: "⚪ Nice to have", desc: "A small tidy-up: naming, wording, style. Fine to merge without it."},
];
const CATEGORY = [
  {v: "not_sure", label: "Not sure", desc: "That's fine. Finding the right line is what counts; the feedback will tell you the kind."},
  {v: "correctness", label: "Wrong result", desc: "The code gives the wrong answer or the wrong status code."},
  {v: "security", label: "Unsafe", desc: "Someone could abuse it, see data they shouldn't, or damage data."},
  {v: "scale", label: "Breaks with many users", desc: "Fine for one user, falls over with many (slow, blocks others, runs out of memory)."},
  {v: "reliability", label: "Crashes or fails sometimes", desc: "Works on the happy path, breaks when something unexpected happens (missing item, retry, timeout)."},
  {v: "style", label: "Hard to read", desc: "Works, but the next person will struggle to understand or change it."},
];
const sevLabel = v => (SEVERITY.find(x => x.v === v) || {label: v}).label;
const catLabel = v => (CATEGORY.find(x => x.v === v) || {label: v}).label;
const howToReview = `<ol class="howto">
    <li><b>Read</b> the PR description: what is it trying to do?</li>
    <li><b>Read the code</b> on the right. Ask: what happens with a missing id, a duplicate, or the same request twice?</li>
    <li><b>Click the line</b> that looks wrong. A comment box opens.</li>
    <li>Pick <b>how bad</b> it is and, if you can, <b>what kind</b> of problem. "Not sure" is fine.</li>
    <li>Write <b>one line</b> saying why, then press <b>Submit review</b>.</li></ol>
  <h4>How bad is it?</h4><dl class="legend">${SEVERITY.map(x => `<dt>${x.label}</dt><dd>${x.desc}</dd>`).join("")}</dl>
  <h4>What kind of problem?</h4><dl class="legend">${CATEGORY.slice(1).map(x => `<dt>${x.label}</dt><dd>${x.desc}</dd>`).join("")}</dl>`;

async function viewReview({left, right, L, nextBtn, base}) {
  const R = L.review;
  const draftKey = `review:${L.course.id}:${L.lesson.key}`;
  const saved = L.progress.steps.review && L.progress.steps.review.data;
  let comments = (store.get(draftKey, null) || (saved && saved.comments) || []).map(c => ({severity: "major", category: "not_sure", text: "", ...c}));
  const firstTime = !store.get("seen:howto", false); store.set("seen:howto", true);
  left.innerHTML = `<h2>Review the PR</h2><div class="gl-scope">${R.description}</div>
    <details class="fold px" id="howto" ${firstTime ? "open" : ""}><summary>❓ How to review</summary><div class="body gl-scope">${howToReview}</div></details>
    <div class="task px gl-scope"><span class="label">Goal</span>${inline(R.goal)}${/problem/i.test(R.goal) ? "" : ` There ${R.issue_count === 1 ? "is <b>1</b> problem" : `are <b>${R.issue_count}</b> problems`} to find.`}</div>
    ${R.hint ? `<p><button class="btn small" id="rhint">💡 Hint</button></p><div class="explain hidden gl-scope" id="rhinttext"><b>Hint.</b> ${R.hint}</div>` : ""}
    <div id="rres">${saved ? `<p class="note">Last time you found <b>${saved.found} of ${saved.total}</b>. Submit again to see the full breakdown.</p>` : ""}</div>
    <p style="margin-top:12px"><button class="btn primary drop" id="submit">Submit review</button></p><div id="rnext" class="${saved ? "" : "hidden"}">${nextBtn}</div>`;
  right.innerHTML = `<div class="pr"><b>${esc(R.title)}</b> by <b>${R.author === "ai" ? "ai-agent" : "junior-dev"}</b><span class="badge">${R.author === "ai" ? "AI-generated" : "junior dev"}</span> · ${esc(R.file)}</div>
    <div class="codeview review" id="code">${paintCode(R.code)}</div>`;
  const rh = $("#rhint"); if (rh) rh.onclick = () => { $("#rhinttext").classList.remove("hidden"); rh.remove(); };
  const code = $("#code");
  const pills = (field, value, list) => `<div class="pills" role="radiogroup">${list.map(o =>
    `<button type="button" class="pill ${o.v === value ? "on" : ""}" data-f="${field}" data-v="${o.v}" role="radio" aria-checked="${o.v === value}" title="${esc(o.desc)}">${o.label}</button>`).join("")}</div>`;
  const descOf = c => `${esc((SEVERITY.find(x => x.v === c.severity) || {}).desc || "")} ${c.category !== "not_sure" ? `<br><b>${catLabel(c.category)}:</b> ${esc((CATEGORY.find(x => x.v === c.category) || {}).desc || "")}` : ""}`;
  function draw() {
    $$(".comment", code).forEach(c => c.remove());
    $$(".ln", code).forEach(l => l.classList.remove("flag"));
    comments.sort((a, b) => a.line - b.line).forEach((c, i) => {
      const ln = $(`.ln[data-l="${c.line}"]`, code); if (!ln) return;
      ln.classList.add("flag");
      const box = document.createElement("div"); box.className = "comment px"; box.dataset.i = i;
      box.innerHTML = `<div class="row"><b>Line ${c.line}</b><span class="spacer"></span><button class="btn small del" title="Delete comment">✕</button></div>
        <div class="q">How bad is it?</div>${pills("severity", c.severity, SEVERITY)}
        <div class="q">What kind of problem? <span class="note">(optional)</span></div>${pills("category", c.category, CATEGORY)}
        <p class="desc">${descOf(c)}</p>
        <textarea data-f="text" placeholder="Why is this a problem? One line is enough.">${esc(c.text)}</textarea>`;
      let after = ln; while (after.nextElementSibling && after.nextElementSibling.classList.contains("comment")) after = after.nextElementSibling;
      after.after(box);
    });
    store.set(draftKey, comments);
  }
  code.addEventListener("click", e => {
    const box = e.target.closest(".comment");
    if (box) {
      const c = comments[+box.dataset.i];
      if (e.target.closest(".del")) { comments.splice(+box.dataset.i, 1); draw(); return; }
      const pill = e.target.closest(".pill");
      if (pill) {
        c[pill.dataset.f] = pill.dataset.v; store.set(draftKey, comments);
        $$(`.pill[data-f="${pill.dataset.f}"]`, box).forEach(p => { const on = p === pill; p.classList.toggle("on", on); p.setAttribute("aria-checked", on); });
        $(".desc", box).innerHTML = descOf(c);
      }
      return;
    }
    const ln = e.target.closest(".ln"); if (!ln) return;
    comments.push({line: +ln.dataset.l, severity: "major", category: "not_sure", text: ""}); draw();
    const nb = $$(".comment", code).filter(b => comments[+b.dataset.i].line === +ln.dataset.l).at(-1);
    nb && $("textarea", nb).focus();
  });
  code.addEventListener("input", e => { const box = e.target.closest(".comment"); if (!box) return; comments[+box.dataset.i][e.target.dataset.f] = e.target.value; store.set(draftKey, comments); });
  draw();
  $("#submit").onclick = async () => {
    if (!comments.length) return toast("Leave at least one comment first: click a line.");
    const r = await api("POST", base + "/review", {comments});
    const missed = r.issues.filter(x => !x.found), found = r.issues.filter(x => x.found);
    const kindNote = x => {
      const yours = x.your_comment.category;
      if (x.category_match) return ` <span class="lock on">${catLabel(yours)} ✓</span>`;
      if (yours === "not_sure") return ` <span class="lock">kind: ${catLabel(x.issue.category)}</span>`;
      return ` <span class="lock">you said ${catLabel(yours)}; it's ${catLabel(x.issue.category)}</span>`;
    };
    const total = r.issues.length;
    $("#rres").innerHTML = `<h3>Your score</h3><div class="score">
        <div><b>${found.length}/${total}</b>problem${total === 1 ? "" : "s"} found</div>
        ${r.total.blocker ? `<div><b>${r.found.blocker}/${r.total.blocker}</b>must-fix</div>` : ""}
        <div><b>${r.false_alarms.length}</b>false alarm${r.false_alarms.length === 1 ? "" : "s"}</div></div>
      ${found.map(x => `<details class="fold px"><summary>✓ Found · line ${x.issue.lines[0]} · ${sevLabel(x.issue.severity)}${kindNote(x)}</summary><div class="body"><b>${esc(x.issue.title)}.</b> ${x.issue.explanation}</div></details>`).join("")}
      ${missed.map(x => `<details class="fold px" open><summary>✗ Missed · line ${x.issue.lines[0]} · ${sevLabel(x.issue.severity)} · ${catLabel(x.issue.category)}</summary><div class="body"><b>${esc(x.issue.title)}.</b> ${x.issue.explanation}</div></details>`).join("")}
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
    <div class="task px gl-scope"><span class="label">Task</span>${L.task}</div>
    ${L.lesson.goals.length ? `<div class="goals px"><span class="label">Goals · one at a time</span><ol id="goals">${L.lesson.goals.map(g => `<li data-g="${esc(g.id)}"><span class="box"></span><span class="gl-scope">${inline(g.text)}</span></li>`).join("")}</ol></div>` : ""}
    <details class="fold px" id="hints" ${hintsShown ? "open" : ""}><summary>Hints <span class="lock" id="hintcount"></span></summary><div class="body"><div id="hintlist"></div><button class="btn small" id="morehint">Show a hint</button></div></details>
    ${L.best_practice ? `<details class="fold px" id="bp" ${fixed ? "open" : ""}><summary>Senior notes <span class="lock ${fixed ? "on" : ""}" id="bplock">${fixed ? "unlocked ✓" : "optional · open any time"}</span></summary><div class="body md">${L.best_practice}</div></details>` : ""}
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
  // Tick goals off from the last test run; highlight the first unfinished one.
  function goalResults(run) {
    const state = L.lesson.goals.map(g => { const cs = run.checks.filter(c => c.goal === g.id); return {g, cs, ok: cs.length > 0 && cs.every(c => c.outcome === "passed")}; });
    const next = state.find(x => !x.ok);
    state.forEach(x => { const li = $(`#goals li[data-g="${x.g.id}"]`); if (!li) return; li.classList.toggle("done", x.ok); li.classList.toggle("next", x === next); $(".box", li).textContent = x.ok ? "✓" : ""; });
    if (run.error && !run.checks.length) return checksHtml(run);
    const ungrouped = run.checks.filter(c => !c.goal && c.outcome !== "passed");
    const head = next
      ? `<div class="nextgoal px"><span class="label">Next goal ${state.indexOf(next) + 1} of ${state.length}</span><div>${inline(next.g.text)}</div></div>${checksHtml({...run, checks: next.cs.concat(ungrouped), passed: next.cs.filter(c => c.outcome === "passed").length, failed: next.cs.filter(c => c.outcome !== "passed").length + ungrouped.length}, "Tests for this goal")}`
      : run.ok ? `<div class="nextgoal px ok-goal"><span class="label">All goals done ✓</span><div>Every test passes.</div></div>` : checksHtml(run);
    return `${head}<details class="fold px"><summary>All ${run.passed + run.failed} tests · ${run.passed} passed</summary><div class="body">${checksHtml(run)}</div></details>`;
  }
  if (fixed) L.lesson.goals.forEach(g => { const li = $(`#goals li[data-g="${g.id}"]`); if (li) { li.classList.add("done"); $(".box", li).textContent = "✓"; } });
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
      $("#results").innerHTML = kind === "core" && L.lesson.goals.length ? goalResults(r) : checksHtml(r, kind === "core" ? "Tests" : "Stretch tests");
      if (r.ok && kind === "core") {
        markChip("fix"); $("#fnext").classList.remove("hidden");
        const bp = $("#bp"); if (bp && !bp.open) { bp.open = true; $("#bplock").textContent = "unlocked ✓"; $("#bplock").classList.add("on"); toast("All tests pass. Senior notes unlocked."); }
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
  left.innerHTML = `<h2>Prove it <span class="tag">⭐ bonus</span></h2><div class="gl-scope">${L.prove_task || ""}</div>
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
  left.innerHTML = `<h2>Defend it <span class="tag">⭐ bonus</span></h2><p class="note">Answer out loud or in the box, like in an interview. Then compare with the model answer.</p>
    ${L.interview.map((q, i) => `<h3>Interview ${i + 1}</h3>${q.prompt}<textarea class="answer px" data-k="${i}" placeholder="Your answer…">${esc(store.get(key(i), ""))}</textarea>
      <details class="fold px"><summary>Reveal model answer</summary><div class="body md">${q.answer}</div></details>`).join("")}
    <div id="win"></div>`;
  $$("textarea.answer", left).forEach(t => t.addEventListener("input", () => store.set(key(t.dataset.k), t.value)));
  const sources = L.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("");
  right.innerHTML = `<div class="tool"><span class="label">Senior notes (optional)</span></div><div class="scroll md">${L.best_practice || "<p class='note'>No best-practice notes for this lesson.</p>"}<h3>Read more</h3><ul>${sources}</ul></div>`;
  function drawWin(lp) {
    const optional = L.lesson.optional_steps || [];
    const missing = L.lesson.steps.filter(s => !(lp.steps[s] && lp.steps[s].done) && !optional.includes(s));
    const next = L.next ? `<a class="btn primary drop" href="#/learn/${L.course.id}/${L.next.module}/${L.next.lesson}">Next lesson ▸</a>` : `<a class="btn primary drop" href="#/">Home ▸</a>`;
    const defended = !!(lp.steps.defend && lp.steps.defend.done);
    const ticks = L.lesson.steps.map(s => `${lp.steps[s] && lp.steps[s].done ? "✓" : "·"} ${STEP_LABEL[s]}${optional.includes(s) ? " ⭐" : ""}`).join(" · ");
    $("#win").innerHTML = (lp.completed
      ? `<div class="win px">${sprite("mascot", 3)}<div style="flex:1"><span class="label">Lesson complete!</span><br>${ticks}</div>${next}</div>`
      : `<div class="win px" style="background:var(--panel-2)">${sprite("mascot", 3)}<div style="flex:1"><span class="label">Almost there</span><br>Still to do: ${missing.map(s => `<a href="${current.href(s)}">${STEP_LABEL[s]}</a>`).join(", ")}</div></div>`)
      + (defended ? "" : `<p style="margin-top:10px"><button class="btn drop" id="finish">⭐ I've answered these</button></p>`);
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

async function renderIntro(courseId, moduleId) {
  const [I, course] = await Promise.all([api("GET", `/api/courses/${courseId}/modules/${moduleId}/intro`), api("GET", `/api/courses/${courseId}`)]);
  const start = I.first_lesson ? `<a class="btn primary drop" href="#/learn/${courseId}/${I.first_lesson.module}/${I.first_lesson.lesson}">Start: ${esc(I.first_lesson.title)} ▸</a>` : `<a class="btn" href="#/">Lessons coming soon · Home</a>`;
  app.innerHTML = `<div class="top"><span class="crumbs"><a href="#/">${esc(course.title)}</a> › ${esc(I.module.title)} › <b>Introduction</b></span></div>
    <div class="layout wide-left">${courseSidebar(course, {intro: moduleId})}<div class="left md" style="grid-column:span 2"><div class="reading">
    <div class="brandline">${sprite(I.module.icon, 3)}<h2>${esc(I.module.title)}</h2></div><div id="ideck" style="margin-top:14px"></div></div></div></div>`;
  const islides = I.slides.slice();
  islides.push(...questionSlides("iq", I.questions));
  islides.push({title: "Ready?", html: `<p>That's the big picture. Each lesson now adds one small box to it.</p><div id="inext" class="${I.questions.length && !I.saved ? "hidden" : ""}">${start}</div>${I.questions.length && !I.saved ? `<p class="note" id="iwait">Answer the quick checks on the previous slides first.</p>` : ""}`, kind: "end"});
  const d = deck($("#ideck"), islides, {key: `${courseId}:${moduleId}:intro`});
  const done = async () => { $("#inext").classList.remove("hidden"); const w = $("#iwait"); w && w.remove(); d.resize(); const side = $(".side"); if (side) side.outerHTML = courseSidebar(await api("GET", `/api/courses/${courseId}`), {intro: moduleId}); };
  if (I.questions.length) wireQuestionSlides("iq", I.questions, {saved: I.saved && I.saved.answers, resize: () => d.resize(),
    gradeOne: (qi, answer) => api("POST", `/api/courses/${courseId}/modules/${moduleId}/intro/${qi}`, {answer}),
    saveAll: answers => api("POST", `/api/courses/${courseId}/modules/${moduleId}/intro`, {answers}), onDone: done});
  else if (!I.saved) api("POST", `/api/courses/${courseId}/modules/${moduleId}/intro`, {answers: []}).then(done).catch(() => {});
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
  teardown(); glossPop(null);
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  // Full-height work screens hide the decorative strips; CSS reads this flag.
  document.body.dataset.view = ["learn", "quiz", "design", "intro"].includes(parts[0]) ? "lesson" : "home";
  try {
    if (parts[0] !== "" && parts[1]) await loadGlossary(parts[1]);
    if (parts[0] === "learn" && parts.length >= 4) await renderLesson(parts[1], parts[2], parts[3], parts[4]);
    else if (parts[0] === "quiz" && parts.length === 3) await renderQuiz(parts[1], parts[2]);
    else if (parts[0] === "design" && parts.length === 3) await renderDesign(parts[1], parts[2]);
    else if (parts[0] === "intro" && parts.length === 3) await renderIntro(parts[1], parts[2]);
    else await renderHome();
    glossify(app);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="center"><div class="panel px"><h2>Something went wrong</h2><p>${esc(err.message)}</p><p><a class="btn" href="#/">Home</a></p></div></div>`;
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("beforeunload", () => { if (current && current.save) current.save.flush(); });
route();
