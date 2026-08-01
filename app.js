/**
 * app.js — 學生端主邏輯（Firebase 版）
 */
import { ArticleStore, RecordStore, ExamStore, StudentStore,
         ACHIEVEMENTS, calcScore, countWords, formatDate,
         validateStudentId, showToast, escHtml } from "./data.js?v=20260801";

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
  examArticles: null,       // { easy, medium, hard } during active exam
  wpmHistory:    [],        // [{t, wpm}, ...] live chart data points
  lastChartPush: 0,         // elapsed seconds of last chart push
  wpmChart:      null,      // Chart.js live instance
  historyChart:  null,      // Chart.js history instance
  studentProfile: null,     // cached Firestore student profile
  noBackspace:   true,      // tracks whether Backspace was pressed this session
  isComposing:   false,     // true during IME composition; prevents off-by-one rendering
};

const $ = id => document.getElementById(id);

// ── 考試成績暫存／重試（避免交卷時 Firestore 瞬斷掉分）──────────
const PENDING_KEY = "typerbon_pending_exam";
const readPending  = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "{}"); } catch { return {}; } };
const savePending  = (examId, sid, result) => { const a = readPending(); a[`${examId}__${sid}`] = { examId, studentId: sid, result }; localStorage.setItem(PENDING_KEY, JSON.stringify(a)); };
const clearPending = (examId, sid) => { const a = readPending(); delete a[`${examId}__${sid}`]; localStorage.setItem(PENDING_KEY, JSON.stringify(a)); };
async function submitWithRetry(examId, sid, result, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { await ExamStore.submitResult(examId, sid, result); return true; }
    catch { await new Promise(r => setTimeout(r, 800 * (i + 1))); }
  }
  return false;
}
// 考試結果卡上的上傳狀態提示（避免學生在非同步寫入完成前離開導致掉分）
function setExamUploadStatus(kind) {
  const el = document.getElementById("exam-upload-status");
  if (!el) return;
  if (!kind) { el.style.display = "none"; return; }
  const map = {
    uploading: ["uploading", "成績上傳中，請稍候，先別關閉頁面…"],
    done:      ["done",      "✓ 成績已上傳成功，可以安心離開"],
    pending:   ["pending",   "⚠ 成績尚未上傳，請保持此頁開啟，系統會自動重試（或舉手反映）"],
  };
  const [cls, text] = map[kind] || ["", ""];
  el.className = "exam-upload-status " + cls;
  el.textContent = text;
  el.style.display = "";
}

let _flushing = false;
async function flushPendingExamResults() {
  if (_flushing) return;                                 // 防重入
  if (!Object.keys(readPending()).length) return;        // 沒有待補傳就略過
  _flushing = true;
  try {
    let any = false;
    for (const v of Object.values(readPending()))
      if (await submitWithRetry(v.examId, v.studentId, v.result, 2)) {
        clearPending(v.examId, v.studentId);
        any = true;
      }
    if (any && !Object.keys(readPending()).length) setExamUploadStatus("done");
  } finally { _flushing = false; }
}
// 定期＋事件自動重送：考完視窗縮小後背景計時器會被節流，故再用 online/可見/focus 補強
setInterval(flushPendingExamResults, 15000);
window.addEventListener("online", flushPendingExamResults);
window.addEventListener("focus", flushPendingExamResults);
document.addEventListener("visibilitychange", () => { if (!document.hidden) flushPendingExamResults(); });
// 還有未上傳的考試成績時，離開前警告（防止寫入完成前關閉分頁而掉分）
window.addEventListener("beforeunload", e => {
  if (Object.keys(readPending()).length) { e.preventDefault(); e.returnValue = ""; return ""; }
});

// ── INIT ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 確保預設文章存在
  await ArticleStore.ensureDefaults();
  flushPendingExamResults();   // best-effort 補傳上次未成功的考試成績

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

  document.querySelectorAll(".fs-btn").forEach(btn =>
    btn.addEventListener("click", () => applyFontSize(btn.dataset.size)));
  initFontSize();

  $("theme-select").addEventListener("change", e => applyTheme(e.target.value));
  initTheme();

  $("typing-input").addEventListener("paste",            e => e.preventDefault());
  ["dragover", "drop"].forEach(ev =>
    $("typing-input").addEventListener(ev, e => e.preventDefault())
  );
  ["dragstart", "dragover", "drop", "contextmenu"].forEach(ev =>
    $("reference-box").addEventListener(ev, e => e.preventDefault())
  );
  $("typing-input").addEventListener("compositionstart", () => { state.isComposing = true; });
  $("typing-input").addEventListener("compositionend",   () => { state.isComposing = false; handleTypingInput(); });
  $("typing-input").addEventListener("input", handleTypingInput);
  $("typing-input").addEventListener("keydown", e => {
    if (state.isFinished || !state.currentArticle) return;
    if (e.key === "Backspace") { state.noBackspace = false; return; }
    if (e.repeat || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    state.grossKeystrokes++;
  });
  $("btn-refresh-ref").addEventListener("click", () => {
    if (state.currentArticle) renderReference(state.currentArticle.content, $("typing-input").value.length);
  });
  $("btn-submit-practice").addEventListener("click", () => {
    if (!state.isRunning || state.isFinished) return;
    finishSession($("typing-input").value);
  });
  $("btn-restart").addEventListener("click", restartSession);
  $("btn-cancel").addEventListener("click", cancelSession);
  $("btn-join-exam").addEventListener("click", joinExam);
  $("btn-submit-exam").addEventListener("click", () => submitExam($("typing-input").value, true));
  $("btn-retry").addEventListener("click", () => {
    if (state.examMode && state.examArticles) {
      $("result-card").style.display = "none";
      showExamArticleModal(state.examArticles);
    } else {
      showTypingArea(state.currentArticle);
    }
  });
  $("btn-choose-another").addEventListener("click", () => {
    $("typing-area").style.display = "none";
    $("result-card").style.display = "none";
    $("btn-retry").style.display = "";
    $("btn-retry").textContent = "再試一次";
    $("btn-choose-another").textContent = "選其他文章";
    $("res-completion-row").style.display        = "none";
    $("res-completion-factor-row").style.display = "none";
    renderArticleList();
    checkActiveExam();
  });
  $("btn-exam-article-cancel").addEventListener("click", () => {
    $("exam-article-overlay").style.display = "none";
  });
  $("btn-exam-confirm-cancel").addEventListener("click", () => {
    $("exam-confirm-overlay").style.display = "none";
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
  const prevId = sessionStorage.getItem("typerbon_student");
  if (prevId && prevId !== id) {
    sessionStorage.removeItem("typerbon_student");
  }
  state.studentId = id;
  sessionStorage.setItem("typerbon_student", id);
  $("nav-student-id").textContent = `班級座號：${id}`;
  $("screen-login").classList.remove("active");
  $("screen-app").style.display = "block";
  // 從 Firestore 載入學生偏好（主題、字型），Firestore 優先於 localStorage
  StudentStore.get(id).then(profile => {
    if (profile.theme)    applyTheme(profile.theme, false);
    if (profile.fontSize) applyFontSize(profile.fontSize, false);
    state.studentProfile = profile;
  });
  StudentStore.recordLogin(id);   // 記錄登入時間（教師端登入紀錄用）
  renderArticleList();
  checkActiveExam();
  flushPendingExamResults();   // 登入後再嘗試補傳一次
}

function handleLogout() {
  clearInterval(state.examTimerInterval);
  state.examMode = false;
  state.examId = null;
  state.examDeadline = null;
  state.examSubmitted = false;
  state.pendingExam = null;
  state.examArticles = null;
  $("exam-banner").style.display = "none";
  $("exam-time-chip").style.display = "none";
  $("btn-submit-exam").style.display = "none";
  $("btn-cancel").style.display = "";
  $("exam-article-overlay").style.display = "none";
  $("exam-confirm-overlay").style.display = "none";
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
  if (name === "history")      renderHistory();
  if (name === "leaderboard")  renderLeaderboard();
  if (name === "achievements") renderAchievements();
}

// ── ARTICLE LIST ──────────────────────────────────────────
async function renderArticleList() {
  const container = $("article-list");
  container.innerHTML = `<div class="loading-state">載入文章中...</div>`;
  container.className = "";
  $("article-selector").style.display = "block";

  const articles = await ArticleStore.getAll();
  container.innerHTML = "";

  const groups = { easy: [], medium: [], hard: [] };
  articles.forEach(a => (groups[a.difficulty] ?? groups.medium).push(a));

  const labels = { easy: "初級", medium: "中級", hard: "高級" };

  for (const diff of ["easy", "medium", "hard"]) {
    const list = groups[diff];
    if (!list.length) continue;

    const section = document.createElement("div");
    section.className = "article-section";

    const hdr = document.createElement("div");
    hdr.className = `article-section-header diff-${diff}`;
    hdr.textContent = labels[diff];
    section.appendChild(hdr);

    const grid = document.createElement("div");
    grid.className = "article-list";

    list.forEach(article => {
      const card = document.createElement("div");
      card.className = "article-card";
      const wc = countWords(article.content);
      const tags = article.tags || (article.isExam ? ["exam"] : []);
      const examTag    = tags.includes("exam")  ? `<span class="badge badge-exam">考試</span>` : "";
      const classicTag = tags.includes("名著") ? `<span class="badge badge-classic">名著</span>` : "";
      card.innerHTML = `
        <div class="article-card-title">${escHtml(article.title)}</div>
        <div class="article-card-meta">
          ${examTag}${classicTag}
          <span>${wc} 個字</span>
        </div>`;
      card.addEventListener("click", () => {
        $("article-selector").style.display = "none";
        $("result-card").style.display = "none";
        showTypingArea(article);
      });
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  }
}

// ── TYPING SESSION ────────────────────────────────────────
function showTypingArea(article) {
  state.currentArticle = { ...article, content: normalizeContent(article.content) };
  resetSessionState();
  $("article-title-display").textContent = article.title;
  $("typing-area").style.display          = "block";
  $("result-card").style.display          = "none";
  $("btn-refresh-ref").style.display      = "";
  $("btn-submit-practice").style.display  = state.examMode ? "none" : "";
  renderReference(article.content, 0);
  $("typing-input").value = "";
  $("typing-input").focus();
  updateLiveStats(0, 0, 100);
  const total = state.currentArticle.content.length;
  $("typing-progress-label").textContent = `0 / ${total}`;
  initLiveChart();
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
  state.wpmHistory    = [];
  state.lastChartPush = 0;
  state.noBackspace   = true;
  if (state.wpmChart) { state.wpmChart.destroy(); state.wpmChart = null; }
  $("wpm-chart-wrap").style.display    = "none";
  $("session-chart-wrap").style.display = "none";
  $("typing-progress-fill").style.width  = "0%";
  $("typing-progress-label").textContent = "0 / 0";
}

function renderReference(text, cursorPos) {
  const typed = $("typing-input").value;
  const ref   = $("reference-box");
  let html = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === " ") {
      // 空格：單獨一個 span，讓行在空格處換行
      let cls = "char-default";
      if (i === cursorPos)       cls = "char-cursor";
      else if (i < typed.length) cls = typed[i] === " " ? "char-correct" : "char-wrong";
      html += `<span class="${cls}">&nbsp;</span>`;
      i++;
    } else {
      // 非空格：把整個詞收進 inline-block，防止詞中換行
      const start = i;
      while (i < text.length && text[i] !== " ") i++;
      let word = `<span style="display:inline-block;white-space:nowrap">`;
      for (let j = start; j < i; j++) {
        let cls = "char-default";
        if (j === cursorPos)       cls = "char-cursor";
        else if (j < typed.length) cls = typed[j] === text[j] ? "char-correct" : "char-wrong";
        word += `<span class="${cls}">${escHtml(text[j])}</span>`;
      }
      word += `</span>`;
      html += word;
    }
  }

  ref.innerHTML = html;
  // 當參考框可捲動時，確保游標保持在可見範圍內
  ref.querySelector(".char-cursor")?.scrollIntoView({ block: "nearest" });
}

function handleTypingInput() {
  if (state.isFinished) return;
  if (state.isComposing)  return;   // wait for IME composition to commit
  const typed  = $("typing-input").value;
  const target = state.currentArticle.content;

  if (!state.isRunning && typed.length > 0) {
    state.isRunning = true;
    state.startTime = Date.now();
    state.timerInterval = setInterval(tickTimer, 500);
  }

  if (typed.length > target.length) {
    const clipped = typed.slice(0, target.length);
    $("typing-input").value = clipped;
    // Setting .value programmatically does not fire 'input', so check finish here.
    if (clipped === target) {
      if (state.examMode) submitExam(clipped);
      else                finishSession(clipped);
    }
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
  updateProgressBar(typed.length, target.length);
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
  const secMark = Math.floor(state.elapsed / 10) * 10;
  if (secMark > 0 && secMark > state.lastChartPush) {
    state.lastChartPush = secMark;
    pushWpmPoint(secMark, parseInt($("live-wpm").textContent) || 0);
  }
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
  const wpm       = (typed.length > 0 && elapsed > 0.5)
    ? Math.round(countWords(typed) / (elapsed / 60)) : 0;
  const correct   = [...typed].filter((c, i) => c === target[i]).length;
  const acc       = Math.round(correct / target.length * 100);
  const grossAcc  = state.grossKeystrokes > 0
    ? Math.min(100, Math.round(correct / state.grossKeystrokes * 100))
    : 100;
  const refTime          = wordCount / 15 * 60;
  const paceFactor       = Math.max(1, Math.min(200, Math.round(refTime / elapsed * 100)));
  const completionRatio  = typed.length / target.length;
  const completionFactor = Math.max(1, Math.round(paceFactor * completionRatio));
  const score = calcScore(wpm, acc, grossAcc, state.currentArticle.difficulty || 'medium', completionFactor, wordCount);

  const session = {
    ts: Date.now(),
    articleId:    state.currentArticle.id,
    articleTitle: state.currentArticle.title,
    difficulty:   state.currentArticle.difficulty || "medium",
    wpm, accuracy: acc, grossAccuracy: grossAcc, score,
    completionFactor, wordCount,
    completed: typed.length >= target.length && acc >= 80,
    completion: Math.round(typed.length / target.length * 100),
    keystrokes: state.grossKeystrokes,
    elapsed: Math.round(elapsed),
    letterStats: { ...state.letterStats },
  };

  if (!validateLetterStats(typed, target)) {
    showInvalidStatsWarning();
    return;
  }

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

  // 成就檢查
  try {
    const allSessions = await RecordStore.getByStudent(state.studentId);
    await checkAchievements(session, allSessions, false);
  } catch { /* 離線時略過 */ }
}

function showResults(session) {
  setExamUploadStatus(null);   // 練習結果不顯示考試上傳狀態
  $("typing-area").style.display          = "none";
  $("btn-refresh-ref").style.display      = "none";
  $("btn-submit-practice").style.display  = "none";
  $("result-card").style.display = "block";
  $("result-title").textContent  = "練習完成！";

  const grade = session.score >= 8500 ? "優秀"
    : session.score >= 7000 ? "不錯"
    : session.score >= 5500 ? "繼續加油" : "多加練習";
  $("result-emoji").textContent = grade;
  $("res-score").textContent = session.score;
  $("res-wpm").textContent   = session.wpm + " WPM";
  $("res-acc").textContent   = session.accuracy + "%";
  $("res-time").textContent  = session.elapsed + "s";

  $("res-completion-row").style.display        = "none";
  $("res-completion-factor-row").style.display = "";
  $("res-completion-factor").textContent = session.completionFactor ?? "—";
  $("res-gross-acc").textContent         = (session.grossAccuracy ?? session.accuracy) + "%";
  const dMap = { easy: "×0.90（初級）", medium: "×0.95（中級）", hard: "×1.00（高級）" };
  $("res-difficulty").textContent = dMap[session.difficulty] ?? "×1.00";

  if (session.wordCount != null) {
    const L = (session.wordCount + 20) / 100;
    $("res-wordcount-row").style.display = "";
    $("res-wordcount-coeff").textContent = "×" + L.toFixed(2) + "（" + session.wordCount + " 字）";
  } else {
    $("res-wordcount-row").style.display = "none";
  }

  renderSessionChart();
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
  $("typing-area").style.display          = "none";
  $("result-card").style.display          = "none";
  $("btn-refresh-ref").style.display      = "none";
  $("btn-submit-practice").style.display  = "none";
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
      <span class="hr-score">${r.score} 分</span>
      <span class="hr-wpm">${r.wpm} WPM</span>
      <span class="hr-acc">${r.accuracy}%</span>
    </div>`).join("");

  renderHistoryChart(records);
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
      <span class="lb-ach"></span>
    </div>
    ${rows.map(r => {
      const isSelf  = r.studentId === state.studentId;
      const medal   = medals[r.rank - 1] || r.rank;
      const achCnt  = r.achievementCount || 0;
      const isGold  = achCnt >= ACHIEVEMENTS.length;
      return `
        <div class="lb-row ${isSelf ? "lb-self" : ""} ${isGold ? "lb-gold" : ""}">
          <span class="lb-rank">${medal}</span>
          <span class="lb-id">${escHtml(r.studentId)}${isSelf ? " <span class='lb-me'>（我）</span>" : ""}</span>
          <span class="lb-score">${r.bestScore}</span>
          <span class="lb-wpm">${r.bestWpm}</span>
          <span class="lb-acc">${r.bestAcc}%</span>
          <span class="lb-ach">${medalSvg(achCnt)}</span>
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
  $("exam-banner-text").textContent = `${exam.classCode} 班考試進行中（15 分鐘）`;
  banner.style.display = "flex";
}

function joinExam() {
  const exam = state.pendingExam;
  if (!exam || !exam.articles) return;
  ExamStore.recordJoin(exam.id, state.studentId);   // 按下加入考試即登記座號（best-effort）
  state.examArticles = exam.articles;
  showExamArticleModal(exam.articles);
}

function showExamArticleModal(articles) {
  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };
  const diffCoef  = { easy: "×0.90", medium: "×0.95", hard: "×1.00" };

  $("exam-article-choices").innerHTML = ["easy", "medium", "hard"].map(d => {
    const a = articles[d];
    if (!a) return "";
    const wc = countWords(a.content);
    return `<div class="exam-article-card badge-${d}" data-diff="${d}">
      <div class="eac-diff">${diffLabel[d]}</div>
      <div class="eac-title">${escHtml(a.title)}</div>
      <div class="eac-meta">${wc} 字&ensp;最高分係數 ${diffCoef[d]}</div>
    </div>`;
  }).join("");

  $("exam-article-overlay").style.display = "flex";

  $("exam-article-choices").querySelectorAll(".exam-article-card").forEach(card =>
    card.addEventListener("click", () => {
      const article = articles[card.dataset.diff];
      $("exam-article-overlay").style.display = "none";
      showExamConfirmModal(article);
    })
  );
}

const EXAM_WORDS = ["確認", "OK", "明白", "了解", "收到"];

function showExamConfirmModal(article) {
  const correct = EXAM_WORDS[Math.floor(Math.random() * EXAM_WORDS.length)];
  $("exam-rule-color").textContent = `「${correct}」`;

  // Shuffle button order so position also varies
  const container = document.querySelector(".exam-confirm-btns");
  const btns = [...container.children];
  for (let i = btns.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    container.insertBefore(btns[j], btns[i]);
    [btns[i], btns[j]] = [btns[j], btns[i]];
  }

  $("exam-confirm-overlay").style.display = "flex";
  $("exam-rule-student-id").textContent = state.studentId || "—";
  const checkbox = $("exam-rules-check");
  checkbox.checked = false;
  document.querySelectorAll(".btn-exam-confirm").forEach(b => { b.disabled = true; });
  checkbox.onchange = () =>
    document.querySelectorAll(".btn-exam-confirm").forEach(b => { b.disabled = !checkbox.checked; });

  document.querySelectorAll(".btn-exam-confirm").forEach(btn => {
    btn.onclick = btn.dataset.word === correct
      ? () => { $("exam-confirm-overlay").style.display = "none"; startActualExam(article); }
      : () => { $("exam-confirm-overlay").style.display = "none"; alert("請確實閱讀考試規則"); };
  });
}

function startActualExam(article) {
  const exam = state.pendingExam;
  if (!exam) return;

  state.examMode      = true;
  state.examId        = exam.id;
  state.examSubmitted = false;

  const isFirstAttempt = !state.examDeadline;
  if (isFirstAttempt) {
    state.examDeadline = Date.now() + 15 * 60 * 1000;
    startExamCountdown();
  }

  $("exam-banner").style.display      = "none";
  $("article-selector").style.display = "none";
  $("result-card").style.display      = "none";

  showTypingArea({ id: article.id, title: article.title, content: article.content, difficulty: article.difficulty });

  $("exam-time-chip").style.display  = "";
  $("btn-submit-exam").style.display = "";
  $("btn-cancel").style.display      = "none";
}

function startExamCountdown() {
  clearInterval(state.examTimerInterval);
  state.examTimerInterval = setInterval(() => {
    const remaining = state.examDeadline - Date.now();
    if (remaining <= 0) {
      clearInterval(state.examTimerInterval);
      $("exam-article-overlay").style.display = "none";
      $("exam-confirm-overlay").style.display = "none";
      if (!state.examSubmitted) {
        submitExam($("typing-input").value, true);
      } else {
        // Already on result screen — clean up retry option
        $("btn-retry").style.display  = "none";
        $("btn-retry").textContent    = "再試一次";
        $("btn-choose-another").textContent = "選其他文章";
        $("exam-time-chip").style.display   = "none";
        $("btn-submit-exam").style.display  = "none";
        $("btn-cancel").style.display       = "";
        state.examMode     = false;
        state.examId       = null;
        state.examDeadline = null;
        state.examArticles = null;
        state.pendingExam  = null;
      }
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const el   = $("exam-countdown");
    el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    el.style.color = remaining < 60000 ? "var(--danger)" : "";
  }, 500);
}

async function submitExam(typed, isFinal = false) {
  if (state.examSubmitted) return;
  state.examSubmitted = true;
  clearInterval(state.timerInterval);
  if (isFinal) clearInterval(state.examTimerInterval);
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
  const completion = Math.round(submitted.length / target.length * 100); // 0-100，供顯示用
  const score      = calcScore(wpm, acc, grossAcc, state.currentArticle.difficulty || "medium",
                               submitted.length / target.length); // 0-1 係數，分數範圍 0-100

  const result = {
    studentId: state.studentId,
    classCode: state.studentId.slice(0, 3),
    difficulty: state.currentArticle.difficulty || "medium",
    wpm, accuracy: acc, grossAccuracy: grossAcc,
    completion, score, elapsed: Math.round(elapsed),
    completed: completion === 100 && acc >= 80,
    articleTitle: state.currentArticle.title,
    letterStats: { ...state.letterStats },
  };

  if (!validateLetterStats(typed, target)) {
    showInvalidStatsWarning();
    return;
  }

  // Show results
  $("typing-area").style.display = "none";
  $("result-card").style.display = "block";
  $("result-title").textContent  = "考試完成！";
  const grade = score >= 85 ? "優秀" : score >= 70 ? "不錯" : score >= 55 ? "繼續加油" : "多加練習";
  $("result-emoji").textContent     = grade + "（考試）";
  $("res-score").textContent        = score;
  $("res-wpm").textContent          = wpm + " WPM";
  $("res-acc").textContent          = acc + "%";
  $("res-time").textContent         = Math.round(elapsed) + "s";
  $("res-completion-row").style.display         = "";
  $("res-completion").textContent               = completion + "%";
  $("res-completion-factor-row").style.display  = "none";
  $("res-wordcount-row").style.display          = "none";
  $("res-gross-acc").textContent  = grossAcc + "%";
  const dMap2 = { easy: "×0.90（初級）", medium: "×0.95（中級）", hard: "×1.00（高級）" };
  $("res-difficulty").textContent = dMap2[result.difficulty] ?? "×1.00";
  renderSessionChart();
  renderLetterBreakdown(result.letterStats);

  $("btn-submit-exam").style.display = "none";
  $("btn-cancel").style.display      = "";

  const timeRemaining = state.examDeadline ? state.examDeadline - Date.now() : 0;
  const canRetry = !isFinal && timeRemaining > 5000 && state.examArticles;

  $("btn-retry").style.display         = canRetry ? "" : "none";
  $("btn-retry").textContent           = "再選文章";
  $("btn-choose-another").style.display = isFinal ? "none" : "";
  $("btn-choose-another").textContent  = isFinal ? "選其他文章" : "回到練習";

  const examIdToSave = state.examId || state.pendingExam?.id;

  if (isFinal) {
    $("exam-time-chip").style.display = "none";
    state.examMode     = false;
    state.examId       = null;
    state.examDeadline = null;
    state.examArticles = null;
    state.pendingExam  = null;
  }

  if (examIdToSave) {
    savePending(examIdToSave, state.studentId, result);   // 先存本機，確保不掉分
    setExamUploadStatus("uploading");
    const ok = await submitWithRetry(examIdToSave, state.studentId, result);
    if (ok) { clearPending(examIdToSave, state.studentId); setExamUploadStatus("done"); }
    else setExamUploadStatus("pending");
  }

  // 成就檢查（考試模式）
  try {
    await checkAchievements(result, null, true);
  } catch { /* 離線時略過 */ }
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

// ── FONT SIZE ─────────────────────────────────────────────
function initFontSize() {
  applyFontSize(localStorage.getItem("typerbon_font_size") || "md");
}
function applyFontSize(size, persist = true) {
  document.body.dataset.fontSize = size;
  document.querySelectorAll(".fs-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.size === size));
  localStorage.setItem("typerbon_font_size", size);
  if (persist && state.studentId)
    StudentStore.savePreferences(state.studentId, { fontSize: size });
}

// ── PROGRESS BAR ──────────────────────────────────────────
function updateProgressBar(pos, total) {
  const pct = total > 0 ? (pos / total * 100).toFixed(1) : 0;
  $("typing-progress-fill").style.width  = pct + "%";
  $("typing-progress-label").textContent = `${pos} / ${total}`;
}

// ── WPM CHARTS ────────────────────────────────────────────
function chartColors() {
  const s = getComputedStyle(document.body);
  return {
    accent:    s.getPropertyValue("--accent").trim()    || "#f5c842",
    accent2:   s.getPropertyValue("--accent2").trim()   || "#3ecf8e",
    muted:     s.getPropertyValue("--text-muted").trim()|| "#7a8394",
    border:    s.getPropertyValue("--border").trim()    || "#2e333d",
    bg2:       s.getPropertyValue("--bg2").trim()       || "#15171a",
  };
}

function initLiveChart() {
  if (typeof Chart === "undefined") return;
  const canvas = $("wpm-live-chart");
  if (!canvas) return;
  if (state.wpmChart) { state.wpmChart.destroy(); state.wpmChart = null; }
  const c = chartColors();
  state.wpmChart = new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets: [{ label: "WPM", data: [],
      borderColor: c.accent, backgroundColor: c.accent + "25",
      borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4 }] },
    options: {
      animation: { duration: 0 }, responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: c.border + "66" },
             ticks: { color: c.muted, font: { size: 10 } } },
        x: { grid: { color: c.border + "66" },
             ticks: { color: c.muted, font: { size: 10 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function pushWpmPoint(sec, wpm) {
  if (typeof Chart === "undefined") return;
  state.wpmHistory.push({ t: sec, wpm });
  if (!state.wpmChart) return;
  state.wpmChart.data.labels.push(sec + "s");
  state.wpmChart.data.datasets[0].data.push(wpm);
  state.wpmChart.update("none");
  if (state.wpmHistory.length === 1) $("wpm-chart-wrap").style.display = "";
}

function validateLetterStats(typed, target) {
  const portion = target.slice(0, typed.length);
  const expected = {};
  for (const ch of portion) {
    if (/[a-z]/i.test(ch)) {
      const c = ch.toLowerCase();
      expected[c] = (expected[c] || 0) + 1;
    }
  }
  return Object.entries(expected).every(([c, n]) => (state.letterStats[c]?.total || 0) >= n);
}

function showInvalidStatsWarning() {
  $("typing-area").style.display          = "none";
  $("btn-refresh-ref").style.display      = "none";
  $("btn-submit-practice").style.display  = "none";
  $("result-card").style.display = "block";
  $("result-title").textContent  = "成績無效";
  $("result-emoji").textContent  = "按鍵統計異常，本次成績不予計算，請重新練習";
  $("res-score").textContent     = "—";
  $("btn-retry").style.display        = "";
  $("btn-choose-another").style.display = "";
  $("btn-choose-another").textContent = "選其他文章";
  $("btn-submit-exam").style.display  = "none";
  $("btn-cancel").style.display       = "none";
  $("res-completion-row").style.display        = "none";
  $("res-completion-factor-row").style.display = "none";
}

function renderSessionChart() {
  if (typeof Chart === "undefined" || !state.wpmHistory.length) return;
  const canvas = $("wpm-session-chart");
  if (!canvas) return;
  const c = chartColors();
  new Chart(canvas, {
    type: "line",
    data: {
      labels: state.wpmHistory.map(p => p.t + "s"),
      datasets: [{ label: "WPM", data: state.wpmHistory.map(p => p.wpm),
        borderColor: c.accent, backgroundColor: c.accent + "25",
        borderWidth: 2, pointRadius: 3, fill: true, tension: 0.4 }],
    },
    options: {
      animation: { duration: 300 }, responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: c.border + "66" },
             ticks: { color: c.muted, font: { size: 10 } } },
        x: { grid: { color: c.border + "66" },
             ticks: { color: c.muted, font: { size: 10 } } },
      },
      plugins: { legend: { display: false } },
    },
  });
  $("session-chart-wrap").style.display = "";
}

function renderHistoryChart(records) {
  if (typeof Chart === "undefined") return;
  const canvas = $("history-chart");
  const wrap   = $("history-chart-wrap");
  if (!canvas || !wrap) return;
  if (state.historyChart) { state.historyChart.destroy(); state.historyChart = null; }

  const sessions = records.filter(r => !r.isExamResult).slice(0, 20).reverse();
  if (sessions.length < 2) { wrap.style.display = "none"; return; }
  wrap.style.display = "";

  const c = chartColors();
  const labels  = sessions.map(s => formatDate(s.ts).slice(5, 10));
  state.historyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "WPM", data: sessions.map(s => s.wpm),
          borderColor: c.accent,  backgroundColor: c.accent  + "20",
          borderWidth: 2, pointRadius: 3, tension: 0.3, yAxisID: "y" },
        { label: "正確率 %", data: sessions.map(s => s.accuracy),
          borderColor: c.accent2, backgroundColor: c.accent2 + "20",
          borderWidth: 2, pointRadius: 3, tension: 0.3, yAxisID: "y2" },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 12 } },
      scales: {
        y:  { beginAtZero: true, title: { display: true, text: "WPM", color: c.muted },
              grid: { color: c.border + "66" }, ticks: { color: c.muted, font: { size: 10 } } },
        y2: { position: "right", min: 0, max: 100,
              title: { display: true, text: "正確率 %", color: c.muted },
              grid: { display: false }, ticks: { color: c.muted, font: { size: 10 } } },
        x:  { grid: { color: c.border + "66" }, ticks: { color: c.muted, font: { size: 10 } } },
      },
      plugins: { legend: { labels: { color: c.muted, font: { size: 11 } } } },
    },
  });
}

// ── MEDAL SVG ─────────────────────────────────────────────
function medalSvg(count) {
  if (!count) return '';
  const ALL = ACHIEVEMENTS.length;
  const [face, edge] =
      count >= ALL ? ['#E6ECF5', '#9DB0CC']   // 白金（集滿全部）
    : count >= 20  ? ['#FFD700', '#A08000']   // 金
    : count >= 10  ? ['#BEC2CB', '#8E9199']   // 銀
    :                ['#CD7F32', '#8B5A2B'];  // 銅
  const star = 'M50 31 L56.7 44.6 L71.6 46.8 L60.8 57.3 L63.4 72.2 L50 65.2 L36.6 72.2 L39.2 57.3 L28.4 46.8 L43.3 44.6 Z';
  return `<svg class="lb-medal${count >= ALL ? ' lb-medal-plat' : ''}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`
    + `<rect x="18" y="26" width="64" height="58" rx="13" fill="${edge}"/>`
    + `<rect x="18" y="18" width="64" height="58" rx="13" fill="${face}" stroke="${edge}" stroke-width="3"/>`
    + `<path d="${star}" fill="${edge}" opacity=".85"/></svg>`;
}

// ── ACHIEVEMENTS ──────────────────────────────────────────
async function renderAchievements() {
  const wrap = $("ach-page-content");
  if (!wrap || !state.studentId) return;
  const profile = await StudentStore.get(state.studentId);
  const earned  = new Set(profile.achievements || []);
  const total   = ACHIEVEMENTS.length;
  const count   = earned.size;
  const catLabel = { speed:"速度", accuracy:"正確率", persist:"堅持", progress:"進步", exam:"考試", special:"特殊" };

  let html = `<div class="ach-header"><h3 class="breakdown-title">成就</h3><span class="ach-count">${count} / ${total}</span></div>`;

  const byCategory = {};
  ACHIEVEMENTS.forEach(a => { (byCategory[a.category] ??= []).push(a); });

  for (const [cat, list] of Object.entries(byCategory)) {
    html += `<div class="ach-category-label">${catLabel[cat] || cat}</div><div class="ach-grid">`;
    for (const a of list) {
      const isEarned = earned.has(a.id);
      html += `<div class="ach-card ${isEarned ? "ach-earned" : "ach-locked"}">
        ${isEarned ? '<span class="ach-done">完成</span>' : ''}
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${isEarned || !a.hidden ? a.desc : "???"}</div>
      </div>`;
    }
    html += `</div>`;
  }

  html += `<p class="ach-hint">據說拿到夠多成就，名條就會閃閃發光。</p>`;
  wrap.innerHTML = html;
}

async function checkAchievements(session, allSessions, isExam) {
  if (!state.studentId) return;
  const profile  = await StudentStore.get(state.studentId);
  const earned   = new Set(profile.achievements || []);
  const newOnes  = [];

  const award = async id => {
    if (earned.has(id)) return;
    const ok = await StudentStore.awardAchievement(state.studentId, id);
    if (ok) {
      earned.add(id);
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) newOnes.push(ach);
    }
  };

  const wpm   = session.wpm   || 0;
  const acc   = session.accuracy || 0;
  const score = session.score  || 0;

  if (!isExam) {
    // 完成性成就要求真正打完整篇文章且正確率達標（提前交卷或亂打灌滿長度都不算）
    const completed = session.completed === true;

    // ── 速度（需完成整篇）
    if (completed) {
      if (wpm >= 10) await award("speed_10");
      if (wpm >= 15) await award("speed_15");
      if (wpm >= 20) await award("speed_20");
      if (wpm >= 25) await award("speed_25");
      if (wpm >= 30) await award("speed_30");
    }

    // ── 首次練習
    await award("first_session");

    // ── 正確率
    if (session.accuracy === 100) await award("accuracy_100");
    if (completed && session.difficulty === "hard" && session.accuracy === 100) await award("hard_perfect");
    if (allSessions) {
      const recent5 = allSessions.slice(0, 5);
      if (recent5.length >= 5 && recent5.every(r => r.accuracy >= 95))
        await award("accuracy_streak");
    }

    // ── 堅持（只計算真正完成的紀錄；舊紀錄無 completed 欄位 → 視為已完成）
    if (allSessions) {
      const completedSessions = allSessions.filter(r => r.completed !== false);
      const total = completedSessions.length;
      if (total >= 5)   await award("sessions_5");
      if (total >= 20)  await award("sessions_20");
      if (total >= 50)  await award("sessions_50");
      if (total >= 100) await award("sessions_100");
      // 不同日期
      const days = new Set(completedSessions.map(r => new Date(r.ts).toDateString()));
      if (days.size >= 5)  await award("days_5");
      if (days.size >= 10) await award("days_10");
      // 累積完成字數
      const totalWords = completedSessions.reduce((s, r) => s + (r.wordCount || 0), 0);
      if (totalWords >= 5000) await award("words_5000");
      // WPM 最高紀錄（需完成；先前最佳也只取已完成紀錄，避免被灌水 WPM 卡死）
      if (completed && completedSessions.length >= 2) {
        const prevBest = Math.max(0, ...completedSessions.slice(1).map(r => r.wpm || 0));
        if (wpm > prevBest) await award("wpm_record");
      }
    }

    // ── 特殊
    if (session.accuracy === 100 && state.noBackspace) await award("no_backspace");
    if (score % 100 === 67)                             await award("sixseven");
    const wc = countWords(state.currentArticle?.content || "");
    if (completed && wc >= 110) await award("long_article");
    // 完成彩蛋（純長度 completion + 毛正確率，不走 completed）
    if (session.completion === 100 && session.elapsed >= 1200) await award("persevere");
    if (session.completion === 100 && session.grossAccuracy === 0) await award("you_sure");
    if (session.completion === 100 && session.grossAccuracy === 0
        && session.keystrokes === (state.currentArticle?.content?.length ?? -1)) await award("world_wrong");
    // 好笑數字彩蛋（亂打分數 ≈0，自然打不中）
    if (score > 0 && score % 1000 === 0) await award("score_round");
    if (score % 1000 === 520)            await award("score_520");
    if (score % 10000 === 1314)          await award("score_1314");
    const ss = String(score);
    if (ss.length >= 3 && ss === [...ss].reverse().join("")) await award("score_palindrome");
  } else {
    // ── 考試
    await award("exam_first");
    if (score >= 85)  await award("exam_excellent");
    if (score >= 100) await award("exam_perfect");
    if (session.difficulty === "hard" && session.completed) await award("exam_hard");
    if (session.completed && session.wpm >= 20) await award("exam_speed");

    // 不慌不忙：考試完整作答（正確率達標）且剩 30% 時間
    const deadline  = state.examDeadline;
    const totalTime = 15 * 60 * 1000;
    if (deadline) {
      const remaining = deadline - Date.now();
      if (session.completed && remaining >= totalTime * 0.30) await award("exam_early");
    }

    // 控分傳奇
    const rg = Math.round(session.grossAccuracy ?? 0);
    const rn = Math.round(session.accuracy ?? 0);
    const rc = Math.round(session.completion ?? 0);
    const rs = Math.round(score);
    if (rg === rn && rn === rc && rc === rs) await award("perfect_match");

    // sixseven 也在考試觸發
    if (score % 100 === 67) await award("sixseven");

    // no_backspace 在考試也觸發（需完整作答且全對）
    if (session.completion === 100 && session.accuracy === 100 && state.noBackspace) await award("no_backspace");
  }

  // 逐一顯示 toast
  for (const ach of newOnes) {
    showAchievementToast(ach);
    await new Promise(r => setTimeout(r, 1800));
  }
}

function checkThemeAllAchievement(currentTheme) {
  // 主題探索家：把用過的主題記在 localStorage，切齊六種才解鎖
  const ALL_THEMES = ["dark","light","twilight","jersey","light-purple","dark-purple"];
  const key  = "typerbon_tried_themes";
  const tried = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  tried.add(currentTheme);
  localStorage.setItem(key, JSON.stringify([...tried]));
  if (tried.size >= ALL_THEMES.length && state.studentId) {
    StudentStore.awardAchievement(state.studentId, "theme_all").then(ok => {
      if (ok) showAchievementToast(ACHIEVEMENTS.find(a => a.id === "theme_all"));
    });
  }
}

function showAchievementToast(ach) {
  if (!ach) return;
  let el = document.getElementById("achievement-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "achievement-toast";
    document.body.appendChild(el);
  }
  // Build with textContent to prevent XSS if achievement name is ever compromised
  el.innerHTML = `
    <div class="ach-tc ach-tc-tl"></div><div class="ach-tc ach-tc-tr"></div>
    <div class="ach-tc ach-tc-bl"></div><div class="ach-tc ach-tc-br"></div>
    <span class="ach-toast-label">// 成就解鎖</span>
    <span class="ach-toast-name"></span>`;
  el.querySelector(".ach-toast-name").textContent = ach.name;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

// ── THEME ─────────────────────────────────────────────────
function initTheme() {
  applyTheme(localStorage.getItem("typerbon_theme") || "dark", false);
}
function applyTheme(theme, persist = true) {
  document.body.dataset.theme = theme;
  const sel = $("theme-select");
  if (sel) sel.value = theme;
  localStorage.setItem("typerbon_theme", theme);
  if (persist && state.studentId)
    StudentStore.savePreferences(state.studentId, { theme });
  // 主題探索家成就：切換主題時檢查是否集齊六種
  if (persist && state.studentId) checkThemeAllAchievement(theme);
}

// ── CONTENT NORMALISATION ─────────────────────────────────
// Replaces typographic characters with ASCII equivalents so
// keyboard input always matches the reference text.
function normalizeContent(text) {
  return text
    .replace(/[''ʼ]/g, "'")
    .replace(/[""]/g,   '"')
    .replace(/—/g,      '--')
    .replace(/–/g,      '-')
    .replace(/…/g,      '...')
    .replace(/ /g,      ' ');   // non-breaking space → space
}

