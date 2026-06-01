/**
 * teacher.js — 教師後台邏輯（Firebase 版）
 */
import { ArticleStore, RecordStore, TeacherAuth,
         countWords, formatDate, showToast } from "./data.js";

const teacherState = { editingId: null, leaderboardCache: null };
const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
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
  ["articles", "records", "leaderboard", "settings"].forEach(t => {
    const el = document.getElementById(`teacher-tab-${t}`);
    if (el) el.classList.toggle("active", t === name);
  });
  if (name === "articles")    renderTeacherArticleList();
  if (name === "records")     loadClassDropdown();
  if (name === "leaderboard") renderTeacherLeaderboard(null);
}

// ── LOGIN ──────────────────────────────────────────────────
async function handleTeacherLogin() {
  const pw = $("teacher-pw").value;
  if (!pw) { $("teacher-login-error").textContent = "請輸入密碼"; return; }
  const ok = await TeacherAuth.check(pw);
  if (!ok) { $("teacher-login-error").textContent = "密碼錯誤"; return; }
  $("teacher-login-error").textContent = "";
  $("teacher-login").classList.remove("active");
  $("teacher-dashboard").style.display = "block";
  switchTeacherTab("articles");
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

// ── UTILS ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
