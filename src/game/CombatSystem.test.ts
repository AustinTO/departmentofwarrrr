import { CombatSystem, isActiveTheaterDefeated } from './CombatSystem';
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

    it('explains grade components and preserves a strong grade after one ally incident', () => {
        const combat = new CombatSystem();
        combat.recordFriendlySpared();
        combat.recordFriendlySpared();
        combat.noteCombo(12);
        combat.recordThreatDestroyed(ThreatType.LAWN_MOWER, WeaponType.GUN);
        combat.recordThreatDestroyed(ThreatType.FRIENDLY, WeaponType.INTERCEPTOR);
        combat.recordReadinessLoss(12);

        const result = combat.getGradeBreakdown();
        expect(result.grade).toBe('A');
        expect(result.reasons).toEqual(expect.arrayContaining([
            expect.stringContaining('SURVIVAL'),
            expect.stringContaining('RESTRAINT'),
            expect.stringContaining('EFFICIENCY'),
            expect.stringContaining('CHAIN')
        ]));
    });

    it('reduces early-exit score and states the tradeoff', () => {
        const completed = new CombatSystem();
        const yielded = new CombatSystem();
        completed.noteCombo(8);
        yielded.noteCombo(8);
        yielded.recordEarlyExit();

        expect(yielded.getGradeBreakdown().score).toBeLessThan(completed.getGradeBreakdown().score);
        expect(yielded.getGradeBreakdown().reasons.at(-1)).toContain('EARLY EXIT');
    });

    it('caps repeated friendly-fire incidents at F and explains why', () => {
        const combat = new CombatSystem();
        combat.noteCombo(20);
        combat.recordFriendlySpared();
        combat.recordFriendlySpared();
        combat.recordThreatDestroyed(ThreatType.FRIENDLY, WeaponType.GUN);
        combat.recordThreatDestroyed(ThreatType.FRIENDLY, WeaponType.GUN);
        combat.recordThreatDestroyed(ThreatType.FRIENDLY, WeaponType.GUN);

        const result = combat.getGradeBreakdown();
        expect(result.grade).toBe('F');
        expect(result.score).toBeLessThanOrEqual(44);
        expect(result.reasons).toContain('SEVERE FRIENDLY FIRE: three incidents cap the grade at F');
    });
});


describe('active theater defeat condition', () => {
    it('ends the defense at zero active readiness even with other theaters healthy', () => {
        currentRun.reset();
        currentRun.theaters.active.readiness = 0;
        currentRun.updateGlobalReadiness();
        expect(currentRun.globalReadiness).toBe(80);
        expect(isActiveTheaterDefeated(currentRun.theaters.active.readiness)).toBe(true);
    });

    it('does not end a live operation at positive readiness', () => {
        expect(isActiveTheaterDefeated(100)).toBe(false);
        expect(isActiveTheaterDefeated(5)).toBe(false);
        expect(isActiveTheaterDefeated(0)).toBe(true);
    });
});
