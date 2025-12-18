// js/ai/AIStrategies.js

// 權重常數定義
const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          
    NEED_MISSING: 2000,   // 缺人 (極高分，絕對優先填補)
    OVER_STAFFED: -5,     // ✅ 修正：允許超編 (微小扣分)，以便 Step 2A 先填滿格子，後續 Step 2B 再修剪
    
    // 員工偏好
    PREF_P1: 3000,        // 第一志願 (拉高權重，確保 AI 優先考慮)
    PREF_P2: 1500,        // 第二志願
    PREF_NO: -9999,       // 勿排 (極大扣分，視為禁區)
    
    // 平衡性 (在 Step 2A 階段先不強力介入，留給 2B 處理)
    BALANCE_OVER_AVG: -10, 
    
    // 連續性 (作息規律)
    CONTINUITY_BONUS: 200, // 鼓勵延續前一天的班 (減少換班)
    PATTERN_PENALTY: -50   // 懲罰花花班
};

// 策略 A：數值平衡 (Statistical Balance)
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (Hard Goal)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED; // 即使滿了也只扣一點點，允許填入
        }

        // 2. 基礎偏好 (Soft Goal)
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

        // 1. 連續性獎勵
        if (shift === prev && shift !== 'OFF') {
            score += WEIGHTS.CONTINUITY_BONUS;
        }
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
