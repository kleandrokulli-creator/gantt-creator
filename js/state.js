/* ===================================================================
   STATE.JS — Global state variables and configuration constants.
   All mutable state lives here for easy auditing.
   File count: ~77 variables across 8 categories.
   =================================================================== */


/* =====================================================================
   1. CONSTANTS — immutable values used throughout the app
   ===================================================================== */

/** Milliseconds in a day (used for date arithmetic) */
const MS_PER_DAY = 86400000;
const DEFAULT_TASK_DURATION_DAYS = 7;

// Default strings
const DEFAULT_TASK_NAME = 'New task';
const DEFAULT_SUB_TASK_NAME = 'New sub-task';
const DEFAULT_PROJECT_NAME = 'New Project';

// Storage keys
const STORAGE_KEY_PROJECTS = 'lvz-gantt-projects';
const STORAGE_KEY_CURRENT = 'lvz-gantt-current';
const STORAGE_KEY_THEME = 'lvz-gantt-theme';
const STORAGE_KEY_DEFAULTS = 'lvz-gantt-defaults';
const STORAGE_KEY_TEMPLATES = 'lvz-gantt-templates';

// Timing (debounce/throttle)
const DEBOUNCE_SAVE_MS = 500;
const DEBOUNCE_INPUT_MS = 300;
const DEBOUNCE_RESIZE_MS = 150;
const DEBOUNCE_ZOOM_MS = 50;

// UI dimensions
const MIN_COLUMN_WIDTH = 40;
const ROW_HEIGHT = 28;
const DEFAULT_COLUMN_WIDTHS = {
  select:36, taskNum:36, outline:60, name:200, start:115, finish:115,
  duration:80, milestone:36, labels:120, bucket:100, priority:90,
  pct:120, deps:100, effort:70, notes:140, assigned:100, status:90,
  cost:70, sprint:70, category:90, calendar:110
};

// Per-column minimum widths — columns can never shrink below these
const MIN_COL_WIDTHS = {
  select:36, taskNum:32, outline:44, name:100, start:115, finish:115,
  duration:58, milestone:36, labels:50, bucket:60, priority:60,
  pct:90, deps:70, effort:50, notes:50, assigned:60, status:60,
  cost:50, sprint:50, category:60, calendar:60
};

// Status options for task status dropdowns
const STATUS_OPTIONS = ['', 'Not Started', 'In Progress', 'On Hold', 'Done', 'Blocked'];

// Excel import structure
const EXCEL_HEADER_ROW = 8;
const EXCEL_DATA_START = 9;

// Dependency types
const DEP_TYPES = { FS:'FS', SS:'SS', FF:'FF', SF:'SF' };

/* =====================================================================
   2. PROJECT & TASK DATA — core data model
   ===================================================================== */

/** @type {Object} Project metadata from Excel (projectName, creator, dates, etc.) */
let projectMeta = {};
let allTasks = [];
let taskTree = [];
const viewStates = {
  roadmap: { expandedSet: new Set(), collapsedSet: new Set(), allExpanded: false, visibleDepth: 1, filters: { search: '', label: '', bucket: '', team: '' } },
  dati: { expandedSet: new Set(), collapsedSet: new Set(), allExpanded: false, visibleDepth: 0, filters: { search: '', label: '', bucket: '', team: '' } },
  org: { filters: { search: '', label: '', bucket: '', team: '' } }
};
function getState() { return viewStates[currentTab] || viewStates.roadmap; }

/* =====================================================================
   3. VIEW STATE — display, zoom, filters, navigation
   ===================================================================== */

/** @type {Set<number>} Task IDs hidden (muted) by the user */
let hiddenTasks = new Set();
/** @type {Array<number>} Breadcrumb navigation stack (task IDs) */
let navStack = [];
/** @type {boolean} Show milestones inline on task bars vs separate rows */
let milestoneInline = true;
/** @type {boolean} Show dependency arrows between tasks */
let showArrows = true;
/** @type {'month'|'week'|'day'} Current zoom level */
let currentZoom = 'month';
/** @type {boolean} true = count only Mon-Fri, skip weekends & holidays */
let workingDaysMode = false;
/** @type {boolean} true = bars split around holidays, false = continuous bars */
let splitBarsMode = true;
/** @type {Date} Earliest date in timeline (computed) */
let minDate;
/** @type {Date} Latest date in timeline (computed) */
let maxDate;
let totalDays, canvasWidth;
/** @type {Array} Filtered task tree (after search/label/bucket filters) */
let filteredTree = [];
/** @type {Set<number>} Currently selected row IDs (for bulk operations) */
let selectedRows = new Set();
/** @type {Object} Holiday calendars { calId: { name, isDefault, entries[], color } } */
let calendars = {};
/** @type {Object} Teams { teamId: { name, color, members[] } } */
let teams = {};
/** @type {Object} Derived team color lookup { teamName: '#hex' } */
const TEAM_COLORS = {};
/** @type {'roadmap'|'dati'|'dashboard'|'org'} Active tab */
let currentTab = 'roadmap';

/* =====================================================================
   4. UNDO & PERSISTENCE
   ===================================================================== */

let undoStack = [];
const MAX_UNDO = 20;
let saveDebounce = null;
let pendingInlineSave = null;
let autoSaveDebounce = null;

/* =====================================================================
   5. UI STATE — panels, modals, edit mode
   ===================================================================== */

/** @type {number|null} Task ID currently open in the edit panel */
let editPanelTaskId = null;
/** @type {boolean} Data table inline-edit mode active */
let isDataEditMode = false;
/** @type {string} Active tab in settings modal */
let currentSettingsTab = 'labels';
/** @type {Array} Flat list of currently visible task rows */
let visibleRows = [];
/** @type {Array<{col:number, dir:'asc'|'desc'}>} Multi-column sort state */
let sortColumns = [];
/** Legacy single-sort aliases (used throughout the codebase) */
let sortCol = null, sortDir = null;

/** @type {Set<string>} Manually-added bucket names (not derived from tasks) */
let customBuckets = new Set();

/* =====================================================================
   6. DATA TABLE — columns, widths, keyboard nav, drag & drop
   ===================================================================== */
const ALL_COLUMNS = [
  { id: 'select',    label: '',            defaultVisible: true,  alwaysOn: true },
  { id: 'taskNum',   label: '#',           defaultVisible: true },
  { id: 'outline',   label: 'Outline',     defaultVisible: true },
  { id: 'name',      label: 'Task Name',   defaultVisible: true,  alwaysOn: true },
  { id: 'start',     label: 'Start Date',  defaultVisible: true },
  { id: 'finish',    label: 'End Date',    defaultVisible: true },
  { id: 'duration',  label: 'Duration',    defaultVisible: true },
  { id: 'milestone', label: 'MS',          defaultVisible: true },
  { id: 'labels',    label: 'Labels',      defaultVisible: true },
  { id: 'bucket',    label: 'Bucket',      defaultVisible: true },
  { id: 'priority',  label: 'Priority',    defaultVisible: true },
  { id: 'pct',       label: '% Complete',  defaultVisible: true },
  { id: 'deps',      label: 'Dependencies',defaultVisible: true },
  { id: 'effort',    label: 'Effort',      defaultVisible: true },
  { id: 'notes',     label: 'Notes',       defaultVisible: true },
  { id: 'assigned',  label: 'Assigned To', defaultVisible: true },
  { id: 'status',    label: 'Status',      defaultVisible: false },
  { id: 'cost',      label: 'Budget/Cost', defaultVisible: false },
  { id: 'sprint',    label: 'Sprint',      defaultVisible: false },
  { id: 'category',  label: 'Category',    defaultVisible: false },
  { id: 'calendar',  label: 'Calendar',    defaultVisible: false },
];
let visibleColumns = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));

// --- Column widths (Data Table) ---
let columnWidths = {}; // { colId: px }
let tableScrollMode = false; // false = fit-to-page (auto), true = scroll (fixed widths)

/** @type {{rowIdx:number, colIdx:number}|null} Active cell for keyboard navigation */
let activeCell = null;
/** @type {boolean} Cell is in edit mode (typing replaces content) */
let cellEditMode = false;
/** @type {*} Clipboard: copied cell value */
let _copiedCellValue = null;
/** @type {string|null} Clipboard: field name of copied cell */
let _copiedCellField = null;
/** @type {Array<string>|null} Custom column order (null = default) */
let columnOrder = null;
/** @type {Object} Per-column filter state { colId: { values: Set, search: '' } } */
let columnFilters = {};

/* =====================================================================
   7. DRAG & DROP — row reordering state
   ===================================================================== */

let dragRowId = null;
let dragGhost = null;
let dragIndicator = null;
let dragStartX = 0;

/* =====================================================================
   8. MULTI-PROJECT & EXCEL IMPORT
   ===================================================================== */

/** @type {Object} All projects keyed by ID */
let projects = {};
/** @type {string|null} Currently active project ID */
let currentProjectId = null;
/** @type {Array} Original Excel header row (preserved for re-export) */
let parsedHeaderRow = [];
/** @type {Array} Original Excel metadata rows (preserved for re-export) */
let parsedMetaRows = [];

/* =====================================================================
   9. COLOR CONFIGURATION — label, bucket, priority palettes
   ===================================================================== */
const BUCKET_COLORS = {
  'AMZ-UK': '#3B82F6',
  'eBay UK': '#F59E0B',
  'Amazon AUS': '#10B981',
  'TikTok ITA': '#EC4899',
  'Privalia ITA': '#8B5CF6',
  'VeePee ITA': '#14B8A6'
};
// Legacy alias — kept for backward compat with saved projects
const ROLLOUT_COLORS = BUCKET_COLORS;
const DEFAULT_COLOR = '#64748B';

const LABEL_COLORS = {
  'Business': '#3B82F6',
  'IT': '#8B5CF6',
  'Mulesoft': '#EC4899',
  'Testing': '#F59E0B',
  'Development': '#10B981',
  'UAT': '#EF4444',
  'Design': '#14B8A6'
};

const PRIORITY_OPTIONS = ['Urgent', 'Important', 'Medium', 'Low'];
const PRIORITY_COLORS = {
  'Urgent': '#EF4444',
  'Important': '#F59E0B',
  'Medium': '#3B82F6',
  'Low': '#94A3B8'
};

/* =====================================================================
   10. SVG ICONS — inline SVG strings for theme toggle
   ===================================================================== */
const SVG_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
const SVG_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';

/* =====================================================================
   11. DOM CACHE — cached element references (populated by initDOMCache)
   ===================================================================== */
const DOM = {};

function initDOMCache() {
  DOM.projectSelect = document.getElementById('project-select');
  DOM.projectInfo = document.getElementById('project-info');
  DOM.searchInput = document.getElementById('search-input');
  DOM.filterLabel = document.getElementById('filter-label');
  DOM.filterBucket = document.getElementById('filter-bucket');
  DOM.leftBody = document.getElementById('left-body');
  DOM.timelineHeader = document.getElementById('timeline-header');
  DOM.timelineBody = document.getElementById('timeline-body');
  DOM.timelineCanvas = document.getElementById('timeline-canvas');
  DOM.taskCount = document.getElementById('task-count');
  DOM.saveIndicator = document.getElementById('save-indicator');
  DOM.tooltip = document.getElementById('tooltip');
  DOM.editPanelOverlay = document.getElementById('edit-panel-overlay');
  DOM.editPanel = document.getElementById('edit-panel');
  DOM.settingsModal = document.getElementById('settings-modal');
  DOM.settingsBody = document.getElementById('settings-body');
  DOM.ganttWrapper = document.getElementById('gantt-wrapper');
  DOM.datiWrapper = document.getElementById('dati-wrapper');
  DOM.dtHeader = document.getElementById('dt-header');
  DOM.dtBody = document.getElementById('dt-body');
  DOM.btnDeleteSel = document.getElementById('btn-delete-sel');
  DOM.btnShowAll = document.getElementById('btn-show-all');
  DOM.expandLabel = document.getElementById('expand-label');
  DOM.loading = document.getElementById('loading');
  DOM.dropOverlay = document.getElementById('drop-overlay');
  DOM.fileInput = document.getElementById('file-input');
  DOM.breadcrumb = document.getElementById('breadcrumb');
  DOM.depthSelect = document.getElementById('depth-select');
  DOM.filterTeam = document.getElementById('filter-team');
  DOM.orgWrapper = document.getElementById('org-wrapper');
  DOM.orgChart = document.getElementById('org-chart');
  DOM.dashWrapper = document.getElementById('dashboard-wrapper');
  DOM.dashContent = document.getElementById('dash-content');
}
