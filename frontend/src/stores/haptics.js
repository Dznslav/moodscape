import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import {
  HAPTICS_DEFAULT_ENABLED,
  HAPTICS_STORAGE_KEY,
  HAPTICS_TOUCH_ONLY,
} from '../settings/haptics';

const getStoredHapticsEnabled = () => {
  if (typeof window === 'undefined') {
    return HAPTICS_DEFAULT_ENABLED;
  }

  const storedValue = localStorage.getItem(HAPTICS_STORAGE_KEY);

  if (storedValue === null) {
    return HAPTICS_DEFAULT_ENABLED;
  }

  return storedValue !== 'false';
};

const hasTouchInput = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0);
};

export const useHapticsStore = defineStore('haptics', () => {
  const enabled = ref(getStoredHapticsEnabled());
  const _browserSupported = ref(false);
  const _resolveSupport = async () => {
    try {
      const { WebHaptics } = await import('web-haptics');
      _browserSupported.value = Boolean(WebHaptics?.isSupported);
    } catch {
      _browserSupported.value = false;
    }
  };

  if (typeof window !== 'undefined') {
    _resolveSupport();
  }

  const isAvailable = computed(
    () =>
      typeof window !== 'undefined' &&
      _browserSupported.value &&
      (!HAPTICS_TOUCH_ONLY || hasTouchInput())
  );

  const setEnabled = (value) => {
    enabled.value = Boolean(value);
  };

  const toggle = () => {
    enabled.value = !enabled.value;
    return enabled.value;
  };

  watch(
    enabled,
    (nextValue) => {
      if (typeof window === 'undefined') {
        return;
      }

      localStorage.setItem(HAPTICS_STORAGE_KEY, String(nextValue));
    },
    { immediate: true }
  );

  return {
    enabled,
    isAvailable,
    setEnabled,
    toggle,
  };
});
