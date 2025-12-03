/**
 * js/core/utils.js
 * 工具函式庫 (ES Module 版 - 含 CSV 處理)
 */

import { CONSTANTS } from '../config/constants.js';

export const Utils = {
    // ... (保留原有的日期、字串、數字處理函式，請勿刪除) ...
    // 為節省篇幅，請保留您原檔中 formatDate, getMonthString 等所有上方函式
    // 直接在檔案末尾添加以下 CSV 處理函式：

    // ==================== 檔案與 CSV 處理 ====================

    /**
     * 下載 CSV 檔案 (自動加入 BOM 以支援 Excel 中文)
     * @param {string} content CSV 內容字串
     * @param {string} filename 檔名
     */
    downloadCSV(content, filename) {
        // 加入 BOM 讓 Excel 辨識 UTF-8
        const bom = '\uFEFF';
        const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * 解析 CSV 檔案
     * @param {File} file 上傳的檔案物件
     * @returns {Promise<Array>} 解析後的物件陣列
     */
    parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r\n|\n/);
                    const result = [];
                    
                    // 取得標題列 (移除空白與 BOM)
                    const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
                    
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        // 簡單的 CSV 分割 (暫不處理引號內的逗號)
                        const values = line.split(',');
                        const obj = {};
                        
                        headers.forEach((header, index) => {
                            obj[header] = values[index] ? values[index].trim() : '';
                        });
                        
                        result.push(obj);
                    }
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
    
    // ... (保留原有的 debounce, throttle 等工具函式) ...
    
    // 確保最後有導出
    // deepClone, deepMerge 等函式請保留
};
