import { DOCTRINES } from './config';
import { currentRun } from '../state/RunState';
import type { CombatStats, GradeBreakdown } from './CombatSystem';
import {
    dailyDefinition, dailyResult, saveDailyBest,
    type DailyDefinition, type DailyPolicy, type DailyRecord
} from './DailyChallenge';

type CombatSummary = { stats: CombatStats; grade: GradeBreakdown };
interface Session {
    definition: DailyDefinition;
    combat: CombatSummary | null;
    policy: DailyPolicy | null;
    prePinballBurn: number;
}
let session: Session | null = null;

export function isDailyActive(): boolean {
    return session !== null && currentRun.dailyActive;
}

export function currentDaily(): DailyDefinition | null {
    return session?.definition ?? null;
}

/** Save the campaign first; all daily mutations remain in memory. */
export function beginDaily(now: Date = new Date()): DailyDefinition {
    if (isDailyActive()) abandonDaily();
    currentRun.save();
    currentRun.reset();
    const definition = dailyDefinition(now);
    currentRun.dailyActive = true;
    currentRun.campaignSeed = definition.seed;
    currentRun.randomCounter = 0;
    currentRun.activeDoctrine = DOCTRINES.find((d) => d.id === definition.doctrineId) ?? DOCTRINES[0];
    currentRun.selectedBoard = 'appropriations';
    session = { definition, combat: null, policy: null, prePinballBurn: 0 };
    return definition;
}

export function recordDailyCombat(stats: CombatStats, grade: GradeBreakdown): void {
    if (!isDailyActive() || !session) return;
    session.combat = { stats: { ...stats }, grade: { ...grade, reasons: [...grade.reasons] } };
}

/** One policy choice for the whole challenge. Applies only to the daily scratch run. */
export function chooseDailyPolicy(policy: DailyPolicy): boolean {
    if (!isDailyActive() || !session || !session.combat || session.policy ||
        (policy !== 'fast-track' && policy !== 'audit')) return false;
    const active = currentRun.theaters.active;
    if (!active) return false;
    const doctrine = currentRun.activeDoctrine;
    if (!doctrine) return false;
    if (policy === 'fast-track') {
        active.readiness = Math.max(0, active.readiness - 8);
    } else {
        active.readiness = Math.min(100, active.readiness + 8);
    }
    currentRun.activeDoctrine = {
        ...doctrine,
        effect: {
            ...doctrine.effect,
            profitMargin: Math.max(0.5, (doctrine.effect.profitMargin ?? 1) + (policy === 'fast-track' ? 0.35 : -0.15))
        }
    };
    currentRun.updateGlobalReadiness();
    session.policy = policy;
    session.prePinballBurn = currentRun.taxpayerBurn;
    return true;
}

/** Restores the previously saved normal campaign, even if the daily round was abandoned. */
export function abandonDaily(): void {
    if (!session && !currentRun.dailyActive) return;
    session = null;
    currentRun.dailyActive = false;
    currentRun.reset();
    currentRun.load();
}

export function finishDaily(defeated: boolean, storage: Pick<Storage, 'getItem' | 'setItem'>): DailyRecord | null {
    if (!isDailyActive() || !session) return null;
    const state = session;
    const contractValue = state.policy && currentRun.authorizedProcurementFY === 2026
        ? Math.max(0, currentRun.taxpayerBurn - state.prePinballBurn) : 0;
    const result = dailyResult(state.definition, state.combat, {
        readiness: currentRun.theaters.active.readiness,
        taxpayerBurn: currentRun.taxpayerBurn,
        contractorProfit: currentRun.contractorProfit,
        contractValue,
        authorized: currentRun.authorizedProcurementFY === 2026
    }, state.policy, defeated);
    saveDailyBest(storage, result);
    abandonDaily();
    return result;
}
