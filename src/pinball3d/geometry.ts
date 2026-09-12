import * as THREE from "three";

export type Vec3Tuple = readonly [number, number, number];

export interface PathSpec {
  points: readonly Vec3Tuple[];
  width: number;
  thickness: number;
  bank?: number;
}

export interface SampledPath {
  points: THREE.Vector3[];
  tangents: THREE.Vector3[];
  length: number;
}

export function samplePath(spec: PathSpec, subdivisions = 8): SampledPath {
  if (spec.points.length < 2)
    throw new Error("A pinball path needs at least two points");
  if (!(spec.width > 0) || !(spec.thickness > 0))
    throw new Error("Path dimensions must be positive");
  const source = spec.points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(source, false, "centripetal");
  const count = Math.max(2, (source.length - 1) * subdivisions + 1);
  const points = curve.getPoints(count - 1);
  const tangents = points.map((_point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    return after.clone().sub(before).normalize();
  });
  let length = 0;
  for (let index = 1; index < points.length; index += 1)
    length += points[index].distanceTo(points[index - 1]);
  return { points, tangents, length };
}

export function segmentTransform(
  a: THREE.Vector3,
  b: THREE.Vector3,
): { midpoint: THREE.Vector3; length: number; quaternion: THREE.Quaternion } {
  const delta = b.clone().sub(a);
  const length = delta.length();
  if (length < 1e-5) throw new Error("Path contains a zero-length segment");
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    delta.normalize(),
  );
  return { midpoint: a.clone().add(b).multiplyScalar(0.5), length, quaternion };
}
