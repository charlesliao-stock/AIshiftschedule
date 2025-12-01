/**
 * Google Apps Script - API 端點
 * 部署為 Web App，提供 REST API 服務
 */

// ==================== Web App 進入點 ====================

/**
 * 處理 GET 請求
 */
function doGet(e) {
  try {
    const path = e.parameter.path || '/';
    const params = e.parameter;
    
    Logger.log('[API] GET 請求: ' + path);
    
    // 路由處理
    return handleRequest('GET', path, params);
    
  } catch (error) {
    Logger.log('[API] 錯誤: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    const path = e.parameter.path || '/';
    let data = {};
    
    // 解析 JSON 資料
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseError) {
        Logger.log('[API] JSON 解析失敗: ' + parseError.toString());
      }
    }
    
    Logger.log('[API] POST 請求: ' + path);
    Logger.log('[API] 資料: ' + JSON.stringify(data));
    
    // 路由處理
    return handleRequest('POST', path, data);
    
  } catch (error) {
    Logger.log('[API] 錯誤: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

// ==================== 路由處理 ====================

/**
 * 處理請求路由
 */
function handleRequest(method, path, data) {
  // 單位管理 API
  if (path.includes('/api/unit/create')) {
    return createUnit(data);
  }
  
  if (path.includes('/api/unit/list')) {
    return listUnits(data);
  }
  
  if (path.includes('/api/unit/update')) {
    return updateUnit(data);
  }
  
  if (path.includes('/api/unit/delete')) {
    return deleteUnit(data);
  }
  
  if (path.includes('/api/unit/initialize-sheets')) {
    return initializeUnitSheets(data);
  }
  
  // 設定管理 API
  if (path.includes('/api/settings/')) {
    return handleSettingsRequest(path, data);
  }
  
  // 預班表 API
  if (path.includes('/api/pre-schedule/')) {
    return handlePreScheduleRequest(path, data);
  }
  
  // 排班表 API
  if (path.includes('/api/schedule/')) {
    return handleScheduleRequest(path, data);
  }
  
  // 預設回應
  return createResponse({
    success: false,
    error: '找不到 API 端點: ' + path
  });
}

// ==================== 單位管理 ====================

/**
 * 創建單位
 */
function createUnit(data) {
  try {
    Logger.log('[Unit] 創建單位: ' + data.unit_code);
    
    // 驗證必填欄位
    if (!data.unit_code || !data.unit_name) {
      throw new Error('缺少必填欄位');
    }
    
    // 產生單位 ID
    const unitId = 'unit_' + data.unit_code.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // 建立 3 個 Google Sheets 檔案
    const sheets = createUnitSheets(unitId, data.unit_code, data.unit_name);
    
    // 儲存單位資料到 Firestore (這裡簡化為回傳資料)
    const unitData = {
      unit_id: unitId,
      unit_code: data.unit_code,
      unit_name: data.unit_name,
      settings_sheet_id: sheets.settings.id,
      settings_sheet_url: sheets.settings.url,
      pre_schedule_sheet_id: sheets.preSchedule.id,
      pre_schedule_sheet_url: sheets.preSchedule.url,
      schedule_sheet_id: sheets.schedule.id,
      schedule_sheet_url: sheets.schedule.url,
      admin_users: data.admin_email ? [data.admin_email] : [],
      scheduler_users: [],
      total_staff: 0,
      status: 'active',
      created_at: new Date().toISOString()
    };
    
    Logger.log('[Unit] 單位創建成功: ' + unitId);
    
    return createResponse({
      success: true,
      message: '單位創建成功',
      data: unitData
    });
    
  } catch (error) {
    Logger.log('[Unit] 創建失敗: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * 列出所有單位
 */
function listUnits(data) {
  try {
    Logger.log('[Unit] 列出所有單位');
    
    // 這裡應該從 Firestore 或其他資料庫讀取
    // Demo 模式回傳模擬資料
    const units = [
      {
        unit_id: 'unit_9b',
        unit_code: '9B',
        unit_name: '9B病房',
        total_staff: 20,
        admin_users: ['admin@hospital.com'],
        scheduler_users: ['scheduler@hospital.com'],
        settings_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_9b_settings',
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z'
      }
    ];
    
    return createResponse({
      success: true,
      data: units
    });
    
  } catch (error) {
    Logger.log('[Unit] 列出失敗: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * 更新單位
 */
function updateUnit(data) {
  try {
    Logger.log('[Unit] 更新單位: ' + data.unit_id);
    
    if (!data.unit_id) {
      throw new Error('缺少 unit_id');
    }
    
    // 更新 Firestore
    // 這裡簡化處理
    
    return createResponse({
      success: true,
      message: '單位更新成功',
      data: {
        ...data,
        updated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    Logger.log('[Unit] 更新失敗: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * 刪除單位
 */
function deleteUnit(data) {
  try {
    Logger.log('[Unit] 刪除單位: ' + data.unit_id);
    
    if (!data.unit_id) {
      throw new Error('缺少 unit_id');
    }
    
    // 刪除 Firestore 記錄
    // 注意: Google Sheets 檔案需要手動刪除或移到垃圾桶
    
    return createResponse({
      success: true,
      message: '單位刪除成功'
    });
    
  } catch (error) {
    Logger.log('[Unit] 刪除失敗: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString()
    });
  }
}

// ==================== Google Sheets 建立 ====================

/**
 * 建立單位的 3 個 Sheets 檔案
 */
function createUnitSheets(unitId, unitCode, unitName) {
  Logger.log('[Sheets] 建立 Sheets: ' + unitCode);
  
  // 1. 建立設定檔
  const settingsSheet = createSettingsSheet(unitCode, unitName);
  
  // 2. 建立預班表
  const preScheduleSheet = createPreScheduleSheet(unitCode, unitName);
  
  // 3. 建立排班表
  const scheduleSheet = createScheduleSheet(unitCode, unitName);
  
  Logger.log('[Sheets] 所有 Sheets 建立完成');
  
  return {
    settings: settingsSheet,
    preSchedule: preScheduleSheet,
    schedule: scheduleSheet
  };
}

/**
 * 建立設定檔 Sheet
 */
function createSettingsSheet(unitCode, unitName) {
  const fileName = unitCode + '_設定檔';
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  
  // 建立工作表: 班別定義
  sheet.setName('班別定義');
  sheet.getRange('A1:H1').setValues([[
    '班別ID', '班別名稱', '班別代碼', '起始時間', '結束時間', '顏色代碼', '列入統計', '順序'
  ]]);
  sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#667eea').setFontColor('#ffffff');
  
  // 填入預設班別
  const defaultShifts = [
    [1, '大夜', '大', '22:00', '08:00', '#E9D5FF', 'TRUE', 2],
    [2, '小夜', '小', '14:00', '22:00', '#C7D2FE', 'TRUE', 4],
    [3, '白班', '白', '08:00', '16:00', '#FEF3C7', 'TRUE', 3],
    [4, 'DL', 'DL', '14:00', '22:00', '#FED7AA', 'TRUE', 4],
    [5, '休假', 'FF', '', '', '#BBF7D0', 'FALSE', 1]
  ];
  sheet.getRange(2, 1, defaultShifts.length, 8).setValues(defaultShifts);
  
  // 建立其他工作表
  ss.insertSheet('組別定義');
  ss.insertSheet('人員資料');
  ss.insertSheet('排班規則');
  ss.insertSheet('週間人數需求');
  ss.insertSheet('假日設定');
  ss.insertSheet('通知設定');
  ss.insertSheet('勞基法規範');
  
  // 設定權限 (可編輯)
  // ss.addEditors(['user@example.com']);
  
  return {
    id: ss.getId(),
    url: ss.getUrl()
  };
}

/**
 * 建立預班表 Sheet
 */
function createPreScheduleSheet(unitCode, unitName) {
  const fileName = unitCode + '_預班表';
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  
  // 建立當月工作表
  const today = new Date();
  const monthName = Utilities.formatDate(today, 'GMT+8', 'yyyyMM');
  sheet.setName(monthName);
  
  // 設定標題
  sheet.getRange('A1').setValue('預班表 - ' + unitName);
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  
  return {
    id: ss.getId(),
    url: ss.getUrl()
  };
}

/**
 * 建立排班表 Sheet
 */
function createScheduleSheet(unitCode, unitName) {
  const fileName = unitCode + '_排班表';
  const ss = SpreadsheetApp.create(fileName);
  const sheet = ss.getActiveSheet();
  
  // 建立當月工作表
  const today = new Date();
  const monthName = Utilities.formatDate(today, 'GMT+8', 'yyyyMM');
  sheet.setName(monthName);
  
  // 建立異動記錄工作表
  ss.insertSheet('異動記錄');
  
  // 設定標題
  sheet.getRange('A1').setValue('排班表 - ' + unitName);
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  
  return {
    id: ss.getId(),
    url: ss.getUrl()
  };
}

// ==================== 工具函式 ====================

/**
 * 建立回應
 */
function createResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 處理設定請求
 */
function handleSettingsRequest(path, data) {
  // 設定相關 API 處理
  return createResponse({
    success: true,
    message: '設定功能開發中 (Week 3)',
    data: null
  });
}

/**
 * 處理預班請求
 */
function handlePreScheduleRequest(path, data) {
  // 預班相關 API 處理
  return createResponse({
    success: true,
    message: '預班功能開發中 (Week 5)',
    data: null
  });
}

/**
 * 處理排班請求
 */
function handleScheduleRequest(path, data) {
  // 排班相關 API 處理
  return createResponse({
    success: true,
    message: '排班功能開發中 (Week 4)',
    data: null
  });
}