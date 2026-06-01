/**
 * app.js — 學生端主邏輯（Firebase 版）
 */
import { ArticleStore, RecordStore, ExamStore,
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
  grossKeystrokes: 0,
  leaderboardMode: "class",
  examMode: false,
  examId: null,
  examDeadline: null,
  examTimerInterval: null,
  examSubmitted: false,
  pendingExam: null,
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

  $("typing-input").addEventListener("paste",   e => e.preventDefault());
  $("typing-input").addEventListener("input", handleTypingInput);
  $("typing-input").addEventListener("keydown", e => {
    if (state.isFinished || !state.currentArticle) return;
    if (e.repeat || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    state.grossKeystrokes++;
  });
  $("btn-restart").addEventListener("click", restartSession);
  $("btn-cancel").addEventListener("click", cancelSession);
  $("btn-join-exam").addEventListener("click", joinExam);
  $("btn-submit-exam").addEventListener("click", () => submitExam($("typing-input").value));
  $("btn-retry").addEventListener("click", () => showTypingArea(state.currentArticle));
  $("btn-choose-another").addEventListener("click", () => {
    $("typing-area").style.display = "none";
    $("result-card").style.display = "none";
    $("btn-retry").style.display = "";
    $("btn-choose-another").textContent = "選其他文章";
    $("res-completion-row").style.display = "none";
    renderArticleList();
    checkActiveExam();
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
  checkActiveExam();
}

function handleLogout() {
  clearInterval(state.examTimerInterval);
  state.examMode = false;
  state.examId = null;
  state.examDeadline = null;
  state.examSubmitted = false;
  state.pendingExam = null;
  $("exam-banner").style.display = "none";
  $("exam-time-chip").style.display = "none";
  $("btn-submit-exam").style.display = "none";
  $("btn-cancel").style.display = "";
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
  state.grossKeystrokes = 0;
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

  if (typed === target) {
    if (state.examMode) submitExam(typed);
    else                finishSession(typed);
  }
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

  const target    = state.currentArticle.content;
  const elapsed   = state.elapsed || (Date.now() - state.startTime) / 1000;
  const wordCount = countWords(target);
  const wpm       = Math.round(wordCount / (elapsed / 60));
  const correct   = [...typed].filter((c, i) => c === target[i]).length;
  const acc       = Math.round(correct / target.length * 100);
  const grossAcc  = state.grossKeystrokes > 0
    ? Math.min(100, Math.round(correct / state.grossKeystrokes * 100))
    : 100;
  const refTime          = wordCount / 15 * 60;
  const completionFactor = Math.max(1, Math.min(200, Math.round(refTime / elapsed * 100)));
  const score = calcScore(wpm, acc, grossAcc, state.currentArticle.difficulty || 'medium', completionFactor);

  const session = {
    ts: Date.now(),
    articleId:    state.currentArticle.id,
    articleTitle: state.currentArticle.title,
    wpm, accuracy: acc, grossAccuracy: grossAcc, score,
    elapsed: Math.round(elapsed),
    letterStats: { ...state.letterStats },
  };

  showResults(session);

  // Get old best before saving (for personal-best check)
  const oldBest = await RecordStore.getBestScore(state.studentId).catch(() => 0);

  try {
    await RecordStore.addSession(state.studentId, session);
  } catch {
    showToast("成績儲存失敗，請檢查網路連線");
    return;
  }

  const isPersonalBest = session.score > oldBest;

  try {
    const lb        = await RecordStore.getAllLeaderboard();
    const cc        = state.studentId.slice(0, 3);
    const classList = lb.filter(r => r.studentId?.startsWith(cc));
    const classRank = classList.findIndex(r => r.studentId === state.studentId) + 1;
    const globalRank = lb.findIndex(r => r.studentId === state.studentId) + 1;

    if (isPersonalBest && ((classRank > 0 && classRank <= 3) || (globalRank > 0 && globalRank <= 10))) {
      triggerFireworks();
    } else if (isPersonalBest) {
      triggerConfetti();
    }
  } catch { /* 網路異常時略過慶祝動畫 */ }
}

function showResults(session) {
  $("typing-area").style.display = "none";
  $("result-card").style.display = "block";

  const grade = session.score >= 8500 ? "優秀"
    : session.score >= 7000 ? "不錯"
    : session.score >= 5500 ? "繼續加油" : "多加練習";
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

// ── EXAM MODE ─────────────────────────────────────────────
async function checkActiveExam() {
  const exam = await ExamStore.getCurrent().catch(() => null);
  const banner = $("exam-banner");
  if (!exam || exam.status !== "active" || exam.classCode !== state.studentId?.slice(0, 3)) {
    banner.style.display = "none";
    state.pendingExam = null;
    return;
  }
  state.pendingExam = exam;
  $("exam-banner-text").textContent = `${exam.articleTitle}（10 分鐘）`;
  banner.style.display = "flex";
}

function joinExam() {
  const exam = state.pendingExam;
  if (!exam) return;

  state.examMode      = true;
  state.examId        = exam.id;
  state.examDeadline  = Date.now() + 10 * 60 * 1000;
  state.examSubmitted = false;

  $("exam-banner").style.display   = "none";
  $("article-selector").style.display = "none";
  $("result-card").style.display   = "none";

  showTypingArea({
    id: exam.articleId, title: exam.articleTitle,
    content: exam.content, difficulty: exam.difficulty,
  });

  startExamCountdown();
  $("exam-time-chip").style.display   = "";
  $("btn-submit-exam").style.display  = "";
  $("btn-cancel").style.display       = "none";
}

function startExamCountdown() {
  clearInterval(state.examTimerInterval);
  state.examTimerInterval = setInterval(() => {
    const remaining = state.examDeadline - Date.now();
    if (remaining <= 0) {
      clearInterval(state.examTimerInterval);
      if (!state.examSubmitted) submitExam($("typing-input").value);
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const el   = $("exam-countdown");
    el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    el.style.color = remaining < 60000 ? "var(--danger)" : "";
  }, 500);
}

async function submitExam(typed) {
  if (state.examSubmitted) return;
  state.examSubmitted = true;
  clearInterval(state.timerInterval);
  clearInterval(state.examTimerInterval);
  state.isRunning  = false;
  state.isFinished = true;

  const target     = state.currentArticle.content;
  const submitted  = typed.slice(0, target.length);
  const elapsed    = state.startTime ? (Date.now() - state.startTime) / 1000 : 0.01;
  const wpm        = submitted.length > 0 && elapsed > 0.5
    ? Math.round(countWords(submitted) / (elapsed / 60)) : 0;
  const correct    = [...submitted].filter((c, i) => c === target[i]).length;
  const acc        = submitted.length > 0 ? Math.round(correct / submitted.length * 100) : 0;
  const grossAcc   = state.grossKeystrokes > 0
    ? Math.min(100, Math.round(correct / state.grossKeystrokes * 100)) : 0;
  const completion = Math.round(submitted.length / target.length * 100);
  const score      = calcScore(wpm, acc, grossAcc, state.currentArticle.difficulty || "medium", completion);

  const result = {
    studentId: state.studentId,
    classCode: state.studentId.slice(0, 3),
    wpm, accuracy: acc, grossAccuracy: grossAcc,
    completion, score, elapsed: Math.round(elapsed),
    articleTitle: state.currentArticle.title,
    letterStats: { ...state.letterStats },
  };

  // Show results
  $("typing-area").style.display = "none";
  $("result-card").style.display = "block";
  const grade = score >= 8500 ? "優秀" : score >= 7000 ? "不錯" : score >= 5500 ? "繼續加油" : "多加練習";
  $("result-emoji").textContent     = grade + "（考試）";
  $("res-score").textContent        = score;
  $("res-wpm").textContent          = wpm + " WPM";
  $("res-acc").textContent          = acc + "%";
  $("res-time").textContent         = Math.round(elapsed) + "s";
  $("res-completion-row").style.display = "";
  $("res-completion").textContent   = completion + "%";
  renderLetterBreakdown(result.letterStats);
  $("btn-retry").style.display      = "none";
  $("btn-choose-another").textContent = "回到練習";

  // Restore exam UI elements
  $("exam-time-chip").style.display  = "none";
  $("btn-submit-exam").style.display = "none";
  $("btn-cancel").style.display      = "";

  // Save to Firestore
  const savedExamId = state.examId;
  state.examMode = false;
  state.examId   = null;
  state.examDeadline = null;
  state.pendingExam  = null;

  try {
    await ExamStore.submitResult(savedExamId, state.studentId, result);
  } catch {
    showToast("成績儲存失敗，請檢查網路連線");
  }
}

// ── CELEBRATIONS ──────────────────────────────────────────
function triggerFireworks() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff922b","#cc5de8","#f783ac"];
  const particles = [];

  function burst(x) {
    const y     = canvas.height * (0.15 + Math.random() * 0.35);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, color, r: 2 + Math.random() * 2 });
    }
  }

  const timeouts = [0, 380, 700, 1050, 1400, 1750].map(d =>
    setTimeout(() => burst(canvas.width * (0.15 + Math.random() * 0.7)), d)
  );

  const t0 = Date.now();
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.alpha -= 0.013;
      if (p.alpha <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (Date.now() - t0 < 4200) requestAnimationFrame(draw);
    else { timeouts.forEach(clearTimeout); canvas.remove(); }
  })();
}

function triggerConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;";
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#ff922b","#cc5de8","#f783ac"];
  const pieces = Array.from({ length: 90 }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const speed = 5 + Math.random() * 9;
    return {
      x: canvas.width / 2 + (Math.random() - 0.5) * 80,
      y: canvas.height * 0.55,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      alpha: 1, color: COLORS[i % COLORS.length],
      w: 7 + Math.random() * 5, h: 4 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.28,
    };
  });

  const t0 = Date.now();
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.20;
      p.rot += p.rotV; p.alpha -= 0.011;
      if (p.alpha <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive && Date.now() - t0 < 3200) requestAnimationFrame(draw);
    else canvas.remove();
  })();
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
