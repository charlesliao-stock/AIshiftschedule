// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 2000,   // 提高缺人權重 (確保有人上班)
    OVER_STAFFED: -20000, // 嚴重超編 (除非包班否則不排)
    
    PREF_P1: 1000,        // 志願權重
    PREF_P2: 600,        
    PREF_NO: -9999,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 300,

    // 公平性基礎分數 (會被雙軌權重放大)
    FAIRNESS_BASE: 5000 
};

// 輔助：計算該員目前的總班數 (長期)
const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
};

// 輔助：計算全體人員目前的長期平均班數
const getCohortAverageLong = (context) => {
    let totalAll = 0;
    if (context.staffList.length === 0) return 0;
    context.staffList.forEach(s => {
        totalAll += getCurrentTotalShifts(s.uid, context.stats);
    });
    return totalAll / context.staffList.length;
};

// 輔助：計算該員過去 N 天的班數 (短期)
const getShortTermWorkCount = (uid, day, context, n = 3) => {
    let count = 0;
    // 檢查 day-1, day-2, ... day-n
    for (let d = day - 1; d >= day - n; d--) {
        // AutoScheduler 有準備 day 0 和 day -1 的歷史資料
        const shift = context.assignments[uid][d];
        if (shift && shift !== 'OFF' && shift !== 'M_OFF') {
            count++;
        }
    }
    return count;
};

// 輔助：計算全體人員的短期平均班數
const getCohortAverageShort = (day, context, n = 3) => {
    let total = 0;
    if (context.staffList.length === 0) return 0;
    context.staffList.forEach(s => {
        total += getShortTermWorkCount(s.uid, day, context, n);
    });
    return total / context.staffList.length;
};

// 策略 A：數值平衡 (Statistical Balance) - 採用雙軌制
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (絕對優先)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 2. ✅ 雙軌制公平性演算法 (Dual-Track Fairness)
        if (shift !== 'OFF') {
            // A. 定義權重 (隨日期動態變化)
            let longTermWeight = 0.6; // 前期：長期佔 60%
            let shortTermWeight = 0.4; // 前期：短期佔 40%

            if (day > 20) {
                // 後期 (21號後)：強力收斂總數
                longTermWeight = 0.9;
                shortTermWeight = 0.1;
            } else if (day > 10) {
                // 中期 (11-20號)：逐漸加重長期
                longTermWeight = 0.75;
                shortTermWeight = 0.25;
            }

            // B. 計算短期分數 (防止連續太累)
            const myShort = getShortTermWorkCount(uid, day, context, 3);
            const avgShort = getCohortAverageShort(day, context, 3);
            // 差距越大 (平均 > 我)，分數越高 -> 優先補班
            const diffShort = avgShort - myShort; 
            const shortScore = diffShort * shortTermWeight * WEIGHTS.FAIRNESS_BASE;

            // C. 計算長期分數 (確保月底放假天數一致)
            const myLong = getCurrentTotalShifts(uid, context.stats);
            const avgLong = getCohortAverageLong(context);
            // 差距越大 (平均 > 我)，分數越高 -> 優先補班
            const diffLong = avgLong - myLong;
            const longScore = diffLong * longTermWeight * WEIGHTS.FAIRNESS_BASE;

            // D. 總合
            score += (shortScore + longScore);
        }

        // 3. 基礎偏好
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 100;

        return score;
    }
}

// 策略 B：願望優先 (Wish Granter)
export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prefs = context.preferences[uid] || {};
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 滿足願望
        if (prefs.p1 === shift) score += WEIGHTS.PREF_P1;
        else if (prefs.p2 === shift) score += WEIGHTS.PREF_P2;

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 3. ✅ 引入輕量版雙軌制 (確保願望優先的同時，不要太失衡)
        if (shift !== 'OFF') {
            // 願望模式下，我們只看長期總數，且權重較低
            const myLong = getCurrentTotalShifts(uid, context.stats);
            const avgLong = getCohortAverageLong(context);
            
            // 後期 (20號後) 加強收斂
            const fairnessWeight = (day > 20) ? 4000 : 1000; 
            
            const diff = avgLong - myLong;
            score += diff * fairnessWeight; 
        }

        return score;
    }
}

// 策略 C：規律作息 (Rhythm Keeper)
export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev1 = context.assignments[uid][day-1] || 'OFF';
        const prev2 = context.assignments[uid][day-2] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性
        if (shift === prev1 && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev1 && prev1 !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;
        
        // 2. 規律獎勵 (XX O)
        if (shift === 'OFF') {
            const p1Working = prev1 !== 'OFF' && prev1 !== 'M_OFF';
            if (p1Working && prev1 === prev2) score += WEIGHTS.TWO_DAY_BLOCK_BONUS;
        }

        // 3. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 4. ✅ 雙軌制 (同方案 A，但係數稍微調低以保留規律性)
        if (shift !== 'OFF') {
            let longTermWeight = 0.6;
            if (day > 20) longTermWeight = 0.9;
            else if (day > 10) longTermWeight = 0.75;

            const myLong = getCurrentTotalShifts(uid, context.stats);
            const avgLong = getCohortAverageLong(context);
            const diffLong = avgLong - myLong;
            
            // 規律模式下，公平性權重設為 4000 (比平衡模式 5000 稍低)
            score += diffLong * longTermWeight * 4000;
        }

        return score;
    }
}
