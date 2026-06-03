# TyperBon

英文打字練習平台，專為課堂設計。

## 特色

- **無密碼登入** — 學生以班級座號（五碼數字）直接進入，無需帳號
- **自訂文章** — 老師可在後台新增任意文章，不受預設內容限制
- **即時排行榜** — 每次練習後自動更新，可切換同班 / 全體檢視
- **考試模式** — 老師指定三種難度各一篇，學生選難度、十分鐘計時作答
- **教師後台** — 管理文章、查詢成績、控制考試流程、匯出 Excel

---

## 功能

### 學生端
- 班級座號登入（前三碼班級 ＋ 後兩碼座號）
- 文章依難度分為三區塊（初級 / 中級 / 高級），考試文章標有「考試」標籤
- 即時數據：WPM、正確率、游標追蹤；文章較長時可上下捲動
- 個別字母正確率分析
- 個人歷史紀錄 / 班級排行榜

### 教師後台
- 文章管理（新增 / 編輯 / 刪除）
- 考試管理：選文章、開始 / 結束考試、查看即時成績、重設個別學生
- 成績查詢：依座號查詢、班級篩選、全體排行榜
- 考試成績匯出（.xlsx）

---

## 部署方式

### 1. 建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立新專案
2. 啟用 **Firestore Database**（Production mode，建議地區：`asia-east1`）
3. 在專案設定中新增 Web 應用程式，複製 `firebaseConfig`

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

### 3. Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{id}               { allow read, write: if true; }
    match /records/{s}/sessions/{id}   { allow read: if true; allow create: if true; }
    match /leaderboard/{id}            { allow read, write: if true; }
    match /settings/{doc}              { allow read, write: if true; }
  }
}
```

### 4. 部署至 GitHub Pages

1. 推送至 GitHub 公開 repo
2. **Settings → Pages**，選擇 `master` branch，根目錄 `/`
3. 學生端：`https://<帳號>.github.io/<repo>/`
4. 教師後台：`https://<帳號>.github.io/<repo>/teacher/`

---

## 細部說明

### 登入格式

| 欄位 | 長度 | 範圍 | 範例 |
|------|------|------|------|
| 班級碼 | 3 碼 | 100–999 | 802 |
| 座號 | 2 碼 | 01–60 | 13 |
| 完整座號 | 5 碼 | — | 80213 |

排行榜以前三碼區分班級，「同班」只顯示相同班級碼的學生。

---

### 分數計算公式

#### 練習模式（0–20,000 分）

```
分數 = (正確率分 × 0.649 + 速度分 × 0.351) × 毛正確率因子 × 難度係數 × 完成度係數
```

| 項目 | 計算方式 |
|------|----------|
| 正確率分 | `(淨正確率 / 100)² × 100` |
| 速度分 | WPM ≥ 20 → 100；< 20 → `100 × sin(π/2 × (WPM/20)^0.72)` |
| 毛正確率因子 | `(毛正確率 / 100) ^ 0.3` |
| 難度係數 | 初級 × 0.90、中級 × 0.95、高級 × 1.00 |
| 完成度係數 | 以 15 WPM 為基準時間，範圍 1–200 |

**模擬數據（100 字文章）**

| WPM | 淨正確率 | 毛正確率 | 難度 | 分數 | 等第 |
|-----|---------|---------|------|------|------|
| 5  | 78% | 70% | 初級 | 1,405 | 多加練習 |
| 8  | 82% | 75% | 初級 | 2,831 | 多加練習 |
| 10 | 85% | 78% | 中級 | 4,133 | 多加練習 |
| 13 | 88% | 83% | 中級 | 5,966 | 繼續加油 |
| 15 | 93% | 89% | 中級 | 7,725 | 不錯 |
| 18 | 91% | 86% | 高級 | 9,626 | 優秀 |
| 20 | 94% | 91% | 高級 | 11,498 | 優秀 |

等第閾值：≥ 8,500 優秀 / ≥ 7,000 不錯 / ≥ 5,500 繼續加油

#### 考試模式（0–100 分）

完成度係數改為 `已提交字數 / 文章總字數`（0–1），其餘公式相同。

**模擬數據**

| WPM | 淨正確率 | 毛正確率 | 難度 | 完成度 | 分數 | 等第 |
|-----|---------|---------|------|-------|------|------|
| 8  | 80% | 73% | 初級 | 80% | 41 | 多加練習 |
| 10 | 85% | 79% | 中級 | 85% | 53 | 多加練習 |
| 12 | 88% | 83% | 中級 | 90% | 61 | 繼續加油 |
| 15 | 93% | 90% | 中級 | 100% | 78 | 不錯 |
| 20 | 95% | 92% | 高級 | 100% | 88 | 優秀 |
| 25 | 99% | 97% | 高級 | 100% | 98 | 優秀 |

等第閾值：≥ 85 優秀 / ≥ 70 不錯 / ≥ 55 繼續加油

#### 成績概算

考試模式下，毛正確率（80–100%）與打字速度（WPM 5–25）的分數分布，依初級 / 中級 / 高級三種難度分別列出：

**[score-guide.html](score-guide.html)**（淨正確率 100%，完成度 100% 的理想條件）

| 底色 | 分數範圍 | 等第 |
|------|---------|------|
| 綠 | 90–100 | 優秀 |
| 藍 | 80–89 | 不錯 |
| 黃 | 70–79 | 繼續加油 |
| 紅 | < 70 | 多加練習 |

---

### 教師後台

- 網址：`/teacher/`（不需 .html）
- 預設密碼：`teacher123`（可在「設定」分頁修改）
- 密碼修改後存入 Firestore，並同步至 localStorage 快取
- 考試用文章（`isExam: true`）學生也可在練習模式中自由使用
- 考試成績存於 leaderboard 集合，不影響練習排行榜

---

### Firestore 資料結構

```
articles/{id}
  title, difficulty (easy/medium/hard), content
  isDefault, isExam, createdAt

records/{studentId}/sessions/{sessionId}
  ts, articleId, articleTitle, wpm, accuracy, grossAccuracy
  score, completionFactor, difficulty, elapsed, letterStats

leaderboard/{studentId}                      # 練習最高分
  studentId, classCode, bestScore, bestWpm
  bestAcc, articleTitle, updatedAt

leaderboard/exam_{examId}__{studentId}       # 考試成績
  examId, studentId, score, wpm, accuracy
  grossAccuracy, difficulty, completion
  articleTitle, isExamResult
  reset (true = 已被老師重設)

settings/teacher    → password
settings/activeExam → id, classCode, status, articles, startedAt
settings/seeded     → version (目前 3), seededAt
```
