/**
 * Google Apps Script - 排班表 API
 * 處理排班表的讀寫操作
 */

/**
 * 主要 API 端點
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;

    switch (action) {
      case 'getSchedule':
        return getSchedule(params);
      case 'getStaffSchedule':
        return getStaffSchedule(params);
      case 'saveSchedule':
        return saveSchedule(params);
      case 'updateCell':
        return updateCell(params);
      case 'getScheduleStatistics':
        return getScheduleStatistics(params);
      case 'publishSchedule':
        return publishSchedule(params);
      case 'getChangeHistory':
        return getChangeHistory(params);
      case 'logChange':
        return logChange(params);
      case 'clearSchedule':
        return clearSchedule(params);
      case 'copySchedule':
        return copySchedule(params);
      case 'exportSchedule':
        return exportSchedule(params);
      case 'checkConflicts':
        return checkConflicts(params);
      default:
        return createErrorResponse('未知的操作: ' + action);
    }
  } catch (error) {
    Logger.log('API 錯誤: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 取得整月排班表
 */
function getSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      // 如果工作表不存在，建立新的
      const newSheet = createScheduleSheet(ss, month);
      return createSuccessResponse({});
    }

    // 讀取排班資料
    const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn());
    const data = dataRange.getValues();

    const scheduleData = {};
    const year = month.substring(0, 4);
    const monthNum = month.substring(4, 6);
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    // 前6欄是前月，從第7欄開始是當月
    data.forEach(row => {
      const staffId = row[0];
      if (!staffId) return;

      scheduleData[staffId] = {};

      // 讀取當月資料（跳過前6欄）
      for (let day = 1; day <= daysInMonth; day++) {
        const colIndex = 9 + day - 1; // 9 = 3(員工資料) + 6(前月)
        const shift = row[colIndex];
        const dateStr = month + day.toString().padStart(2, '0');
        
        if (shift) {
          scheduleData[staffId][dateStr] = shift;
        }
      }
    });

    return createSuccessResponse(scheduleData);

  } catch (error) {
    Logger.log('取得排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 取得員工排班
 */
function getStaffSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const staffId = params.staffId;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      return createSuccessResponse({ dates: [] });
    }

    // 找到員工的列
    const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn());
    const data = dataRange.getValues();

    let staffRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == staffId) {
        staffRow = i;
        break;
      }
    }

    if (staffRow === -1) {
      return createSuccessResponse({ dates: [] });
    }

    // 讀取排班資料
    const dates = [];
    const year = month.substring(0, 4);
    const monthNum = month.substring(4, 6);
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const colIndex = 9 + day - 1;
      const shift = data[staffRow][colIndex];
      
      if (shift && shift !== '') {
        const dateStr = month + day.toString().padStart(2, '0');
        dates.push({
          date: dateStr,
          shift: shift
        });
      }
    }

    return createSuccessResponse({
      staffId: staffId,
      staffName: data[staffRow][1],
      dates: dates
    });

  } catch (error) {
    Logger.log('取得員工排班錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 儲存整月排班表
 */
function saveSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const scheduleData = params.scheduleData;

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(month);

    if (!sheet) {
      sheet = createScheduleSheet(ss, month);
    }

    const year = month.substring(0, 4);
    const monthNum = month.substring(4, 6);
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    // 更新排班資料
    Object.keys(scheduleData).forEach(staffId => {
      const staffSchedule = scheduleData[staffId];
      
      // 找到員工的列
      const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1);
      const staffIds = dataRange.getValues();
      
      let staffRow = -1;
      for (let i = 0; i < staffIds.length; i++) {
        if (staffIds[i][0] == staffId) {
          staffRow = i + 3;
          break;
        }
      }

      if (staffRow === -1) return;

      // 寫入班別
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = month + day.toString().padStart(2, '0');
        const shift = staffSchedule[dateStr] || '';
        const colIndex = 10 + day; // 10 = 3(員工資料) + 6(前月) + 1(1-indexed)
        
        const cell = sheet.getRange(staffRow, colIndex);
        cell.setValue(shift);
        
        // 設定背景顏色
        if (shift && shift !== 'FF') {
          cell.setBackground('#E3F2FD'); // 淺藍色
        } else if (shift === 'FF') {
          cell.setBackground('#C8E6C9'); // 淺綠色
        }
      }

      // 更新統計
      updateScheduleStats(sheet, staffRow);
    });

    return createSuccessResponse({ message: '排班表已儲存' });

  } catch (error) {
    Logger.log('儲存排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 更新單一儲存格
 */
function updateCell(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const staffId = params.staffId;
    const date = params.date;
    const shift = params.shift;
    const updatedBy = params.updatedBy;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      return createErrorResponse('找不到排班表工作表');
    }

    // 找到員工的列
    const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, 1);
    const staffIds = dataRange.getValues();
    
    let staffRow = -1;
    for (let i = 0; i < staffIds.length; i++) {
      if (staffIds[i][0] == staffId) {
        staffRow = i + 3;
        break;
      }
    }

    if (staffRow === -1) {
      return createErrorResponse('找不到員工資料');
    }

    // 計算日期欄位
    const day = parseInt(date.substring(6, 8));
    const colIndex = 10 + day;

    // 取得舊值
    const cell = sheet.getRange(staffRow, colIndex);
    const oldShift = cell.getValue();

    // 更新班別
    cell.setValue(shift);

    // 設定背景顏色
    if (shift && shift !== 'FF') {
      cell.setBackground('#E3F2FD');
    } else if (shift === 'FF') {
      cell.setBackground('#C8E6C9');
    } else {
      cell.setBackground(null);
    }

    // 更新統計
    updateScheduleStats(sheet, staffRow);

    // 記錄異動
    logChangeToHistory(ss, month, {
      staffId: staffId,
      staffName: sheet.getRange(staffRow, 2).getValue(),
      date: date,
      oldShift: oldShift,
      newShift: shift,
      changedBy: updatedBy,
      changeType: '手動調整'
    });

    return createSuccessResponse({ message: '更新成功' });

  } catch (error) {
    Logger.log('更新儲存格錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 取得排班統計
 */
function getScheduleStatistics(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const staffId = params.staffId;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      return createSuccessResponse({});
    }

    const year = month.substring(0, 4);
    const monthNum = month.substring(4, 6);
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    if (staffId) {
      // 單一員工統計
      const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn());
      const data = dataRange.getValues();

      let staffRow = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] == staffId) {
          staffRow = i;
          break;
        }
      }

      if (staffRow === -1) {
        return createSuccessResponse({});
      }

      // 讀取統計欄位
      const statsStartCol = 10 + daysInMonth;
      const stats = {
        offDays: data[staffRow][statsStartCol] || 0,
        holidayWork: data[staffRow][statsStartCol + 1] || 0,
        nightMajor: data[staffRow][statsStartCol + 2] || 0,
        nightMinor: data[staffRow][statsStartCol + 3] || 0,
        dayShift: data[staffRow][statsStartCol + 4] || 0,
        dlShift: data[staffRow][statsStartCol + 5] || 0,
        consecutive: data[staffRow][statsStartCol + 6] || 0,
        swapCount: data[staffRow][statsStartCol + 7] || 0
      };

      return createSuccessResponse(stats);

    } else {
      // 全單位統計
      const dataRange = sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn());
      const data = dataRange.getValues();

      const totalStaff = data.filter(row => row[0]).length;
      let totalWorkDays = 0;
      let totalOffDays = 0;

      data.forEach(row => {
        if (!row[0]) return;
        
        const statsStartCol = 10 + daysInMonth;
        totalOffDays += row[statsStartCol] || 0;
        
        for (let day = 1; day <= daysInMonth; day++) {
          const colIndex = 9 + day;
          const shift = row[colIndex];
          if (shift && shift !== 'FF') {
            totalWorkDays++;
          }
        }
      });

      return createSuccessResponse({
        totalStaff: totalStaff,
        totalWorkDays: totalWorkDays,
        totalOffDays: totalOffDays,
        averageWorkDays: totalStaff > 0 ? Math.round(totalWorkDays / totalStaff) : 0
      });
    }

  } catch (error) {
    Logger.log('取得統計錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 公告排班表
 */
function publishSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const publishedBy = params.publishedBy;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      return createErrorResponse('找不到排班表');
    }

    // 標記為已公告
    sheet.getRange('A1').setValue('已公告');
    sheet.getRange('B1').setValue(new Date());
    sheet.getRange('C1').setValue(publishedBy);

    // 記錄異動
    logChangeToHistory(ss, month, {
      staffId: 'ALL',
      staffName: '全體',
      date: month,
      changeType: '公告排班',
      changedBy: publishedBy
    });

    // TODO: 發送通知給所有員工

    return createSuccessResponse({ message: '排班表已公告' });

  } catch (error) {
    Logger.log('公告排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 取得異動記錄
 */
function getChangeHistory(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const staffId = params.staffId;

    const ss = SpreadsheetApp.openById(sheetId);
    const historySheet = ss.getSheetByName('異動記錄');

    if (!historySheet) {
      return createSuccessResponse([]);
    }

    const dataRange = historySheet.getRange(2, 1, historySheet.getLastRow() - 1, 9);
    const data = dataRange.getValues();

    let history = data
      .filter(row => row[0]) // 過濾空列
      .map(row => ({
        timestamp: row[0],
        changedBy: row[1],
        changeType: row[2],
        staffId: row[3],
        staffName: row[4],
        date: row[5],
        oldShift: row[6],
        newShift: row[7],
        reason: row[8]
      }));

    // 過濾月份
    if (month) {
      history = history.filter(h => h.date && h.date.toString().startsWith(month));
    }

    // 過濾員工
    if (staffId) {
      history = history.filter(h => h.staffId == staffId);
    }

    return createSuccessResponse(history);

  } catch (error) {
    Logger.log('取得異動記錄錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 記錄異動
 */
function logChange(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const changeData = params.changeData;

    const ss = SpreadsheetApp.openById(sheetId);
    
    logChangeToHistory(ss, month, changeData);

    return createSuccessResponse({ message: '異動已記錄' });

  } catch (error) {
    Logger.log('記錄異動錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 清空排班表
 */
function clearSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;

    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName(month);

    if (!sheet) {
      return createErrorResponse('找不到排班表');
    }

    const year = month.substring(0, 4);
    const monthNum = month.substring(4, 6);
    const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    // 清空當月排班資料（保留員工資料和前月資料）
    const startCol = 10; // 從當月第1天開始
    const clearRange = sheet.getRange(3, startCol, sheet.getLastRow() - 2, daysInMonth);
    clearRange.clearContent();
    clearRange.setBackground(null);

    return createSuccessResponse({ message: '排班表已清空' });

  } catch (error) {
    Logger.log('清空排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 複製排班表
 */
function copySchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const sourceMonth = params.sourceMonth;
    const targetMonth = params.targetMonth;

    const ss = SpreadsheetApp.openById(sheetId);
    const sourceSheet = ss.getSheetByName(sourceMonth);

    if (!sourceSheet) {
      return createErrorResponse('找不到來源排班表');
    }

    let targetSheet = ss.getSheetByName(targetMonth);
    if (!targetSheet) {
      targetSheet = createScheduleSheet(ss, targetMonth);
    }

    // 複製資料
    const sourceData = sourceSheet.getRange(3, 10, sourceSheet.getLastRow() - 2, sourceSheet.getLastColumn() - 9).getValues();
    targetSheet.getRange(3, 10, sourceData.length, sourceData[0].length).setValues(sourceData);

    return createSuccessResponse({ message: '排班表已複製' });

  } catch (error) {
    Logger.log('複製排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 匯出排班表
 */
function exportSchedule(params) {
  try {
    const sheetId = params.scheduleSheetId;
    const month = params.month;
    const format = params.format || 'excel';

    // TODO: 實作匯出功能
    // 可以使用 DriveApp 來生成檔案

    return createSuccessResponse({
      message: '匯出功能開發中',
      downloadUrl: ''
    });

  } catch (error) {
    Logger.log('匯出排班表錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 檢查排班衝突
 */
function checkConflicts(params) {
  try {
    // TODO: 實作衝突檢查
    return createSuccessResponse({
      hasConflicts: false,
      conflicts: []
    });

  } catch (error) {
    Logger.log('檢查衝突錯誤: ' + error);
    return createErrorResponse(error.toString());
  }
}

/**
 * 建立排班表工作表
 */
function createScheduleSheet(ss, month) {
  const sheet = ss.insertSheet(month);
  
  const year = month.substring(0, 4);
  const monthNum = month.substring(4, 6);
  const daysInMonth = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  
  const headers = ['員工編號', '姓名', '組別'];
  
  // 前月後6天
  for (let i = -5; i <= 0; i++) {
    headers.push(`前${Math.abs(i)}`);
  }
  
  // 當月日期
  for (let day = 1; day <= daysInMonth; day++) {
    headers.push(day.toString());
  }
  
  // 統計欄位
  headers.push('OFF', '假日', '大', '小', '白', 'DL', '連續', '換班');
  
  sheet.getRange(3, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(3, 4, 1, 6).setBackground('#E0E0E0');
  
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(3);
  
  return sheet;
}

/**
 * 更新排班統計
 */
function updateScheduleStats(sheet, staffRow) {
  // TODO: 實作統計更新
}

/**
 * 記錄到異動記錄表
 */
function logChangeToHistory(ss, month, changeData) {
  let historySheet = ss.getSheetByName('異動記錄');
  
  if (!historySheet) {
    historySheet = ss.insertSheet('異動記錄');
    const headers = ['異動時間', '異動人員', '異動類型', '員工編號', '員工姓名', '日期', '原班別', '新班別', '原因'];
    historySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    historySheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  const newRow = [
    new Date(),
    changeData.changedBy || '',
    changeData.changeType || '',
    changeData.staffId || '',
    changeData.staffName || '',
    changeData.date || '',
    changeData.oldShift || '',
    changeData.newShift || '',
    changeData.reason || ''
  ];
  
  historySheet.appendRow(newRow);
}

/**
 * 建立成功回應
 */
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 建立錯誤回應
 */
function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: message
  })).setMimeType(ContentService.MimeType.JSON);
}