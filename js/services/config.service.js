/**
 * js/services/config.service.js
 * 系統組態服務 (Remote Config)
 * 負責從 Firebase 同步 API URL 與 Sheet ID
 */

// 修正：導入 FirebaseService 物件，而非不存在的 db 匯出
import { FirebaseService } from './firebase.service.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { API_CONFIG } from '../config/api.config.js';

const CONFIG_COLLECTION = 'system_settings';
const CONFIG_DOC = 'api_config';

export const ConfigService = {
    /**
     * 從 Firebase 載入系統設定並覆寫本地配置
     * @returns {Promise<boolean>} 是否成功更新
     */
    async loadSystemConfig() {
        // 1. 透過 Getter 取得 DB 實體
        const db = FirebaseService.db;
        
        // 如果 Firebase 初始化失敗或尚未初始化，跳過此步驟
        if (!db) {
            console.warn('[Config] 無法取得資料庫連線，略過遠端設定載入');
            return false;
        }

        try {
            console.log('[Config] 正在載入遠端設定...');
            
            // 2. 建立文件參照並讀取
            const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                let updated = false;
                
                // 3. 覆寫 API_CONFIG (直接修改記憶體中的物件)
                if (data.gas_url) {
                    API_CONFIG.BASE_URL = data.gas_url;
                    // 只顯示網址後幾碼以利除錯
                    const shortUrl = data.gas_url.length > 10 ? '...' + data.gas_url.slice(-10) : data.gas_url;
                    console.log(`[Config] API URL 已更新為遠端設定 (${shortUrl})`);
                    updated = true;
                }
                
                if (data.target_sheet_id) {
                    API_CONFIG.TEST_SHEET_ID = data.target_sheet_id;
                    updated = true;
                }
                
                return updated;
            } else {
                console.warn('[Config] 找不到遠端設定文件 (使用預設值)');
                // 可以在這裡建立預設文件，或者就讓它保持預設值
                return false;
            }
        } catch (error) {
            // 捕捉權限錯誤或網路錯誤，不阻擋 App 繼續執行
            console.error('[Config] 載入失敗 (將使用本地預設值):', error);
            return false;
        }
    },

    /**
     * 更新 Firebase 上的設定 (供管理員使用)
     * @param {string} newUrl - 新的 GAS Web App URL
     * @param {string} newSheetId - 新的 Google Sheet ID
     */
    async updateSystemConfig(newUrl, newSheetId) {
        const db = FirebaseService.db;
        if (!db) throw new Error('Firebase DB 尚未初始化');

        try {
            const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
            
            // 使用 merge: true 確保不會覆蓋掉其他可能的設定欄位
            await setDoc(docRef, {
                gas_url: newUrl,
                target_sheet_id: newSheetId,
                updated_at: new Date().toISOString()
            }, { merge: true });
            
            // 立即更新本地記憶體，讓當前使用者不用重整也能生效
            API_CONFIG.BASE_URL = newUrl;
            API_CONFIG.TEST_SHEET_ID = newSheetId;
            
            console.log('[Config] 遠端設定已更新完畢');
            return true;
        } catch (error) {
            console.error('[Config] 更新設定失敗:', error);
            throw error;
        }
    }
};
