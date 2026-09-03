import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';
import { ReadinessScene } from './scenes/ReadinessScene';
import { ProcurementScene } from './scenes/ProcurementScene';
import { MansionScene } from './scenes/MansionScene';
import { DoctrineScene } from './scenes/DoctrineScene';
import { EventScene } from './scenes/EventScene';
import { PreloaderScene } from './scenes/PreloaderScene';

import { PressReleaseScene } from './scenes/PressReleaseScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';
import { PinballPhysicsLab } from './scenes/PinballPhysicsLab';
import { App } from '@capacitor/app';

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
        },
        matter: {
            gravity: { x: 0, y: 1 },
            debug: false
        }
    },
    scene: window.location.hash === '#planck-lab'
        ? [PinballPhysicsLab]
        : window.location.hash === '#procurement'
            ? [BootScene, PreloaderScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene]
            : [BootScene, PreloaderScene, DoctrineScene, CombatScene, ReadinessScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene, PinballPhysicsLab]
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
