// The choices kept in localStorage between visits
export type PreferenceKey = 'viewMode' | 'clickSound' | 'padTimbre' | 'padVolume';

const KEYS: Record<PreferenceKey, string> = {
  viewMode: 'metrorig_view_mode',
  clickSound: 'metrorig_click_sound',
  padTimbre: 'metrorig_pad_timbre',
  padVolume: 'metrorig_pad_volume',
};

export interface PreferenceStore {
  get(key: PreferenceKey): string | null;
  set(key: PreferenceKey, value: string): void;
}

export const browserPreferences: PreferenceStore = {
  get: key => localStorage.getItem(KEYS[key]),
  set: (key, value) => localStorage.setItem(KEYS[key], value),
};
