/**
 * js/modules/schedule/ai-schedule.js
 * AI 排班前端介面 - 完整版
 * Week 6 功能
 */

import { Modal } from '../../components/modal.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { AIEngine } from '../ai-engine/ai-engine.js';
import { PriorityEngine } from '../ai-engine/priority-engine.js';
import { ConflictResolver } from '../ai-engine/conflict-resolver.js';
import { ScheduleService } from '../../services/schedule.service.js';

export const AISchedule = {
    aiEngine: null,
    priorityEngine: null,
    conflictResolver: null,
    currentMonth: null,
    currentSchedule: null,
    
    /**
     * 開啟 AI 排班介面
     */
    async open(month, partialSchedule = null) {
        try {
            this.currentMonth = month;
            this.currentSchedule = partialSchedule;

            // 初始化 AI 引擎
            if (!this.aiEngine) {
                this.aiEngine = new AIEngine();
                this.priorityEngine = new PriorityEngine();
                this.conflictResolver = new ConflictResolver();
            }

            await this.aiEngine.init(month);
            await this.priorityEngine.init();
            await this.conflictResolver.init();

            // 顯示設定對話框
            this.showConfigDialog();

        } catch (error) {
            console.error('開啟 AI 排班失敗:', error);
            Notification.error('開啟 AI 排班失敗：' + error.message);
        }
    },

    /**
     * 顯示設定對話框
     */
    showConfigDialog() {
        const strategies = this.priorityEngine.getStrategies();
        const priorities = this.priorityEngine.getPriorities();

        Modal.show({
            title: '🤖 AI 自動排班設定',
            size: 'large',
            content: `
                <div class="ai-schedule-config">
                    <!-- 策略選擇 -->
                    <div class="config-section">
                        <h5>
                            <i class="icon-target"></i> 排班策略
                        </h5>
                        <div class="strategy-selector">
                            ${this.renderStrategyOptions(strategies)}
                        </div>
                    </div>

                    <!-- 優先順序設定 -->
                    <div class="config-section">
                        <h5>
                            <i class="icon-list"></i> 優先順序設定
                            <small class="text-muted">（可拖曳調整順序）</small>
                        </h5>
                        <div class="priority-list" id="priorityList">
                            ${this.renderPriorityList(priorities)}
                        </div>
                    </div>

                    <!-- 進階選項 -->
                    <div class="config-section">
                        <h5>
                            <i class="icon-settings"></i> 進階選項
                        </h5>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="usePreSchedule" checked>
                                使用預班資料（強制遵守）
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="checkRules" checked>
                                執行規則檢查
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                最大重試次數
                                <input type="number" id="maxRetries" value="3" min="1" max="10" class="form-control" style="width: 80px; display: inline-block;">
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="usePartialSchedule" ${this.currentSchedule ? 'checked' : ''}>
                                保留已排班資料（混合模式）
                            </label>
                        </div>
                    </div>

                    <!-- 統計資訊 -->
                    <div class="config-section bg-light">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">排班月份</div>
                                <div class="info-value">${this.formatMonth(this.currentMonth)}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">天數</div>
                                <div class="info-value">${ScheduleService.getDaysInMonth(this.currentMonth)} 天</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">已排班</div>
                                <div class="info-value" id="scheduledCount">
                                    ${this.currentSchedule ? this.countScheduled(this.currentSchedule) : 0}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: '取消',
                    className: 'btn-secondary',
                    onClick: () => Modal.close()
                },
                {
                    text: '開始 AI 排班',
                    className: 'btn-primary',
                    onClick: () => this.startScheduling()
                }
            ]
        });

        // 綁定事件
        this.bindConfigEvents();
    },

    /**
     * 渲染策略選項
     */
    renderStrategyOptions(strategies) {
        return Object.keys(strategies).map(key => {
            const strategy = strategies[key];
            return `
                <div class="strategy-option">
                    <input type="radio" 
                           name="strategy" 
                           id="strategy_${key}" 
                           value="${key}"
                           ${key === 'balanced' ? 'checked' : ''}>
                    <label for="strategy_${key}">
                        <div class="strategy-name">${strategy.name}</div>
                        <div class="strategy-desc">${strategy.description}</div>
                    </label>
                </div>
            `;
        }).join('');
    },

    /**
     * 渲染優先順序列表
     */
    renderPriorityList(priorities) {
        return Object.values(priorities)
            .sort((a, b) => a.weight - b.weight)
            .map((priority, index) => `
                <div class="priority-item ${priority.mandatory ? 'mandatory' : ''}" 
                     data-key="${priority.key}"
                     draggable="${!priority.mandatory}">
                    <div class="priority-handle">
                        ${priority.mandatory ? '🔒' : '☰'}
                    </div>
                    <div class="priority-info">
                        <div class="priority-name">
                            ${index + 1}. ${priority.name}
                            ${priority.mandatory ? '<span class="badge">必須</span>' : ''}
                        </div>
                        <div class="priority-desc">${priority.description}</div>
                    </div>
                    <div class="priority-weight">
                        ${!priority.mandatory ? `
                            <input type="range" 
                                   min="0" 
                                   max="100" 
                                   value="${priority.weight * 100}"
                                   data-key="${priority.key}"
                                   class="weight-slider">
                            <span class="weight-value">${(priority.weight * 100).toFixed(0)}%</span>
                        ` : ''}
                    </div>
                </div>
            `).join('');
    },

    /**
     * 綁定設定事件
     */
    bindConfigEvents() {
        // 策略切換
        document.querySelectorAll('input[name="strategy"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateStrategyDisplay();
            });
        });

        // 權重調整
        document.querySelectorAll('.weight-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const key = e.target.dataset.key;
                const value = e.target.value;
                
                // 更新顯示
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan) {
                    valueSpan.textContent = value + '%';
                }

                // 更新引擎
                this.priorityEngine.updatePriority(key, value / 100);
            });
        });

        // 拖曳排序（簡化版）
        this.initDragAndDrop();
    },

    /**
     * 初始化拖曳排序
     */
    initDragAndDrop() {
        const container = document.getElementById('priorityList');
        if (!container) return;

        let draggedElement = null;

        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('mandatory')) {
                e.preventDefault();
                return;
            }
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        });

        container.addEventListener('dragend', (e) => {
            e.target.style.opacity = '1';
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!draggedElement) return;
            
            const target = e.target.closest('.priority-item');
            if (target && target !== draggedElement && !target.classList.contains('mandatory')) {
                const allItems = [...container.children];
                const draggedIndex = allItems.indexOf(draggedElement);
                const targetIndex = allItems.indexOf(target);

                if (draggedIndex < targetIndex) {
                    target.after(draggedElement);
                } else {
                    target.before(draggedElement);
                }
            }
        });
    },

    /**
     * 更新策略顯示
     */
    updateStrategyDisplay() {
        const selectedStrategy = document.querySelector('input[name="strategy"]:checked')?.value;
        
        if (selectedStrategy === 'custom') {
            // 自訂模式：所有權重可調整
            document.querySelectorAll('.weight-slider').forEach(slider => {
                slider.disabled = false;
            });
        }
    },

    /**
     * 開始排班
     */
    async startScheduling() {
        try {
            // 收集設定
            const config = this.collectConfig();

            // 關閉設定對話框
            Modal.close();

            // 顯示進度對話框
            this.showProgressDialog();

            // 執行 AI 排班
            const result = await this.aiEngine.runScheduling(config);

            // 隱藏進度對話框
            Modal.close();

            if (result && result.success) {
                // 顯示結果
                this.showResultDialog(result);
            } else {
                Notification.error('AI 排班失敗，請檢查設定或手動調整');
            }

        } catch (error) {
            Modal.close();
            console.error('AI 排班錯誤:', error);
            Notification.error('AI 排班發生錯誤：' + error.message);
        }
    },

    /**
     * 收集設定
     */
    collectConfig() {
        return {
            strategy: document.querySelector('input[name="strategy"]:checked')?.value || 'balanced',
            usePreSchedule: document.getElementById('usePreSchedule')?.checked ?? true,
            checkRules: document.getElementById('checkRules')?.checked ?? true,
            maxRetries: parseInt(document.getElementById('maxRetries')?.value || '3'),
            partialSchedule: document.getElementById('usePartialSchedule')?.checked 
                ? this.currentSchedule 
                : null
        };
    },

    /**
     * 顯示進度對話框
     */
    showProgressDialog() {
        Modal.show({
            title: '🤖 AI 排班進行中',
            content: `
                <div class="ai-progress">
                    <div class="progress-animation">
                        <div class="spinner-border text-primary" role="status">
                            <span class="sr-only">排班中...</span>
                        </div>
                    </div>
                    <div class="progress-text" id="progressText">
                        正在初始化 AI 引擎...
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBar" style="width: 0%"></div>
                    </div>
                    <div class="progress-details" id="progressDetails">
                        <small class="text-muted">請稍候，這可能需要幾秒鐘...</small>
                    </div>
                </div>
            `,
            buttons: [],
            closeButton: false
        });

        // 模擬進度更新（實際應由 AI 引擎回報）
        this.simulateProgress();
    },

    /**
     * 模擬進度更新
     */
    simulateProgress() {
        const steps = [
            { progress: 10, text: '載入預班資料...' },
            { progress: 25, text: '分析排班規則...' },
            { progress: 40, text: '計算優先順序...' },
            { progress: 60, text: '執行排班演算法...' },
            { progress: 80, text: '檢查衝突...' },
            { progress: 95, text: '最後調整...' }
        ];

        let currentStep = 0;

        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                const step = steps[currentStep];
                this.updateProgress(step.progress, step.text);
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, 800);
    },

    /**
     * 更新進度
     */
    updateProgress(progress, text) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');

        if (progressBar) {
            progressBar.style.width = progress + '%';
        }

        if (progressText) {
            progressText.textContent = text;
        }
    },

    /**
     * 顯示結果對話框
     */
    showResultDialog(result) {
        const { scheduleData, violations, report, statistics } = result;

        const hasErrors = violations?.errors?.length > 0;
        const hasWarnings = violations?.warnings?.length > 0;

        Modal.show({
            title: '✅ AI 排班完成',
            size: 'large',
            content: `
                <div class="ai-result">
                    <!-- 摘要 -->
                    <div class="result-summary ${hasErrors ? 'has-errors' : hasWarnings ? 'has-warnings' : 'success'}">
                        <div class="summary-icon">
                            ${hasErrors ? '⚠️' : hasWarnings ? '⚠️' : '✅'}
                        </div>
                        <div class="summary-text">
                            ${hasErrors ? '排班完成，但發現嚴重錯誤，請調整後再公告' :
                              hasWarnings ? '排班完成，發現部分警告，建議檢視後再公告' :
                              '排班完成且無違規項目，可以直接公告！'}
                        </div>
                    </div>

                    <!-- 統計資訊 -->
                    <div class="result-stats">
                        <div class="stat-card">
                            <div class="stat-label">已排班</div>
                            <div class="stat-value">${report.summary.scheduledCells}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">未排班</div>
                            <div class="stat-value ${report.summary.emptyCell > 0 ? 'warning' : ''}">
                                ${report.summary.emptyCell}
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">預班符合率</div>
                            <div class="stat-value">${report.compliance.preScheduleMatch}%</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">規則符合率</div>
                            <div class="stat-value">${report.compliance.ruleCompliance}%</div>
                        </div>
                    </div>

                    <!-- 違規項目 -->
                    ${hasErrors || hasWarnings ? `
                        <div class="violations-section">
                            <h5>違規項目</h5>
                            ${this.renderViolations(violations)}
                        </div>
                    ` : ''}

                    <!-- 詳細統計 -->
                    <div class="detailed-stats">
                        <details>
                            <summary>查看詳細統計</summary>
                            <div class="stats-detail">
                                ${this.renderDetailedStats(statistics)}
                            </div>
                        </details>
                    </div>
                </div>
            `,
            buttons: [
                {
                    text: '放棄結果',
                    className: 'btn-secondary',
                    onClick: () => {
                        if (confirm('確定要放棄此次 AI 排班結果？')) {
                            Modal.close();
                        }
                    }
                },
                {
                    text: hasErrors ? '檢視並調整' : '套用結果',
                    className: hasErrors ? 'btn-warning' : 'btn-primary',
                    onClick: () => {
                        this.applyResult(scheduleData);
                    }
                }
            ]
        });
    },

    /**
     * 渲染違規項目
     */
    renderViolations(violations) {
        if (!violations) return '';

        const { errors = [], warnings = [] } = violations;
        
        let html = '';

        if (errors.length > 0) {
            html += `
                <div class="violation-group error">
                    <h6>❌ 錯誤 (${errors.length})</h6>
                    <ul>
                        ${errors.slice(0, 5).map(v => `<li>${v.message}</li>`).join('')}
                        ${errors.length > 5 ? `<li class="more">...還有 ${errors.length - 5} 項</li>` : ''}
                    </ul>
                </div>
            `;
        }

        if (warnings.length > 0) {
            html += `
                <div class="violation-group warning">
                    <h6>⚠️ 警告 (${warnings.length})</h6>
                    <ul>
                        ${warnings.slice(0, 5).map(v => `<li>${v.message}</li>`).join('')}
                        ${warnings.length > 5 ? `<li class="more">...還有 ${warnings.length - 5} 項</li>` : ''}
                    </ul>
                </div>
            `;
        }

        return html;
    },

    /**
     * 渲染詳細統計
     */
    renderDetailedStats(statistics) {
        if (!statistics) return '暫無統計資料';

        return `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">總員工數</div>
                    <div class="stat-value">${statistics.totalStaff}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">總天數</div>
                    <div class="stat-value">${statistics.totalDays}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">總排班格數</div>
                    <div class="stat-value">${statistics.scheduledCells}</div>
                </div>
            </div>
        `;
    },

    /**
     * 套用結果
     */
    applyResult(scheduleData) {
        try {
            // 觸發自訂事件，讓排班主模組接收結果
            const event = new CustomEvent('ai-schedule-complete', {
                detail: { scheduleData }
            });
            document.dispatchEvent(event);

            Modal.close();
            Notification.success('AI 排班結果已套用，請檢視後公告');

        } catch (error) {
            console.error('套用結果失敗:', error);
            Notification.error('套用結果失敗：' + error.message);
        }
    },

    /**
     * 輔助方法
     */
    formatMonth(month) {
        if (!month) return '';
        const year = month.substring(0, 4);
        const monthNum = month.substring(4, 6);
        return `${year}年${monthNum}月`;
    },

    countScheduled(schedule) {
        if (!schedule) return 0;
        
        let count = 0;
        Object.values(schedule).forEach(staffSchedule => {
            Object.values(staffSchedule).forEach(shift => {
                if (shift && shift !== '') count++;
            });
        });
        return count;
    }
};