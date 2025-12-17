// js/ai/AIStrategies.js

// 權重常數定義
const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          // 剛好滿足
    NEED_MISSING: 500,    // 缺人 (極高分，鼓勵填入)
    OVER_STAFFED: -10000, // ⛔️ 超編 (極大扣分，除非無人可排，否則不填)
    
    // 員工偏好
    PREF_P1: 2000,        // 第一志願 (拉高權重)
    PREF_P2: 800,         // 第二志願
    PREF_NO: -5000,       // 填了「勿排」卻硬排 (極大扣分)
    
    // 平衡性
    BALANCE_OVER_AVG: -200, // 超過平均班數
    
    // 連續性
    CONTINUITY_BONUS: 50, // 連續上班 (減少換班)
    PATTERN_PENALTY: -50  // 花花班 (D->E->D)
};

// 輔助：計算該員目前的總班數 (用於平衡)
const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
};

// 策略 A：數值平衡 (Statistical Balance)
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;
        const myStats = context.stats[uid] || {};

        // 1. 人力需求控制 (最優先)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED; // ⛔️ 關鍵修正：人夠了就別再排
        }

        // 2. 削峰填谷 (平衡班數)
        // 計算目前所有人平均班數
        let totalAll = 0;
        Object.values(context.stats).forEach(s => totalAll += (s.D+s.E+s.N));
        const avg = totalAll / context.staffList.length;
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF' && myTotal > avg + 1) {
            score += WEIGHTS.BALANCE_OVER_AVG; // 班太多了，扣分
        } else if (shift !== 'OFF' && myTotal < avg - 1) {
            score += 200; // 班太少，加分
        }

        // 3. 基礎偏好 (即使是平衡版，也要稍微顧及)
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

        // 1. 滿足願望 (絕對優先)
        if (prefs.p1 === shift) score += WEIGHTS.PREF_P1;
        else if (prefs.p2 === shift) score += WEIGHTS.PREF_P2;

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED; // 即使是願望優先，也不能嚴重超編
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

        // 1. 連續性獎勵
        if (shift === prev && shift !== 'OFF') {
            score += WEIGHTS.CONTINUITY_BONUS;
        }
        // 懲罰頻繁換班 (花花班)
        if (shift !== prev && prev !== 'OFF' && shift !== 'OFF') {
            score += WEIGHTS.PATTERN_PENALTY;
        }

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}
