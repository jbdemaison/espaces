import { create } from 'zustand';

const KEY = 'espaces-sound-prefs';

interface Prefs {
  volume: number;
  muted: boolean;
}

const load = (): Prefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    const volume =
      typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1
        ? raw.volume
        : 0.7;
    return { volume, muted: raw.muted === true };
  } catch {
    return { volume: 0.7, muted: false };
  }
};

const save = (prefs: Prefs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // storage not available: the choice only lasts for this visit
  }
};

interface SoundPrefsState extends Prefs {
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
}

/** What each person chose for the sounds played in the rooms: kept in the browser. */
export const useSoundPrefs = create<SoundPrefsState>((set, get) => ({
  ...load(),
  setVolume: (volume) => {
    set({ volume });
    save({ volume, muted: get().muted });
  },
  setMuted: (muted) => {
    set({ muted });
    save({ volume: get().volume, muted });
  },
}));
