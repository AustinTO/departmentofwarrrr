import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';
import { abandonDaily, chooseDailyPolicy, currentDaily, isDailyActive } from '../game/DailySession';
import { dailyBackdrop, dailyButton } from '../ui/DailySceneUI';

export class DailyPolicyScene extends Phaser.Scene {
    constructor() { super('DailyPolicyScene'); }

    create(): void {
        if (!isDailyActive() || !currentDaily()) {
            this.scene.start('TitleScene');
            return;
        }
        const { width } = this.scale;
        dailyBackdrop(this, 'readiness_bg');
        this.add.text(width / 2, 225, 'COMMITTEE DECISION', {
            fontSize: '62px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 320, 'THE DEFENSE IS OVER. THE PAPERWORK BEGINS.', {
            fontSize: '26px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 426, 'ACTIVE READINESS: ' +
            Math.floor(currentRun.theaters.active.readiness) + '%  •  DAILY SEED ' +
            currentDaily()!.seed, {
            fontSize: '29px', color: '#9ae9df', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.rectangle(width / 2, 800, width - 106, 490, 0x0c2a35, 0.97).setStrokeStyle(3, 0x7df4ff);
        this.add.text(width / 2, 624, 'A  •  FAST-TRACK THE CONTRACT', {
            fontSize: '37px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 735, '+35% contractor profit multiplier\n−8 active readiness', {
            fontSize: '31px', color: '#ffffff', align: 'center', lineSpacing: 18
        }).setOrigin(0.5);
        dailyButton(this, 934, 'APPROVE FAST-TRACK', () => this.choose('fast-track'),
            { color: 0x86601a, outline: 0xffd166 });

        this.add.rectangle(width / 2, 1320, width - 106, 490, 0x0c2a35, 0.97).setStrokeStyle(3, 0x7df4ff);
        this.add.text(width / 2, 1152, 'B  •  PRESERVE THE AUDIT TRAIL', {
            fontSize: '33px', color: '#7df4ff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(width / 2, 1275, '+8 active readiness (up to 100%)\n−15% contractor profit multiplier', {
            fontSize: '30px', color: '#ffffff', align: 'center', lineSpacing: 18
        }).setOrigin(0.5);
        dailyButton(this, 1452, 'AUTHORIZE OVERSIGHT', () => this.choose('audit'),
            { color: 0x116b4c, outline: 0xa8ff93 });

        dailyButton(this, 1740, 'ABANDON DAILY RUN', () => {
            abandonDaily();
            this.scene.start('TitleScene');
        }, { color: 0x3d3441, outline: 0xaab5bf, fontSize: 28 });
    }

    private choose(policy: 'fast-track' | 'audit'): void {
        if (!chooseDailyPolicy(policy)) return;
        this.input.enabled = false;
        this.scene.start('ProcurementScene');
    }
}
