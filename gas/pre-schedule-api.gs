/**
 * Google Apps Script - 預班表 API
 * 處理預班資料的讀取、儲存與狀態管理
 */

// ==================== 工作表名稱常數 ====================

const PRE_SCHEDULE_SHEET_NAME = '預班表';
const PRE_SCHEDULE_STATUS_SHEET_NAME = '預班狀態';
const PRE_SCHEDULE_LOG_SHEET_NAME = '預班記錄';

// ==================== 主要 API 端點 ====================

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    // 根據 action 分發請求
    switch (action) {
      case 'get':
        return getPreSchedule(params);
      
      case 'save':
        return savePreSchedule(params);
      
      case 'batch-save':
        return batchSavePreSchedule(params);
      
      case 'get-status':
        return getPreScheduleStatus(params);
      
      case 'set-status':
        return setPreScheduleStatus(params);
      
      case 'get-stats':
        return getPreScheduleStats(params);
      
      case 'check-conflicts':
        return checkPreScheduleConflicts(params);
      
      default:
        return createResponse(false, '未知的操作: ' + action);
    }
    
  } catch (error) {
    Logger.log('doPost 錯誤: ' + error.toString());
    return createResponse(false, '請求處理失敗: ' + error.toString());
  }
}

/**
 * 處理 GET 請求
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    switch (action) {
      case 'get':
        return getPreSchedule(e.parameter);
      
      case 'get-status':
        return getPreScheduleStatus(e.parameter);
      
      case 'get-stats':
        return getPreScheduleStats(e.parameter);
      
      default:
        return createResponse(false, '未知的操作: ' + action);
    }
  } catch (error) {
    Logger.log('doGet 錯誤: ' + error.toString());
    return createResponse(false, '請求處理失敗: ' + error.toString());
  }
}

// ==================== 預班資料操作 ====================

/**
 * 取得預班表資料
 * @param {Object} params - {unit_id, month}
 */
function getPreSchedule(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    
    const ss = getUnitSpreadsheet(unitId, '預班表');
    const sheet = ss.getSheetByName(month) || createMonthSheet(ss, month);
    
    // 讀取預班資料
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      // 只有標題列，返回空資料
      return createResponse(true, '預班表為空', {
        month: month,
        status: 'open',
        staff_schedules: {}
      });
    }
    
    // 解析資料
    const headers = data[0];
    const staffSchedules = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const staffId = row[0];
      const staffName = row[1];
      
      if (!staffId) continue;
      
      staffSchedules[staffId] = {};
      
      // 從第3欄開始是日期資料 (0:員工ID, 1:姓名, 2+:日期)
      for (let j = 2; j < headers.length; j++) {
        const date = headers[j];
        const cellValue = row[j];
        
        if (cellValue && cellValue !== '') {
          // 檢查是否為額外預班 (有 ⭐ 標記)
          const isExtra = cellValue.includes('⭐');
          const shift = cellValue.replace('⭐', '').trim();
          
          staffSchedules[staffId][date] = {
            shift: shift,
            is_extra: isExtra
          };
        }
      }
    }
    
    return createResponse(true, '讀取成功', {
      month: month,
      staff_schedules: staffSchedules
    });
    
  } catch (error) {
    Logger.log('getPreSchedule 錯誤: ' + error.toString());
    return createResponse(false, '讀取預班失敗: ' + error.toString());
  }
}

/**
 * 儲存預班
 * @param {Object} params - {unit_id, month, staff_id, schedule, is_extra}
 */
function savePreSchedule(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    const staffId = params.staff_id;
    const schedule = params.schedule;
    const isExtra = params.is_extra || false;
    
    const ss = getUnitSpreadsheet(unitId, '預班表');
    const sheet = ss.getSheetByName(month) || createMonthSheet(ss, month);
    
    // 找到員工所在行
    const data = sheet.getDataRange().getValues();
    let staffRow = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === staffId) {
        staffRow = i + 1; // 轉換為 1-based
        break;
      }
    }
    
    // 如果找不到員工，新增一行
    if (staffRow === -1) {
      staffRow = data.length + 1;
      sheet.getRange(staffRow, 1).setValue(staffId);
      // 從設定檔取得員工姓名
      const staffName = getStaffName(unitId, staffId);
      sheet.getRange(staffRow, 2).setValue(staffName);
    }
    
    // 取得日期標題
    const headers = data[0];
    
    // 更新預班資料
    for (let date in schedule) {
      const scheduleData = schedule[date];
      
      // 找到日期所在列
      let dateCol = -1;
      for (let j = 2; j < headers.length; j++) {
        if (headers[j] === date) {
          dateCol = j + 1;
          break;
        }
      }
      
      // 如果找不到日期列，新增
      if (dateCol === -1) {
        dateCol = headers.length + 1;
        sheet.getRange(1, dateCol).setValue(date);
      }
      
      // 寫入班別 (如果是額外預班，加上 ⭐)
      const cellValue = scheduleData.is_extra 
        ? scheduleData.shift + '⭐' 
        : scheduleData.shift;
      
      sheet.getRange(staffRow, dateCol).setValue(cellValue);
      
      // 設定背景顏色
      const color = getShiftColor(scheduleData.shift);
      if (color) {
        sheet.getRange(staffRow, dateCol).setBackground(color);
      }
    }
    
    // 記錄操作
    logPreScheduleAction(unitId, 'save', staffId, month, params.timestamp);
    
    return createResponse(true, '儲存成功');
    
  } catch (error) {
    Logger.log('savePreSchedule 錯誤: ' + error.toString());
    return createResponse(false, '儲存預班失敗: ' + error.toString());
  }
}

/**
 * 批次儲存預班
 * @param {Object} params - {unit_id, month, schedules}
 */
function batchSavePreSchedule(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    const schedules = params.schedules;
    
    let successCount = 0;
    let failCount = 0;
    
    schedules.forEach(schedule => {
      try {
        savePreSchedule({
          unit_id: unitId,
          month: month,
          staff_id: schedule.staffId,
          schedule: schedule.data,
          is_extra: schedule.isExtra || false,
          timestamp: params.timestamp
        });
        successCount++;
      } catch (error) {
        Logger.log('批次儲存失敗: ' + schedule.staffId + ', ' + error.toString());
        failCount++;
      }
    });
    
    return createResponse(true, `批次儲存完成: 成功 ${successCount}, 失敗 ${failCount}`, {
      success: successCount,
      fail: failCount
    });
    
  } catch (error) {
    Logger.log('batchSavePreSchedule 錯誤: ' + error.toString());
    return createResponse(false, '批次儲存失敗: ' + error.toString());
  }
}

// ==================== 預班狀態管理 ====================

/**
 * 取得預班狀態
 * @param {Object} params - {unit_id, month}
 */
function getPreScheduleStatus(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    
    const ss = getUnitSpreadsheet(unitId, '預班表');
    const statusSheet = ss.getSheetByName(PRE_SCHEDULE_STATUS_SHEET_NAME) 
      || createStatusSheet(ss);
    
    const data = statusSheet.getDataRange().getValues();
    
    // 尋找該月份的狀態
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === month) {
        return createResponse(true, '讀取成功', {
          status: data[i][1] || 'open',
          open_date: data[i][2] || null,
          close_date: data[i][3] || null,
          is_editable: data[i][1] !== 'closed'
        });
      }
    }
    
    // 如果找不到，返回預設狀態
    return createResponse(true, '讀取成功', {
      status: 'open',
      open_date: null,
      close_date: null,
      is_editable: true
    });
    
  } catch (error) {
    Logger.log('getPreScheduleStatus 錯誤: ' + error.toString());
    return createResponse(false, '讀取狀態失敗: ' + error.toString());
  }
}

/**
 * 設定預班狀態
 * @param {Object} params - {unit_id, month, status, open_date, close_date}
 */
function setPreScheduleStatus(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    const status = params.status;
    const openDate = params.open_date;
    const closeDate = params.close_date;
    
    const ss = getUnitSpreadsheet(unitId, '預班表');
    const statusSheet = ss.getSheetByName(PRE_SCHEDULE_STATUS_SHEET_NAME) 
      || createStatusSheet(ss);
    
    const data = statusSheet.getDataRange().getValues();
    let targetRow = -1;
    
    // 尋找該月份的狀態行
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === month) {
        targetRow = i + 1;
        break;
      }
    }
    
    // 如果找不到，新增一行
    if (targetRow === -1) {
      targetRow = data.length + 1;
      statusSheet.getRange(targetRow, 1).setValue(month);
    }
    
    // 更新狀態
    statusSheet.getRange(targetRow, 2).setValue(status);
    statusSheet.getRange(targetRow, 3).setValue(openDate);
    statusSheet.getRange(targetRow, 4).setValue(closeDate);
    statusSheet.getRange(targetRow, 5).setValue(new Date());
    
    // 記錄操作
    logPreScheduleAction(unitId, 'set-status', null, month, params.timestamp);
    
    return createResponse(true, '狀態設定成功');
    
  } catch (error) {
    Logger.log('setPreScheduleStatus 錯誤: ' + error.toString());
    return createResponse(false, '設定狀態失敗: ' + error.toString());
  }
}

// ==================== 統計功能 ====================

/**
 * 取得預班統計
 * @param {Object} params - {unit_id, month, staff_id}
 */
function getPreScheduleStats(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    const staffId = params.staff_id;
    
    const preScheduleData = getPreSchedule(params);
    if (!preScheduleData.success) {
      return preScheduleData;
    }
    
    const staffSchedules = preScheduleData.data.staff_schedules;
    
    if (staffId) {
      // 計算單一員工的統計
      const schedule = staffSchedules[staffId] || {};
      const stats = calculateStaffStats(schedule);
      
      return createResponse(true, '統計完成', stats);
    } else {
      // 計算全體員工的統計
      const allStats = {};
      let totalDays = 0;
      let totalOff = 0;
      
      for (let sid in staffSchedules) {
        const stats = calculateStaffStats(staffSchedules[sid]);
        allStats[sid] = stats;
        totalDays += stats.total_days;
        totalOff += stats.off_count;
      }
      
      return createResponse(true, '統計完成', {
        staff_stats: allStats,
        total_days: totalDays,
        total_off: totalOff,
        average_days: totalDays / Object.keys(staffSchedules).length
      });
    }
    
  } catch (error) {
    Logger.log('getPreScheduleStats 錯誤: ' + error.toString());
    return createResponse(false, '統計失敗: ' + error.toString());
  }
}

/**
 * 計算員工統計
 * @param {Object} schedule - 員工預班資料
 */
function calculateStaffStats(schedule) {
  let totalDays = 0;
  let offCount = 0;
  const shiftCounts = {};
  
  for (let date in schedule) {
    const data = schedule[date];
    totalDays++;
    
    if (data.shift === 'FF' || data.shift === 'OFF') {
      offCount++;
    }
    
    shiftCounts[data.shift] = (shiftCounts[data.shift] || 0) + 1;
  }
  
  return {
    total_days: totalDays,
    off_count: offCount,
    shift_counts: shiftCounts,
    completion_rate: Math.round((totalDays / 30) * 100) // 假設30天
  };
}

/**
 * 檢查預班衝突
 * @param {Object} params - {unit_id, month}
 */
function checkPreScheduleConflicts(params) {
  try {
    const unitId = params.unit_id;
    const month = params.month;
    
    const preScheduleData = getPreSchedule(params);
    if (!preScheduleData.success) {
      return preScheduleData;
    }
    
    const staffSchedules = preScheduleData.data.staff_schedules;
    const conflicts = [];
    
    // 計算每日預班人數
    const dailyCounts = {};
    
    for (let staffId in staffSchedules) {
      const schedule = staffSchedules[staffId];
      
      for (let date in schedule) {
        if (!dailyCounts[date]) {
          dailyCounts[date] = { off: 0, total: 0 };
        }
        
        dailyCounts[date].total++;
        
        if (schedule[date].shift === 'FF' || schedule[date].shift === 'OFF') {
          dailyCounts[date].off++;
        }
      }
    }
    
    // 檢查衝突 (假設休假人數超過總人數的50%為衝突)
    for (let date in dailyCounts) {
      const counts = dailyCounts[date];
      const offRate = counts.off / counts.total;
      
      if (offRate > 0.5) {
        conflicts.push({
          date: date,
          type: 'too_many_off',
          description: `${date} 休假人數過多 (${counts.off}/${counts.total})`
        });
      }
    }
    
    return createResponse(true, '檢查完成', conflicts);
    
  } catch (error) {
    Logger.log('checkPreScheduleConflicts 錯誤: ' + error.toString());
    return createResponse(false, '衝突檢查失敗: ' + error.toString());
  }
}

// ==================== 輔助函式 ====================

/**
 * 取得單位的 Spreadsheet
 */
function getUnitSpreadsheet(unitId, type) {
  // 這裡應該從設定檔讀取 Spreadsheet ID
  // 暫時使用固定 ID (需要根據實際情況修改)
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty('UNIT_' + unitId + '_' + type.toUpperCase().replace(' ', '_'));
  
  if (!spreadsheetId) {
    throw new Error('找不到單位的 Spreadsheet');
  }
  
  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * 建立月份工作表
 */
function createMonthSheet(ss, month) {
  const sheet = ss.insertSheet(month);
  
  // 設定標題列
  const headers = ['員工ID', '姓名'];
  
  // 產生日期列 (1-31)
  for (let i = 1; i <= 31; i++) {
    headers.push(month + '-' + String(i).padStart(2, '0'));
  }
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  return sheet;
}

/**
 * 建立狀態工作表
 */
function createStatusSheet(ss) {
  const sheet = ss.insertSheet(PRE_SCHEDULE_STATUS_SHEET_NAME);
  
  const headers = ['月份', '狀態', '開放日期', '截止日期', '更新時間'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  return sheet;
}

/**
 * 取得員工姓名
 */
function getStaffName(unitId, staffId) {
  // 從設定檔工作表讀取員工姓名
  // 暫時返回員工ID
  return staffId;
}

/**
 * 取得班別顏色
 */
function getShiftColor(shiftCode) {
  const colors = {
    '大': '#E9D5FF',
    '小': '#C7D2FE',
    '白': '#FEF3C7',
    'DL': '#FED7AA',
    'FF': '#BBF7D0',
    'OFF': '#BBF7D0'
  };
  
  return colors[shiftCode] || null;
}

/**
 * 記錄預班操作
 */
function logPreScheduleAction(unitId, action, staffId, month, timestamp) {
  try {
    const ss = getUnitSpreadsheet(unitId, '預班表');
    const logSheet = ss.getSheetByName(PRE_SCHEDULE_LOG_SHEET_NAME) 
      || createLogSheet(ss);
    
    const lastRow = logSheet.getLastRow();
    logSheet.getRange(lastRow + 1, 1, 1, 5).setValues([[
      new Date(),
      action,
      staffId || '',
      month,
      timestamp || new Date().toISOString()
    ]]);
    
  } catch (error) {
    Logger.log('記錄操作失敗: ' + error.toString());
  }
}

/**
 * 建立記錄工作表
 */
function createLogSheet(ss) {
  const sheet = ss.insertSheet(PRE_SCHEDULE_LOG_SHEET_NAME);
  
  const headers = ['時間', '操作', '員工ID', '月份', '備註'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  return sheet;
}

/**
 * 建立回應
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message,
    data: data || null,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}