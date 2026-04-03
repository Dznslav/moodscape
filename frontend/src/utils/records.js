import { getLogicalDate, getLogicalDateKey, padNumber } from './date';

export const sortRecordsByNewest = (records = []) =>
  [...records].sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

export const filterRecordsByMonth = (records = [], year, monthIndex) =>
  records.filter((record) => {
    const date = getLogicalDate(record.timestamp);
    return date.getFullYear() === year && date.getMonth() === monthIndex;
  });

export const buildRecordsByDate = (records = []) => {
  const map = {};

  for (const record of records) {
    const key = getLogicalDateKey(record.timestamp);

    if (!map[key] || new Date(record.timestamp) > new Date(map[key].timestamp)) {
      map[key] = record;
    }
  }

  return map;
};

export const buildCalendarCells = (
  recordsByDate,
  year,
  monthIndex,
  todayKey = getLogicalDateKey(new Date())
) => {
  const cells = [];
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  let startDay = firstDay.getDay() - 1;

  if (startDay < 0) {
    startDay = 6;
  }

  for (let index = 0; index < startDay; index += 1) {
    cells.push({ day: null });
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const dateKey = `${year}-${padNumber(monthIndex + 1)}-${padNumber(day)}`;

    cells.push({
      day,
      dateKey,
      isToday: dateKey === todayKey,
      isFuture: dateKey > todayKey,
      record: recordsByDate[dateKey] ?? null,
    });
  }

  return cells;
};
