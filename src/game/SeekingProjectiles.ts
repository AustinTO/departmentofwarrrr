import * as Phaser from 'phaser';
import { WeaponType, type ThreatConfig } from './config';

export type SeekerShotData = {
    mode: 'seek';
    weapon: WeaponType;
    speed: number;
    radius: number;
    life: number;
    turnRate: number;
    target?: Phaser.GameObjects.Container;
    splitAt?: number;
    splitDone?: boolean;
    aimX?: number;
    aimY?: number;
    isCluster?: boolean;
};

/** Hostile (non-friendly) active threats sorted by distance from a point. */
export function hostileThreatsNear(
    threats: Phaser.Physics.Arcade.Group,
    x: number,
    y: number
): Phaser.GameObjects.Container[] {
    return threats.getChildren()
        .filter((t): t is Phaser.GameObjects.Container => t.active)
        .filter((t) => !(t.getData('config') as ThreatConfig | undefined)?.friendly)
        .sort((a, b) =>
            Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y)
        );
}

/** Assign up to `count` distinct nearest threats for multi-split seekers. */
export function pickDistinctTargets(
    threats: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    count: number
): Phaser.GameObjects.Container[] {
    return hostileThreatsNear(threats, x, y).slice(0, count);
}

/** Steer a container toward a live target (or last aim) with capped turn rate. */
export function steerSeeker(
    shot: Phaser.GameObjects.Container,
    data: SeekerShotData,
    deltaMs: number
): { x: number; y: number } | null {
    const dt = deltaMs / 1000;
    data.life -= deltaMs;
    if (data.life <= 0) return { x: shot.x, y: shot.y };

    let tx = data.aimX ?? shot.x;
    let ty = data.aimY ?? shot.y - 200;
    const target = data.target;
    if (target?.active) {
        tx = target.x;
        ty = target.y;
        data.aimX = tx;
        data.aimY = ty;
    }

    const desired = Phaser.Math.Angle.Between(shot.x, shot.y, tx, ty);
    const current = shot.rotation - Math.PI / 2;
    let diff = Phaser.Math.Angle.Wrap(desired - current);
    const maxTurn = data.turnRate * dt;
    diff = Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
    const next = current + diff;
    shot.setRotation(next + Math.PI / 2);
    shot.x += Math.cos(next) * data.speed * dt;
    shot.y += Math.sin(next) * data.speed * dt;

    const dist = Phaser.Math.Distance.Between(shot.x, shot.y, tx, ty);
    if (dist < 48 || (target?.active && dist < 56)) {
        return { x: shot.x, y: shot.y };
    }
    return null;
}
