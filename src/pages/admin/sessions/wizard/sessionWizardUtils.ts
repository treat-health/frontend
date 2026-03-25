export interface StateOption {
  value: string;
  label: string;
}

export const MIN_SESSION_DURATION_MINS = 15;
export const MAX_SESSION_DURATION_MINS = 180;
export const DEFAULT_SESSION_DURATION_MINS = 30;

export const US_STATE_OPTIONS: StateOption[] = [
  { value: 'AL', label: 'AL' },
  { value: 'AK', label: 'AK' },
  { value: 'AZ', label: 'AZ' },
  { value: 'AR', label: 'AR' },
  { value: 'CA', label: 'CA' },
  { value: 'CO', label: 'CO' },
  { value: 'CT', label: 'CT' },
  { value: 'DE', label: 'DE' },
  { value: 'FL', label: 'FL' },
  { value: 'GA', label: 'GA' },
  { value: 'HI', label: 'HI' },
  { value: 'ID', label: 'ID' },
  { value: 'IL', label: 'IL' },
  { value: 'IN', label: 'IN' },
  { value: 'IA', label: 'IA' },
  { value: 'KS', label: 'KS' },
  { value: 'KY', label: 'KY' },
  { value: 'LA', label: 'LA' },
  { value: 'ME', label: 'ME' },
  { value: 'MD', label: 'MD' },
  { value: 'MA', label: 'MA' },
  { value: 'MI', label: 'MI' },
  { value: 'MN', label: 'MN' },
  { value: 'MS', label: 'MS' },
  { value: 'MO', label: 'MO' },
  { value: 'MT', label: 'MT' },
  { value: 'NE', label: 'NE' },
  { value: 'NV', label: 'NV' },
  { value: 'NH', label: 'NH' },
  { value: 'NJ', label: 'NJ' },
  { value: 'NM', label: 'NM' },
  { value: 'NY', label: 'NY' },
  { value: 'NC', label: 'NC' },
  { value: 'ND', label: 'ND' },
  { value: 'OH', label: 'OH' },
  { value: 'OK', label: 'OK' },
  { value: 'OR', label: 'OR' },
  { value: 'PA', label: 'PA' },
  { value: 'RI', label: 'RI' },
  { value: 'SC', label: 'SC' },
  { value: 'SD', label: 'SD' },
  { value: 'TN', label: 'TN' },
  { value: 'TX', label: 'TX' },
  { value: 'UT', label: 'UT' },
  { value: 'VT', label: 'VT' },
  { value: 'VA', label: 'VA' },
  { value: 'WA', label: 'WA' },
  { value: 'WV', label: 'WV' },
  { value: 'WI', label: 'WI' },
  { value: 'WY', label: 'WY' },
];

export const STATE_TIMEZONE_FALLBACKS: Record<string, string> = {
  CA: 'America/Los_Angeles',
  TX: 'America/Chicago',
  NY: 'America/New_York',
  WA: 'America/Los_Angeles',
  TN: 'America/Chicago',
};

export const getFallbackTimezoneForState = (state?: string | null): string | null => {
  if (!state) return null;
  return STATE_TIMEZONE_FALLBACKS[state] || null;
};

export const resolveParticipantTimezone = (
  selectedState?: string | null,
  backendTimezone?: string | null,
): string => {
  return backendTimezone || getFallbackTimezoneForState(selectedState) || 'UTC';
};

export const getAdminLocalTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
};

export const buildUtcDateTime = (date?: string, time?: string): Date | null => {
  if (!date || !time) return null;

  const utcDateTime = new Date(`${date}T${time}:00Z`);
  return Number.isNaN(utcDateTime.getTime()) ? null : utcDateTime;
};

const parseUtcClockToMinutes = (time?: string | null): number | null => {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const getDefaultUtcStartTime = () => {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setUTCSeconds(0, 0);

  const minutes = rounded.getUTCMinutes();
  const remainder = minutes % DEFAULT_SESSION_DURATION_MINS;
  const toAdd = remainder === 0 ? DEFAULT_SESSION_DURATION_MINS : DEFAULT_SESSION_DURATION_MINS - remainder;
  rounded.setUTCMinutes(minutes + toAdd);

  return `${String(rounded.getUTCHours()).padStart(2, '0')}:${String(rounded.getUTCMinutes()).padStart(2, '0')}`;
};

export const addMinutesToUtcTime = (time: string, minutesToAdd: number) => {
  const totalMinutes = parseUtcClockToMinutes(time);
  if (totalMinutes === null) return time;

  const normalized = ((totalMinutes + minutesToAdd) % 1440 + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const calculateDurationBetweenUtcTimes = (startTime?: string | null, endTime?: string | null) => {
  const startMinutes = parseUtcClockToMinutes(startTime);
  const endMinutes = parseUtcClockToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return {
      durationMins: null,
      crossesMidnight: false,
      isValid: false,
    };
  }

  if (startMinutes === endMinutes) {
    return {
      durationMins: 0,
      crossesMidnight: false,
      isValid: false,
    };
  }

  const crossesMidnight = endMinutes < startMinutes;
  const durationMins = crossesMidnight
    ? (1440 - startMinutes) + endMinutes
    : endMinutes - startMinutes;

  return {
    durationMins,
    crossesMidnight,
    isValid: durationMins >= MIN_SESSION_DURATION_MINS && durationMins <= MAX_SESSION_DURATION_MINS,
  };
};

export const buildUtcDateTimeRange = (date?: string, startTime?: string, endTime?: string) => {
  const startDateTime = buildUtcDateTime(date, startTime);
  const endDateTime = buildUtcDateTime(date, endTime);
  const durationInfo = calculateDurationBetweenUtcTimes(startTime, endTime);

  if (!startDateTime || !endDateTime || durationInfo.durationMins === null) {
    return {
      startDateTime: null,
      endDateTime: null,
      durationMins: null,
      crossesMidnight: false,
      isValid: false,
    };
  }

  if (durationInfo.crossesMidnight) {
    endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
  }

  return {
    startDateTime,
    endDateTime,
    durationMins: durationInfo.durationMins,
    crossesMidnight: durationInfo.crossesMidnight,
    isValid: durationInfo.isValid,
  };
};

export const formatIsoDateToUs = (isoDate?: string | null): string => {
  if (!isoDate) return '';

  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '';

  return `${month}/${day}/${year}`;
};

export const parseUsDateToIso = (usDate: string): string | null => {
  const trimmed = usDate.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);

  if (!match) return null;

  const [, monthText, dayText, yearText] = match;
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const year = Number.parseInt(yearText, 10);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
};

export const normalizeUsDateInput = (value: string): string => {
  const digits = value.replaceAll(/\D/g, '').slice(0, 8);
  const parts: string[] = [];

  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));

  return parts.join('/');
};

const getFormatterParts = (dateTime: Date, timeZone: string, includeTimezoneName = false) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(includeTimezoneName ? { timeZoneName: 'short' } : {}),
  }).formatToParts(dateTime);
};

export const formatDateTimeInZone = (dateTime: Date | null, timeZone: string) => {
  if (!dateTime) {
    return {
      dateTime: '—',
      abbreviation: '—',
    };
  }

  const dateParts = getFormatterParts(dateTime, timeZone);
  const timeZoneParts = getFormatterParts(dateTime, timeZone, true);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || '—';

  return {
    dateTime: `${getPart(dateParts, 'month')}/${getPart(dateParts, 'day')}/${getPart(dateParts, 'year')} ${getPart(dateParts, 'hour')}:${getPart(dateParts, 'minute')}`,
    abbreviation: getPart(timeZoneParts, 'timeZoneName'),
  };
};

export const formatLiveTimeInZone = (dateTime: Date, timeZone: string) => {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateTime);

  const timeParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(dateTime);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || '—';

  return {
    date: `${getPart(dateParts, 'month')}/${getPart(dateParts, 'day')}/${getPart(dateParts, 'year')}`,
    time: `${getPart(timeParts, 'hour')}:${getPart(timeParts, 'minute')}:${getPart(timeParts, 'second')} ${getPart(timeParts, 'dayPeriod')}`,
    abbreviation: getPart(timeParts, 'timeZoneName'),
  };
};

export const formatTimeRangeInZone = (startDateTime: Date | null, endDateTime: Date | null, timeZone: string) => {
  if (!startDateTime || !endDateTime) {
    return {
      date: '—',
      range: '—',
      abbreviation: '—',
      endsNextDay: false,
    };
  }

  const startParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).formatToParts(startDateTime);

  const endParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(endDateTime);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value || '—';

  const startDate = `${getPart(startParts, 'month')}/${getPart(startParts, 'day')}/${getPart(startParts, 'year')}`;
  const endDate = `${getPart(endParts, 'month')}/${getPart(endParts, 'day')}/${getPart(endParts, 'year')}`;
  const endsNextDay = startDate !== endDate;

  return {
    date: startDate,
    range: `${getPart(startParts, 'hour')}:${getPart(startParts, 'minute')} ${getPart(startParts, 'dayPeriod')} – ${getPart(endParts, 'hour')}:${getPart(endParts, 'minute')} ${getPart(endParts, 'dayPeriod')}`,
    abbreviation: getPart(startParts, 'timeZoneName'),
    endsNextDay,
  };
};
