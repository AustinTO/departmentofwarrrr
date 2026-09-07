import { WeaponType } from './config';
import { PINBALL_BOARDS, PINBALL_SIZING } from './PinballBoards';

export type TableObjectKind = 'wall' | 'bumper' | 'target' | 'sling' | 'post' | 'slide' | 'drain' | 'flipper' | 'sensor';

export type SensorRole = 'entrance' | 'exit' | 'lane';

export type TableEvent =
    | 'BUMPER_HIT'
    | 'TARGET_HIT'
    | 'SLINGSHOT_HIT'
    | 'BALL_DRAINED'
    | 'SKILL_SHOT'
    | 'LANE_ENTER'
    | 'LANE_EXIT'
    | 'LANE_HIT';

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
    event?: TableEvent;
    /** Sensor role for lane enter/exit gates. */
    sensor?: SensorRole;
    /** Ramp/channel id this sensor belongs to (e.g. left-ramp). */
    linkId?: string;
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
    badgeFrame: number;
}

/** Default board bumpers (appropriations) — kept for tests and legacy imports. */
export const PROCUREMENT_BUMPERS = PINBALL_BOARDS.appropriations.bumpers;
export const PROCUREMENT_TABLE = PINBALL_BOARDS.appropriations.table;
export { PINBALL_SIZING };
