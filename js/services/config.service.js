// js/services/config.service.js
import { FirebaseService } from './firebase.service.js'; // 修正：導入 Service 物件
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { API_CONFIG } from '../config/api.config.js';

const CONFIG_COLLECTION = 'system_settings';
const CONFIG_DOC = 'api_config';

export const ConfigService = {
    /**
     * 從 Firebase 載入系統設定並覆寫本地配置
     */
    async loadSystemConfig() {
        // 1. 取得 DB 實體 (透過 Getter)
        const db = FirebaseService.db;
        
        if (!db) {
            console.warn('[Config] 無法取得資料庫連線 (可能是 Firebase 初始化失敗)，略過遠端設定');
            return false;
        }

        try {
            console.log('[Config] 正在載入遠端設定...');
            
            // 2. 建立文件參照
            const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // 3. 覆寫全域設定
                // ⚠️ 關鍵：直接修改記憶體中的 API_CONFIG 物件屬性
                let updated = false;

                if (data.gas_url) {
                    API_CONFIG.BASE_URL = data.gas_url;
                    console.log(`[Config] API URL 已更新 (...${data.gas_url.slice(-10)})`);
                    updated = true;
                }
                
                if (data.target_sheet_id) {
                    API_CONFIG.TEST_SHEET_ID = data.target_sheet_id;
                    updated = true;
                }
                
                return updated;
            } else {
                console.warn('[Config] 找不到遠端設定文件 (system_settings/api_config)，將使用預設值');
                return false;
            }
        } catch (error) {
            console.error('[Config] 載入失敗:', error);
            // 失敗時保持使用 api.config.js 的預設值，不阻擋系統運作
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
            
            // 使用 setDoc + merge: true，確保欄位被更新或建立
            await setDoc(docRef, {
                gas_url: newUrl,
                target_sheet_id: newSheetId,
                updated_at: new Date().toISOString()
            }, { merge: true });
            
            // 更新本地記憶體，讓當前使用者不用重整也能生效
            API_CONFIG.BASE_URL = newUrl;
            API_CONFIG.TEST_SHEET_ID = newSheetId;
            
            return true;
        } catch (error) {
            console.error('[Config] 更新失敗:', error);
            throw error;
        }
    }
};
