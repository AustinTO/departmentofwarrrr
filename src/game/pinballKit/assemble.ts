import type { TableObject } from '../ProcurementTableDefinition';
import { resetBumperRegistry } from './components/bumper';
import { mergeEmits, type KitEmit, type KitBuilder } from './types';

export interface BoardAssembly extends KitEmit {
    objects: TableObject[];
}

/**
 * Assemble a declarative recipe of kit builders into TableObject[] (+ tunnels/bumpers).
 * Throws if any component rejects params (narrow channel, overlap, etc.).
 */
export function assembleBoard(recipe: KitBuilder[]): BoardAssembly {
    resetBumperRegistry();
    const merged = mergeEmits(...recipe.map((build) => build()));
    const ids = new Set<string>();
    for (const obj of merged.objects) {
        if (ids.has(obj.id)) throw new Error(`Duplicate table object id: ${obj.id}`);
        ids.add(obj.id);
    }
    return merged;
}
