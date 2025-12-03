/**
 * js/components/modal.js
 * 彈窗元件 (ES Module 版 - 完整功能版)
 */

import { Utils } from '../core/utils.js';

export const Modal = {
    currentModal: null,
    
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
                        // 如果 onClick 回傳 false，則不關閉視窗 (例如表單驗證失敗)
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
        document.body.style.overflow = 'hidden'; // 防止背景滾動
        
        // 如果有表單內的 autofocus 元素，自動聚焦
        const autoFocus = modal.querySelector('[autofocus]');
        if (autoFocus) autoFocus.focus();
        
        return modal;
    },
    
    /**
     * 關閉目前彈窗
     */
    close() {
        if (this.currentModal && this.currentModal.parentNode) {
            this.currentModal.parentNode.removeChild(this.currentModal);
            this.currentModal = null;
        }
        document.body.style.overflow = '';
    },
    
    /**
     * 確認對話框
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            this.show({
                title: options.title || '確認',
                content: `<p>${message}</p>`,
                size: 'small',
                buttons: [
                    { text: options.cancelText || '取消', onClick: () => resolve(false) },
                    { 
                        text: options.confirmText || '確認', 
                        className: options.danger ? 'btn-error' : 'btn-primary', 
                        onClick: () => resolve(true) 
                    }
                ],
                onClose: () => resolve(false)
            });
        });
    },
    
    /**
     * 提示對話框
     */
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
     * 動態表單彈窗 (修復 ShiftManagement 錯誤的關鍵方法)
     * @param {string} title 標題
     * @param {Array} fields 欄位設定陣列 [{name, label, type, value, required, options}]
     * @returns {Promise<Object|null>} 回傳表單資料物件，取消則回傳 null
     */
    form(title, fields) {
        return new Promise((resolve) => {
            // 生成表單 HTML
            const formHtml = fields.map(field => {
                const isRequired = field.required ? 'required' : '';
                const labelHtml = `<label class="form-label ${field.required ? 'required' : ''}">${field.label}</label>`;
                let inputHtml = '';

                if (field.type === 'select') {
                    const options = field.options.map(opt => 
                        `<option value="${opt.value}" ${opt.value == field.value ? 'selected' : ''}>${opt.label}</option>`
                    ).join('');
                    inputHtml = `<select name="${field.name}" class="form-select" ${isRequired}>${options}</select>`;
                } else if (field.type === 'textarea') {
                    inputHtml = `<textarea name="${field.name}" class="form-textarea" ${isRequired}>${field.value || ''}</textarea>`;
                } else {
                    const type = field.type || 'text';
                    inputHtml = `<input type="${type}" name="${field.name}" class="form-input" value="${field.value || ''}" ${isRequired} placeholder="${field.placeholder || ''}">`;
                }

                return `<div class="form-group" style="margin-bottom: 15px;">${labelHtml}${inputHtml}</div>`;
            }).join('');

            // 顯示彈窗
            this.show({
                title,
                content: `<form id="modal-dynamic-form">${formHtml}</form>`,
                buttons: [
                    { text: '取消', onClick: () => resolve(null) },
                    { 
                        text: '確定', 
                        className: 'btn-primary', 
                        onClick: () => {
                            const form = document.getElementById('modal-dynamic-form');
                            if (!form.checkValidity()) {
                                form.reportValidity(); // 觸發瀏覽器原生驗證提示
                                return false; // 保持開啟
                            }
                            // 收集資料
                            const formData = new FormData(form);
                            const data = {};
                            formData.forEach((value, key) => data[key] = value);
                            resolve(data);
                        }
                    }
                ],
                onClose: () => resolve(null)
            });
        });
    }
};
