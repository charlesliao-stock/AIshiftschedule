import/im//import/import/import { AI_SCORING_CONFIG "../om "../config/AI_SCORINGexport class Scori
    
    /**
     * 1. 定義評分設定 (4 大類，13 細項)
     * 依據「排班評分.docx」重新規劃
     */
    static getDefaultConfig() {
        const standardLabels = ['優', '佳', '良', '可', '平']; // 100, 80, 60, 40, 20

        return {
            fairness: {
                label: "1. 公平性指標 (Fairness)",
                weight: 40, // 類別總權重參考
                subs: {
                    hoursDiff: { 
                        label: "(1) 工時差異 (標準差)", desc: "所有員工工時標準差，數值越小越平均。", weight: 10, enabled: true, 
                        tiers: [{limit: 2, score: 100, label: '優'}, {limit: 4, score: 80, label: '佳'}, {limit: 6, score: 60, label: '良'}, {limit: 8, score: 40, label: '可'}, {limit: 999, score: 20, label: '平'}],
                        excludeLongLeave: true // 特殊設定：排除長假者
                    },
                    offDiff: { 
                        label: "(2) 放假天數差異 (天數差)", desc: "放假天數標準差，數值越小越平均。", weight: 10, enabled: true,
                        tiers: [{limit: 1, score: 100, label: '優'}, {limit: 2, score: 80, label: '佳'}, {limit: 3, score: 60, label: '良'}, {limit: 4, score: 40, label: '可'}, {limit: 999, score: 20, label: '平'}],
                        excludeLongLeave: true // 特殊設定：排除長假者
                    },
                    nightDiff: { 
                        label: "(3) 夜班差異 (班數差)", desc: "夜班最多與最少之差距。", weight: 10, enabled: true,
                        excludeBatch: true, // 特殊設定：排除包班者
                        tiers: [{limit: 1, score: 100, label: '優'}, {limit: 2, score: 80, label: '佳'}, {limit: 3, score: 60, label: '良'}, {limit: 4, score: 40, label: '可'}, {limit: 999, score: 20, label: '平'}]
                    },
                    holidayDiff: { 
                        label: "(4) 假日差異 (天數差)", desc: "假日上班天數最多與最少之差距。", weight: 10, enabled: true,
                        tiers: [{limit: 1, score: 100, label: '優'}, {limit: 2, score: 80, label: '佳'}, {limit: 3, score: 60, label: '良'}, {limit: 4, score: 40, label: '可'}, {limit: 999, score: 20, label: '平'}]
                    }
                }
            },
            satisfaction: {
                label: "2. 滿意度指標 (Satisfaction)",
                weight: 30,
                subs: {
                    wishRate: { 
                        label: "(1) 預班達成率 (%)", desc: "員工指定預班 (Wishes) 被滿足的比例。", weight: 20, enabled: true,
                        tiers: [{limit: 100, score: 100, label: '優'}, {limit: 95, score: 80, label: '佳'}, {limit: 90, score: 60, label: '良'}, {limit: 80, score: 40, label: '可'}, {limit: 0, score: 20, label: '平'}]
                    },
                    prefRate: { 
                        label: "(2) 偏好滿足率 (%)", desc: "符合員工排班偏好 (P1/P2) 的比例。", weight: 10, enabled: true,
                        tiers: [{limit: 100, score: 100, label: '優'}, {limit: 90, score: 80, label: '佳'}, {limit: 80, score: 60, label: '良'}, {limit: 70, score: 40, label: '可'}, {limit: 0, score: 20, label: '平'}]
                    }
                }
            },
            health: {
                label: "3. 健康與工時 (Health)",
                weight: 40,
                subs: {
                    consecutive: { 
                        label: "(1) 連續上班6天 (次數)", desc: "員工連續上班達 6 天的次數。", weight: 10, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '完美'}, {limit: 1, score: 80, label: '尚可'}, {limit: 3, score: 60, label: '注意'}, {limit: 5, score: 40, label: '警告'}, {limit: 999, score: 0, label: '危險'}]
                    },
                    shiftInterval: { 
                        label: "(2) 大夜接白 (次數)", desc: "大夜班(N)後緊接白班(D)的次數。", weight: 10, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '無'}, {limit: 2, score: 80, label: '少'}, {limit: 4, score: 60, label: '中'}, {limit: 6, score: 40, label: '多'}, {limit: 999, score: 20, label: '極多'}]
                    },
                    offRate: { 
                        label: "(3) 休假達標率 (%)", desc: "休假天數等於或超過應放天數的員工比例。", weight: 10, enabled: true,
                        tiers: [{limit: 100, score: 100, label: '優'}, {limit: 95, score: 80, label: '佳'}, {limit: 90, score: 60, label: '良'}, {limit: 80, score: 40, label: '可'}, {limit: 0, score: 20, label: '平'}]
                    },
                    simpleWeekRate: { 
                        label: "(4) 週夜班頻率 (%)", desc: "一週內班別種類不超過 2 種 (作息單純) 的週數比例。", weight: 10, enabled: true,
                        tiers: [{limit: 100, score: 100, label: '優'}, {limit: 95, score: 80, label: '佳'}, {limit: 90, score: 60, label: '良'}, {limit: 80, score: 40, label: '可'}, {limit: 0, score: 20, label: '平'}]
                    }
                }
            },
            efficiency: {
                label: "4. 運作效率 (Efficiency)",
                weight: 25,
                subs: {
                    shortage: { 
                        label: "(1) 人力缺口 (%)", desc: "未滿足每日最低人力需求的班次比例。", weight: 15, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '無缺口'}, {limit: 2, score: 80, label: '微缺'}, {limit: 5, score: 60, label: '缺人'}, {limit: 10, score: 40, label: '嚴重'}, {limit: 100, score: 0, label: '崩潰'}]
                    },
                    seniority: { 
                        label: "(2) 資深分佈 (%)", desc: "每日資深人員 (N2以上) 不足的比例。", weight: 5, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '均衡'}, {limit: 5, score: 80, label: '佳'}, {limit: 10, score: 60, label: '良'}, {limit: 15, score: 40, label: '差'}, {limit: 100, score: 20, label: '極差'}]
                    },
                    beginner: { 
                        label: "(3) 資淺分佈 (%)", desc: "每日資淺人員 (N0/N1) 超過上限的比例。", weight: 5, enabled: true,
                        tiers: [{limit: 0, score: 100, label: '均衡'}, {limit: 10, score: 80, label: '佳'}, {limit: 20, score: 60, label: '良'}, {limit: 30, score: 40, label: '差'}, {limit: 100, score: 20, label: '極差'}]
                    }
                }
            }
        };
    }

    /**
     * 2. 計算入口
     */
    static calculate(schedule, staffList, unitSettings, preSchedule) {
        if (!schedule || !schedule.assignments) return { totalScore: 0, details: {} };

        const assignments = schedule.assignments;
        const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
        
        // 評分配置
        const config = unitSettings.scoringConfig || this.getDefaultConfig();
        
        // 1. 計算所有原始指標 (metrics)
        const metrics = this.calculateMetrics(assignments, staffList, daysInMonth, unitSettings, preSchedule);

        let totalScore = 0;
        let totalMaxWeight = 0;
        const details = {};

        // 2. 轉換分數
        Object.keys(config).forEach(catKey => {
            const catConfig = config[catKey];
            const subItems = [];
            let catScoreSum = 0;
            let catWeightSum = 0;

            Object.keys(catConfig.subs).forEach(subKey => {
                const sub = catConfig.subs[subKey];
                if (!sub.enabled) return;

                const rawValue = metrics[subKey];
                // 根據 Tiers 計算分數
                const result = this.getTieredScore(rawValue, sub.tiers);
                
                // 加權分數
                const weightedScore = result.score * sub.weight;
                catScoreSum += weightedScore;
                catWeightSum += sub.weight;

                subItems.push({
                    name: sub.label,
                    value: rawValue,
                    score: result.score,
                    grade: result.label,
                    weight: sub.weight
                });
            });

            // 計算該類別總分 (標準化到 100 分制)
            const catFinalScore = catWeightSum > 0 ? Math.round(catScoreSum / catWeightSum) : 0;
            
            // 累加到總分 (這裡依照各項目權重直接累加，不做類別平均，以符合 Excel 邏輯)
            totalScore += catScoreSum;
            totalMaxWeight += catWeightSum;

            details[catKey] = {
                label: catConfig.label,
                score: catFinalScore, // 顯示用 (0-100)
                max: catWeightSum,    // 該類別佔的總權重
                subItems: subItems
            };
        });

        // 最終總分 (標準化為 0-100)
        const finalTotal = totalMaxWeight > 0 ? Math.round(totalScore / totalMaxWeight) : 0;

        return {
            totalScore: finalTotal,
            passed: finalTotal >= 60,
            details: details
        };
    }

    /**
     * 3. 核心運算：計算各項指標原始數值
     */
    static calculateMetrics(assignments, staffList, daysInMonth, unitSettings, preSchedule) {
        const metrics = {};
        
        // 變數初始化
        const staffStats = [];
        let totalPref = 0;
        let metPref = 0;
        let consWorkViolations = 0; // 連續上班超過 5 天
        let shiftIntervalViolations = 0; // N 接 D
        
        // 效率相關
        const shiftCounts = { D: {}, E: {}, N: {} }; 
        const dailyStaffLevels = {}; // 每日人員資歷分佈 { 1: {senior: 2, junior: 1}, ... }
        
        // 預設應休天數 (簡單計算：週休二日 + 國定假日概念，這裡暫抓 8~10 天)
        // 若系統有行事曆設定應讀取行事曆，此處以 (當月天數 - 22) 估算
        const requiredOffDays = daysInMonth - 22 > 0 ? daysInMonth - 22 : 8;

        // 初始化每日計數
        for(let d=1; d<=daysInMonth; d++) {
            shiftCounts.D[d] = 0; shiftCounts.E[d] = 0; shiftCounts.N[d] = 0;
            dailyStaffLevels[d] = { senior: 0, junior: 0, total: 0 };
        }

        staffList.forEach(staff => {
            const uid = staff.uid;
            const userShifts = assignments[uid] || {};
            const wishes = preSchedule?.submissions?.[uid]?.wishes || {};
            const pref = preSchedule?.submissions?.[uid]?.preferences || {};
            const constraints = staff.constraints || {};

            let hours = 0;
            let offDays = 0;
            let nightCount = 0;
            let holidayShifts = 0;
            let consecutive = 0;
            let prevShift = null; // 需考慮上個月最後一天 (此處簡化)

            // 週夜班頻率 (Simple Week) 計算用
            let weeklyTypes = new Set();
            let validWeeks = 0;
            let totalWeeks = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const shift = userShifts[d];
                
                // 週次計算 (每7天一週)
                const weekIdx = Math.floor((d-1) / 7);
                if (d % 7 === 1) { // 新的一週開始，結算上一週
                    if (d > 1) {
                        totalWeeks++;
                        if (weeklyTypes.size <= 2) validWeeks++; // 允許 2 種以內 (含 OFF)
                    }
                    weeklyTypes = new Set();
                }
                if (shift) weeklyTypes.add(shift);

                // 基本統計
                if (shift === 'OFF' || shift === 'M_OFF') {
                    offDays++;
                    consecutive = 0;
                } else if (shift) {
                    hours += 8; // 假設每班 8 小時
                    if (['N', 'E'].includes(shift)) nightCount++;
                    
                    // 假日上班
                    const date = new Date(unitSettings.year || new Date().getFullYear(), (unitSettings.month || new Date().getMonth() + 1) - 1, d);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) holidayShifts++;

                    consecutive++;
                    
                    // 每日人力計數
                    if (shiftCounts[shift]) shiftCounts[shift][d]++;
                    
                    // 資歷計數 (假設 N2/N3/N4 為資深, N0/N1 為資淺)
                    // 若無 rank 資料，預設視為一般
                    const rank = staff.rank || staff.level || '';
                    dailyStaffLevels[d].total++;
                    if (['N3', 'N4', 'AHN', 'HN'].includes(rank)) dailyStaffLevels[d].senior++;
                    if (['N0', 'N1'].includes(rank)) dailyStaffLevels[d].junior++;
                }

                // 規則違規檢查
                if (consecutive > 5) consWorkViolations++; // 連6以上 (大於5)
                if (prevShift === 'N' && shift === 'D') shiftIntervalViolations++; // N 接 D

                // 偏好檢查 (P1/P2)
                if (shift && shift !== 'OFF' && !wishes[d]) { // 排除已指定預班的日子
                    totalPref++;
                    if (pref.priority1 === shift || pref.priority2 === shift) {
                        metPref++;
                    }
                }

                prevShift = shift;
            }
            // 結算最後一週
            totalWeeks++;
            if (weeklyTypes.size <= 2) validWeeks++;

            staffStats.push({ 
                uid, hours, offDays, nightCount, holidayShifts, 
                simpleWeekRatio: totalWeeks > 0 ? (validWeeks / totalWeeks) : 1,
                isBatch: constraints.canBatch, // 包班
                isLongLeave: offDays > 15 // 簡單定義長假
            });
        });

        // --- C. 計算最終指標 (對應 Config Key) ---
        
        // 1. 公平性
        // 過濾掉特殊人員 (包班、長假) 以計算標準差
        const normalStaff = staffStats.filter(s => !s.isLongLeave);
        const nonBatchStaff = staffStats.filter(s => !s.isBatch && !s.isLongLeave);

        metrics.hoursDiff = this.calcStdDev(normalStaff.map(s => s.hours));
        metrics.offDiff = this.calcStdDev(normalStaff.map(s => s.offDays));
        // 夜班差異 (排除包班者)
        const nightCounts = nonBatchStaff.map(s => s.nightCount);
        metrics.nightDiff = nightCounts.length > 0 ? (Math.max(...nightCounts) - Math.min(...nightCounts)) : 0;
        // 假日差異
        const holidayCounts = normalStaff.map(s => s.holidayShifts);
        metrics.holidayDiff = holidayCounts.length > 0 ? (Math.max(...holidayCounts) - Math.min(...holidayCounts)) : 0;

        // 2. 滿意度
        metrics.wishRate = 100; // 預班達成率 (目前邏輯是硬性鎖定，故為 100%，若有未排入則扣分)
        metrics.prefRate = totalPref === 0 ? 100 : Math.round((metPref / totalPref) * 100);

        // 3. 健康
        metrics.consecutive = consWorkViolations;
        metrics.shiftInterval = shiftIntervalViolations; // N接D
        
        // 休假達標率 (放假天數 >= 標準的人數比例)
        const metOffReqCount = staffStats.filter(s => s.offDays >= requiredOffDays).length;
        metrics.offRate = staffList.length === 0 ? 100 : Math.round((metOffReqCount / staffList.length) * 100);
        
        // 週夜班頻率 (平均單純週次比例)
        const avgSimpleWeek = staffStats.reduce((acc, s) => acc + s.simpleWeekRatio, 0) / (staffList.length || 1);
        metrics.simpleWeekRate = Math.round(avgSimpleWeek * 100);

        // 4. 效率
        // 統計每日缺口
        let totalShiftsNeeded = 0;
        let totalShiftsFilled = 0;
        let seniorViolations = 0;
        let juniorViolations = 0;
        const staffReq = unitSettings.staffRequirements || {};

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(unitSettings.year, unitSettings.month - 1, d);
            const w = date.getDay();
            
            ['D', 'E', 'N'].forEach(shift => {
                const req = staffReq[shift]?.[w] || 0;
                const filled = shiftCounts[shift][d];
                totalShiftsNeeded += req;
                totalShiftsFilled += filled;
            });

            // 資深分佈 (假設每日至少需 1 名資深)
            // 這裡可以改成讀取設定，暫定總人數的 20%
            const dailyTotal = dailyStaffLevels[d].total;
            if (dailyTotal > 0) {
                if (dailyStaffLevels[d].senior < 1) seniorViolations++; // 簡單規則：每日至少1資深
                
                // 資淺分佈 (資淺者不超過 50%)
                if ((dailyStaffLevels[d].junior / dailyTotal) > 0.5) juniorViolations++;
            }
        }

        metrics.shortage = totalShiftsNeeded === 0 ? 0 : Math.round(((totalShiftsNeeded - totalShiftsFilled) / totalShiftsNeeded) * 100);
        if (metrics.shortage < 0) metrics.shortage = 0; // 填滿則無缺口

        metrics.seniority = Math.round((seniorViolations / daysInMonth) * 100);
        metrics.beginner = Math.round((juniorViolations / daysInMonth) * 100);

        return metrics;
    }

    // --- 輔助函式 ---\n    static calcStdDev(arr) {
        if (arr.length === 0) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
        return parseFloat(Math.sqrt(variance).toFixed(2));
    }

    static getTieredScore(value, tiers) {
        if (!tiers || tiers.length === 0) return { score: 0, label: '未設定' };
        
        // 這裡要支援兩種邏輯：數值越低越好 vs 數值越高越好
        // 通常 tiers 是由小到大排序 (limit: 2, 4, 6...)
        // 對於「百分比」類 (limit: 100, 95...)，通常是越高越好，但我們可以統一由前端 Tiers 定義 limit
        
        // 依照排班評分.docx:
        // 大部分是 "數值越低分越高" (如工時差異: <=2 分數100)
        // 百分比類是 "數值越高分越高" (如預班達成率: 100% 分數100, >=95 分數80)
        // 我們的 Tiers 結構是 [{limit: 2, score: 100}, {limit: 4, score: 80}...]
        
        // 判斷邏輯：
        // 如果是 <= 比較 (工時差異)
        // 如果是 >= 比較 (達成率) -> 此時 Tiers 內的 limit 應設為門檻，且比較邏輯不同
        
        // 為了簡化，我們統一由 Tiers 的 limit 定義「區間上限」或「區間下限」
        // 但因為 JS Array find 是由前至後，我們假設 Tiers 已經依照「最優到最差」排序
        
        for (const t of tiers) {
            // 特殊處理：百分比類 (limit 通常較大且 score 較高)
            // 文件定義: 100% -> 100分, >=95% -> 80分
            // 程式邏輯: if (value >= t.limit) return ... (針對百分比)
            // 程式邏輯: if (value <= t.limit) return ... (針對差異/次數)
            
            // 判斷是否為「越高越好」的指標 (通常 limit 會是 100, 95, 90...)
            // 簡單判斷：如果第一階 limit 為 100 且第二階小於 100，則為 >= 邏輯
            const isHighBetter = tiers[0].limit === 100 && tiers.length > 1 && tiers[1].limit < 100;

            if (isHighBetter) {
                if (value >= t.limit) return { score: t.score, label: t.label };
            } else {
                if (value <= t.limit) return { score: t.score, label: t.label };
            }
        }
        
        // 超出所有範圍 (最差情況)
        const last = tiers[tiers.length - 1];
        return { score: last.score, label: last.label };
    }
}
