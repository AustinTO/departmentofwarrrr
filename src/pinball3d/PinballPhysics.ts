import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Euler, Vector3 } from "three";
import {
  TABLE,
  TABLE_PARTS,
  FLIPPERS,
  FEATURE_TARGETS,
  TELEPORTERS,
  flipperVertices,
  type Point,
  type Part,
} from "./table";

export type Side = "left" | "right";
export type PhysicsEvent = {
  type: "hit" | "drain" | "ramp" | "launch" | "save" | "unstuck" | "teleport";
  id: string;
};
const tilt = new Quaternion().setFromEuler(new Euler(TABLE.tilt, 0, 0));
const inverse = tilt.clone().invert();
let initialized: Promise<void> | undefined;
export function worldPoint(p: Point) {
  return new Vector3(...p).applyQuaternion(tilt);
}

export class PinballPhysics {
  readonly world: RAPIER.World;
  readonly ball: RAPIER.RigidBody;
  private readonly queue = new RAPIER.EventQueue(true);
  private readonly colliderIds = new Map<number, Part>();
  private readonly bats = {} as Record<Side, RAPIER.RigidBody>;
  readonly flipperAngles = {
    left: FLIPPERS.left.rest,
    right: FLIPPERS.right.rest,
  };
  private angularSpeed = { left: 0, right: 0 };
  private events: PhysicsEvent[] = [];
  private cooldown = new Map<string, number>();
  private time = 0;
  private launchedAt = 0;
  private rampArmed = false;
  private lastMotionAt = 0;
  private unstuckSide = -1;
  private teleportLockedUntil = 0;
  state: "ready" | "playing" | "drained" = "ready";
  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.numSolverIterations = 8;
    this.world.integrationParameters.normalizedAllowedLinearError = 0.0001;
    this.world.integrationParameters.normalizedPredictionDistance = 0.0005;
    this.world.maxCcdSubsteps = 4;
    const structure = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setRotation(tilt),
    );
    for (const part of TABLE_PARTS) {
      // The lower approval bank is a through-target: it emits from proximity
      // and deliberately has no physics collider to interfere with the shot.
      if (part.id.startsWith("drop-")) continue;
      let desc: RAPIER.ColliderDesc;
      if (part.kind === "box")
        desc = RAPIER.ColliderDesc.cuboid(
          part.size![0] / 2,
          part.size![1] / 2,
          part.size![2] / 2,
        );
      else if (part.kind === "cylinder")
        desc = RAPIER.ColliderDesc.cylinder(part.height! / 2, part.radius!);
      else if (part.kind === "surface")
        desc = RAPIER.ColliderDesc.trimesh(
          new Float32Array(part.vertices!),
          new Uint32Array(part.indices!),
          RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
        );
      else
        desc = RAPIER.ColliderDesc.convexHull(
          new Float32Array(part.vertices!),
        )!;
      if (!desc) throw new Error(`Invalid hull: ${part.id}`);
      desc
        .setTranslation(...part.position)
        .setFriction(part.role === "ramp" ? 0.025 : 0.1)
        .setRestitution(
          part.role === "deck" ||
            part.role === "ramp" ||
            part.id.startsWith("orbit")
            ? 0.1
            : 0.65,
        );
      if (part.rotation)
        desc.setRotation(
          new Quaternion().setFromEuler(new Euler(...part.rotation)),
        );
      if (part.role === "sensor") desc.setSensor(true);
      desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const col = this.world.createCollider(desc, structure);
      this.colliderIds.set(col.handle, part);
    }
    // Ball height remains free: a physical ceiling prevents unrealistic ejection, like cabinet glass.
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.31, 0.01, 0.61).setTranslation(0, 0.24, 0),
      structure,
    );
    for (const side of ["left", "right"] as Side[]) {
      const f = FLIPPERS[side],
        p = worldPoint(f.pivot);
      const q = tilt
        .clone()
        .multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), f.rest),
        );
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(p.x, p.y, p.z)
          .setRotation(q),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.convexHull(
          new Float32Array(flipperVertices(f.sign)),
        )!
          .setFriction(0.65)
          .setRestitution(0.45),
        body,
      );
      this.bats[side] = body;
    }
    const p = worldPoint(TABLE.spawn);
    this.ball = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setLinearDamping(0.025)
        .setAngularDamping(0.05),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(TABLE.radius)
        .setMass(TABLE.mass)
        .setFriction(0.12)
        .setRestitution(0.25)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ball,
    );
    this.reset();
  }
  static async create() {
    initialized ??= RAPIER.init();
    await initialized;
    return new PinballPhysics();
  }
  get ballPosition() {
    const p = this.ball.translation();
    return new Vector3(p.x, p.y, p.z).applyQuaternion(inverse);
  }
  get ballQuaternion() {
    const q = this.ball.rotation();
    return inverse.clone().multiply(new Quaternion(q.x, q.y, q.z, q.w));
  }
  get velocity() {
    const v = this.ball.linvel();
    return new Vector3(v.x, v.y, v.z).applyQuaternion(inverse);
  }
  setBall(position: Point, velocity: Point = [0, 0, 0]) {
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ball.setTranslation(worldPoint(position), true);
    this.ball.setLinvel(worldPoint(velocity), true);
    this.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.state = "playing";
    this.rampArmed = false;
    this.lastMotionAt = this.time;
  }
  reset() {
    this.setBall(TABLE.spawn);
    this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    this.state = "ready";
    this.rampArmed = false;
  }
  launch(power = 0.7) {
    if (this.state !== "ready") return false;
    this.setBall(TABLE.spawn, [
      0,
      0,
      -(2.6 + Math.max(0, Math.min(1, power)) * 1.1),
    ]);
    this.launchedAt = this.time;
    this.events.push({ type: "launch", id: "plunger" });
    return true;
  }
  step(dt: number, input: { left: boolean; right: boolean }, ballSave = true) {
    this.time += dt;
    this.world.timestep = dt;
    for (const side of ["left", "right"] as Side[]) {
      const f = FLIPPERS[side],
        target = input[side] ? f.active : f.rest,
        diff = target - this.flipperAngles[side];
      const desiredSpeed = Math.sign(diff) * (input[side] ? f.pressSpeed : f.returnSpeed);
      const acceleration = input[side] ? f.pressAcceleration : f.returnAcceleration;
      const speedDelta = Math.max(-acceleration * dt, Math.min(acceleration * dt, desiredSpeed - this.angularSpeed[side]));
      this.angularSpeed[side] += speedDelta;
      const delta = this.angularSpeed[side] * dt;
      if (
        Math.abs(delta) >= Math.abs(diff) &&
        Math.sign(delta) === Math.sign(diff)
      ) {
        this.flipperAngles[side] = target;
        this.angularSpeed[side] = 0;
      } else this.flipperAngles[side] += delta;
      this.bats[side].setNextKinematicRotation(
        tilt
          .clone()
          .multiply(
            new Quaternion().setFromAxisAngle(
              new Vector3(0, 1, 0),
              this.flipperAngles[side],
            ),
          ),
      );
    }
    this.world.step(this.queue);
    this.queue.drainCollisionEvents((a, b, started) => {
      if (!started || this.state !== "playing") return;
      const part = this.colliderIds.get(a) ?? this.colliderIds.get(b);
      if (!part || !["bumper", "target", "sensor", "sling"].includes(part.role)) return;
      const portal = TELEPORTERS.find((entry) => entry.id === part.id);
      if (portal) {
        if (this.time < this.teleportLockedUntil) return;
        const exit = TELEPORTERS.find((entry) => entry.id === portal.exitId)!;
        const velocity = this.velocity;
        this.ball.setTranslation(worldPoint([exit.x, 0.048, exit.z]), true);
        this.ball.setLinvel(
          worldPoint([
            velocity.x * 0.84 + (exit.x > 0 ? -0.16 : 0.16),
            Math.max(velocity.y * 0.35, 0.10),
            Math.min(velocity.z * 0.84, -0.75),
          ]),
          true,
        );
        this.teleportLockedUntil = this.time + 0.45;
        this.lastMotionAt = this.time;
        this.events.push({ type: "teleport", id: portal.id });
        return;
      }
      if (part.id === "contract-award") {
        // The Award scoop is a sensor plus kicker: never leave the ball inside
        // a visual hole without an explicit, playable eject trajectory.
        this.ball.setTranslation(worldPoint([0.02, 0.075, -0.40]), true);
        this.ball.setLinvel(worldPoint([0.28, 0.12, 0.95]), true);
        this.lastMotionAt = this.time;
        this.events.push({ type: "hit", id: "contract-award" });
        return;
      }
      if ((this.cooldown.get(part.id) ?? -1) > this.time) return;
      this.cooldown.set(part.id, this.time + 0.16);
      this.events.push({ type: "hit", id: part.id });
      if (part.role === "bumper" || part.role === "sling") {
        const p = this.ballPosition;
        const origin =
          part.role === "bumper"
            ? new Vector3(...part.position)
            : new Vector3(part.id.endsWith("-1") ? -0.2 : 0.2, 0, 0.2);
        const d = p.sub(origin);
        d.y = 0;
        if (part.role === "sling") {
          d.set(part.id.includes("--1") ? 0.22 : -0.22, 0, -0.52)
            .normalize()
            .multiplyScalar(0.13);
        } else d.normalize().multiplyScalar(0.1);
        this.ball.applyImpulse(d.applyQuaternion(tilt), true);
      }
    });
    if (this.state !== "playing") return;
    const p = this.ballPosition;
    for (const feature of FEATURE_TARGETS) {
      if (feature.kind !== "drop") continue;
      if (p.distanceTo(new Vector3(feature.x, 0.02, feature.z)) < 0.032 && (this.cooldown.get(feature.id) ?? -1) <= this.time) {
        this.cooldown.set(feature.id, this.time + 0.28);
        this.events.push({ type: "hit", id: feature.id });
      }
    }
    if (p.x < -0.15 && p.z < -0.02 && p.z > -0.18 && p.y > 0.026)
      this.rampArmed = true;
    if (this.rampArmed && p.x > 0.1 && p.z > -0.16 && p.y > 0.075) {
      this.events.push({ type: "ramp", id: "supplemental" });
      this.rampArmed = false;
    }
    const v = this.ball.linvel(),
      speed = Math.hypot(v.x, v.y, v.z);
    if (speed > 0.085) this.lastMotionAt = this.time;
    if (speed > 8)
      this.ball.setLinvel(
        { x: (v.x * 8) / speed, y: (v.y * 8) / speed, z: (v.z * 8) / speed },
        true,
      );
    if (p.x > 0.232 && p.z < 0.27 && p.z > -0.38 && v.z > 0) {
      this.ball.setTranslation({ x: 0.205, y: p.y, z: p.z }, true);
      this.ball.setLinvel({ x: -0.35, y: Math.max(v.y, 0.02), z: -0.65 }, true);
      this.lastMotionAt = this.time;
    }
    if (this.time - this.lastMotionAt > 2.4 && p.z < 0.58) {
      this.unstuckSide *= -1;
      this.ball.applyImpulse(
        new Vector3(this.unstuckSide * 0.025, 0.008, -0.16).applyQuaternion(tilt),
        true,
      );
      this.lastMotionAt = this.time;
      this.events.push({ type: "unstuck", id: "marshal-nudge" });
    }
    if (p.z > 0.61 || p.y < -0.1 || Math.abs(p.x) > 0.4) {
      if (ballSave && this.time - this.launchedAt < 8) {
        this.reset();
        this.events.push({ type: "save", id: "ball-save" });
      } else {
        this.state = "drained";
        this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true);
        this.events.push({ type: "drain", id: "drain" });
      }
    }
  }
  drainEvents() {
    const result = this.events;
    this.events = [];
    return result;
  }
  dispose() {
    this.queue.free();
    this.world.free();
  }
}
