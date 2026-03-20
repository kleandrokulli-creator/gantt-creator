/* ===================================================================
   UTILS.JS — Pure utility functions (no side effects, no DOM)
   =================================================================== */

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function fmtDate(d) {
  if (!d) return '—';
  return String(d.getDate()).padStart(2, '0') + '/' +
         String(d.getMonth() + 1).padStart(2, '0') + '/' +
         d.getFullYear();
}

function dateToInputStr(d) {
  if (!d) return '';
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function getWeekNumber(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
}

function excelDateToJS(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number') return new Date((v - 25569) * 86400000);
  if (typeof v === 'string') {
    const p = Date.parse(v);
    if (!isNaN(p)) return new Date(p);
  }
  return null;
}

function generateId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function dateToPxR(date, dpx) {
  if (!date) return 0;
  return Math.round(((date - minDate) / 86400000) * dpx[currentZoom]);
}

/** Compute responsive dayPx values based on viewport width */
function getResponsiveDayPx() {
  const rightPanel = document.querySelector('.right-panel');
  if (!rightPanel || !minDate || !maxDate) return { month: 3, week: 12, day: 30 };
  const availableWidth = rightPanel.clientWidth - 2;
  const days = Math.max(Math.ceil((maxDate - minDate) / 86400000), 1);
  const fitPx = availableWidth / days;
  const minPx = { month: 1, week: 6, day: 14 };
  return {
    month: Math.max(fitPx, minPx.month),
    week: Math.max(fitPx, minPx.week),         // fit to viewport
    day: Math.max(fitPx, minPx.day)             // fit to viewport
  };
}

/** Get CSS background for a bar — solid or striped if multiple label colors */
function getBarBackground(barColors) {
  if (!barColors || barColors.length <= 1) {
    return barColors?.[0] || DEFAULT_COLOR;
  }
  const stripeW = 10;
  const stops = [];
  const total = barColors.length * stripeW;
  barColors.forEach((c, i) => {
    const start = (i * stripeW / total * 100).toFixed(1);
    const end = ((i + 1) * stripeW / total * 100).toFixed(1);
    stops.push(`${c} ${start}%`);
    stops.push(`${c} ${end}%`);
  });
  return `repeating-linear-gradient(135deg, ${stops.join(', ')})`;
}

/** Check if a date falls on a weekend (Sat or Sun) */
function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function getMilestoneColor(task) {
  if (task.priority && PRIORITY_COLORS[task.priority]) return PRIORITY_COLORS[task.priority];
  return task.color || '#F59E0B';
}

function starSVG(size, color) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="var(--body-fg)" stroke-width="1.2" stroke-linejoin="round" stroke-opacity="0.4"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>`;
}

/**
 * Create a new task object with sensible defaults. Pass overrides for specific fields.
 */
function createTaskObject(overrides) {
  let now = new Date(); now.setHours(0, 0, 0, 0);
  // In working days mode, snap start to next working day
  if (workingDaysMode) {
    const calId = (overrides && overrides.calendarId) || getDefaultCalendarId();
    now = nextWorkingDay(now, calId);
  }
  const startDate = now;
  const finishDate = workingDaysMode
    ? addWorkingDays(startDate, DEFAULT_TASK_DURATION_DAYS, (overrides && overrides.calendarId) || getDefaultCalendarId())
    : new Date(startDate.getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY);
  const base = {
    id: 0, taskNumber: 0, outline: '1', depth: 1,
    name: DEFAULT_TASK_NAME,
    start: startDate,
    finish: finishDate,
    duration: DEFAULT_TASK_DURATION_DAYS + ' days',
    labels: [], bucket: '', priority: '',
    dependsOn: '', percentComplete: 0, dependents: '', effort: '',
    isMilestone: false, children: [], parent: null, color: DEFAULT_COLOR,
    notes: '', colorOverride: '', manualProgress: false,
    assigned: '', status: '', cost: '', sprint: '', category: '',
    calendarId: ''
  };
  return Object.assign(base, overrides);
}


/* ---------- CALENDAR SYSTEM ---------- */

const CALENDAR_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function getDefaultCalendarId() {
  for (const id of Object.keys(calendars)) {
    if (calendars[id].isDefault) return id;
  }
  return Object.keys(calendars)[0] || '';
}

/**
 * Returns the calendar IDs relevant to the current view scope.
 * - Root level: all calendars
 * - Drilled into a Level 1+ task: only that task's calendar
 */
function getScopedCalendarIds() {
  if (navStack.length > 0) {
    const scopeTask = navStack[0].task;
    const calId = scopeTask.calendarId || getDefaultCalendarId();
    return calId ? [calId] : Object.keys(calendars);
  }
  return Object.keys(calendars);
}

/**
 * Build a combined holiday Set for the current scoped calendars.
 */
function buildScopedHolidayLookup() {
  const ids = getScopedCalendarIds();
  if (ids.length === 1) return buildHolidayLookup(ids[0]);
  // Multiple calendars: union
  const combined = new Set();
  for (const calId of ids) {
    const lookup = buildHolidayLookup(calId);
    for (const d of lookup) combined.add(d);
  }
  return combined;
}

/**
 * Get holiday info filtered to the current scope's calendars.
 */
function getScopedHolidayInfo(dateStr) {
  const scopedIds = new Set(getScopedCalendarIds());
  return getHolidayInfo(dateStr).filter(info => scopedIds.has(info.calendarId));
}

/**
 * Build bridged weekend lookup for scoped calendars only.
 */
function buildScopedBridgedWeekends() {
  const ids = getScopedCalendarIds();
  const combined = new Set();
  for (const calId of ids) {
    const b = buildBridgedWeekendLookup(calId);
    for (const d of b) combined.add(d);
  }
  return combined;
}

function ensureDefaultCalendar() {
  if (Object.keys(calendars).length === 0) {
    const id = 'cal_' + Date.now();
    calendars[id] = { name: 'Default', isDefault: true, entries: [], color: CALENDAR_COLORS[0] };
  }
  // Ensure all calendars have a color
  let colorIdx = 0;
  for (const id of Object.keys(calendars)) {
    if (!calendars[id].color) {
      calendars[id].color = CALENDAR_COLORS[colorIdx % CALENDAR_COLORS.length];
      colorIdx++;
    }
  }
  // Ensure exactly one default
  const defaults = Object.keys(calendars).filter(id => calendars[id].isDefault);
  if (defaults.length === 0) calendars[Object.keys(calendars)[0]].isDefault = true;
}

// Holiday lookup cache
const _holidayCache = {};

function invalidateHolidayCache() {
  Object.keys(_holidayCache).forEach(k => delete _holidayCache[k]);
}

function buildHolidayLookup(calendarId) {
  if (_holidayCache[calendarId]) return _holidayCache[calendarId];
  const cal = calendars[calendarId];
  const set = new Set();
  if (!cal) { _holidayCache[calendarId] = set; return set; }
  for (const entry of cal.entries) {
    if (entry.type === 'holiday') {
      set.add(entry.date);
    } else if (entry.type === 'closure') {
      const start = new Date(entry.startDate + 'T00:00:00');
      const end = new Date(entry.endDate + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
      }
    }
  }
  _holidayCache[calendarId] = set;
  return set;
}

function buildCombinedHolidayLookup() {
  if (_holidayCache['__combined__']) return _holidayCache['__combined__'];
  const combined = new Set();
  for (const calId of Object.keys(calendars)) {
    const lookup = buildHolidayLookup(calId);
    for (const d of lookup) combined.add(d);
  }
  _holidayCache['__combined__'] = combined;
  return combined;
}

/** Returns array of {calendarId, calendarName, color, label} for a given date string */
function getHolidayInfo(dateStr) {
  const results = [];
  for (const calId of Object.keys(calendars)) {
    const cal = calendars[calId];
    const lookup = buildHolidayLookup(calId);
    if (!lookup.has(dateStr)) continue;
    // Find label
    let label = '';
    for (const entry of cal.entries) {
      if (entry.type === 'holiday' && entry.date === dateStr) { label = entry.label; break; }
      if (entry.type === 'closure') {
        const s = entry.startDate, e = entry.endDate;
        if (dateStr >= s && dateStr <= e) { label = entry.label; break; }
      }
    }
    results.push({ calendarId: calId, calendarName: cal.name, color: cal.color || '#EF4444', label });
  }
  return results;
}

function isNonWorkingDay(date, calendarId) {
  if (isWeekend(date)) return true;
  if (!workingDaysMode) return false;
  const calId = calendarId || getDefaultCalendarId();
  if (!calId) return false;
  const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  return buildHolidayLookup(calId).has(dateStr);
}

/** Count working days between start and end (inclusive of start, exclusive of end) */
function countWorkingDays(start, end, calendarId) {
  if (!start || !end) return 0;
  const calId = calendarId || getDefaultCalendarId();
  const holidays = calId ? buildHolidayLookup(calId) : new Set();
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(0, 0, 0, 0);
  while (d.getTime() < endTime) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!holidays.has(ds)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Advance N working days forward from startDate */
function addWorkingDays(startDate, numDays, calendarId) {
  const calId = calendarId || getDefaultCalendarId();
  const holidays = calId ? buildHolidayLookup(calId) : new Set();
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  let remaining = numDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!holidays.has(ds)) remaining--;
    }
  }
  return d;
}

/** Subtract N working days backward from startDate */
function subtractWorkingDays(startDate, numDays, calendarId) {
  const calId = calendarId || getDefaultCalendarId();
  const holidays = calId ? buildHolidayLookup(calId) : new Set();
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  let remaining = numDays;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!holidays.has(ds)) remaining--;
    }
  }
  return d;
}

/**
 * Snap a date to the next working day if it falls on a weekend or holiday.
 * Returns the same date if already a working day.
 */
function nextWorkingDay(date, calendarId) {
  const calId = calendarId || getDefaultCalendarId();
  const holidays = calId ? buildHolidayLookup(calId) : new Set();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Safety limit to avoid infinite loop
  for (let i = 0; i < 365; i++) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!holidays.has(ds)) return d;
    }
    d.setDate(d.getDate() + 1);
  }
  return d; // fallback
}

/**
 * Snap a date to the previous working day if it falls on a weekend or holiday.
 * Returns the same date if already a working day.
 */
function prevWorkingDay(date, calendarId) {
  const calId = calendarId || getDefaultCalendarId();
  const holidays = calId ? buildHolidayLookup(calId) : new Set();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      if (!holidays.has(ds)) return d;
    }
    d.setDate(d.getDate() - 1);
  }
  return d; // fallback
}

function assignCalendarWithChildren(task, calId) {
  task.calendarId = calId;
  const prefix = task.outline + '.';
  const idx = allTasks.indexOf(task);
  for (let i = idx + 1; i < allTasks.length; i++) {
    if (allTasks[i].outline.startsWith(prefix)) {
      allTasks[i].calendarId = calId;
    } else { break; }
  }
}

/**
 * Find all non-working day gaps (holidays + closures) that overlap a task's date range.
 * Returns array of { start: Date, end: Date } (end exclusive) for each holiday/closure period.
 * Weekends between holidays are absorbed into the gap so it reads as one continuous block.
 * Used for bar splitting at all zoom levels.
 */
function findHolidayGaps(taskStart, taskFinish, holidaySetOrCalendarId) {
  if (!taskStart || !taskFinish || !workingDaysMode) return [];
  let holidays;
  if (holidaySetOrCalendarId instanceof Set) {
    holidays = holidaySetOrCalendarId;
  } else {
    const calId = holidaySetOrCalendarId || getDefaultCalendarId();
    if (!calId) return [];
    holidays = buildHolidayLookup(calId);
  }
  if (holidays.size === 0) return [];

  // Walk through each day in the task range; treat holidays AND weekends sandwiched
  // between holidays as one continuous non-working block.
  const gaps = [];
  const d = new Date(taskStart);
  d.setHours(0, 0, 0, 0);
  const endTime = new Date(taskFinish).setHours(0, 0, 0, 0);
  let gapStart = null;
  let lastHolidayEnd = null; // tracks the day after the last confirmed holiday in current gap

  while (d.getTime() <= endTime) {
    const day = d.getDay();
    const isWknd = day === 0 || day === 6;
    const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const isHoliday = holidays.has(ds);

    if (isHoliday && !isWknd) {
      // Holiday on a weekday: start or extend gap
      if (!gapStart) gapStart = new Date(d);
      lastHolidayEnd = new Date(d.getTime() + MS_PER_DAY);
    } else if (isWknd && gapStart) {
      // Weekend while in a gap: absorb it (don't close the gap yet).
      // It will be trimmed back to lastHolidayEnd if no holiday follows.
    } else {
      // Normal working day: close any open gap
      if (gapStart) {
        gaps.push({ start: gapStart, end: lastHolidayEnd });
        gapStart = null;
        lastHolidayEnd = null;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  // Close trailing gap
  if (gapStart && lastHolidayEnd) {
    gaps.push({ start: gapStart, end: lastHolidayEnd });
  }
  return gaps;
}

/**
 * Build a Set of "YYYY-MM-DD" strings for weekends that should be shaded as holidays
 * because they are sandwiched between holidays (Fri is holiday AND Mon is holiday).
 */
function buildBridgedWeekendLookup(calendarId) {
  const holidays = buildHolidayLookup(calendarId);
  const bridged = new Set();
  for (const ds of holidays) {
    const d = new Date(ds + 'T00:00:00');
    const dow = d.getDay();
    if (dow === 5) {
      // Friday holiday: check if Monday after is also a holiday
      const sat = new Date(d.getTime() + MS_PER_DAY);
      const sun = new Date(d.getTime() + 2 * MS_PER_DAY);
      const mon = new Date(d.getTime() + 3 * MS_PER_DAY);
      const monStr = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0');
      if (holidays.has(monStr)) {
        const satStr = sat.getFullYear() + '-' + String(sat.getMonth() + 1).padStart(2, '0') + '-' + String(sat.getDate()).padStart(2, '0');
        const sunStr = sun.getFullYear() + '-' + String(sun.getMonth() + 1).padStart(2, '0') + '-' + String(sun.getDate()).padStart(2, '0');
        bridged.add(satStr);
        bridged.add(sunStr);
      }
    }
  }
  return bridged;
}

/**
 * Build combined bridged weekend lookup across all calendars.
 */
function buildCombinedBridgedWeekends() {
  if (_holidayCache['__bridged__']) return _holidayCache['__bridged__'];
  const combined = new Set();
  for (const calId of Object.keys(calendars)) {
    const b = buildBridgedWeekendLookup(calId);
    for (const d of b) combined.add(d);
  }
  _holidayCache['__bridged__'] = combined;
  return combined;
}

/**
 * Validate a task object and return an array of error strings (empty if valid).
 */
function validateTask(task) {
  const errors = [];
  if (!task.name || !task.name.trim()) errors.push('Task name cannot be empty');
  if (task.start && task.finish && task.start > task.finish) errors.push('Start date must be before or equal to finish date');
  if (task.percentComplete !== undefined) {
    const pct = typeof task.percentComplete === 'number' ? task.percentComplete : parseFloat(task.percentComplete);
    if (isNaN(pct) || pct < 0 || pct > 1) errors.push('Completion must be between 0% and 100%');
  }
  if (task.dependsOn && typeof detectCircularDependency === 'function') {
    if (detectCircularDependency(task.id, task.dependsOn)) errors.push('Circular dependency detected');
  }
  return errors;
}
