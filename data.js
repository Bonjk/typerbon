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
         setDoc, getDoc, query, orderBy, arrayUnion, arrayRemove,
         serverTimestamp, onSnapshot }             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const _app = initializeApp(FIREBASE_CONFIG);
const db   = getFirestore(_app);

// ── 預設文章 ───────────────────────────────────────────────
const SEED_VERSION = 4;

const DEFAULT_ARTICLES = [
  {
    id: "default-1",
    title: "The Internet",
    difficulty: "easy",
    tags: ["practice"],
    content: "The Internet is a global network of computers that allows people to share information and communicate with each other. It was first developed in the 1960s as a way for scientists to share research. Today, billions of people use the Internet every day to send emails, watch videos, shop online, and connect with friends. The Internet has changed the way we live, work, and learn. It has made the world a smaller and more connected place for everyone."
  },
  {
    id: "default-2",
    title: "Healthy Habits",
    difficulty: "easy",
    tags: ["practice"],
    content: "Living a healthy life means making good choices every day. Eating plenty of fruits and vegetables gives your body the vitamins it needs. Drinking enough water keeps you hydrated and helps your organs work properly. Exercise is also very important. Walking, running, or playing sports for at least thirty minutes a day can improve your heart health and boost your mood. Getting enough sleep each night helps your brain rest and recover. Small daily habits can lead to big changes over time."
  },
  {
    id: "default-3",
    title: "Climate Change",
    difficulty: "medium",
    tags: ["practice"],
    content: "Climate change refers to long-term shifts in global temperatures and weather patterns. While some climate change occurs naturally, human activities have been the main driver since the industrial revolution. Burning fossil fuels such as coal, oil, and gas releases greenhouse gases into the atmosphere. These gases trap heat and cause the planet to warm. Rising temperatures lead to melting ice caps, higher sea levels, and more extreme weather events. Governments, businesses, and individuals must all work together to reduce emissions and protect our planet for future generations."
  },
  {
    id: "default-4",
    title: "Artificial Intelligence",
    difficulty: "hard",
    tags: ["practice"],
    content: "Artificial intelligence, or AI, refers to computer systems designed to perform tasks that typically require human intelligence. These tasks include recognizing speech, translating languages, identifying images, and making complex decisions. Machine learning, a subset of AI, enables computers to learn from large amounts of data and improve their performance over time without being explicitly programmed. AI is already embedded in many aspects of daily life, from recommendation algorithms on streaming platforms to navigation systems in vehicles. As the technology continues to advance, questions about ethics, employment, and privacy become increasingly important for society to address."
  },
  {
    id: "default-5",
    title: "To Be or Not To Be — Hamlet",
    difficulty: "hard",
    tags: ["practice", "名著"],
    content: "To be, or not to be, that is the question: Whether it is nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles and by opposing end them. To die, to sleep, no more; and by a sleep to say we end the heartache and the thousand natural shocks that flesh is heir to: it is a consummation devoutly to be wished. To die, to sleep; to sleep, perchance to dream. Ay, there is the rub; for in that sleep of death what dreams may come when we have shuffled off this mortal coil must give us pause."
  },
  {
    id: "default-6",
    title: "A Tale of Two Cities — Charles Dickens",
    difficulty: "medium",
    tags: ["practice", "名著"],
    content: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way. In short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only."
  },
  {
    id: "default-7",
    title: "Pride and Prejudice — Jane Austen",
    difficulty: "medium",
    tags: ["practice", "名著"],
    content: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters. My dear Mr. Bennet, said his lady to him one day, have you heard that Netherfield Park is let at last? Mr. Bennet replied that he had not. But it is, returned she; for Mrs. Long has just been here, and she told me all about it."
  },
  {
    id: "default-8",
    title: "The Great Gatsby — F. Scott Fitzgerald",
    difficulty: "easy",
    tags: ["practice", "名著"],
    content: "In my younger and more vulnerable years my father gave me some advice that I have been turning over in my mind ever since. Whenever you feel like criticizing anyone, he told me, just remember that all the people in this world have not had the advantages that you have had. He did not say any more, but we have always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence I am inclined to reserve all judgments, a habit that has opened up many curious natures to me."
  },
  {
    id: "default-9",
    title: "The Tell-Tale Heart — Edgar Allan Poe",
    difficulty: "medium",
    tags: ["practice", "名著"],
    content: "True, nervous, very dreadfully nervous I had been and am; but why will you say that I am mad? The disease had sharpened my senses, not destroyed, not dulled them. Above all was the sense of hearing acute. I heard all things in the heaven and in the earth. I heard many things in hell. How then am I mad? Hearken, and observe how healthily, how calmly I can tell you the whole story. It is impossible to say how first the idea entered my brain; but once conceived, it haunted me day and night. Object there was none. Passion there was none. I loved the old man."
  },
  {
    id: "default-10",
    title: "Moby Dick — Herman Melville",
    difficulty: "easy",
    tags: ["practice", "名著"],
    content: "Call me Ishmael. Some years ago, never mind how long precisely, having little money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation. Whenever I find myself growing grim about the mouth, whenever it is a damp, drizzly November in my soul, whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet, I account it high time to get to sea as soon as I can."
  },
  {
    id: "default-11",
    title: "Alice's Adventures in Wonderland — Lewis Carroll",
    difficulty: "easy",
    tags: ["practice", "名著"],
    content: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations? So she was considering in her own mind, as well as she could, for the hot day made her feel very sleepy and stupid, whether the pleasure of making a daisy chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her."
  },
  {
    id: "default-12",
    title: "Jane Eyre — Charlotte Bronte",
    difficulty: "hard",
    tags: ["practice", "名著"],
    content: "There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question. I was glad of it: I never liked long walks, especially on chilly afternoons. Dreadful to me was the coming home in the raw twilight, with nipped fingers and toes, and a heart saddened by the chidings of Bessie, the nurse, and humbled by the consciousness of my physical inferiority to Eliza, John, and Georgiana Reed."
  },
  {
    id: "exam-easy-1",
    title: "A Day at School",
    difficulty: "easy",
    isExam: true,
    tags: ["exam"],
    content: "Every morning, I wake up early and get ready for school. I eat breakfast with my family before leaving home. At school, I study math, English, and science. During lunch, I chat with my friends and share food. In the afternoon, we have sports class and play games outside. After school, I do my homework and read books. I enjoy going to school because I learn something new every day. My teachers are kind and always help me when I need them."
  },
  {
    id: "exam-easy-2",
    title: "The Park",
    difficulty: "easy",
    isExam: true,
    tags: ["exam"],
    content: "On weekends, my family often goes to the park near our home. We bring food and eat outside under the tall trees. My little brother likes to run and play on the grass. My parents sit on a bench and talk about their day. I like to ride my bike along the path by the lake. The park is a beautiful and peaceful place. There are many birds and flowers there. I always feel happy and relaxed after spending time at the park."
  },
  {
    id: "exam-easy-3",
    title: "Cooking with Mom",
    difficulty: "easy",
    isExam: true,
    tags: ["exam"],
    content: "My mother loves to cook, and she often teaches me how to make simple dishes. On Saturday mornings, we go to the market to buy fresh vegetables, meat, and fruit. Back home, she shows me how to cut and wash the food. My favorite dish is egg soup with tomatoes. It is easy to make and very delicious. Cooking together is a great way to spend time with family. I hope to become a good cook when I grow up."
  },
  {
    id: "exam-medium-1",
    title: "Sports and Health",
    difficulty: "medium",
    isExam: true,
    tags: ["exam"],
    content: "Playing sports is one of the best ways to stay healthy and active. When you exercise regularly, your body becomes stronger and your mind feels clearer. Many students enjoy playing basketball, volleyball, or soccer after school. These team sports also teach important skills like cooperation and communication. However, it is important to warm up before you start and cool down after you finish. Drinking enough water during exercise is also necessary. Some people prefer individual sports such as swimming or running. No matter what sport you choose, the most important thing is to enjoy yourself and keep moving. A short walk every day can make a big difference."
  },
  {
    id: "exam-medium-2",
    title: "Technology in Daily Life",
    difficulty: "medium",
    isExam: true,
    tags: ["exam"],
    content: "Technology has changed our daily lives in ways that were hard to imagine just a few decades ago. Smartphones allow us to connect with people around the world, search for information, take photos, and even pay for goods and services. In the classroom, students use tablets and computers to study and develop new skills. However, spending too much time on screens can have negative effects on health and social relationships. It is important to balance the use of technology with outdoor activities and regular face-to-face communication. Technology is a powerful and useful tool, but only when it is used with care and self-control."
  },
  {
    id: "exam-medium-3",
    title: "Environmental Protection",
    difficulty: "medium",
    isExam: true,
    tags: ["exam"],
    content: "Taking care of our environment is the responsibility of every person on Earth. Pollution from factories, vehicles, and plastic waste is causing serious harm to our planet. Rivers and oceans are filled with garbage, and the air in many cities is difficult to breathe. We can all make a difference by making small changes in our daily lives. Try to use less plastic, recycle your waste, and save electricity whenever possible. Walking or taking public transportation instead of driving also helps reduce pollution. If everyone works together and takes action, we can protect our beautiful planet and leave a better world for future generations."
  },
  {
    id: "exam-hard-1",
    title: "Decision Making and Cognitive Bias",
    difficulty: "hard",
    isExam: true,
    tags: ["exam"],
    content: "Every day, humans make hundreds of decisions, from choosing what to eat for breakfast to determining major career choices. While some decisions feel automatic, others require deliberate thought and careful analysis. Psychologists have discovered that human judgment is frequently distorted by cognitive biases, unconscious mental shortcuts that evolved to help us process information quickly. For example, the confirmation bias leads people to seek information that supports their existing beliefs while ignoring contradictory evidence. Similarly, the availability heuristic causes us to overestimate the likelihood of events that come easily to mind. These biases can lead to systematic errors in judgment, affecting everything from personal relationships to financial decisions. Becoming aware of these mental patterns is the first step toward more rational thinking. By deliberately questioning our assumptions and seeking diverse perspectives, we can gradually overcome these inherent limitations and make more thoughtful, well-informed choices."
  },
  {
    id: "exam-hard-2",
    title: "Urban Development and Sustainability",
    difficulty: "hard",
    isExam: true,
    tags: ["exam"],
    content: "Modern cities face enormous challenges as their populations continue to grow at unprecedented rates. The rapid expansion of urban areas places significant pressure on infrastructure, transportation systems, housing, and natural resources. City planners and architects are increasingly embracing sustainable design principles to address these concerns. Green buildings that incorporate solar panels, rainwater harvesting systems, and energy-efficient materials are becoming more prevalent in metropolitan areas worldwide. The concept of smart cities, where digital technology monitors and optimizes urban services in real time, is gaining considerable momentum. However, urban development rarely comes without social costs. Rising property values frequently displace lower-income communities, deepening economic inequality. Achieving a genuine balance between economic growth, environmental sustainability, and social equity demands comprehensive policy frameworks and authentic cooperation between governments, private enterprises, and citizens. The quality of urban life for future generations depends fundamentally on the choices we make today."
  },
  {
    id: "exam-hard-3",
    title: "Memory and the Brain",
    difficulty: "hard",
    isExam: true,
    tags: ["exam"],
    content: "The human brain's capacity to store and retrieve information is among its most extraordinary attributes. Memory is not a single unified system but rather a sophisticated network of interconnected processes, encompassing encoding, storage, and retrieval. Neuroscientists have identified multiple distinct memory systems, including episodic memory, which records personal experiences, and semantic memory, which stores factual knowledge. The hippocampus, a structure embedded deep within the temporal lobe, plays an indispensable role in consolidating newly acquired information into long-term storage. Remarkably, sleep appears critical to this consolidation process: during deep sleep, the brain systematically replays and reinforces neural pathways formed during waking hours. Forgetting, though often perceived as failure, actually serves an adaptive function by eliminating irrelevant data and allowing the brain to allocate resources more effectively. Understanding memory formation carries profound implications for education, therapy, and the treatment of degenerative neurological conditions."
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
    const allSnap = await getDocs(collection(db, "articles"));
    await Promise.all(allSnap.docs
      .filter(d => !d.data().tags)
      .map(d => updateDoc(d.ref, { tags: d.data().isExam ? ["exam"] : ["practice"] }))
    );
  },

  async getAll() {
    const snap = await getDocs(query(collection(db, "articles"), orderBy("createdAt")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async add(article) {
    const ref = await addDoc(collection(db, "articles"), {
      ...article,
      tags: article.tags?.length ? article.tags : ["practice"],
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
    // 不用 orderBy("createdAt")：剛寫入的文件 createdAt 可能尚未回填，
    // Firestore 會把該文件排除在排序查詢結果外（見 getAllLeaderboard 註解）。
    const snap = await getDocs(collection(db, "records", studentId, "sessions"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data(),
        ts: d.data().createdAt?.toMillis?.() || d.data().ts || Date.now()
      }))
      .sort((a, b) => b.ts - a.ts);
  },

  /** 排行榜：取前 50 名（依最高分排序，排除考試紀錄） */
  async getLeaderboard(topN = 50) {
    // Use getDocs without orderBy: Firestore excludes documents that are
    // missing the queried field, causing some students to disappear silently.
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs
      .map(d => d.data())
      .filter(d => !d.isExamResult && d.bestScore != null)
      .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0))
      .slice(0, topN)
      .map((d, i) => ({ rank: i + 1, ...d }));
  },

  /** 取得全部排行榜（教師用、班級篩選用，排除考試紀錄） */
  async getAllLeaderboard() {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs
      .map(d => d.data())
      .filter(d => !d.isExamResult && d.bestScore != null)
      .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0))
      .map((d, i) => ({ rank: i + 1, ...d }));
  },

  /** 教師用：取得所有學生 ID（排除考試成績記錄） */
  async getAllStudentIds() {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs.filter(d => !d.data().isExamResult).map(d => d.id);
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
  },

  /** 教師用：清除所有學生的練習紀錄與排行榜 */
  async deleteAllStudents() {
    const ids = await this.getAllStudentIds();
    for (const sid of ids) {
      const sessSnap = await getDocs(collection(db, "records", sid, "sessions"));
      await Promise.all(sessSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "leaderboard", sid));
    }
  },

  /** 教師用：班級升年級（重命名班級代碼，例如 802 → 902） */
  async renameClass(oldCode, newCode, onProgress) {
    const snap = await getDocs(collection(db, "leaderboard"));
    const targets = snap.docs
      .filter(d => !d.data().isExamResult && d.id.startsWith(oldCode))
      .map(d => ({ id: d.id, data: d.data() }));

    let done = 0;
    for (const { id: oldId, data: lbData } of targets) {
      const newId = newCode + oldId.slice(3);
      // 搬移 sessions
      const sessSnap = await getDocs(collection(db, "records", oldId, "sessions"));
      for (const s of sessSnap.docs) {
        await addDoc(collection(db, "records", newId, "sessions"), s.data());
        await deleteDoc(s.ref);
      }
      // 搬移 leaderboard
      await setDoc(doc(db, "leaderboard", newId), { ...lbData, studentId: newId, classCode: newCode });
      await deleteDoc(doc(db, "leaderboard", oldId));
      // 搬移 students profile
      const stuSnap = await getDoc(doc(db, "students", oldId));
      if (stuSnap.exists()) {
        await setDoc(doc(db, "students", newId), { ...stuSnap.data(), studentId: newId });
        await deleteDoc(doc(db, "students", oldId));
      }
      done++;
      if (onProgress) onProgress(done, targets.length);
    }
    return targets.length;
  },
};

// ── TeacherAuth ────────────────────────────────────────────
// 密碼以 SHA-256 hash 儲存於 Firestore settings/teacher 及 localStorage。
// 若 Firestore 仍存明文（舊版），第一次登入時自動升級為 hash。

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const TeacherAuth = {
  DEFAULT_PW: "teacher123",

  async getPassword() {
    try {
      const snap = await getDoc(doc(db, "settings", "teacher"));
      if (snap.exists() && snap.data().password) return snap.data().password;
    } catch {}
    return this.DEFAULT_PW;
  },

  async check(pw) {
    const stored = await this.getPassword();
    const hashed = await hashPassword(pw);
    if (hashed === stored) return true;
    // 舊版明文比對：成功後自動升級為 hash
    if (pw === stored) {
      await this.setPassword(pw);
      return true;
    }
    return false;
  },

  async setPassword(newPw) {
    const hashed = await hashPassword(newPw);
    await setDoc(doc(db, "settings", "teacher"), { password: hashed });
    localStorage.removeItem("typerbon_teacher_pw"); // never cache; always read from Firestore
  }
};

// ── 工具函式 ───────────────────────────────────────────────
function calcScore(wpm, netAcc, grossAcc, difficulty = 'medium', completion = 100, wordCount = 80) {
  const D = ({ easy: 0.90, medium: 0.95, hard: 1.00 })[difficulty] ?? 1.00;
  const aScore = Math.pow(netAcc / 100, 2) * 100;
  const w = wpm >= 20 ? 100
    : 100 * Math.sin(Math.PI / 2 * Math.pow(wpm / 20, 0.72));
  const g = Math.pow(Math.min(grossAcc, 100) / 100, 0.3);
  const accGate = grossAcc >= 80 ? 1 : Math.pow(Math.max(0, grossAcc) / 80, 3);
  const L = (wordCount + 20) / 100;
  return Math.round((aScore * 0.649 + w * 0.351) * g * accGate * D * completion * L);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("zh-TW") + " " + d.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

// 從練習/考試紀錄推導「應得成就」的 id 集合（教師重建用；鏡射 app.js checkAchievements 門檻）。
// 無法從紀錄推得者不含：theme_all、no_backspace、world_wrong、exam_early。
function deriveEarnedAchievements(sessions, examResults) {
  const earned = new Set();
  const S  = (sessions || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)); // 由舊到新
  const CS = S.filter(s => s.completed !== false);   // 舊紀錄無此欄位 → 視為完成

  if (S.length) earned.add("first_session");

  for (const s of CS) {
    const w = s.wpm || 0;
    if (w >= 10) earned.add("speed_10");
    if (w >= 15) earned.add("speed_15");
    if (w >= 20) earned.add("speed_20");
    if (w >= 25) earned.add("speed_25");
    if (w >= 30) earned.add("speed_30");
    if (s.difficulty === "hard" && s.accuracy === 100) earned.add("hard_perfect");
    if ((s.wordCount || 0) >= 110) earned.add("long_article");
    if (s.completion === 100 && (s.elapsed || 0) >= 1200) earned.add("persevere");
    if (s.completion === 100 && s.grossAccuracy === 0)    earned.add("you_sure");
  }
  for (const s of S) if (s.accuracy === 100) earned.add("accuracy_100");

  // 連續 5 次淨正確率 ≥ 95（任一段連續視窗）
  const accs = S.map(s => s.accuracy ?? 0);
  for (let i = 0; i + 5 <= accs.length; i++)
    if (accs.slice(i, i + 5).every(a => a >= 95)) { earned.add("accuracy_streak"); break; }

  const total = CS.length;
  if (total >= 5)   earned.add("sessions_5");
  if (total >= 20)  earned.add("sessions_20");
  if (total >= 50)  earned.add("sessions_50");
  if (total >= 100) earned.add("sessions_100");
  const days = new Set(CS.map(s => new Date(s.ts).toDateString()));
  if (days.size >= 5)  earned.add("days_5");
  if (days.size >= 10) earned.add("days_10");
  if (CS.reduce((n, s) => n + (s.wordCount || 0), 0) >= 5000) earned.add("words_5000");

  // wpm_record：時序上曾有一次超越先前最佳
  let best = -1;
  for (const s of CS) { const w = s.wpm || 0; if (best >= 0 && w > best) { earned.add("wpm_record"); break; } if (w > best) best = w; }

  // 好笑數字彩蛋（任一練習分數命中）
  for (const s of S) {
    const sc = s.score || 0;
    if (sc > 0 && sc % 1000 === 0) earned.add("score_round");
    if (sc % 1000 === 520)         earned.add("score_520");
    if (sc % 10000 === 1314)       earned.add("score_1314");
    if (sc % 100 === 67)           earned.add("sixseven");
    const ss = String(sc);
    if (ss.length >= 3 && ss === [...ss].reverse().join("")) earned.add("score_palindrome");
  }

  // 考試
  const E = (examResults || []).filter(r => r && !r.reset);
  if (E.length) earned.add("exam_first");
  for (const r of E) {
    const sc = r.score || 0;
    if (sc >= 85)  earned.add("exam_excellent");
    if (sc >= 100) earned.add("exam_perfect");
    if (r.difficulty === "hard" && r.completed) earned.add("exam_hard");
    if (r.completed && (r.wpm || 0) >= 20)      earned.add("exam_speed");
    if (sc % 100 === 67) earned.add("sixseven");
    const rg = Math.round(r.grossAccuracy ?? 0), rn = Math.round(r.accuracy ?? 0),
          rc = Math.round(r.completion ?? 0),    rs = Math.round(sc);
    if (rg === rn && rn === rc && rc === rs) earned.add("perfect_match");
  }
  return earned;
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

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  /** 學生按下「加入考試」時登記座號（之後若無成績即列入缺交） */
  async recordJoin(examId, studentId) {
    const ref  = doc(db, "settings", "activeExam");
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().id === examId)
      await updateDoc(ref, { joined: arrayUnion(studentId) }).catch(() => {});
  },

  /** 開始考試：傳入三篇文章 { easy, medium, hard }。
   *  考試 id 採可讀格式「班級-年-月-日-時-分」，每場以此 id 為單位記錄。 */
  async start(classCode, articles) {
    const p  = n => String(n).padStart(2, "0");
    const d  = new Date();
    const id = `${classCode}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}`;
    const pack = (a) => ({ id: a.id, title: a.title, content: a.content, difficulty: a.difficulty });
    const articlePack = {
      easy:   pack(articles.easy),
      medium: pack(articles.medium),
      hard:   pack(articles.hard),
    };
    await setDoc(doc(db, "settings", "activeExam"), {
      id, classCode, articles: articlePack,
      status:    "active",
      startedAt: serverTimestamp(),
    });
    // 同時建立場次索引（以 examId 為鍵），讓教師可日後選此場補登/檢視
    await setDoc(doc(db, "examRecords", id), {
      examId: id, classCode, articles: articlePack,
      startedAt: serverTimestamp(), status: "active",
    });
    return id;
  },

  /** 結束考試 */
  async end() {
    await updateDoc(doc(db, "settings", "activeExam"), { status: "ended" });
  },

  /** 學生提交成績（保留最高分；reset 標記允許覆蓋）
   *  存至 leaderboard/exam_{examId}__{studentId}（leaderboard 集合已有寫入權限）
   */
  async submitResult(examId, studentId, result) {
    const ref  = doc(db, "leaderboard", `exam_${examId}__${studentId}`);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? snap.data() : null;
    if (prev && !prev.reset && (prev.score || 0) >= result.score) return;
    await setDoc(ref, { ...result, examId, isExamResult: true, submittedAt: serverTimestamp() });
  },

  /** 教師手動改分／補登：直接覆寫分數（不受保留最高分限制；DB 異常時補救用） */
  async overrideScore(examId, studentId, score, extra = {}) {
    const ref  = doc(db, "leaderboard", `exam_${examId}__${studentId}`);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? snap.data() : {};
    await setDoc(ref, {
      ...prev, examId, studentId, classCode: studentId.slice(0, 3),
      isExamResult: true, reset: false, score,
      manualEdit: true, editedAt: serverTimestamp(), ...extra,
    });
  },

  /** 教師重設學生：以 reset 標記覆蓋成績 */
  async resetStudentFull(examId, studentId) {
    await setDoc(doc(db, "leaderboard", `exam_${examId}__${studentId}`), {
      examId, studentId, reset: true, score: 0, isExamResult: true,
    });
  },

  /** 取得該場考試所有成績（排除 reset 標記，依分數排序） */
  async getResults(examId) {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs
      .map(d => d.data())
      .filter(d => d.isExamResult && d.examId === examId && !d.reset)
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  },

  /** 結束考試：更新該場索引（補上結束時間、成績快照、缺交名冊），不另建新文件 */
  async saveRecord(examId) {
    const examSnap = await getDoc(doc(db, "settings", "activeExam"));
    const exam = examSnap.exists() ? examSnap.data() : {};
    const results = await this.getResults(examId);
    await setDoc(doc(db, "examRecords", examId), {
      examId,
      classCode:    exam.classCode,
      articles:     exam.articles || {},
      endedAt:      serverTimestamp(),
      studentCount: results.length,
      joined:       exam.joined || [],
      results,
      status:       "ended",
    }, { merge: true });
  },

  /** 列出所有考試場次（供教師下拉選擇；不用 orderBy 以免缺欄位被略過，前端排序） */
  async listExams() {
    const snap = await getDocs(collection(db, "examRecords"));
    return snap.docs
      .map(d => {
        const x = d.data();
        return {
          examId:    x.examId || d.id,
          classCode: x.classCode || "",
          status:    x.status || (x.endedAt ? "ended" : "active"),
          startedAt: x.startedAt?.toMillis?.() ?? 0,
          endedAt:   x.endedAt?.toMillis?.() ?? null,
        };
      })
      .sort((a, b) => b.startedAt - a.startedAt);
  },

  /** 取得某場考試的缺交名冊：進行中讀 activeExam，否則讀該場 examRecords 快照 */
  async getExamJoined(examId, status) {
    if (status === "active") {
      const snap = await getDoc(doc(db, "settings", "activeExam"));
      if (snap.exists() && snap.data().id === examId) return snap.data().joined || [];
    }
    const rec = await getDoc(doc(db, "examRecords", examId));
    return rec.exists() ? (rec.data().joined || []) : [];
  },

  /** 取某學生所有考試成績（跨場次，排除 reset；供成就重建用） */
  async getStudentExamResults(studentId) {
    const snap = await getDocs(collection(db, "leaderboard"));
    return snap.docs.map(d => d.data())
      .filter(d => d.isExamResult && d.studentId === studentId && !d.reset);
  },

  /** 一次讀全 leaderboard，依 examId 分組即時成績（給教師端記錄即時顯示用） */
  async getAllExamResultsByExam() {
    const snap = await getDocs(collection(db, "leaderboard"));
    const map = {};
    snap.docs.map(d => d.data())
      .filter(d => d.isExamResult && d.examId && !d.reset)
      .forEach(r => { (map[r.examId] ??= []).push(r); });
    Object.values(map).forEach(arr => arr.sort((a, b) => (b.score || 0) - (a.score || 0)));
    return map;
  },

  /** 取得所有考試記錄（含成績快照，依開始時間降序） */
  async getRecords() {
    const snap = await getDocs(collection(db, "examRecords"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.startedAt?.toMillis?.() ?? 0) - (a.startedAt?.toMillis?.() ?? 0));
  },
};

// ── 成就定義 ───────────────────────────────────────────────
const ACHIEVEMENTS = [
  // 速度
  { id: "first_session",  category: "speed",    name: "第一步",              desc: "完成第一次練習",                hidden: false },
  { id: "speed_10",       category: "speed",    name: "穩步前進",            desc: "單次達到 10 WPM",               hidden: false },
  { id: "speed_15",       category: "speed",    name: "超越門檻",            desc: "單次達到 15 WPM",               hidden: false },
  { id: "speed_20",       category: "speed",    name: "行雲流水",            desc: "單次達到 20 WPM",               hidden: false },
  { id: "speed_25",       category: "speed",    name: "快意飛騰",            desc: "單次達到 25 WPM",               hidden: false },
  { id: "speed_30",       category: "speed",    name: "颶風之手",            desc: "單次達到 30 WPM",               hidden: false },
  // 正確率
  { id: "accuracy_100",   category: "accuracy", name: "謹慎嚴謹",            desc: "單次淨正確率 100%",             hidden: false },
  { id: "accuracy_streak",category: "accuracy", name: "穩定發揮",            desc: "連續 5 次淨正確率 ≥ 95%",      hidden: false },
  { id: "hard_perfect",   category: "accuracy", name: "字字珠璣",            desc: "高級文章完成且淨正確率 100%",   hidden: false },
  // 堅持
  { id: "sessions_5",     category: "persist",  name: "勇於嘗試",            desc: "完成 5 次練習",                 hidden: false },
  { id: "sessions_20",    category: "persist",  name: "打字達人",            desc: "完成 20 次練習",                hidden: false },
  { id: "sessions_50",    category: "persist",  name: "百鍊成鋼",            desc: "完成 50 次練習",                hidden: false },
  { id: "sessions_100",   category: "persist",  name: "千錘百鍊",            desc: "完成 100 次練習",               hidden: false },
  { id: "days_5",         category: "persist",  name: "持之以恆",            desc: "在 5 個不同日期練習過",         hidden: false },
  { id: "days_10",        category: "persist",  name: "細水長流",            desc: "在 10 個不同日期練習過",        hidden: false },
  { id: "words_5000",     category: "persist",  name: "著作等身",            desc: "累積完成字數達 5000",           hidden: false },
  // 進步
  { id: "wpm_record",     category: "progress", name: "突飛猛進",            desc: "超越自己的 WPM 最高紀錄",       hidden: false },
  // 考試
  { id: "exam_first",     category: "exam",     name: "初試啼聲",            desc: "完成第一次考試",                hidden: false },
  { id: "exam_excellent", category: "exam",     name: "金榜題名",            desc: "考試得到優秀（≥ 85 分）",       hidden: false },
  { id: "exam_hard",      category: "exam",     name: "迎難而上",            desc: "完成一次高級難度考試",          hidden: false },
  { id: "exam_perfect",   category: "exam",     name: "100是考試的極限，不是我的", desc: "考試得到 100 分",           hidden: false },
  { id: "exam_speed",     category: "exam",     name: "考場疾風",            desc: "考試完整作答且 WPM ≥ 20",       hidden: false },
  // 特殊（隱藏）
  { id: "theme_all",      category: "special",  name: "主題探索家",          desc: "試用過所有 6 種主題",           hidden: true },
  { id: "long_article",   category: "special",  name: "長文挑戰者",          desc: "完成一篇 ≥ 110 個單字的文章",   hidden: true },
  { id: "exam_early",     category: "special",  name: "不慌不忙",            desc: "考試剩 30% 時間時已完成",       hidden: true },
  { id: "sixseven",       category: "special",  name: "sixseven!",           desc: "分數尾數為 67",                 hidden: true },
  { id: "perfect_match",  category: "special",  name: "控分傳奇",            desc: "考試的毛正確率、淨正確率、完成度、分數四捨五入後相同", hidden: true },
  { id: "no_backspace",   category: "special",  name: "不需要你",            desc: "全程不按 Backspace 完成一篇文章", hidden: true },
  { id: "persevere",      category: "special",  name: "鍥而不捨",            desc: "完成度 100% 且耗時 ≥ 20 分鐘",  hidden: true },
  { id: "you_sure",       category: "special",  name: "你確定？",            desc: "完成度 100% 且毛正確率 0%",     hidden: true },
  { id: "world_wrong",    category: "special",  name: "這世界錯了",          desc: "完成度 100%、毛正確率 0%、按鍵次數剛好等於文章字元數", hidden: true },
  { id: "score_round",    category: "special",  name: "完美整數",            desc: "分數為 1000 的整數倍",          hidden: true },
  { id: "score_520",      category: "special",  name: "我愛打字",            desc: "分數尾數為 520",                hidden: true },
  { id: "score_1314",     category: "special",  name: "一生一世",            desc: "分數尾數為 1314",               hidden: true },
  { id: "score_palindrome",category: "special", name: "正反都一樣",          desc: "分數為迴文數（≥ 3 位）",         hidden: true },
];

// ── StudentStore ───────────────────────────────────────────
// 學生個人資料：成就、主題偏好、字型大小
const StudentStore = {
  _cache: {},

  async get(studentId) {
    if (this._cache[studentId]) return this._cache[studentId];
    try {
      const snap = await getDoc(doc(db, "students", studentId));
      const data = snap.exists() ? snap.data() : { achievements: [], theme: null, fontSize: null };
      this._cache[studentId] = data;
      return data;
    } catch { return { achievements: [], theme: null, fontSize: null }; }
  },

  /** 取所有學生 profile（教師端成就檢查/登入紀錄用） */
  async getAllProfiles() {
    const snap = await getDocs(collection(db, "students"));
    return snap.docs.map(d => ({ studentId: d.id, ...d.data() }));
  },

  /** 記錄一次登入（只寫 lastLogin，merge 不動其他欄位） */
  async recordLogin(studentId) {
    if (!studentId) return;
    try {
      await setDoc(doc(db, "students", studentId),
        { studentId, lastLogin: serverTimestamp() }, { merge: true });
    } catch { /* 離線時略過 */ }
  },

  async savePreferences(studentId, prefs) {
    if (!studentId) return;
    this._cache[studentId] = { ...(this._cache[studentId] || {}), ...prefs };
    try {
      await setDoc(doc(db, "students", studentId),
        { studentId, ...prefs, updatedAt: serverTimestamp() }, { merge: true });
    } catch { /* 離線時略過 */ }
  },

  // 寫入後讀回權威陣列，更新快取與排行榜成就數
  async _syncAfterWrite(studentId, profile) {
    let arr = [];
    try {
      const fresh = await getDoc(doc(db, "students", studentId));
      arr = fresh.exists() ? (fresh.data().achievements || []) : [];
    } catch { arr = (this._cache[studentId] || profile || {}).achievements || []; }
    this._cache[studentId] = { ...(this._cache[studentId] || profile || {}), achievements: arr };
    await updateDoc(doc(db, "leaderboard", studentId), { achievementCount: arr.length }).catch(() => {});
    return arr;
  },

  async awardAchievement(studentId, achievementId) {
    const profile = await this.get(studentId);
    if ((profile.achievements || []).includes(achievementId)) return false;
    try {
      // arrayUnion 原子加入單一元素：即使本機副本過時/為空也不會覆蓋掉其他成就
      await setDoc(doc(db, "students", studentId),
        { studentId, achievements: arrayUnion(achievementId), updatedAt: serverTimestamp() }, { merge: true });
      await this._syncAfterWrite(studentId, profile);
    } catch { /* 離線時略過 */ }
    return true;
  },

  // 教師後台用：移除單一成就（arrayRemove 原子移除）
  async removeAchievement(studentId, achievementId) {
    const profile = await this.get(studentId);
    await setDoc(doc(db, "students", studentId),
      { studentId, achievements: arrayRemove(achievementId), updatedAt: serverTimestamp() }, { merge: true });
    await this._syncAfterWrite(studentId, profile);
  },

  // 重建用：一次原子加入多個成就（只加不減）
  async addAchievements(studentId, ids) {
    if (!ids || !ids.length) return;
    const profile = await this.get(studentId);
    await setDoc(doc(db, "students", studentId),
      { studentId, achievements: arrayUnion(...ids), updatedAt: serverTimestamp() }, { merge: true });
    return this._syncAfterWrite(studentId, profile);
  },

  // 教師後台用：一鍵全給 / 全清（明確操作，直接覆蓋成就陣列）
  async setAchievements(studentId, ids) {
    this._cache[studentId] = { ...(this._cache[studentId] || {}), achievements: ids };
    await setDoc(doc(db, "students", studentId),
      { studentId, achievements: ids, updatedAt: serverTimestamp() }, { merge: true });
    await updateDoc(doc(db, "leaderboard", studentId), { achievementCount: ids.length }).catch(() => {});
  },
};

export { db, ArticleStore, RecordStore, ExamStore, TeacherAuth, StudentStore,
         ACHIEVEMENTS, calcScore, countWords, formatDate, validateStudentId,
         deriveEarnedAchievements, showToast, escHtml };

