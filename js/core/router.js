/**
 * js/core/router.js
 * (僅列出需修正的部分，請覆蓋原檔案的 loadUnits 方法)
 */

// ... (其他 imports)

export const Router = {
    // ... (init, handleRoute 等)

    // [Week 2] 單位管理 - 路徑修正
    async loadUnits() {
        console.log('[Router] 載入單位管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="units-container"></div>`;

        try {
            // 修正：確保路徑指向 unit-management 資料夾
            const module = await import('../modules/unit-management/unit-management.js');
            const UnitManagement = module.UnitManagement || module.default;
            
            if (UnitManagement && UnitManagement.init) {
                await UnitManagement.init();
            } else {
                throw new Error('單位管理模組未匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入單位管理模組失敗:', error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },

    // ... (其他 methods)
};
