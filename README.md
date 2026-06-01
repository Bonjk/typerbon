# TypeDojo — 英文打字練習平台

架設在 GitHub Pages 的靜態打字練習網站。

## 檔案結構

```
typing-practice/
├── index.html     學生練習主頁
├── teacher.html   教師後台
├── style.css      樣式表
├── data.js        資料層（文章、成績、工具函式）
├── app.js         學生端邏輯
└── teacher.js     教師後台邏輯
```

## 部署步驟（GitHub Pages）

1. 在 GitHub 建立新 repository（例如：`typing-practice`）
2. 將以上所有檔案上傳至 repository 根目錄
3. 進入 repository → **Settings** → **Pages**
4. Source 選擇 **Deploy from a branch**，Branch 選 `main`，資料夾選 `/ (root)`
5. 儲存後等待約 1 分鐘，網址會是：
   ```
   https://你的帳號.github.io/typing-practice/
   ```

---

## 教師後台

網址：`https://你的帳號.github.io/typing-practice/teacher.html`

**預設密碼：`teacher123`**

> ⚠️ 注意：密碼儲存在瀏覽器的 `localStorage`，修改密碼只影響當前瀏覽器。
> 若需要統一密碼，請直接修改 `data.js` 裡的 `DEFAULT_PW` 值。

### 後台功能
- **文章管理**：新增、編輯、刪除文章（預設文章無法刪除）
- **學生查詢**：輸入班級座號查看個別成績
- **匯出 CSV**：下載全班成績 Excel 可開啟的 CSV 檔

---

## 學生登入格式

五碼數字 = **班級三碼** + **座號兩碼**

| 範例 | 班級 | 座號 |
|------|------|------|
| 80213 | 802 班 | 13 號 |
| 70934 | 709 班 | 34 號 |
| 10105 | 101 班 | 05 號 |

---

## 成績計算公式

```
綜合分數 = WPM × 正確率² × 100
```

- **WPM**（Words Per Minute）：每分鐘打幾個英文單字
- **正確率**：0.0 ~ 1.0（例如 95% → 0.95）
- 正確率取平方，讓打錯字的懲罰遠大於速度慢

| WPM | 正確率 | 分數 |
|-----|--------|------|
| 40  | 100%   | 4000 |
| 40  | 90%    | 3240 |
| 60  | 85%    | 4335 |
| 30  | 70%    | 1470 |

---

## 資料儲存說明

所有資料儲存在**學生自己的瀏覽器** `localStorage`：

- 成績跨次登入保留（同一瀏覽器）
- 換瀏覽器或裝置資料不會同步
- 清除瀏覽器資料會刪除所有紀錄

> 若需要跨裝置同步，需要接後端資料庫（如 Firebase）。

---

## 修改預設密碼（永久生效）

開啟 `data.js`，找到：
```javascript
DEFAULT_PW: "teacher123",
```
改成你想要的密碼後重新上傳即可。
