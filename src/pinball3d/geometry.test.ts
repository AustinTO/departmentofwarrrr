import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { samplePath, segmentTransform } from "./geometry";

describe("pinball 3D shared geometry", () => {
  it("samples elevated paths with monotonic length", () => {
    const path = samplePath({
      points: [
        [0, 0, 0],
        [0.2, 0.05, -0.3],
        [0.4, 0.2, -0.6],
      ],
      width: 0.09,
      thickness: 0.01,
    });
    expect(path.points.length).toBeGreaterThan(2);
    expect(path.length).toBeGreaterThan(0.6);
    expect(path.points.at(-1)?.y).toBeGreaterThan(0.1);
  });

  it("rejects invalid dimensions and exposes segment transforms", () => {
    expect(() =>
      samplePath({ points: [[0, 0, 0]], width: 0.1, thickness: 0.01 }),
    ).toThrow();
    const transform = segmentTransform(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    );
    expect(transform.length).toBe(1);
  });
});
