/* ===================================================================
   DATA.JS — Storage, serialization, Excel parsing, tree building
   =================================================================== */

/* ---------- SERIALIZATION ---------- */

function serializeTasks() {
  return allTasks.map(t => ({
    id: t.id, taskNumber: t.taskNumber, outline: t.outline, depth: t.depth,
    name: t.name,
    start: t.start ? t.start.toISOString() : null,
    finish: t.finish ? t.finish.toISOString() : null,
    duration: t.duration, labels: [...t.labels], bucket: t.bucket,
    priority: t.priority, dependsOn: t.dependsOn,
    percentComplete: t.percentComplete, dependents: t.dependents,
    effort: t.effort, isMilestone: t.isMilestone, notes: t.notes || '',
    colorOverride: t.colorOverride || '', manualProgress: t.manualProgress || false,
    assigned: t.assigned || '', status: t.status || '', cost: t.cost || '',
    sprint: t.sprint || '', category: t.category || '',
    calendarId: t.calendarId || ''
  }));
}

function deserializeTasks(arr) {
  return (arr || []).map(s => ({
    ...s,
    start: s.start ? new Date(s.start) : null,
    finish: s.finish ? new Date(s.finish) : null,
    children: [], parent: null, color: DEFAULT_COLOR,
    assigned: s.assigned || '', status: s.status || '', cost: s.cost || '',
    sprint: s.sprint || '', category: s.category || '',
    calendarId: s.calendarId || ''
  }));
}


/* ---------- UNDO SYSTEM ---------- */

function snapshotUndo() {
  undoStack.push(JSON.stringify(serializeTasks()));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  scheduleSave();
}

function undoEdit() {
  if (!undoStack.length) return;
  const snap = JSON.parse(undoStack.pop());
  allTasks = snap.map(s => ({
    ...s,
    start: s.start ? new Date(s.start) : null,
    finish: s.finish ? new Date(s.finish) : null,
    children: [], parent: null
  }));
  buildTree();
  reassignColors();
  const msBtn = document.getElementById('ms-inline-btn');
  if (msBtn) msBtn.classList.toggle('active', milestoneInline);
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}


/* ---------- AUTO-SAVE ---------- */

function scheduleSave() {
  clearTimeout(autoSaveDebounce);
  const capturedProjectId = currentProjectId;
  autoSaveDebounce = setTimeout(() => {
    if (capturedProjectId === currentProjectId) {
      saveCurrentProjectToStorage();
    } else {
      saveProjectToStorage(capturedProjectId);
    }
    updateSaveIndicator();
  }, DEBOUNCE_SAVE_MS);
}

function saveProjectToStorage(projectId) {
  if (!projectId || !projects[projectId]) return;
  try {
    AppStorage.setProjects(projects);
    AppStorage.setCurrentProjectId(currentProjectId);
  } catch (e) {
    showToast('Save failed — storage may be full. Export your data to avoid losing work.', 'error');
    updateSaveIndicator('Save failed - storage full');
  }
}

function updateSaveIndicator(text) {
  const el = DOM.saveIndicator;
  if (text) { el.textContent = text; return; }
  const now = new Date();
  el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> Saved ' +
    now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}


/* ---------- MULTI-PROJECT STORAGE ---------- */

function saveCurrentProjectToStorage() {
  if (!currentProjectId) return;
  projects[currentProjectId] = {
    name: projects[currentProjectId]?.name || 'Project',
    meta: JSON.parse(JSON.stringify(projectMeta)),
    tasks: serializeTasks(),
    labelColors: { ...LABEL_COLORS },
    bucketColors: { ...BUCKET_COLORS },
    priorityColors: { ...PRIORITY_COLORS },
    rolloutColors: { ...BUCKET_COLORS }, // backward compat
    hiddenTasks: [...hiddenTasks],
    customBuckets: [...customBuckets],
    visibleColumns: [...visibleColumns],
    columnWidths: { ...columnWidths },
    tableScrollMode: tableScrollMode,
    calendars: JSON.parse(JSON.stringify(calendars)),
    workingDaysMode: workingDaysMode
  };
  try {
    AppStorage.setProjects(projects);
    AppStorage.setCurrentProjectId(currentProjectId);
  } catch (e) {
    showToast('Save failed — storage may be full. Export your data to avoid losing work.', 'error');
    updateSaveIndicator('Save failed - storage full');
  }
}

function loadProjectsFromStorage() {
  try {
    projects = AppStorage.getProjects();
    currentProjectId = AppStorage.getCurrentProjectId();
  } catch (e) {
    projects = {};
    currentProjectId = null;
  }
}

function loadProjectById(id) {
  const proj = projects[id];
  if (!proj) return;
  currentProjectId = id;
  projectMeta = proj.meta || {};
  allTasks = deserializeTasks(proj.tasks);

  // Restore label/rollout colors
  if (proj.labelColors) {
    Object.keys(LABEL_COLORS).forEach(k => delete LABEL_COLORS[k]);
    Object.assign(LABEL_COLORS, proj.labelColors);
  }
  // Restore bucket colors (try new key first, fall back to legacy rolloutColors)
  const savedBucketColors = proj.bucketColors || proj.rolloutColors;
  if (savedBucketColors) {
    Object.keys(BUCKET_COLORS).forEach(k => delete BUCKET_COLORS[k]);
    Object.assign(BUCKET_COLORS, savedBucketColors);
  }
  if (proj.priorityColors) {
    Object.keys(PRIORITY_COLORS).forEach(k => delete PRIORITY_COLORS[k]);
    Object.assign(PRIORITY_COLORS, proj.priorityColors);
  }

  // Restore calendars
  if (proj.calendars) {
    calendars = JSON.parse(JSON.stringify(proj.calendars));
  } else {
    calendars = {};
  }
  if (proj.workingDaysMode !== undefined) workingDaysMode = proj.workingDaysMode;
  ensureDefaultCalendar();
  invalidateHolidayCache();

  buildTree();
  aggregateParentProgress();
  reassignColors();
  populateFilterDropdowns();
  computeDateRange();
  navStack = [];
  // Reset view states for BOTH tabs to avoid stale IDs from previous project
  viewStates.roadmap.expandedSet.clear();
  viewStates.roadmap.collapsedSet.clear();
  viewStates.dati.expandedSet.clear();
  viewStates.dati.collapsedSet.clear();
  hiddenTasks = new Set(proj.hiddenTasks || []);
  customBuckets = new Set(proj.customBuckets || []);
  if (proj.visibleColumns && proj.visibleColumns.length > 0) {
    visibleColumns = new Set(proj.visibleColumns);
  } else {
    visibleColumns = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  }
  columnWidths = proj.columnWidths || {};
  tableScrollMode = proj.tableScrollMode || false;
  workingDaysMode = proj.workingDaysMode || false;
  const wdBtn = document.getElementById('working-days-btn');
  if (wdBtn) wdBtn.classList.toggle('active', workingDaysMode);
  getState().allExpanded = false;
  undoStack = [];
  updateShowAllBtn();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  renderProjectSelector();
  AppStorage.setCurrentProjectId(id);
}

function processLoadedData(data) {
  if (!data || !Array.isArray(data)) return;
  projectMeta = {};
  allTasks = data.map(d => {
    // se non c'è priorità fissa a "Medium" (o vuoto a scelta)
    return {
      ...d,
      start: excelDateToJS(d.start),
      finish: excelDateToJS(d.finish),
      labels: d.labels ? (Array.isArray(d.labels) ? d.labels : String(d.labels).split(',').map(s=>s.trim()).filter(Boolean)) : [],
      bucket: d.bucket || '',
      priority: d.priority || '',
      dependsOn: d.dependsOn || '',
      percentComplete: parseFloat(d.percentComplete) || 0,
      isMilestone: !!d.isMilestone,
      effort: d.effort || '',
      notes: d.notes || '',
      assigned: d.assigned || '', status: d.status || '', cost: d.cost || '',
      sprint: d.sprint || '', category: d.category || ''
    };
  });

  taskTree = [];
  filteredTree = [];
  navStack = [];
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  getState().allExpanded = false;
  undoStack = [];
}

function renderProjectSelector() {
  const sel = DOM.projectSelect;
  sel.innerHTML = '';
  Object.keys(projects).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = projects[id].name || 'Project';
    if (id === currentProjectId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function switchProject(id) {
  if (id === currentProjectId) return;
  clearTimeout(autoSaveDebounce);
  saveCurrentProjectToStorage();
  loadProjectById(id);
}

async function createNewProject(name) {
  saveCurrentProjectToStorage();
  const id = generateId();
  const pName = name || await showPrompt('Enter a name for the new project:', { title: 'New Project', defaultValue: DEFAULT_PROJECT_NAME });
  if (pName === null) return;
  const trimmed = (pName || DEFAULT_PROJECT_NAME).trim().substring(0, 100);
  // Duplicate name check
  const isDuplicate = Object.values(projects).some(p => p.name && p.name.toLowerCase() === trimmed.toLowerCase());
  if (isDuplicate) {
    showToast('A project with this name already exists. Please choose a different name.', 'warn');
    return;
  }

  // Load global defaults for labels/buckets/priority (if saved)
  const defaults = loadGlobalDefaults();
  Object.keys(LABEL_COLORS).forEach(k => delete LABEL_COLORS[k]);
  Object.assign(LABEL_COLORS, defaults.labelColors);
  Object.keys(BUCKET_COLORS).forEach(k => delete BUCKET_COLORS[k]);
  Object.assign(BUCKET_COLORS, defaults.bucketColors);
  Object.keys(PRIORITY_COLORS).forEach(k => delete PRIORITY_COLORS[k]);
  Object.assign(PRIORITY_COLORS, defaults.priorityColors);

  projects[id] = {
    name: trimmed, meta: {}, tasks: [],
    labelColors: { ...LABEL_COLORS }, bucketColors: { ...BUCKET_COLORS },
    priorityColors: { ...PRIORITY_COLORS }, rolloutColors: { ...BUCKET_COLORS }
  };
  currentProjectId = id;
  projectMeta = {};
  allTasks = [];
  taskTree = [];
  filteredTree = [];
  navStack = [];
  customBuckets = new Set();
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  getState().allExpanded = false;
  undoStack = [];
  computeDateRange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  renderProjectSelector();
  saveCurrentProjectToStorage();
}

/* ---------- GLOBAL DEFAULTS ---------- */

const _BUILTIN_LABEL_COLORS = {
  'Business': '#3B82F6', 'IT': '#8B5CF6', 'Mulesoft': '#EC4899',
  'Testing': '#F59E0B', 'Development': '#10B981', 'UAT': '#EF4444', 'Design': '#14B8A6'
};
const _BUILTIN_BUCKET_COLORS = {
  'AMZ-UK': '#3B82F6', 'eBay UK': '#F59E0B', 'Amazon AUS': '#10B981',
  'TikTok ITA': '#EC4899', 'Privalia ITA': '#8B5CF6', 'VeePee ITA': '#14B8A6'
};
const _BUILTIN_PRIORITY_COLORS = {
  'Urgent': '#EF4444', 'Important': '#F59E0B', 'Medium': '#3B82F6', 'Low': '#94A3B8'
};

function saveGlobalDefaults() {
  AppStorage.setDefaults({
    labelColors: { ...LABEL_COLORS },
    bucketColors: { ...BUCKET_COLORS },
    priorityColors: { ...PRIORITY_COLORS }
  });
}

function loadGlobalDefaults() {
  const d = AppStorage.getDefaults();
  if (d) {
    return {
      labelColors: d.labelColors || { ..._BUILTIN_LABEL_COLORS },
      bucketColors: d.bucketColors || { ..._BUILTIN_BUCKET_COLORS },
      priorityColors: d.priorityColors || { ..._BUILTIN_PRIORITY_COLORS }
    };
  }
  return {
    labelColors: { ..._BUILTIN_LABEL_COLORS },
    bucketColors: { ..._BUILTIN_BUCKET_COLORS },
    priorityColors: { ..._BUILTIN_PRIORITY_COLORS }
  };
}

function resetToBuiltinDefaults() {
  Object.keys(LABEL_COLORS).forEach(k => delete LABEL_COLORS[k]);
  Object.assign(LABEL_COLORS, _BUILTIN_LABEL_COLORS);
  Object.keys(BUCKET_COLORS).forEach(k => delete BUCKET_COLORS[k]);
  Object.assign(BUCKET_COLORS, _BUILTIN_BUCKET_COLORS);
  Object.keys(PRIORITY_COLORS).forEach(k => delete PRIORITY_COLORS[k]);
  Object.assign(PRIORITY_COLORS, _BUILTIN_PRIORITY_COLORS);
  reassignColors(); renderAll();
  if (currentTab === 'dati') renderDataTable();
  if (typeof renderSettingsBody === 'function') renderSettingsBody();
  scheduleSave();
}

async function renameCurrentProject() {
  if (!currentProjectId || !projects[currentProjectId]) return;
  const newName = await showPrompt('Rename project:', { title: 'Rename Project', defaultValue: projects[currentProjectId].name });
  if (!newName || !newName.trim()) return;
  const trimmed = newName.trim().substring(0, 100);
  // Duplicate name check (exclude current project)
  const isDuplicate = Object.entries(projects).some(([id, p]) => id !== currentProjectId && p.name && p.name.toLowerCase() === trimmed.toLowerCase());
  if (isDuplicate) {
    showToast('A project with this name already exists. Please choose a different name.', 'warn');
    return;
  }
  projects[currentProjectId].name = trimmed;
  renderProjectSelector();
  saveCurrentProjectToStorage();
}

async function deleteCurrentProject() {
  if (!currentProjectId) return;
  const ids = Object.keys(projects);
  if (ids.length <= 1) {
    showToast('Cannot delete the only project. Create another one first.', 'warn');
    return;
  }
  if (!await showConfirm('Delete project "' + (projects[currentProjectId]?.name || '') + '"?', { title: 'Delete Project', danger: true, okLabel: 'Delete' })) return;
  delete projects[currentProjectId];
  const remaining = Object.keys(projects);
  currentProjectId = remaining[0];
  saveCurrentProjectToStorage();
  loadProjectById(currentProjectId);
}


/* ---------- TREE BUILDING ---------- */

function buildTree() {
  taskTree = [];
  const stack = [];
  allTasks.forEach(t => {
    t.children = [];
    t.parent = null;
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (t.outline.startsWith(top.outline + '.')) {
        t.parent = top;
        top.children.push(t);
        break;
      }
      stack.pop();
    }
    if (!t.parent) taskTree.push(t);
    stack.push(t);
  });
}

/**
 * Recalculate all outline strings based on each task's depth and position.
 * Walks through allTasks in order, maintaining a counter stack so that
 * sibling tasks at the same depth get sequential numbers (1, 2, 3...)
 * and children get nested numbers (1.1, 1.2, ...).
 */
function recalculateAllOutlines() {
  if (allTasks.length === 0) return;

  // counters[d] = current count at depth d (1-based)
  const counters = [];
  let prevDepth = 0;

  allTasks.forEach(t => {
    const depth = t.depth;

    if (depth > prevDepth) {
      // Going deeper: push new counters for each new level
      for (let d = prevDepth + 1; d <= depth; d++) {
        counters[d] = 1;
      }
    } else if (depth <= prevDepth) {
      // Same level or going up: increment counter at this depth
      counters[depth] = (counters[depth] || 0) + 1;
      // Trim any deeper counters (they're stale)
      counters.length = depth + 1;
    }

    // Build outline from counters: e.g. counters[1]=2, counters[2]=3 => "2.3"
    const parts = [];
    for (let d = 1; d <= depth; d++) {
      parts.push(counters[d] || 1);
    }
    t.outline = parts.join('.');

    prevDepth = depth;
  });
}

/** Renumber all taskNumbers sequentially and update all dependsOn references */
function renumberAllTaskNumbers() {
  const oldToNew = {};
  allTasks.forEach((t, i) => {
    const oldNum = t.taskNumber;
    const newNum = i + 1;
    if (oldNum !== newNum) oldToNew[oldNum] = newNum;
    t.taskNumber = newNum;
  });
  // Update dependsOn references (only task numbers, not lag values like +5d)
  if (Object.keys(oldToNew).length > 0) {
    allTasks.forEach(t => {
      if (!t.dependsOn) return;
      // Match task number at start of each dep entry (before FS/SS/FF/SF and lag)
      t.dependsOn = t.dependsOn.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(part => {
        return part.replace(/^(\d+)/, (match) => {
          const num = parseInt(match);
          return oldToNew[num] !== undefined ? String(oldToNew[num]) : match;
        });
      }).join(', ');
      // Update dependents field too
      if (t.dependents) {
        t.dependents = t.dependents.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(part => {
          const num = parseInt(part);
          return (!isNaN(num) && oldToNew[num] !== undefined) ? String(oldToNew[num]) : part;
        }).join(', ');
      }
    });
  }
}

function reassignColors() {
  allTasks.forEach(t => {
    // Priority: 1) manual override  2) bucket color  3) label colors  4) default
    if (t.colorOverride) {
      t.color = t.colorOverride;
      t.barColors = [t.colorOverride];
    } else if (t.bucket && BUCKET_COLORS[t.bucket]) {
      t.color = BUCKET_COLORS[t.bucket];
      t.barColors = [BUCKET_COLORS[t.bucket]];
    } else if (t.labels && t.labels.length > 0) {
      const colors = t.labels.map(l => LABEL_COLORS[l] || DEFAULT_COLOR);
      t.color = colors[0];
      t.barColors = colors;
    } else {
      t.color = DEFAULT_COLOR;
      t.barColors = [DEFAULT_COLOR];
    }
  });
}

function computeDateRange() {
  let dMin = Infinity, dMax = -Infinity;
  allTasks.forEach(t => {
    if (t.start && t.start.getTime() < dMin) dMin = t.start.getTime();
    if (t.finish && t.finish.getTime() > dMax) dMax = t.finish.getTime();
    if (t.start && !t.finish) {
      if (t.start.getTime() > dMax) dMax = t.start.getTime();
    }
  });
  if (dMin === Infinity) {
    const now = new Date();
    dMin = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    dMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).getTime();
  }
  // Use smart padding when available (after ui.js is loaded), otherwise fallback
  if (typeof _smartDatePadding === 'function') {
    const range = _smartDatePadding(dMin, dMax);
    minDate = range.min;
    maxDate = range.max;
  } else {
    minDate = new Date(dMin - 7 * MS_PER_DAY);
    maxDate = new Date(dMax + 7 * MS_PER_DAY);
    minDate.setDate(1);
  }
}

function populateFilterDropdowns() {
  const labelsSet = new Set();
  const bucketsSet = new Set();
  allTasks.forEach(t => {
    t.labels.forEach(l => labelsSet.add(l));
    if (t.bucket) bucketsSet.add(t.bucket);
  });
  const selLabel = DOM.filterLabel;
  const selBucket = DOM.filterBucket;
  selLabel.innerHTML = '<option value="">All labels</option>';
  selBucket.innerHTML = '<option value="">All buckets</option>';
  [...labelsSet].sort().forEach(l => selLabel.innerHTML += `<option value="${l}">${l}</option>`);
  [...bucketsSet].sort().forEach(b => selBucket.innerHTML += `<option value="${b}">${b}</option>`);
}

function recalcDuration(task) {
  if (task.start && task.finish) {
    let days;
    if (workingDaysMode) {
      const calId = task.calendarId || getDefaultCalendarId();
      days = countWorkingDays(task.start, task.finish, calId);
      if (task.isMilestone) days = 0;
      if (days === 0 && !task.isMilestone) days = 1;
    } else {
      const diffMs = task.finish.getTime() - task.start.getTime();
      const rawDays = Math.round(diffMs / MS_PER_DAY);
      // Same-day task = 1 day (occupies that day), NOT a milestone
      // Only explicit milestones (isMilestone flag) should be 0 days
      days = rawDays === 0 ? (task.isMilestone ? 0 : 1) : rawDays;
    }
    task.duration = days + (days === 1 ? ' day' : ' days');
  }
}

/**
 * Recalculate finish dates after holidays change.
 * Preserves each leaf task's working-day duration and extends/shrinks
 * the finish date to skip newly added holidays. Then propagates dependencies.
 */
function recalcFinishDates() {
  if (!workingDaysMode) return;
  allTasks.forEach(task => {
    if (!task.start || task.isMilestone) return;
    if (task.children && task.children.length > 0) return; // parents aggregate from children
    const workDays = parseInt(task.duration) || 0;
    if (workDays <= 0) return;
    const calId = task.calendarId || getDefaultCalendarId();
    task.finish = addWorkingDays(task.start, workDays, calId);
    task.duration = workDays + (workDays === 1 ? ' day' : ' days');
  });
  allTasks.forEach(task => {
    if (task.dependsOn) propagateDependencies(task);
  });
}

/** Helper: rebuild all derived data after a change */
function rebuildAfterChange() {
  buildTree();
  // Clear stale manualProgress on parent tasks so aggregation always works
  allTasks.forEach(t => { if (t.children && t.children.length > 0) t.manualProgress = false; });
  aggregateParentProgress();
  reassignColors();
  computeDateRange();
  populateFilterDropdowns();
}

/**
 * Auto-aggregate parent progress from children.
 * Weighted average by duration (in days). If children have no duration, uses equal weight.
 * Also aggregates start/finish dates from children.
 */
function aggregateParentProgress() {
  // Process bottom-up: deepest parents first
  function aggregate(task) {
    if (!task.children || task.children.length === 0) return;
    // First recurse into children
    task.children.forEach(c => aggregate(c));

    // Calculate weighted average of children's progress
    let totalWeight = 0;
    let weightedProgress = 0;
    let childMinStart = Infinity;
    let childMaxFinish = -Infinity;

    task.children.forEach(c => {
      const days = (c.start && c.finish)
        ? Math.max(Math.round((c.finish - c.start) / MS_PER_DAY), 1)
        : 1;
      totalWeight += days;
      weightedProgress += c.percentComplete * days;
      if (c.start && c.start.getTime() < childMinStart) childMinStart = c.start.getTime();
      if (c.finish && c.finish.getTime() > childMaxFinish) childMaxFinish = c.finish.getTime();
    });

    if (totalWeight > 0) {
      task.percentComplete = weightedProgress / totalWeight;
    }
    // Aggregate dates from children
    if (childMinStart !== Infinity) task.start = new Date(childMinStart);
    if (childMaxFinish !== -Infinity) task.finish = new Date(childMaxFinish);
    recalcDuration(task);
  }

  taskTree.forEach(t => aggregate(t));
}


/* ---------- EXCEL PARSING ---------- */

function parseCSV(text, delimiter) {
  delimiter = delimiter || ',';
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { showToast('CSV file has no data rows.', 'warn'); return; }

  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
  const col = name => headers.findIndex(h => h.includes(name));
  const cName = Math.max(col('name'), col('task name'), 0);
  const cStart = Math.max(col('start'), -1);
  const cFinish = Math.max(col('finish'), col('end'), -1);
  const cOutline = Math.max(col('outline'), -1);
  const cLabels = Math.max(col('label'), -1);
  const cBucket = Math.max(col('bucket'), -1);
  const cPriority = Math.max(col('priority'), -1);
  const cDeps = Math.max(col('depend'), -1);
  const cPct = Math.max(col('%'), col('percent'), col('complete'), -1);
  const cEffort = Math.max(col('effort'), -1);
  const cNotes = Math.max(col('note'), -1);
  const cAssigned = Math.max(col('assign'), -1);
  const cStatus = Math.max(col('status'), -1);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  allTasks = [];
  let id = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim());
    const name = cells[cName] || '';
    if (!name) continue;
    id++;
    let outline = cOutline >= 0 && cells[cOutline] ? cells[cOutline].trim() : String(id);
    // Validate outline format: must be dot-separated numbers
    if (!/^\d+(\.\d+)*$/.test(outline)) outline = String(id);
    const depth = outline.split('.').length;
    const startStr = cStart >= 0 ? cells[cStart] : '';
    const finishStr = cFinish >= 0 ? cells[cFinish] : '';
    const start = startStr ? new Date(startStr) : new Date(now);
    const finish = finishStr ? new Date(finishStr) : new Date(start.getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY);
    if (isNaN(start.getTime())) { start.setTime(now.getTime()); }
    if (isNaN(finish.getTime())) { finish.setTime(start.getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY); }
    const labels = cLabels >= 0 && cells[cLabels] ? cells[cLabels].split(';').map(s => s.trim()).filter(Boolean) : [];
    let pct = cPct >= 0 ? parseFloat(cells[cPct]) || 0 : 0;
    if (pct > 1) pct /= 100;
    pct = Math.max(0, Math.min(1, pct));

    const task = {
      id, taskNumber: id, outline, depth, name, start, finish,
      duration: Math.max(1, Math.round((finish - start) / MS_PER_DAY)) + ' days',
      labels, bucket: cBucket >= 0 ? cells[cBucket] || '' : '',
      priority: cPriority >= 0 ? cells[cPriority] || '' : '',
      dependsOn: cDeps >= 0 ? cells[cDeps] || '' : '',
      percentComplete: pct, dependents: '', effort: cEffort >= 0 ? cells[cEffort] || '' : '',
      isMilestone: false, children: [], parent: null, color: DEFAULT_COLOR,
      notes: cNotes >= 0 ? cells[cNotes] || '' : '',
      assigned: cAssigned >= 0 ? cells[cAssigned] || '' : '',
      status: cStatus >= 0 ? cells[cStatus] || '' : '',
      cost: '', sprint: '', category: ''
    };
    allTasks.push(task);
  }

  // Warn about duplicate outlines
  const outlineCounts = {};
  allTasks.forEach(t => { outlineCounts[t.outline] = (outlineCounts[t.outline] || 0) + 1; });
  const dupes = Object.entries(outlineCounts).filter(([_, c]) => c > 1).map(([o]) => o);
  if (dupes.length > 0) {
    showToast('Warning: duplicate outline numbers found (' + dupes.slice(0, 3).join(', ') + '). Some tasks may not display correctly.', 'warn', 6000);
  }

  buildTree();
  aggregateParentProgress();
  reassignColors();
  allTasks.forEach(t => { if (t.dependsOn) propagateDependencies(t); });
  populateFilterDropdowns();
  computeDateRange();
}

function parseExcel(data) {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  parsedMetaRows = json.slice(0, 7);
  projectMeta = {};
  const metaKeys = ['projectName', 'planOwner', 'startDate', 'finishDate', 'duration', 'percentComplete', 'exportedOn'];
  const metaLabels = ['Project name', 'Plan owner', 'Start date', 'Finish date', 'Duration', '% complete', 'Exported on'];
  for (let i = 0; i < 7 && i < json.length; i++) {
    const row = json[i];
    if (row && row.length >= 2) {
      projectMeta[metaKeys[i]] = { label: row[0] || metaLabels[i], value: row[1] };
    }
  }

  // Update project name if available
  if (projectMeta.projectName && projects[currentProjectId]) {
    projects[currentProjectId].name = String(projectMeta.projectName.value || 'Project');
    renderProjectSelector();
  }

  const headerRow = json[8] || [];
  parsedHeaderRow = headerRow;
  const hMap = {};
  headerRow.forEach((h, idx) => { if (h) hMap[String(h).trim()] = idx; });

  const col = (name) => {
    for (const k of Object.keys(hMap)) {
      if (k.toLowerCase().includes(name.toLowerCase())) return hMap[k];
    }
    return -1;
  };

  const cTaskNum = col('Task number') !== -1 ? col('Task number') : 0;
  const cOutline = col('Outline') !== -1 ? col('Outline') : 1;
  const cName = col('Name') !== -1 ? col('Name') : 2;
  const cStart = col('Start') !== -1 ? col('Start') : 3;
  const cFinish = col('Finish') !== -1 ? col('Finish') : 4;
  const cDuration = col('Duration') !== -1 ? col('Duration') : 5;
  const cLabels = col('Labels') !== -1 ? col('Labels') : 6;
  const cBucket = col('Bucket') !== -1 ? col('Bucket') : 7;
  const cPriority = col('Priority') !== -1 ? col('Priority') : 8;
  const cDepends = col('Depends') !== -1 ? col('Depends') : 9;
  const cComplete = col('complete') !== -1 ? col('complete') : 10;
  const cDependents = col('Dependents') !== -1 ? col('Dependents') : 11;
  const cEffort = col('Effort') !== -1 ? col('Effort') : 12;
  const cAssigned = col('Assigned');
  const cStatus = col('Status');
  const cCost = col('Cost') !== -1 ? col('Cost') : col('Budget');
  const cSprint = col('Sprint');
  const cCategory = col('Category');

  allTasks = [];
  for (let i = 9; i < json.length; i++) {
    const row = json[i];
    if (!row || !row[cOutline]) continue;
    const outline = String(row[cOutline]).trim();
    if (!outline) continue;
    // Validate outline format: must be dot-separated numbers (e.g., "1", "1.1", "1.2.3")
    if (!/^\d+(\.\d+)*$/.test(outline)) {
      console.warn('Skipping row with invalid outline format: ' + outline);
      continue;
    }
    const depth = outline.split('.').length;
    const startD = excelDateToJS(row[cStart]);
    const finishD = excelDateToJS(row[cFinish]);
    let pct = row[cComplete];
    if (typeof pct === 'number') { pct = pct > 1 ? pct / 100 : pct; }
    else { pct = parseFloat(pct) || 0; if (pct > 1) pct /= 100; }
    pct = Math.max(0, Math.min(1, pct));
    const durStr = String(row[cDuration] || '0 days').trim();
    const isMilestone = durStr === '0 days' || durStr === '0';
    const labels = String(row[cLabels] || '').split(';').map(s => s.trim()).filter(Boolean);
    const task = {
      id: i, taskNumber: row[cTaskNum], outline, depth,
      name: String(row[cName] || '').trim(),
      start: startD, finish: finishD, duration: durStr,
      labels, bucket: String(row[cBucket] || '').trim(),
      priority: String(row[cPriority] || '').trim(),
      dependsOn: String(row[cDepends] || ''),
      percentComplete: pct,
      dependents: String(row[cDependents] || ''),
      effort: row[cEffort],
      isMilestone, children: [], parent: null,
      color: DEFAULT_COLOR, notes: '',
      assigned: cAssigned >= 0 ? String(row[cAssigned] || '').trim() : '',
      status: cStatus >= 0 ? String(row[cStatus] || '').trim() : '',
      cost: cCost >= 0 ? String(row[cCost] || '').trim() : '',
      sprint: cSprint >= 0 ? String(row[cSprint] || '').trim() : '',
      category: cCategory >= 0 ? String(row[cCategory] || '').trim() : ''
    };
    allTasks.push(task);
  }

  // Warn about duplicate outlines
  const outlineCounts = {};
  allTasks.forEach(t => { outlineCounts[t.outline] = (outlineCounts[t.outline] || 0) + 1; });
  const dupes = Object.entries(outlineCounts).filter(([_, c]) => c > 1).map(([o]) => o);
  if (dupes.length > 0) {
    showToast('Warning: duplicate outline numbers found (' + dupes.slice(0, 3).join(', ') + '). Some tasks may not display correctly.', 'warn', 6000);
  }

  buildTree();
  aggregateParentProgress();
  reassignColors();
  // Propagate dependencies after import
  allTasks.forEach(t => {
    if (t.dependsOn) {
      propagateDependencies(t);
    }
  });

  populateFilterDropdowns();
  computeDateRange();
}


/* ---------- DEPENDENCY SYSTEM ---------- */

/** Parse dependency string like "3FS", "5FS+2d", "3" */
function parseDependency(depStr) {
  const deps = [];
  if (!depStr) return deps;
  const parts = depStr.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const m = p.match(/^(\d+)\s*(FS|SF|SS|FF)?\s*([+-]\s*\d+\s*d)?$/i);
    if (m) {
      const taskNum = parseInt(m[1]);
      const type = (m[2] || 'FS').toUpperCase();
      let lag = 0;
      if (m[3]) lag = parseInt(m[3].replace(/\s/g, '').replace('d', ''));
      deps.push({ taskNum, type, lag });
    } else {
      const num = parseInt(p);
      if (!isNaN(num)) deps.push({ taskNum: num, type: 'FS', lag: 0 });
    }
  }
  return deps;
}

/** Propagate date changes through dependency chain */
/** Detect circular dependencies. Returns true if adding depStr to taskId would create a cycle. */
function detectCircularDependency(taskId, depStr) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return false;
  const newDeps = parseDependency(depStr);
  if (newDeps.length === 0) return false;

  // Build lookup for O(1) task-by-number access
  const taskByNum = new Map();
  allTasks.forEach(t => taskByNum.set(t.taskNumber, t));

  const visited = new Set();
  const stack = newDeps.map(d => d.taskNum);

  while (stack.length > 0) {
    const num = stack.pop();
    if (visited.has(num)) continue;
    visited.add(num);
    const t = taskByNum.get(num);
    if (!t) continue;
    if (t.id === taskId) return true;
    const tDeps = parseDependency(t.dependsOn);
    for (const d of tDeps) stack.push(d.taskNum);
  }
  return false;
}

function propagateDependencies(changedTask) {
  const visited = new Set();
  // Build lookup for O(1) task-by-number access
  const taskByNum = new Map();
  allTasks.forEach(t => taskByNum.set(t.taskNumber, t));
  const queue = [changedTask];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    // Find all tasks that depend on this task
    allTasks.forEach(t => {
      if (visited.has(t.id)) return;
      const deps = parseDependency(t.dependsOn);
      for (const dep of deps) {
        if (dep.taskNum === current.taskNumber) {
          const changed = applyDependencyConstraint(t, dep, current);
          if (changed) {
            recalcDuration(t);
            queue.push(t);
          }
        }
      }
    });

    // Also check dependents field (reverse direction)
    if (current.dependents) {
      const depNums = current.dependents.split(/[,;]/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      depNums.forEach(num => {
        const depTask = taskByNum.get(num);
        if (depTask && !visited.has(depTask.id)) {
          const deps = parseDependency(depTask.dependsOn);
          for (const dep of deps) {
            if (dep.taskNum === current.taskNumber) {
              const changed = applyDependencyConstraint(depTask, dep, current);
              if (changed) {
                recalcDuration(depTask);
                queue.push(depTask);
              }
            }
          }
        }
      });
    }
  }
}

/** Apply a single dependency constraint. Returns true if dates changed. */
function applyDependencyConstraint(task, dep, predecessor) {
  if (!predecessor.start && !predecessor.finish) return false;
  const lagMs = dep.lag * MS_PER_DAY;
  let changed = false;

  if (dep.type === 'FS') {
    const requiredStart = predecessor.finish
      ? new Date(predecessor.finish.getTime() + lagMs)
      : predecessor.start ? new Date(predecessor.start.getTime() + lagMs) : null;
    if (requiredStart && task.start) {
      if (task.start.getTime() < requiredStart.getTime()) {
        const duration = task.finish && task.start ? task.finish.getTime() - task.start.getTime() : 0;
        task.start = requiredStart;
        if (duration > 0) {
          task.finish = new Date(requiredStart.getTime() + duration);
        } else if (task.finish && task.finish.getTime() < requiredStart.getTime()) {
          task.finish = new Date(requiredStart.getTime());
        }
        changed = true;
      }
    } else if (requiredStart && !task.start) {
      task.start = requiredStart;
      changed = true;
    }
  } else if (dep.type === 'SS') {
    const requiredStart = predecessor.start
      ? new Date(predecessor.start.getTime() + lagMs) : null;
    if (requiredStart && task.start) {
      if (task.start.getTime() < requiredStart.getTime()) {
        const duration = task.finish && task.start ? task.finish.getTime() - task.start.getTime() : 0;
        task.start = requiredStart;
        if (duration > 0) task.finish = new Date(requiredStart.getTime() + duration);
        changed = true;
      }
    }
  } else if (dep.type === 'FF') {
    const requiredFinish = predecessor.finish
      ? new Date(predecessor.finish.getTime() + lagMs) : null;
    if (requiredFinish && task.finish) {
      if (task.finish.getTime() < requiredFinish.getTime()) {
        const duration = task.finish && task.start ? task.finish.getTime() - task.start.getTime() : 0;
        task.finish = requiredFinish;
        if (duration > 0) task.start = new Date(requiredFinish.getTime() - duration);
        changed = true;
      }
    }
  } else if (dep.type === 'SF') {
    const requiredFinish = predecessor.start
      ? new Date(predecessor.start.getTime() + lagMs) : null;
    if (requiredFinish && task.finish) {
      if (task.finish.getTime() < requiredFinish.getTime()) {
        const duration = task.finish && task.start ? task.finish.getTime() - task.start.getTime() : 0;
        task.finish = requiredFinish;
        if (duration > 0) task.start = new Date(requiredFinish.getTime() - duration);
        changed = true;
      }
    }
  }
  return changed;
}


/* ---------- EXCEL EXPORT ---------- */

function exportExcel() {
  const wb = XLSX.utils.book_new();
  const data = [];
  const metaKeys = ['projectName', 'planOwner', 'startDate', 'finishDate', 'duration', 'percentComplete', 'exportedOn'];
  const metaLabels = ['Project name', 'Plan owner', 'Start date', 'Finish date', 'Duration', '% complete', 'Exported on'];
  for (let i = 0; i < 7; i++) {
    if (parsedMetaRows[i]) {
      data.push([...parsedMetaRows[i]]);
    } else {
      const mk = metaKeys[i];
      const mv = projectMeta[mk];
      data.push([mv ? mv.label : metaLabels[i], mv ? mv.value : '']);
    }
  }
  data.push([]);
  const headers = parsedHeaderRow.length
    ? [...parsedHeaderRow]
    : ['Task number', 'Outline number', 'Name', 'Start date', 'Finish date', 'Duration',
       'Labels', 'Bucket name', 'Priority', 'Predecessors', '% complete', 'Dependents', 'Effort',
       'Assigned To', 'Status', 'Budget/Cost', 'Sprint', 'Category'];
  data.push(headers);
  allTasks.forEach(t => {
    data.push([
      t.taskNumber, t.outline, t.name,
      t.start || '', t.finish || '', t.duration,
      t.labels.join(';'), t.bucket, t.priority,
      t.dependsOn, t.percentComplete, t.dependents, t.effort || '',
      t.assigned || '', t.status || '', t.cost || '', t.sprint || '', t.category || ''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const pName = projects[currentProjectId]?.name || 'LVZ-3PC-Gantt';
  XLSX.writeFile(wb, pName.replace(/[^a-zA-Z0-9_-]/g, '_') + '-Export.xlsx');
}
