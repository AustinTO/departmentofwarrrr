import { DOCTRINES } from './config';
import { scenarioForFiscalYear } from './CombatScenarios';
import type { CombatStats, GradeBreakdown } from './CombatSystem';

export interface DailyDefinition {
    day: string; // UTC day, never local timezone
    seed: number;
    doctrineId: string;
    doctrineName: string;
    scenarioId: string;
    scenarioName: string;
    objective: string;
}

export type DailyPolicy = 'fast-track' | 'audit';

export interface DailyRecord {
    day: string;
    seed: number;
    score: number;
    grade: string;
    threats: number;
    alliesSpared: number;
    alliesHit: number;
    readiness: number;
    taxpayerBurn: number;
    contractorProfit: number;
    contractValue: number;
    policy: DailyPolicy | null;
    authorized: boolean;
    defeated: boolean;
    endedEarly: boolean;
    eligible: boolean;
}

export const DAILY_BEST_KEY = 'warrr_daily_best_v1';

export function utcDayKey(now: Date = new Date()): string {
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid daily challenge date');
    return now.getUTCFullYear() + '-' +
        String(now.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(now.getUTCDate()).padStart(2, '0');
}

/** FNV-1a for a repeatable public daily seed, not a secret or tamper prevention. */
export function seedForDay(day: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid daily key');
    let value = 2166136261;
    for (let i = 0; i < day.length; i++) {
        value = Math.imul(value ^ day.charCodeAt(i), 16777619) >>> 0;
    }
    return value >>> 0;
}

export function dailyDefinition(now: Date = new Date()): DailyDefinition {
    const day = utcDayKey(now);
    const seed = seedForDay(day);
    const doctrine = DOCTRINES[seed % DOCTRINES.length];
    const scenario = scenarioForFiscalYear(2026, seed);
    return {
        day, seed, doctrineId: doctrine.id, doctrineName: doctrine.name,
        scenarioId: scenario.id, scenarioName: scenario.location, objective: scenario.objective
    };
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : 0));
}

/** Local arcade scoring, not a server-authoritative or ranked multiplayer result. */
export function dailyResult(
    definition: DailyDefinition,
    combat: { stats: CombatStats; grade: GradeBreakdown } | null,
    economy: { readiness: number; taxpayerBurn: number; contractorProfit: number; contractValue: number; authorized: boolean },
    policy: DailyPolicy | null,
    defeated: boolean
): DailyRecord {
    const stats = combat?.stats;
    const endedEarly = stats?.endedEarly ?? false;
    const readiness = clamp(economy.readiness, 0, 100);
    const contractValue = Math.max(0, Number.isFinite(economy.contractValue) ? economy.contractValue : 0);
    const authorized = economy.authorized && contractValue > 0;
    // Bigger procurement awards are fun, but bounded so the defensive stage matters.
    const procurementPoints = authorized ? 400 + Math.round(clamp(contractValue / 1e9, 0, 150) * 5) : 0;
    const score = Math.max(0, Math.round(
        clamp(combat?.grade.score ?? 0, 0, 100) * 15 +
        clamp(stats?.threatsDestroyed ?? 0, 0, 300) * 45 +
        clamp(stats?.friendliesSpared ?? 0, 0, 100) * 100 -
        clamp(stats?.friendliesHit ?? 0, 0, 100) * 240 +
        readiness * 5 + procurementPoints
    ));
    return {
        day: definition.day,
        seed: definition.seed,
        score,
        grade: combat?.grade.grade ?? 'F',
        threats: stats?.threatsDestroyed ?? 0,
        alliesSpared: stats?.friendliesSpared ?? 0,
        alliesHit: stats?.friendliesHit ?? 0,
        readiness,
        taxpayerBurn: Math.max(0, economy.taxpayerBurn),
        contractorProfit: Math.max(0, economy.contractorProfit),
        contractValue,
        policy,
        authorized,
        defeated,
        endedEarly,
        eligible: Boolean(combat && !defeated && !endedEarly && policy)
    };
}

function isDailyRecord(value: unknown): value is DailyRecord {
    if (!value || typeof value !== 'object') return false;
    const row = value as Partial<DailyRecord>;
    return typeof row.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.day) &&
        Number.isInteger(row.seed) && Number.isFinite(row.score) && Number(row.score) >= 0 &&
        typeof row.grade === 'string' && typeof row.eligible === 'boolean';
}

/** Stored scores are deliberately local and editable, never global verified rankings. */
export function loadDailyBest(storage: Pick<Storage, 'getItem'>): Record<string, DailyRecord> {
    try {
        const raw = storage.getItem(DAILY_BEST_KEY);
        if (!raw) return {};
        const data: unknown = JSON.parse(raw);
        if (!data || Array.isArray(data) || typeof data !== 'object') return {};
        const best: Record<string, DailyRecord> = {};
        Object.entries(data).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60).forEach(([day, row]) => {
            if (isDailyRecord(row) && row.eligible && row.day === day && row.seed === seedForDay(day)) {
                best[day] = row;
            }
        });
        return best;
    } catch {
        return {};
    }
}

export function saveDailyBest(storage: Pick<Storage, 'getItem' | 'setItem'>, result: DailyRecord): boolean {
    if (!isDailyRecord(result) || !result.eligible || result.seed !== seedForDay(result.day)) return false;
    const best = loadDailyBest(storage);
    if (best[result.day] && best[result.day].score >= result.score) return false;
    best[result.day] = result;
    try {
        const trimmed = Object.fromEntries(
            Object.entries(best).sort(([a], [b]) => b.localeCompare(a)).slice(0, 60)
        );
        storage.setItem(DAILY_BEST_KEY, JSON.stringify(trimmed));
        return true;
    } catch {
        // Private browsing/quota restrictions must never interrupt the result screen.
        return false;
    }
}

export function dailyShareText(record: DailyRecord): string {
    return 'DEPARTMENT OF WARRR • DAILY BUDGET CRISIS ' + record.day +
        '\n' + record.score.toLocaleString('en-US') + ' pts • Grade ' + record.grade +
        ' • ' + record.threats + ' threats down' +
        '\nTaxpayer burn $' + (record.taxpayerBurn / 1e9).toFixed(2) + 'B' +
        ' • ' + record.alliesSpared + ' allies spared' +
        '\nSeed ' + record.seed + ' • Local score • Play Department of WARRR';
}
