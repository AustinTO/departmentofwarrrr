import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  TABLE,
  TABLE_PARTS,
  BUMPERS,
  BONUS_TARGETS,
  COMMITTEE_TARGET_IDS,
  RAMP_SAMPLES,
  FLIPPERS,
  flipperVertices,
  type Part,
} from "./table";
import type { PinballPhysics, Side } from "./PinballPhysics";

function hull(vertices: number[]) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < vertices.length; i += 3)
    points.push(
      new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]),
    );
  return new ConvexGeometry(points);
}
function geometry(p: Part) {
  if (p.kind === "surface") {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(p.vertices!, 3),
    );
    g.setIndex(p.indices!);
    g.computeVertexNormals();
    return g;
  }
  return p.kind === "box"
    ? new THREE.BoxGeometry(...p.size!)
    : p.kind === "cylinder"
      ? new THREE.CylinderGeometry(p.radius!, p.radius!, p.height!, 24)
      : hull(p.vertices!);
}
function paintTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  paint(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** All colliding shapes are rendered from table.ts. The remaining meshes are decoration. */
export class TableView {
  readonly scene = new THREE.Scene();
  readonly table = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(28, 9 / 16, 0.01, 10);
  readonly ball: THREE.Mesh;
  readonly flippers = {} as Record<Side, THREE.Group>;
  private shadow: THREE.Mesh;
  private flashes = new Map<string, number>();
  private lamps = new Map<string, THREE.MeshStandardMaterial>();
  private bumperAssemblies = new Map<string, THREE.Group>();
  private slingBands = new Map<string, THREE.Group>();
  private debugLines?: THREE.LineSegments;
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private plunger = new THREE.Group();
  private bumperLights = new Map<string, THREE.PointLight>();
  private cameraActionRemaining = 0;
  constructor() {
    this.scene.background = new THREE.Color("#08251d");
    this.table.rotation.x = TABLE.tilt;
    this.scene.add(this.table);
    this.camera.position.set(0, 1.85, 1.65);
    this.camera.lookAt(0, 0, -0.015);
    this.scene.add(new THREE.HemisphereLight("#d0eeef", "#283547", 2.0));
    const light = new THREE.DirectionalLight("#ffdfa0", 3.4);
    light.position.set(-1, 2, 1);
    this.scene.add(light);
    // Group static geometry by material: a curved ramp has many simple physical
    // segments but only a few GPU draw calls.
    const batches = new Map<string, THREE.BufferGeometry[]>();
    for (const part of TABLE_PARTS) {
      const source = geometry(part);
      const g = source.index ? source.toNonIndexed() : source;
      if (g !== source) source.dispose();
      if (part.rotation)
        g.applyMatrix4(
          new THREE.Matrix4().makeRotationFromEuler(
            new THREE.Euler(...part.rotation),
          ),
        );
      g.translate(...part.position);
      const key = part.color;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(g);
    }
    for (const [color, shapes] of batches) {
      const combined = mergeGeometries(shapes);
      const mesh = new THREE.Mesh(combined, this.material(color));
      this.table.add(mesh);
      for (const g of shapes) g.dispose();
    }
    this.skinRamp();
    this.decorate();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.09, 12),
      this.material("#b9cbd4"),
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.042;
    this.plunger.add(shaft);
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.016, 24),
      this.material("#d3423a"),
    );
    knob.rotation.x = Math.PI / 2;
    this.plunger.add(knob);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 16, 10),
      this.material("#edb75d"),
    );
    crown.scale.z = 0.35;
    crown.position.z = 0.01;
    this.plunger.add(crown);
    this.plunger.position.set(0.273, 0.024, 0.565);
    this.table.add(this.plunger);
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(TABLE.radius, 24, 16),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        metalness: 0.48,
        roughness: 0.16,
        emissive: "#b9e7ea",
        emissiveIntensity: 0.22,
      }),
    );
    this.ball.name = "Procurement ball";
    this.table.add(this.ball);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.019, 24),
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.table.add(this.shadow);
    for (const side of ["left", "right"] as Side[]) {
      const f = FLIPPERS[side],
        group = new THREE.Group();
      group.position.set(...f.pivot);
      const bat = new THREE.Mesh(
        hull(flipperVertices(f.sign)),
        this.material("#f4e5c7"),
      );
      group.add(bat);
      const top = new THREE.Mesh(
        hull(flipperVertices(f.sign)),
        this.material(side === "left" ? "#38bfae" : "#ed775e"),
      );
      top.scale.set(0.91, 0.15, 0.75);
      top.position.y = 0.017;
      group.add(top);
      const pivot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.006, 20),
        this.material("#dab77c"),
      );
      pivot.position.y = 0.022;
      group.add(pivot);
      this.flippers[side] = group;
      this.table.add(group);
    }
  }
  private material(color: string) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          metalness: color === "#d1ab61" || color === "#b9904c" ? 0.65 : 0.22,
          roughness: 0.38,
        }),
      );
    return this.materials.get(color)!;
  }
  private skinRamp() {
    const rampGroup = new THREE.Group();
    rampGroup.name = "Supplemental funding ramp skin";
    for (let i = 4; i < RAMP_SAMPLES.length - 2; i += 8) {
      const point = RAMP_SAMPLES[i];
      const next = RAMP_SAMPLES[i + 1];
      const tangent = next.clone().sub(point);
      const length = tangent.length();
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(length * 0.72, 0.004, 0.052),
        this.material(i % 16 === 4 ? "#d8b85e" : "#246b72"),
      );
      panel.position.copy(point);
      panel.position.y += 0.006;
      panel.rotation.y = -Math.atan2(tangent.z, tangent.x);
      rampGroup.add(panel);
      if (i % 16 === 4) {
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.011, 0.025, 3),
          this.material("#f5e6a8"),
        );
        arrow.rotation.z = Math.PI / 2;
        arrow.rotation.y = -Math.atan2(tangent.z, tangent.x);
        arrow.position.copy(point);
        arrow.position.y += 0.011;
        rampGroup.add(arrow);
      }
    }
    this.table.add(rampGroup);
  }
  private text(
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    color = "#e9d5a4",
    height = 0.026,
  ) {
    const texture = paintTexture(512, 96, (c) => {
      c.clearRect(0, 0, 512, 96);
      c.fillStyle = color;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "bold 44px Georgia";
      c.fillText(text, 256, 48, 500);
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.table.add(mesh);
    return mesh;
  }
  private decorate() {
    const texture = paintTexture(1024, 2048, (c) => {
      c.fillStyle = "#073d2c";
      c.fillRect(0, 0, 1024, 2048);
      const gradient = c.createLinearGradient(0, 0, 1024, 2048);
      gradient.addColorStop(0, "#063727");
      gradient.addColorStop(0.55, "#0b543b");
      gradient.addColorStop(1, "#063527");
      c.fillStyle = gradient;
      c.fillRect(0, 0, 1024, 2048);
      // Deterministic fine enamel grain recalls the painted green original.
      let seed = 741;
      for (let i = 0; i < 85000; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x = seed % 1024;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const y = seed % 2048;
        c.fillStyle = i % 2 ? "#8eb48214" : "#00271928";
        c.fillRect(x, y, 1, 1);
      }
      c.strokeStyle = "#ad9651";
      c.lineWidth = 4;
      c.strokeRect(35, 38, 954, 1972);
      c.lineWidth = 1;
      c.strokeRect(45, 48, 934, 1952);
      // Original military-star motif painted ON the actual playfield.
      c.save();
      c.translate(512, 930);
      c.strokeStyle = "#bcab4d44";
      c.lineWidth = 7;
      for (const r of [265, 294]) {
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 108 : 237;
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fillStyle = "#acac4d35";
      c.fill();
      c.restore();
      c.textAlign = "center";
      c.fillStyle = "#e5cb65";
      c.font = "bold 27px sans-serif";
      c.fillText("DEPARTMENT OF WARRR", 512, 1510);
      c.font = "bold 24px sans-serif";
      c.fillStyle = "#81d9ca";
      c.fillText("FOLLOW THE MONEY", 512, 1325);
      c.strokeStyle = "#52cdb184";
      c.lineWidth = 5;
      for (const x of [290, 734]) {
        c.beginPath();
        c.moveTo(x, 1470);
        c.lineTo(x, 1270);
        c.stroke();
        c.beginPath();
        c.moveTo(x - 12, 1290);
        c.lineTo(x, 1270);
        c.lineTo(x + 12, 1290);
        c.stroke();
      }
      c.fillStyle = "#beaa7b";
      c.font = "20px sans-serif";
      c.fillText("MONEY NOW. CAPABILITY LATER.", 512, 1910);
    });
    const fieldMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.68,
      metalness: 0.08,
    });
    new THREE.TextureLoader().load("/assets/pinball/playfield.png", (original) => {
      original.colorSpace = THREE.SRGBColorSpace;
      original.anisotropy = 4;
      fieldMaterial.map = original;
      fieldMaterial.needsUpdate = true;
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), fieldMaterial);
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0.0007;
    this.table.add(field);
    // Cabinet trim and apron frame the physical playfield.
    for (const x of [-0.328, 0.328]) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(0.027, 0.09, 1.27),
        this.material("#352315"),
      );
      g.position.set(x, -0.02, 0);
      this.table.add(g);
    }
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.023, 0.105),
      this.material("#172b36"),
    );
    apron.position.set(0, 0.009, 0.555);
    this.table.add(apron);
    this.text("APPROVED IN PRINCIPLE", 0, 0.022, 0.558, 0.36, "#b5a17a", 0.023);
    const detailBox = (
      size: [number, number, number],
      position: [number, number, number],
      color: string,
    ) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        this.material(color),
      );
      m.position.set(...position);
      this.table.add(m);
      return m;
    };
    for (const sign of [-1, 1]) {
      const sling = new THREE.Group();
      const points = [
        new THREE.Vector3(sign * 0.205, 0.047, 0.188),
        new THREE.Vector3(sign * 0.211, 0.047, 0.246),
        new THREE.Vector3(sign * 0.142, 0.047, 0.274),
      ];
      for (let edge = 0; edge < points.length; edge++) {
        const curve = new THREE.LineCurve3(points[edge], points[(edge + 1) % points.length]);
        sling.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.008, 8, false), this.material("#e84232")));
        const highlight = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.0035, 8, false), this.material("#ff9b80"));
        highlight.position.y = 0.002;
        sling.add(highlight);
      }
      for (const point of points.slice(0, 3)) {
        const peg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.009, 0.032, 12),
          this.material("#d7d4c5"),
        );
        peg.position.copy(point);
        peg.position.y = 0.020;
        sling.add(peg);
      }
      this.table.add(sling);
      this.slingBands.set(`sling-${sign}`, sling);
    }
    // A dedicated plaque texture preserves readable title and division lines;
    // it is raised above the orbit so the rails cannot slice through its text.
    detailBox([0.52, 0.014, 0.105], [-0.015, 0.096, -0.561], "#a5bbc6");
    const plaqueTexture = paintTexture(1024, 224, (c) => {
      c.fillStyle = "#10372e";
      c.fillRect(0, 0, 1024, 224);
      c.strokeStyle = "#b7a451";
      c.lineWidth = 5;
      c.strokeRect(12, 12, 1000, 200);
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#f4d454";
      c.font = "bold 67px Georgia";
      c.fillText("★ APPROPRIATIONS ★", 512, 72, 960);
      c.fillStyle = "#9bc6ae";
      c.font = "bold 29px Arial";
      c.fillText("DEPARTMENT OF WARRR", 512, 142);
      c.font = "24px Arial";
      c.fillText(
        "PROCUREMENT DIVISION • MONEY NOW, CAPABILITY LATER",
        512,
        182,
        950,
      );
    });
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.505, 0.096),
      new THREE.MeshBasicMaterial({ map: plaqueTexture }),
    );
    plaque.rotation.x = -Math.PI / 2;
    plaque.position.set(-0.015, 0.105, -0.561);
    this.table.add(plaque);
    for (const b of BUMPERS) {
      const assembly = new THREE.Group();
      assembly.position.set(b.x, 0, b.z);
      this.table.add(assembly);
      this.bumperAssemblies.set(b.id, assembly);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.053, 0.047, 0.012, 32),
        this.material("#1c2a32"),
      );
      base.position.y = 0.006;
      assembly.add(base);
      const chromeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.047, 0.0035, 8, 32),
        this.material("#d8e0d3"),
      );
      chromeRing.rotation.x = Math.PI / 2;
      chromeRing.position.y = 0.014;
      assembly.add(chromeRing);
      const rubber = new THREE.Mesh(
        new THREE.TorusGeometry(0.041, 0.007, 10, 32),
        this.material("#182127"),
      );
      rubber.rotation.x = Math.PI / 2;
      rubber.position.y = 0.021;
      assembly.add(rubber);
      const lamp = new THREE.MeshStandardMaterial({
        color: b.color,
        emissive: b.color,
        emissiveIntensity: 0.72,
        roughness: 0.22,
        metalness: 0.12,
      });
      this.lamps.set(b.id, lamp);
      const pointLight = new THREE.PointLight(b.color, 0.32, 0.22, 2);
      pointLight.position.set(b.x, 0.10, b.z);
      this.table.add(pointLight);
      this.bumperLights.set(b.id, pointLight);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.036, 0.015, 32),
        lamp,
      );
      cap.position.y = 0.032;
      assembly.add(cap);
      const labelTexture = paintTexture(256, 150, (c) => {
        c.fillStyle = b.color;
        c.fillRect(0, 0, 256, 150);
        c.strokeStyle = "#f8efcb";
        c.lineWidth = 7;
        c.strokeRect(9, 9, 238, 132);
        c.fillStyle = "#142b30";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = "bold 35px Arial";
        c.fillText(b.label, 128, 57, 215);
        c.font = "bold 23px Arial";
        c.fillText(b.sub, 128, 93, 215);
        c.font = "17px Arial";
        c.fillText("APPROVED", 128, 121, 215);
      });
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture, depthTest: false }),
      );
      label.scale.set(0.070, 0.041, 1);
      label.position.y = 0.053;
      label.renderOrder = 3;
      assembly.add(label);
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.034, 0.040, 32),
        new THREE.MeshBasicMaterial({
          color: b.color,
          transparent: true,
          opacity: 0.48,
          depthWrite: false,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.043;
      assembly.add(halo);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const bolt = new THREE.Mesh(
          new THREE.SphereGeometry(0.003, 6, 4),
          this.material("#fff1ce"),
        );
        bolt.position.set(Math.cos(a) * 0.045, 0.021, Math.sin(a) * 0.045);
        assembly.add(bolt);
      }
      this.text(
        `${b.label} ${b.sub}`,
        b.x,
        0.004,
        b.z + 0.073,
        0.145,
        "#f2e3ad",
        0.017,
      );
      this.text(
        b.id === "sole-source"
          ? "NO COMPETITION"
          : b.id === "cost-overrun"
            ? "+ $2 BILLION"
            : b.id === "emergency-funding"
              ? "NO TIME FOR QUESTIONS"
              : "JUST ONE MORE THING",
        b.x,
        0.003,
        b.z + 0.091,
        0.145,
        b.color,
        0.013,
      );
    }
    this.text("SUPPLEMENTAL", -0.18, 0.012, 0.115, 0.12, "#65ead2", 0.018);
    this.text("FUNDING RAMP", -0.18, 0.012, 0.14, 0.11, "#a0cbc3", 0.014);
    this.text(
      "RUBBER-STAMP COMMITTEE",
      -0.03,
      0.003,
      0.135,
      0.21,
      "#ffe5a0",
      0.014,
    );
    this.text(
      "3 VOTES = $25B RAMP JACKPOT",
      -0.03,
      0.003,
      0.157,
      0.2,
      "#89b7b6",
      0.012,
    );
    this.text("LAUNCH", 0.273, 0.015, 0.35, 0.043, "#e4c47c", 0.011);
    for (const target of BONUS_TARGETS) {
      const lamp = new THREE.MeshStandardMaterial({
        color: target.color,
        emissive: target.color,
        emissiveIntensity: 0.35,
      });
      this.lamps.set(target.id, lamp);
      if (target.id === "black-budget") {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.024, 0.004, 8, 32),
          lamp,
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(target.x, 0.035, target.z);
        this.table.add(rim);
        const lid = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, 0.004, 24),
          this.material("#111822"),
        );
        lid.position.set(target.x, 0.04, target.z);
        this.table.add(lid);
        // Vault wheel and handles make this a toy mechanism, not a painted hole.
        for (let i = 0; i < 3; i++) {
          const handle = detailBox(
            [0.028, 0.003, 0.003],
            [target.x, 0.044, target.z],
            "#b5b5d9",
          );
          handle.rotation.y = (i * Math.PI) / 3;
        }
      } else {
        const targetY = target.id === "ramp-review" ? 0.155 : 0.056;
        const face = detailBox(
          [0.049, 0.006, 0.028],
          [target.x, targetY, target.z],
          "#18372f",
        );
        face.material = lamp;
        this.text(
          target.id === "audit" ? "!" : "TOP SECRET",
          target.x,
          targetY + 0.004,
          target.z,
          0.044,
          "#162832",
          0.017,
        );
      }
      this.text(
        target.label,
        target.x,
        target.id === "ramp-review" ? 0.012 : 0.002,
        target.z + 0.047,
        target.id === "black-budget" ? 0.115 : 0.099,
        target.color,
        0.017,
      );
      this.text(
        target.sub,
        target.x,
        0.002,
        target.z + 0.064,
        0.065,
        "#d5d3b3",
        0.013,
      );
    }
    // Redacted contract sheets and dotted routes extend the original illustrated
    // playfield vocabulary onto the physical deck.
    const paperwork = paintTexture(256, 320, (c) => {
      c.fillStyle = "#dfd2a8";
      c.fillRect(0, 0, 256, 320);
      c.strokeStyle = "#a39368";
      c.lineWidth = 5;
      c.strokeRect(9, 9, 238, 302);
      c.fillStyle = "#2c4535";
      c.font = "bold 26px Arial";
      c.fillText("REQUISITION", 18, 47);
      c.font = "18px Arial";
      c.fillText("FORM 105-B", 18, 76);
      for (let i = 0; i < 5; i++)
        c.fillRect(20, 108 + i * 26, 190 - (i % 2) * 65, 13);
      c.save();
      c.translate(127, 272);
      c.rotate(-0.12);
      c.strokeStyle = "#a34337";
      c.strokeRect(-90, -22, 180, 42);
      c.fillStyle = "#a34337";
      c.font = "bold 24px Arial";
      c.textAlign = "center";
      c.fillText("CLASSIFIED", 0, 7);
      c.restore();
    });
    const documentMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.087),
      new THREE.MeshStandardMaterial({ map: paperwork, roughness: 0.9 }),
    );
    documentMesh.rotation.set(-Math.PI / 2, 0, 0.16);
    documentMesh.position.set(0.062, 0.002, 0.29);
    this.table.add(documentMesh);
    // Bolts, return-lane lettering and flipper halos make the machine legible at phone size.
    for (const sign of [-1, 1]) {
      this.text("LOBBY", sign * 0.25, 0.006, 0.31, 0.052, "#b5d3ca", 0.012);
      for (const z of [-0.52, -0.1, 0.32, 0.53]) {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.005, 0.003, 8),
          this.material("#ebce87"),
        );
        bolt.position.set(sign * 0.326, 0.027, z);
        this.table.add(bolt);
      }
      const seal = new THREE.Mesh(
        new THREE.TorusGeometry(0.031, 0.0015, 4, 32),
        this.material("#c8aa68"),
      );
      seal.rotation.x = Math.PI / 2;
      seal.position.set(sign * 0.13, 0.001, 0.405);
      this.table.add(seal);
      detailBox([0.052, 0.002, 0.034], [sign * 0.19, 0.037, 0.239], "#f0d8a2");
      this.text(
        sign < 0 ? "LOBBYIST" : "CONSULTANT",
        sign * 0.183,
        0.04,
        0.246,
        0.07,
        "#6c392e",
        0.012,
      );
      this.text(
        "RETAINER +15%",
        sign * 0.176,
        0.04,
        0.263,
        0.068,
        "#813e30",
        0.009,
      );
    }
  }
  hit(id: string) {
    this.flashes.set(id, 1);
    const assembly = this.bumperAssemblies.get(id);
    if (assembly) assembly.scale.setScalar(1.15);
    const light = this.bumperLights.get(id);
    if (light) light.intensity = 2.5;
    const sling = id.startsWith("sling-")
      ? this.slingBands.get(id.includes("--1") ? "sling--1" : "sling-1")
      : undefined;
    if (sling) sling.scale.set(1.08, 0.72, 1.08);
  }
  setPlunger(charge: number) {
    this.plunger.position.z = 0.565 + charge * 0.045;
  }
  cameraAction() {
    this.cameraActionRemaining = 1.8;
  }
  private updateCamera(dt: number) {
    if (this.cameraActionRemaining > 0) {
      this.cameraActionRemaining = Math.max(0, this.cameraActionRemaining - dt);
      const progress = 1 - this.cameraActionRemaining / 1.8;
      const ease = Math.sin(progress * Math.PI);
      const hero = new THREE.Vector3(-0.55, 1.20, 1.08);
      const main = new THREE.Vector3(0, 1.85, 1.65);
      this.camera.position.lerpVectors(main, hero, ease);
      this.camera.lookAt(0, 0.12, -0.20);
    } else {
      this.camera.position.lerp(new THREE.Vector3(0, 1.85, 1.65), Math.min(1, dt * 5));
      this.camera.lookAt(0, 0.02, -0.06);
    }
  }
  plungerScreen(width: number, height: number) {
    this.table.updateMatrixWorld(true);
    const p = this.plunger
      .getWorldPosition(new THREE.Vector3())
      .project(this.camera);
    return { x: ((p.x + 1) * width) / 2, y: ((1 - p.y) * height) / 2 };
  }
  setTargets(ids: Set<string>) {
    for (const id of COMMITTEE_TARGET_IDS) {
      const lamp = this.lamps.get(id);
      if (lamp) lamp.emissiveIntensity = ids.has(id) ? 2 : 0.35;
    }
  }
  sync(physics: PinballPhysics, dt: number) {
    this.updateCamera(dt);
    this.ball.position.copy(physics.ballPosition);
    this.ball.quaternion.copy(physics.ballQuaternion);
    this.ball.visible = physics.state !== "drained";
    this.shadow.visible = this.ball.visible;
    this.shadow.position.set(this.ball.position.x, 0.002, this.ball.position.z);
    this.shadow.scale.setScalar(1 + this.ball.position.y * 3);
    for (const side of ["left", "right"] as Side[])
      this.flippers[side].rotation.y = physics.flipperAngles[side];
    for (const [id, intensity] of this.flashes) {
      const n = Math.max(0, intensity - dt * 3);
      this.flashes.set(id, n);
      const m = this.lamps.get(id);
      if (m) m.emissiveIntensity = 0.4 + n * 2;
      const light = this.bumperLights.get(id);
      if (light) light.intensity = THREE.MathUtils.lerp(light.intensity, 0.32, Math.min(1, dt * 8));
      const assembly = this.bumperAssemblies.get(id);
      if (assembly) assembly.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
      const sling = id.startsWith("sling-")
        ? this.slingBands.get(id.includes("--1") ? "sling--1" : "sling-1")
        : undefined;
      if (sling) sling.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 18));
    }
  }
  resize(width: number, height: number) {
    // Fit the complete cabinet rather than clipping the title at short aspects.
    this.table.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.table);
    const projected = new THREE.Box3();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z])
          projected.expandByPoint(
            new THREE.Vector3(x, y, z).applyMatrix4(
              this.camera.matrixWorldInverse,
            ),
          );
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.position.set(0, 1.85, 1.65);
    this.camera.lookAt(0, 0.02, -0.06);
    this.camera.updateProjectionMatrix();
  }
  debug(physics: PinballPhysics, show: boolean) {
    if (this.debugLines) {
      this.scene.remove(this.debugLines);
      this.debugLines.geometry.dispose();
      (this.debugLines.material as THREE.Material).dispose();
      this.debugLines = undefined;
    }
    if (!show) return;
    const data = physics.world.debugRender();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.vertices, 3));
    this.debugLines = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({ color: "#ff32ea", depthTest: false }),
    );
    this.debugLines.renderOrder = 100;
    this.scene.add(this.debugLines);
  }
  dispose() {
    const materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    for (const m of materials) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map) textures.add(map);
      m.dispose();
    }
    for (const t of textures) t.dispose();
  }
}
