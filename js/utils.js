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

/** Count working days (Mon-Fri) between two dates, inclusive of start, exclusive of end */
function countWorkingDays(start, end) {
  if (!start || !end) return 0;
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(0, 0, 0, 0);
  while (d.getTime() < endTime) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(count, 1); // at least 1 if same-day
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
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const base = {
    id: 0, taskNumber: 0, outline: '1', depth: 1,
    name: DEFAULT_TASK_NAME,
    start: now,
    finish: new Date(now.getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY),
    duration: DEFAULT_TASK_DURATION_DAYS + ' days',
    labels: [], bucket: '', priority: '',
    dependsOn: '', percentComplete: 0, dependents: '', effort: '',
    isMilestone: false, children: [], parent: null, color: DEFAULT_COLOR,
    notes: '', colorOverride: '', manualProgress: false,
    assigned: '', status: '', cost: '', sprint: '', category: ''
  };
  return Object.assign(base, overrides);
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
