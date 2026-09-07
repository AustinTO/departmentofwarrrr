import { CombatSystem } from './CombatSystem';
import { ThreatType, WeaponType } from './config';
import { currentRun } from '../state/RunState';

describe('CombatSystem friendly contacts', () => {
    beforeEach(() => {
        currentRun.reset();
    });

    it('treats destroying an allied courier as a scandal, not a score', () => {
        const combat = new CombatSystem();
        const ratio = combat.recordThreatDestroyed(ThreatType.FRIENDLY, WeaponType.INTERCEPTOR);
        const stats = combat.getStats();

        expect(ratio).toBe(0);
        expect(stats.friendliesHit).toBe(1);
        expect(stats.threatsDestroyed).toBe(0);
        expect(stats.procurementPressure).toBeGreaterThan(0);
    });

    it('rewards sparing allies with restraint credit', () => {
        const combat = new CombatSystem();
        combat.recordFriendlySpared();
        combat.recordFriendlySpared();
        const stats = combat.getStats();

        expect(stats.friendliesSpared).toBe(2);
        expect(stats.restraintBonus).toBeGreaterThan(0);
        expect(combat.getGrade()).toBe('A');
    });

    it('awards an S grade for clean high-chain restraint play', () => {
        const combat = new CombatSystem();
        combat.recordFriendlySpared();
        combat.recordFriendlySpared();
        combat.noteCombo(12);
        expect(combat.getGrade()).toBe('S');
    });
});
