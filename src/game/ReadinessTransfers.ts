import type { WeaponType } from './config';
import type { RunState } from '../state/RunState';

export interface TransferPreview {
    quantity: number;
    sourceBefore: number;
    sourceAfter: number;
    activeBefore: number;
    activeAfter: number;
    sourceReadinessBefore: number;
    sourceReadinessAfter: number;
    globalBefore: number;
    globalAfter: number;
}

/** Pure preview using the same reserve/readiness arithmetic as RunState.transferInventory. */
export function previewTransfer(run: RunState, sourceId: string, weapon: WeaponType, requested: number): TransferPreview | null {
    const source = run.theaters[sourceId];
    const active = run.theaters.active;
    if (!source || !active || sourceId === 'active' || !Number.isInteger(requested) || requested <= 0) return null;
    const available = source.inventory[weapon] || 0;
    const quantity = Math.min(requested, available);
    if (quantity <= 0) return null;
    const sourceReadinessAfter = sourceId === 'reserve'
        ? source.readiness
        : Math.max(0, source.readiness - (quantity / 20) * 5);
    const theaters = Object.values(run.theaters);
    const globalAfter = Math.floor(
        theaters.reduce((sum, theater) => sum + (theater.id === sourceId ? sourceReadinessAfter : theater.readiness), 0)
        / theaters.length
    );
    const activeBefore = active.inventory[weapon] || 0;
    return {
        quantity,
        sourceBefore: available,
        sourceAfter: available - quantity,
        activeBefore,
        activeAfter: activeBefore + quantity,
        sourceReadinessBefore: source.readiness,
        sourceReadinessAfter,
        globalBefore: run.globalReadiness,
        globalAfter
    };
}
