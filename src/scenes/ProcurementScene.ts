import * as Phaser from "phaser";
import type { Procurement3DGame } from "../pinball3d/Procurement3DGame";

/** Phaser owns navigation; the procurement machine owns its input and renderer. */
export class ProcurementScene extends Phaser.Scene {
  private machine?: Procurement3DGame;
  private generation = 0;
  private originalVisibility = "";
  constructor() {
    super("ProcurementScene");
  }
  create() {
    const token = ++this.generation;
    this.originalVisibility = this.game.canvas.style.visibility;
    this.game.canvas.style.visibility = "hidden";
    this.input.enabled = false;
    const onPause = () => this.machine?.setPaused(true);
    this.game.events.on("pause", onPause);
    this.events.once("shutdown", () => {
      this.generation++;
      this.machine?.dispose();
      this.machine = undefined;
      this.game.loop.wake();
      this.game.canvas.style.visibility = this.originalVisibility;
      this.game.events.off("pause", onPause);
    });
    void this.startMachine(token);
  }
  private async startMachine(token: number) {
    let machine: Procurement3DGame | undefined;
    try {
      const { Procurement3DGame } =
        await import("../pinball3d/Procurement3DGame");
      if (token !== this.generation) return;
      const leave = () => {
        this.game.loop.wake();
        this.scene.start("MansionScene");
      };
      machine = new Procurement3DGame({
        mount: this.game.canvas.parentElement ?? document.body,
        onExit: leave,
        onAuthorize: leave,
      });
      this.machine = machine;
      await machine.start();
      if (token !== this.generation) machine.dispose();
      else this.game.loop.sleep();
    } catch (error) {
      machine?.dispose();
      if (token !== this.generation) return;
      console.error("Procurement initialization failed", error);
      this.game.canvas.style.visibility = this.originalVisibility;
      this.input.enabled = true;
      this.add
        .text(540, 650, "THE HEARING COULD NOT OPEN", {
          fontSize: "36px",
          color: "#eed8a7",
        })
        .setOrigin(0.5);
      this.add
        .text(540, 730, "The 3D display could not initialize.", {
          fontSize: "26px",
          color: "#b4cbc8",
        })
        .setOrigin(0.5);
      this.add
        .text(540, 830, "RETRY", { fontSize: "32px", color: "#71dac4" })
        .setOrigin(0.5)
        .setInteractive()
        .on("pointerdown", () => this.scene.restart());
      this.add
        .text(540, 920, "RETURN TO MCLEAN", {
          fontSize: "28px",
          color: "#eed8a7",
        })
        .setOrigin(0.5)
        .setInteractive()
        .on("pointerdown", () => this.scene.start("MansionScene"));
    }
  }
}
