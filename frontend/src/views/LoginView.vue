<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div>
          <router-link to="/" class="page-caption page-caption--link">Moodscape</router-link>
          <h1 class="page-title">{{ $t('auth.loginTitle') }}</h1>
        </div>
      </header>

      <section class="card auth-card">
        <p class="auth-subtitle">{{ $t('auth.loginSubtitle') }}</p>

        <div v-if="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <form @submit.prevent="handleLogin" class="auth-form" novalidate>
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
              :class="{ 'auth-input--error': errorMessage }"
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
                autocomplete="current-password"
                :placeholder="$t('auth.passwordPlaceholder')"
                class="auth-input auth-input--pw"
                :class="{ 'auth-input--error': errorMessage }"
                required
              >
              <button
                type="button"
                class="eye-btn"
                tabindex="-1"
                :aria-label="showPassword ? $t('auth.hidePassword') : $t('auth.showPassword')"
                @click="togglePasswordVisibility"
              >
                <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn--primary btn--block" :disabled="isLoading">
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>{{ $t('auth.loginBtn') }}</span>
          </button>
        </form>

        <p class="auth-footer">
          {{ $t('auth.noAccount') }}
          <router-link to="/register" class="auth-link">{{ $t('auth.createAccount') }}</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { i18n } from '../i18n';
import { useOnboardingStore } from '../stores/onboarding';
import { playHaptic } from '../utils/haptics';

const authStore = useAuthStore();
const onboardingStore = useOnboardingStore();
const translate = (key, params) => i18n.global.t(key, params);

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

onMounted(() => {
  onboardingStore.clearIntroDraft();
});

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
  playHaptic('toggle');
};

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = translate('auth.fillAllFields');
    playHaptic('error');
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  playHaptic('submit');

  try {
    await authStore.login({ username: email.value, password: password.value });
    onboardingStore.clearIntroDraft();
    playHaptic('success');
  } catch (error) {
    if (error.response) {
      if (error.response.status === 401) {
        errorMessage.value = translate('auth.invalidCredentials');
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
