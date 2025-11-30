/**
 * 載入動畫元件
 * 顯示全螢幕載入動畫
 */

const Loading = {
    overlay: null,
    
    // ==================== 顯示/隱藏 ====================
    
    /**
     * 顯示載入動畫
     * @param {string} message - 載入訊息
     */
    show(message = '載入中...') {
        // 如果已存在，先移除
        this.hide();
        
        // 建立遮罩
        this.overlay = document.createElement('div');
        this.overlay.id = 'app-loader';
        this.overlay.className = 'loader-overlay';
        this.overlay.innerHTML = `
            <div class="loader-spinner"></div>
            <p>${message}</p>
        `;
        
        document.body.appendChild(this.overlay);
        
        // 防止頁面滾動
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * 隱藏載入動畫
     */
    hide() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
        }
        
        // 恢復頁面滾動
        document.body.style.overflow = '';
    },
    
    /**
     * 更新載入訊息
     * @param {string} message - 新訊息
     */
    updateMessage(message) {
        if (this.overlay) {
            const messageEl = this.overlay.querySelector('p');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    },
    
    // ==================== 進階用法 ====================
    
    /**
     * 顯示載入動畫並執行非同步函式
     * @param {Function} asyncFn - 非同步函式
     * @param {string} message - 載入訊息
     * @returns {Promise<*>} 函式的返回值
     */
    async wrap(asyncFn, message = '載入中...') {
        this.show(message);
        
        try {
            const result = await asyncFn();
            return result;
        } finally {
            this.hide();
        }
    },
    
    /**
     * 延遲隱藏 (確保使用者能看到載入動畫)
     * @param {number} minDuration - 最小顯示時間 (毫秒)
     */
    async hideAfter(minDuration = 500) {
        await Utils.sleep(minDuration);
        this.hide();
    }
};

// 讓載入動畫元件可在全域使用
if (typeof window !== 'undefined') {
    window.Loading = Loading;
}