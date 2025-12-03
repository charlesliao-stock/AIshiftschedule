// js/services/config.service.js
import { db } from './firebase.service.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'; // 確保路徑與 firebase.service.js 一致
import { API_CONFIG } from '../config/api.config.js';

const CONFIG_COLLECTION = 'system_settings';
const CONFIG_DOC = 'api_config';

export const ConfigService = {
    /**
     * 從 Firebase 載入系統設定並覆寫本地配置
     */
    async loadSystemConfig() {
        try {
            console.log('[Config] 正在載入遠端設定...');
            const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // ⚠️ 關鍵：直接修改記憶體中的 API_CONFIG 物件屬性
                if (data.gas_url) {
                    API_CONFIG.BASE_URL = data.gas_url;
                    console.log('[Config] API URL 已更新為遠端設定');
                }
                
                if (data.target_sheet_id) {
                    API_CONFIG.TEST_SHEET_ID = data.target_sheet_id;
                }
                
                return true;
            } else {
                console.warn('[Config] 找不到遠端設定，將使用預設值');
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
     */
    async updateSystemConfig(newUrl, newSheetId) {
        try {
            const docRef = doc(db, CONFIG_COLLECTION, CONFIG_DOC);
            await setDoc(docRef, {
                gas_url: newUrl,
                target_sheet_id: newSheetId,
                updated_at: new Date().toISOString()
            }, { merge: true });
            
            // 更新本地記憶體
            API_CONFIG.BASE_URL = newUrl;
            API_CONFIG.TEST_SHEET_ID = newSheetId;
            
            return true;
        } catch (error) {
            console.error('[Config] 更新失敗:', error);
            throw error;
        }
    }
};
