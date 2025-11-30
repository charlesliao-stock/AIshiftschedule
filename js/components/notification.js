/**
 * Toast 通知元件
 * 顯示成功/錯誤/警告/資訊訊息
 */

const Notification = {
    container: null,
    toasts: [],
    defaultDuration: 3000,
    maxToasts: 5,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化通知系統
     */
    init() {
        // 取得或創建容器
        this.container = document.getElementById('toast-container');
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        
        console.log('[Notification] 初始化完成');
    },
    
    // ==================== 顯示通知 ====================
    
    /**
     * 顯示通知
     * @param {string} message - 訊息
     * @param {string} type - 類型 (success/error/warning/info)
     * @param {number} duration - 顯示時間 (毫秒)，0 = 不自動關閉
     * @param {Object} options - 其他選項
     */
    show(message, type = 'info', duration = null, options = {}) {
        if (!this.container) {
            this.init();
        }
        
        // 限制最大通知數量
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }
        
        const toastId = Utils.generateId();
        const toast = this.createToast(toastId, message, type, options);
        
        // 加入容器
        this.container.appendChild(toast);
        this.toasts.push({ id: toastId, element: toast });
        
        // 自動關閉
        const autoDuration = duration !== null ? duration : this.defaultDuration;
        if (autoDuration > 0) {
            setTimeout(() => {
                this.remove(toastId);
            }, autoDuration);
        }
        
        return toastId;
    },
    
    /**
     * 創建 Toast 元素
     * @param {string} id - Toast ID
     * @param {string} message - 訊息
     * @param {string} type - 類型
     * @param {Object} options - 選項
     * @returns {HTMLElement}
     */
    createToast(id, message, type, options = {}) {
        const { title, closable = true } = options;
        
        // Toast 容器
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('data-toast-id', id);
        
        // Icon
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.innerHTML = this.getIcon(type);
        toast.appendChild(icon);
        
        // 內容
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
        
        toast.appendChild(content);
        
        // 關閉按鈕
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '✕';
            closeBtn.onclick = () => this.remove(id);
            toast.appendChild(closeBtn);
        }
        
        return toast;
    },
    
    /**
     * 取得 Icon
     * @param {string} type - 類型
     * @returns {string} HTML
     */
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };
        return icons[type] || icons.info;
    },
    
    // ==================== 快捷方法 ====================
    
    /**
     * 成功通知
     * @param {string} message - 訊息
     * @param {number} duration - 顯示時間
     */
    success(message, duration = null) {
        return this.show(message, 'success', duration);
    },
    
    /**
     * 錯誤通知
     * @param {string} message - 訊息
     * @param {number} duration - 顯示時間 (錯誤通知預設較長)
     */
    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    },
    
    /**
     * 警告通知
     * @param {string} message - 訊息
     * @param {number} duration - 顯示時間
     */
    warning(message, duration = null) {
        return this.show(message, 'warning', duration);
    },
    
    /**
     * 資訊通知
     * @param {string} message - 訊息
     * @param {number} duration - 顯示時間
     */
    info(message, duration = null) {
        return this.show(message, 'info', duration);
    },
    
    /**
     * 載入中通知 (不自動關閉)
     * @param {string} message - 訊息
     * @returns {string} Toast ID (用於後續手動關閉)
     */
    loading(message = '載入中...') {
        return this.show(message, 'info', 0, { closable: false });
    },
    
    // ==================== 移除通知 ====================
    
    /**
     * 移除指定通知
     * @param {string} toastId - Toast ID 或物件
     */
    remove(toastId) {
        const id = typeof toastId === 'object' ? toastId.id : toastId;
        const index = this.toasts.findIndex(t => t.id === id);
        
        if (index === -1) return;
        
        const toast = this.toasts[index];
        
        // 加上離開動畫
        toast.element.classList.add('toast-out');
        
        // 動畫結束後移除
        setTimeout(() => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
            this.toasts.splice(index, 1);
        }, 300);
    },
    
    /**
     * 移除所有通知
     */
    removeAll() {
        [...this.toasts].forEach(toast => {
            this.remove(toast.id);
        });
    },
    
    // ==================== 特殊通知 ====================
    
    /**
     * 確認通知 (帶按鈕)
     * @param {string} message - 訊息
     * @param {Function} onConfirm - 確認回調
     * @param {Function} onCancel - 取消回調
     */
    confirm(message, onConfirm, onCancel = null) {
        const toastId = Utils.generateId();
        
        const toast = document.createElement('div');
        toast.className = 'toast info';
        toast.setAttribute('data-toast-id', toastId);
        
        // 內容
        const content = document.createElement('div');
        content.className = 'toast-content';
        content.style.flex = '1';
        
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
        
        // 按鈕容器
        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '8px';
        buttons.style.marginTop = '12px';
        
        // 確認按鈕
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary btn-sm';
        confirmBtn.textContent = '確認';
        confirmBtn.onclick = () => {
            this.remove(toastId);
            if (onConfirm) onConfirm();
        };
        buttons.appendChild(confirmBtn);
        
        // 取消按鈕
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => {
            this.remove(toastId);
            if (onCancel) onCancel();
        };
        buttons.appendChild(cancelBtn);
        
        content.appendChild(buttons);
        toast.appendChild(content);
        
        // 加入容器
        this.container.appendChild(toast);
        this.toasts.push({ id: toastId, element: toast });
        
        return toastId;
    },
    
    /**
     * 進度通知
     * @param {string} message - 訊息
     * @param {number} progress - 進度 (0-100)
     * @returns {string} Toast ID
     */
    progress(message, progress = 0) {
        const toastId = Utils.generateId();
        
        const toast = document.createElement('div');
        toast.className = 'toast info';
        toast.setAttribute('data-toast-id', toastId);
        
        // 內容
        const content = document.createElement('div');
        content.className = 'toast-content';
        content.style.flex = '1';
        
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
        
        // 進度條
        const progressBar = document.createElement('div');
        progressBar.style.width = '100%';
        progressBar.style.height = '4px';
        progressBar.style.background = '#e5e7eb';
        progressBar.style.borderRadius = '2px';
        progressBar.style.marginTop = '8px';
        progressBar.style.overflow = 'hidden';
        
        const progressFill = document.createElement('div');
        progressFill.style.width = progress + '%';
        progressFill.style.height = '100%';
        progressFill.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        progressFill.style.transition = 'width 0.3s';
        progressBar.appendChild(progressFill);
        
        content.appendChild(progressBar);
        toast.appendChild(content);
        
        // 加入容器
        this.container.appendChild(toast);
        this.toasts.push({ 
            id: toastId, 
            element: toast, 
            progressFill 
        });
        
        return toastId;
    },
    
    /**
     * 更新進度通知
     * @param {string} toastId - Toast ID
     * @param {number} progress - 新進度
     * @param {string} message - 新訊息 (選填)
     */
    updateProgress(toastId, progress, message = null) {
        const toast = this.toasts.find(t => t.id === toastId);
        if (!toast) return;
        
        if (toast.progressFill) {
            toast.progressFill.style.width = progress + '%';
        }
        
        if (message) {
            const messageEl = toast.element.querySelector('.toast-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
        
        // 完成時自動關閉
        if (progress >= 100) {
            setTimeout(() => {
                this.remove(toastId);
            }, 1000);
        }
    }
};

// 讓通知元件可在全域使用
if (typeof window !== 'undefined') {
    window.Notification = Notification;
    
    // 自動初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            Notification.init();
        });
    } else {
        Notification.init();
    }
}