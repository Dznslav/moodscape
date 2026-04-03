<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useRecordsStore } from './stores/records';
import { useSleepStore } from './stores/sleep';
import { useThemeStore } from './stores/theme';
import { useLocationStore } from './stores/location';
import BottomNav from './components/BottomNav.vue';
import LocationPromptModal from './components/LocationPromptModal.vue';
import LocationSearchModal from './components/LocationSearchModal.vue';
import { navigateToPostAuthRoute } from './utils/postAuthRoute';

const authStore = useAuthStore();
const recordsStore = useRecordsStore();
const sleepStore = useSleepStore();
useThemeStore();
const locationStore = useLocationStore();
const route = useRoute();
const router = useRouter();
const cachedViewNames = ['StatisticsView'];

const showNav = computed(() =>
  authStore.isAuthenticated && route.meta.requiresAuth === true
);

const isDesktop = ref(window.innerWidth >= 768);
const onResize = () => { isDesktop.value = window.innerWidth >= 768; };
const shouldAutoRefreshLocation = () =>
  Boolean(locationStore.autoDetect && authStore.user?.analytics_consent && !locationStore.isFirstVisit);
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && authStore.isAuthenticated) {
    recordsStore.revalidateIfStale(60_000);
    sleepStore.revalidateIfStale(60_000);
  }
};

const initializeAuthenticatedSession = async () => {
  if (!authStore.token) {
    return;
  }

  if (!authStore.user) {
    await authStore.fetchUser();
  }

  if (!authStore.isAuthenticated) {
    return;
  }

  await navigateToPostAuthRoute(router);

  if (shouldAutoRefreshLocation()) {
    locationStore.ensureFreshLocation();
  }
};

onMounted(() => {
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  if (authStore.token) {
    void initializeAuthenticatedSession();
  }
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

const transitionName = ref('slide-right');

watch(
  () => route.meta.index,
  (toIndex, fromIndex) => {
    if (!toIndex || !fromIndex) {
      transitionName.value = 'fade';
      return;
    }
    transitionName.value = toIndex > fromIndex ? 'slide-left' : 'slide-right';
  }
);
</script>

<template>
  <div :class="['app-layout', { 'app-layout--with-sidebar': showNav && isDesktop }]">
    <BottomNav v-if="showNav" />
    <main class="app-main">
      <router-view v-slot="{ Component, route: currentRoute }">
        <transition :name="isDesktop ? 'fade' : transitionName" mode="out-in">
          <keep-alive :include="cachedViewNames">
            <component :is="Component" :key="String(currentRoute.name || currentRoute.path)" />
          </keep-alive>
        </transition>
      </router-view>
    </main>


    <LocationPromptModal v-if="showNav" />
    <LocationSearchModal v-if="authStore.user?.analytics_consent" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100dvh;
  width: 100%;
  max-width: 100vw;
  overflow-x: clip;
}

.app-main {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow-x: hidden;
}


.app-layout--with-sidebar .app-main {
  margin-left: 220px;
}




.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}


.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}


.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
