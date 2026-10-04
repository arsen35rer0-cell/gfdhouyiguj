import { Preferences } from '@capacitor/preferences';

export async function save(key, value) {
  try {
    await Preferences.set({
      key,
      value: JSON.stringify(value ?? null)
    });
  } catch (error) {
    console.warn('Storage save error:', error);
  }
}

export async function load(key, fallback = null) {
  try {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
