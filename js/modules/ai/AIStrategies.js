// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 500,    
    OVER_STAFFED: -10000, 
    
    PREF_P1: 1000,       
    PREF_P2: 800,        
    PREF_NO: -5000,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 1000,

    // ✅ 新增：總量管制權重
    OVER_WORK_HEAVY: -20000, // 嚴重超班 (禁止再排)
    OVER_WORK_LIGHT: -5000,  // 輕微超班 (盡量不排)
    UNDER_WORK: 5000         // 欠班 (優先排)
};

const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
};

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

        // 2. ✅ 總量管制 (平均分配)
        const ideal = context.idealShifts || 20; // 預設值防呆
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF') {
            // 已經排太多班了，強力扣分
            if (myTotal > ideal + 1) {
                score += WEIGHTS.OVER_WORK_HEAVY; 
            } 
            else if (myTotal > ideal) {
                score += WEIGHTS.OVER_WORK_LIGHT;
            }
            // 班太少，強力加分
            else if (myTotal < ideal - 1) {
                score += WEIGHTS.UNDER_WORK;
            }
        }

        // 3. 偏好
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 100;

        return score;
    }
}

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

        // 3. ✅ 總量管制 (即使是願望優先，也不能超班太多)
        const ideal = context.idealShifts || 20;
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF') {
            if (myTotal > ideal + 2) { // 稍微寬容一點 (+2)
                score += WEIGHTS.OVER_WORK_HEAVY;
            }
        }

        return score;
    }
}

export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev1 = context.assignments[uid][day-1] || 'OFF';
        const prev2 = context.assignments[uid][day-2] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性與規律
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

        // 3. ✅ 總量管制
        const ideal = context.idealShifts || 20;
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF') {
            if (myTotal > ideal + 1) score += WEIGHTS.OVER_WORK_HEAVY;
            else if (myTotal < ideal - 1) score += WEIGHTS.UNDER_WORK;
        }

        return score;
    }
}
