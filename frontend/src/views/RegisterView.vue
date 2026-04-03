<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div>
          <router-link to="/" class="page-caption page-caption--link">Moodscape</router-link>
          <h1 class="page-title">{{ $t('auth.registerTitle') }}</h1>
        </div>
      </header>

      <section class="card auth-card">
        <p class="auth-subtitle">{{ $t('auth.registerSubtitle') }}</p>

        <div v-if="introDraft" class="welcome-summary">
          <span class="welcome-summary__label">{{ $t('welcome.registerSummary') }}</span>
          <div class="welcome-summary__value">
            <span class="welcome-summary__chip">
              {{ introMoodEmoji }} {{ introMoodLabel }}
            </span>
            <span class="welcome-summary__plus">+</span>
            <span class="welcome-summary__chip welcome-summary__chip--energy">
              {{ introEnergyEmoji }} {{ introEnergyLabel }}
            </span>
          </div>
          <p class="welcome-summary__note">{{ $t('welcome.registerSummaryText') }}</p>
        </div>

        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <form @submit.prevent="handleRegister" class="auth-form" novalidate>
          <div class="auth-field">
            <label for="name" class="auth-label">{{ $t('auth.name') }}</label>
            <input
              id="name"
              v-model="name"
              type="text"
              autocomplete="given-name"
              :placeholder="$t('auth.namePlaceholder')"
              class="auth-input"
              required
            >
          </div>

          <div class="auth-field">
            <label for="email" class="auth-label">{{ $t('auth.email') }}</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              :placeholder="$t('auth.emailPlaceholder')"
              class="auth-input"
              required
            >
          </div>

          <div class="auth-field">
            <label for="password" class="auth-label">{{ $t('auth.password') }}</label>
            <div class="input-wrap">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :placeholder="$t('auth.passwordMinPlaceholder')"
                class="auth-input auth-input--pw"
                required
              >
              <button
                type="button"
                class="eye-btn"
                tabindex="-1"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                @click="togglePasswordVisibility"
              >
                <svg
                  v-if="!showPassword"
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>

            <div v-if="password.length > 0" class="strength-bar">
              <div class="strength-track">
                <div class="strength-fill" :style="{ width: strengthWidth, background: strengthColor }"></div>
              </div>
              <span class="strength-label" :style="{ color: strengthColor }">{{ strengthLabel }}</span>
            </div>
          </div>

          <div class="auth-field">
            <label for="confirm" class="auth-label">{{ $t('auth.confirmPassword') }}</label>
            <input
              id="confirm"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              :placeholder="$t('auth.confirmPasswordPlaceholder')"
              class="auth-input"
              :class="{ 'auth-input--error': confirmPassword && password !== confirmPassword }"
              required
            >
            <p v-if="confirmPassword && password !== confirmPassword" class="field-error">
              {{ $t('auth.passwordsMismatch') }}
            </p>
          </div>

          <button
            type="submit"
            class="btn btn--primary btn--block"
            :disabled="isLoading || (confirmPassword.length > 0 && password !== confirmPassword)"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>{{ $t('auth.registerBtn') }}</span>
          </button>
        </form>

        <p class="auth-footer">
          {{ $t('auth.haveAccount') }}
          <router-link to="/login" class="auth-link">{{ $t('auth.signIn') }}</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';
import { i18n } from '../i18n';
import { useOnboardingStore } from '../stores/onboarding';
import { usePredictionsStore } from '../stores/predictions';
import { useRecordsStore } from '../stores/records';
import { getEnergyEmoji, getMoodEmoji } from '../utils/recordPresentation';
import { playHaptic } from '../utils/haptics';

const authStore = useAuthStore();
const onboardingStore = useOnboardingStore();
const predictionsStore = usePredictionsStore();
const recordsStore = useRecordsStore();
const router = useRouter();
const translate = (key, params) => i18n.global.t(key, params);

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

onboardingStore.getIntroDraft();

const introDraft = computed(() => onboardingStore.introDraft);
const moodLabels = computed(() => [
  translate('moods.awful'),
  translate('moods.bad'),
  translate('moods.meh'),
  translate('moods.good'),
  translate('moods.super'),
]);
const energyLabels = computed(() =>
  Array.from({ length: 5 }, (_, index) => translate(`dashboard.energyLevel${index + 1}`))
);
const introMoodLabel = computed(() =>
  introDraft.value ? moodLabels.value[introDraft.value.mood - 1] : ''
);
const introEnergyLabel = computed(() =>
  introDraft.value ? energyLabels.value[introDraft.value.energy - 1] : ''
);
const introMoodEmoji = computed(() =>
  introDraft.value ? getMoodEmoji(introDraft.value.mood) : ''
);
const introEnergyEmoji = computed(() =>
  introDraft.value ? getEnergyEmoji(introDraft.value.energy) : ''
);

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
  playHaptic('toggle');
};

const passwordStrength = computed(() => {
  const nextPassword = password.value;

  if (nextPassword.length === 0) return 0;
  if (nextPassword.length < 6) return 1;
  if (nextPassword.length < 10) return 2;

  const hasUpper = /[A-Z]/.test(nextPassword);
  const hasNum = /\d/.test(nextPassword);
  const hasSymbol = /[^A-Za-z0-9]/.test(nextPassword);

  return 2 + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSymbol ? 1 : 0);
});

const strengthWidth = computed(
  () => ['0%', '25%', '50%', '70%', '85%', '100%'][Math.min(passwordStrength.value, 5)]
);
const strengthColor = computed(
  () => ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'][Math.min(passwordStrength.value, 5)]
);
const strengthLabel = computed(
  () => [
    '',
    translate('auth.passwordStrengthWeak'),
    translate('auth.passwordStrengthWeak'),
    translate('auth.passwordStrengthMedium'),
    translate('auth.passwordStrengthGood'),
    translate('auth.passwordStrengthExcellent'),
  ][Math.min(passwordStrength.value, 5)]
);

const saveWelcomeIntroRecord = async (draft) => {
  const response = await api.post('/records/', {
    mood: draft.mood,
    energy: draft.energy,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  if (response?.data?.id) {
    recordsStore.upsertRecord(response.data);
    predictionsStore.invalidate();
  }

  return response;
};

const finalizeWelcomeIntroFallback = async () => {
  recordsStore.invalidate();

  try {
    await recordsStore.ensureLoaded({ force: true });
  } catch (verificationError) {
    console.error('Failed to verify welcome intro autosave state:', verificationError);
  }

  if (recordsStore.todayRecord) {
    onboardingStore.clearIntroDraft();
  }

  await router.replace('/records');
};

const handleRegister = async () => {
  errorMessage.value = '';

  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    errorMessage.value = translate('auth.fillAllFields');
    playHaptic('error');
    return;
  }

  if (password.value.length < 6) {
    errorMessage.value = translate('auth.passwordMinLength');
    playHaptic('error');
    return;
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = translate('auth.passwordsMismatch');
    playHaptic('error');
    return;
  }

  isLoading.value = true;
  playHaptic('submit');

  try {
    const draft = introDraft.value;

    await api.post('/auth/register', {
      name: name.value,
      email: email.value,
      password: password.value,
    });

    if (draft) {
      await authStore.login(
        { username: email.value, password: password.value },
        { navigate: false }
      );

      try {
        await saveWelcomeIntroRecord(draft);
        await recordsStore.refresh();
        onboardingStore.clearIntroDraft();
        await router.replace('/records');
        playHaptic('success');
      } catch (autosaveError) {
        console.error('Failed to auto-save welcome intro record:', autosaveError);
        playHaptic('warning');
        await finalizeWelcomeIntroFallback();
      }

      return;
    }

    await authStore.login({ username: email.value, password: password.value });
    playHaptic('success');
  } catch (error) {
    if (error.response) {
      if (error.response.status === 400) {
        errorMessage.value = translate('auth.emailTaken');
      } else if (error.response.status === 422) {
        errorMessage.value = translate('auth.checkEmailFormat');
      } else {
        errorMessage.value = translate('auth.serverError', { status: error.response.status });
      }
    } else if (error.request) {
      errorMessage.value = translate('auth.networkError');
    } else {
      errorMessage.value = translate('auth.unknownError');
    }

    playHaptic('error');
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>

.page {
  min-height: 100dvh;
  background: var(--bg-page);
  position: relative;
  transition: background 0.3s ease;
  display: flex;
  flex-direction: column;
}

.bg-glow {
  position: fixed;
  inset: 0;
  background: var(--app-page-glow);
  pointer-events: none;
  z-index: 0;
  transition: opacity 0.3s ease;
}

.content {
  position: relative;
  z-index: 1;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  flex: 1;
  justify-content: center;
  gap: 1.25rem;
}


.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.page-caption {
  font-family: var(--font-body);
  font-size: 0.875rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-orange);
  margin-bottom: 0.2rem;
}

.page-caption--link {
  text-decoration: none;
  display: inline-block;
  transition: opacity 0.2s;
}

.page-caption--link:hover {
  opacity: 0.8;
}

.page-title {
  font-family: var(--font-heading);
  font-size: clamp(1.75rem, 5vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  line-height: 1.1;
}


.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 1.25rem;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.auth-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-subtitle {
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}


.welcome-summary {
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid rgba(241, 90, 34, 0.18);
  background: var(--bg-input);
}

.welcome-summary__label {
  display: block;
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 0.7rem;
}

.welcome-summary__value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.welcome-summary__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: rgba(241, 90, 34, 0.1);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
}

.welcome-summary__chip--energy {
  background: rgba(79, 172, 254, 0.1);
}

.welcome-summary__plus {
  color: var(--text-tertiary);
  font-size: 1rem;
  font-weight: 700;
}

.welcome-summary__note {
  margin: 0.8rem 0 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-secondary);
}


.error-banner {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}


.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.auth-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}


.auth-input {
  width: 100%;
  padding: 0.8125rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  -webkit-appearance: none;
}

.auth-input::placeholder {
  color: var(--text-tertiary);
}

.auth-input:focus {
  border-color: var(--border-focus);
}

.auth-input--error {
  border-color: rgba(239, 68, 68, 0.5);
}

.auth-input--pw {
  padding-right: 3rem;
}


.input-wrap {
  position: relative;
}

.eye-btn {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.eye-btn:hover {
  color: var(--text-secondary);
}


.strength-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.strength-track {
  flex: 1;
  height: 3px;
  background: var(--border-color);
  border-radius: 99px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease, background 0.4s ease;
}

.strength-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  min-width: 4rem;
  text-align: right;
  transition: color 0.3s;
}

.field-error {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: #ef4444;
}


.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}


.auth-footer {
  margin: 0.5rem 0 0;
  text-align: center;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.auth-link {
  color: var(--color-orange);
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.2s;
}

.auth-link:hover {
  opacity: 0.8;
}
</style>
