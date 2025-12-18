// js/modules/ai/AIStrategies.js

const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          
    NEED_MISSING: 3000,   // 缺人 (高分，但低於 P1，確保在策略 B 中願望優先)
    OVER_STAFFED: -10,    // 微小扣分，允許超編
    
    // 員工偏好
    PREF_P1: 5000,        // P1 權重極高
    PREF_P2: 2500,        // P2 權重次之
    PREF_NO: -9999,       // 勿排 (絕對禁止)
    NOT_IN_PREF: -5000,   // ✅ 新增：排了「非志願」的班 (針對策略 B)
    
    // 平衡性
    BALANCE_OVER_AVG: -50, 
    
    // 連續性
    CONTINUITY_BONUS: 500, 
    PATTERN_PENALTY: -200   
};

export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (權重較高，追求填滿)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 2. 基礎偏好
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 500; // 有加分但不多

        return score;
    }
}

export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prefs = context.preferences[uid] || {};
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 滿足願望 (絕對優先)
        if (prefs.p1 === shift) {
            score += WEIGHTS.PREF_P1;
        } else if (prefs.p2 === shift) {
            score += WEIGHTS.PREF_P2;
        } else if (prefs.p3 === shift) { // <-- 修正：確保 P3 (勿排) 被絕對禁止
            // P3 視為「勿排」
            score += WEIGHTS.PREF_NO;
        } else if (shift !== 'OFF') {
            // 若此班別既非 P1/P2 也非 P3，且不是 OFF -> 重罰 (非志願班)
            score += WEIGHTS.NOT_IN_PREF;
        }

        // 2. 人力需求 (次要)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += 1000; // 降低填補缺口的誘因
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}

export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性 (作息規律優先)
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
