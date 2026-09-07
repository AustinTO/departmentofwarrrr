const STORAGE_KEY = 'warrr_settings_v1';

export interface SettingsData {
    musicVolume: number;
    sfxVolume: number;
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/** Persistent audio preferences shared across scenes. */
export class GameSettings {
    private static instance: GameSettings;
    musicVolume = 0.7;
    sfxVolume = 0.85;

    private constructor() {
        this.load();
    }

    public static getInstance(): GameSettings {
        if (!GameSettings.instance) {
            GameSettings.instance = new GameSettings();
        }
        return GameSettings.instance;
    }

    public setMusicVolume(value: number) {
        this.musicVolume = clamp01(value);
        this.save();
    }

    public setSfxVolume(value: number) {
        this.sfxVolume = clamp01(value);
        this.save();
    }

    public save() {
        const data: SettingsData = {
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    public load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const data = JSON.parse(raw) as Partial<SettingsData>;
            if (typeof data.musicVolume === 'number') this.musicVolume = clamp01(data.musicVolume);
            if (typeof data.sfxVolume === 'number') this.sfxVolume = clamp01(data.sfxVolume);
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }
}

export const gameSettings = GameSettings.getInstance();
