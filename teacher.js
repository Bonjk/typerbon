/**
 * teacher.js — 教師後台邏輯
 */

// ── STATE ─────────────────────────────────────────────────
const teacherState = {
  editingId: null,   // null = new article, string = editing existing
};

// ── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  $("btn-teacher-login").addEventListener("click", handleTeacherLogin);
  $("teacher-pw").addEventListener("keydown", e => {
    if (e.key === "Enter") handleTeacherLogin();
  });
  $("btn-teacher-logout").addEventListener("click", () => {
    $("teacher-dashboard").style.display = "none";
    $("teacher-login").classList.add("active");
    $("teacher-pw").value = "";
  });

  $("btn-add-article").addEventListener("click", openEditor);
  $("btn-save-article").addEventListener("click", saveArticle);
  $("btn-cancel-edit").addEventListener("click", closeEditor);
  $("ed-content").addEventListener("input", updateWordCount);

  $("btn-query-student").addEventListener("click", queryStudent);
  $("query-student-id").addEventListener("keydown", e => {
    if (e.key === "Enter") queryStudent();
  });
  $("btn-export-all").addEventListener("click", exportAllCSV);
});

function $(id) { return document.getElementById(id); }

// ── LOGIN ─────────────────────────────────────────────────
function handleTeacherLogin() {
  const pw = $("teacher-pw").value;
  if (!pw) { $("teacher-login-error").textContent = "請輸入密碼"; return; }
  if (!TeacherAuth.check(pw)) {
    $("teacher-login-error").textContent = "密碼錯誤";
    return;
  }
  $("teacher-login-error").textContent = "";
  $("teacher-login").classList.remove("active");
  $("teacher-dashboard").style.display = "block";
  renderTeacherArticleList();
}

// ── ARTICLE MANAGEMENT ───────────────────────────────────
function renderTeacherArticleList() {
  const articles = ArticleStore.getAll();
  const list = $("teacher-article-list");

  if (!articles.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div>目前沒有文章，請新增。</div>`;
    return;
  }

  list.innerHTML = articles.map(a => {
    const diffLabel = { easy: "初級", medium: "中級", hard: "高級" }[a.difficulty] || a.difficulty;
    const diffClass = `badge-${a.difficulty}`;
    const isDefault = ArticleStore.isDefault(a.id);
    const delBtn = isDefault
      ? `<button class="ta-btn-del" disabled title="預設文章無法刪除" style="opacity:.3">🗑</button>`
      : `<button class="ta-btn-del" onclick="deleteArticle('${escHtml(a.id)}')" title="刪除">🗑</button>`;
    return `
      <div class="ta-row">
        <div style="flex:1">
          <div class="ta-row-title">${escHtml(a.title)}</div>
          <div class="ta-row-meta">
            <span class="badge ${diffClass}">${diffLabel}</span>
            &nbsp;${countWords(a.content)} 字
            ${isDefault ? '<span style="color:var(--text-dim);font-size:.72rem"> · 預設</span>' : ''}
          </div>
        </div>
        <button class="ta-btn-edit" onclick="editArticle('${escHtml(a.id)}')">編輯</button>
        ${delBtn}
      </div>
    `;
  }).join("");
}

function openEditor(articleId = null) {
  teacherState.editingId = articleId;

  if (articleId) {
    const article = ArticleStore.getAll().find(a => a.id === articleId);
    if (!article) return;
    $("editor-title-label").textContent = "編輯文章";
    $("ed-title").value = article.title;
    $("ed-difficulty").value = article.difficulty;
    $("ed-content").value = article.content;
  } else {
    $("editor-title-label").textContent = "新增文章";
    $("ed-title").value = "";
    $("ed-difficulty").value = "medium";
    $("ed-content").value = "";
  }

  updateWordCount();
  $("editor-error").textContent = "";
  $("teacher-editor").style.display = "block";
  $("ed-title").focus();
}

function editArticle(id) { openEditor(id); }

function closeEditor() {
  $("teacher-editor").style.display = "none";
  teacherState.editingId = null;
}

function updateWordCount() {
  const wc = countWords($("ed-content").value || "");
  $("ed-word-count").textContent = `${wc} 個單字`;
  $("ed-word-count").style.color = wc < 50 ? "var(--warn)" : wc > 500 ? "var(--warn)" : "var(--text-muted)";
}

function saveArticle() {
  const title   = $("ed-title").value.trim();
  const content = $("ed-content").value.trim();
  const diff    = $("ed-difficulty").value;
  const errEl   = $("editor-error");

  if (!title)   { errEl.textContent = "請輸入文章標題"; return; }
  if (!content) { errEl.textContent = "請輸入文章內容"; return; }
  if (countWords(content) < 10) { errEl.textContent = "文章內容至少需要 10 個單字"; return; }

  errEl.textContent = "";

  if (teacherState.editingId) {
    const isDefault = ArticleStore.isDefault(teacherState.editingId);
    if (isDefault) {
      // Clone default as custom with new id
      ArticleStore.add({ title, difficulty: diff, content });
      showToast("已另存為新文章（預設文章不修改）");
    } else {
      ArticleStore.update({ id: teacherState.editingId, title, difficulty: diff, content });
      showToast("✅ 文章已更新");
    }
  } else {
    ArticleStore.add({ title, difficulty: diff, content });
    showToast("✅ 文章已新增");
  }

  closeEditor();
  renderTeacherArticleList();
}

function deleteArticle(id) {
  const article = ArticleStore.getAll().find(a => a.id === id);
  if (!article) return;
  if (!confirm(`確定要刪除「${article.title}」嗎？`)) return;
  const ok = ArticleStore.delete(id);
  if (ok) {
    showToast("🗑 已刪除");
    renderTeacherArticleList();
    if (teacherState.editingId === id) closeEditor();
  } else {
    showToast("預設文章無法刪除");
  }
}

// ── STUDENT RECORDS ──────────────────────────────────────
function queryStudent() {
  const id = $("query-student-id").value.trim();
  const resultEl = $("student-records-result");

  if (!id) { resultEl.innerHTML = `<div class="input-error">請輸入班級座號</div>`; return; }

  const records = RecordStore.getByStudent(id);

  if (!records.length) {
    resultEl.innerHTML = `<div class="sr-header">班級座號：${escHtml(id)}</div>
      <div class="empty-state"><div class="empty-icon">📭</div>此學生尚無練習紀錄</div>`;
    return;
  }

  const avgScore = Math.round(records.reduce((s, r) => s + r.score, 0) / records.length);
  const bestScore = Math.max(...records.map(r => r.score));
  const avgWpm  = Math.round(records.reduce((s, r) => s + r.wpm, 0) / records.length);
  const avgAcc  = Math.round(records.reduce((s, r) => s + r.accuracy, 0) / records.length);

  resultEl.innerHTML = `
    <div class="sr-header">班級座號：${escHtml(id)} ／ 共 ${records.length} 次練習</div>
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
        </div>
      `).join("")}
    </div>
  `;
}

// ── EXPORT CSV ────────────────────────────────────────────
function exportAllCSV() {
  const all = RecordStore.getAllRecords();
  const studentIds = Object.keys(all);

  if (!studentIds.length) {
    showToast("目前沒有任何學生紀錄");
    return;
  }

  const rows = [["班級座號", "練習日期", "文章標題", "分數", "WPM", "正確率(%)", "花費時間(s)"]];

  studentIds.forEach(id => {
    all[id].forEach(r => {
      rows.push([
        id,
        formatDate(r.ts),
        r.articleTitle,
        r.score,
        r.wpm,
        r.accuracy,
        r.elapsed
      ]);
    });
  });

  // Sort by student id
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const csvContent = "\uFEFF" + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `typedojo_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("✅ CSV 已匯出");
}

// ── UTILS ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
