<template>
  <nav :class="['app-nav', { 'app-nav--sidebar': isDesktop }]">

    <div v-if="isDesktop" class="nav-brand">
      <span class="nav-logo">🌤</span>
      <span class="nav-logo-text">Moodscape</span>
    </div>

    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      active-class="nav-item--active"
      @click="handleNavPress(item.to)"
    >
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="item.icon"></svg>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>


    <div v-if="isDesktop && authStore.user?.analytics_consent" class="nav-city" @click="openLocationSearch">
      <span class="nav-city-pin">📍</span>
      <span class="nav-city-name">{{ locationStore.cityName || t('location.notSet') }}</span>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useLocationStore } from '../stores/location';
import { useAuthStore } from '../stores/auth';
import { playHaptic } from '../utils/haptics';

const { t } = useI18n();
const authStore = useAuthStore();
const locationStore = useLocationStore();
const route = useRoute();

const isDesktop = ref(window.innerWidth >= 768);

const onResize = () => {
  isDesktop.value = window.innerWidth >= 768;
};

onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const handleNavPress = (targetPath) => {
  playHaptic(route.path === targetPath ? 'secondaryNav' : 'tabSwitch');
};

const openLocationSearch = () => {
  playHaptic('secondaryNav');
  locationStore.openSearchModal();
};

const navItems = computed(() => [
  {
    to: '/records',
    label: t('nav.records'),
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  },
  {
    to: '/sleep',
    label: t('nav.sleep'),
    icon: '<path d="M21 12.79A9 9 0 1 1 11.21 3c0 5.07 4.72 9.79 9.79 9.79z"/>',
  },
  {
    to: '/statistics',
    label: t('nav.statistics'),
    icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  },
  {
    to: '/calendar',
    label: t('nav.calendar'),
    icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  },
  {
    to: '/prediction',
    label: t('nav.prediction'),
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  },
  {
    to: '/settings',
    label: t('nav.settings'),
    icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  },
]);
</script>

<style scoped>

.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--bg-nav);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-color);
  padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  padding-top: 0.5rem;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.nav-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.1875rem;
  min-width: 0;
  padding: 0.375rem 0.15rem;
  color: var(--text-tertiary);
  text-decoration: none;
  border-radius: 10px;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.nav-item--active {
  color: #F15A22;
}

.nav-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.nav-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.625rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}


.nav-brand {
  display: none;
}


.app-nav--sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: auto;
  width: 220px;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  padding: 1.5rem 0.75rem;
  gap: 0.25rem;
  border-top: none;
  border-right: 1px solid var(--border-color);
  background: var(--bg-nav);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.app-nav--sidebar .nav-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 1.5rem;
}

.nav-logo {
  font-size: 1.5rem;
}

.nav-logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.app-nav--sidebar .nav-item {
  flex: 0 0 auto;
  flex-direction: row;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  transition: color 0.2s, background 0.15s;
}

.app-nav--sidebar .nav-item:hover {
  background: var(--bg-input);
}

.app-nav--sidebar .nav-item--active {
  background: rgba(241, 90, 34, 0.1);
  color: #F15A22;
}

.app-nav--sidebar .nav-icon {
  width: 22px;
  height: 22px;
}

.app-nav--sidebar .nav-label {
  font-size: 0.9375rem;
  font-weight: 500;
}


.nav-city {
  display: none;
}

.app-nav--sidebar .nav-city {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  cursor: pointer;
  border-radius: 0 0 0 0;
  transition: background 0.15s;
}
.app-nav--sidebar .nav-city:hover {
  background: var(--bg-input);
}

.nav-city-pin {
  font-size: 1rem;
}

.nav-city-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
