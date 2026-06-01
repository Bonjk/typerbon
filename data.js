/**
 * data.js — 共用資料層
 * 預設文章、localStorage 工具函式
 */

// ── 預設文章（老師可從後台新增／刪除） ──────────────────
const DEFAULT_ARTICLES = [
  {
    id: "default-1",
    title: "Unit 1 – The Internet",
    difficulty: "easy",
    content: "The Internet is a global network of computers that allows people to share information and communicate with each other. It was first developed in the 1960s as a way for scientists to share research. Today, billions of people use the Internet every day to send emails, watch videos, shop online, and connect with friends. The Internet has changed the way we live, work, and learn. It has made the world a smaller and more connected place for everyone."
  },
  {
    id: "default-2",
    title: "Unit 2 – Healthy Habits",
    difficulty: "easy",
    content: "Living a healthy life means making good choices every day. Eating plenty of fruits and vegetables gives your body the vitamins it needs. Drinking enough water keeps you hydrated and helps your organs work properly. Exercise is also very important. Walking, running, or playing sports for at least thirty minutes a day can improve your heart health and boost your mood. Getting enough sleep each night helps your brain rest and recover. Small daily habits can lead to big changes over time."
  },
  {
    id: "default-3",
    title: "Unit 3 – Climate Change",
    difficulty: "medium",
    content: "Climate change refers to long-term shifts in global temperatures and weather patterns. While some climate change occurs naturally, human activities have been the main driver since the industrial revolution. Burning fossil fuels such as coal, oil, and gas releases greenhouse gases into the atmosphere. These gases trap heat and cause the planet to warm. Rising temperatures lead to melting ice caps, higher sea levels, and more extreme weather events. Governments, businesses, and individuals must all work together to reduce emissions and protect our planet for future generations."
  },
  {
    id: "default-4",
    title: "Unit 4 – Artificial Intelligence",
    difficulty: "hard",
    content: "Artificial intelligence, or AI, refers to computer systems designed to perform tasks that typically require human intelligence. These tasks include recognizing speech, translating languages, identifying images, and making complex decisions. Machine learning, a subset of AI, enables computers to learn from large amounts of data and improve their performance over time without being explicitly programmed. AI is already embedded in many aspects of daily life, from recommendation algorithms on streaming platforms to navigation systems in vehicles. As the technology continues to advance, questions about ethics, employment, and privacy become increasingly important for society to address."
  }
];

// ── STORAGE KEYS ────────────────────────────────────────
const KEYS = {
  ARTICLES:     "typedojo_articles",
  RECORDS:      "typedojo_records",   // { [studentId]: [...sessions] }
  TEACHER_PW:   "typedojo_teacher_pw",
};

// ── ARTICLES API ─────────────────────────────────────────
const ArticleStore = {
  getAll() {
    const saved = localStorage.getItem(KEYS.ARTICLES);
    if (!saved) return [...DEFAULT_ARTICLES];
    try {
      const custom = JSON.parse(saved);
      // Merge: built-in defaults not overridden, then custom
      const customIds = new Set(custom.map(a => a.id));
      const defaults  = DEFAULT_ARTICLES.filter(a => !customIds.has(a.id));
      return [...defaults, ...custom];
    } catch { return [...DEFAULT_ARTICLES]; }
  },

  // Save only the *non-default* articles (custom ones)
  _saveCustom(articles) {
    const defaultIds = new Set(DEFAULT_ARTICLES.map(a => a.id));
    const custom = articles.filter(a => !defaultIds.has(a.id));
    localStorage.setItem(KEYS.ARTICLES, JSON.stringify(custom));
  },

  add(article) {
    const all = this.getAll();
    article.id = "custom-" + Date.now();
    all.push(article);
    this._saveCustom(all);
    return article;
  },

  update(updatedArticle) {
    const all = this.getAll().map(a =>
      a.id === updatedArticle.id ? updatedArticle : a
    );
    this._saveCustom(all);
  },

  delete(id) {
    // Cannot delete default articles
    const defaultIds = new Set(DEFAULT_ARTICLES.map(a => a.id));
    if (defaultIds.has(id)) return false;
    const all = this.getAll().filter(a => a.id !== id);
    this._saveCustom(all);
    return true;
  },

  isDefault(id) {
    return DEFAULT_ARTICLES.some(a => a.id === id);
  }
};

// ── RECORDS API ──────────────────────────────────────────
const RecordStore = {
  _load() {
    try { return JSON.parse(localStorage.getItem(KEYS.RECORDS)) || {}; }
    catch { return {}; }
  },

  getByStudent(studentId) {
    return this._load()[studentId] || [];
  },

  addSession(studentId, session) {
    const all = this._load();
    if (!all[studentId]) all[studentId] = [];
    all[studentId].unshift(session); // newest first
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(all));
  },

  getAllStudentIds() {
    return Object.keys(this._load());
  },

  getAllRecords() {
    return this._load();
  }
};

// ── TEACHER PASSWORD API ─────────────────────────────────
const TeacherAuth = {
  DEFAULT_PW: "teacher123",

  getPassword() {
    return localStorage.getItem(KEYS.TEACHER_PW) || this.DEFAULT_PW;
  },

  check(pw) {
    return pw === this.getPassword();
  },

  setPassword(newPw) {
    localStorage.setItem(KEYS.TEACHER_PW, newPw);
  }
};

// ── SCORING FORMULA ──────────────────────────────────────
/**
 * 綜合分數 = WPM × 正確率² × 100
 * 讓正確率對分數的影響大於速度（正確率 < 1 的平方會急速拉低分數）
 */
function calcScore(wpm, accuracy) {
  const acc = accuracy / 100; // 轉成 0~1
  return Math.round(wpm * acc * acc * 100);
}

// ── UTILS ─────────────────────────────────────────────────
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("zh-TW") + " " + d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function validateStudentId(id) {
  if (!/^\d{5}$/.test(id)) return "請輸入五碼數字";
  const cls    = parseInt(id.slice(0, 3), 10); // 班級 3 碼
  const seatNo = parseInt(id.slice(3, 5), 10); // 座號 2 碼
  if (cls < 100 || cls > 999) return "班級碼（前三碼）應為 100–999";
  if (seatNo < 1 || seatNo > 60) return "座號（後兩碼）應為 01–60";
  return null; // valid
}

// Global toast helper
function showToast(msg, duration = 2200) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), duration);
}
