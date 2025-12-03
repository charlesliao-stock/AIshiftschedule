/**
 * js/components/modal.js
 * 彈窗元件 (ES Module 版 - UI 優化版)
 */

import { Utils } from '../core/utils.js';

export const Modal = {
    currentModal: null,
    
    // ... (show, close, confirm, alert 方法保持不變，請直接複製原檔對應部分) ...
    // 為節省篇幅，這裡省略 show/close/confirm/alert 的實作，請保留原有的程式碼
    // 或是直接使用我上一輪提供的完整 modal.js，並只替換下面的 form 方法

    /**
     * 顯示通用彈窗
     */
    show(options = {}) {
        const {
            title = '標題',
            content = '',
            size = 'medium',
            closable = true,
            buttons = [],
            onClose = null
        } = options;
        
        this.close();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
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
        if (typeof content === 'string') body.innerHTML = content;
        else if (content instanceof HTMLElement) body.appendChild(content);
        modal.appendChild(body);
        
        // Footer
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
                        if (result !== false && !btn.keepOpen) this.close();
                    } else if (!btn.keepOpen) {
                        this.close();
                    }
                };
                footer.appendChild(button);
            });
            modal.appendChild(footer);
        }
        
        overlay.appendChild(modal);
        
        if (closable) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                    if (onClose) onClose();
                }
            });
        }
        
        document.body.appendChild(overlay);
        this.currentModal = overlay;
        document.body.style.overflow = 'hidden';
        
        const autoFocus = modal.querySelector('[autofocus]');
        if (autoFocus) autoFocus.focus();
        
        // 初始化顏色選擇器事件 (如果有的話)
        const colorOptions = modal.querySelectorAll('.color-option');
        colorOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const parent = e.target.closest('.color-palette');
                const hiddenInput = parent.querySelector('input[type="hidden"]');
                
                // 移除其他選取狀態
                parent.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                // 設定當前選取
                e.target.classList.add('selected');
                // 更新隱藏欄位值
                hiddenInput.value = e.target.dataset.color;
            });
        });

        return modal;
    },

    close() {
        if (this.currentModal && this.currentModal.parentNode) {
            this.currentModal.parentNode.removeChild(this.currentModal);
            this.currentModal = null;
        }
        document.body.style.overflow = '';
    },

    confirm(message, options = {}) {
        return new Promise((resolve) => {
            this.show({
                title: options.title || '確認',
                content: `<p>${message}</p>`,
                size: 'small',
                buttons: [
                    { text: options.cancelText || '取消', onClick: () => resolve(false) },
                    { text: options.confirmText || '確認', className: options.danger ? 'btn-error' : 'btn-primary', onClick: () => resolve(true) }
                ],
                onClose: () => resolve(false)
            });
        });
    },

    alert(message, title = '提示') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                size: 'small',
                buttons: [{ text: '確定', className: 'btn-primary', onClick: () => resolve() }],
                onClose: () => resolve()
            });
        });
    },

    /**
     * 動態表單 (UI 優化版)
     */
    form(title, fields) {
        return new Promise((resolve) => {
            const formHtml = fields.map(field => {
                const isRequired = field.required ? 'required' : '';
                const labelHtml = `<label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>`;
                let inputHtml = '';

                if (field.type === 'select') {
                    const options = field.options.map(opt => 
                        `<option value="${opt.value}" ${opt.value == field.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    inputHtml = `<select name="${field.name}" class="form-select" ${isRequired}>${options}</select>`;
                
                } else if (field.type === 'time') {
                    // [UI 優化] 時間選擇器：拆分為時與分 (00, 30)
                    const [h, m] = (field.value || '08:00').split(':');
                    
                    // 小時選項 (00-23)
                    const hourOptions = Array.from({length: 24}, (_, i) => {
                        const val = String(i).padStart(2, '0');
                        return `<option value="${val}" ${val === h ? 'selected' : ''}>${val}</option>`;
                    }).join('');
                    
                    // 分鐘選項 (00, 30)
                    const minuteOptions = `
                        <option value="00" ${m === '00' ? 'selected' : ''}>00</option>
                        <option value="30" ${m === '30' ? 'selected' : ''}>30</option>
                    `;
                    
                    inputHtml = `
                        <div class="d-flex gap-2 align-items-center">
                            <select name="${field.name}_h" class="form-select" style="width: 80px;">${hourOptions}</select>
                            <span>:</span>
                            <select name="${field.name}_m" class="form-select" style="width: 80px;">${minuteOptions}</select>
                        </div>
                    `;

                } else if (field.type === 'color') {
                    // [UI 優化] 矩陣式顏色選擇器
                    const presetColors = [
                        '#E9D5FF', '#C7D2FE', '#FEF3C7', '#FED7AA', '#BBF7D0', // 預設柔和色系
                        '#FBCFE8', '#FDE68A', '#A7F3D0', '#BFDBFE', '#DDD6FE',
                        '#F5F5F5', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#FFFFFF'
                    ];
                    
                    // 確保目前的值有在列表內，沒有的話加進去
                    let currentColor = field.value || '#E9D5FF';
                    // 轉大寫比對
                    if (!presetColors.map(c => c.toUpperCase()).includes(currentColor.toUpperCase())) {
                        presetColors.push(currentColor);
                    }

                    const paletteHtml = presetColors.map(color => {
                        const isSelected = color.toUpperCase() === currentColor.toUpperCase() ? 'selected' : '';
                        return `<div class="color-option ${isSelected}" data-color="${color}" style="background-color: ${color};"></div>`;
                    }).join('');

                    inputHtml = `
                        <div class="color-palette">
                            <input type="hidden" name="${field.name}" value="${currentColor}">
                            <div class="color-grid">${paletteHtml}</div>
                        </div>
                    `;

                } else if (field.type === 'textarea') {
                    inputHtml = `<textarea name="${field.name}" class="form-textarea" ${isRequired}>${field.value || ''}</textarea>`;
                } else {
                    const type = field.type || 'text';
                    inputHtml = `<input type="${type}" name="${field.name}" class="form-input" value="${field.value || ''}" ${isRequired} placeholder="${field.placeholder || ''}">`;
                }

                return `<div class="form-group" style="margin-bottom: 15px;">${labelHtml}${inputHtml}</div>`;
            }).join('');

            // 注入 CSS 樣式 (針對顏色選擇器)
            const style = `
                <style>
                    .d-flex { display: flex; }
                    .gap-2 { gap: 8px; }
                    .align-items-center { align-items: center; }
                    .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 5px; }
                    .color-option { 
                        width: 36px; height: 36px; border-radius: 50%; cursor: pointer; 
                        border: 2px solid transparent; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        transition: transform 0.1s;
                    }
                    .color-option:hover { transform: scale(1.1); }
                    .color-option.selected { border-color: #667eea; transform: scale(1.1); box-shadow: 0 0 0 2px white, 0 0 0 4px #667eea; }
                </style>
            `;

            this.show({
                title,
                content: style + `<form id="modal-dynamic-form">${formHtml}</form>`,
                buttons: [
                    { text: '取消', onClick: () => resolve(null) },
                    { 
                        text: '確定', 
                        className: 'btn-primary', 
                        onClick: () => {
                            const form = document.getElementById('modal-dynamic-form');
                            if (!form.checkValidity()) {
                                form.reportValidity();
                                return false;
                            }
                            const formData = new FormData(form);
                            const data = {};
                            
                            // 處理 FormData
                            formData.forEach((value, key) => {
                                // 處理時間組合 (h + m)
                                if (key.endsWith('_h')) {
                                    const baseName = key.replace('_h', '');
                                    const h = value;
                                    const m = formData.get(baseName + '_m');
                                    data[baseName] = `${h}:${m}`;
                                } else if (!key.endsWith('_m')) {
                                    data[key] = value;
                                }
                            });
                            
                            resolve(data);
                        }
                    }
                ],
                onClose: () => resolve(null)
            });
        });
    }
};
