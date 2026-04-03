import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import api from '../api/axios';
import { useAuthStore } from './auth';
import { getLogicalDateKey } from '../utils/date';
import { buildRecordsByDate, sortRecordsByNewest } from '../utils/records';

export const useRecordsStore = defineStore('records', () => {
  const records = ref([]);
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

  const recordsByDate = computed(() => buildRecordsByDate(records.value));
  const todayRecord = computed(() => recordsByDate.value[logicalTodayKey.value] ?? null);
  const hasLoaded = computed(() => lastFetchedAt.value > 0 || status.value === 'ready');

  const getSessionKey = () => {
    const authStore = useAuthStore();
    return authStore.token || null;
  };

  const clearForLogout = () => {
    records.value = [];
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
      return records.value;
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
      .get('/records/')
      .then((response) => {
        records.value = sortRecordsByNewest(response.data);
        status.value = 'ready';
        error.value = null;
        lastFetchedAt.value = Date.now();
        activeSessionKey.value = sessionKey;
        return records.value;
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
      return records.value;
    }

    if (activeSessionKey.value && activeSessionKey.value !== sessionKey) {
      clearForLogout();
    }

    if (!force && hasLoaded.value) {
      return records.value;
    }

    return refresh({ background });
  };

  const revalidateIfStale = async (maxAgeMs = 60_000) => {
    if (!getSessionKey()) {
      clearForLogout();
      return records.value;
    }

    if (!hasLoaded.value) {
      return ensureLoaded();
    }

    if (Date.now() - lastFetchedAt.value > maxAgeMs) {
      try {
        await refresh({ background: true });
      } catch (requestError) {
        console.error('Background records refresh failed:', requestError);
      }
    }

    return records.value;
  };

  const upsertRecord = (record) => {
    if (!record?.id) {
      return;
    }

    const nextRecords = [...records.value];
    const existingIndex = nextRecords.findIndex((item) => item.id === record.id);

    if (existingIndex === -1) {
      nextRecords.push(record);
    } else {
      nextRecords.splice(existingIndex, 1, record);
    }

    records.value = sortRecordsByNewest(nextRecords);
    status.value = 'ready';
    error.value = null;
    lastFetchedAt.value = Date.now();
    activeSessionKey.value = getSessionKey();
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
    records,
    recordsByDate,
    refresh,
    revalidateIfStale,
    status,
    todayRecord,
    upsertRecord,
  };
});
