export const padNumber = (value) => String(value).padStart(2, '0');

export const LOGICAL_DAY_START_HOUR = 4;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateInput = (value) => {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' && DATE_KEY_PATTERN.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  return new Date(value);
};

const isDateKeyInput = (value) => typeof value === 'string' && DATE_KEY_PATTERN.test(value.trim());

export const getDateKey = (value) => {
  const date = parseDateInput(value);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
};

export const getDateFromKey = (value) => {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const getLogicalDate = (value = new Date()) => {
  const date = parseDateInput(value);

  if (Number.isNaN(date.getTime()) || isDateKeyInput(value)) {
    return date;
  }

  date.setHours(date.getHours() - LOGICAL_DAY_START_HOUR);
  return date;
};

export const getLogicalDateKey = (value = new Date()) => getDateKey(getLogicalDate(value));

export const getLogicalTomorrowDateKey = (value = new Date()) => {
  const date = getLogicalDate(value);
  date.setDate(date.getDate() + 1);
  return getDateKey(date);
};

export const getLogicalMonthKeyFromDate = (value) => getMonthKeyFromDate(getLogicalDate(value));

export const getLogicalYearKeyFromDate = (value) => getYearKeyFromDate(getLogicalDate(value));

export const formatMonthYearLabel = (year, monthIndex, locale) => {
  const date = new Date(year, monthIndex, 1);
  const month = date.toLocaleDateString(locale, { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
};

export const getLocalizedWeekdays = (locale) => {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(2021, 10, index + 1)).slice(0, 2).toUpperCase()
  );
};

export const formatRecordDate = (value, locale, { includeTime = false } = {}) => {
  if (!value) return '';

  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

export const formatFullDateLabel = (value, locale) => {
  if (!value) return '';

  const parts = String(value).split('-');
  const date =
    parts.length === 3 && parts[0].length === 4
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      : new Date(value);

  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const getShiftedMonthCursor = (year, monthIndex, direction) => {
  const date = new Date(year, monthIndex + direction, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export const isFutureMonth = (year, monthIndex, referenceDate = new Date()) => {
  const date = parseDateInput(referenceDate);

  return (
    year > date.getFullYear() ||
    (year === date.getFullYear() && monthIndex > date.getMonth())
  );
};

export const getMonthKeyFromDate = (value) => {
  const date = parseDateInput(value);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
};

export const getYearKeyFromDate = (value) => String(parseDateInput(value).getFullYear());
