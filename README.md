# TyperBon

TyperBon 是一個給英語課使用的打字練習平台，學生以班級座號登入後可練習老師指定的文章，成績自動記錄並顯示同班排行榜。教師後台可管理文章、查詢學生成績、依班級篩選排行榜，並匯出 CSV。

## 功能概覽

- **學生端**：班級座號登入（前三碼班級 + 後兩碼座號）、打字練習、個人歷史成績、同班排行榜
- **教師後台**：文章新增 / 編輯 / 刪除（含預設文章）、個別學生查詢、班級排行榜、全班 CSV 匯出

## 專案結構

```
typerbon/
├── index.html              # 學生端主頁（URL: /）
├── teacher/
│   └── index.html          # 教師後台（URL: /teacher/）
├── teacher.html            # 舊連結相容（自動跳轉至 /teacher/）
├── app.js                  # 學生端邏輯
├── teacher.js              # 教師後台邏輯
├── data.js                 # Firebase 資料層
├── firebase-config.js      # Firebase 設定（需自行填入）
└── style.css               # 樣式
```

## 設定步驟

### 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/) 並建立新專案
2. 啟用 **Firestore Database**（Production mode，建議地區：`asia-east1`）
3. 在專案設定中新增 Web 應用程式，複製 `firebaseConfig` 內的所有值

### 2. 填入 firebase-config.js

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. 設定 Firestore Security Rules

在 Firebase Console → Firestore → Rules 貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{id} {
      allow read: if true;
      allow write: if true;
    }
    match /records/{studentId}/sessions/{sessionId} {
      allow read: if true;
      allow create: if true;
    }
    match /leaderboard/{studentId} {
      allow read: if true;
      allow write: if true;
    }
    match /settings/{doc} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

### 4. 部署至 GitHub Pages

1. 將專案推送至 GitHub 公開 repo
2. 前往 repo **Settings → Pages**，選擇 `main` branch，根目錄（`/`）
3. 幾分鐘後即可透過 `https://<帳號>.github.io/<repo名稱>/` 訪問

## 使用說明

### 學生端

- 以五碼數字登入，格式：`班級三碼 + 座號兩碼`（例：`80213` = 802 班 13 號）
- 座號範圍：01–60；班級範圍：100–999
- 排行榜只顯示同班同學（相同前三碼）

### 教師後台

- 網址：`https://<帳號>.github.io/<repo名稱>/teacher/`（不需要 .html）
- 預設密碼：`teacher123`（可在後台「設定」分頁修改）
- 文章管理：可新增、編輯所有文章；預設文章亦可刪除，刪除前會出現確認提示
- 成績查詢：輸入五碼座號查詢個別學生；排行榜可依三碼班級篩選或查看全部
- CSV 匯出包含所有學生的完整練習紀錄

## 分數計算公式

```
分數 = WPM × (正確率 / 100)² × 100
```

## Firestore 資料結構

```
articles/{id}
  title, difficulty (easy/medium/hard), content, isDefault, createdAt

records/{studentId}/sessions/{sessionId}
  ts, articleId, articleTitle, wpm, accuracy, score, elapsed, letterStats, createdAt

leaderboard/{studentId}
  studentId, classCode, bestScore, bestWpm, bestAcc, articleTitle, updatedAt

settings/teacher
  password
```
