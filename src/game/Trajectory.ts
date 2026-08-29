export interface Point {
    x: number;
    y: number;
}

export function getArcControlPoint(start: Point, target: Point, arc: number): Point {
    const midX = (start.x + target.x) / 2;
    const midY = (start.y + target.y) / 2;
    const distance = Math.hypot(target.x - start.x, target.y - start.y) || 1;
    const normalX = -(target.y - start.y) / distance;
    const normalY = (target.x - start.x) / distance;
    return { x: midX + normalX * arc, y: midY + normalY * arc };
}

export function quadraticBezier(start: Point, control: Point, target: Point, progress: number): Point {
    const t = Math.max(0, Math.min(1, progress));
    const inverse = 1 - t;
    return {
        x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * target.x,
        y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * target.y
    };
}
