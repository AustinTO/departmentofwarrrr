/** Local-only score history. Never a proof of global/competitive integrity. */
export interface ScoreEntry {
    fiscalYear: number;
    mansions: number;
    burn: number;
}

export const SCORE_KEY = 'warrr_leaderboard_v1';

function isScoreEntry(value: unknown): value is ScoreEntry {
    if (!value || typeof value !== 'object') return false;
    const score = value as Partial<ScoreEntry>;
    return Number.isFinite(score.fiscalYear) && Number.isFinite(score.mansions) &&
        Number.isFinite(score.burn) && Number(score.fiscalYear) >= 2026 &&
        Number(score.mansions) >= 0 && Number(score.burn) >= 0;
}

export function loadScores(storage: Pick<Storage, 'getItem' | 'removeItem'>): ScoreEntry[] {
    const raw = storage.getItem(SCORE_KEY);
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('Invalid leaderboard');
        return parsed.filter(isScoreEntry).sort((a, b) => b.burn - a.burn).slice(0, 10);
    } catch {
        storage.removeItem(SCORE_KEY);
        return [];
    }
}

export function recordScore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, score: ScoreEntry): ScoreEntry[] {
    const scores = loadScores(storage);
    if (!isScoreEntry(score)) return scores;
    scores.push(score);
    scores.sort((a, b) => b.burn - a.burn);
    const topTen = scores.slice(0, 10);
    storage.setItem(SCORE_KEY, JSON.stringify(topTen));
    return topTen;
}
