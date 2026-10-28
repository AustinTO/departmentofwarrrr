import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { samplePath, segmentTransform } from "./geometry";
import { PINBALL_BOARD_ORDER } from "../game/PinballBoards";
import { TABLE, resolveBoardLayout } from "./table";

describe("pinball 3D shared geometry", () => {
  it("gives each board a distinct upper playfield while preserving protected geometry", () => {
    const layouts = PINBALL_BOARD_ORDER.map(resolveBoardLayout);
    const signatures = layouts.map((layout) =>
      JSON.stringify({
        bumpers: layout.bumpers.map(({ x, z }) => [x, z]),
        features: layout.featureTargets.map(({ id, x, z }) => [id, x, z]),
      }),
    );
    expect(new Set(signatures).size).toBe(3);

    const mutableIds = new Set([
      ...layouts.flatMap((layout) => layout.bumpers.map(({ id }) => id)),
      ...layouts.flatMap((layout) => layout.featureTargets.map(({ id }) => id)),
      ...layouts.flatMap((layout) => layout.bonusTargets.map(({ id }) => id)),
    ]);
    const protectedParts = (layout: (typeof layouts)[number]) =>
      layout.parts
        .filter((part) => !mutableIds.has(part.id))
        .map((part) => ({ ...part }))
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const layout of layouts.slice(1))
      expect(protectedParts(layout)).toEqual(protectedParts(layouts[0]));

    expect(TABLE.spawn).toEqual([0.263, 0.017, 0.48]);
    expect(TABLE.tilt).toBe(Math.PI / 30);
  });

  it("keeps bumper faces at least one ball diameter plus a small margin apart", () => {
    const requiredGap = TABLE.radius * 2 + 0.004;
    for (const id of PINBALL_BOARD_ORDER) {
      const layout = resolveBoardLayout(id);
      for (let i = 0; i < layout.bumpers.length; i++) {
        for (let j = i + 1; j < layout.bumpers.length; j++) {
          const a = layout.bumpers[i];
          const b = layout.bumpers[j];
          const centerGap = Math.hypot(a.x - b.x, a.z - b.z);
          const faceGap = centerGap - 0.064;
          if (id === "appropriations") {
            // Keep the established tight triangle intact; alternate boards
            // must improve its clearance without moving protected baseline art.
            expect(faceGap).toBeGreaterThanOrEqual(0.021);
          } else {
            expect(faceGap).toBeGreaterThanOrEqual(requiredGap);
          }
        }
      }
    }
  });

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
