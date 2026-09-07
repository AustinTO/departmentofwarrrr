import { describe, expect, it } from 'vitest';
import { WeaponType, isWeaponUnlocked, STARTER_WEAPONS, WEAPON_CONFIGS } from './config';
import { isBoardUnlocked, PINBALL_SIZING, PINBALL_BOARDS, PINBALL_BOARD_ORDER, layoutFingerprint, railsAlignedToPlayfield } from './PinballBoards';
import { RunState } from '../state/RunState';

describe('campaign weapon unlocks', () => {
    it('keeps starters available from FY1', () => {
        STARTER_WEAPONS.forEach((type) => {
            expect(isWeaponUnlocked(type, 2026, 0, [])).toBe(true);
        });
    });

    it('unlocks Hydra by FY or mansion milestone (OR)', () => {
        expect(isWeaponUnlocked(WeaponType.HYDRA, 2026, 0, [])).toBe(false);
        expect(isWeaponUnlocked(WeaponType.HYDRA, 2027, 0, [])).toBe(true);
        expect(isWeaponUnlocked(WeaponType.HYDRA, 2026, 1, [])).toBe(true);
    });

    it('unlocks Railgun and Seeker later', () => {
        expect(isWeaponUnlocked(WeaponType.RAILGUN, 2027, 3, [])).toBe(false);
        expect(isWeaponUnlocked(WeaponType.RAILGUN, 2028, 0, [])).toBe(true);
        expect(isWeaponUnlocked(WeaponType.RAILGUN, 2026, 4, [])).toBe(true);
        expect(isWeaponUnlocked(WeaponType.SEEKER, 2028, 7, [])).toBe(false);
        expect(isWeaponUnlocked(WeaponType.SEEKER, 2029, 0, [])).toBe(true);
        expect(isWeaponUnlocked(WeaponType.SEEKER, 2026, 8, [])).toBe(true);
    });

    it('marks new weapons as limited ammo with distinct behaviors', () => {
        expect(WEAPON_CONFIGS[WeaponType.HYDRA].behavior).toBe('hydra_split');
        expect(WEAPON_CONFIGS[WeaponType.RAILGUN].behavior).toBe('railgun');
        expect(WEAPON_CONFIGS[WeaponType.SEEKER].behavior).toBe('seeker_swarm');
        expect(WEAPON_CONFIGS[WeaponType.HYDRA].limitedAmmo).toBe(true);
        expect(WEAPON_CONFIGS[WeaponType.RAILGUN].limitedAmmo).toBe(true);
        expect(WEAPON_CONFIGS[WeaponType.SEEKER].limitedAmmo).toBe(true);
    });
});

describe('pinball boards', () => {
    it('ships three boards sharing the kit playfield this milestone', () => {
        expect(PINBALL_BOARD_ORDER).toHaveLength(3);
        expect(PINBALL_BOARDS.appropriations.playfieldKey).toBe('pinball_playfield');
        expect(PINBALL_BOARDS.audit_chamber.playfieldKey).toBe('pinball_playfield_audit');
        expect(PINBALL_BOARDS.supplemental_stadium.playfieldKey).toBe('pinball_playfield_stadium');

        // Unlock UI keeps distinct keys; live collision geometry is one kit table for now.
        const a = layoutFingerprint(PINBALL_BOARDS.appropriations.table);
        const b = layoutFingerprint(PINBALL_BOARDS.audit_chamber.table);
        const c = layoutFingerprint(PINBALL_BOARDS.supplemental_stadium.table);
        expect(a).toEqual(b);
        expect(b).toEqual(c);
        expect(a.length).toBeGreaterThan(100);
        Object.values(PINBALL_BOARDS).forEach((board) => {
            expect(railsAlignedToPlayfield(board.table)).toBe(true);
            expect(board.table.some((e) => e.kind === 'slide')).toBe(true);
            expect(board.table.some((e) => e.id.startsWith('tunnel-'))).toBe(true);
        });
    });

    it('unlocks audit / stadium by FY or mansions', () => {
        expect(isBoardUnlocked('appropriations', 2026, 0, [])).toBe(true);
        expect(isBoardUnlocked('audit_chamber', 2026, 0, [])).toBe(false);
        expect(isBoardUnlocked('audit_chamber', 2027, 0, [])).toBe(true);
        expect(isBoardUnlocked('audit_chamber', 2026, 2, [])).toBe(true);
        expect(isBoardUnlocked('supplemental_stadium', 2027, 5, [])).toBe(false);
        expect(isBoardUnlocked('supplemental_stadium', 2028, 0, [])).toBe(true);
        expect(isBoardUnlocked('supplemental_stadium', 2026, 6, [])).toBe(true);
    });

    it('enlarges ball and flippers for all boards', () => {
        expect(PINBALL_SIZING.ballRadiusPx).toBeGreaterThanOrEqual(28);
        expect(PINBALL_SIZING.flipperWidthPx).toBeGreaterThanOrEqual(280);
    });
});

describe('RunState syncUnlocks', () => {
    it('seeds hydra ammo when mansion gate clears', () => {
        const run = new RunState();
        run.mansionsBuilt = 1;
        const { weapons } = run.syncUnlocks();
        expect(weapons).toContain(WeaponType.HYDRA);
        expect(run.unlockedWeapons).toContain(WeaponType.HYDRA);
        expect(run.theaters.active.inventory[WeaponType.HYDRA]).toBeGreaterThan(0);
    });

    it('unlocks audit board with mansions', () => {
        const run = new RunState();
        run.mansionsBuilt = 2;
        const { boards } = run.syncUnlocks();
        expect(boards).toContain('audit_chamber');
        expect(run.availableBoards()).toContain('audit_chamber');
    });
});
