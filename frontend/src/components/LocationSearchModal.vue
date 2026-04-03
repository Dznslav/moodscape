<template>
  <Transition name="search-slide">
    <div v-if="locationStore.searchModalOpen" class="search-overlay" @click.self="close">
      <div class="search-panel">
        <div class="search-header">
          <h2 class="search-title">{{ $t('location.searchTitle') }}</h2>
          <button class="close-btn" @click="close" aria-label="Close">✕</button>
        </div>

        <div class="search-input-wrap">
          <span class="search-icon-input">🔍</span>
          <input
            ref="inputRef"
            type="text"
            class="search-input"
            :placeholder="$t('location.searchPlaceholder')"
            v-model="query"
            @input="onInput"
            autocomplete="off"
          />
          <span v-if="locationStore.isSearching" class="spinner-input"></span>
        </div>

        <div class="search-results">
          <div v-if="locationStore.isSearching && !locationStore.searchResults.length" class="search-state">
            <span class="search-state-icon">⏳</span>
            <span>{{ $t('location.searchLoading') }}</span>
          </div>

          <div v-else-if="query.length >= 2 && !locationStore.searchResults.length && !locationStore.isSearching" class="search-state">
            <span class="search-state-icon">🤷</span>
            <span>{{ $t('location.searchEmpty') }}</span>
          </div>

          <button
            v-for="(result, i) in locationStore.searchResults"
            :key="i"
            class="result-item"
            @click="selectCity(result)"
          >
            <span class="result-pin">📍</span>
            <div class="result-info">
              <span class="result-name">{{ result.name }}</span>
              <span class="result-detail">{{ result.displayName }}</span>
            </div>
          </button>
        </div>


        <div class="current-city">
          <span class="current-label">{{ $t('location.myCity') }}:</span>
          <span class="current-name">📍 {{ locationStore.cityName || $t('location.notSet') }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, nextTick, onBeforeUnmount, watch } from 'vue';
import { useLocationStore } from '../stores/location';
import { useI18n } from 'vue-i18n';
import { useBodyScrollLock } from '../composables/useBodyScrollLock';
import { playHaptic } from '../utils/haptics';

const { t, locale } = useI18n();
const locationStore = useLocationStore();

const query = ref('');
const inputRef = ref(null);
let debounceTimer = null;

useBodyScrollLock(computed(() => locationStore.searchModalOpen));

const onInput = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void locationStore.searchCities(query.value, locale.value);
  }, 400);
};

const selectCity = async (result) => {
  try {
    await locationStore.setLocation(result.lat, result.lon, result.name);
    playHaptic('picker');
    locationStore.setAutoDetect(false);
    close({ silent: true });
  } catch (error) {
    console.error('Failed to select city:', error);
    playHaptic('error');
  }
};

const close = ({ silent = false } = {}) => {
  if (!silent) {
    playHaptic('closePanel');
  }
  clearTimeout(debounceTimer);
  query.value = '';
  locationStore.closeSearchModal();
};

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
});
watch(() => locationStore.searchModalOpen, (open) => {
  if (open) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});
</script>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.search-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-bottom: none;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 500px;
  max-height: 85dvh;
  padding: 1.5rem 1.25rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: panel-slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes panel-slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-title {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.close-btn:hover {
  background: var(--bg-page);
}

.search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon-input {
  position: absolute;
  left: 1rem;
  font-size: 1rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.9375rem 1rem 0.9375rem 2.75rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  -webkit-appearance: none;
  appearance: none;
}
.search-input::placeholder {
  color: var(--text-tertiary);
}
.search-input:focus {
  border-color: #F15A22;
}

.spinner-input {
  position: absolute;
  right: 1rem;
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-top-color: #F15A22;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-results {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  max-height: 50dvh;
  gap: 0.25rem;
}

.search-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  justify-content: center;
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.search-state-icon {
  font-size: 1.5rem;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  width: 100%;
}
.result-item:hover {
  background: var(--bg-input);
}
.result-item:active {
  background: rgba(241, 90, 34, 0.08);
}

.result-pin {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.result-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.result-detail {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-city {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: rgba(241, 90, 34, 0.06);
  border: 1px solid rgba(241, 90, 34, 0.15);
  border-radius: 12px;
  margin-top: auto;
}

.current-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.current-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #F15A22;
}


.search-slide-enter-active,
.search-slide-leave-active {
  transition: opacity 0.25s ease;
}
.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
}
</style>
