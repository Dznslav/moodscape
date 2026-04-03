import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getLogicalDateKey } from '../utils/date';

const STORAGE_KEY = 'moodscape_welcome_intro_draft';
const WELCOME_INTRO_SOURCE = 'welcome_intro';
const isBrowser = typeof window !== 'undefined';

const clearStoredDraft = () => {
  if (!isBrowser) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
};

const readStoredDraft = () => {
  if (!isBrowser) {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.error('Failed to read welcome intro draft:', error);
    clearStoredDraft();
    return null;
  }
};

const normalizeLevel = (value) => {
  const numericValue = Number(value);

  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 5) {
    return null;
  }

  return numericValue;
};

const normalizeDraft = (value) => {
  if (!value || value.source !== WELCOME_INTRO_SOURCE) {
    return null;
  }

  const mood = normalizeLevel(value.mood);
  const energy = normalizeLevel(value.energy);
  const createdAt = String(value.createdAt || '').trim();

  if (mood === null || energy === null || !createdAt) {
    return null;
  }

  const createdAtDate = new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) {
    return null;
  }

  if (getLogicalDateKey(createdAtDate) !== getLogicalDateKey(new Date())) {
    return null;
  }

  return {
    mood,
    energy,
    source: WELCOME_INTRO_SOURCE,
    createdAt: createdAtDate.toISOString(),
  };
};

export const useOnboardingStore = defineStore('onboarding', () => {
  const introDraft = ref(normalizeDraft(readStoredDraft()));

  const persistDraft = () => {
    if (!isBrowser) {
      return;
    }

    if (!introDraft.value) {
      clearStoredDraft();
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(introDraft.value));
  };

  const getIntroDraft = () => {
    introDraft.value = normalizeDraft(introDraft.value ?? readStoredDraft());
    persistDraft();
    return introDraft.value;
  };

  const setIntroDraft = ({ mood, energy, source = WELCOME_INTRO_SOURCE }) => {
    introDraft.value = normalizeDraft({
      mood,
      energy,
      source,
      createdAt: new Date().toISOString(),
    });
    persistDraft();
    return introDraft.value;
  };

  const clearIntroDraft = () => {
    introDraft.value = null;
    persistDraft();
  };

  const consumeIntroDraft = () => {
    const draft = getIntroDraft();
    if (!draft) {
      return null;
    }

    clearIntroDraft();
    return draft;
  };

  getIntroDraft();

  return {
    clearIntroDraft,
    consumeIntroDraft,
    getIntroDraft,
    hasIntroDraft: computed(() => Boolean(introDraft.value)),
    introDraft,
    setIntroDraft,
  };
});
