import { computed, onMounted, ref } from 'vue';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';
import { useLocationStore } from '../stores/location';
import { usePredictionsStore } from '../stores/predictions';
import { useRecordsStore } from '../stores/records';
import { useSleepStore } from '../stores/sleep';
import {
  activityCatalog,
  getActivityDisplayLabel,
  isActivityIgnored,
  isActivitySelected,
  prepareActivitiesForSave,
  toggleActivitySelection,
} from '../utils/activities';
import {
  buildMoodCounterChartData,
  moodCounterOptions,
} from '../utils/chartOptions';
import {
  formatFullDateLabel,
  formatMonthYearLabel,
  getLogicalDate,
  getLogicalDateKey,
  getLocalizedWeekdays,
  getShiftedMonthCursor,
  isFutureMonth,
} from '../utils/date';
import {
  buildMoodDistribution,
  energyEmojis,
  getEnergyEmoji,
  getMoodBackground,
  getMoodColor,
  getMoodEmoji,
  moodEmojis,
} from '../utils/recordPresentation';
import {
  buildCalendarCells,
  filterRecordsByMonth,
} from '../utils/records';
import { normalizeCoordinates } from '../utils/coordinates';
import { useBodyScrollLock } from './useBodyScrollLock';
import { scrollElementToViewportTopAfterRender } from '../utils/formScroll';
import { playHaptic } from '../utils/haptics';

ChartJS.register(ArcElement, Tooltip, Legend);

const defaultMoodValue = 3;
const defaultEnergyValue = 3;
const defaultSleepHours = 8;
const defaultSleepQuality = 2;

const formatSleepHoursValue = (value, locale) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numericValue);
};

export const useCalendarView = ({
  detailStackRef,
  moodDetailCardRef,
  sleepDetailCardRef,
} = {}) => {
  const { t, locale } = useI18n();
  const authStore = useAuthStore();
  const locationStore = useLocationStore();
  const predictionsStore = usePredictionsStore();
  const recordsStore = useRecordsStore();
  const sleepStore = useSleepStore();

  const isLoading = ref(true);
  const logicalToday = getLogicalDate(new Date());
  const viewYear = ref(logicalToday.getFullYear());
  const viewMonth = ref(logicalToday.getMonth());
  const selectedDate = ref(null);
  const calMood = ref(defaultMoodValue);
  const calEnergy = ref(defaultEnergyValue);
  const calNote = ref('');
  const calSelectedTags = ref([]);
  const isEditingCalendar = ref(false);
  const isCalSubmitting = ref(false);
  const calSleepHours = ref(defaultSleepHours);
  const calSleepQuality = ref(defaultSleepQuality);
  const isEditingCalendarSleep = ref(false);
  const isCalSleepSubmitting = ref(false);
  const isMoodCounterInfoOpen = ref(false);

  useBodyScrollLock(isMoodCounterInfoOpen);

  const resetCalendarForm = () => {
    calMood.value = defaultMoodValue;
    calEnergy.value = defaultEnergyValue;
    calNote.value = '';
    calSelectedTags.value = [];
  };

  const resetCalendarSleepForm = () => {
    calSleepHours.value = defaultSleepHours;
    calSleepQuality.value = defaultSleepQuality;
  };

  const populateCalendarForm = (record) => {
    calMood.value = record.mood;
    calEnergy.value = record.energy;
    calNote.value = record.note || '';
    calSelectedTags.value = Array.isArray(record.tags) ? [...record.tags] : [];
  };

  const populateCalendarSleepForm = (sleepLog) => {
    calSleepHours.value = Number(sleepLog?.hours_slept ?? defaultSleepHours);
    calSleepQuality.value = Number(sleepLog?.sleep_quality ?? defaultSleepQuality);
  };

  const availableTags = activityCatalog;
  const activityLabel = (tag) => getActivityDisplayLabel(tag, t);
  const visibleTags = (tags) =>
    Array.isArray(tags) ? tags.filter((tag) => !isActivityIgnored(tag)) : [];
  const isCalTagSelected = (tagId) => isActivitySelected(calSelectedTags.value, tagId);

  const toggleCalTag = (tagId) => {
    calSelectedTags.value = toggleActivitySelection(calSelectedTags.value, tagId);
    playHaptic('chipToggle');
  };

  const selectCalendarMood = (value) => {
    if (calMood.value === value) {
      return;
    }

    calMood.value = value;
    playHaptic('picker');
  };

  const selectCalendarEnergy = (value) => {
    if (calEnergy.value === value) {
      return;
    }

    calEnergy.value = value;
    playHaptic('picker');
  };

  const selectCalendarSleepQuality = (value) => {
    if (calSleepQuality.value === value) {
      return;
    }

    calSleepQuality.value = value;
    playHaptic('picker');
  };

  const updateCalendarSleepHours = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || calSleepHours.value === numericValue) {
      return;
    }

    calSleepHours.value = numericValue;
    playHaptic('picker');
  };

  const records = computed(() => recordsStore.records);
  const sleepLogs = computed(() => sleepStore.logs);
  const weekdays = computed(() => getLocalizedWeekdays(locale.value));
  const recordsByDate = computed(() => recordsStore.recordsByDate);
  const sleepLogsByDate = computed(() => sleepStore.logsByDate);

  const monthYearLabel = computed(() =>
    formatMonthYearLabel(viewYear.value, viewMonth.value, locale.value)
  );

  const calendarCells = computed(() =>
    buildCalendarCells(recordsByDate.value, viewYear.value, viewMonth.value)
  );

  const selectedRecord = computed(() =>
    selectedDate.value ? recordsByDate.value[selectedDate.value] ?? null : null
  );
  const selectedSleepLog = computed(() =>
    selectedDate.value ? sleepLogsByDate.value[selectedDate.value] ?? null : null
  );
  const sleepQualityOptions = computed(() => [
    { value: 1, emoji: '😞', label: t('sleep.qualityBad') },
    { value: 2, emoji: '😌', label: t('sleep.qualityNormal') },
    { value: 3, emoji: '🙂', label: t('sleep.qualityGood') },
  ]);
  const getSleepQualityOption = (value) =>
    sleepQualityOptions.value.find((option) => option.value === Number(value)) ??
    sleepQualityOptions.value[1];
  const selectedSleepQuality = computed(() => getSleepQualityOption(calSleepQuality.value));
  const selectedSleepHoursDisplay = computed(() =>
    formatSleepHoursValue(calSleepHours.value, locale.value)
  );
  const selectedSleepLogHoursDisplay = computed(() =>
    formatSleepHoursValue(selectedSleepLog.value?.hours_slept, locale.value)
  );
  const selectedSleepLogQuality = computed(() =>
    getSleepQualityOption(selectedSleepLog.value?.sleep_quality)
  );
  const sleepRangeProgress = computed(
    () => `${Math.max(0, Math.min(100, (calSleepHours.value / 16) * 100))}%`
  );

  const shiftMonth = (direction) => {
    const nextCursor = getShiftedMonthCursor(viewYear.value, viewMonth.value, direction);
    const currentLogicalDate = getLogicalDate(new Date());

    if (direction > 0 && isFutureMonth(nextCursor.year, nextCursor.month, currentLogicalDate)) {
      return;
    }

    viewYear.value = nextCursor.year;
    viewMonth.value = nextCursor.month;
    selectedDate.value = null;
    isEditingCalendar.value = false;
    isEditingCalendarSleep.value = false;
    playHaptic('secondaryNav');
  };

  const prevMonth = () => shiftMonth(-1);
  const nextMonth = () => shiftMonth(1);
  const canMoveNextMonth = computed(() => {
    const nextCursor = getShiftedMonthCursor(viewYear.value, viewMonth.value, 1);
    return !isFutureMonth(nextCursor.year, nextCursor.month, getLogicalDate(new Date()));
  });

  const closeDetail = () => {
    selectedDate.value = null;
    isEditingCalendar.value = false;
    isEditingCalendarSleep.value = false;
    playHaptic('closePanel');
  };

  const moodFormScrollOptions = {
    align: 'comfort',
    viewportRatio: 0.2,
  };

  const scrollActiveDetailIntoView = async () => {
    if (!selectedDate.value) {
      return;
    }

    if (!selectedRecord.value || isEditingCalendar.value) {
      await scrollElementToViewportTopAfterRender(moodDetailCardRef, moodFormScrollOptions);
      return;
    }

    const target =
      !selectedSleepLog.value || isEditingCalendarSleep.value
        ? sleepDetailCardRef
        : detailStackRef;

    await scrollElementToViewportTopAfterRender(target);
  };

  const selectDate = async (cell) => {
    const todayKey = getLogicalDateKey(new Date());

    if (cell.dateKey > todayKey) {
      return;
    }

    if (selectedDate.value === cell.dateKey) {
      closeDetail();
      return;
    }

    selectedDate.value = cell.dateKey;
    playHaptic('picker');
    const record = recordsByDate.value[cell.dateKey];
    const sleepLog = sleepLogsByDate.value[cell.dateKey];

    if (record) {
      populateCalendarForm(record);
      isEditingCalendar.value = false;
    } else {
      isEditingCalendar.value = true;
      resetCalendarForm();
    }

    if (sleepLog) {
      populateCalendarSleepForm(sleepLog);
      isEditingCalendarSleep.value = false;
    } else {
      isEditingCalendarSleep.value = true;
      resetCalendarSleepForm();
    }

    await scrollActiveDetailIntoView();
  };

  const openMoodCalendarEditor = async () => {
    if (!selectedRecord.value) {
      return;
    }

    populateCalendarForm(selectedRecord.value);
    isEditingCalendar.value = true;
    playHaptic('openPanel');
    await scrollElementToViewportTopAfterRender(moodDetailCardRef, moodFormScrollOptions);
  };

  const cancelMoodCalendarEdit = () => {
    isEditingCalendar.value = false;
    playHaptic('closePanel');

    if (selectedRecord.value) {
      populateCalendarForm(selectedRecord.value);
      return;
    }

    resetCalendarForm();
  };

  const openSleepCalendarEditor = async () => {
    if (!selectedSleepLog.value) {
      return;
    }

    populateCalendarSleepForm(selectedSleepLog.value);
    isEditingCalendarSleep.value = true;
    playHaptic('openPanel');
    await scrollElementToViewportTopAfterRender(sleepDetailCardRef);
  };

  const cancelSleepCalendarEdit = () => {
    isEditingCalendarSleep.value = false;
    playHaptic('closePanel');

    if (selectedSleepLog.value) {
      populateCalendarSleepForm(selectedSleepLog.value);
      return;
    }

    resetCalendarSleepForm();
  };

  const syncSavedRecord = async (response) => {
    if (response?.data?.id) {
      recordsStore.upsertRecord(response.data);
      return;
    }

    await recordsStore.refresh();
  };

  const submitCalendarRecord = async () => {
    if (!selectedDate.value) {
      return;
    }

    isCalSubmitting.value = true;
    playHaptic('submit');

    try {
      const payload = {
        mood: calMood.value,
        energy: calEnergy.value,
        note: calNote.value || null,
        tags: prepareActivitiesForSave(calSelectedTags.value),
      };

      let response;

      if (selectedRecord.value) {
        response = await api.put(`/records/${selectedRecord.value.id}`, payload);
      } else {
        if (authStore.user?.analytics_consent) {
          await locationStore.ensureFreshLocation();
          const { latitude, longitude } = normalizeCoordinates(locationStore.lat, locationStore.lon);
          payload.latitude = latitude;
          payload.longitude = longitude;
        }

        payload.timestamp = `${selectedDate.value}T12:00:00`;
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        response = await api.post('/records/', payload);
      }

      await syncSavedRecord(response);
      predictionsStore.invalidate();
      isEditingCalendar.value = false;
      playHaptic('success');
    } catch (error) {
      console.error('Error saving record:', error);
      playHaptic('error');
      alert(`Error: ${error.response?.data?.detail || 'Could not save the record'}`);
    } finally {
      isCalSubmitting.value = false;
    }
  };

  const submitCalendarSleepLog = async () => {
    if (!selectedDate.value) {
      return;
    }

    isCalSleepSubmitting.value = true;
    playHaptic('submit');

    try {
      await sleepStore.saveTodayLog({
        hours_slept: calSleepHours.value,
        sleep_quality: calSleepQuality.value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        sleep_date: selectedDate.value,
      });

      isEditingCalendarSleep.value = false;
      playHaptic('success');
    } catch (error) {
      console.error('Error saving sleep log:', error);
      playHaptic('error');
      alert(`${t('sleep.saveError')} ${error.response?.data?.detail || ''}`.trim());
    } finally {
      isCalSleepSubmitting.value = false;
    }
  };

  const moodNames = computed(() => [
    t('moods.awful'),
    t('moods.bad'),
    t('moods.meh'),
    t('moods.good'),
    t('moods.super'),
  ]);

  const viewMonthRecords = computed(() =>
    filterRecordsByMonth(records.value, viewYear.value, viewMonth.value)
  );

  const moodDistribution = computed(() =>
    buildMoodDistribution(viewMonthRecords.value, moodNames.value)
  );

  const moodCounterData = computed(() => buildMoodCounterChartData(moodDistribution.value));

  const formatDateFull = (value) => formatFullDateLabel(value, locale.value);

  onMounted(async () => {
    try {
      await Promise.all([recordsStore.ensureLoaded(), sleepStore.ensureLoaded()]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      isLoading.value = false;
    }
  });

  return {
    activityLabel,
    availableTags,
    calEnergy,
    calMood,
    calNote,
    calSleepHours,
    calSleepQuality,
    calSelectedTags,
    calendarCells,
    cancelMoodCalendarEdit,
    cancelSleepCalendarEdit,
    closeDetail,
    energyEmoji: getEnergyEmoji,
    energyEmojis,
    formatDateFull,
    isCalSubmitting,
    isCalSleepSubmitting,
    isCalTagSelected,
    isEditingCalendar,
    isEditingCalendarSleep,
    isLoading,
    isMoodCounterInfoOpen,
    monthYearLabel,
    moodBg: (value) => getMoodBackground(value),
    moodBgSelected: (value) => getMoodBackground(value, { selected: true }),
    moodColor: getMoodColor,
    moodCounterData,
    moodCounterOptions,
    moodDistribution,
    openMoodCalendarEditor,
    moodEmoji: getMoodEmoji,
    moodEmojis,
    canMoveNextMonth,
    nextMonth,
    openSleepCalendarEditor,
    prevMonth,
    records,
    selectedSleepHoursDisplay,
    selectedSleepLog,
    selectedSleepLogHoursDisplay,
    selectedSleepLogQuality,
    selectedSleepQuality,
    selectCalendarEnergy,
    selectCalendarMood,
    selectCalendarSleepQuality,
    selectDate,
    selectedDate,
    selectedRecord,
    sleepLogs,
    sleepQualityOptions,
    sleepRangeProgress,
    submitCalendarRecord,
    submitCalendarSleepLog,
    toggleCalTag,
    updateCalendarSleepHours,
    viewMonthRecords,
    visibleTags,
    weekdays,
  };
};
