import * as THREE from "three";
import { PinballPhysics, type Side } from "./PinballPhysics";
import { TableView } from "./TableView";
import { ProcurementSystem } from "../game/ProcurementSystem";
import { WeaponType } from "../game/config";
import { currentRun } from "../state/RunState";
import { COMMITTEE_TARGET_IDS } from "./table";
import "./pinball.css";

export interface Procurement3DOptions {
  mount: HTMLElement;
  onExit: () => void;
  onAuthorize?: () => void;
}
type Control = Side | "launch";
export class Procurement3DGame {
  private root = document.createElement("section");
  private viewport!: HTMLElement;
  private renderer?: THREE.WebGLRenderer;
  private view?: TableView;
  private physics?: PinballPhysics;
  private readonly contract = new ProcurementSystem();
  private readonly abort = new AbortController();
  private readonly pointers = new Map<number, Control>();
  private plungerDrag?: { id: number; startY: number; travel: number };
  private readonly keys = new Set<string>();
  private targets = new Set<string>();
  private qualifiedContracts = 0;
  private printerHits = 0;
  private warChests = new Set<string>();
  private dropBank = new Set<string>();
  private disposed = false;
  private paused = false;
  private authorized = false;
  private balls = 3;
  private charge = 0;
  private accumulator = 0;
  private lastTime = 0;
  private raf = 0;
  private elapsed = 0;
  private comboExpiry = 0;
  private debug = false;
  private audio?: AudioContext;
  private muted = false;
  private resizeObserver?: ResizeObserver;
  private readonly metricFrames: number[] = [];
  constructor(private options: Procurement3DOptions) {
    this.root.className = "procurement-machine";
    this.root.setAttribute("aria-label", "Appropriations pinball");
    this.root.innerHTML = `
          <div class="machine-shell">
            <header class="machine-header"><div class="agency-line"><span class="agency-seal">★</span><span>DEPARTMENT OF WARRR <small>PROCUREMENT DIVISION</small></span><button data-action="camera" aria-label="Show 3D camera angle">◎</button><button data-action="pause" aria-label="Pause game">Ⅱ</button><button data-action="sound" aria-label="Mute sound">♪</button></div>
              <div class="scoreboard"><div><span>CONTRACT VALUE</span><strong data-readout="budget">$0</strong></div><div><span>DELIVERY DELAY</span><strong data-readout="delay">+0.0 YR</strong></div><div><span>REQUIREMENTS</span><strong data-readout="balls">● ● ●</strong></div></div>
            </header>
            <div class="table-viewport" aria-label="Touch lower left or right playfield to flip. Drag the plunger down to launch."><div class="table-caption"><span>● LIVE HEARING</span><span data-readout="objective">LIGHT SUPPLEMENTAL RAMP</span></div><div class="load-message">Opening the hearing…</div><output class="debug-readout" hidden></output><span class="plunger-hint" aria-hidden="true">PULL ↓</span><div class="touch-hints" aria-hidden="true"><span>TOUCH TO FLIP</span><span>TOUCH TO FLIP</span></div></div>
            <footer class="machine-footer"><div class="mission-strip"><span class="mission-light"></span><p data-readout="status">Pull the plunger down. Touch either lower side to flip.</p><span data-readout="combo">×1</span></div>
              <div class="bottom-line"><button data-action="authorize">Authorize ↗</button></div>
            </footer><div class="machine-dialog" hidden></div>
          </div>`;
    this.options.mount.append(this.root);
    this.viewport = this.root.querySelector(".table-viewport")!;
    this.bindInput();
  }
  async start() {
    const physics = await PinballPhysics.create();
    if (this.disposed) {
      physics.dispose();
      return;
    }
    this.physics = physics;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Three dimensional procurement pinball table",
    );
    this.viewport.prepend(this.renderer.domElement);
    this.viewport.querySelector(".load-message")?.remove();
    this.view = new TableView();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        this.setPaused(true);
        this.showDialog(
          "Hearing interrupted",
          "The display was interrupted. Return and reopen procurement to resume a fresh table.",
          "Return",
          () => this.options.onExit(),
        );
      },
      { signal: this.abort.signal },
    );
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.refresh();
  }
  private readout(name: string) {
    return this.root.querySelector(`[data-readout="${name}"]`)!;
  }
  private say(text: string) {
    this.readout("status").textContent = text;
  }
  private bindInput() {
    const signal = this.abort.signal;
    this.root.addEventListener(
      "pointerdown",
      (e) => {
        if (
          (e.target as HTMLElement).tagName !== "CANVAS" ||
          this.paused ||
          this.authorized ||
          !this.view ||
          !this.physics
        )
          return;
        const rect = this.viewport.getBoundingClientRect(),
          knob = this.view.plungerScreen(rect.width, rect.height);
        const localX = e.clientX - rect.left,
          localY = e.clientY - rect.top;
        let control: Control | undefined;
        if (
          this.physics.state === "ready" &&
          !this.plungerDrag &&
          Math.abs(localX - knob.x) < 32 &&
          Math.abs(localY - knob.y) < 48
        ) {
          control = "launch";
          this.plungerDrag = {
            id: e.pointerId,
            startY: e.clientY,
            travel: Math.max(32, Math.min(75, rect.height * 0.09)),
          };
          this.charge = 0;
        } else if (localY > rect.height * 0.4)
          control = localX < rect.width / 2 ? "left" : "right";
        if (!control) return;
        e.preventDefault();
        this.pointers.set(e.pointerId, control);
        this.root.setPointerCapture(e.pointerId);
        this.unlockAudio();
      },
      { signal },
    );
    this.root.addEventListener(
      "pointermove",
      (e) => {
        if (this.plungerDrag?.id === e.pointerId) {
          this.charge = Math.max(
            0,
            Math.min(
              1,
              (e.clientY - this.plungerDrag.startY) / this.plungerDrag.travel,
            ),
          );
        }
      },
      { signal },
    );
    const release = (e: PointerEvent) => {
      const c = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (c === "launch") {
        this.plungerDrag = undefined;
        if (e.type === "pointerup" && this.charge > 0.08) this.launch();
        else this.charge = 0;
      }
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      this.root.addEventListener(event, release as EventListener, { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        const key = e.key.toLowerCase();
        if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) {
          e.preventDefault();
          if (!this.paused && !this.authorized) this.keys.add(key);
          this.unlockAudio();
        }
        if (e.repeat) return;
        if (key === "escape" || key === "p") this.togglePause();
        if (key === "f2") {
          e.preventDefault();
          this.debug = !this.debug;
        }
      },
      { signal },
    );
    window.addEventListener(
      "keyup",
      (e) => {
        const key = e.key.toLowerCase(),
          had = this.keys.delete(key);
        if (key === " " && had && !this.held("launch")) this.launch();
      },
      { signal },
    );
    window.addEventListener("blur", () => this.setPaused(true), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.setPaused(true);
      },
      { signal },
    );
        this.root
          .querySelector('[data-action="pause"]')!
          .addEventListener("click", () => this.togglePause(), { signal });
        this.root
          .querySelector('[data-action="camera"]')!
          .addEventListener("click", () => this.view?.cameraAction(), { signal });
    this.root.querySelector('[data-action="sound"]')!.addEventListener(
      "click",
      (e) => {
        this.muted = !this.muted;
        (e.currentTarget as HTMLElement).textContent = this.muted ? "♪̸" : "♪";
        (e.currentTarget as HTMLElement).setAttribute(
          "aria-label",
          this.muted ? "Unmute sound" : "Mute sound",
        );
      },
      { signal },
    );
    this.root
      .querySelector('[data-action="authorize"]')!
      .addEventListener("click", () => this.authorize(), { signal });
  }
  private held(control: Control) {
    return (
      [...this.pointers.values()].includes(control) ||
      (control === "launch"
        ? this.keys.has(" ")
        : control === "left"
          ? this.keys.has("a") || this.keys.has("arrowleft")
          : this.keys.has("d") || this.keys.has("arrowright"))
    );
  }
  private launch() {
    if (this.paused || this.authorized) return;
    this.physics?.launch(Math.max(0.35, this.charge));
    this.charge = 0;
  }
  setPaused(paused: boolean) {
    if (this.disposed || this.authorized || this.balls <= 0) return;
    this.paused = paused;
    this.keys.clear();
    this.pointers.clear();
    this.plungerDrag = undefined;
    this.charge = 0;
    this.accumulator = 0;
    if (paused)
      this.showDialog(
        "Hearing in recess",
        "Your contract is safe. Return when you’re ready to keep the money moving.",
        "Resume hearing",
        () => this.setPaused(false),
      );
    else this.hideDialog();
  }
  private togglePause() {
    this.setPaused(!this.paused);
  }
  private showDialog(
    title: string,
    body: string,
    label: string,
    action: () => void,
  ) {
    const d = this.root.querySelector<HTMLElement>(".machine-dialog")!;
    d.hidden = false;
    d.replaceChildren();
    const card = document.createElement("div");
    card.className = "dialog-card";
    const seal = document.createElement("span");
    seal.className = "dialog-seal";
    seal.textContent = "★";
    const h = document.createElement("h2");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = body;
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = action;
    card.append(seal, h, p, b);
    d.append(card);
  }
  private hideDialog() {
    this.root.querySelector<HTMLElement>(".machine-dialog")!.hidden = true;
  }
  private authorize() {
    if (this.authorized) return;
    if (this.contract.state.value <= 0) {
      this.say(
        "A contract needs a requirement. Launch and hit a funding bumper.",
      );
      return;
    }
    this.authorized = true;
    this.keys.clear();
    this.pointers.clear();
    const { summary } = this.contract.authorize();
    this.showDialog(
      "Rubber-stamped.",
      `${this.contract.formatBudget(this.contract.state.value)} authorized. ${summary} The contractors thank you.`,
      "Visit McLean ↗",
      () => (this.options.onAuthorize ?? this.options.onExit)(),
    );
    this.tone(880, 0.3);
  }
  private processEvents() {
    for (const e of this.physics!.drainEvents()) {
      if (e.type === "launch") {
        this.say("Requirement filed. Aim for the committee targets.");
        this.tone(330, 0.08);
      }
      if (e.type === "save") {
        this.say("GRACE PERIOD • Saved. Pull the plunger to refile.");
        this.tone(440, 0.15);
      }
      if (e.type === "unstuck") {
        this.say("MARSHAL NUDGE • Ball returned to the hearing.");
        this.tone(220, 0.08);
      }
      if (e.type === "drain") {
        this.balls--;
        this.contract.state.combo = 0;
        if (this.balls > 0) {
          this.physics!.reset();
          this.say(
            `${this.balls} requirements left. Pull down the plunger to refile.`,
          );
        } else
          this.showDialog(
            "The hearing is closed.",
            `Final contract: ${this.contract.formatBudget(this.contract.state.value)}. ${this.contract.state.value > 0 ? "Authorize it and send the invoice." : "No funding secured this time."}`,
            this.contract.state.value > 0
              ? "Authorize contract"
              : "Return to McLean",
            () =>
              this.contract.state.value > 0
                ? this.authorize()
                : this.options.onExit(),
          );
        this.tone(150, 0.2);
      }
      if (e.type === "hit" || e.type === "ramp") {
        this.view!.hit(e.id);
        this.comboExpiry = this.elapsed + 6;
        if (e.id.startsWith("sling")) {
          this.tone(260, 0.04);
          continue;
        }
        let value = 2e9,
          label = "COST OVERRUN",
          delay = 0.12;
        if (["cost-overrun", "scope-creep", "emergency-funding"].includes(e.id)) {
          this.qualifiedContracts = Math.min(3, this.qualifiedContracts + 1);
          value = 1e9 * this.qualifiedContracts;
          label = `CONTRACT QUALIFIED ${this.qualifiedContracts}/3`;
        }
        if (e.id === "contract-award") {
          value = this.qualifiedContracts > 0 ? this.qualifiedContracts * 6e9 : 1e9;
          delay = this.qualifiedContracts * 0.25;
          label = this.qualifiedContracts > 0 ? "CONTRACT AWARD COLLECTED" : "EMPTY AWARD CEREMONY";
          this.qualifiedContracts = 0;
        }
        if (e.id === "budget-printer") {
          this.printerHits++;
          value = 2e9 * this.printerHits;
          label = this.printerHits >= 5 ? "UNLIMITED FUNDING LIT" : `BUDGET PRINTER ${this.printerHits}/5`;
        }
        if (e.id === "war-chest-left" || e.id === "war-chest-right") {
          this.warChests.add(e.id);
          value = 3e9;
          label = this.warChests.size === 2 ? "WAR CHESTS FILLED — MULTIBALL QUALIFIED" : "WAR CHEST FILLED";
        }
        if (["drop-bid", "drop-review", "drop-approve"].includes(e.id)) {
          this.dropBank.add(e.id);
          value = 1e9;
          label = this.dropBank.size === 3 ? "NO-BID CONTRACT RAMP LIT" : "PROCUREMENT BANK HIT";
        }
        if (e.id === "sole-source") {
          value = 3e9;
          label = "SOLE-SOURCE AWARD";
        }
        if (e.id === "scope-creep") {
          value = 2.5e9;
          label = "SCOPE EXPANDED";
        }
        if (e.id === "emergency-funding") {
          value = 3.5e9;
          label = "URGENT NEED — FUNDING RELEASED";
        }
        if (e.id === "classified") {
          value = 4e9;
          label = "CLASSIFIED ADDENDUM";
          delay = 0.25;
        }
        if (e.id === "black-budget") {
          value = 5e9;
          label = "BLACK BUDGET UNLOCKED";
          delay = 0.3;
        }
        if (e.id === "audit") {
          value = -1e9;
          label = "AUDIT — EFFICIENCY DETECTED";
          delay = -0.1;
        }
        if (COMMITTEE_TARGET_IDS.includes(e.id)) {
          this.targets.add(e.id);
          value = 1e9;
          label =
            this.targets.size === 3
              ? "SUPPLEMENTAL RAMP LIT"
              : "COMMITTEE VOTE SECURED";
          this.view!.setTargets(this.targets);
        }
        if (e.type === "ramp") {
          this.view!.cameraAction();
          value = this.dropBank.size === 3 ? 25e9 : this.targets.size === 3 ? 18e9 : 8e9;
          delay = 0.4;
          label =
            this.dropBank.size === 3 ? "NO-BID CONTRACT JACKPOT" : this.targets.size === 3 ? "SUPPLEMENTAL JACKPOT" : "ELEVATED FUNDING APPROVED";
          this.targets.clear();
          this.dropBank.clear();
          this.view!.setTargets(this.targets);
        }
        const result = this.contract.applyBumper({
          id: e.id,
          x: 0,
          y: 0,
          radius: 0,
          label,
          value,
          delay,
          color: 0xffcc66,
          weapon: WeaponType.INTERCEPTOR,
          quantity: value < 0 ? 0 : e.type === "ramp" ? 8 : 1,
          outcome: value < 0 ? "efficiency" : "inflate",
          badgeFrame: 0,
        });
        this.say(
          `${label}  ${result.scaledValue < 0 ? "−" : "+"}${this.contract.formatBudget(Math.abs(result.scaledValue))}`,
        );
        this.tone(
          e.type === "ramp" ? 880 : e.id.startsWith("target") ? 640 : 460,
          0.09,
        );
      }
    }
  }
  private refresh() {
    this.readout("budget").textContent = this.contract.formatBudget(
      this.contract.state.value,
    );
    this.readout("delay").textContent =
      `+${this.contract.state.leadTimeDelay.toFixed(1)} YR`;
    this.readout("balls").textContent = Array.from({ length: 3 }, (_, i) =>
      i < this.balls ? "●" : "○",
    ).join(" ");
    this.readout("combo").textContent = `×${this.contract.comboMultiplier()}`;
    this.readout("objective").textContent =
      this.warChests.size === 2
        ? "WAR CHEST MULTIBALL QUALIFIED"
        : this.dropBank.size === 3
          ? "NO-BID CONTRACT RAMP LIT"
          : this.qualifiedContracts > 0
            ? `SHOOT AWARD • ${this.qualifiedContracts} CONTRACTS READY`
            : `QUALIFY CONTRACTS ${this.qualifiedContracts}/3`;
    for (const c of ["left", "right"] as Side[])
      this.root.classList.toggle(`${c}-held`, this.held(c));
    const hint = this.root.querySelector<HTMLElement>(".plunger-hint")!;
    hint.hidden =
      this.physics?.state !== "ready" || this.paused || this.authorized;
    if (this.view) {
      const rect = this.viewport.getBoundingClientRect(),
        knob = this.view.plungerScreen(rect.width, rect.height);
      hint.style.left = `${knob.x}px`;
      hint.style.top = `${knob.y - 28}px`;
    }
    this.view?.setPlunger(this.charge);
    (
      this.root.querySelector('[data-action="authorize"]') as HTMLButtonElement
    ).disabled = this.contract.state.value <= 0 || this.authorized;
  }
  private unlockAudio() {
    if (!this.audio && !this.muted) {
      try {
        this.audio = new AudioContext();
      } catch {}
    }
    void this.audio?.resume();
  }
  private tone(frequency: number, duration: number) {
    if (!this.audio || this.muted) return;
    const o = this.audio.createOscillator(),
      g = this.audio.createGain(),
      t = this.audio.currentTime;
    o.type = "sine";
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(frequency * 0.65, t + duration);
    g.gain.setValueAtTime(0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.audio.destination);
    o.start();
    o.stop(t + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private frame = (now: number) => {
    if (this.disposed || !this.physics || !this.view || !this.renderer) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.metricFrames.push(dt * 1000);
    if (this.metricFrames.length > 600) this.metricFrames.shift();
    if (!this.paused && !this.authorized && this.balls > 0) {
      this.elapsed += dt;
      if (this.elapsed > this.comboExpiry) this.contract.state.combo = 0;
      if (
        this.keys.has(" ") &&
        !this.plungerDrag &&
        this.physics.state === "ready"
      )
        this.charge = Math.min(1, this.charge + dt * 0.9);
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= 1 / 120 && steps++ < 6) {
        this.physics.step(1 / 120, {
          left: this.held("left"),
          right: this.held("right"),
        });
        this.processEvents();
        this.accumulator -= 1 / 120;
      }
    }
    this.view.sync(this.physics, dt);
    this.view.debug(this.physics, this.debug);
    this.refresh();
    this.renderer.render(this.view.scene, this.view.camera);
    const out = this.root.querySelector<HTMLOutputElement>(".debug-readout")!;
    out.hidden = !this.debug;
    if (this.debug)
      out.textContent = `${this.physics.state} · ${this.physics.velocity.length().toFixed(2)} m/s · ${this.renderer.info.render.calls} draws · ${(1000 / (this.metricFrames.reduce((a, b) => a + b, 0) / this.metricFrames.length)).toFixed(0)} FPS`;
    this.raf = requestAnimationFrame(this.frame);
  };
  private resize = () => {
    if (!this.renderer || !this.view) return;
    const { width, height } = this.viewport.getBoundingClientRect();
    this.renderer.setSize(width, height, false);
    this.view.resize(width, height);
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.resizeObserver?.disconnect();
    this.view?.dispose();
    this.physics?.dispose();
    this.renderer?.dispose();
    void this.audio?.close();
    this.root.remove();
    currentRun.save();
  }
}
