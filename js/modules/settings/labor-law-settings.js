/**
 * js/modules/settings/labor-law-settings.js
 * 勞基法規範設定模組 (ES Module 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';

export const LaborLawSettings = {
    settings: null,
    container: null,

    async init(container) {
        this.container = container;
        await this.loadSettings();
        this.render();
    },

    async loadSettings() {
        try {
            this.settings = await SettingsService.getLaborLawSettings();
            if (!this.settings || Object.keys(this.settings).length === 0) {
                this.settings = this.getDefaultSettings();
            }
        } catch (error) {
            console.error('載入失敗', error);
            this.settings = this.getDefaultSettings();
        }
    },

    getDefaultSettings() {
        return {
            flexTimeType: '四週',
            maxConsecutiveDays: 6,
            minRestTime: 11
        };
    },

    render() {
        this.container.innerHTML = `
            <form id="labor-law-form">
                <h5 class="mb-3">工時規範</h5>
                <div class="mb-3">
                    <label class="form-label">變形工時類型</label>
                    <select class="form-select" id="flexTimeType">
                        <option value="四週" ${this.settings.flexTimeType === '四週' ? 'selected' : ''}>四週變形工時</option>
                        <option value="兩週" ${this.settings.flexTimeType === '兩週' ? 'selected' : ''}>兩週變形工時</option>
                        <option value="無" ${this.settings.flexTimeType === '無' ? 'selected' : ''}>一般規定</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">最大連續工作天數</label>
                    <input type="number" class="form-control" id="maxConsecutiveDays" value="${this.settings.maxConsecutiveDays}">
                </div>
                <button type="submit" class="btn btn-primary">儲存設定</button>
            </form>
        `;

        this.container.querySelector('#labor-law-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.save();
        });
    },

    async save() {
        const data = {
            flexTimeType: document.getElementById('flexTimeType').value,
            maxConsecutiveDays: parseInt(document.getElementById('maxConsecutiveDays').value)
        };
        
        try {
            Loading.show('儲存中...');
            await SettingsService.saveLaborLawSettings(data);
            Notification.success('設定已儲存');
        } catch (error) {
            Notification.error('儲存失敗');
        } finally {
            Loading.hide();
        }
    }
};
