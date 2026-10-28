import { WeaponType, WEAPON_CONFIGS } from './config';

export interface WeaponWheelSlot {
    type: WeaponType;
    angle: number;
    x: number;
    y: number;
}

/**
 * Lays out an unlocked arsenal around a dial. The selected weapon is always at
 * the top of the wheel, so opening the selector never leaves it hidden.
 */
export function weaponWheelSlots(
    weapons: WeaponType[],
    selected: WeaponType,
    centerX: number,
    centerY: number,
    radius: number
): WeaponWheelSlot[] {
    const selectedIndex = Math.max(0, weapons.indexOf(selected));
    return weapons.map((type, index) => {
        const angle = -Math.PI / 2 + ((index - selectedIndex) * Math.PI * 2) / weapons.length;
        return {
            type,
            angle,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        };
    });
}

export function adjacentWeapon(weapons: WeaponType[], current: WeaponType, direction: 1 | -1): WeaponType | undefined {
    if (weapons.length === 0) return undefined;
    const currentIndex = Math.max(0, weapons.indexOf(current));
    return weapons[(currentIndex + direction + weapons.length) % weapons.length];
}

/** Matches the combat HUD and callout for doctrine supplied unlimited stock. */
export function weaponAmmoLabel(type: WeaponType, inventory: number, doctrineUnlimited: boolean): string {
    if (!WEAPON_CONFIGS[type].limitedAmmo) return 'UNLIMITED';
    return doctrineUnlimited ? 'UNLIMITED (DOCTRINE)' : String(inventory);
}

export function weaponRangeLabel(type: WeaponType): string {
    return `${WEAPON_CONFIGS[type].range}px`;
}
