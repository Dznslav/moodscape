import { getActivityGroupKey } from './activities';
import { getDateFromKey, getDateKey, getLogicalDateKey } from './date';
import { getMoodColor } from './recordPresentation';

const DAY_MS = 1000 * 60 * 60 * 24;
const minimumActivityDays = 5;
const minimumComparisonDays = 7;
const minimumNextDaySampleSize = 4;
const minimumMeaningfulEffect = 0.2;
const minimumSleepGroupDays = 5;
const minimumSleepPairedDays = 7;
const sleepHourZones = [
  { key: 'under7', labelKey: 'statistics.sleepHoursZoneUnder7', test: (hours) => hours < 7 },
  { key: 'from7to9', labelKey: 'statistics.sleepHoursZone7to9', test: (hours) => hours >= 7 && hours <= 9 },
  { key: 'over9', labelKey: 'statistics.sleepHoursZoneOver9', test: (hours) => hours > 9 },
];
const sleepQualityLevels = [
  { key: 'quality1', labelKey: 'sleep.qualityBad', value: 1 },
  { key: 'quality2', labelKey: 'sleep.qualityNormal', value: 2 },
  { key: 'quality3', labelKey: 'sleep.qualityGood', value: 3 },
];

const getMoodScore = (record) => {
  const score = Number(record?.mood);
  return Number.isFinite(score) ? score : null;
};

const average = (values) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

const roundNumber = (value) => (value === null ? null : +value.toFixed(2));

const getEnergyScore = (record) => {
  const score = Number(record?.energy ?? 3);
  return Number.isFinite(score) ? score : null;
};

const addDays = (date, amount) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

const getWeekdayIndex = (date) => {
  const weekday = date.getDay();
  return weekday === 0 ? 6 : weekday - 1;
};

const getRecordActivitySet = (record) => {
  const activitySet = new Set();

  if (!Array.isArray(record?.tags)) {
    return activitySet;
  }

  for (const tag of record.tags) {
    const groupKey = getActivityGroupKey(tag);

    if (groupKey) {
      activitySet.add(groupKey);
    }
  }

  return activitySet;
};

const getObservedActivities = (recordsByDate) => {
  const observedActivities = new Map();

  for (const record of Object.values(recordsByDate)) {
    if (!Array.isArray(record?.tags)) {
      continue;
    }

    for (const tag of record.tags) {
      const groupKey = getActivityGroupKey(tag);

      if (!groupKey || observedActivities.has(groupKey)) {
        continue;
      }

      observedActivities.set(groupKey, String(tag ?? '').trim() || groupKey);
    }
  }

  return observedActivities;
};

const classifyActivityImpactConfidence = ({
  withCount,
  withoutCount,
  nextDayWithCount,
  nextDayWithoutCount,
}) => {
  const sameDaySupport = Math.min(withCount, withoutCount);
  const nextDaySupport = Math.min(nextDayWithCount, nextDayWithoutCount);

  if (sameDaySupport >= 12 && nextDaySupport >= 8) {
    return 'high';
  }

  if (sameDaySupport >= 8) {
    return 'medium';
  }

  return 'low';
};

const buildSleepImpactItems = ({
  baselineEnergy,
  baselineMood,
  groups,
}) =>
  groups.map((group) => {
    const avgMood = roundNumber(average(group.moods));
    const avgEnergy = roundNumber(average(group.energies));

    return {
      avgEnergy,
      avgMood,
      count: group.moods.length,
      energyDelta:
        avgEnergy === null || baselineEnergy === null
          ? null
          : roundNumber(avgEnergy - baselineEnergy),
      hasEnoughData: group.moods.length >= minimumSleepGroupDays,
      key: group.key,
      labelKey: group.labelKey,
      moodDelta:
        avgMood === null || baselineMood === null
          ? null
          : roundNumber(avgMood - baselineMood),
    };
  });

const pickSleepInsightItem = (items, metricKey) => {
  const averageKey = metricKey === 'mood' ? 'avgMood' : 'avgEnergy';
  const deltaKey = metricKey === 'mood' ? 'moodDelta' : 'energyDelta';

  return (
    items
      .filter(
        (item) =>
          item.hasEnoughData &&
          Number.isFinite(item[averageKey]) &&
          Number.isFinite(item[deltaKey]) &&
          Math.abs(item[deltaKey]) >= minimumMeaningfulEffect
      )
      .sort(
        (left, right) =>
          Math.abs(right[deltaKey] ?? 0) - Math.abs(left[deltaKey] ?? 0) ||
          (right[averageKey] ?? Number.NEGATIVE_INFINITY) -
            (left[averageKey] ?? Number.NEGATIVE_INFINITY) ||
          right.count - left.count
      )[0] ?? null
  );
};

const classifySleepInsightConfidence = ({
  pairedCount,
  primaryItem,
  secondaryItem,
}) => {
  if (!primaryItem && !secondaryItem) {
    return 'low';
  }

  const primaryCount = primaryItem?.count ?? 0;
  const secondaryCount = secondaryItem?.count ?? 0;

  if (pairedCount >= 18 && primaryCount >= 8 && (!secondaryItem || secondaryCount >= 8)) {
    return 'high';
  }

  if (pairedCount >= 12 && primaryCount >= 6) {
    return 'medium';
  }

  return 'low';
};

const mapSleepInsightItem = (item, metricKey) => {
  if (!item) {
    return null;
  }

  const averageKey = metricKey === 'mood' ? 'avgMood' : 'avgEnergy';
  const deltaKey = metricKey === 'mood' ? 'moodDelta' : 'energyDelta';

  return {
    average: item[averageKey],
    count: item.count,
    delta: item[deltaKey],
    key: item.key,
    labelKey: item.labelKey,
  };
};

const buildSleepImpactRow = ({
  baseline,
  hourItems,
  metricKey,
  pairedCount,
  qualityItems,
}) => {
  const hasEnoughHistory = pairedCount >= minimumSleepPairedDays;
  const primaryQuality = hasEnoughHistory ? pickSleepInsightItem(qualityItems, metricKey) : null;
  const secondaryDuration = hasEnoughHistory ? pickSleepInsightItem(hourItems, metricKey) : null;
  const deltaFromBaseline =
    primaryQuality?.[metricKey === 'mood' ? 'moodDelta' : 'energyDelta'] ??
    secondaryDuration?.[metricKey === 'mood' ? 'moodDelta' : 'energyDelta'] ??
    null;

  return {
    baseline,
    confidence: classifySleepInsightConfidence({
      pairedCount,
      primaryItem: primaryQuality,
      secondaryItem: secondaryDuration,
    }),
    deltaFromBaseline: Number.isFinite(deltaFromBaseline) ? deltaFromBaseline : null,
    durationInsight: mapSleepInsightItem(secondaryDuration, metricKey),
    hasEnoughHistory,
    isInconclusive: !hasEnoughHistory || (!primaryQuality && !secondaryDuration),
    metricKey,
    pairedCount,
    qualityInsight: mapSleepInsightItem(primaryQuality, metricKey),
    sampleSize: pairedCount,
  };
};

export const buildYearInPixels = (recordsByDate, year) => {
  if (!Number.isFinite(year)) {
    return {
      columns: 0,
      coverage: { logged: 0, total: 365 },
      monthMarkers: [],
      weeks: [],
    };
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const gridStart = addDays(yearStart, -getWeekdayIndex(yearStart));
  const gridEnd = addDays(yearEnd, 6 - getWeekdayIndex(yearEnd));
  const todayKey = getLogicalDateKey(new Date());
  const weeks = [];

  for (let cursor = new Date(gridStart); cursor <= gridEnd; ) {
    const week = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const cellDate = new Date(cursor);
      const key = getDateKey(cellDate);
      const inYear = cellDate.getFullYear() === year;
      const record = inYear ? recordsByDate[key] ?? null : null;
      const mood = getMoodScore(record);

      week.push({
        key,
        color: mood === null ? null : getMoodColor(mood),
        hasRecord: Boolean(record),
        inYear,
        isToday: key === todayKey,
        mood,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(week);
  }

  const monthMarkers = Array.from({ length: 12 }, (_, monthIndex) => {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const dayOffset = Math.round((firstOfMonth - gridStart) / DAY_MS);

    return {
      column: Math.floor(dayOffset / 7) + 1,
      labelDate: firstOfMonth,
      monthIndex,
    };
  });

  const totalDays = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;

  return {
    columns: weeks.length,
    coverage: {
      logged: Object.keys(recordsByDate).length,
      total: totalDays,
    },
    monthMarkers,
    weeks,
  };
};

export const buildMoodInstability = (recordsByDate) => {
  const entries = Object.entries(recordsByDate)
    .map(([dateKey, record]) => ({
      dateKey,
      mood: getMoodScore(record),
    }))
    .filter((entry) => entry.mood !== null)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));

  if (entries.length < 2) {
    return {
      comparisons: 0,
      rmssd: null,
    };
  }

  const squaredDiffs = [];

  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1];
    const current = entries[index];
    const previousDate = getDateFromKey(previous.dateKey);
    const currentDate = getDateFromKey(current.dateKey);
    const diffDays = Math.round((currentDate - previousDate) / DAY_MS);

    if (diffDays !== 1) {
      continue;
    }

    squaredDiffs.push(Math.pow(current.mood - previous.mood, 2));
  }

  if (!squaredDiffs.length) {
    return {
      comparisons: 0,
      rmssd: null,
    };
  }

  return {
    comparisons: squaredDiffs.length,
    rmssd: roundNumber(Math.sqrt(average(squaredDiffs))),
  };
};

export const buildActivityImpact = ({ analysisRecordsByDate, allRecordsByDate }) => {
  const dateKeys = Object.keys(analysisRecordsByDate).sort();

  if (!dateKeys.length) {
    return [];
  }

  const observedActivities = getObservedActivities(analysisRecordsByDate);

  if (!observedActivities.size) {
    return [];
  }

  const days = dateKeys
    .map((dateKey) => {
      const record = analysisRecordsByDate[dateKey];
      const mood = getMoodScore(record);

      if (mood === null) {
        return null;
      }

      const nextDateKey = getDateKey(addDays(getDateFromKey(dateKey), 1));

      return {
        activities: getRecordActivitySet(record),
        mood,
        nextMood: getMoodScore(allRecordsByDate[nextDateKey]),
      };
    })
    .filter(Boolean);

  return Array.from(observedActivities.entries())
    .map(([groupKey, sampleTag]) => {
      const sameDayWith = [];
      const sameDayWithout = [];
      const nextDayWith = [];
      const nextDayWithout = [];

      for (const day of days) {
        const hasActivity = day.activities.has(groupKey);

        if (hasActivity) {
          sameDayWith.push(day.mood);

          if (day.nextMood !== null) {
            nextDayWith.push(day.nextMood);
          }
        } else {
          sameDayWithout.push(day.mood);

          if (day.nextMood !== null) {
            nextDayWithout.push(day.nextMood);
          }
        }
      }

      if (
        sameDayWith.length < minimumActivityDays ||
        sameDayWithout.length < minimumComparisonDays
      ) {
        return null;
      }

      const sameDayDelta = roundNumber(average(sameDayWith) - average(sameDayWithout));
      const hasNextDayData =
        nextDayWith.length >= minimumNextDaySampleSize &&
        nextDayWithout.length >= minimumNextDaySampleSize;
      const nextDayDelta = hasNextDayData
        ? roundNumber(average(nextDayWith) - average(nextDayWithout))
        : null;
      const effectStrength = Math.max(
        Math.abs(sameDayDelta ?? 0),
        Math.abs(nextDayDelta ?? 0)
      );

      if (effectStrength < minimumMeaningfulEffect) {
        return null;
      }

      return {
        comparisonCount: sameDayWithout.length,
        confidence: classifyActivityImpactConfidence({
          withCount: sameDayWith.length,
          withoutCount: sameDayWithout.length,
          nextDayWithCount: nextDayWith.length,
          nextDayWithoutCount: nextDayWithout.length,
        }),
        count: sameDayWith.length,
        effectStrength,
        key: groupKey,
        nextDayCount: nextDayWith.length,
        nextDayDelta,
        sameDayDelta,
        sampleTag,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.effectStrength - left.effectStrength ||
        right.sameDayDelta - left.sameDayDelta ||
        (right.nextDayDelta ?? Number.NEGATIVE_INFINITY) -
          (left.nextDayDelta ?? Number.NEGATIVE_INFINITY) ||
        right.count - left.count
    );
};

export const buildSleepImpact = ({ sleepLogsByDate, recordsByDate }) => {
  const pairedEntries = Object.entries(sleepLogsByDate)
    .map(([dateKey, sleepLog]) => {
      const record = recordsByDate[dateKey];
      const hours = Number(sleepLog?.hours_slept);
      const quality = Number(sleepLog?.sleep_quality);
      const mood = getMoodScore(record);
      const energy = getEnergyScore(record);

      if (!Number.isFinite(hours) || !Number.isFinite(quality) || mood === null || energy === null) {
        return null;
      }

      return {
        dateKey,
        energy,
        hours,
        mood,
        quality,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));

  const baselineMood = roundNumber(average(pairedEntries.map((entry) => entry.mood)));
  const baselineEnergy = roundNumber(average(pairedEntries.map((entry) => entry.energy)));
  const hourSeed = sleepHourZones.map((zone) => ({
    ...zone,
    moods: [],
    energies: [],
  }));
  const qualitySeed = sleepQualityLevels.map((level) => ({
    ...level,
    moods: [],
    energies: [],
  }));

  for (const entry of pairedEntries) {
    const bucket = hourSeed.find((candidate) => candidate.test(entry.hours));

    if (!bucket) {
      continue;
    }

    bucket.moods.push(entry.mood);
    bucket.energies.push(entry.energy);

    const qualityBucket = qualitySeed.find((candidate) => candidate.value === entry.quality);

    if (!qualityBucket) {
      continue;
    }

    qualityBucket.moods.push(entry.mood);
    qualityBucket.energies.push(entry.energy);
  }
  const hourItems = buildSleepImpactItems({
    baselineEnergy,
    baselineMood,
    groups: hourSeed,
  });
  const qualityItems = buildSleepImpactItems({
    baselineEnergy,
    baselineMood,
    groups: qualitySeed,
  });

  return {
    baseline: {
      energy: baselineEnergy,
      mood: baselineMood,
    },
    hasPairedEntries: pairedEntries.length > 0,
    hourItems,
    moodImpact: buildSleepImpactRow({
      baseline: baselineMood,
      hourItems,
      metricKey: 'mood',
      pairedCount: pairedEntries.length,
      qualityItems,
    }),
    pairedCount: pairedEntries.length,
    qualityItems,
    energyImpact: buildSleepImpactRow({
      baseline: baselineEnergy,
      hourItems,
      metricKey: 'energy',
      pairedCount: pairedEntries.length,
      qualityItems,
    }),
  };
};
