// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { PinballPhysics } from "./PinballPhysics";
import { TABLE } from "./table";

let physics: PinballPhysics | undefined;
afterEach(() => physics?.dispose());
const idle = { left: false, right: false };
async function create() {
  physics = await PinballPhysics.create();
  return physics;
}
describe("real Rapier playability", () => {
  it("supports a falling ball on the inclined deck instead of draining through it", async () => {
    const p = await create();
    p.setBall([0, 0.08, 0.18]);
    for (let i = 0; i < 40; i++) p.step(1 / 120, idle, false);
    expect(p.ballPosition.y).toBeGreaterThan(0.01);
    expect(p.ballPosition.y).toBeLessThan(0.022);
    expect(p.state).toBe("playing");
  });
  it("holds the ball until launch and rejects a second launch during play", async () => {
    const p = await create();
    for (let i = 0; i < 300; i++) p.step(1 / 120, idle);
    expect(p.ballPosition.z).toBeCloseTo(TABLE.spawn[2], 4);
    expect(p.launch(0.7)).toBe(true);
    expect(p.launch(0.7)).toBe(false);
  });
  it.each([0, 0.2, 0.35, 0.5, 0.7, 0.85, 1])(
    "launch power %s clears the full shooter exit",
    async (power) => {
      const p = await create();
      p.launch(power);
      let minZ = 1,
        minX = 1;
      for (let i = 0; i < 600 && p.state === "playing"; i++) {
        p.step(1 / 120, idle, false);
        minZ = Math.min(minZ, p.ballPosition.z);
        minX = Math.min(minX, p.ballPosition.x);
      }
      expect(minZ).toBeLessThan(-0.42);
      expect(minX).toBeLessThan(0.18);
    },
  );
  it("contains a fast shot at each side wall", async () => {
    const p = await create();
    for (const sign of [-1, 1]) {
      p.setBall([sign * 0.26, 0.018, -0.2], [sign * 6, 0, 0]);
      for (let i = 0; i < 12; i++) p.step(1 / 120, idle, false);
      expect(Math.abs(p.ballPosition.x)).toBeLessThan(0.3);
      expect(p.state).toBe("playing");
    }
  });
  it.each(["left", "right"] as const)(
    "%s flipper sends a fed ball upfield from its outer pivot",
    async (side) => {
      const p = await create();
      const sign = side === "left" ? 1 : -1;
      p.setBall([-sign * 0.072, 0.018, 0.409], [0, 0, 0.25]);
      let minV = 0;
      for (let i = 0; i < 24; i++) {
        p.step(
          1 / 120,
          { left: side === "left", right: side === "right" },
          false,
        );
        minV = Math.min(minV, p.velocity.z);
      }
      expect(minV).toBeLessThan(-0.8);
    },
  );
  it("rolls up the elevated ramp and reaches the exit without path-following", async () => {
    const p = await create();
    p.setBall([-0.185, 0.015, 0.135], [-0.12, 0, -2.8]);
    let maxY = 0,
      complete = false;
    for (let i = 0; i < 400; i++) {
      p.step(1 / 120, idle, false);
      maxY = Math.max(maxY, p.ballPosition.y);
      complete ||= p.drainEvents().some((e) => e.type === "ramp");
      if (p.state !== "playing") break;
    }
    expect(maxY).toBeGreaterThan(0.12);
    expect(complete).toBe(true);
  });
  it("emits one drain and cannot score while parked", async () => {
    const p = await create();
    p.setBall([0, 0.018, 0.59], [0, 0, 1]);
    for (let i = 0; i < 100; i++) p.step(1 / 120, idle, false);
    expect(p.drainEvents().filter((e) => e.type === "drain")).toHaveLength(1);
    p.reset();
    for (let i = 0; i < 100; i++) p.step(1 / 120, idle, false);
    expect(p.drainEvents()).toEqual([]);
  });
});
