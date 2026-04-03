<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 class="title">{{ $t('gdpr.title') }}</h3>
      </div>

      <div class="modal-body">
        <p class="description">{{ $t('gdpr.description') }}</p>

        <div class="options">
          <div class="option">
            <div class="option-info">
              <span class="option-title">{{ $t('gdpr.essential') }}</span>
              <span class="option-desc">{{ $t('gdpr.essentialDesc') }}</span>
            </div>
            <div class="toggle-switch toggle-switch--disabled">
              <input type="checkbox" checked disabled />
              <span class="slider"></span>
            </div>
          </div>

          <div class="option">
            <div class="option-info">
              <span class="option-title">{{ $t('gdpr.analytics') }}</span>
              <span class="option-desc">{{ $t('gdpr.analyticsDesc') }}</span>
            </div>
            <button
              type="button"
              class="toggle-switch"
              :class="{ 'toggle-switch--active': analyticsAccepted }"
              role="switch"
              :aria-checked="analyticsAccepted"
              @click="toggleAnalytics"
            >
              <input type="checkbox" :checked="analyticsAccepted" readonly tabindex="-1" />
              <span class="slider"></span>
            </button>
          </div>
        </div>

        <p class="rights-note">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="info-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          {{ $t('gdpr.rights') }}
        </p>
      </div>

      <div class="modal-actions">
        <p v-if="saveError" class="save-error">{{ saveError }}</p>
        <button class="btn btn--secondary btn--grow" @click="declineAll" :disabled="isSaving">{{ $t('gdpr.decline') }}</button>
        <button class="btn btn--primary btn--grow" @click="acceptSelection" :disabled="isSaving">{{ $t('gdpr.accept') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useLocationStore } from '../stores/location';
import api from '../api/axios';
import { useBodyScrollLock } from '../composables/useBodyScrollLock';
import { playHaptic } from '../utils/haptics';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:isVisible', 'consent-updated']);

const authStore = useAuthStore();
const locationStore = useLocationStore();
const analyticsAccepted = ref(true);

useBodyScrollLock(computed(() => props.isVisible));

const getCookieValue = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }

  return null;
};

const getSavedConsent = () => {
  if (!authStore.user?.id) {
    return null;
  }

  const consentKey = `gdprConsent_${authStore.user.id}`;
  const rawValue = localStorage.getItem(consentKey) || getCookieValue(consentKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(rawValue));
  } catch (error) {
    return null;
  }
};

const syncAnalyticsAccepted = () => {
  const savedConsent = getSavedConsent();

  if (savedConsent && typeof savedConsent.analytics === 'boolean') {
    analyticsAccepted.value = savedConsent.analytics;
    return;
  }

  if (authStore.user?.analytics_consent === true) {
    analyticsAccepted.value = true;
    return;
  }

  analyticsAccepted.value = true;
};
watch(
  () => authStore.user?.analytics_consent,
  () => {
    syncAnalyticsAccepted();
  },
  { immediate: true }
);

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      syncAnalyticsAccepted();
    }
  }
);

const saveError = ref('');
const isSaving = ref(false);

const savePreferences = async () => {
  if (!authStore.user) return true;

  try {
    const res = await api.put('/users/me', { analytics_consent: analyticsAccepted.value });
    authStore.user.analytics_consent = res.data.analytics_consent;
    return true;
  } catch (error) {
    console.error('Failed to save analytics preferences:', error);
    return false;
  }
};

const toggleAnalytics = () => {
  analyticsAccepted.value = !analyticsAccepted.value;
  playHaptic('toggle');
};

const acceptSelection = async ({ intent = 'accept' } = {}) => {
  playHaptic(intent === 'decline' ? 'warning' : 'submit');
  saveError.value = '';
  isSaving.value = true;

  try {
    if (authStore.user) {
      const saved = await savePreferences();
      if (!saved) {
        saveError.value = 'Failed to save preferences. Please try again.';
        playHaptic('error');
        return;
      }

      const preferences = {
        essential: true,
        analytics: analyticsAccepted.value,
        timestamp: new Date().toISOString()
      };
      saveConsent(`gdprConsent_${authStore.user.id}`, preferences, 365);
      emit('consent-updated', preferences);
      if (analyticsAccepted.value) {
        locationStore.setAutoDetect(true);
        locationStore.resetPrompt();
      }
    }
    if (intent === 'accept') {
      playHaptic('success');
    }
    emit('update:isVisible', false);
  } finally {
    isSaving.value = false;
  }
};

const declineAll = () => {
  analyticsAccepted.value = false;
  acceptSelection({ intent: 'decline' });
};

const saveConsent = (name, value, days) => {
  localStorage.setItem(name, JSON.stringify(value));
  let expires = "";
  if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(JSON.stringify(value)) + expires + "; path=/";
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 39, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.modal {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.title {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 60vh;
}

.description {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.option {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-input);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.option-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.4;
}


.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
}

.toggle-switch--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.slider {
  position: absolute;
  cursor: inherit;
  inset: 0;
  background-color: var(--border-focus);
  transition: background-color 0.25s ease;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: transform 0.25s ease;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(10, 14, 39, 0.24);
}

.toggle-switch--active .slider {
  background-color: #F15A22;
}

.toggle-switch--active .slider:before {
  transform: translateX(20px);
}

.toggle-switch--disabled .slider {
  background-color: #4b5563;
}

.toggle-switch--disabled input:checked + .slider:before {
  transform: translateX(20px);
}

.rights-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.4;
  padding: 1rem;
  background: rgba(241, 90, 34, 0.05);
  border-radius: 8px;
  margin: 0;
}
.info-icon {
  flex-shrink: 0;
  color: #F15A22;
  margin-top: 0.1rem;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 767px) {
  .modal-overlay {
    align-items: flex-start;
    padding: max(1rem, env(safe-area-inset-top)) 1rem calc(var(--nav-height, 4.5rem) + 1.5rem);
  }

  .modal {
    margin-top: 0.5rem;
  }

  .modal-body {
    max-height: min(52dvh, 60vh);
  }
}

@media (min-width: 480px) {
  .modal-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}

.btn-primary, .btn-secondary {
  padding: 0.875rem 1.5rem;
  border-radius: 12px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}
.btn-primary {
  background: #F15A22;
  color: white;
  border: none;
}
.btn-primary:hover { opacity: 0.9; }

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}
.btn-secondary:hover {
  background: var(--bg-input);
  color: var(--text-primary);
}

.save-error {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: #ef4444;
  text-align: center;
  margin: 0;
}
</style>
