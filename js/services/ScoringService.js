import { AI_SCORING_CONFIG } from "../config/AI_SCORING_CONFIG.js";

export class ScoringService {
    
    /**
     * 1. 定義預設評分設定 (現在從 AI_SCORING_CONFIG 讀取)
     */
    static getDefaultConfig() {
        return AI_SCORING_CONFIG.SCORING_CATEGORIES;
    }

    /**
     * 2. 計算入口
     */
    static calculate(schedule, staffList, unitSettings, preSchedule) {
        if (!schedule || !schedule.assignments) return { totalScore: 0, details: {} };

        const assignments = schedule.assignments;
        const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
        
        // 使用 unitSettings 中的 strategyWeights，如果沒有則使用預設配置 A
        const strategyWeights = unitSettings.strategyWeights || AI_SCORING_CONFIG.STRATEGY_WEIGHTS.A;
        
        // 評分項目配置 (使用預設配置，因為 RuleSettings 已經處理了儲存)
        const config = this.getDefaultConfig();
        
        // 1. 計算所有原始指標 (metrics)
        const metrics = this.calculateMetrics(assignments, staffList, daysInMonth, unitSettings, preSchedule, strategyWeights);

        let totalScore = 0;
        let totalMax = 0;
        const details = {};

        // 2. 轉換分數
        Object.keys(config).forEach(catKey => {
            const catConfig = config[catKey];
            const subItems = [];
            let catMax = catConfig.max; // 使用配置中的 max
            let catScoreSum = 0;

            catConfig.items.forEach(item => {
                const rawValue = metrics[item.key] || 0;
                
                // 這裡不再使用階梯式評分，而是直接使用策略權重來計算分數
                // 策略權重 (strategyWeights) 決定了 AI 排班時的傾向
                // 這裡的評分 (ScoringService) 決定了排班結果的最終分數
                
                // 評分邏輯：
                // 1. 效率/滿意度 (越高越好)：分數 = rawValue * item.weight
                // 2. 疲勞/懲罰 (越低越好)：分數 = (1 - rawValue) * item.weight
                
                let itemScore = 0;
                let displayValue = rawValue;

                switch (item.key) {
                    case 'coverage': // 覆蓋率 (0-1)
                    case 'wish': // 預班達成率 (0-1)
                    case 'pref': // 偏好滿足度 (0-1)
                        itemScore = rawValue * item.weight;
                        displayValue = (rawValue * 100).toFixed(1) + '%';
                        break;
                    case 'overwork': // 標準差 (越低越好)
                    case 'shiftBalance': // 標準差 (越低越好)
                        // 假設標準差越低，分數越高。這裡需要一個轉換函數，例如 1 - (rawValue / MaxStdDev)
                        // 暫時使用簡化邏輯：分數 = item.weight * (1 - rawValue / 10)
                        itemScore = item.weight * Math.max(0, 1 - (rawValue / 5)); // 假設最大標準差為 5
                        displayValue = rawValue.toFixed(2);
                        break;
                    case 'cons': // 連續工作懲罰 (次數，越低越好)
                    case 'nToD': // 夜班接白班懲罰 (次數，越低越好)
                        // 假設懲罰次數為 0 時得滿分，每多一次扣分
                        // 這裡需要知道總懲罰次數的上限，暫時假設總分 = item.weight - (rawValue * 2)
                        itemScore = Math.max(0, item.weight - (rawValue * 2));
                        displayValue = rawValue;
                        break;
                    case 'cost': // 成本 (暫時為 0)
                        itemScore = 0;
                        displayValue = 0;
                        break;
                    default:
                        itemScore = 0;
                        break;
                }

                catScoreSum += itemScore;

                subItems.push({
                    name: item.label,
                    value: displayValue,
                    score: Math.round(itemScore),
                    grade: Math.round(itemScore) + '分', 
                    desc: item.desc
                });
            });

            details[catKey] = { 
                label: catConfig.label,
                score: Math.round(catScoreSum),
                max: catMax,
                subItems: subItems,
                rawScore: catMax > 0 ? (catScoreSum / catMax * 100) : 0
            };

            totalScore += catScoreSum;
            totalMax += catMax;
        });

        const finalScore = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

        return {
            totalScore: Math.round(finalScore),
            totalMax: totalMax,
            passed: finalScore >= 60,
            details: details
        };
    }

    // ==========================================
    //  3. 計算所有原始指標 (Metrics Calculation)
    // ==========================================
    static calculateMetrics(assignments, staffList, daysInMonth, unitSettings, preSchedule, strategyWeights) {
        const metrics = {};
        const req = unitSettings?.staffRequirements || {};
        
        const unitShifts = unitSettings?.settings?.shifts || [];
        const shiftCodes = unitShifts.length > 0 ? unitShifts.map(s => s.code) : ['D','E','N'];
        
        const hoursMap = {};
        unitShifts.forEach(s => {
            hoursMap[s.code] = parseFloat(s.hours) || 0;
        });

        const submissions = preSchedule?.submissions || {};
        
        // --- 變數初始化 ---
        let totalShiftsFilled = 0;
        let totalShiftsNeeded = 0;
        let totalPref = 0, metPref = 0; 
        let consWorkViolations = 0; 
        let nToDCount = 0; 

        // --- A. 每日掃描 (效率) ---
        for (let d = 1; d <= daysInMonth; d++) {
            const dayOfWeek = new Date(unitSettings.year, unitSettings.month - 1, d).getDay(); 
            
            shiftCodes.forEach(s => {
                totalShiftsNeeded += (req[s]?.[dayOfWeek] || 0);
            });
            
            Object.keys(assignments).forEach(uid => {
                const shift = assignments[uid][d];
                if (shift && shift !== 'OFF' && shift !== 'M_OFF') {
                    totalShiftsFilled++;
                }
            });
        }

        // --- B. 個人掃描 (公平、滿意、規律作息) ---
        const staffStats = [];
        
        staffList.forEach(staff => {
            const uid = staff.uid;
            const row = assignments[uid] || {};
            const wishes = submissions[uid]?.wishes || {};
            const prefs = submissions[uid]?.preferences || {};
            
            let hours = 0, off = 0;
            let cons = 0;
            // 修正: 確保 assignments[uid] 存在且包含 [0] 屬性
            let prev = (assignments[uid] && assignments[uid][0]) ? assignments[uid][0] : 'OFF';

            for (let d = 1; d <= daysInMonth; d++) {
                const shift = row[d] || 'OFF';
                const isWork = shift !== 'OFF' && shift !== 'M_OFF';

                if (isWork) {
                    const h = hoursMap[shift] !== undefined ? hoursMap[shift] : 0;
                    hours += h;
                    cons++;
                } else {
                    cons = 0;
                    off++;
                }

                if (cons > 6) consWorkViolations++; 
                if (prev === 'N' && shift === 'D') nToDCount++;
                
                // 偏好滿足度 (P1/P2/P3 的滿足度)
                const prefShifts = [prefs.priority1, prefs.priority2, prefs.priority3].filter(p => p);
                if (prefShifts.length > 0) {
                    totalPref++;
                    if (prefShifts.includes(shift)) metPref++;
                }
                
                prev = shift;
            }

            staffStats.push({ uid, hours, off });
        });

        // --- C. 計算最終指標 ---
        
        // 1. 公平性
        const hoursArr = staffStats.map(s => s.hours);
        const offArr = staffStats.map(s => s.off);

        metrics.overwork = this.calcStdDev(hoursArr); // 超額上班平衡 (工時標準差)
        metrics.shiftBalance = this.calcStdDev(offArr); // 班別種類平衡 (休假天數標準差)

        // 2. 滿意度
        metrics.wish = 1; // 預班達成率 (暫時設為 1，因為預班是硬性約束)
        metrics.pref = totalPref === 0 ? 1 : (metPref / totalPref); // 偏好滿足率 (0-1)

        // 3. 規律作息
        metrics.cons = consWorkViolations; // 連續工作懲罰 (次數)
        metrics.nToD = nToDCount; // 夜班接白班懲罰 (次數)
        
        // 4. 效率
        metrics.coverage = totalShiftsNeeded === 0 ? 1 : (totalShiftsFilled / totalShiftsNeeded); // 人力覆蓋率 (0-1)
        
        // 5. 成本
        metrics.cost = 0; 

        return metrics;
    }

    // --- 輔助函式 ---
    static calcStdDev(arr) {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        return parseFloat(Math.sqrt(variance).toFixed(2));
    }

    static formatValue(key, val) {
        if (['coverage', 'pref', 'wish'].includes(key)) {
            return (val * 100).toFixed(1) + '%';
        }
        if (['overwork', 'shiftBalance'].includes(key)) {
            return val.toFixed(2);
        }
        return val;
    }
}
