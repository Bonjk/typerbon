/**
 * app.js — 學生打字練習主邏輯
 */

// ── STATE ─────────────────────────────────────────────────
const state = {
  studentId: null,
  currentArticle: null,

  // typing session
  startTime: null,
  timerInterval: null,
  elapsed: 0,
  isRunning: false,
  isFinished: false,

  // per-letter stats: { a: { correct: 0, total: 0 }, ... }
  letterStats: {},
  totalTyped: 0,
  totalCorrect: 0,
};

// ── DOM REFS ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const savedId = sessionStorage.getItem("typedojo_student");
  if (savedId) {
    loginAs(savedId);
  }

  $("btn-login").addEventListener("click", handleLogin);
  $("student-id").addEventListener("keydown", e => {
    if (e.key === "Enter") handleLogin();
  });
  $("btn-logout").addEventListener("click", handleLogout);

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Typing
  $("typing-input").addEventListener("input", handleTypingInput);
  $("btn-restart").addEventListener("click", restartSession);
  $("btn-cancel").addEventListener("click", cancelSession);
  $("btn-retry").addEventListener("click", () => {
    showTypingArea(state.currentArticle);
  });
  $("btn-choose-another").addEventListener("click", () => {
    $("typing-area").style.display = "none";
    $("result-card").style.display = "none";
    renderArticleList();
  });
});

// ── LOGIN ─────────────────────────────────────────────────
function handleLogin() {
  const raw = $("student-id").value.trim();
  const err = validateStudentId(raw);
  if (err) {
    $("login-error").textContent = err;
    return;
  }
  $("login-error").textContent = "";
  loginAs(raw);
}

function loginAs(id) {
  state.studentId = id;
  sessionStorage.setItem("typedojo_student", id);

  $("nav-student-id").textContent = `班級座號：${id}`;
  $("screen-login").classList.remove("active");
  $("screen-app").style.display = "block";

  renderArticleList();
  renderHistory();
}

function handleLogout() {
  sessionStorage.removeItem("typedojo_student");
  state.studentId = null;
  state.currentArticle = null;
  $("screen-app").style.display = "none";
  $("screen-login").classList.add("active");
  $("student-id").value = "";
  cancelSession();
}

// ── TABS ─────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name)
  );
  document.querySelectorAll(".tab-content").forEach(c =>
    c.classList.toggle("active", c.id === `tab-${name}`)
  );
  if (name === "history") renderHistory();
}

// ── ARTICLE LIST ─────────────────────────────────────────
function renderArticleList() {
  const articles = ArticleStore.getAll();
  const container = $("article-list");
  container.innerHTML = "";

  $("article-list").closest(".article-selector").style.display = "block";

  articles.forEach(article => {
    const card = document.createElement("div");
    card.className = "article-card";

    const wordCount = countWords(article.content);
    const diffLabel = { easy: "初級", medium: "中級", hard: "高級" }[article.difficulty] || article.difficulty;
    const diffClass = `badge-${article.difficulty}`;

    card.innerHTML = `
      <div class="article-card-title">${escHtml(article.title)}</div>
      <div class="article-card-meta">
        <span class="badge ${diffClass}">${diffLabel}</span>
        <span>${wordCount} 個字</span>
      </div>
    `;
    card.addEventListener("click", () => {
      $("article-list").closest(".article-selector").style.display = "none";
      $("result-card").style.display = "none";
      showTypingArea(article);
    });
    container.appendChild(card);
  });
}

// ── TYPING SESSION ─────────────────────────────────────────
function showTypingArea(article) {
  state.currentArticle = article;
  resetSessionState();

  $("article-title-display").textContent = article.title;
  $("typing-area").style.display = "block";
  $("result-card").style.display = "none";
  renderReference(article.content, 0);
  $("typing-input").value = "";
  $("typing-input").focus();

  updateLiveStats(0, 0, 100);
}

function resetSessionState() {
  clearInterval(state.timerInterval);
  state.startTime = null;
  state.elapsed = 0;
  state.isRunning = false;
  state.isFinished = false;
  state.letterStats = {};
  state.totalTyped = 0;
  state.totalCorrect = 0;
}

function renderReference(text, cursorPos) {
  const box = $("reference-box");
  const chars = text.split("");
  const typed = $("typing-input").value;

  box.innerHTML = chars.map((ch, i) => {
    let cls = "char-default";
    if (i === cursorPos) {
      cls = "char-cursor";
    } else if (i < typed.length) {
      cls = typed[i] === ch ? "char-correct" : "char-wrong";
    }
    const display = ch === " " ? "&nbsp;" : escHtml(ch);
    return `<span class="${cls}">${display}</span>`;
  }).join("");
}

function handleTypingInput() {
  if (state.isFinished) return;

  const typed = $("typing-input").value;
  const target = state.currentArticle.content;

  // Start timer on first keystroke
  if (!state.isRunning && typed.length > 0) {
    state.isRunning = true;
    state.startTime = Date.now();
    state.timerInterval = setInterval(tickTimer, 500);
  }

  // Enforce: can't go past end of text
  if (typed.length > target.length) {
    $("typing-input").value = typed.slice(0, target.length);
    return;
  }

  // Update letter stats for the latest character typed
  const lastIdx = typed.length - 1;
  if (lastIdx >= 0 && lastIdx >= state.totalTyped - 1) {
    const targetChar = target[lastIdx].toLowerCase();
    const typedChar  = typed[lastIdx].toLowerCase();

    if (/[a-z]/.test(targetChar)) {
      if (!state.letterStats[targetChar]) {
        state.letterStats[targetChar] = { correct: 0, total: 0 };
      }
      state.letterStats[targetChar].total++;
      if (typedChar === targetChar) state.letterStats[targetChar].correct++;
    }

    state.totalTyped   = typed.length;
    state.totalCorrect = [...typed].filter((c, i) => c === target[i]).length;
  }

  // Re-render reference highlighting
  renderReference(target, typed.length);
  updateLiveWpm();

  // Check completion
  if (typed === target) {
    finishSession(typed);
  }
}

function tickTimer() {
  if (!state.isRunning) return;
  state.elapsed = ((Date.now() - state.startTime) / 1000);
  $("live-time").textContent = Math.round(state.elapsed) + "s";
  updateLiveWpm();
}

function updateLiveWpm() {
  const typed  = $("typing-input").value;
  const target = state.currentArticle.content;
  const minutes = state.elapsed / 60 || 0.0001;
  const words  = typed.trim().split(/\s+/).filter(Boolean).length;
  const wpm    = Math.round(words / minutes);
  const acc    = typed.length
    ? Math.round([...typed].filter((c, i) => c === target[i]).length / typed.length * 100)
    : 100;
  updateLiveStats(Math.round(state.elapsed), wpm, acc);
}

function updateLiveStats(secs, wpm, acc) {
  $("live-time").textContent = secs + "s";
  $("live-wpm").textContent  = wpm;
  $("live-acc").textContent  = acc + "%";
}

function finishSession(typed) {
  clearInterval(state.timerInterval);
  state.isRunning  = false;
  state.isFinished = true;

  const target  = state.currentArticle.content;
  const elapsed = state.elapsed || ((Date.now() - state.startTime) / 1000);
  const words   = countWords(target);
  const minutes = elapsed / 60;
  const wpm     = Math.round(words / minutes);
  const correct = [...typed].filter((c, i) => c === target[i]).length;
  const acc     = Math.round(correct / target.length * 100);
  const score   = calcScore(wpm, acc);

  // Save record
  const session = {
    ts:         Date.now(),
    articleId:  state.currentArticle.id,
    articleTitle: state.currentArticle.title,
    wpm,
    accuracy:   acc,
    score,
    elapsed:    Math.round(elapsed),
    letterStats: { ...state.letterStats },
  };
  RecordStore.addSession(state.studentId, session);

  showResults(session);
}

function showResults(session) {
  $("typing-area").style.display = "none";
  $("result-card").style.display = "block";

  // Emoji based on score
  const emoji = session.score >= 6000 ? "🏆"
    : session.score >= 3000 ? "🎉"
    : session.score >= 1000 ? "👍"
    : "💪";
  $("result-emoji").textContent = emoji;

  $("res-score").textContent = session.score;
  $("res-wpm").textContent   = session.wpm + " WPM";
  $("res-acc").textContent   = session.accuracy + "%";
  $("res-time").textContent  = session.elapsed + "s";

  renderLetterBreakdown(session.letterStats);
}

function renderLetterBreakdown(stats) {
  const grid = $("letter-grid");
  grid.innerHTML = "";

  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

  alphabet.forEach(ch => {
    const cell = document.createElement("div");
    cell.className = "letter-cell";

    const s = stats[ch];
    if (!s || s.total === 0) {
      cell.classList.add("lc-none");
      cell.innerHTML = `<span class="lc-char">${ch.toUpperCase()}</span><span class="lc-pct">—</span>`;
    } else {
      const pct = Math.round(s.correct / s.total * 100);
      const cls = pct >= 90 ? "lc-high" : pct >= 70 ? "lc-mid" : "lc-low";
      cell.classList.add(cls);
      cell.title = `${ch.toUpperCase()}: ${s.correct}/${s.total} (${pct}%)`;
      cell.innerHTML = `<span class="lc-char">${ch.toUpperCase()}</span><span class="lc-pct">${pct}%</span>`;
    }
    grid.appendChild(cell);
  });
}

function restartSession() {
  showTypingArea(state.currentArticle);
}

function cancelSession() {
  clearInterval(state.timerInterval);
  resetSessionState();
  $("typing-area").style.display = "none";
  $("result-card").style.display = "none";
  $("article-list").closest(".article-selector").style.display = "block";
  renderArticleList();
}

// ── HISTORY ─────────────────────────────────────────────
function renderHistory() {
  if (!state.studentId) return;
  const records = RecordStore.getByStudent(state.studentId);
  const summary = $("history-summary");
  const list    = $("history-list");

  if (!records.length) {
    summary.innerHTML = "";
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>目前還沒有練習紀錄，快去練習吧！</div>`;
    return;
  }

  // Summary stats
  const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / records.length);
  const bestScore = Math.max(...records.map(r => r.score));
  const avgWpm  = Math.round(records.reduce((s, r) => s + r.wpm, 0) / records.length);
  const avgAcc  = Math.round(records.reduce((s, r) => s + r.accuracy, 0) / records.length);

  summary.innerHTML = `
    <div class="hs-card"><div class="hs-label">練習次數</div><div class="hs-val">${records.length}</div></div>
    <div class="hs-card"><div class="hs-label">平均分數</div><div class="hs-val">${avgScore}</div></div>
    <div class="hs-card"><div class="hs-label">最高分數</div><div class="hs-val">${bestScore}</div></div>
    <div class="hs-card"><div class="hs-label">平均 WPM</div><div class="hs-val">${avgWpm}</div></div>
    <div class="hs-card"><div class="hs-label">平均正確率</div><div class="hs-val">${avgAcc}%</div></div>
  `;

  list.innerHTML = records.map(r => `
    <div class="history-row">
      <span class="hr-date">${formatDate(r.ts)}</span>
      <span class="hr-title">${escHtml(r.articleTitle)}</span>
      <span class="hr-score">分 ${r.score}</span>
      <span class="hr-wpm">${r.wpm} WPM</span>
      <span class="hr-acc">${r.accuracy}%</span>
    </div>
  `).join("");
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
