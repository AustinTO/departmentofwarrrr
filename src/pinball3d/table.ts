import * as THREE from "three";

export const TABLE = {
  tilt: Math.PI / 30,
  radius: 0.0145,
  mass: 0.08,
  width: 0.62,
  length: 1.22,
  spawn: [0.263, 0.017, 0.48] as const,
};
export type Point = readonly [number, number, number];
export interface Part {
  id: string;
  kind: "box" | "cylinder" | "hull" | "surface";
  position: Point;
  size?: Point;
  radius?: number;
  height?: number;
  vertices?: number[];
  indices?: number[];
  rotation?: Point;
  color: string;
  role: "deck" | "rail" | "bumper" | "target" | "sensor" | "sling" | "ramp";
}
export const BUMPERS = [
  {
    id: "cost-overrun",
    x: -0.072,
    z: -0.255,
    label: "COST",
    sub: "OVERRUN",
    color: "#ffbb52",
  },
  {
    id: "scope-creep",
    x: 0,
    z: -0.305,
    label: "SCOPE",
    sub: "CREEP",
    color: "#ff725d",
  },
  {
    id: "emergency-funding",
    x: 0.072,
    z: -0.255,
    label: "URGENT",
    sub: "NEED",
    color: "#ca9aff",
  },
];
export const FEATURE_TARGETS = [
  { id: "contract-award", x: 0, z: -0.500, label: "AWARD", color: "#e6c55d", kind: "scoop" },
  { id: "budget-printer", x: 0, z: -0.105, label: "PRINT", color: "#e85845", kind: "printer" },
  { id: "war-chest-left", x: -0.235, z: 0.360, label: "CHEST", color: "#d6b452", kind: "chest" },
  { id: "war-chest-right", x: 0.160, z: 0.330, label: "CHEST", color: "#d6b452", kind: "chest" },
  { id: "drop-bid", x: -0.052, z: 0.165, label: "BID", color: "#64d8ca", kind: "drop" },
  { id: "drop-review", x: 0, z: 0.165, label: "REVIEW", color: "#64d8ca", kind: "drop" },
  { id: "drop-approve", x: 0.052, z: 0.165, label: "APPROVE", color: "#64d8ca", kind: "drop" },
];
export const BONUS_TARGETS = [
  {
    id: "audit",
    x: 0.183,
    z: 0.039,
    label: "AUDIT",
    sub: "− $1B",
    color: "#ff7662",
  },
  {
    id: "black-budget",
    x: -0.093,
    z: 0.215,
    label: "BLACK BUDGET",
    sub: "+ $5B",
    color: "#ba8cff",
  },
  {
    id: "ramp-review",
    x: 0.015,
    z: -0.395,
    label: "RAMP",
    sub: "REVIEW",
    color: "#63e0d1",
  },
];
export const COMMITTEE_TARGET_IDS = BONUS_TARGETS.map((target) => target.id);
export const FLIPPERS = {
  left: {
    pivot: [-0.13, 0.022, 0.405] as Point,
    sign: 1,
    rest: -0.38,
    active: 0.62,
  },
  right: {
    pivot: [0.13, 0.022, 0.405] as Point,
    sign: -1,
    rest: 0.38,
    active: -0.62,
  },
};
/** Rounded tapered prism, shared by Rapier convex hull and Three's convex geometry. */
export function flipperVertices(sign: number): number[] {
  const out: number[] = [];
  for (const y of [-0.016, 0.016]) {
    for (const [cx, radius] of [
      [0, 0.022],
      [0.1, 0.012],
    ]) {
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        out.push(
          sign * (cx + Math.cos(angle) * radius),
          y,
          Math.sin(angle) * radius,
        );
      }
    }
  }
  return out;
}

export const RAMP_POINTS: Point[] = [
  [-0.19, -0.002, 0.09],
  [-0.2, 0.007, -0.02],
  [-0.205, 0.04, -0.16],
  [-0.19, 0.09, -0.32],
  [-0.13, 0.115, -0.42],
  [-0.035, 0.13, -0.44],
  [0.065, 0.135, -0.4],
  [0.15, 0.13, -0.32],
  [0.165, 0.12, -0.2],
  [0.14, 0.1, -0.11],
];
export const RAMP_SAMPLES = new THREE.CatmullRomCurve3(
  RAMP_POINTS.map((p) => new THREE.Vector3(...p)),
).getPoints(80);

export function makeTable(): Part[] {
  const parts: Part[] = [];
  const box = (
    id: string,
    position: Point,
    size: Point,
    role: Part["role"] = "rail",
    color = "#a6bdc9",
    rotation?: Point,
  ) => parts.push({ id, kind: "box", position, size, role, color, rotation });
  box("playfield", [0, -0.015, 0], [0.62, 0.03, 1.22], "deck", "#102d38");
  box("left-wall", [-0.309, 0.035, 0], [0.02, 0.09, 1.22]);
  box("right-wall", [0.309, 0.035, 0], [0.02, 0.09, 1.22]);
  box("back-wall", [0, 0.035, -0.607], [0.62, 0.09, 0.02]);
  // End before the orbit starts to turn inward; clearance stays >2 ball diameters.
  box("shooter-guide", [0.229, 0.025, 0.14], [0.009, 0.06, 0.75]);
  box("shooter-stop", [0.276, 0.025, 0.535], [0.063, 0.06, 0.015]);
  const segment = (
    id: string,
    a: THREE.Vector3,
    b: THREE.Vector3,
    width = 0.012,
    height = 0.055,
    color = "#9db8c8",
  ) => {
    const d = b.clone().sub(a);
    box(
      id,
      [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2],
      [d.length() + 0.004, height, width],
      "rail",
      color,
      [0, -Math.atan2(d.z, d.x), 0],
    );
  };
  // The physical outer orbit turns a vertical plunge across the crown into the field.
  for (let i = 0; i < 32; i++) {
    const point = (n: number) =>
      new THREE.Vector3(
        0.294 * Math.cos((n / 32) * Math.PI),
        0.033,
        -0.32 - 0.265 * Math.sin((n / 32) * Math.PI),
      );
    segment(`orbit-${i}`, point(i), point(i + 1));
  }
  for (const sign of [-1, 1]) {
    segment(
      `return-${sign}`,
      new THREE.Vector3(sign * (sign === 1 ? 0.216 : 0.288), 0.024, 0.245),
      new THREE.Vector3(sign * 0.13, 0.024, 0.408),
      0.013,
      0.045,
    );
    // Each triangle is a real three-band slingshot. The slim collider rails
    // use the same points as the visible red rubber tubes in TableView.
    const triangle = [
      new THREE.Vector3(sign * 0.205, 0.025, 0.188),
      new THREE.Vector3(sign * 0.211, 0.025, 0.246),
      new THREE.Vector3(sign * 0.142, 0.025, 0.274),
    ];
    for (let edge = 0; edge < triangle.length; edge++) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % triangle.length];
      const d = b.clone().sub(a);
      box(
        `sling-${sign}-${edge}`,
        [(a.x + b.x) / 2, 0.028, (a.z + b.z) / 2],
        [d.length() + 0.004, 0.030, 0.014],
        "sling",
        "#e84232",
        [0, -Math.atan2(d.z, d.x), 0],
      );
    }
  }
  for (const b of BUMPERS)
    parts.push({
      id: b.id,
      kind: "cylinder",
      position: [b.x, 0.03, b.z],
      radius: 0.032,
      height: 0.06,
      role: "bumper",
      color: b.color,
    });
  for (const feature of FEATURE_TARGETS) {
    if (feature.kind === "scoop" || feature.kind === "printer") {
      parts.push({
        id: feature.id,
        kind: "cylinder",
        position: [feature.x, 0.026, feature.z],
        radius: feature.kind === "printer" ? 0.030 : 0.036,
        height: feature.kind === "printer" ? 0.052 : 0.034,
        role: "target",
        color: feature.color,
      });
    } else if (feature.kind === "chest") {
      box(feature.id, [feature.x, 0.030, feature.z], [0.062, 0.050, 0.035], "target", feature.color);
    } else {
      box(feature.id, [feature.x, 0.026, feature.z], [0.026, 0.042, 0.012], "target", feature.color);
    }
  }
  for (const target of BONUS_TARGETS) {
    if (target.id === "black-budget") {
      parts.push({
        id: target.id,
        kind: "cylinder",
        position: [target.x, 0.019, target.z],
        radius: 0.02,
        height: 0.038,
        role: "target",
        color: "#222c36",
      });
    } else if (target.id === "ramp-review") {
      box(target.id, [target.x, 0.145, target.z], [0.065, 0.045, 0.020], "sensor", target.color);
    } else {
      box(
        target.id,
        [target.x, 0.026, target.z],
        [0.038, 0.040, 0.014],
        "target",
        target.color,
      );
    }
  }
  for (const [index, x, z] of [
    [0, 0.11, 0.205],
    [1, 0.168, -0.055],
  ]) {
    parts.push({
      id: `rubber-post-${index}`,
      kind: "cylinder",
      position: [x, 0.023, z],
      radius: 0.011,
      height: 0.046,
      role: "rail",
      color: "#e4dac4",
    });
  }
  // Each ramp tile is a convex solid from the same edge vertices used to render it.
  const width = 0.074;
  const edges = RAMP_SAMPLES.map((p, i) => {
    const d = RAMP_SAMPLES[Math.min(i + 1, 80)]
      .clone()
      .sub(RAMP_SAMPLES[Math.max(0, i - 1)])
      .normalize();
    const lateral = new THREE.Vector3(-d.z, 0, d.x)
      .normalize()
      .multiplyScalar(width / 2);
    return [p.clone().add(lateral), p.clone().sub(lateral)];
  });
  const surfaceVertices: number[] = [],
    surfaceIndices: number[] = [];
  for (const pair of edges)
    for (const p of pair) surfaceVertices.push(p.x, p.y, p.z);
  for (let i = 0; i < 80; i++) {
    const [a, b] = edges[i];
    const [c, d] = edges[i + 1];
    const vertices: number[] = [];
    for (const y of [0, -0.008])
      for (const p of [a, b, c, d]) vertices.push(p.x, p.y + y, p.z);
    surfaceIndices.push(
      i * 2,
      i * 2 + 2,
      i * 2 + 1,
      i * 2 + 1,
      i * 2 + 2,
      i * 2 + 3,
    );
    for (let side = 0; side < 2; side++) {
      const p = edges[i][side],
        q = edges[i + 1][side];
      const verts: number[] = [];
      for (const offset of [-0.003, 0.003])
        for (const y of [0, 0.042])
          for (const v of [p, q]) verts.push(v.x + offset, v.y + y, v.z);
      parts.push({
        id: `ramp-guard-${i}-${side}`,
        kind: "hull",
        position: [0, 0, 0],
        vertices: verts,
        role: "rail",
        color: "#6edcec",
      });
    }
  }
  parts.push({
    id: "ramp-surface",
    kind: "surface",
    position: [0, 0, 0],
    vertices: surfaceVertices,
    indices: surfaceIndices,
    role: "ramp",
    color: "#164853",
  });
  return parts;
}
export const TABLE_PARTS = makeTable();
