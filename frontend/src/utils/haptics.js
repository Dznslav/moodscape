import {
  HAPTIC_EVENT_COOLDOWNS,
  HAPTIC_EVENT_PRESETS,
  HAPTICS_DEBUG,
  HAPTICS_TOUCH_ONLY,
} from '../settings/haptics';
import { useHapticsStore } from '../stores/haptics';

let hapticsInstance = null;
let lastTriggerAt = 0;
let lastTriggerKey = '';


let _WebHaptics = null;
let _resolveAttempted = false;

const resolveWebHaptics = async () => {
  if (_resolveAttempted) return _WebHaptics;
  _resolveAttempted = true;

  try {
    const mod = await import('web-haptics');
    _WebHaptics = mod.WebHaptics ?? mod.default ?? false;
  } catch {
    _WebHaptics = false;
  }

  return _WebHaptics;
};
resolveWebHaptics();

const hasTouchInput = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0);
};

const canUseHaptics = ({ force = false } = {}) => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!_WebHaptics || !_WebHaptics.isSupported) {
    return false;
  }

  if (HAPTICS_TOUCH_ONLY && !hasTouchInput()) {
    return false;
  }

  if (force) {
    return true;
  }

  return useHapticsStore().enabled;
};

const getHapticsInstance = () => {
  if (!hapticsInstance && typeof window !== 'undefined' && _WebHaptics) {
    try {
      hapticsInstance = new _WebHaptics({
        debug: HAPTICS_DEBUG,
        showSwitch: false,
      });
    } catch (error) {
      console.error('Failed to create haptics instance:', error);
      return null;
    }
  }

  return hapticsInstance;
};

export const playHaptic = (
  eventKey,
  {
    cooldownMs,
    force = false,
    intensity,
  } = {}
) => {
  if (!canUseHaptics({ force })) {
    return false;
  }

  const preset = HAPTIC_EVENT_PRESETS[eventKey] ?? eventKey;

  if (!preset) {
    return false;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const minGap = cooldownMs ?? HAPTIC_EVENT_COOLDOWNS[eventKey] ?? HAPTIC_EVENT_COOLDOWNS[preset] ?? 60;

  if (lastTriggerKey === preset && now - lastTriggerAt < minGap) {
    return false;
  }

  lastTriggerAt = now;
  lastTriggerKey = preset;

  try {
    const instance = getHapticsInstance();
    void instance?.trigger(
      preset,
      intensity === undefined
        ? undefined
        : {
            intensity,
          }
    );
    return true;
  } catch (error) {
    console.error('Failed to trigger haptic feedback:', error);
    return false;
  }
};

export const previewHaptics = () =>
  playHaptic('nudge', {
    cooldownMs: 0,
    force: true,
  });

export const cancelHaptics = () => {
  try {
    getHapticsInstance()?.cancel();
  } catch (error) {
    console.error('Failed to cancel haptics:', error);
  }
};


export const isHapticsAvailable = async () => {
  const WH = await resolveWebHaptics();
  if (!WH || !WH.isSupported) return false;
  if (HAPTICS_TOUCH_ONLY && !hasTouchInput()) return false;
  return true;
};
