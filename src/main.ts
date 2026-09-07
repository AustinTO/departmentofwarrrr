import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';
import { ReadinessScene } from './scenes/ReadinessScene';
import { ProcurementScene } from './scenes/ProcurementScene';
import { MansionScene } from './scenes/MansionScene';
import { DoctrineScene } from './scenes/DoctrineScene';
import { EventScene } from './scenes/EventScene';
import { PreloaderScene } from './scenes/PreloaderScene';
import { TitleScene } from './scenes/TitleScene';

import { PressReleaseScene } from './scenes/PressReleaseScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { PinballPhysicsLab } from './scenes/PinballPhysicsLab';
import { App } from '@capacitor/app';
import { currentRun } from './state/RunState';
import { WeaponType } from './game/config';

const hash = window.location.hash;
if (hash === '#arsenal') {
    // QA shortcut: unlock full campaign arsenal + boards for playtesting.
    currentRun.currentFY = 2029;
    currentRun.mansionsBuilt = 8;
    currentRun.unlockedWeapons = [];
    currentRun.unlockedBoards = ['appropriations'];
    currentRun.syncUnlocks();
    [WeaponType.HYDRA, WeaponType.RAILGUN, WeaponType.SEEKER, WeaponType.INTERCEPTOR, WeaponType.INTERCEPTOR_BLOCK_II]
        .forEach((type) => {
            currentRun.theaters.active.inventory[type] = Math.max(currentRun.theaters.active.inventory[type] || 0, 20);
        });
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1080,
    height: 1920,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: hash === '#planck-lab'
        ? [PinballPhysicsLab]
        : (hash === '#procurement' || hash.includes('author'))
            ? [BootScene, PreloaderScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene, TitleScene]
            : hash === '#arsenal'
                ? [BootScene, PreloaderScene, CombatScene, ReadinessScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene, TitleScene]
                : [BootScene, PreloaderScene, TitleScene, DoctrineScene, CombatScene, ReadinessScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene, PinballPhysicsLab]
};

const game = new Phaser.Game(config);

// Capacitor keeps the same Phaser runtime as the browser build, but native
// apps can be suspended while the player switches apps or locks the phone.
// Explicitly pause/resume the game so timers and audio do not jump on return.
const syncGameActivity = (isActive: boolean) => {
    if (isActive) {
        game.resume();
    } else {
        game.pause();
    }
};

void App.addListener('appStateChange', ({ isActive }) => syncGameActivity(isActive));
document.addEventListener('visibilitychange', () => {
    syncGameActivity(document.visibilityState === 'visible');
});
