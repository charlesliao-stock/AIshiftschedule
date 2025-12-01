/**
 * Google Apps Script - 單位初始化腳本
 * 自動建立單位所需的 3 個 Google Sheets 檔案
 */

// ==================== 主要初始化函式 ====================

/**
 * 建立新單位的所有 Sheets 檔案
 * @param {Object} unitData - 單位資料
 * @returns {Object} 建立結果
 */
function setupNewUnit(unitData) {
  try {
    Logger.log('開始建立單位: ' + unitData.unit_code);
    
    const result = {
      success: true,
      unit_id: unitData.unit_id || generateUnitId(),
      unit_code: unitData.unit_code,
      unit_name: unitData.unit_name,
      sheets: {}
    };
    
    // 1. 建立設定檔
    Logger.log('建立設定檔...');
    const settingsSheet = createSettingsSheet(unitData);
    result.sheets.settings = {
      id: settingsSheet.getId(),
      url: settingsSheet.getUrl()
    };
    
    // 2. 建立預班表
    Logger.log('建立預班表...');
    const preScheduleSheet = createPreScheduleSheet(unitData);
    result.sheets.preSchedule = {
      id: preScheduleSheet.getId(),
      url: preScheduleSheet.getUrl()
    };
    
    // 3. 建立排班表
    Logger.log('建立排班表...');
    const scheduleSheet = createScheduleSheet(unitData);
    result.sheets.schedule = {
      id: scheduleSheet.getId(),
      url: scheduleSheet.getUrl()
    };
    
    // 4. 分享給指定使用者
    Logger.log('設定權限...');
    shareToUsers(result.sheets, unitData);
    
    Logger.log('單位建立完成: ' + unitData.unit_code);
    return result;
    
  } catch (error) {
    Logger.log('建立單位失敗: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// ==================== 建立設定檔 ====================

/**
 * 建立設定檔 Spreadsheet
 * @param {Object} unitData - 單位資料
 * @returns {Spreadsheet}
 */
function createSettingsSheet(unitData) {
  const ssName = `${unitData.unit_code}_設定檔`;
  const ss = SpreadsheetApp.create(ssName);
  
  // 刪除預設的 Sheet1
  const defaultSheet = ss.getSheets()[0];
  
  // 建立各個工作表
  createShiftsSheet(ss);
  createGroupsSheet(ss);
  createStaffSheet(ss);
  createRulesSheet(ss);
  createHolidaysSheet(ss);
  createWeeklyRequirementsSheet(ss);
  
  // 刪除預設工作表
  ss.deleteSheet(defaultSheet);
  
  return ss;
}

/**
 * 建立班別設定工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createShiftsSheet(ss) {
  const sheet = ss.insertSheet('班別設定');
  
  // 設定標題
  const headers = ['班別ID', '班別名稱', '代碼', '開始時間', '結束時間', '顏色', '計入統計', '順序'];
  writeRow(sheet, 1, headers);
  
  // 預設班別資料
  const defaultShifts = [
    [1, '大夜', '大', '22:00', '08:00', '#E9D5FF', 'TRUE', 2],
    [2, '小夜', '小', '14:00', '22:00', '#C7D2FE', 'TRUE', 4],
    [3, '白班', '白', '08:00', '16:00', '#FEF3C7', 'TRUE', 3],
    [4, 'DL', 'DL', '14:00', '22:00', '#FED7AA', 'TRUE', 4],
    [5, '休假', 'FF', '', '', '#BBF7D0', 'FALSE', 1]
  ];
  
  writeRangeData(sheet, 2, 1, defaultShifts);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立組別設定工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createGroupsSheet(ss) {
  const sheet = ss.insertSheet('組別設定');
  
  // 設定標題
  const headers = ['組別ID', '組別名稱', '總人數', '每班最少人數', '每班最多人數', '描述'];
  writeRow(sheet, 1, headers);
  
  // 預設組別資料
  const defaultGroups = [
    [1, '資深組', 5, 1, 3, '資深護理師'],
    [2, '中階組', 4, 1, 2, '中階護理師'],
    [3, '資淺組', 4, 0, 2, '資淺護理師']
  ];
  
  writeRangeData(sheet, 2, 1, defaultGroups);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立人員設定工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createStaffSheet(ss) {
  const sheet = ss.insertSheet('人員設定');
  
  // 設定標題
  const headers = [
    '員工ID', '員工編號', '姓名', '職級', 
    '可上班別', '組別', '最大連續工作天數', 
    '是否包班', '包班類型', 'Email', '狀態'
  ];
  writeRow(sheet, 1, headers);
  
  // 範例資料
  const sampleStaff = [
    [1, '930462', '廖苡凱', 'N4', '大,小,白', '資深組', 6, 'TRUE', '大夜', 'staff1@example.com', '在職'],
    [2, '830330', '鍾淑英', 'N3', '大,小,白,DL', '資深組', 6, 'FALSE', '', 'staff2@example.com', '在職']
  ];
  
  writeRangeData(sheet, 2, 1, sampleStaff);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
  
  // 說明文字
  sheet.getRange('A' + (sheet.getLastRow() + 2)).setValue('說明: 可上班別以逗號分隔，例如: 大,小,白');
}

/**
 * 建立規則設定工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createRulesSheet(ss) {
  const sheet = ss.insertSheet('規則設定');
  
  // 設定標題
  const headers = ['規則名稱', '規則值', '說明'];
  writeRow(sheet, 1, headers);
  
  // 預設規則
  const defaultRules = [
    ['本月應放天數', '8', '每月應休假天數'],
    ['每日可預人數', 'dynamic', '每日可預班的人數上限 (dynamic=不限制)'],
    ['假日可預天數', '2', '假日可預班休假的天數上限'],
    ['全月可預天數', 'dynamic', '全月可預班的總天數 (dynamic=不限制)'],
    ['平均假日', '8.4', '平均假日天數 (統計用)'],
    ['包班最少天數', '16', '包班者最少需上班天數'],
    ['啟用包班規則', 'TRUE', '是否啟用包班規則'],
    ['啟用接班順序規則', 'TRUE', '是否啟用接班順序規則'],
    ['班別順序', 'FF,大,白,小,DL', '接班順序 (以逗號分隔)'],
    ['啟用FF後不接大夜', 'TRUE', 'FF後不接大夜 (包班者不受限)'],
    ['假日上限公式', 'Math.floor(假日數/2)', '假日上班天數上限計算公式'],
    ['OFF列入預班限額', 'TRUE', 'OFF是否計入預班次數限額'],
    ['其他班列入預班限額', 'FALSE', '其他班別是否計入預班次數限額'],
    ['換班開放天數', '7', '排班公告後N天內可換班'],
    ['勞基法類型', '四週變形', '勞基法類型 (四週變形/兩週變形/一般規定)']
  ];
  
  writeRangeData(sheet, 2, 1, defaultRules);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立假日設定工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createHolidaysSheet(ss) {
  const sheet = ss.insertSheet('假日設定');
  
  // 設定標題
  const headers = ['日期', '假日名稱', '類型', '啟用'];
  writeRow(sheet, 1, headers);
  
  // 範例假日 (當年度的國定假日)
  const currentYear = new Date().getFullYear();
  const sampleHolidays = [
    [`${currentYear}-01-01`, '元旦', '國定假日', 'TRUE'],
    [`${currentYear}-02-10`, '春節', '國定假日', 'TRUE'],
    [`${currentYear}-02-28`, '和平紀念日', '國定假日', 'TRUE'],
    [`${currentYear}-04-04`, '兒童節', '國定假日', 'TRUE'],
    [`${currentYear}-04-05`, '清明節', '國定假日', 'TRUE'],
    [`${currentYear}-10-10`, '國慶日', '國定假日', 'TRUE']
  ];
  
  writeRangeData(sheet, 2, 1, sampleHolidays);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
  
  // 說明文字
  sheet.getRange('A' + (sheet.getLastRow() + 2)).setValue('說明: 日期格式為 YYYY-MM-DD，週末會自動視為假日');
}

/**
 * 建立週間人數需求工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createWeeklyRequirementsSheet(ss) {
  const sheet = ss.insertSheet('週間人數需求');
  
  // 設定標題
  const headers = ['星期', '大夜', '小夜', '白班', 'DL'];
  writeRow(sheet, 1, headers);
  
  // 預設人數需求
  const defaultRequirements = [
    ['週一', 3, 2, 2, 1],
    ['週二', 3, 2, 2, 1],
    ['週三', 3, 2, 2, 1],
    ['週四', 3, 2, 2, 1],
    ['週五', 3, 2, 2, 1],
    ['週六', 4, 3, 2, 1],
    ['週日', 4, 3, 2, 1]
  ];
  
  writeRangeData(sheet, 2, 1, defaultRequirements);
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

// ==================== 建立預班表 ====================

/**
 * 建立預班表 Spreadsheet
 * @param {Object} unitData - 單位資料
 * @returns {Spreadsheet}
 */
function createPreScheduleSheet(unitData) {
  const ssName = `${unitData.unit_code}_預班表`;
  const ss = SpreadsheetApp.create(ssName);
  
  // 刪除預設的 Sheet1
  const defaultSheet = ss.getSheets()[0];
  
  // 建立預班狀態工作表
  createPreScheduleStatusSheet(ss);
  
  // 建立預班記錄工作表
  createPreScheduleLogSheet(ss);
  
  // 建立說明工作表
  createPreScheduleInstructionsSheet(ss);
  
  // 刪除預設工作表
  ss.deleteSheet(defaultSheet);
  
  return ss;
}

/**
 * 建立預班狀態工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createPreScheduleStatusSheet(ss) {
  const sheet = ss.insertSheet('預班狀態');
  
  // 設定標題
  const headers = ['月份', '狀態', '開放日期', '截止日期', '更新時間'];
  writeRow(sheet, 1, headers);
  
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
  
  // 說明文字
  sheet.getRange('A2').setValue('說明: 月份格式為 YYYYMM，狀態有: open(開放), closed(截止), locked(鎖定)');
}

/**
 * 建立預班記錄工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createPreScheduleLogSheet(ss) {
  const sheet = ss.insertSheet('預班記錄');
  
  // 設定標題
  const headers = ['時間', '操作', '員工ID', '月份', '備註'];
  writeRow(sheet, 1, headers);
  
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立預班說明工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createPreScheduleInstructionsSheet(ss) {
  const sheet = ss.insertSheet('使用說明');
  
  const instructions = [
    ['護理站預班系統使用說明'],
    [''],
    ['1. 預班表工作表'],
    ['   - 系統會為每個月份自動建立一個工作表'],
    ['   - 工作表名稱格式: YYYYMM (例如: 202501)'],
    ['   - 包含前月後6天和下月前6天的日期 (灰色顯示)'],
    [''],
    ['2. 預班狀態'],
    ['   - open: 開放填寫，所有人可編輯'],
    ['   - closed: 已截止，不可編輯'],
    ['   - locked: 已鎖定，排班者開始排班'],
    [''],
    ['3. 預班規則'],
    ['   - 每月預班次數上限: 依設定檔規則'],
    ['   - 假日預班限制: 依設定檔規則'],
    ['   - 額外預班 (標記⭐): 由排班者新增，不計入限額'],
    [''],
    ['4. 注意事項'],
    ['   - 請在截止日期前完成預班'],
    ['   - 預班不代表一定排到該班別'],
    ['   - 有疑問請聯繫排班者']
  ];
  
  writeRangeData(sheet, 1, 1, instructions);
  
  // 格式化標題
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  autoResizeColumns(sheet);
}

// ==================== 建立排班表 ====================

/**
 * 建立排班表 Spreadsheet
 * @param {Object} unitData - 單位資料
 * @returns {Spreadsheet}
 */
function createScheduleSheet(unitData) {
  const ssName = `${unitData.unit_code}_排班表`;
  const ss = SpreadsheetApp.create(ssName);
  
  // 刪除預設的 Sheet1
  const defaultSheet = ss.getSheets()[0];
  
  // 建立排班記錄工作表
  createScheduleLogSheet(ss);
  
  // 建立換班記錄工作表
  createSwapLogSheet(ss);
  
  // 建立統計工作表
  createStatisticsSheet(ss);
  
  // 建立說明工作表
  createScheduleInstructionsSheet(ss);
  
  // 刪除預設工作表
  ss.deleteSheet(defaultSheet);
  
  return ss;
}

/**
 * 建立排班記錄工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createScheduleLogSheet(ss) {
  const sheet = ss.insertSheet('排班記錄');
  
  // 設定標題
  const headers = ['時間', '操作', '月份', '操作者', '備註'];
  writeRow(sheet, 1, headers);
  
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立換班記錄工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createSwapLogSheet(ss) {
  const sheet = ss.insertSheet('換班記錄');
  
  // 設定標題
  const headers = ['申請時間', '申請人', '被換班者', '原日期', '換班日期', '原班別', '新班別', '狀態', '審核時間'];
  writeRow(sheet, 1, headers);
  
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立統計工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createStatisticsSheet(ss) {
  const sheet = ss.insertSheet('統計彙總');
  
  // 設定標題
  const headers = ['月份', '員工ID', '姓名', '總工作天數', '休假天數', '大夜', '小夜', '白班', 'DL', '假日上班', '連續最長'];
  writeRow(sheet, 1, headers);
  
  formatHeaderRow(sheet);
  autoResizeColumns(sheet);
}

/**
 * 建立排班說明工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 */
function createScheduleInstructionsSheet(ss) {
  const sheet = ss.insertSheet('使用說明');
  
  const instructions = [
    ['護理站排班系統使用說明'],
    [''],
    ['1. 排班表工作表'],
    ['   - 系統會為每個月份自動建立一個工作表'],
    ['   - 工作表名稱格式: YYYYMM (例如: 202501)'],
    ['   - 包含前月後6天和下月前6天的日期'],
    [''],
    ['2. 排班方式'],
    ['   - 手動排班: 排班者直接編輯'],
    ['   - AI 排班: 系統自動排班'],
    ['   - 規則檢查: 自動檢查是否違反規則'],
    [''],
    ['3. 勞基法檢查'],
    ['   - 每日工時檢查'],
    ['   - 每週工時檢查'],
    ['   - 四週/兩週工時檢查'],
    ['   - 連續休息時間檢查'],
    [''],
    ['4. 換班管理'],
    ['   - 填寫換班記錄工作表'],
    ['   - 需經雙重審核 (被換班者 + 排班者)'],
    ['   - 公告後N天內可換班'],
    [''],
    ['5. 統計功能'],
    ['   - 個人統計: 查看個人工作統計'],
    ['   - 單位統計: 查看全單位統計'],
    ['   - 可匯出報表']
  ];
  
  writeRangeData(sheet, 1, 1, instructions);
  
  // 格式化標題
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  autoResizeColumns(sheet);
}

// ==================== 權限管理 ====================

/**
 * 分享 Sheets 給使用者
 * @param {Object} sheets - Sheets 資訊
 * @param {Object} unitData - 單位資料
 */
function shareToUsers(sheets, unitData) {
  try {
    // 分享給管理者 (編輯權限)
    if (unitData.admin_users && unitData.admin_users.length > 0) {
      unitData.admin_users.forEach(email => {
        shareSpreadsheet(sheets.settings.id, email, 'edit');
        shareSpreadsheet(sheets.preSchedule.id, email, 'edit');
        shareSpreadsheet(sheets.schedule.id, email, 'edit');
      });
    }
    
    // 分享給排班者 (編輯權限)
    if (unitData.scheduler_users && unitData.scheduler_users.length > 0) {
      unitData.scheduler_users.forEach(email => {
        shareSpreadsheet(sheets.settings.id, email, 'edit');
        shareSpreadsheet(sheets.preSchedule.id, email, 'edit');
        shareSpreadsheet(sheets.schedule.id, email, 'edit');
      });
    }
    
    Logger.log('權限設定完成');
    
  } catch (error) {
    Logger.log('設定權限失敗: ' + error.toString());
  }
}

// ==================== 工具函式 ====================

/**
 * 產生單位 ID
 * @returns {string}
 */
function generateUnitId() {
  return 'unit_' + Utilities.getUuid().substring(0, 8);
}

/**
 * 測試建立單位
 */
function testSetupNewUnit() {
  const testData = {
    unit_code: 'TEST',
    unit_name: '測試病房',
    admin_users: ['admin@example.com'],
    scheduler_users: ['scheduler@example.com']
  };
  
  const result = setupNewUnit(testData);
  Logger.log(JSON.stringify(result, null, 2));
}