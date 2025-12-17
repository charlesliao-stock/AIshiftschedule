// js/ai/AIStrategies.js

// 權重常數定義 (依據您的描述調整)
const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          
    NEED_MISSING: 500,    // 缺人 (+500)
    OVER_STAFFED: -10000, // 超編 (極大扣分)
    
    // 員工偏好
    PREF_P1: 1000,        // Rank 1 (+1000)
    PREF_P2: 1000,        // Rank 2 (+1000) - 依單位設定，此處依描述設為 1000
    PREF_NO: -5000,       // 勿排 (-5000)
    
    // 平衡性
    BALANCE_OVER_AVG: -200, // 超過平均班數
    
    // 連續性
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50
};

// 輔助：計算該員目前的總班數
const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
};

// 策略 A：數值平衡 (Statistical Balance)
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

        // 2. 削峰填谷 (平衡班數)
        let totalAll = 0;
        Object.values(context.stats).forEach(s => totalAll += (s.D+s.E+s.N));
        const avg = totalAll / context.staffList.length;
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF') {
            if (myTotal > avg + 1) score += WEIGHTS.BALANCE_OVER_AVG;
            else if (myTotal < avg - 1) score += 200;
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

        // 1. 滿足願望 (依照描述調整權重)
        if (prefs.p1 === shift) score += WEIGHTS.PREF_P1;
        else if (prefs.p2 === shift) score += WEIGHTS.PREF_P2;

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}

// 策略 C：規律作息 (Rhythm Keeper)
export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性
        if (shift === prev && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev && prev !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}
