export type AvailabilityDayName = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type LocalAvailabilityWindow = {
	id?: string;
	localId: string;
	startTime: string;
	endTime: string;
};

export type AvailabilityTemplateDay = {
	dayOfWeek: AvailabilityDayName;
	windows: LocalAvailabilityWindow[];
};

type TimeRangePreview = {
	dayLabel: string;
	rangeLabel: string;
	abbreviation: string;
};

const DAY_NAMES: AvailabilityDayName[] = [
	'MONDAY',
	'TUESDAY',
	'WEDNESDAY',
	'THURSDAY',
	'FRIDAY',
	'SATURDAY',
	'SUNDAY',
];

const DAY_NAME_SET = new Set<AvailabilityDayName>(DAY_NAMES);

const STATE_TIMEZONE_MAP: Record<string, string> = {
	AL: 'America/Chicago',
	AK: 'America/Anchorage',
	AZ: 'America/Phoenix',
	AR: 'America/Chicago',
	CA: 'America/Los_Angeles',
	CO: 'America/Denver',
	CT: 'America/New_York',
	DE: 'America/New_York',
	FL: 'America/New_York',
	GA: 'America/New_York',
	HI: 'Pacific/Honolulu',
	ID: 'America/Denver',
	IL: 'America/Chicago',
	IN: 'America/New_York',
	IA: 'America/Chicago',
	KS: 'America/Chicago',
	KY: 'America/New_York',
	LA: 'America/Chicago',
	ME: 'America/New_York',
	MD: 'America/New_York',
	MA: 'America/New_York',
	MI: 'America/New_York',
	MN: 'America/Chicago',
	MS: 'America/Chicago',
	MO: 'America/Chicago',
	MT: 'America/Denver',
	NE: 'America/Chicago',
	NV: 'America/Los_Angeles',
	NH: 'America/New_York',
	NJ: 'America/New_York',
	NM: 'America/Denver',
	NY: 'America/New_York',
	NC: 'America/New_York',
	ND: 'America/Chicago',
	OH: 'America/New_York',
	OK: 'America/Chicago',
	OR: 'America/Los_Angeles',
	PA: 'America/New_York',
	RI: 'America/New_York',
	SC: 'America/New_York',
	SD: 'America/Chicago',
	TN: 'America/Chicago',
	TX: 'America/Chicago',
	UT: 'America/Denver',
	VT: 'America/New_York',
	VA: 'America/New_York',
	WA: 'America/Los_Angeles',
	WV: 'America/New_York',
	WI: 'America/Chicago',
	WY: 'America/Denver',
};

const REFERENCE_SEARCH_WINDOW_DAYS = 21;
const REFERENCE_SEARCH_START_OFFSET_DAYS = 10;

const pad2 = (value: number) => value.toString().padStart(2, '0');

const buildWindow = (seed: string, startTime = '09:00', endTime = '17:00', id?: string): LocalAvailabilityWindow => ({
	id,
	localId: seed,
	startTime,
	endTime,
});

const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) => (
	parts.find((part) => part.type === type)?.value ?? ''
);

const formatParts = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) => (
	new Intl.DateTimeFormat('en-US', {
		timeZone,
		...options,
	}).formatToParts(date)
);

const getClockLabel = (date: Date, timeZone: string) => {
	const parts = formatParts(date, timeZone, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZoneName: 'short',
	});

	const hour = getPart(parts, 'hour');
	const minute = getPart(parts, 'minute');
	const dayPeriod = getPart(parts, 'dayPeriod');
	const abbreviation = getPart(parts, 'timeZoneName') || '—';

	return {
		time: `${hour}:${minute} ${dayPeriod}`,
		abbreviation,
	};
};

const getWeekdayNameInZone = (date: Date, timeZone: string): AvailabilityDayName | null => {
	const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date).toUpperCase();
	return DAY_NAME_SET.has(weekday as AvailabilityDayName) ? weekday as AvailabilityDayName : null;
};

const getLocalDateParts = (date: Date, timeZone: string) => {
	const parts = formatParts(date, timeZone, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	return {
		year: Number.parseInt(getPart(parts, 'year'), 10),
		month: Number.parseInt(getPart(parts, 'month'), 10),
		day: Number.parseInt(getPart(parts, 'day'), 10),
		hour: Number.parseInt(getPart(parts, 'hour'), 10),
		minute: Number.parseInt(getPart(parts, 'minute'), 10),
	};
};

const parseClock = (time: string) => {
	const [hourText, minuteText] = time.split(':');
	const hour = Number.parseInt(hourText, 10);
	const minute = Number.parseInt(minuteText, 10);
	return { hour, minute };
};

const formatUtcClock = (date: Date) => `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;

const formatDateLabel = (date: Date, timeZone: string) => new Intl.DateTimeFormat('en-US', {
	timeZone,
	weekday: 'short',
	month: 'short',
	day: 'numeric',
}).format(date);

const getReferenceLocalDateForDay = (dayOfWeek: AvailabilityDayName, timeZone: string) => {
	const anchor = new Date();
	anchor.setUTCHours(12, 0, 0, 0);
	anchor.setUTCDate(anchor.getUTCDate() - REFERENCE_SEARCH_START_OFFSET_DAYS);

	for (let offset = 0; offset < REFERENCE_SEARCH_WINDOW_DAYS; offset += 1) {
		const candidate = new Date(anchor.getTime() + offset * 24 * 60 * 60 * 1000);
		const weekday = getWeekdayNameInZone(candidate, timeZone);
		if (weekday !== dayOfWeek) {
			continue;
		}

		const localParts = getLocalDateParts(candidate, timeZone);
		return {
			year: localParts.year,
			month: localParts.month,
			day: localParts.day,
		};
	}

	return null;
};

const findUtcDateForLocalDateTime = (
	localDate: { year: number; month: number; day: number },
	time: string,
	timeZone: string,
) => {
	const { hour, minute } = parseClock(time);
	if (Number.isNaN(hour) || Number.isNaN(minute)) {
		return null;
	}

	const utcGuess = Date.UTC(localDate.year, localDate.month - 1, localDate.day, hour, minute, 0, 0);

	for (let offsetMinutes = -18 * 60; offsetMinutes <= 18 * 60; offsetMinutes += 15) {
		const candidate = new Date(utcGuess + offsetMinutes * 60 * 1000);
		const candidateParts = getLocalDateParts(candidate, timeZone);
		if (
			candidateParts.year === localDate.year
			&& candidateParts.month === localDate.month
			&& candidateParts.day === localDate.day
			&& candidateParts.hour === hour
			&& candidateParts.minute === minute
		) {
			return candidate;
		}
	}

	return null;
};

const buildUtcDateForStoredWindow = (dayOfWeek: AvailabilityDayName, utcTime: string) => {
	const now = new Date();
	const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
	const currentIndex = (base.getUTCDay() + 6) % 7;
	const targetIndex = DAY_NAMES.indexOf(dayOfWeek);
	const monday = new Date(base);
	monday.setUTCDate(monday.getUTCDate() - currentIndex);

	const result = new Date(monday);
	result.setUTCDate(monday.getUTCDate() + targetIndex);

	const { hour, minute } = parseClock(utcTime);
	result.setUTCHours(hour, minute, 0, 0);
	return result;
};

const createEmptySchedule = (): AvailabilityTemplateDay[] => DAY_NAMES.map((dayOfWeek) => ({
	dayOfWeek,
	windows: [],
}));

export const deriveTimezoneFromState = (state?: string | null) => {
	if (!state) return null;
	return STATE_TIMEZONE_MAP[state.trim().toUpperCase()] ?? null;
};

export const getBrowserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const mapUtcAvailabilityTemplateToLocalSchedule = (
	days: Array<{ dayOfWeek: string; windows?: Array<{ id?: string; startTime: string; endTime: string }> }>,
	schedulingTimezone: string,
): AvailabilityTemplateDay[] => {
	const localSchedule = createEmptySchedule();

	for (const day of days) {
		for (const [index, window] of (day.windows ?? []).entries()) {
			const utcDayName = day.dayOfWeek as AvailabilityDayName;
			const startUtcDate = buildUtcDateForStoredWindow(utcDayName, window.startTime);
			const endUtcDate = buildUtcDateForStoredWindow(utcDayName, window.endTime);
			const localDayName = getWeekdayNameInZone(startUtcDate, schedulingTimezone);

			if (!localDayName) {
				continue;
			}

			const localDay = localSchedule.find((entry) => entry.dayOfWeek === localDayName);
			if (!localDay) {
				continue;
			}

			const startLocal = getLocalDateParts(startUtcDate, schedulingTimezone);
			const endLocal = getLocalDateParts(endUtcDate, schedulingTimezone);

			localDay.windows.push(buildWindow(
				`${localDayName}-${index}-${window.id ?? 'slot'}`,
				`${pad2(startLocal.hour)}:${pad2(startLocal.minute)}`,
				`${pad2(endLocal.hour)}:${pad2(endLocal.minute)}`,
				window.id,
			));
		}
	}

	for (const day of localSchedule) {
		day.windows.sort((left, right) => left.startTime.localeCompare(right.startTime));
	}

	return localSchedule;
};

export const buildUtcAvailabilityPayloadFromLocalSchedule = (
	schedule: AvailabilityTemplateDay[],
	schedulingTimezone: string,
) => {
	const utcSchedule = createEmptySchedule();

	for (const day of schedule) {
		const localDate = getReferenceLocalDateForDay(day.dayOfWeek, schedulingTimezone);
		if (!localDate) {
			continue;
		}

		for (const window of day.windows) {
			const startUtcDate = findUtcDateForLocalDateTime(localDate, window.startTime, schedulingTimezone);
			const endUtcDate = findUtcDateForLocalDateTime(localDate, window.endTime, schedulingTimezone);
			if (!startUtcDate || !endUtcDate) {
				continue;
			}

			const utcDayName = DAY_NAMES[(startUtcDate.getUTCDay() + 6) % 7];
			const utcDay = utcSchedule.find((entry) => entry.dayOfWeek === utcDayName);
			if (!utcDay) {
				continue;
			}

			utcDay.windows.push({
				startTime: formatUtcClock(startUtcDate),
				endTime: formatUtcClock(endUtcDate),
			} as LocalAvailabilityWindow);
		}
	}

	for (const day of utcSchedule) {
		day.windows.sort((left, right) => left.startTime.localeCompare(right.startTime));
	}

	return {
		days: utcSchedule.map((day) => ({
			dayOfWeek: day.dayOfWeek,
			windows: day.windows.map((window) => ({
				startTime: window.startTime,
				endTime: window.endTime,
			})),
		})),
	};
};

export const buildAvailabilityPreview = (
	dayOfWeek: AvailabilityDayName,
	window: Pick<LocalAvailabilityWindow, 'startTime' | 'endTime'>,
	schedulingTimezone: string,
	previewTimezone: string,
): TimeRangePreview | null => {
	const localDate = getReferenceLocalDateForDay(dayOfWeek, schedulingTimezone);
	if (!localDate) {
		return null;
	}

	const startUtcDate = findUtcDateForLocalDateTime(localDate, window.startTime, schedulingTimezone);
	const endUtcDate = findUtcDateForLocalDateTime(localDate, window.endTime, schedulingTimezone);
	if (!startUtcDate || !endUtcDate) {
		return null;
	}

	const startLabel = getClockLabel(startUtcDate, previewTimezone);
	const endLabel = getClockLabel(endUtcDate, previewTimezone);

	return {
		dayLabel: formatDateLabel(startUtcDate, previewTimezone),
		rangeLabel: `${startLabel.time} – ${endLabel.time}`,
		abbreviation: startLabel.abbreviation || endLabel.abbreviation,
	};
};
