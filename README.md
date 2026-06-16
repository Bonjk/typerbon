# TyperBon

英文打字練習平台，專為課堂設計。

## 特色

- **無密碼登入** — 學生以班級座號（五碼數字）直接進入，無需帳號
- **自訂文章** — 老師可在後台新增任意文章，並標記 tag（練習 / 考試 / 名著）
- **即時排行榜** — 每次練習後自動更新，可切換同班 / 全體檢視；名條右側顯示鍵帽造型成就獎章（銅 / 銀 / 金 / 白金四階）
- **考試模式** — 老師從考試 tag 文章中指定三種難度各一篇，學生選難度、十五分鐘計時作答
- **教師後台** — 管理文章與標籤、查詢成績、控制考試流程、匯出 Excel；班級升年級遷移；成就管理
- **成就系統** — 35 個成就（含 13 個隱藏），解鎖時顯示 futuristic 提示框；集滿全部成就名條變金色閃光

---

## 功能

### 學生端
- 班級座號登入（前三碼班級 ＋ 後兩碼座號）
- 文章依難度分為三區塊（初級 / 中級 / 高級）；考試文章標有「考試」badge、名著標有「名著」badge
- 即時數據：WPM、正確率、游標追蹤、進度列；文章較長時可上下捲動
- 個別字母正確率分析
- 個人歷史紀錄 / 班級排行榜
- **成就分頁**：35 個成就分六類（速度 / 正確率 / 堅持 / 進步 / 考試 / 特殊），13 個成就隱藏解鎖條件
- 主題（深色 / 淺色 / 暮色 / 運動服 / 淺紫 / 深紫）與字型大小同步至 Firestore，換裝置也能記住

### 教師後台
- 文章管理（新增 / 編輯 / 刪除），每篇可設定 tag：`練習`、`考試`、`名著`（可複選）
- 考試管理：從考試 tag 文章選文、開始 / 結束考試、查看即時成績、重設個別學生
- 成績查詢：依座號查詢、班級篩選、全體排行榜
- 考試成績匯出（.xlsx）
- 一鍵清除所有學生紀錄
- 班級升年級：將整班座號從舊代碼遷移至新代碼（如 802 → 902）
- 成就管理：依座號查詢學生成就，逐項授予 / 取消，或一鍵全給 / 全清

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

規則已維護於 [`firestore.rules`](firestore.rules)。有兩種更新方式：

**方式 A — Firebase Console（手動貼上）**

前往 Firebase Console → Firestore → Rules，貼上以下內容：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{id}               { allow read, write: if true; }
    match /records/{s}/sessions/{id}   { allow read: if true; allow create: if true; allow delete: if true; }
    match /leaderboard/{id}            { allow read, write: if true; }
    match /settings/{doc}              { allow read, write: if true; }
    match /students/{id}               { allow read, write: if true; }
  }
}
```

**方式 B — Firebase CLI**

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # 選擇現有專案，rules 檔選 firestore.rules
firebase deploy --only firestore:rules
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

### 正確率說明

系統追蹤兩種正確率，兩者都會影響最終分數：

| 名稱 | 定義 | 說明 |
|------|------|------|
| **淨正確率**（Net Accuracy）| 正確字元 ÷ 最終提交字元數 | 以最終送出的文字計算，反映打字結果的品質 |
| **毛正確率**（Gross Accuracy）| 正確字元 ÷ 總按鍵次數 | 包含所有曾按下的鍵（含刪除重打），反映實際操作的流暢度 |

> **範例**：輸入 100 個字元過程中按了 130 次鍵（包含 30 次退格重打），最終有 95 個字元正確。
> 淨正確率 = 95 / 100 = **95%**，毛正確率 = 95 / 130 = **73%**。

---

### 分數計算公式

#### 練習模式

```
分數 = (淨正確率分 × 0.649 + 速度分 × 0.351) × 毛正確率因子 × 毛正確率門檻 × 難度係數 × 完成度係數 × 字數係數
```

| 項目 | 計算方式 |
|------|----------|
| 淨正確率分 | `(淨正確率 / 100)² × 100` |
| 速度分 | WPM ≥ 20 → 100；< 20 → `100 × sin(π/2 × (WPM/20)^0.72)` |
| 毛正確率因子 | `(毛正確率 / 100) ^ 0.3` |
| 毛正確率門檻 | 毛正確率 ≥ 80 → 1；< 80 → `(毛正確率 / 80)³`（急遽趨近 0，防止低正確率仍取得高分） |
| 難度係數 | 初級 × 0.90、中級 × 0.95、高級 × 1.00 |
| 完成度係數 | 以 15 WPM 為基準時間估算節奏（範圍 1–200），再乘上「已輸入字數 / 文章字數」；提前交卷會等比例下修 |
| 字數係數 | `(文章字數 + 20) / 100`（80 字 → ×1.00，144 字 → ×1.64） |

**模擬數據（100 字文章，字數係數 ×1.20）**

| WPM | 淨正確率 | 毛正確率 | 難度 | 分數 | 等第 |
|-----|---------|---------|------|------|------|
| 5  | 78% | 70% | 初級 | 3,815 | 多加練習 |
| 8  | 82% | 75% | 初級 | 5,642 | 繼續加油 |
| 10 | 85% | 78% | 中級 | 7,406 | 不錯 |
| 13 | 88% | 83% | 中級 | 8,875 | 優秀 |
| 15 | 93% | 89% | 中級 | 9,877 | 優秀 |
| 18 | 91% | 86% | 高級 | 10,163 | 優秀 |
| 20 | 94% | 91% | 高級 | 10,784 | 優秀 |

等第閾值：≥ 8,500 優秀 / ≥ 7,000 不錯 / ≥ 5,500 繼續加油

#### 考試模式（0–100 分）

完成度係數改為 `已提交字數 / 文章總字數`（0–1），考試時間為 15 分鐘。字數係數固定為 ×1.00（不受影響）。

**模擬數據**

| WPM | 淨正確率 | 毛正確率 | 難度 | 完成度 | 分數 | 等第 |
|-----|---------|---------|------|-------|------|------|
| 8  | 80% | 73% | 初級 | 80% | 33 | 多加練習 |
| 10 | 85% | 79% | 中級 | 85% | 55 | 繼續加油 |
| 12 | 88% | 83% | 中級 | 90% | 66 | 繼續加油 |
| 15 | 93% | 90% | 中級 | 100% | 83 | 不錯 |
| 20 | 95% | 92% | 高級 | 100% | 91 | 優秀 |
| 25 | 99% | 97% | 高級 | 100% | 98 | 優秀 |

等第閾值：≥ 85 優秀 / ≥ 70 不錯 / ≥ 55 繼續加油

#### 成績概算

考試模式下，毛正確率（80–100%）與打字速度（WPM 5–25）的分數分布，依初級 / 中級 / 高級三種難度分別列出：

**[https://bonjk.github.io/typerbon/score-guide.html](https://bonjk.github.io/typerbon/score-guide.html)**（淨正確率 100%，完成度 100% 的理想條件）

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
- 密碼以 SHA-256 hash 儲存於 Firestore `settings/teacher`
- 考試下拉選單僅顯示 tag 為 `考試` 的文章；`練習` 與 `名著` 文章不會出現在考試選項中
- 考試用文章學生也可在練習模式中自由使用
- 考試成績存於 leaderboard 集合，不影響練習排行榜

---

### Firestore 資料結構

```
articles/{id}
  title, difficulty (easy/medium/hard), content
  tags: ["practice"|"exam"|"名著"]   ← 可複選
  isDefault, isExam, createdAt

records/{studentId}/sessions/{sessionId}
  ts, articleId, articleTitle, wpm, accuracy, grossAccuracy
  score, completionFactor, wordCount, difficulty, elapsed, letterStats

leaderboard/{studentId}                      # 練習最高分
  studentId, classCode, bestScore, bestWpm
  bestAcc, articleTitle, updatedAt

leaderboard/exam_{examId}__{studentId}       # 考試成績
  examId, studentId, score, wpm, accuracy
  grossAccuracy, difficulty, completion
  articleTitle, isExamResult
  reset (true = 已被老師重設)

settings/teacher    → password (SHA-256 hash)
settings/activeExam → id, classCode, status, articles, startedAt
settings/seeded     → version (目前 4), seededAt

students/{studentId}                         # 學生個人資料
  studentId, theme, fontSize
  achievements: [ achievement id 陣列 ]
  updatedAt
```

---

### 參考資料

- 成就提示框設計參考：[chillcomponent — card-futuristic](https://chillcomponent.codlin.me/components/card-futuristic/)
