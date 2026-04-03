import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import api from '../api/axios';
import { getLogicalDateKey } from '../utils/date';
import { buildSleepLogsByDate, sortSleepLogsByNewest } from '../utils/sleep';
import { useAuthStore } from './auth';

export const useSleepStore = defineStore('sleep', () => {
  const logs = ref([]);
  const status = ref('idle');
  const error = ref(null);
  const lastFetchedAt = ref(0);
  const activeSessionKey = ref(null);
  const logicalTodayKey = ref(getLogicalDateKey(new Date()));
  let pendingRequest = null;
  let logicalDayTimerId = null;

  const ensureLogicalDayTimer = () => {
    if (typeof window === 'undefined' || logicalDayTimerId) {
      return;
    }

    logicalDayTimerId = window.setInterval(() => {
      logicalTodayKey.value = getLogicalDateKey(new Date());
    }, 60_000);
  };

  ensureLogicalDayTimer();

  const logsByDate = computed(() => buildSleepLogsByDate(logs.value));
  const todayLog = computed(() => logsByDate.value[logicalTodayKey.value] ?? null);
  const hasLoaded = computed(() => lastFetchedAt.value > 0 || status.value === 'ready');

  const getSessionKey = () => {
    const authStore = useAuthStore();
    return authStore.token || null;
  };

  const clearForLogout = () => {
    logs.value = [];
    status.value = 'idle';
    error.value = null;
    lastFetchedAt.value = 0;
    activeSessionKey.value = null;
    pendingRequest = null;
  };

  const refresh = async ({ background = false } = {}) => {
    const sessionKey = getSessionKey();

    if (!sessionKey) {
      clearForLogout();
      return logs.value;
    }

    if (activeSessionKey.value && activeSessionKey.value !== sessionKey) {
      clearForLogout();
    }

    if (pendingRequest) {
      return pendingRequest;
    }

    if (!background || !hasLoaded.value) {
      status.value = hasLoaded.value ? 'refreshing' : 'loading';
    }

    error.value = null;

    pendingRequest = api
      .get('/sleep-logs/')
      .then((response) => {
        logs.value = sortSleepLogsByNewest(response.data);
        status.value = 'ready';
        error.value = null;
        lastFetchedAt.value = Date.now();
        activeSessionKey.value = sessionKey;
        return logs.value;
      })
      .catch((requestError) => {
        error.value = requestError;
        status.value = hasLoaded.value ? 'ready' : 'error';
        throw requestError;
      })
      .finally(() => {
        pendingRequest = null;
      });

    return pendingRequest;
  };

  const ensureLoaded = async ({ force = false, background = false } = {}) => {
    const sessionKey = getSessionKey();

    if (!sessionKey) {
      clearForLogout();
      return logs.value;
    }

    if (activeSessionKey.value && activeSessionKey.value !== sessionKey) {
      clearForLogout();
    }

    if (!force && hasLoaded.value) {
      return logs.value;
    }

    return refresh({ background });
  };

  const revalidateIfStale = async (maxAgeMs = 60_000) => {
    if (!getSessionKey()) {
      clearForLogout();
      return logs.value;
    }

    if (!hasLoaded.value) {
      return ensureLoaded();
    }

    if (Date.now() - lastFetchedAt.value > maxAgeMs) {
      try {
        await refresh({ background: true });
      } catch (requestError) {
        console.error('Background sleep logs refresh failed:', requestError);
      }
    }

    return logs.value;
  };

  const upsertLog = (log) => {
    if (!log?.id || !log?.sleep_date) {
      return;
    }

    const nextLogs = [...logs.value];
    const existingIndex = nextLogs.findIndex((item) => item.id === log.id);

    if (existingIndex === -1) {
      nextLogs.push(log);
    } else {
      nextLogs.splice(existingIndex, 1, log);
    }

    logs.value = sortSleepLogsByNewest(nextLogs);
    status.value = 'ready';
    error.value = null;
    lastFetchedAt.value = Date.now();
    activeSessionKey.value = getSessionKey();
  };

  const saveTodayLog = async ({
    hours_slept,
    sleep_quality,
    timezone,
    sleep_date = getLogicalDateKey(new Date()),
  }) => {
    await ensureLoaded();

    const existingLog = logsByDate.value[sleep_date] ?? null;
    const payload = {
      hours_slept,
      sleep_quality,
      timezone,
      sleep_date,
    };

    const response = existingLog
      ? await api.put(`/sleep-logs/${existingLog.id}`, payload)
      : await api.post('/sleep-logs/', payload);

    upsertLog(response.data);
    return response.data;
  };

  const invalidate = () => {
    lastFetchedAt.value = 0;
    error.value = null;
  };

  return {
    clearForLogout,
    ensureLoaded,
    error,
    hasLoaded,
    invalidate,
    lastFetchedAt,
    logs,
    logsByDate,
    refresh,
    revalidateIfStale,
    saveTodayLog,
    status,
    todayLog,
    upsertLog,
  };
});
