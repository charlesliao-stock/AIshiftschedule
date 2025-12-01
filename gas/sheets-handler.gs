/**
 * Google Apps Script - Sheets 操作處理器
 * 提供 Spreadsheet 的基礎 CRUD 操作
 */

// ==================== Spreadsheet 基礎操作 ====================

/**
 * 取得或建立 Spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {Spreadsheet}
 */
function getOrCreateSpreadsheet(spreadsheetId) {
  try {
    if (spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
    throw new Error('Spreadsheet ID 為空');
  } catch (error) {
    Logger.log('取得 Spreadsheet 失敗: ' + error.toString());
    throw error;
  }
}

/**
 * 建立新的 Spreadsheet
 * @param {string} name - Spreadsheet 名稱
 * @param {string} folderId - 資料夾 ID (選填)
 * @returns {Spreadsheet}
 */
function createSpreadsheet(name, folderId) {
  try {
    const ss = SpreadsheetApp.create(name);
    
    // 如果指定資料夾，移動到該資料夾
    if (folderId) {
      const file = DriveApp.getFileById(ss.getId());
      const folder = DriveApp.getFolderById(folderId);
      file.moveTo(folder);
    }
    
    Logger.log('Spreadsheet 建立成功: ' + name);
    return ss;
    
  } catch (error) {
    Logger.log('建立 Spreadsheet 失敗: ' + error.toString());
    throw error;
  }
}

/**
 * 複製 Spreadsheet
 * @param {string} sourceId - 來源 Spreadsheet ID
 * @param {string} newName - 新名稱
 * @returns {Spreadsheet}
 */
function copySpreadsheet(sourceId, newName) {
  try {
    const sourceFile = DriveApp.getFileById(sourceId);
    const copiedFile = sourceFile.makeCopy(newName);
    
    return SpreadsheetApp.openById(copiedFile.getId());
    
  } catch (error) {
    Logger.log('複製 Spreadsheet 失敗: ' + error.toString());
    throw error;
  }
}

/**
 * 刪除 Spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {boolean}
 */
function deleteSpreadsheet(spreadsheetId) {
  try {
    const file = DriveApp.getFileById(spreadsheetId);
    file.setTrashed(true);
    
    Logger.log('Spreadsheet 已刪除: ' + spreadsheetId);
    return true;
    
  } catch (error) {
    Logger.log('刪除 Spreadsheet 失敗: ' + error.toString());
    return false;
  }
}

// ==================== Sheet (工作表) 操作 ====================

/**
 * 取得或建立工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 * @param {string} sheetName - 工作表名稱
 * @returns {Sheet}
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('工作表建立成功: ' + sheetName);
  }
  
  return sheet;
}

/**
 * 刪除工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 * @param {string} sheetName - 工作表名稱
 * @returns {boolean}
 */
function deleteSheet(ss, sheetName) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      ss.deleteSheet(sheet);
      Logger.log('工作表已刪除: ' + sheetName);
      return true;
    }
    return false;
  } catch (error) {
    Logger.log('刪除工作表失敗: ' + error.toString());
    return false;
  }
}

/**
 * 複製工作表
 * @param {Spreadsheet} ss - Spreadsheet 物件
 * @param {string} sourceSheetName - 來源工作表名稱
 * @param {string} newSheetName - 新工作表名稱
 * @returns {Sheet}
 */
function copySheet(ss, sourceSheetName, newSheetName) {
  try {
    const sourceSheet = ss.getSheetByName(sourceSheetName);
    if (!sourceSheet) {
      throw new Error('來源工作表不存在: ' + sourceSheetName);
    }
    
    const newSheet = sourceSheet.copyTo(ss);
    newSheet.setName(newSheetName);
    
    Logger.log('工作表複製成功: ' + newSheetName);
    return newSheet;
    
  } catch (error) {
    Logger.log('複製工作表失敗: ' + error.toString());
    throw error;
  }
}

/**
 * 清空工作表
 * @param {Sheet} sheet - 工作表物件
 * @param {boolean} keepHeaders - 是否保留標題列
 */
function clearSheet(sheet, keepHeaders = true) {
  try {
    if (keepHeaders) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    } else {
      sheet.clear();
    }
    Logger.log('工作表已清空: ' + sheet.getName());
  } catch (error) {
    Logger.log('清空工作表失敗: ' + error.toString());
  }
}

// ==================== 資料讀取 ====================

/**
 * 讀取整個工作表的資料
 * @param {Sheet} sheet - 工作表物件
 * @returns {Array<Array>}
 */
function readAllData(sheet) {
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow === 0 || lastCol === 0) {
      return [];
    }
    
    return sheet.getRange(1, 1, lastRow, lastCol).getValues();
    
  } catch (error) {
    Logger.log('讀取資料失敗: ' + error.toString());
    return [];
  }
}

/**
 * 讀取指定範圍的資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} startRow - 起始列
 * @param {number} startCol - 起始欄
 * @param {number} numRows - 列數
 * @param {number} numCols - 欄數
 * @returns {Array<Array>}
 */
function readRangeData(sheet, startRow, startCol, numRows, numCols) {
  try {
    return sheet.getRange(startRow, startCol, numRows, numCols).getValues();
  } catch (error) {
    Logger.log('讀取範圍資料失敗: ' + error.toString());
    return [];
  }
}

/**
 * 讀取特定行的資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} rowNumber - 列號
 * @returns {Array}
 */
function readRow(sheet, rowNumber) {
  try {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    
    return sheet.getRange(rowNumber, 1, 1, lastCol).getValues()[0];
    
  } catch (error) {
    Logger.log('讀取列資料失敗: ' + error.toString());
    return [];
  }
}

/**
 * 讀取特定欄的資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} colNumber - 欄號
 * @returns {Array}
 */
function readColumn(sheet, colNumber) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow === 0) return [];
    
    return sheet.getRange(1, colNumber, lastRow, 1)
      .getValues()
      .map(row => row[0]);
      
  } catch (error) {
    Logger.log('讀取欄資料失敗: ' + error.toString());
    return [];
  }
}

/**
 * 根據條件查詢資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} searchCol - 搜尋欄位
 * @param {*} searchValue - 搜尋值
 * @returns {Array<Array>}
 */
function findRows(sheet, searchCol, searchValue) {
  try {
    const data = readAllData(sheet);
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][searchCol - 1] === searchValue) {
        results.push(data[i]);
      }
    }
    
    return results;
    
  } catch (error) {
    Logger.log('查詢資料失敗: ' + error.toString());
    return [];
  }
}

// ==================== 資料寫入 ====================

/**
 * 寫入單一儲存格
 * @param {Sheet} sheet - 工作表物件
 * @param {number} row - 列號
 * @param {number} col - 欄號
 * @param {*} value - 值
 */
function writeCell(sheet, row, col, value) {
  try {
    sheet.getRange(row, col).setValue(value);
  } catch (error) {
    Logger.log('寫入儲存格失敗: ' + error.toString());
  }
}

/**
 * 寫入整列資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} row - 列號
 * @param {Array} values - 值陣列
 */
function writeRow(sheet, row, values) {
  try {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  } catch (error) {
    Logger.log('寫入列資料失敗: ' + error.toString());
  }
}

/**
 * 寫入整欄資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} col - 欄號
 * @param {Array} values - 值陣列
 */
function writeColumn(sheet, col, values) {
  try {
    const data = values.map(v => [v]);
    sheet.getRange(1, col, values.length, 1).setValues(data);
  } catch (error) {
    Logger.log('寫入欄資料失敗: ' + error.toString());
  }
}

/**
 * 寫入範圍資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} startRow - 起始列
 * @param {number} startCol - 起始欄
 * @param {Array<Array>} data - 二維陣列資料
 */
function writeRangeData(sheet, startRow, startCol, data) {
  try {
    const numRows = data.length;
    const numCols = data[0].length;
    
    sheet.getRange(startRow, startCol, numRows, numCols).setValues(data);
    
  } catch (error) {
    Logger.log('寫入範圍資料失敗: ' + error.toString());
  }
}

/**
 * 附加新列資料
 * @param {Sheet} sheet - 工作表物件
 * @param {Array} values - 值陣列
 */
function appendRow(sheet, values) {
  try {
    sheet.appendRow(values);
  } catch (error) {
    Logger.log('附加列資料失敗: ' + error.toString());
  }
}

/**
 * 批次附加多列資料
 * @param {Sheet} sheet - 工作表物件
 * @param {Array<Array>} data - 二維陣列資料
 */
function appendRows(sheet, data) {
  try {
    const lastRow = sheet.getLastRow();
    const numRows = data.length;
    const numCols = data[0].length;
    
    sheet.getRange(lastRow + 1, 1, numRows, numCols).setValues(data);
    
  } catch (error) {
    Logger.log('批次附加資料失敗: ' + error.toString());
  }
}

// ==================== 資料更新與刪除 ====================

/**
 * 更新特定列的資料
 * @param {Sheet} sheet - 工作表物件
 * @param {number} row - 列號
 * @param {Object} updates - 更新資料 {欄號: 值}
 */
function updateRow(sheet, row, updates) {
  try {
    for (const col in updates) {
      sheet.getRange(row, parseInt(col)).setValue(updates[col]);
    }
  } catch (error) {
    Logger.log('更新列資料失敗: ' + error.toString());
  }
}

/**
 * 刪除特定列
 * @param {Sheet} sheet - 工作表物件
 * @param {number} row - 列號
 */
function deleteRow(sheet, row) {
  try {
    sheet.deleteRow(row);
  } catch (error) {
    Logger.log('刪除列失敗: ' + error.toString());
  }
}

/**
 * 根據條件刪除列
 * @param {Sheet} sheet - 工作表物件
 * @param {number} searchCol - 搜尋欄位
 * @param {*} searchValue - 搜尋值
 */
function deleteRowsByCondition(sheet, searchCol, searchValue) {
  try {
    const data = readAllData(sheet);
    
    // 從後往前刪除，避免列號變動
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][searchCol - 1] === searchValue) {
        sheet.deleteRow(i + 1);
      }
    }
    
  } catch (error) {
    Logger.log('條件刪除失敗: ' + error.toString());
  }
}

// ==================== 格式設定 ====================

/**
 * 設定標題列格式
 * @param {Sheet} sheet - 工作表物件
 */
function formatHeaderRow(sheet) {
  try {
    const lastCol = sheet.getLastColumn();
    const headerRange = sheet.getRange(1, 1, 1, lastCol);
    
    headerRange
      .setBackground('#4A5568')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    
    // 凍結標題列
    sheet.setFrozenRows(1);
    
  } catch (error) {
    Logger.log('設定標題格式失敗: ' + error.toString());
  }
}

/**
 * 設定儲存格背景顏色
 * @param {Sheet} sheet - 工作表物件
 * @param {number} row - 列號
 * @param {number} col - 欄號
 * @param {string} color - 顏色代碼
 */
function setCellColor(sheet, row, col, color) {
  try {
    sheet.getRange(row, col).setBackground(color);
  } catch (error) {
    Logger.log('設定顏色失敗: ' + error.toString());
  }
}

/**
 * 設定範圍背景顏色
 * @param {Sheet} sheet - 工作表物件
 * @param {number} startRow - 起始列
 * @param {number} startCol - 起始欄
 * @param {number} numRows - 列數
 * @param {number} numCols - 欄數
 * @param {string} color - 顏色代碼
 */
function setRangeColor(sheet, startRow, startCol, numRows, numCols, color) {
  try {
    sheet.getRange(startRow, startCol, numRows, numCols).setBackground(color);
  } catch (error) {
    Logger.log('設定範圍顏色失敗: ' + error.toString());
  }
}

/**
 * 自動調整欄寬
 * @param {Sheet} sheet - 工作表物件
 */
function autoResizeColumns(sheet) {
  try {
    const lastCol = sheet.getLastColumn();
    for (let i = 1; i <= lastCol; i++) {
      sheet.autoResizeColumn(i);
    }
  } catch (error) {
    Logger.log('自動調整欄寬失敗: ' + error.toString());
  }
}

// ==================== 權限管理 ====================

/**
 * 分享 Spreadsheet 給使用者
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} email - 使用者 Email
 * @param {string} permission - 權限 ('edit', 'view', 'comment')
 */
function shareSpreadsheet(spreadsheetId, email, permission) {
  try {
    const file = DriveApp.getFileById(spreadsheetId);
    
    switch (permission) {
      case 'edit':
        file.addEditor(email);
        break;
      case 'view':
        file.addViewer(email);
        break;
      case 'comment':
        file.addCommenter(email);
        break;
      default:
        file.addViewer(email);
    }
    
    Logger.log('已分享給: ' + email + ' (' + permission + ')');
    
  } catch (error) {
    Logger.log('分享失敗: ' + error.toString());
  }
}

/**
 * 批次分享給多個使用者
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {Array<string>} emails - Email 陣列
 * @param {string} permission - 權限
 */
function shareToMultipleUsers(spreadsheetId, emails, permission) {
  try {
    emails.forEach(email => {
      shareSpreadsheet(spreadsheetId, email, permission);
    });
  } catch (error) {
    Logger.log('批次分享失敗: ' + error.toString());
  }
}

/**
 * 移除使用者權限
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} email - 使用者 Email
 */
function removeUserAccess(spreadsheetId, email) {
  try {
    const file = DriveApp.getFileById(spreadsheetId);
    file.removeEditor(email);
    file.removeViewer(email);
    file.removeCommenter(email);
    
    Logger.log('已移除權限: ' + email);
    
  } catch (error) {
    Logger.log('移除權限失敗: ' + error.toString());
  }
}

// ==================== 工具函式 ====================

/**
 * 取得工作表的最後一列（含資料）
 * @param {Sheet} sheet - 工作表物件
 * @returns {number}
 */
function getLastRowWithData(sheet) {
  return sheet.getLastRow();
}

/**
 * 取得工作表的最後一欄（含資料）
 * @param {Sheet} sheet - 工作表物件
 * @returns {number}
 */
function getLastColumnWithData(sheet) {
  return sheet.getLastColumn();
}

/**
 * 檢查工作表是否為空
 * @param {Sheet} sheet - 工作表物件
 * @returns {boolean}
 */
function isSheetEmpty(sheet) {
  return sheet.getLastRow() === 0;
}

/**
 * 取得 Spreadsheet URL
 * @param {string} spreadsheetId - Spreadsheet ID
 * @returns {string}
 */
function getSpreadsheetUrl(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    return ss.getUrl();
  } catch (error) {
    Logger.log('取得 URL 失敗: ' + error.toString());
    return '';
  }
}

/**
 * 轉換欄號為字母
 * @param {number} colNumber - 欄號 (1-based)
 * @returns {string}
 */
function columnToLetter(colNumber) {
  let temp;
  let letter = '';
  while (colNumber > 0) {
    temp = (colNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colNumber = (colNumber - temp - 1) / 26;
  }
  return letter;
}

/**
 * 轉換字母為欄號
 * @param {string} letter - 欄字母
 * @returns {number}
 */
function letterToColumn(letter) {
  let column = 0;
  const length = letter.length;
  for (let i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}