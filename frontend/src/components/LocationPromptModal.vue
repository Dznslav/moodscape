<template>
  <Transition name="prompt-fade">
    <div v-if="locationStore.isFirstVisit && authStore.user?.analytics_consent" class="prompt-overlay" @click.self="skip">
      <div class="prompt-card">
        <div class="prompt-icon">🌍</div>
        <h2 class="prompt-title">{{ $t('location.promptTitle') }}</h2>
        <p class="prompt-text">{{ $t('location.promptText') }}</p>

        <div class="prompt-actions">
          <button class="btn btn--primary btn--block" @click="useGPS" :disabled="isRequesting">
            <span v-if="isRequesting" class="spinner-small"></span>
            <span v-else>📡</span>
            {{ $t('location.btnGPS') }}
          </button>
          <button class="btn btn--secondary btn--block" @click="useManual">
            🔍 {{ $t('location.btnManual') }}
          </button>
        </div>

        <p v-if="gpsError" class="prompt-error">{{ gpsError }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useLocationStore } from '../stores/location';
import { useAuthStore } from '../stores/auth';
import { useI18n } from 'vue-i18n';
import { useBodyScrollLock } from '../composables/useBodyScrollLock';
import { playHaptic } from '../utils/haptics';

const { t } = useI18n();
const locationStore = useLocationStore();
const authStore = useAuthStore();
watch(() => authStore.user?.analytics_consent, (val) => {
  if (val === false) {
    locationStore.setFinishedPrompt();
  }
}, { immediate: true });

const showPrompt = computed(() => locationStore.isFirstVisit && authStore.user?.analytics_consent);
useBodyScrollLock(showPrompt);

const isRequesting = ref(false);
const gpsError = ref('');

const useGPS = async () => {
  isRequesting.value = true;
  gpsError.value = '';
  playHaptic('submit');
  try {
    await locationStore.requestBrowserLocation();
    locationStore.setFinishedPrompt();
    playHaptic('success');
  } catch (e) {
    gpsError.value = e.message || t('location.gpsError');
    playHaptic('error');
  } finally {
    isRequesting.value = false;
  }
};

const useManual = () => {
  playHaptic('openPanel');
  locationStore.setAutoDetect(false);
  locationStore.setFinishedPrompt();
  locationStore.openSearchModal();
};

const skip = () => {
  playHaptic('closePanel');
  locationStore.setAutoDetect(false);
  locationStore.setFinishedPrompt();
};
</script>

<style scoped>
.prompt-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 1.5rem;
}

.prompt-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 2.5rem 2rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
  animation: card-rise 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.prompt-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.prompt-title {
  font-family: 'Syne', sans-serif;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.prompt-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 1.75rem;
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-gps {
  width: 100%;
  padding: 0.9375rem;
  border-radius: 14px;
  background: linear-gradient(135deg, #F15A22, #e04a15);
  color: white;
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: opacity 0.2s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.btn-gps:hover:not(:disabled) { opacity: 0.9; }
.btn-gps:active:not(:disabled) { transform: scale(0.98); }
.btn-gps:disabled { opacity: 0.55; cursor: not-allowed; }

.btn-manual {
  width: 100%;
  padding: 0.875rem;
  border-radius: 14px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background 0.2s, border-color 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.btn-manual:hover {
  border-color: #F15A22;
  background: rgba(241, 90, 34, 0.06);
}

.prompt-error {
  margin-top: 1rem;
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: #ef4444;
}

.spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}


.prompt-fade-enter-active,
.prompt-fade-leave-active {
  transition: opacity 0.3s ease;
}
.prompt-fade-enter-from,
.prompt-fade-leave-to {
  opacity: 0;
}
</style>
