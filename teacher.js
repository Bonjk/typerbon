/**
 * teacher.js — 教師後台邏輯（Firebase 版）
 */
import { ArticleStore, RecordStore, ExamStore, TeacherAuth,
         countWords, formatDate, validateStudentId, showToast } from "./data.js";

const teacherState = { editingId: null, leaderboardCache: null, examArticles: null };
const $ = id => document.getElementById(id);

function initTheme() {
  applyTheme(localStorage.getItem("typerbon_theme") || "dark");
}
function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const sel = document.getElementById("theme-select");
  if (sel) sel.value = theme;
  localStorage.setItem("typerbon_theme", theme);
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  $("theme-select").addEventListener("change", e => applyTheme(e.target.value));

  $("btn-teacher-login").addEventListener("click", handleTeacherLogin);
  $("teacher-pw").addEventListener("keydown", e => { if (e.key === "Enter") handleTeacherLogin(); });
  $("btn-teacher-logout").addEventListener("click", () => {
    $("teacher-dashboard").style.display = "none";
    $("teacher-login").classList.add("active");
    $("teacher-pw").value = "";
    teacherState.leaderboardCache = null;
  });

  document.querySelectorAll("[data-teacher-tab]").forEach(tab =>
    tab.addEventListener("click", () => switchTeacherTab(tab.dataset.teacherTab)));

  $("btn-add-article").addEventListener("click", () => openEditor(null));
  $("btn-save-article").addEventListener("click", saveArticle);
  $("btn-cancel-edit").addEventListener("click", closeEditor);
  $("ed-content").addEventListener("input", updateWordCount);

  $("btn-records-class").addEventListener("click", () => switchRecordsMode("class"));
  $("btn-records-individual").addEventListener("click", () => switchRecordsMode("individual"));
  $("select-class").addEventListener("change", () => {
    const val = $("select-class").value;
    if (val) queryClass(val);
    else $("student-records-result").innerHTML = "";
  });
  $("btn-query-student").addEventListener("click", queryStudent);
  $("query-student-id").addEventListener("keydown", e => { if (e.key === "Enter") queryStudent(); });
  $("btn-export-all").addEventListener("click", exportAllCSV);

  $("btn-change-pw").addEventListener("click", changePassword);
  $("btn-delete-student-records").addEventListener("click", deleteStudentRecords);
  $("btn-start-exam").addEventListener("click", startExam);

  $("btn-lb-query").addEventListener("click", () => {
    const cls = $("lb-class-filter").value.trim();
    renderTeacherLeaderboard(cls || null);
  });
  $("lb-class-filter").addEventListener("keydown", e => {
    if (e.key === "Enter") { const cls = $("lb-class-filter").value.trim(); renderTeacherLeaderboard(cls || null); }
  });
  $("btn-lb-all").addEventListener("click", () => renderTeacherLeaderboard(null));
});

// ── TAB SWITCHING ──────────────────────────────────────────
function switchTeacherTab(name) {
  document.querySelectorAll("[data-teacher-tab]").forEach(t =>
    t.classList.toggle("active", t.dataset.teacherTab === name));
  ["articles", "records", "leaderboard", "settings", "exam"].forEach(t => {
    const el = document.getElementById(`teacher-tab-${t}`);
    if (el) el.classList.toggle("active", t === name);
  });
  if (name === "articles")    renderTeacherArticleList();
  if (name === "records")     loadClassDropdown();
  if (name === "leaderboard") renderTeacherLeaderboard(null);
  if (name === "exam")        loadExamTab();
}

// ── LOGIN ──────────────────────────────────────────────────
async function handleTeacherLogin() {
  const pw = $("teacher-pw").value;
  if (!pw) { $("teacher-login-error").textContent = "請輸入密碼"; return; }

  const btn = $("btn-teacher-login");
  btn.disabled = true;
  btn.textContent = "驗證中...";

  try {
    const ok = await TeacherAuth.check(pw);
    if (!ok) { $("teacher-login-error").textContent = "密碼錯誤"; return; }
    $("teacher-login-error").textContent = "";
    $("teacher-login").classList.remove("active");
    $("teacher-dashboard").style.display = "block";
    switchTeacherTab("articles");
  } finally {
    btn.disabled = false;
    btn.textContent = "進入後台";
  }
}

// ── ARTICLES ───────────────────────────────────────────────
async function renderTeacherArticleList() {
  const list = $("teacher-article-list");
  list.innerHTML = `<div class="loading-state">載入中...</div>`;
  const articles = await ArticleStore.getAll();

  if (!articles.length) {
    list.innerHTML = `<div class="empty-state">目前沒有文章，請新增。</div>`;
    return;
  }

  list.innerHTML = articles.map(a => {
    const diffLabel = { easy: "初級", medium: "中級", hard: "高級" }[a.difficulty] || a.difficulty;
    const isDef = ArticleStore.isDefault(a);
    return `
      <div class="ta-row">
        <div style="flex:1;min-width:0">
          <div class="ta-row-title">${escHtml(a.title)}</div>
          <div class="ta-row-meta">
            <span class="badge badge-${a.difficulty}">${diffLabel}</span>
            &nbsp;${countWords(a.content)} 字
            ${isDef ? '<span style="color:var(--text-dim);font-size:.72rem"> · 預設</span>' : ''}
          </div>
        </div>
        <button class="ta-btn-edit" data-edit="${escHtml(a.id)}">編輯</button>
        <button class="ta-btn-del" data-del="${escHtml(a.id)}" title="刪除">×</button>
      </div>`;
  }).join("");

  list.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEditor(btn.dataset.edit)));
  list.querySelectorAll("[data-del]").forEach(btn =>
    btn.addEventListener("click", () => deleteArticle(btn.dataset.del)));
}

function openEditor(articleId) {
  teacherState.editingId = articleId;
  if (articleId) {
    ArticleStore.getAll().then(articles => {
      const a = articles.find(x => x.id === articleId);
      if (!a) return;
      $("editor-title-label").textContent = "編輯文章";
      $("ed-title").value = a.title;
      $("ed-difficulty").value = a.difficulty;
      $("ed-content").value = a.content;
      updateWordCount();
    });
  } else {
    $("editor-title-label").textContent = "新增文章";
    $("ed-title").value = "";
    $("ed-difficulty").value = "medium";
    $("ed-content").value = "";
    updateWordCount();
  }
  $("editor-error").textContent = "";
  $("teacher-editor").style.display = "block";
  $("ed-title").focus();
}

function closeEditor() {
  $("teacher-editor").style.display = "none";
  teacherState.editingId = null;
}

function updateWordCount() {
  const wc = countWords($("ed-content").value || "");
  $("ed-word-count").textContent = `${wc} 個單字`;
  $("ed-word-count").style.color = (wc < 50 || wc > 500) ? "var(--warn)" : "var(--text-muted)";
}

async function saveArticle() {
  const title   = $("ed-title").value.trim();
  const content = $("ed-content").value.trim();
  const diff    = $("ed-difficulty").value;
  const errEl   = $("editor-error");

  if (!title)   { errEl.textContent = "請輸入文章標題"; return; }
  if (!content) { errEl.textContent = "請輸入文章內容"; return; }
  if (countWords(content) < 10) { errEl.textContent = "文章至少需要 10 個單字"; return; }

  errEl.textContent = "";
  $("btn-save-article").textContent = "儲存中...";
  $("btn-save-article").disabled = true;

  try {
    if (teacherState.editingId) {
      const articles = await ArticleStore.getAll();
      const a = articles.find(x => x.id === teacherState.editingId);
      if (a && ArticleStore.isDefault(a)) {
        await ArticleStore.add({ title, difficulty: diff, content });
        showToast("已另存為新文章（預設文章不修改）");
      } else {
        await ArticleStore.update({ id: teacherState.editingId, title, difficulty: diff, content });
        showToast("文章已更新");
      }
    } else {
      await ArticleStore.add({ title, difficulty: diff, content });
      showToast("文章已新增");
    }
    closeEditor();
    renderTeacherArticleList();
  } catch (e) {
    errEl.textContent = "儲存失敗：" + e.message;
  } finally {
    $("btn-save-article").textContent = "儲存";
    $("btn-save-article").disabled = false;
  }
}

async function deleteArticle(id) {
  const articles = await ArticleStore.getAll();
  const a = articles.find(x => x.id === id);
  if (!a) return;
  const msg = ArticleStore.isDefault(a)
    ? `「${a.title}」是預設文章，刪除後無法還原，確定要刪除嗎？`
    : `確定要刪除「${a.title}」嗎？`;
  if (!confirm(msg)) return;
  await ArticleStore.delete(id);
  showToast("已刪除");
  renderTeacherArticleList();
  if (teacherState.editingId === id) closeEditor();
}

// ── RECORDS ────────────────────────────────────────────────
function switchRecordsMode(mode) {
  $("btn-records-class").classList.toggle("active", mode === "class");
  $("btn-records-individual").classList.toggle("active", mode === "individual");
  $("records-class-panel").style.display = mode === "class" ? "" : "none";
  $("records-individual-panel").style.display = mode === "individual" ? "" : "none";
  $("student-records-result").innerHTML = "";
}

async function loadClassDropdown() {
  const select = $("select-class");
  select.innerHTML = `<option value="">載入中...</option>`;
  teacherState.leaderboardCache = await RecordStore.getAllLeaderboard();
  const classes = [...new Set(
    teacherState.leaderboardCache
      .map(r => r.classCode || (r.studentId ? r.studentId.slice(0, 3) : null))
      .filter(Boolean)
  )].sort();
  if (!classes.length) {
    select.innerHTML = `<option value="">目前無學生資料</option>`;
    return;
  }
  select.innerHTML = `<option value="">請選擇班級...</option>` +
    classes.map(c => `<option value="${c}">${c} 班</option>`).join("");
  $("student-records-result").innerHTML = "";
}

async function queryClass(classCode) {
  const resultEl = $("student-records-result");
  resultEl.innerHTML = `<div class="loading-state">查詢中...</div>`;

  const all = teacherState.leaderboardCache || await RecordStore.getAllLeaderboard();
  const students = all
    .filter(r => (r.classCode || r.studentId?.slice(0, 3)) === classCode)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  if (!students.length) {
    resultEl.innerHTML = `<div class="sr-header">${escHtml(classCode)} 班</div>
      <div class="empty-state">此班級尚無練習紀錄</div>`;
    return;
  }

  const avgScore = Math.round(students.reduce((s, r) => s + (r.bestScore || 0), 0) / students.length);
  const avgWpm   = Math.round(students.reduce((s, r) => s + (r.bestWpm   || 0), 0) / students.length);
  const avgAcc   = Math.round(students.reduce((s, r) => s + (r.bestAcc   || 0), 0) / students.length);

  resultEl.innerHTML = `
    <div class="sr-header">${escHtml(classCode)} 班 — 共 ${students.length} 位同學有成績</div>
    <div class="history-summary" style="margin-bottom:14px">
      <div class="hs-card"><div class="hs-label">有成績人數</div><div class="hs-val">${students.length}</div></div>
      <div class="hs-card"><div class="hs-label">平均最高分</div><div class="hs-val">${avgScore}</div></div>
      <div class="hs-card"><div class="hs-label">平均 WPM</div><div class="hs-val">${avgWpm}</div></div>
      <div class="hs-card"><div class="hs-label">平均正確率</div><div class="hs-val">${avgAcc}%</div></div>
    </div>
    <div class="lb-header">
      <span class="lb-rank">名次</span>
      <span class="lb-id">班級座號</span>
      <span class="lb-score">最高分</span>
      <span class="lb-wpm">WPM</span>
      <span class="lb-acc">正確率</span>
    </div>
    ${students.map(r => `
      <div class="lb-row lb-row-clickable" data-sid="${escHtml(r.studentId)}">
        <span class="lb-rank">${r.rank}</span>
        <span class="lb-id">${escHtml(r.studentId)}</span>
        <span class="lb-score">${r.bestScore}</span>
        <span class="lb-wpm">${r.bestWpm}</span>
        <span class="lb-acc">${r.bestAcc}%</span>
      </div>`).join("")}
    <p class="records-hint">點擊學生列可查看個人詳細紀錄</p>`;

  resultEl.querySelectorAll(".lb-row-clickable").forEach(row =>
    row.addEventListener("click", () => {
      switchRecordsMode("individual");
      $("query-student-id").value = row.dataset.sid;
      queryStudent();
    })
  );
}

async function queryStudent() {
  const id = $("query-student-id").value.trim();
  const resultEl = $("student-records-result");
  if (!id) { resultEl.innerHTML = `<div class="input-error">請輸入班級座號</div>`; return; }

  resultEl.innerHTML = `<div class="loading-state">查詢中...</div>`;
  const records = await RecordStore.getByStudent(id);

  if (!records.length) {
    resultEl.innerHTML = `<div class="sr-header">班級座號：${escHtml(id)}</div>
      <div class="empty-state">此學生尚無練習紀錄</div>`;
    return;
  }

  const avgScore  = Math.round(records.reduce((s, r) => s + r.score, 0) / records.length);
  const bestScore = Math.max(...records.map(r => r.score));
  const avgWpm    = Math.round(records.reduce((s, r) => s + r.wpm, 0) / records.length);
  const avgAcc    = Math.round(records.reduce((s, r) => s + r.accuracy, 0) / records.length);

  resultEl.innerHTML = `
    <div class="sr-header">班級座號：${escHtml(id)} — 共 ${records.length} 次練習</div>
    <div class="history-summary" style="margin-bottom:14px">
      <div class="hs-card"><div class="hs-label">平均分數</div><div class="hs-val">${avgScore}</div></div>
      <div class="hs-card"><div class="hs-label">最高分數</div><div class="hs-val">${bestScore}</div></div>
      <div class="hs-card"><div class="hs-label">平均 WPM</div><div class="hs-val">${avgWpm}</div></div>
      <div class="hs-card"><div class="hs-label">平均正確率</div><div class="hs-val">${avgAcc}%</div></div>
    </div>
    <div class="history-list">
      ${records.map(r => `
        <div class="history-row">
          <span class="hr-date">${formatDate(r.ts)}</span>
          <span class="hr-title">${escHtml(r.articleTitle)}</span>
          <span class="hr-score">分 ${r.score}</span>
          <span class="hr-wpm">${r.wpm} WPM</span>
          <span class="hr-acc">${r.accuracy}%</span>
        </div>`).join("")}
    </div>`;
}

async function exportAllCSV() {
  const btn = $("btn-export-all");
  btn.textContent = "匯出中...";
  btn.disabled = true;

  try {
    const rows = await RecordStore.getAllRecordsFlat();
    if (!rows.length) { showToast("目前沒有任何學生紀錄"); return; }

    const headers = ["班級座號","練習日期","文章標題","分數","WPM","正確率(%)","花費時間(s)"];
    const lines = [headers, ...rows.map(r => [
      r.studentId, formatDate(r.ts), r.articleTitle,
      r.score, r.wpm, r.accuracy, r.elapsed
    ])].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));

    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `typerbon_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("CSV 已匯出");
  } catch(e) {
    showToast("匯出失敗：" + e.message);
  } finally {
    btn.textContent = "匯出 CSV";
    btn.disabled = false;
  }
}

// ── DELETE STUDENT ────────────────────────────────────────
async function deleteStudentRecords() {
  const id    = $("delete-student-id").value.trim();
  const errEl = $("delete-student-error");
  if (!/^\d{5}$/.test(id)) { errEl.textContent = "請輸入五碼數字班級座號"; return; }
  if (!confirm(`確定要刪除 ${id} 的所有練習紀錄？此操作無法還原。`)) return;
  errEl.textContent = "";
  const btn = $("btn-delete-student-records");
  btn.disabled = true;
  btn.textContent = "刪除中...";
  try {
    await RecordStore.deleteStudent(id);
    showToast(`${id} 的紀錄已全部刪除`);
    $("delete-student-id").value = "";
    teacherState.leaderboardCache = null;
  } catch (e) {
    errEl.textContent = "刪除失敗：" + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "刪除全部紀錄";
  }
}

// ── PASSWORD ───────────────────────────────────────────────
async function changePassword() {
  const newPw     = $("new-pw").value;
  const confirmPw = $("confirm-pw").value;
  const errEl     = $("pw-change-error");
  if (!newPw)              { errEl.textContent = "請輸入新密碼"; return; }
  if (newPw.length < 6)   { errEl.textContent = "密碼至少需要 6 個字元"; return; }
  if (newPw !== confirmPw) { errEl.textContent = "兩次輸入的密碼不一致"; return; }
  errEl.textContent = "";
  try {
    await TeacherAuth.setPassword(newPw);
    showToast("密碼已更新");
    $("new-pw").value = "";
    $("confirm-pw").value = "";
  } catch (e) {
    errEl.textContent = "更新失敗：" + e.message;
  }
}

// ── LEADERBOARD ────────────────────────────────────────────
async function renderTeacherLeaderboard(classCode) {
  const el = $("teacher-leaderboard-result");
  el.innerHTML = `<div class="loading-state">載入排行榜...</div>`;

  const all = await RecordStore.getAllLeaderboard();
  const rows = classCode
    ? all.filter(r => r.studentId && r.studentId.startsWith(classCode))
        .map((r, i) => ({ ...r, rank: i + 1 }))
    : all;

  if (!rows.length) {
    const msg = classCode ? `${escHtml(classCode)} 班尚無成績紀錄` : "尚無任何成績";
    el.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  const title = classCode
    ? `${escHtml(classCode)} 班排行榜（共 ${rows.length} 人）`
    : `全部排行榜（共 ${rows.length} 人）`;

  el.innerHTML = `
    <div class="sr-header">${title}</div>
    <div class="lb-header">
      <span class="lb-rank">名次</span>
      <span class="lb-id">班級座號</span>
      <span class="lb-score">最高分</span>
      <span class="lb-wpm">WPM</span>
      <span class="lb-acc">正確率</span>
    </div>
    ${rows.map(r => `
      <div class="lb-row">
        <span class="lb-rank">${r.rank}</span>
        <span class="lb-id">${escHtml(r.studentId)}</span>
        <span class="lb-score">${r.bestScore}</span>
        <span class="lb-wpm">${r.bestWpm}</span>
        <span class="lb-acc">${r.bestAcc}%</span>
      </div>`).join("")}`;
}

// ── EXAM ───────────────────────────────────────────────────
async function loadExamTab() {
  const articles = await ArticleStore.getAll();
  teacherState.examArticles = articles;

  const byDiff = d => articles.filter(a => a.difficulty === d);
  const fillSelect = (id, list) => {
    $(id).innerHTML = `<option value="">請選擇...</option>` +
      list.map(a => `<option value="${escHtml(a.id)}">${escHtml(a.title)}（${countWords(a.content)} 字）</option>`).join("");
  };
  fillSelect("exam-article-easy",   byDiff("easy"));
  fillSelect("exam-article-medium", byDiff("medium"));
  fillSelect("exam-article-hard",   byDiff("hard"));

  const exam = await ExamStore.getCurrent();
  renderExamCurrentStatus(exam);
  loadExamRecords();
}

function renderExamCurrentStatus(exam) {
  const panel = $("exam-current-panel");
  const container = $("exam-results-container");

  if (!exam) {
    panel.style.display = "none";
    container.innerHTML = "";
    return;
  }

  const isActive = exam.status === "active";
  const arts = exam.articles || {};
  const artInfo = ["easy", "medium", "hard"].map(d => {
    const label = { easy: "初級", medium: "中級", hard: "高級" }[d];
    return arts[d] ? `${label}: ${escHtml(arts[d].title)}` : "";
  }).filter(Boolean).join("　");

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="exam-status-bar">
      <span class="badge badge-${isActive ? "hard" : "medium"}">${isActive ? "進行中" : "已結束"}</span>
      <strong>${escHtml(exam.classCode)} 班</strong>
      <span style="color:var(--text-muted);font-size:.82rem">${artInfo}</span>
      ${isActive ? `<button class="btn-danger btn-sm" id="btn-end-exam" style="margin-left:auto">結束考試</button>` : ""}
    </div>
    ${isActive ? `
    <div style="margin-top:12px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
      <div class="input-group" style="flex:0 0 auto;min-width:180px">
        <label>指定學生重設全部</label>
        <input type="text" id="reset-student-id" maxlength="5" placeholder="五碼座號，如 80201" />
      </div>
      <button class="btn-danger btn-sm" id="btn-reset-student-by-id" style="margin-bottom:1px">重設全部</button>
      <span class="input-error" id="reset-student-error" style="align-self:center"></span>
    </div>` : ""}`;

  if (isActive) {
    $("btn-end-exam").addEventListener("click", async () => {
      if (!confirm("確定要結束考試？學生將無法繼續加入。")) return;
      try {
        await ExamStore.saveRecord(exam.id);
      } catch(e) {
        showToast("成績記錄儲存失敗：" + e.message);
      }
      await ExamStore.end();
      showToast("考試已結束，成績已儲存");
      loadExamTab();
    });
    $("btn-reset-student-by-id").addEventListener("click", () => resetStudentById(exam.id));
  }

  loadExamResults(exam.id);
}

async function loadExamResults(examId) {
  const container = $("exam-results-container");
  container.innerHTML = `<div class="loading-state">載入成績中...</div>`;

  const allResults = await ExamStore.getResults(examId);
  if (!allResults.length) {
    container.innerHTML = `<div class="empty-state">目前尚無學生提交成績</div>`;
    return;
  }

  renderExamResultsTable(examId, allResults, "");
}

function renderExamResultsTable(examId, allResults, classFilter) {
  const container = $("exam-results-container");
  const filtered  = classFilter
    ? allResults.filter(r => r.studentId?.startsWith(classFilter))
    : allResults;

  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };

  container.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <span class="sr-header" style="margin:0">考試成績 — 共 ${allResults.length} 人提交</span>
      <input type="text" id="exam-result-class-filter"
             placeholder="班級篩選（三碼）" maxlength="3"
             value="${escHtml(classFilter)}"
             style="width:130px;padding:5px 10px;font-size:.82rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--font-mono)" />
      <button class="btn-secondary btn-sm" id="btn-exam-filter-apply">篩選</button>
      ${classFilter ? `<button class="btn-secondary btn-sm" id="btn-exam-filter-clear">清除</button>` : ""}
      <button class="btn-secondary btn-sm" id="btn-exam-export-excel" style="margin-left:auto">匯出 Excel</button>
    </div>
    ${classFilter ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">顯示 ${filtered.length} / ${allResults.length} 筆</div>` : ""}
    <div class="exam-grid lb-header">
      <span>名次</span><span>班級座號</span><span>難度</span>
      <span>分數</span><span>WPM</span><span>淨正確率</span><span>毛正確率</span><span>完成度</span><span>操作</span>
    </div>
    ${filtered.map((r, idx) => `
      <div class="exam-grid lb-row">
        <span class="lb-rank">${idx + 1}</span>
        <span class="lb-id">${escHtml(r.studentId)}</span>
        <span style="font-size:.78rem;color:var(--text-muted)">${diffLabel[r.difficulty] || "—"}</span>
        <span class="lb-score">${r.score}</span>
        <span class="lb-wpm">${r.wpm} WPM</span>
        <span class="lb-acc">${r.accuracy}%</span>
        <span class="lb-acc">${r.grossAccuracy != null ? r.grossAccuracy + "%" : "—"}</span>
        <span class="lb-acc">${r.completion}%</span>
        <button class="ta-btn-del" data-retake="${escHtml(r.studentId)}" title="重設全部">重設</button>
      </div>`).join("")}`;

  container.querySelectorAll("[data-retake]").forEach(btn =>
    btn.addEventListener("click", () => retakeStudent(examId, btn.dataset.retake)));

  $("btn-exam-filter-apply").addEventListener("click", () =>
    renderExamResultsTable(examId, allResults, $("exam-result-class-filter").value.trim()));
  $("exam-result-class-filter").addEventListener("keydown", e => {
    if (e.key === "Enter")
      renderExamResultsTable(examId, allResults, $("exam-result-class-filter").value.trim());
  });
  const clearBtn = $("btn-exam-filter-clear");
  if (clearBtn) clearBtn.addEventListener("click", () => renderExamResultsTable(examId, allResults, ""));
  $("btn-exam-export-excel").addEventListener("click", () =>
    exportExamExcel(examId, filtered, classFilter));
}

function exportExamExcel(examId, results, classFilter) {
  if (typeof XLSX === "undefined") {
    showToast("Excel 函式庫尚未載入，請確認網路連線後重新整理");
    return;
  }
  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };
  const rows = results.map((r, i) => ({
    名次:    i + 1,
    班級座號: r.studentId,
    班級:    r.studentId?.slice(0, 3) || "",
    難度:    diffLabel[r.difficulty] || r.difficulty || "",
    分數:    r.score,
    WPM:    r.wpm,
    淨正確率: r.accuracy != null ? r.accuracy + "%" : "",
    毛正確率: r.grossAccuracy != null ? r.grossAccuracy + "%" : "",
    完成度:  r.completion != null ? r.completion + "%" : "",
    花費秒數: r.elapsed,
    文章名稱: r.articleTitle || "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "考試成績");
  const suffix = classFilter ? `_${classFilter}班` : "_全部";
  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `考試成績${suffix}_${ts}.xlsx`);
}

async function retakeStudent(examId, studentId) {
  if (!confirm(`確定要重設 ${studentId} 的考試狀態？成績將被清除，可重新進入考試。`)) return;
  try {
    await ExamStore.resetStudentFull(examId, studentId);
    showToast(`${studentId} 已重設，可重新進入考試`);
    loadExamResults(examId);
  } catch(e) {
    showToast("操作失敗：" + e.message);
  }
}

async function resetStudentById(examId) {
  const id    = $("reset-student-id").value.trim();
  const errEl = $("reset-student-error");
  if (!/^\d{5}$/.test(id)) { errEl.textContent = "請輸入五碼數字"; return; }
  if (!confirm(`確定要重設 ${id} 的考試狀態？成績將被清除，可重新進入考試。`)) return;
  errEl.textContent = "";
  try {
    await ExamStore.resetStudentFull(examId, id);
    showToast(`${id} 已重設，可重新進入考試`);
    $("reset-student-id").value = "";
    loadExamResults(examId);
  } catch(e) {
    errEl.textContent = "操作失敗：" + e.message;
  }
}

async function startExam() {
  const classCode = $("exam-class-code").value.trim();
  const easyId    = $("exam-article-easy").value;
  const mediumId  = $("exam-article-medium").value;
  const hardId    = $("exam-article-hard").value;
  const errEl     = $("exam-start-error");

  if (!/^\d{3}$/.test(classCode)) { errEl.textContent = "請輸入三碼數字班級代碼"; return; }
  if (!easyId)   { errEl.textContent = "請選擇初級文章"; return; }
  if (!mediumId) { errEl.textContent = "請選擇中級文章"; return; }
  if (!hardId)   { errEl.textContent = "請選擇高級文章"; return; }
  errEl.textContent = "";

  const find = id => teacherState.examArticles?.find(a => a.id === id);
  const easy = find(easyId), medium = find(mediumId), hard = find(hardId);
  if (!easy || !medium || !hard) { errEl.textContent = "找不到文章資料，請重新整理頁面"; return; }

  const btn = $("btn-start-exam");
  btn.disabled = true;
  btn.textContent = "開始中...";
  try {
    await ExamStore.start(classCode, { easy, medium, hard });
    showToast(`${classCode} 班考試已開始`);
    $("exam-class-code").value = "";
    loadExamTab();
  } catch (e) {
    errEl.textContent = "開始失敗：" + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "開始考試";
  }
}

// ── EXAM RECORDS ───────────────────────────────────────────
async function loadExamRecords() {
  const container = $("exam-records-list");
  if (!container) return;
  container.innerHTML = `<div class="loading-state">載入考試記錄中...</div>`;

  let records;
  try {
    records = await ExamStore.getRecords();
  } catch {
    container.innerHTML = `<div class="empty-state">無法載入考試記錄，請確認 Firestore 規則已包含 examRecords 集合。</div>`;
    return;
  }

  if (!records.length) {
    container.innerHTML = `<div class="empty-state">尚無考試記錄</div>`;
    return;
  }

  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };

  container.innerHTML = records.map(rec => {
    const endedAt = rec.endedAt?.toDate?.() ?? null;
    const dateStr = endedAt
      ? endedAt.toLocaleDateString("zh-TW") + " " + endedAt.toLocaleTimeString("zh-TW", { hour:"2-digit", minute:"2-digit" })
      : "—";
    const arts = Object.values(rec.articles || {}).map(a =>
      `<span style="color:var(--text-muted);font-size:.78rem">${diffLabel[a.difficulty] || "—"}：${escHtml(a.title)}</span>`
    ).join("　");

    return `
      <div class="exam-record-card" data-id="${escHtml(rec.examId)}">
        <div class="erc-header">
          <div class="erc-meta">
            <span class="erc-class">${escHtml(rec.classCode)} 班</span>
            <span class="erc-date">${dateStr}</span>
            <span class="erc-count">${rec.studentCount ?? 0} 人提交</span>
          </div>
          <div class="erc-arts">${arts}</div>
          <button class="btn-secondary btn-sm erc-toggle">展開</button>
        </div>
        <div class="erc-body" style="display:none">
          ${renderRecordResults(rec)}
          <button class="btn-secondary btn-sm erc-export" style="margin-top:10px">匯出 Excel</button>
        </div>
      </div>`;
  }).join("");

  container.querySelectorAll(".erc-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const body = btn.closest(".exam-record-card").querySelector(".erc-body");
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "block";
      btn.textContent = open ? "展開" : "收起";
    });
  });

  container.querySelectorAll(".erc-export").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".exam-record-card");
      const rec  = records.find(r => r.examId === card.dataset.id);
      if (rec) exportRecordExcel(rec);
    });
  });
}

function renderRecordResults(rec) {
  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };
  if (!rec.results?.length) return `<div class="empty-state">無提交成績</div>`;
  return `
    <div class="exam-grid lb-header" style="margin-top:10px">
      <span>名次</span><span>班級座號</span><span>難度</span>
      <span>分數</span><span>WPM</span><span>淨正確率</span><span>毛正確率</span><span>完成度</span><span></span>
    </div>
    ${rec.results.map((r, i) => `
      <div class="exam-grid lb-row">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-id">${escHtml(r.studentId)}</span>
        <span style="font-size:.78rem;color:var(--text-muted)">${diffLabel[r.difficulty] || "—"}</span>
        <span class="lb-score">${r.score}</span>
        <span class="lb-wpm">${r.wpm} WPM</span>
        <span class="lb-acc">${r.accuracy}%</span>
        <span class="lb-acc">${r.grossAccuracy != null ? r.grossAccuracy + "%" : "—"}</span>
        <span class="lb-acc">${r.completion}%</span>
        <span></span>
      </div>`).join("")}`;
}

function exportRecordExcel(rec) {
  if (typeof XLSX === "undefined") { showToast("Excel 函式庫未載入"); return; }
  const diffLabel = { easy: "初級", medium: "中級", hard: "高級" };
  const endedAt = rec.endedAt?.toDate?.();
  const dateStr = endedAt ? endedAt.toISOString().slice(0, 10) : "unknown";
  const rows = (rec.results || []).map((r, i) => ({
    名次: i + 1, 班級座號: r.studentId, 班級: r.studentId?.slice(0, 3) || "",
    難度: diffLabel[r.difficulty] || "", 分數: r.score, WPM: r.wpm,
    淨正確率: r.accuracy != null ? r.accuracy + "%" : "",
    毛正確率: r.grossAccuracy != null ? r.grossAccuracy + "%" : "",
    完成度: r.completion != null ? r.completion + "%" : "",
    花費秒數: r.elapsed, 文章名稱: r.articleTitle || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "考試成績");
  XLSX.writeFile(wb, `考試記錄_${rec.classCode}班_${dateStr}.xlsx`);
}

// ── UTILS ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
