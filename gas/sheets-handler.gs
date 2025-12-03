// GAS 後端範例 (概念碼)
function handleBackupSchedule(data) {
  const ssId = data.spreadsheetId; // 從前端傳來的 ID
  const sheetName = data.month + "_" + data.unitId; // 例如 2025-01_ICU
  
  const ss = SpreadsheetApp.openById(ssId);
  let sheet = ss.getSheetByName(sheetName);
  
  // 自動建立新分頁
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // 初始化表頭 (姓名, 1號, 2號...)
    const headers = ['姓名'];
    for(var i=1; i<=31; i++) headers.push(i);
    sheet.appendRow(headers);
  }
  
  // ... 寫入資料邏輯 ...
  return { status: 'success' };
}
