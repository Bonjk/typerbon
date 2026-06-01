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

// ── 預設文章 ───────────────────────────────────────────────
const SEED_VERSION = 2;

const DEFAULT_ARTICLES = [
  {
    id: "default-1",
    title: "The Internet",
    difficulty: "easy",
    content: "The Internet is a global network of computers that allows people to share information and communicate with each other. It was first developed in the 1960s as a way for scientists to share research. Today, billions of people use the Internet every day to send emails, watch videos, shop online, and connect with friends. The Internet has changed the way we live, work, and learn. It has made the world a smaller and more connected place for everyone."
  },
  {
    id: "default-2",
    title: "Healthy Habits",
    difficulty: "easy",
    content: "Living a healthy life means making good choices every day. Eating plenty of fruits and vegetables gives your body the vitamins it needs. Drinking enough water keeps you hydrated and helps your organs work properly. Exercise is also very important. Walking, running, or playing sports for at least thirty minutes a day can improve your heart health and boost your mood. Getting enough sleep each night helps your brain rest and recover. Small daily habits can lead to big changes over time."
  },
  {
    id: "default-3",
    title: "Climate Change",
    difficulty: "medium",
    content: "Climate change refers to long-term shifts in global temperatures and weather patterns. While some climate change occurs naturally, human activities have been the main driver since the industrial revolution. Burning fossil fuels such as coal, oil, and gas releases greenhouse gases into the atmosphere. These gases trap heat and cause the planet to warm. Rising temperatures lead to melting ice caps, higher sea levels, and more extreme weather events. Governments, businesses, and individuals must all work together to reduce emissions and protect our planet for future generations."
  },
  {
    id: "default-4",
    title: "Artificial Intelligence",
    difficulty: "hard",
    content: "Artificial intelligence, or AI, refers to computer systems designed to perform tasks that typically require human intelligence. These tasks include recognizing speech, translating languages, identifying images, and making complex decisions. Machine learning, a subset of AI, enables computers to learn from large amounts of data and improve their performance over time without being explicitly programmed. AI is already embedded in many aspects of daily life, from recommendation algorithms on streaming platforms to navigation systems in vehicles. As the technology continues to advance, questions about ethics, employment, and privacy become increasingly important for society to address."
  },
  {
    id: "default-5",
    title: "To Be or Not To Be — Hamlet",
    difficulty: "hard",
    content: "To be, or not to be, that is the question: Whether it is nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them. To die, to sleep, no more; and by a sleep to say we end the heartache and the thousand natural shocks that flesh is heir to: it is a consummation devoutly to be wished. To die, to sleep; to sleep, perchance to dream. Ay, there is the rub; for in that sleep of death what dreams may come when we have shuffled off this mortal coil must give us pause."
  },
  {
    id: "default-6",
    title: "A Tale of Two Cities — Charles Dickens",
    difficulty: "medium",
    content: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way. In short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only."
  },
  {
    id: "default-7",
    title: "Pride and Prejudice — Jane Austen",
    difficulty: "medium",
    content: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters. My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield Park is let at last? Mr. Bennet replied that he had not. But it is, returned she; for Mrs. Long has just been here, and she told me all about it."
  },
  {
    id: "default-8",
    title: "The Great Gatsby — F. Scott Fitzgerald",
    difficulty: "easy",
    content: "In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing anyone, he told me, just remember that all the people in this world have not had the advantages that you have had. He did not say any more, but we have always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence I am inclined to reserve all judgments, a habit that has opened up many curious natures to me."
  },
  {
    id: "default-9",
    title: "The Tell-Tale Heart — Edgar Allan Poe",
    difficulty: "medium",
    content: "True, nervous, very dreadfully nervous I had been and am; but why will you say that I am mad? The disease had sharpened my senses, not destroyed, not dulled them. Above all was the sense of hearing acute. I heard all things in the heaven and in the earth. I heard many things in hell. How then am I mad? Hearken, and observe how healthily, how calmly I can tell you the whole story. It is impossible to say how first the idea entered my brain; but once conceived, it haunted me day and night. Object there was none. Passion there was none. I loved the old man."
  },
  {
    id: "default-10",
    title: "Moby Dick — Herman Melville",
    difficulty: "easy",
    content: "Call me Ishmael. Some years ago, never mind how long precisely, having little money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation. Whenever I find myself growing grim about the mouth, whenever it is a damp, drizzly November in my soul, whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet, I account it high time to get to sea as soon as I can."
  },
  {
    id: "default-11",
    title: "Alice's Adventures in Wonderland — Lewis Carroll",
    difficulty: "easy",
    content: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations? So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her."
  },
  {
    id: "default-12",
    title: "Jane Eyre — Charlotte Bronte",
    difficulty: "hard",
    content: "There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question. I was glad of it: I never liked long walks, especially on chilly afternoons. Dreadful to me was the coming home in the raw twilight, with nipped fingers and toes, and a heart saddened by the chidings of Bessie, the nurse, and humbled by the consciousness of my physical inferiority to Eliza, John, and Georgiana Reed."
  }
];

// ── ArticleStore ───────────────────────────────────────────
const ArticleStore = {
  async ensureDefaults() {
    const seededRef = doc(db, "settings", "seeded");
    const seeded = await getDoc(seededRef);
    if (seeded.exists() && (seeded.data().version || 0) >= SEED_VERSION) return;
    for (const a of DEFAULT_ARTICLES) {
      await setDoc(doc(db, "articles", a.id), { ...a, isDefault: true, createdAt: serverTimestamp() });
    }
    await setDoc(seededRef, { version: SEED_VERSION, seededAt: serverTimestamp() });
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
        classCode:    studentId.slice(0, 3),
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

  /** 取得全部排行榜（教師用、班級篩選用） */
  async getAllLeaderboard() {
    const snap = await getDocs(
      query(collection(db, "leaderboard"), orderBy("bestScore", "desc"))
    );
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  },

  /** 教師用：取得所有學生 ID */
  async getAllStudentIds() {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs.map(d => d.id);
  },

  /** 取得某學生排行榜的歷史最高分（儲存前用於判斷是否突破） */
  async getBestScore(studentId) {
    const snap = await getDoc(doc(db, "leaderboard", studentId));
    return snap.exists() ? (snap.data().bestScore || 0) : 0;
  },

  /** 教師用：刪除某學生所有練習紀錄與排行榜資料 */
  async deleteStudent(studentId) {
    const sessSnap = await getDocs(collection(db, "records", studentId, "sessions"));
    await Promise.all(sessSnap.docs.map(d => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "leaderboard", studentId));
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
    return localStorage.getItem("typerbon_teacher_pw") || this.DEFAULT_PW;
  },

  async check(pw) {
    return pw === await this.getPassword();
  },

  async setPassword(newPw) {
    await setDoc(doc(db, "settings", "teacher"), { password: newPw });
    localStorage.setItem("typerbon_teacher_pw", newPw);
  }
};

// ── 工具函式 ───────────────────────────────────────────────
function calcScore(wpm, netAcc, grossAcc, difficulty = 'medium', completion = 100) {
  const D = ({ easy: 0.90, medium: 0.95, hard: 1.00 })[difficulty] ?? 1.00;
  const aScore = Math.pow(netAcc / 100, 2) * 100;
  const w = wpm >= 30 ? 100
    : wpm >= 20 ? 80 + 2 * (wpm - 20)
    : wpm >= 10 ? 60 + 2 * (wpm - 10)
    : 6 * wpm;
  const g = Math.pow(Math.min(grossAcc, 100) / 100, 0.3);
  return Math.round((aScore * 0.649 + w * 0.351) * g * D * completion);
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

// ── ExamStore ──────────────────────────────────────────────
const ExamStore = {
  /** 取得目前進行中的考試（若無則回傳 null） */
  async getCurrent() {
    const snap = await getDoc(doc(db, "settings", "activeExam"));
    if (!snap.exists()) return null;
    const d = snap.data();
    return d.id ? d : null;
  },

  /** 開始考試：傳入完整 article 物件避免重複讀取 Firestore */
  async start(classCode, article) {
    const id = `exam_${Date.now()}`;
    await setDoc(doc(db, "settings", "activeExam"), {
      id, classCode,
      articleId:    article.id,
      articleTitle: article.title,
      content:      article.content,
      difficulty:   article.difficulty || "medium",
      status:       "active",
      startedAt:    serverTimestamp(),
    });
    return id;
  },

  /** 結束考試 */
  async end() {
    await updateDoc(doc(db, "settings", "activeExam"), { status: "ended" });
  },

  /** 學生提交成績 */
  async submitResult(examId, studentId, result) {
    await setDoc(doc(db, "exams", examId, "results", studentId), {
      ...result, submittedAt: serverTimestamp(),
    });
  },

  /** 取得該場考試所有成績（依分數排序） */
  async getResults(examId) {
    const snap = await getDocs(collection(db, "exams", examId, "results"));
    return snap.docs
      .map(d => d.data())
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  },
};

export { db, ArticleStore, RecordStore, ExamStore, TeacherAuth,
         calcScore, countWords, formatDate, validateStudentId, showToast };

