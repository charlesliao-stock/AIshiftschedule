// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 1000,   // 基礎缺人分
    OVER_STAFFED: -20000, // 嚴重超編
    
    PREF_P1: 1000,       
    PREF_P2: 600,        
    PREF_NO: -9999,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 200,

    // 基礎公平分 (會隨天數加倍)
    FAIRNESS_BASE: 2000 
};

// 輔助：計算該員目前已放假天數 (包含 Day 0 以前不算，只算本月)
const getCurrentOffDays = (uid, context, currentDay) => {
    let offCount = 0;
    // 遍歷本月已排的每一天
    for (let d = 1; d < currentDay; d++) {
        const s = context.assignments[uid][d];
        if (s === 'OFF' || s === 'M_OFF') offCount++;
    }
    return offCount;
};

// 🔥 核心：公平性分數計算 (適用於所有策略)
const calculateFairnessScore = (uid, day, context) => {
    // 1. 計算「累積至今天，理應放幾天假」
    // 公式：(全月標準放假 / 全月天數) * 目前天數
    const totalIdealOff = context.idealOffDays || 8; 
    const progress = day / context.daysInMonth;
    const expectedOffSoFar = totalIdealOff * progress;

    // 2. 計算「實際已放幾天假」
    const actualOff = getCurrentOffDays(uid, context, day);

    // 3. 計算差距 (實際 - 應放)
    // 正值：放太爽了 (欠班) -> 應該加分讓他上班
    // 負值：太操了 (欠假) -> 應該扣分讓他休息
    const diff = actualOff - expectedOffSoFar;

    // 4. 每 5 天加重一次權重 (Step Function)
    // Day 1-4: x1, Day 5-9: x2, Day 10-14: x3 ... Day 25+: x6
    const multiplier = Math.floor(day / 5) + 1;
    
    // 總分 = 差距 * 基礎分 * 倍率
    return diff * WEIGHTS.FAIRNESS_BASE * multiplier;
};

// 策略 A：數值平衡
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 2. ✅ 公平性追趕 (針對上班班別)
        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
        }

        // 3. 基礎偏好
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 100;

        return score;
    }
}

// 策略 B：願望優先
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

        // 3. ✅ 公平性追趕 (即便是願望優先，也不能放假放太多)
        if (shift !== 'OFF') {
            // 係數稍微調低一點點，保留願望的優先權
            score += calculateFairnessScore(uid, day, context) * 0.8;
        }

        return score;
    }
}

// 策略 C：規律作息
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
        
        if (shift === 'OFF') {
            const p1Working = prev1 !== 'OFF' && prev1 !== 'M_OFF';
            if (p1Working && prev1 === prev2) score += WEIGHTS.TWO_DAY_BLOCK_BONUS;
        }

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 3. ✅ 公平性追趕
        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
        }

        return score;
    }
}
