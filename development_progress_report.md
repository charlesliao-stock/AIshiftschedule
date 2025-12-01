# 護理站 AI 排班系統 - 13週開發進度清單

**專案名稱:** 護理站 AI 排班系統  
**開發週期:** 13週 (91天)  
**當前進度:** Week 5 (38.5%)  
**更新日期:** 2025-01-01

---

## 📊 總體進度概覽

| Phase | 週次 | 狀態 | 完成度 |
|-------|------|------|--------|
| **Phase 1: 核心功能 (MVP)** | Week 1-4 | ✅ 完成 | 100% |
| **Phase 2: 進階功能** | Week 5-8 | 🔄 進行中 | 12.5% |
| **Phase 3: 完善功能** | Week 9-11 | ⏳ 未開始 | 0% |
| **Phase 4: 優化測試** | Week 12-13 | ⏳ 未開始 | 0% |

**整體完成度:** 38.5% (5/13 週)

---

## Phase 1: 核心功能 (MVP) - Week 1-4

### ✅ Week 1: Firebase 基礎架構 + UI 框架

#### 📁 配置檔案
- [x] `js/config/constants.js` - 系統常數定義
- [x] `js/config/firebase.config.js` - Firebase 配置
- [x] `js/config/api.config.js` - API 端點配置

https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/config/constants.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/config/firebase.config.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/config/api.config.js

#### 📁 核心模組
- [x] `js/core/utils.js` - 工具函式庫
- [x] `js/core/storage.js` - 本地儲存管理
- [x] `js/core/auth.js` - 認證管理
- [x] `js/core/router.js` - 路由管理

https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/core/utils.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/core/storage.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/core/auth.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/core/router.js

#### 📁 服務層
- [x] `js/services/firebase.service.js` - Firebase 服務
- [x] `js/services/sheets.service.js` - Google Sheets API

https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/services/firebase.service.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/services/sheets.service.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/services/unit.service.js


#### 📁 UI 元件
- [x] `js/components/navbar.js` - 導航列
- [x] `js/components/sidebar.js` - 側邊欄
- [x] `js/components/loading.js` - 載入動畫
- [x] `js/components/notification.js` - 通知元件
- [x] `js/components/modal.js` - 彈窗元件

https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/components/loading.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/components/modal.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/components/navbar.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/components/notification.js
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/js/components/sidebar.js

#### 📁 基礎頁面
- [x] `index.html` - 主入口頁面
- [x] `login.html` - 登入頁面

https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/index.html
https://raw.githubusercontent.com/charlesliao-stock/AIshiftschedule/refs/heads/main/login.html

#### 📁 樣式檔案
- [x] `css/main.css` - 主要樣式
- [x] `css/components.css` - 元件樣式
- [x] `css/responsive.css` - 響應式設計

#### 📁 應用程式
- [x] `js/app.js` - 應用程式進入點

**功能:**
- ✅ Firebase Authentication (Email/密碼登入)
- ✅ Firestore 資料庫結構
- ✅ 三種角色權限系統 (Admin/Scheduler/Viewer)
- ✅ 基礎 UI 框架
- ✅ 響應式導航系統
- ✅ 路由保護機制

---

### ✅ Week 2: 單位管理 + Google Sheets 初始化

#### 📁 服務層
- [x] `js/services/unit.service.js` - 單位服務

#### 📁 資料模型
- [x] `js/models/unit.model.js` - 單位模型

#### 📁 管理模組
- [x] `js/modules/unit-management/unit-management.js` - 單位管理主檔
- [x] `js/modules/unit-management/unit-create.js` - 新增單位
- [x] `js/modules/unit-management/unit-edit.js` - 編輯單位
- [x] `js/modules/unit-management/user-assignment.js` - 使用者分配

#### 📁 頁面
- [x] `pages/unit-management.html` - 單位管理頁面

#### 📁 Google Apps Script
- [x] `gas/api-endpoints.gs` - API 端點
- [x] `gas/sheets-handler.gs` - Sheets 操作
- [x] `gas/unit-setup.gs` - 單位初始化腳本

**功能:**
- ✅ 單位 CRUD 操作
- ✅ 自動建立 3 個 Sheets 檔案
  - `{單位}_設定檔`
  - `{單位}_預班表`
  - `{單位}_排班表`
- ✅ 初始化工作表結構
- ✅ 設定共享權限
- ✅ 使用者分配到單位

---

### ✅ Week 3: 設定管理模組

#### 📁 服務層
- [x] `js/services/settings.service.js` - 設定服務

#### 📁 資料模型
- [x] `js/models/shift.model.js` - 班別模型
- [x] `js/models/group.model.js` - 組別模型
- [x] `js/models/staff.model.js` - 人員模型
- [x] `js/models/rule.model.js` - 規則模型

#### 📁 設定模組
- [x] `js/modules/settings/settings.js` - 設定主檔
- [x] `js/modules/settings/shift-management.js` - 班別管理
- [x] `js/modules/settings/group-management.js` - 組別管理
- [x] `js/modules/settings/staff-management.js` - 人員管理
- [x] `js/modules/settings/rule-management.js` - 規則管理
- [x] `js/modules/settings/holiday-management.js` - 假日設定
- [x] `js/modules/settings/labor-law-settings.js` - 勞基法規範

#### 📁 頁面
- [x] `pages/settings.html` - 設定管理頁面

#### 📁 Google Apps Script
- [x] `gas/settings-api.gs` - 設定檔 API

**功能:**
- ✅ 班別管理 (CRUD、順序、顏色)
- ✅ 組別管理 (CRUD、人數上下限)
- ✅ 人員管理 (CRUD、批次匯入、組別分配、包班設定)
- ✅ 排班規則設定 (應放天數、預班限制、包班規則、接班順序)
- ✅ 假日日曆 (國定假日、週末設定)
- ✅ 勞基法規範 (四週/兩週變形工時設定)

---

### ✅ Week 4: 基礎排班功能

#### 📁 服務層
- [x] `js/services/schedule.service.js` - 排班服務

#### 📁 資料模型
- [x] `js/models/schedule.model.js` - 排班模型

#### 📁 排班模組
- [x] `js/modules/schedule/schedule.js` - 排班主檔
- [x] `js/modules/schedule/manual-schedule.js` - 手動排班
- [x] `js/modules/schedule/schedule-view.js` - 排班檢視
- [x] `js/modules/schedule/schedule-check.js` - 規則檢查

#### 📁 簡易 AI 引擎
- [x] `js/modules/ai-engine/ai-engine.js` - AI 引擎主檔
- [x] `js/modules/ai-engine/basic-algorithm.js` - 基本演算法

#### 📁 頁面
- [x] `pages/schedule.html` - 排班管理頁面

#### 📁 Google Apps Script
- [x] `gas/schedule-api.gs` - 排班表 API

**功能:**
- ✅ 手動排班介面 (含前月後6天)
- ✅ 點擊儲存格編輯班別
- ✅ 即時統計更新
- ✅ 簡易 AI 排班演算法 (讀取預班、隨機分配、基本人數檢查)
- ✅ 排班衝突檢測
- ✅ 日曆/月份切換視圖
- ✅ 列印預覽功能

---

## Phase 2: 進階功能 - Week 5-8

### 🔄 Week 5: 預班功能

#### 📁 服務層
- [ ] `js/services/pre-schedule.service.js` - 預班服務

#### 📁 預班模組
- [ ] `js/modules/pre-schedule/pre-schedule.js` - 預班主檔
- [ ] `js/modules/pre-schedule/pre-schedule-view.js` - 預班查看
- [ ] `js/modules/pre-schedule/pre-schedule-submit.js` - 預班提交 (一般使用者)
- [ ] `js/modules/pre-schedule/pre-schedule-extra.js` - 額外預班 (排班者)
- [ ] `js/modules/pre-schedule/pre-schedule-config.js` - 預班設定

#### 📁 頁面
- [] `pages/pre-schedule.html` - 預班管理頁面

#### 📁 Google Apps Script
- [ ] `gas/pre-schedule-api.gs` - 預班表 API

**功能:**
- [ ] 預班表格顯示 (含前月後6天灰色)
- [ ] 預班開放/截止日期控制
- [ ] 預班狀態顯示 (open/closed/locked)
- [ ] 預班提交介面 (點擊選擇班別)
- [ ] 預班次數即時統計
- [ ] 每月上限檢查
- [ ] 每日上限檢查 (警告但允許)
- [ ] 額外預班功能 (排班者視角)
- [ ] 額外預班標記 (⭐) 不計入限額
- [ ] 預班衝突檢測
- [ ] 預班完成度儀表板

---

### ⏳ Week 6: 完整 AI 排班引擎

#### 📁 AI 引擎
- [ ] `js/modules/ai-engine/priority-engine.js` - 優先順序引擎
- [ ] `js/modules/ai-engine/strategy-engine.js` - 策略引擎
- [ ] `js/modules/ai-engine/rule-checker.js` - 規則檢查器
- [ ] `js/modules/ai-engine/conflict-resolver.js` - 衝突解決器
- [ ] `js/modules/ai-engine/optimizer.js` - 排班優化器

#### 📁 驗證器
- [ ] `js/validators/schedule.validator.js` - 排班驗證
- [ ] `js/validators/rule.validator.js` - 規則驗證

**功能:**
- [ ] 8 大優先順序實作
  - [ ] 預班內容 (強制)
  - [ ] 組別配置平衡
  - [ ] 包班規則
  - [ ] 勞基法規範
  - [ ] 連續上班限制
  - [ ] 接班順序
  - [ ] 假日公平性
  - [ ] 工作天數平衡
- [ ] 優先順序可調整介面
- [ ] 4 種排班策略 (平衡/包班/效率/自訂)
- [ ] 權重設定介面
- [ ] 衝突類型分類
- [ ] 降級策略實作
- [ ] 回溯演算法 (Backtracking)
- [ ] AI 排班報告生成

---

### ⏳ Week 7: 統計報表系統

#### 📁 統計模組
- [ ] `js/modules/statistics/statistics.js` - 統計主檔
- [ ] `js/modules/statistics/personal-stats.js` - 個人統計
- [ ] `js/modules/statistics/unit-stats.js` - 單位統計
- [ ] `js/modules/statistics/custom-stats.js` - 自訂統計
- [ ] `js/modules/statistics/chart-builder.js` - 圖表生成
- [ ] `js/modules/statistics/export-report.js` - 匯出報表

#### 📁 頁面
- [ ] `pages/statistics.html` - 統計報表頁面

**功能:**
- [ ] 個人統計卡片
  - [ ] 總工作天數
  - [ ] 休假天數
  - [ ] 加班天數
  - [ ] 假日上班
  - [ ] 各班別天數
  - [ ] 最長連續工作
  - [ ] 換班次數
- [ ] 統計圖表 (Chart.js)
- [ ] 趨勢圖
- [ ] 單位統計表格
- [ ] 人員工作負荷比較
- [ ] 預班滿足率
- [ ] 班別分布圖
- [ ] 自訂統計項目管理
- [ ] 匯出功能 (PDF/Excel/CSV)

---

### ⏳ Week 8: 通知系統

#### 📁 服務層
- [ ] `js/services/notification.service.js` - 通知服務

#### 📁 設定模組
- [ ] `js/modules/settings/notification-settings.js` - 通知設定

#### 📁 Google Apps Script
- [ ] `gas/notification-service.gs` - 通知服務
- [ ] `gas/email-templates.gs` - Email 範本
- [ ] `gas/line-notify.gs` - Line Notify 整合
- [ ] `gas/teams-webhook.gs` - Teams Webhook

**功能:**
- [ ] Email 通知整合 (MailApp)
- [ ] Email 範本設計
  - [ ] 預班開放通知
  - [ ] 預班截止提醒
  - [ ] 排班公告
  - [ ] 換班通知
- [ ] HTML Email 排版
- [ ] 配額管理機制
- [ ] 通知設定介面
  - [ ] 事件管理
  - [ ] 啟用/停用
  - [ ] 通知對象設定
  - [ ] 提前天數設定
- [ ] Line Notify 整合 (選配)
- [ ] Teams Webhook (選配)
- [ ] 通知排程系統
- [ ] 每日摘要通知

---

## Phase 3: 完善功能 - Week 9-11

### ⏳ Week 9: 換班功能

#### 📁 服務層
- [ ] `js/services/swap.service.js` - 換班服務

#### 📁 換班模組
- [ ] `js/modules/swap/swap.js` - 換班主檔
- [ ] `js/modules/swap/swap-request.js` - 換班申請
- [ ] `js/modules/swap/swap-approve.js` - 換班審核
- [ ] `js/modules/swap/swap-history.js` - 換班記錄

#### 📁 頁面
- [ ] `pages/swap.html` - 換班管理頁面

#### 📁 Google Apps Script
- [ ] `gas/swap-api.gs` - 換班 API

**功能:**
- [ ] 換班申請介面
- [ ] 選擇日期和對象
- [ ] 填寫換班原因
- [ ] 換班申請記錄
- [ ] 雙重審核機制
  - [ ] 被換班者審核介面
  - [ ] 排班者審核介面
- [ ] 審核通知
- [ ] 換班規則檢查
  - [ ] 時間限制 (公告後N天)
  - [ ] 次數限制
  - [ ] 班別限制
  - [ ] 規則違反檢查
- [ ] 換班記錄表
- [ ] 換班次數統計
- [ ] 換班後班表更新
- [ ] 異動記錄寫入

---

### ⏳ Week 10: 勞基法檢查

#### 📁 勞基法模組
- [ ] `js/modules/labor-law/labor-law.js` - 勞基法主檔
- [ ] `js/modules/labor-law/four-week-flex.js` - 四週變形工時
- [ ] `js/modules/labor-law/two-week-flex.js` - 兩週變形工時
- [ ] `js/modules/labor-law/general-standard.js` - 一般規定
- [ ] `js/modules/labor-law/violation-detector.js` - 違規檢測

#### 📁 驗證器
- [ ] `js/validators/labor-law.validator.js` - 勞基法驗證

**功能:**
- [ ] 四週變形工時檢查
  - [ ] 每日工時 (≤10小時)
  - [ ] 每週工時 (≤48小時)
  - [ ] 四週工時 (≤160小時)
  - [ ] 每七日休息一日
- [ ] 兩週變形工時檢查
- [ ] 一般規定檢查 (8/40)
- [ ] 連續休息時間檢查 (11小時)
- [ ] 即時違規檢查
- [ ] 違規等級分類
  - [ ] 警告 (黃色)
  - [ ] 錯誤 (紅色)
  - [ ] 嚴重 (深紅色)
- [ ] 違規提示訊息
- [ ] 禁止公告機制
- [ ] 勞基法符合度報表
- [ ] 違規項目統計
- [ ] 改善建議生成

---

### ⏳ Week 11: 備份與歸檔

#### 📁 服務層
- [ ] `js/services/backup.service.js` - 備份服務

#### 📁 Google Apps Script
- [ ] `gas/backup-service.gs` - 備份服務
- [ ] `gas/archive-service.gs` - 歸檔服務
- [ ] `gas/triggers.gs` - 定時觸發器

**功能:**
- [ ] 每日自動備份
- [ ] Apps Script 定時觸發器
- [ ] 複製 Sheets 檔案
- [ ] 存到備份資料夾
- [ ] 保留 30 天備份
- [ ] 清理舊備份
- [ ] 異地備份 (不同 Google 帳號)
- [ ] 備份資料夾結構
- [ ] 備份狀態監控
- [ ] 備份失敗通知
- [ ] 5年資料歸檔
- [ ] 每月自動歸檔
- [ ] 超過5年資料移轉
- [ ] 歸檔區唯讀設定
- [ ] 歸檔查詢介面
- [ ] 備份列表顯示
- [ ] 資料恢復功能
- [ ] 恢復前預覽
- [ ] 恢復後驗證

---

## Phase 4: 優化與測試 - Week 12-13

### ⏳ Week 12: 手機版優化 + 效能優化

#### 📁 樣式優化
- [ ] `css/mobile.css` - 手機版專用樣式
- [ ] `css/tablet.css` - 平板專用樣式

#### 📁 效能優化
- [ ] `js/core/cache-manager.js` - 快取管理
- [ ] `js/core/lazy-loader.js` - 延遲載入
- [ ] `js/components/virtual-scroll.js` - 虛擬滾動

**功能:**
- [ ] 響應式設計調整
  - [ ] 斷點優化 (手機/平板/桌面)
  - [ ] 漢堡選單
  - [ ] 排班表橫向捲動
  - [ ] 觸控手勢支援
- [ ] 手機版功能優化
  - [ ] 預班大按鈕設計
  - [ ] 滑動切換月份
  - [ ] 縮放手勢
  - [ ] 快速操作介面
- [ ] 效能優化
  - [ ] 元件優化
  - [ ] 虛擬滾動實作
  - [ ] 快取機制
  - [ ] API 批次處理
  - [ ] Lazy Loading
  - [ ] 圖片優化
  - [ ] 程式碼壓縮

---

### ⏳ Week 13: 測試、修正與文件

#### 📁 測試檔案
- [ ] `tests/unit/` - 單元測試
- [ ] `tests/integration/` - 整合測試
- [ ] `tests/e2e/` - 端對端測試

#### 📁 文件
- [ ] `docs/README.md` - 專案說明
- [ ] `docs/INSTALLATION.md` - 安裝指南
- [ ] `docs/API.md` - API 文件
- [ ] `docs/USER_GUIDE.md` - 使用者手冊
- [ ] `docs/DEVELOPER_GUIDE.md` - 開發者手冊

**功能:**
- [ ] 功能測試
  - [ ] 所有功能端到端測試
  - [ ] 三種角色權限測試
  - [ ] 邊界情況測試
  - [ ] 錯誤處理測試
- [ ] 壓力測試
  - [ ] 60 單位同時操作
  - [ ] 1200 人員資料載入
  - [ ] 併發寫入測試
  - [ ] API 配額測試
- [ ] Bug 修正
  - [ ] 收集測試問題
  - [ ] 優先順序排序
  - [ ] 逐一修正
  - [ ] 回歸測試
- [ ] 使用者文件
  - [ ] 管理者操作手冊
  - [ ] 排班者操作手冊
  - [ ] 一般使用者操作手冊
  - [ ] 常見問題 FAQ
  - [ ] 影片教學 (可選)
- [ ] 系統文件
  - [ ] 架構文件
  - [ ] API 文件
  - [ ] 部署文件
  - [ ] 維護文件