import { describe, expect, it } from 'vitest';
import { WeaponType, isTargetInWeaponRange } from './config';
import { adjacentWeapon, weaponAmmoLabel, weaponRangeLabel, weaponWheelSlots } from './WeaponWheel';

const weapons = [WeaponType.GUN, WeaponType.JAMMER, WeaponType.INTERCEPTOR];

describe('weapon wheel layout', () => {
    it('puts the selected weapon at the top of the dial', () => {
        const slots = weaponWheelSlots(weapons, WeaponType.JAMMER, 100, 100, 40);
        const selected = slots.find((slot) => slot.type === WeaponType.JAMMER)!;

        expect(selected.x).toBeCloseTo(100);
        expect(selected.y).toBeCloseTo(60);
    });

    it('cycles in either direction and wraps at the ends', () => {
        expect(adjacentWeapon(weapons, WeaponType.INTERCEPTOR, 1)).toBe(WeaponType.GUN);
        expect(adjacentWeapon(weapons, WeaponType.GUN, -1)).toBe(WeaponType.INTERCEPTOR);
    });

    it('shows doctrine unlimited ammo consistently and keeps range tied to config', () => {
        expect(weaponAmmoLabel(WeaponType.INTERCEPTOR, 2, true)).toBe('UNLIMITED (DOCTRINE)');
        expect(weaponAmmoLabel(WeaponType.INTERCEPTOR, 2, false)).toBe('2');
        expect(weaponAmmoLabel(WeaponType.GUN, 0, false)).toBe('UNLIMITED');
        expect(weaponRangeLabel(WeaponType.GUN)).toBe('500px');
        expect(isTargetInWeaponRange(WeaponType.GUN, 0, 0, 300, 400)).toBe(true);
        expect(isTargetInWeaponRange(WeaponType.GUN, 0, 0, 301, 400)).toBe(false);
    });
});
