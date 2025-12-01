/**
 * 護理站 AI 排班系統 - 設定檔 API
 * Google Apps Script API 端點
 * 處理所有設定相關的資料存取
 */

// ==================== 全域變數 ====================
const SETTINGS_SHEET_NAME = {
  SHIFTS: '班別定義',
  GROUPS: '組別定義',
  STAFF: '人員資料',
  RULES: '排班規則',
  WEEKLY_REQ: '週間人數需求',
  HOLIDAYS: '假日設定',
  NOTIFICATIONS: '通知設定',
  LABOR_LAW: '勞基法規範'
};

// ==================== 主要 API 端點 ====================

/**
 * doGet - 處理 GET 請求
 * @param {Object} e - 請求參數
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheetId = e.parameter.sheetId;
    
    if (!sheetId) {
      return createResponse(false, '缺少 sheetId 參數');
    }
    
    const ss = SpreadsheetApp.openById(sheetId);
    
    switch (action) {
      case 'getAllSettings':
        return getAllSettings(ss);
      case 'getShifts':
        return getShifts(ss);
      case 'getGroups':
        return getGroups(ss);
      case 'getStaff':
        return getStaff(ss);
      case 'getRules':
        return getRules(ss);
      case 'getWeeklyRequirements':
        return getWeeklyRequirements(ss);
      case 'getHolidays':
        return getHolidays(ss);
      case 'getNotifications':
        return getNotifications(ss);
      case 'getLaborLaw':
        return getLaborLaw(ss);
      default:
        return createResponse(false, '未知的操作: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * doPost - 處理 POST 請求
 * @param {Object} e - 請求參數
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheetId = data.sheetId;
    
    if (!sheetId) {
      return createResponse(false, '缺少 sheetId 參數');
    }
    
    const ss = SpreadsheetApp.openById(sheetId);
    
    switch (action) {
      // 班別管理
      case 'saveShifts':
        return saveShifts(ss, data.shifts);
      case 'addShift':
        return addShift(ss, data.shift);
      case 'updateShift':
        return updateShift(ss, data.shift);
      case 'deleteShift':
        return deleteShift(ss, data.shiftId);
        
      // 組別管理
      case 'saveGroups':
        return saveGroups(ss, data.groups);
      case 'addGroup':
        return addGroup(ss, data.group);
      case 'updateGroup':
        return updateGroup(ss, data.group);
      case 'deleteGroup':
        return deleteGroup(ss, data.groupId);
        
      // 人員管理
      case 'saveStaff':
        return saveStaff(ss, data.staff);
      case 'addStaff':
        return addStaff(ss, data.staffMember);
      case 'updateStaff':
        return updateStaff(ss, data.staffMember);
      case 'deleteStaff':
        return deleteStaff(ss, data.staffId);
      case 'importStaff':
        return importStaff(ss, data.staffList);
        
      // 規則管理
      case 'saveRules':
        return saveRules(ss, data.rules);
        
      // 週間需求
      case 'saveWeeklyRequirements':
        return saveWeeklyRequirements(ss, data.requirements);
        
      // 假日設定
      case 'saveHolidays':
        return saveHolidays(ss, data.holidays);
      case 'addHoliday':
        return addHoliday(ss, data.holiday);
      case 'deleteHoliday':
        return deleteHoliday(ss, data.date);
        
      // 通知設定
      case 'saveNotifications':
        return saveNotifications(ss, data.notifications);
        
      // 勞基法規範
      case 'saveLaborLaw':
        return saveLaborLaw(ss, data.laborLaw);
        
      default:
        return createResponse(false, '未知的操作: ' + action);
    }
  } catch (error) {
    return createErrorResponse(error);
  }
}

// ==================== 讀取功能 ====================

/**
 * 取得所有設定
 */
function getAllSettings(ss) {
  try {
    const settings = {
      shifts: getShiftsData(ss),
      groups: getGroupsData(ss),
      staff: getStaffData(ss),
      rules: getRulesData(ss),
      weeklyRequirements: getWeeklyRequirementsData(ss),
      holidays: getHolidaysData(ss),
      notifications: getNotificationsData(ss),
      laborLaw: getLaborLawData(ss)
    };
    
    return createResponse(true, '設定載入成功', settings);
  } catch (error) {
    throw new Error('載入設定失敗: ' + error.message);
  }
}

/**
 * 取得班別定義
 */
function getShifts(ss) {
  const data = getShiftsData(ss);
  return createResponse(true, '班別載入成功', data);
}

function getShiftsData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.SHIFTS);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const shifts = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // 跳過空行
    
    shifts.push({
      id: row[0],
      name: row[1],
      code: row[2],
      startTime: row[3],
      endTime: row[4],
      color: row[5],
      countToStats: row[6],
      order: row[7]
    });
  }
  
  return shifts;
}

/**
 * 取得組別定義
 */
function getGroups(ss) {
  const data = getGroupsData(ss);
  return createResponse(true, '組別載入成功', data);
}

function getGroupsData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.GROUPS);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const groups = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    groups.push({
      id: row[0],
      name: row[1],
      totalStaff: row[2],
      minPerShift: row[3],
      maxPerShift: row[4],
      description: row[5]
    });
  }
  
  return groups;
}

/**
 * 取得人員資料
 */
function getStaff(ss) {
  const data = getStaffData(ss);
  return createResponse(true, '人員載入成功', data);
}

function getStaffData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.STAFF);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const staff = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    staff.push({
      employeeId: row[0],
      name: row[1],
      level: row[2],
      availableShifts: row[3] ? row[3].split(',') : [],
      group: row[4],
      maxConsecutiveDays: row[5],
      isPackage: row[6],
      packageType: row[7],
      email: row[8],
      lineId: row[9],
      status: row[10]
    });
  }
  
  return staff;
}

/**
 * 取得排班規則
 */
function getRules(ss) {
  const data = getRulesData(ss);
  return createResponse(true, '規則載入成功', data);
}

function getRulesData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.RULES);
  if (!sheet) {
    return {};
  }
  
  const data = sheet.getDataRange().getValues();
  const rules = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    const category = row[0];
    const item = row[1];
    const value = row[2];
    
    if (!rules[category]) {
      rules[category] = {};
    }
    
    rules[category][item] = value;
  }
  
  return rules;
}

/**
 * 取得週間人數需求
 */
function getWeeklyRequirements(ss) {
  const data = getWeeklyRequirementsData(ss);
  return createResponse(true, '週間需求載入成功', data);
}

function getWeeklyRequirementsData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.WEEKLY_REQ);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const requirements = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === undefined) continue;
    
    requirements.push({
      weekday: row[0],
      weekdayIndex: row[1],
      nightMajor: row[2],
      nightMinor: row[3],
      day: row[4],
      dl: row[5]
    });
  }
  
  return requirements;
}

/**
 * 取得假日設定
 */
function getHolidays(ss) {
  const data = getHolidaysData(ss);
  return createResponse(true, '假日載入成功', data);
}

function getHolidaysData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.HOLIDAYS);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const holidays = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    holidays.push({
      date: row[0],
      name: row[1],
      type: row[2],
      enabled: row[3],
      year: row[4]
    });
  }
  
  return holidays;
}

/**
 * 取得通知設定
 */
function getNotifications(ss) {
  const data = getNotificationsData(ss);
  return createResponse(true, '通知設定載入成功', data);
}

function getNotificationsData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.NOTIFICATIONS);
  if (!sheet) {
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const notifications = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    notifications.push({
      event: row[0],
      enabled: row[1],
      target: row[2],
      channels: row[3] ? row[3].split(',') : [],
      daysAhead: row[4]
    });
  }
  
  return notifications;
}

/**
 * 取得勞基法規範
 */
function getLaborLaw(ss) {
  const data = getLaborLawData(ss);
  return createResponse(true, '勞基法規範載入成功', data);
}

function getLaborLawData(ss) {
  const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.LABOR_LAW);
  if (!sheet) {
    return {};
  }
  
  const data = sheet.getDataRange().getValues();
  const laborLaw = {};
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    const type = row[0];
    const item = row[1];
    const value = row[2];
    const enabled = row[3];
    
    if (!laborLaw[type]) {
      laborLaw[type] = {};
    }
    
    laborLaw[type][item] = {
      value: value,
      enabled: enabled,
      description: row[4]
    };
  }
  
  return laborLaw;
}

// ==================== 寫入功能 ====================

/**
 * 儲存班別定義
 */
function saveShifts(ss, shifts) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.SHIFTS);
    
    // 清空現有資料
    sheet.clear();
    
    // 寫入標題
    const headers = ['班別ID', '班別名稱', '班別代碼', '起始時間', '結束時間', '顏色代碼', '列入統計', '順序'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // 寫入資料
    if (shifts && shifts.length > 0) {
      const rows = shifts.map(s => [
        s.id,
        s.name,
        s.code,
        s.startTime,
        s.endTime,
        s.color,
        s.countToStats,
        s.order
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    // 格式化
    formatShiftSheet(sheet);
    
    return createResponse(true, '班別儲存成功');
  } catch (error) {
    throw new Error('儲存班別失敗: ' + error.message);
  }
}

/**
 * 新增單一班別
 */
function addShift(ss, shift) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.SHIFTS);
    const lastRow = sheet.getLastRow();
    
    const row = [
      shift.id,
      shift.name,
      shift.code,
      shift.startTime,
      shift.endTime,
      shift.color,
      shift.countToStats,
      shift.order
    ];
    
    sheet.getRange(lastRow + 1, 1, 1, row.length).setValues([row]);
    
    return createResponse(true, '班別新增成功');
  } catch (error) {
    throw new Error('新增班別失敗: ' + error.message);
  }
}

/**
 * 更新班別
 */
function updateShift(ss, shift) {
  try {
    const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.SHIFTS);
    if (!sheet) {
      throw new Error('找不到班別工作表');
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shift.id) {
        const row = [
          shift.id,
          shift.name,
          shift.code,
          shift.startTime,
          shift.endTime,
          shift.color,
          shift.countToStats,
          shift.order
        ];
        
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return createResponse(true, '班別更新成功');
      }
    }
    
    throw new Error('找不到指定的班別');
  } catch (error) {
    throw new Error('更新班別失敗: ' + error.message);
  }
}

/**
 * 刪除班別
 */
function deleteShift(ss, shiftId) {
  try {
    const sheet = ss.getSheetByName(SETTINGS_SHEET_NAME.SHIFTS);
    if (!sheet) {
      throw new Error('找不到班別工作表');
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === shiftId) {
        sheet.deleteRow(i + 1);
        return createResponse(true, '班別刪除成功');
      }
    }
    
    throw new Error('找不到指定的班別');
  } catch (error) {
    throw new Error('刪除班別失敗: ' + error.message);
  }
}

/**
 * 儲存組別定義
 */
function saveGroups(ss, groups) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.GROUPS);
    
    sheet.clear();
    
    const headers = ['組別ID', '組別名稱', '總員額', '每班至少', '每班最多', '說明'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (groups && groups.length > 0) {
      const rows = groups.map(g => [
        g.id,
        g.name,
        g.totalStaff,
        g.minPerShift,
        g.maxPerShift,
        g.description
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '組別儲存成功');
  } catch (error) {
    throw new Error('儲存組別失敗: ' + error.message);
  }
}

/**
 * 儲存人員資料
 */
function saveStaff(ss, staff) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.STAFF);
    
    sheet.clear();
    
    const headers = ['員工編號', '姓名', '層級', '可上班別', '組別', '最長連續天數', '是否包班', '包班類型', 'Email', 'Line ID', '狀態'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (staff && staff.length > 0) {
      const rows = staff.map(s => [
        s.employeeId,
        s.name,
        s.level,
        Array.isArray(s.availableShifts) ? s.availableShifts.join(',') : s.availableShifts,
        s.group,
        s.maxConsecutiveDays,
        s.isPackage,
        s.packageType,
        s.email,
        s.lineId,
        s.status
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '人員儲存成功');
  } catch (error) {
    throw new Error('儲存人員失敗: ' + error.message);
  }
}

/**
 * 批次匯入人員
 */
function importStaff(ss, staffList) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.STAFF);
    const lastRow = sheet.getLastRow();
    
    const rows = staffList.map(s => [
      s.employeeId,
      s.name,
      s.level,
      Array.isArray(s.availableShifts) ? s.availableShifts.join(',') : s.availableShifts,
      s.group,
      s.maxConsecutiveDays || 6,
      s.isPackage || false,
      s.packageType || '',
      s.email || '',
      s.lineId || '',
      s.status || '在職'
    ]);
    
    sheet.getRange(lastRow + 1, 1, rows.length, 11).setValues(rows);
    
    return createResponse(true, `成功匯入 ${staffList.length} 筆人員資料`);
  } catch (error) {
    throw new Error('匯入人員失敗: ' + error.message);
  }
}

/**
 * 儲存排班規則
 */
function saveRules(ss, rules) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.RULES);
    
    sheet.clear();
    
    const headers = ['規則類別', '規則項目', '數值', '說明'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    const rows = [];
    for (const category in rules) {
      for (const item in rules[category]) {
        rows.push([
          category,
          item,
          rules[category][item],
          ''
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '規則儲存成功');
  } catch (error) {
    throw new Error('儲存規則失敗: ' + error.message);
  }
}

/**
 * 儲存週間人數需求
 */
function saveWeeklyRequirements(ss, requirements) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.WEEKLY_REQ);
    
    sheet.clear();
    
    const headers = ['星期', '星期索引', '大夜', '小夜', '白班', 'DL'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (requirements && requirements.length > 0) {
      const rows = requirements.map(r => [
        r.weekday,
        r.weekdayIndex,
        r.nightMajor,
        r.nightMinor,
        r.day,
        r.dl
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '週間需求儲存成功');
  } catch (error) {
    throw new Error('儲存週間需求失敗: ' + error.message);
  }
}

/**
 * 儲存假日設定
 */
function saveHolidays(ss, holidays) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.HOLIDAYS);
    
    sheet.clear();
    
    const headers = ['日期', '假日名稱', '類型', '啟用', '適用年度'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (holidays && holidays.length > 0) {
      const rows = holidays.map(h => [
        h.date,
        h.name,
        h.type,
        h.enabled,
        h.year
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '假日設定儲存成功');
  } catch (error) {
    throw new Error('儲存假日設定失敗: ' + error.message);
  }
}

/**
 * 儲存通知設定
 */
function saveNotifications(ss, notifications) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.NOTIFICATIONS);
    
    sheet.clear();
    
    const headers = ['通知事件', '啟用', '通知對象', '通知方式', '提前天數'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (notifications && notifications.length > 0) {
      const rows = notifications.map(n => [
        n.event,
        n.enabled,
        n.target,
        Array.isArray(n.channels) ? n.channels.join(',') : n.channels,
        n.daysAhead
      ]);
      
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '通知設定儲存成功');
  } catch (error) {
    throw new Error('儲存通知設定失敗: ' + error.message);
  }
}

/**
 * 儲存勞基法規範
 */
function saveLaborLaw(ss, laborLaw) {
  try {
    const sheet = getOrCreateSheet(ss, SETTINGS_SHEET_NAME.LABOR_LAW);
    
    sheet.clear();
    
    const headers = ['規範類型', '規範項目', '限制值', '啟用', '說明'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    const rows = [];
    for (const type in laborLaw) {
      for (const item in laborLaw[type]) {
        const config = laborLaw[type][item];
        rows.push([
          type,
          item,
          config.value,
          config.enabled,
          config.description || ''
        ]);
      }
    }
    
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    return createResponse(true, '勞基法規範儲存成功');
  } catch (error) {
    throw new Error('儲存勞基法規範失敗: ' + error.message);
  }
}

// ==================== 工具函數 ====================

/**
 * 取得或建立工作表
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * 格式化班別工作表
 */
function formatShiftSheet(sheet) {
  // 設定標題列格式
  const headerRange = sheet.getRange(1, 1, 1, 8);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#667eea');
  headerRange.setFontColor('#ffffff');
  
  // 設定欄寬
  sheet.setColumnWidth(1, 80);  // ID
  sheet.setColumnWidth(2, 100); // 名稱
  sheet.setColumnWidth(3, 80);  // 代碼
  sheet.setColumnWidth(4, 100); // 起始時間
  sheet.setColumnWidth(5, 100); // 結束時間
  sheet.setColumnWidth(6, 100); // 顏色
  sheet.setColumnWidth(7, 80);  // 列入統計
  sheet.setColumnWidth(8, 60);  // 順序
}

/**
 * 建立成功回應
 */
function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 建立錯誤回應
 */
function createErrorResponse(error) {
  const response = {
    success: false,
    message: error.message || '發生未知錯誤',
    error: error.toString(),
    timestamp: new Date().toISOString()
  };
  
  Logger.log('API Error: ' + JSON.stringify(response));
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 測試函數 - 用於開發測試
 */
function testAPI() {
  // 測試用的 Spreadsheet ID
  const testSheetId = 'YOUR_TEST_SHEET_ID';
  const ss = SpreadsheetApp.openById(testSheetId);
  
  // 測試讀取所有設定
  const result = getAllSettings(ss);
  Logger.log(result.getContent());
}
