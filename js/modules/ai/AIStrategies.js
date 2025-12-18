const DEFAULT_WEIGHTS = {
    A_overStaffed: -20,
    B_p1: 5000,
    B_p2: 2000,
    C_continuity: 500,
    C_pattern: -100,
    // 共用
    NEED_MISSING: 2000,
    PREF_NO: -9999
};

export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const wConfig = context.weights || DEFAULT_WEIGHTS;
        
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        if (shift !== 'OFF') {
            if (current < shiftReq) score += (wConfig.NEED_MISSING || 2000);
            else score += (wConfig.A_overStaffed || -20); // 動態權重
        }

        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 100;

        return score;
    }
}

export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const wConfig = context.weights || DEFAULT_WEIGHTS;
        
        const prefs = context.preferences[uid] || {};
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 動態權重
        if (prefs.p1 === shift) score += (wConfig.B_p1 || 5000);
        else if (prefs.p2 === shift) score += (wConfig.B_p2 || 2000);

        if (shift !== 'OFF') {
            if (current < shiftReq) score += (wConfig.NEED_MISSING || 2000);
            else score += -5; // 願望優先時，超編懲罰極低
        }

        return score;
    }
}

export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const wConfig = context.weights || DEFAULT_WEIGHTS;
        
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 動態權重
        if (shift === prev && shift !== 'OFF') score += (wConfig.C_continuity || 500);
        if (shift !== prev && prev !== 'OFF' && shift !== 'OFF') score += (wConfig.C_pattern || -100);

        if (shift !== 'OFF') {
            if (current < shiftReq) score += (wConfig.NEED_MISSING || 2000);
            else score += -5;
        }

        return score;
    }
}
