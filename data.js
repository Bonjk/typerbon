/**
 * data.js — 資料層（Firebase Firestore 版本）
 *
 * Collections：
 *   articles/{id}           文章
 *   records/{studentId}/sessions/{sessionId}   成績
 *   leaderboard/{studentId} 每個學生的最高分（供排行榜用）
 */

// ── Firebase 初始化 ────────────────────────────────────────
import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc,
         getDocs, addDoc, updateDoc, deleteDoc,
         setDoc, getDoc, query, orderBy, limit,
         serverTimestamp, onSnapshot }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const _app = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(_app);

// ── 預設文章（第一次啟動時寫入 Firestore） ─────────────────
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

// ── ArticleStore ───────────────────────────────────────────
const ArticleStore = {
  /** 確保預設文章存在（只在第一次執行時寫入） */
  async ensureDefaults() {
    for (const a of DEFAULT_ARTICLES) {
      const ref = doc(db, "articles", a.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { ...a, isDefault: true, createdAt: serverTimestamp() });
      }
    }
  },

  async getAll() {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async add(article) {
    const ref = await addDoc(collection(db, "articles"), {
      ...article,
      isDefault: false,
      createdAt: serverTimestamp()
    });
    return { id: ref.id, ...article };
  },

  async update(article) {
    const { id, ...data } = article;
    await updateDoc(doc(db, "articles", id), data);
  },

  async delete(id) {
    const snap = await getDoc(doc(db, "articles", id));
    if (snap.data()?.isDefault) return false;
    await deleteDoc(doc(db, "articles", id));
    return true;
  },

  isDefault(article) {
    return article?.isDefault === true;
  }
};

// ── RecordStore ────────────────────────────────────────────
const RecordStore = {
  /** 新增一筆練習紀錄，同時更新排行榜 */
  async addSession(studentId, session) {
    // 1. 寫入個人紀錄
    await addDoc(
      collection(db, "records", studentId, "sessions"),
      { ...session, createdAt: serverTimestamp() }
    );

    // 2. 更新排行榜（只保留最高分）
    const lbRef  = doc(db, "leaderboard", studentId);
    const lbSnap = await getDoc(lbRef);
    const prev   = lbSnap.exists() ? lbSnap.data().bestScore : 0;

    if (session.score > prev) {
      await setDoc(lbRef, {
        studentId,
        bestScore:   session.score,
        bestWpm:     session.wpm,
        bestAcc:     session.accuracy,
        articleTitle: session.articleTitle,
        updatedAt:   serverTimestamp()
      });
    }
  },

  /** 取得某學生所有紀錄（最新在前） */
  async getByStudent(studentId) {
    const snap = await getDocs(
      query(
        collection(db, "records", studentId, "sessions"),
        orderBy("createdAt", "desc")
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data(),
      ts: d.data().createdAt?.toMillis?.() || d.data().ts || Date.now()
    }));
  },

  /** 排行榜：取前 50 名（依最高分排序） */
  async getLeaderboard(topN = 50) {
    const snap = await getDocs(
      query(collection(db, "leaderboard"), orderBy("bestScore", "desc"), limit(topN))
    );
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  },

  /** 教師用：取得所有學生 ID */
  async getAllStudentIds() {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs.map(d => d.id);
  },

  /** 教師用：取得所有學生紀錄（用於 CSV 匯出） */
  async getAllRecordsFlat() {
    const ids = await this.getAllStudentIds();
    const rows = [];
    for (const sid of ids) {
      const sessions = await this.getByStudent(sid);
      sessions.forEach(s => rows.push({ studentId: sid, ...s }));
    }
    return rows;
  }
};

// ── TeacherAuth ────────────────────────────────────────────
// 密碼存在 Firestore settings/teacher，fallback 至 localStorage
const TeacherAuth = {
  DEFAULT_PW: "teacher123",

  async getPassword() {
    try {
      const snap = await getDoc(doc(db, "settings", "teacher"));
      if (snap.exists() && snap.data().password) return snap.data().password;
    } catch {}
    return localStorage.getItem("typedojo_teacher_pw") || this.DEFAULT_PW;
  },

  async check(pw) {
    return pw === await this.getPassword();
  },

  async setPassword(newPw) {
    await setDoc(doc(db, "settings", "teacher"), { password: newPw });
    localStorage.setItem("typedojo_teacher_pw", newPw);
  }
};

// ── 工具函式 ───────────────────────────────────────────────
function calcScore(wpm, accuracy) {
  const acc = accuracy / 100;
  return Math.round(wpm * acc * acc * 100);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("zh-TW") + " " + d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function validateStudentId(id) {
  if (!/^\d{5}$/.test(id)) return "請輸入五碼數字";
  const cls    = parseInt(id.slice(0, 3), 10);
  const seatNo = parseInt(id.slice(3, 5), 10);
  if (cls < 100 || cls > 999) return "班級碼（前三碼）應為 100–999";
  if (seatNo < 1 || seatNo > 60) return "座號（後兩碼）應為 01–60";
  return null;
}

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

export { db, ArticleStore, RecordStore, TeacherAuth,
         calcScore, countWords, formatDate, validateStudentId, showToast };
