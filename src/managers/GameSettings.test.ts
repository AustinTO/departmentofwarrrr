import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const backing = new Map<string, string>();
const localStorageMock = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => { backing.set(key, value); },
    removeItem: (key: string) => { backing.delete(key); }
};

describe('GameSettings combat briefing', () => {
    beforeEach(() => {
        backing.clear();
        vi.resetModules();
        vi.stubGlobal('localStorage', localStorageMock);
    });

    afterEach(() => vi.unstubAllGlobals());

    it('shows training by default and persists dismissal independently of campaign state', async () => {
        const { gameSettings } = await import('./GameSettings');
        expect(gameSettings.combatBriefingSeen).toBe(false);
        gameSettings.markCombatBriefingSeen();
        expect(gameSettings.combatBriefingSeen).toBe(true);
        expect(JSON.parse(backing.get('warrr_settings_v1')!).combatBriefingSeen).toBe(true);
        expect(JSON.parse(backing.get('warrr_settings_v1')!).musicVolume).toBe(0.7);
    });

    it('loads pre-briefing saves without losing audio settings', async () => {
        backing.set('warrr_settings_v1', JSON.stringify({ musicVolume: 0.2, sfxVolume: 0.4 }));
        const { gameSettings } = await import('./GameSettings');
        expect(gameSettings.musicVolume).toBe(0.2);
        expect(gameSettings.sfxVolume).toBe(0.4);
        expect(gameSettings.combatBriefingSeen).toBe(false);
    });

    it('loads the dismissed flag from a later session', async () => {
        backing.set('warrr_settings_v1', JSON.stringify({ musicVolume: 0.7, sfxVolume: 0.85, combatBriefingSeen: true }));
        const { gameSettings } = await import('./GameSettings');
        expect(gameSettings.combatBriefingSeen).toBe(true);
    });
});
