import { WeaponType } from './config';

export type TableObjectKind = 'wall' | 'bumper' | 'target' | 'sling' | 'post' | 'slide' | 'drain' | 'flipper';

export interface TableObject {
    id: string;
    kind: TableObjectKind;
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
    angle?: number;
    points?: Array<[number, number]>;
    event?: 'BUMPER_HIT' | 'TARGET_HIT' | 'SLINGSHOT_HIT' | 'BALL_DRAINED';
}

export interface ProcurementBumper {
    id: string;
    x: number;
    y: number;
    radius: number;
    label: string;
    value: number;
    delay: number;
    color: number;
    weapon: WeaponType;
    quantity: number;
    outcome: 'inflate' | 'efficiency';
}

/** Reward order is also the stable Planck collision index. */
export const PROCUREMENT_BUMPERS: readonly ProcurementBumper[] = [
    { id: 'jackpot', x: 540, y: 650, radius: 72, label: 'JACKPOT', value: 100_000_000_000, delay: 2, color: 0xffca4f, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 20, outcome: 'inflate' },
    { id: 'audit-failed', x: 210, y: 1000, radius: 46, label: 'AUDIT FAILED', value: 50_000_000_000, delay: 1, color: 0xff5544, weapon: WeaponType.INTERCEPTOR, quantity: 50, outcome: 'inflate' },
    { id: 'cost-overrun', x: 870, y: 1000, radius: 46, label: 'COST OVERRUN', value: 25_000_000_000, delay: 0.2, color: 0xff5544, weapon: WeaponType.INTERCEPTOR_BLOCK_II, quantity: 5, outcome: 'inflate' },
    { id: 'urgent-need', x: 540, y: 1490, radius: 44, label: 'URGENT NEED', value: 10_000_000_000, delay: 0.5, color: 0x8dff74, weapon: WeaponType.INTERCEPTOR, quantity: 10, outcome: 'inflate' },
    { id: 'actual-requirements', x: 310, y: 760, radius: 30, label: 'ACTUAL REQUIREMENTS', value: -2_000_000_000, delay: -0.2, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency' },
    { id: 'fixed-price', x: 770, y: 760, radius: 30, label: 'FIXED PRICE', value: -2_000_000_000, delay: -0.2, color: 0x79e66a, weapon: WeaponType.GUN, quantity: 0, outcome: 'efficiency' },
    { id: 'risk-premium', x: 290, y: 1280, radius: 28, label: 'RISK PREMIUM', value: 5_000_000_000, delay: 0.2, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 2, outcome: 'inflate' },
    { id: 'competitive-bid', x: 790, y: 1280, radius: 28, label: 'COMPETITIVE BID', value: -1_000_000_000, delay: -0.1, color: 0x57b8ff, weapon: WeaponType.JAMMER, quantity: 0, outcome: 'efficiency' }
];

/** One source of truth for Planck geometry and Phaser presentation coordinates. */
export const PROCUREMENT_TABLE: TableObject[] = [
    { id: 'top-rail', kind: 'wall', x: 540, y: 430, points: [[92, 430], [988, 430]] },
    { id: 'left-rail', kind: 'wall', x: 92, y: 1090, points: [[92, 430], [92, 1750]] },
    { id: 'right-rail', kind: 'wall', x: 988, y: 1090, points: [[988, 430], [988, 1750]] },
    { id: 'left-return-rail', kind: 'wall', x: 180, y: 1325, points: [[180, 1140], [180, 1510]] },
    { id: 'right-return-rail', kind: 'wall', x: 900, y: 1325, points: [[900, 1140], [900, 1510]] },
    { id: 'left-apron-guide', kind: 'wall', x: 171, y: 1585, points: [[92, 1515], [250, 1655]] },
    { id: 'right-apron-guide', kind: 'wall', x: 909, y: 1585, points: [[988, 1515], [830, 1655]] },
    { id: 'left-bottom-rail', kind: 'wall', x: 273, y: 1750, points: [[92, 1750], [455, 1750]] },
    { id: 'right-bottom-rail', kind: 'wall', x: 807, y: 1750, points: [[625, 1750], [988, 1750]] },
    { id: 'left-slide', kind: 'slide', x: 175, y: 700, width: 88, points: [[175, 470], [125, 650], [140, 820], [215, 940]] },
    { id: 'right-slide', kind: 'slide', x: 905, y: 700, width: 88, points: [[905, 470], [955, 650], [940, 820], [865, 940]] },
    ...PROCUREMENT_BUMPERS.map(({ id, x, y, radius }) => ({ id, kind: 'bumper' as const, x, y, radius, event: 'BUMPER_HIT' as const })),
    { id: 'left-sling', kind: 'sling', x: 190, y: 1460, width: 115, height: 24, angle: 0.58, event: 'SLINGSHOT_HIT' },
    { id: 'right-sling', kind: 'sling', x: 890, y: 1460, width: 115, height: 24, angle: -0.58, event: 'SLINGSHOT_HIT' },
    { id: 'left-post', kind: 'post', x: 155, y: 1320, radius: 14 }, { id: 'right-post', kind: 'post', x: 925, y: 1320, radius: 14 },
    { id: 'target-left', kind: 'target', x: 360, y: 820, width: 64, height: 28, event: 'TARGET_HIT' },
    { id: 'target-center', kind: 'target', x: 540, y: 820, width: 76, height: 30, event: 'TARGET_HIT' },
    { id: 'target-right', kind: 'target', x: 720, y: 820, width: 64, height: 28, event: 'TARGET_HIT' },
    { id: 'drain', kind: 'drain', x: 540, y: 1750, width: 170, height: 34, event: 'BALL_DRAINED' },
    { id: 'left-flipper', kind: 'flipper', x: 270, y: 1660, width: 220, height: 30 },
    { id: 'right-flipper', kind: 'flipper', x: 810, y: 1660, width: 220, height: 30 }
];
