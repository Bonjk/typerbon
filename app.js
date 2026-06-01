/**
 * app.js — 學生端主邏輯（Firebase 版）
 */
import { ArticleStore, RecordStore,
         calcScore, countWords, formatDate,
         validateStudentId, showToast } from "./data.js";

// ── STATE ─────────────────────────────────────────────────
const state = {
  studentId: null,
  currentArticle: null,
  startTime: null,
  timerInterval: null,
  elapsed: 0,
  isRunning: false,
  isFinished: false,
  letterStats: {},
  totalTyped: 0,
  leaderboardMode: "class",
};

const $ = id => document.getElementById(id);

// ── INIT ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 確保預設文章存在
  await ArticleStore.ensureDefaults();

  const savedId = sessionStorage.getItem("typerbon_student");
  if (savedId) loginAs(savedId);

  $("btn-login").addEventListener("click", handleLogin);
  $("student-id").addEventListener("keydown", e => { if (e.key === "Enter") handleLogin(); });
  $("btn-logout").addEventListener("click", handleLogout);

  document.querySelectorAll(".tab").forEach(tab =>
    tab.addEventListener("click", () => switchTab(tab.dataset.tab))
  );

  $("btn-lb-class").addEventListener("click", () => setLbMode("class"));
  $("btn-lb-all").addEventListener("click",   () => setLbMode("all"));

  $("typing-input").addEventListener("input", handleTypingInput);
  $("btn-restart").addEventListener("click", restartSession);
  $("btn-cancel").addEventListener("click", cancelSession);
  $("btn-retry").addEventListener("click", () => showTypingArea(state.currentArticle));
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
  if (err) { $("login-error").textContent = err; return; }
  $("login-error").textContent = "";
  loginAs(raw);
}

function loginAs(id) {
  state.studentId = id;
  sessionStorage.setItem("typerbon_student", id);
  $("nav-student-id").textContent = `班級座號：${id}`;
  $("screen-login").classList.remove("active");
  $("screen-app").style.display = "block";
  renderArticleList();
}

function handleLogout() {
  sessionStorage.removeItem("typerbon_student");
  state.studentId = null;
  state.currentArticle = null;
  cancelSession();
  $("screen-app").style.display = "none";
  $("screen-login").classList.add("active");
  $("student-id").value = "";
}

// ── TABS ──────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(c =>
    c.classList.toggle("active", c.id === `tab-${name}`));
  if (name === "history")     renderHistory();
  if (name === "leaderboard") renderLeaderboard();
}

// ── ARTICLE LIST ──────────────────────────────────────────
async function renderArticleList() {
  const container = $("article-list");
  container.innerHTML = `<div class="loading-state">載入文章中...</div>`;
  $("article-selector").style.display = "block";

  const articles = await ArticleStore.getAll();
  container.innerHTML = "";

  articles.forEach(article => {
    const card = document.createElement("div");
    card.className = "article-card";
    const wc = countWords(article.content);
    const diffLabel = { easy: "初級", medium: "中級", hard: "高級" }[article.difficulty] || article.difficulty;
    card.innerHTML = `
      <div class="article-card-title">${escHtml(article.title)}</div>
      <div class="article-card-meta">
        <span class="badge badge-${article.difficulty}">${diffLabel}</span>
        <span>${wc} 個字</span>
      </div>`;
    card.addEventListener("click", () => {
      $("article-selector").style.display = "none";
      $("result-card").style.display = "none";
      showTypingArea(article);
    });
    container.appendChild(card);
  });
}

// ── TYPING SESSION ────────────────────────────────────────
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
}

function renderReference(text, cursorPos) {
  const typed = $("typing-input").value;
  $("reference-box").innerHTML = text.split("").map((ch, i) => {
    let cls = "char-default";
    if (i === cursorPos)       cls = "char-cursor";
    else if (i < typed.length) cls = typed[i] === ch ? "char-correct" : "char-wrong";
    return `<span class="${cls}">${ch === " " ? "&nbsp;" : escHtml(ch)}</span>`;
  }).join("");
}

function handleTypingInput() {
  if (state.isFinished) return;
  const typed  = $("typing-input").value;
  const target = state.currentArticle.content;

  if (!state.isRunning && typed.length > 0) {
    state.isRunning = true;
    state.startTime = Date.now();
    state.timerInterval = setInterval(tickTimer, 500);
  }

  if (typed.length > target.length) {
    $("typing-input").value = typed.slice(0, target.length);
    return;
  }

  // Track per-letter stats (only for new chars)
  const lastIdx = typed.length - 1;
  if (lastIdx >= 0 && typed.length > state.totalTyped) {
    const targetChar = target[lastIdx].toLowerCase();
    const typedChar  = typed[lastIdx].toLowerCase();
    if (/[a-z]/.test(targetChar)) {
      if (!state.letterStats[targetChar])
        state.letterStats[targetChar] = { correct: 0, total: 0 };
      state.letterStats[targetChar].total++;
      if (typedChar === targetChar) state.letterStats[targetChar].correct++;
    }
  }
  state.totalTyped = typed.length;

  renderReference(target, typed.length);
  updateLiveWpm();

  if (typed === target) finishSession(typed);
}

function tickTimer() {
  if (!state.isRunning) return;
  state.elapsed = (Date.now() - state.startTime) / 1000;
  $("live-time").textContent = Math.round(state.elapsed) + "s";
  updateLiveWpm();
}

function updateLiveWpm() {
  const typed   = $("typing-input").value;
  const target  = state.currentArticle.content;
  const minutes = state.elapsed / 60 || 0.0001;
  const words   = typed.trim().split(/\s+/).filter(Boolean).length;
  const wpm     = Math.round(words / minutes);
  const acc     = typed.length
    ? Math.round([...typed].filter((c, i) => c === target[i]).length / typed.length * 100)
    : 100;
  updateLiveStats(Math.round(state.elapsed), wpm, acc);
}

function updateLiveStats(secs, wpm, acc) {
  $("live-time").textContent = secs + "s";
  $("live-wpm").textContent  = wpm;
  $("live-acc").textContent  = acc + "%";
}

async function finishSession(typed) {
  clearInterval(state.timerInterval);
  state.isRunning  = false;
  state.isFinished = true;

  const target  = state.currentArticle.content;
  const elapsed = state.elapsed || (Date.now() - state.startTime) / 1000;
  const wpm     = Math.round(countWords(target) / (elapsed / 60));
  const correct = [...typed].filter((c, i) => c === target[i]).length;
  const acc     = Math.round(correct / target.length * 100);
  const score   = calcScore(wpm, acc);

  const session = {
    ts: Date.now(),
    articleId: state.currentArticle.id,
    articleTitle: state.currentArticle.title,
    wpm, accuracy: acc, score,
    elapsed: Math.round(elapsed),
    letterStats: { ...state.letterStats },
  };

  // Save to Firestore (non-blocking)
  RecordStore.addSession(state.studentId, session)
    .catch(() => showToast("成績儲存失敗，請檢查網路連線"));

  showResults(session);
}

function showResults(session) {
  $("typing-area").style.display = "none";
  $("result-card").style.display = "block";

  const grade = session.score >= 6000 ? "優秀"
    : session.score >= 3000 ? "不錯"
    : session.score >= 1000 ? "繼續加油" : "多加練習";
  $("result-emoji").textContent = grade;
  $("res-score").textContent = session.score;
  $("res-wpm").textContent   = session.wpm + " WPM";
  $("res-acc").textContent   = session.accuracy + "%";
  $("res-time").textContent  = session.elapsed + "s";

  renderLetterBreakdown(session.letterStats);
}

function renderLetterBreakdown(stats) {
  const grid = $("letter-grid");
  grid.innerHTML = "";
  "abcdefghijklmnopqrstuvwxyz".split("").forEach(ch => {
    const cell = document.createElement("div");
    cell.className = "letter-cell";
    const s = stats[ch];
    if (!s || s.total === 0) {
      cell.classList.add("lc-none");
      cell.innerHTML = `<span class="lc-char">${ch.toUpperCase()}</span><span class="lc-pct">—</span>`;
    } else {
      const pct = Math.round(s.correct / s.total * 100);
      cell.classList.add(pct >= 90 ? "lc-high" : pct >= 70 ? "lc-mid" : "lc-low");
      cell.title = `${ch.toUpperCase()}: ${s.correct}/${s.total} (${pct}%)`;
      cell.innerHTML = `<span class="lc-char">${ch.toUpperCase()}</span><span class="lc-pct">${pct}%</span>`;
    }
    grid.appendChild(cell);
  });
}

function restartSession() { showTypingArea(state.currentArticle); }

function cancelSession() {
  clearInterval(state.timerInterval);
  resetSessionState();
  $("typing-area").style.display = "none";
  $("result-card").style.display = "none";
  $("article-selector").style.display = "block";
  renderArticleList();
}

// ── HISTORY ───────────────────────────────────────────────
async function renderHistory() {
  if (!state.studentId) return;
  const summary = $("history-summary");
  const list    = $("history-list");
  summary.innerHTML = "";
  list.innerHTML = `<div class="loading-state">載入中...</div>`;

  const records = await RecordStore.getByStudent(state.studentId);

  if (!records.length) {
    list.innerHTML = `<div class="empty-state">目前還沒有練習紀錄，快去練習吧！</div>`;
    return;
  }

  const avgScore  = Math.round(records.reduce((s, r) => s + r.score, 0) / records.length);
  const bestScore = Math.max(...records.map(r => r.score));
  const avgWpm    = Math.round(records.reduce((s, r) => s + r.wpm, 0) / records.length);
  const avgAcc    = Math.round(records.reduce((s, r) => s + r.accuracy, 0) / records.length);

  summary.innerHTML = `
    <div class="hs-card"><div class="hs-label">練習次數</div><div class="hs-val">${records.length}</div></div>
    <div class="hs-card"><div class="hs-label">平均分數</div><div class="hs-val">${avgScore}</div></div>
    <div class="hs-card"><div class="hs-label">最高分數</div><div class="hs-val">${bestScore}</div></div>
    <div class="hs-card"><div class="hs-label">平均 WPM</div><div class="hs-val">${avgWpm}</div></div>
    <div class="hs-card"><div class="hs-label">平均正確率</div><div class="hs-val">${avgAcc}%</div></div>`;

  list.innerHTML = records.map(r => `
    <div class="history-row">
      <span class="hr-date">${formatDate(r.ts)}</span>
      <span class="hr-title">${escHtml(r.articleTitle)}</span>
      <span class="hr-score">分 ${r.score}</span>
      <span class="hr-wpm">${r.wpm} WPM</span>
      <span class="hr-acc">${r.accuracy}%</span>
    </div>`).join("");
}

// ── LEADERBOARD ───────────────────────────────────────────
function setLbMode(mode) {
  state.leaderboardMode = mode;
  $("btn-lb-class").classList.toggle("active", mode === "class");
  $("btn-lb-all").classList.toggle("active",   mode === "all");
  renderLeaderboard();
}

async function renderLeaderboard() {
  const el = $("leaderboard-list");
  el.innerHTML = `<div class="loading-state">載入排行榜...</div>`;

  const classCode = (state.leaderboardMode === "class" && state.studentId)
    ? state.studentId.slice(0, 3) : null;
  const all = await RecordStore.getAllLeaderboard();
  const rows = classCode
    ? all.filter(r => r.studentId && r.studentId.startsWith(classCode))
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : all;

  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">同班還沒有人完成練習，成為第一名吧！</div>`;
    return;
  }

  const medals = ["1st","2nd","3rd"];
  el.innerHTML = `
    <div class="lb-header">
      <span class="lb-rank">名次</span>
      <span class="lb-id">班級座號</span>
      <span class="lb-score">最高分</span>
      <span class="lb-wpm">WPM</span>
      <span class="lb-acc">正確率</span>
    </div>
    ${rows.map(r => {
      const isSelf = r.studentId === state.studentId;
      const medal  = medals[r.rank - 1] || r.rank;
      return `
        <div class="lb-row ${isSelf ? "lb-self" : ""}">
          <span class="lb-rank">${medal}</span>
          <span class="lb-id">${escHtml(r.studentId)}${isSelf ? " <span class='lb-me'>（我）</span>" : ""}</span>
          <span class="lb-score">${r.bestScore}</span>
          <span class="lb-wpm">${r.bestWpm}</span>
          <span class="lb-acc">${r.bestAcc}%</span>
        </div>`;
    }).join("")}`;
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
