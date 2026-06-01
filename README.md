# TypeDojo — Firebase 版

## 檔案結構

```
typing-practice/
├── index.html          學生主頁
├── teacher.html        教師後台
├── style.css           樣式表
├── firebase-config.js  ⚠️ 填入你的 Firebase 設定值
├── data.js             資料層（Firestore）
├── app.js              學生端邏輯
└── teacher.js          教師後台邏輯
```

---

## 步驟一：建立 Firebase 專案

1. 前往 https://console.firebase.google.com
2. 按「新增專案」，名稱填 `typedojo`，關閉 Google Analytics（不需要）
3. 左側選「Firestore Database」→「建立資料庫」
   - 模式選**正式模式**（之後設安全規則）
   - 地區選 `asia-east1`（台灣最近）
4. 左側選「專案設定」（齒輪圖示）→「你的應用程式」→「</> 網頁應用程式」
   - 名稱填 `typedojo-web`，按「註冊應用程式」
   - 複製 `firebaseConfig` 物件裡的值

---

## 步驟二：填入設定值

開啟 `firebase-config.js`，把 `YOUR_XXX` 換成你的值：

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "typedojo-xxxx.firebaseapp.com",
  projectId:         "typedojo-xxxx",
  storageBucket:     "typedojo-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};
```

---

## 步驟三：設定 Firestore 安全規則

Firebase Console → Firestore → 規則，貼上以下內容後按「發布」：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 文章：所有人可讀，不可從前端寫（只有後台透過密碼操作）
    match /articles/{id} {
      allow read: if true;
      allow write: if true;  // 部署後可改成 false，改用 Firebase Admin SDK
    }

    // 個人成績：所有人可讀自己的，可新增，不可修改/刪除
    match /records/{studentId}/sessions/{sessionId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }

    // 排行榜：所有人可讀，可寫（由前端更新最高分）
    match /leaderboard/{studentId} {
      allow read: if true;
      allow write: if true;
    }

    // 教師設定（密碼）：只允許讀，寫由後台控制
    match /settings/{doc} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## 步驟四：部署到 GitHub Pages

1. 建立 GitHub repository（公開）
2. 上傳所有 7 個檔案
3. Settings → Pages → Branch: main / (root) → Save

---

## 教師後台

網址：`https://帳號.github.io/repo名/teacher.html`

**預設密碼：`teacher123`**

密碼儲存在 Firestore `settings/teacher`，第一次登入後可從後台修改。

---

## 成績公式

```
分數 = WPM × 正確率² × 100
```

---

## Firestore 資料結構

```
articles/
  {id}: { title, difficulty, content, isDefault, createdAt }

records/
  {studentId}/
    sessions/
      {sessionId}: { ts, articleId, articleTitle, wpm, accuracy, score, elapsed, letterStats }

leaderboard/
  {studentId}: { studentId, bestScore, bestWpm, bestAcc, articleTitle, updatedAt }

settings/
  teacher: { password }
```
