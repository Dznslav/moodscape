export const HAPTICS_STORAGE_KEY = 'moodscape_haptics_enabled';
export const HAPTICS_DEFAULT_ENABLED = true;
export const HAPTICS_TOUCH_ONLY = true;
export const HAPTICS_DEBUG = false;

export const HAPTIC_EVENT_PRESETS = Object.freeze({
  chipToggle: 'light',
  closePanel: 'soft',
  destructive: 'heavy',
  error: 'error',
  openPanel: 'soft',
  picker: 'selection',
  secondaryNav: 'light',
  submit: 'medium',
  success: 'success',
  tabSwitch: 'selection',
  toggle: 'light',
  warning: 'warning',
});

export const HAPTIC_EVENT_COOLDOWNS = Object.freeze({
  chipToggle: 50,
  closePanel: 80,
  destructive: 140,
  error: 180,
  openPanel: 80,
  picker: 35,
  secondaryNav: 70,
  submit: 90,
  success: 140,
  tabSwitch: 55,
  toggle: 70,
  warning: 140,
});
