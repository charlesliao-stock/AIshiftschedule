/**
 * 彈窗 (Modal) 元件
 * 顯示對話框、表單、確認訊息等
 */

const Modal = {
    currentModal: null,
    
    // ==================== 基礎彈窗 ====================
    
    /**
     * 顯示彈窗
     * @param {Object} options - 選項
     * @returns {HTMLElement} Modal 元素
     */
    show(options = {}) {
        const {
            title = '標題',
            content = '',
            size = 'medium', // small, medium, large
            closable = true,
            buttons = [],
            onClose = null
        } = options;
        
        // 關閉現有彈窗
        this.close();
        
        // 建立遮罩
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        // 建立彈窗
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // 設定大小
        if (size === 'small') modal.style.maxWidth = '400px';
        if (size === 'large') modal.style.maxWidth = '800px';
        
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
        
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.innerHTML = '✕';
            closeBtn.onclick = () => {
                this.close();
                if (onClose) onClose();
            };
            header.appendChild(closeBtn);
        }
        
        modal.appendChild(header);
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }
        
        modal.appendChild(body);
        
        // Footer (如果有按鈕)
        if (buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `btn ${btn.className || 'btn-secondary'}`;
                button.textContent = btn.text;
                button.onclick = () => {
                    if (btn.onClick) {
                        const result = btn.onClick();
                        // 如果回傳 false，不關閉彈窗
                        if (result !== false && !btn.keepOpen) {
                            this.close();
                        }
                    } else if (!btn.keepOpen) {
                        this.close();
                    }
                };
                footer.appendChild(button);
            });
            
            modal.appendChild(footer);
        }
        
        overlay.appendChild(modal);
        
        // 點擊遮罩關閉
        if (closable) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                    if (onClose) onClose();
                }
            });
        }
        
        // 加入 DOM
        document.body.appendChild(overlay);
        this.currentModal = overlay;
        
        // 防止背景滾動
        document.body.style.overflow = 'hidden';
        
        return modal;
    },
    
    /**
     * 關閉彈窗
     */
    close() {
        if (this.currentModal && this.currentModal.parentNode) {
            this.currentModal.parentNode.removeChild(this.currentModal);
            this.currentModal = null;
        }
        
        // 恢復背景滾動
        document.body.style.overflow = '';
    },
    
    // ==================== 快捷方法 ====================
    
    /**
     * 確認對話框
     * @param {string} message - 訊息
     * @param {Object} options - 選項
     * @returns {Promise<boolean>}
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = '確認',
                confirmText = '確認',
                cancelText = '取消',
                confirmClass = 'btn-primary',
                danger = false
            } = options;
            
            this.show({
                title,
                content: `<p style="margin: 0;">${message}</p>`,
                size: 'small',
                buttons: [
                    {
                        text: cancelText,
                        className: 'btn-secondary',
                        onClick: () => resolve(false)
                    },
                    {
                        text: confirmText,
                        className: danger ? 'btn-error' : confirmClass,
                        onClick: () => resolve(true)
                    }
                ]
            });
        });
    },
    
    /**
     * 警告對話框
     * @param {string} message - 訊息
     * @param {string} title - 標題
     */
    alert(message, title = '提示') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p style="margin: 0;">${message}</p>`,
                size: 'small',
                buttons: [
                    {
                        text: '確定',
                        className: 'btn-primary',
                        onClick: () => resolve()
                    }
                ]
            });
        });
    },
    
    /**
     * 輸入對話框
     * @param {string} message - 訊息
     * @param {Object} options - 選項
     * @returns {Promise<string|null>}
     */
    prompt(message, options = {}) {
        return new Promise((resolve) => {
            const {
                title = '輸入',
                defaultValue = '',
                placeholder = '',
                inputType = 'text'
            } = options;
            
            const inputId = 'modal-input-' + Utils.generateId();
            
            const content = `
                <div>
                    <p style="margin-bottom: 16px;">${message}</p>
                    <input 
                        type="${inputType}" 
                        id="${inputId}" 
                        class="form-input" 
                        placeholder="${placeholder}"
                        value="${defaultValue}"
                    >
                </div>
            `;
            
            const modal = this.show({
                title,
                content,
                size: 'small',
                buttons: [
                    {
                        text: '取消',
                        className: 'btn-secondary',
                        onClick: () => resolve(null)
                    },
                    {
                        text: '確定',
                        className: 'btn-primary',
                        onClick: () => {
                            const input = document.getElementById(inputId);
                            resolve(input ? input.value : null);
                        }
                    }
                ]
            });
            
            // 自動 focus
            setTimeout(() => {
                const input = document.getElementById(inputId);
                if (input) input.focus();
            }, 100);
        });
    },
    
    /**
     * 表單對話框
     * @param {string} title - 標題
     * @param {Array} fields - 欄位定義
     * @returns {Promise<Object|null>}
     */
    form(title, fields = []) {
        return new Promise((resolve) => {
            let formHtml = '<div style="display: flex; flex-direction: column; gap: 16px;">';
            
            fields.forEach((field, index) => {
                const fieldId = 'modal-field-' + index;
                const required = field.required ? 'required' : '';
                const requiredMark = field.required ? '<span style="color: red;">*</span>' : '';
                
                formHtml += `
                    <div class="form-group">
                        <label class="form-label" for="${fieldId}">
                            ${field.label} ${requiredMark}
                        </label>
                `;
                
                if (field.type === 'textarea') {
                    formHtml += `
                        <textarea 
                            id="${fieldId}" 
                            class="form-textarea" 
                            placeholder="${field.placeholder || ''}"
                            ${required}
                        >${field.value || ''}</textarea>
                    `;
                } else if (field.type === 'select') {
                    formHtml += `<select id="${fieldId}" class="form-select" ${required}>`;
                    if (field.placeholder) {
                        formHtml += `<option value="">${field.placeholder}</option>`;
                    }
                    (field.options || []).forEach(opt => {
                        const selected = opt.value === field.value ? 'selected' : '';
                        formHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    });
                    formHtml += `</select>`;
                } else {
                    formHtml += `
                        <input 
                            type="${field.type || 'text'}" 
                            id="${fieldId}" 
                            class="form-input" 
                            placeholder="${field.placeholder || ''}"
                            value="${field.value || ''}"
                            ${required}
                        >
                    `;
                }
                
                formHtml += `</div>`;
            });
            
            formHtml += '</div>';
            
            this.show({
                title,
                content: formHtml,
                size: 'medium',
                buttons: [
                    {
                        text: '取消',
                        className: 'btn-secondary',
                        onClick: () => resolve(null)
                    },
                    {
                        text: '提交',
                        className: 'btn-primary',
                        onClick: () => {
                            const result = {};
                            let hasError = false;
                            
                            fields.forEach((field, index) => {
                                const input = document.getElementById('modal-field-' + index);
                                if (input) {
                                    const value = input.value.trim();
                                    
                                    // 檢查必填
                                    if (field.required && !value) {
                                        input.style.borderColor = 'red';
                                        hasError = true;
                                        return;
                                    }
                                    
                                    result[field.name] = value;
                                }
                            });
                            
                            if (hasError) {
                                Notification.error('請填寫所有必填欄位');
                                return false; // 不關閉彈窗
                            }
                            
                            resolve(result);
                        }
                    }
                ]
            });
        });
    },
    
    /**
     * 載入對話框
     * @param {string} message - 訊息
     * @returns {Object} 包含 close 和 updateMessage 方法
     */
    loading(message = '處理中...') {
        const content = `
            <div style="text-align: center; padding: 20px;">
                <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                <p id="loading-message" style="margin: 0; color: #666;">${message}</p>
            </div>
        `;
        
        this.show({
            title: '',
            content,
            size: 'small',
            closable: false
        });
        
        return {
            close: () => this.close(),
            updateMessage: (newMessage) => {
                const messageEl = document.getElementById('loading-message');
                if (messageEl) {
                    messageEl.textContent = newMessage;
                }
            }
        };
    }
};

// 讓彈窗元件可在全域使用
if (typeof window !== 'undefined') {
    window.Modal = Modal;
}