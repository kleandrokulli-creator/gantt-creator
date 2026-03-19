/* ===================================================================
   APP.JS — Initialization, event listeners, file handling
   =================================================================== */

/* ---------- FILE HANDLING ---------- */

const fileInput = document.getElementById('file-input');

function triggerFileUpload() {
  fileInput.click();
}

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// Drag and drop with visual feedback
let dragCounter = 0;
const dropOverlay = document.getElementById('drop-overlay');

document.addEventListener('dragenter', e => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) dropOverlay.classList.add('active');
});
document.addEventListener('dragleave', e => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dropOverlay.classList.remove('active'); }
});
document.addEventListener('dragover', e => { e.preventDefault(); });
document.addEventListener('drop', e => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');
  const file = e.dataTransfer?.files?.[0];
  if (file && /\.(xlsx|xls|csv|tsv)$/i.test(file.name)) handleFile(file);
});

function handleFile(file) {
  if (!file) return;
  if (allTasks.length > 0) {
    if (!confirm('Loading a new file will replace all current tasks.\nContinue?')) {
      fileInput.value = '';
      return;
    }
  }
  DOM.loading.classList.add('show');
  const isCSV = /\.(csv|tsv)$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (isCSV) {
        parseCSV(e.target.result, file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',');
      } else {
        parseExcel(new Uint8Array(e.target.result));
      }
      renderAll();
      if (currentTab === 'dati') renderDataTable();
      scheduleSave();
    } catch (err) {
      alert('Error parsing file: ' + err.message);
      console.error(err);
    }
    DOM.loading.classList.remove('show');
    fileInput.value = '';
  };
  reader.onerror = () => {
    alert('Failed to read file: ' + (reader.error?.message || 'Unknown error'));
    DOM.loading.classList.remove('show');
    fileInput.value = '';
  };
  if (isCSV) reader.readAsText(file);
  else reader.readAsArrayBuffer(file);
}


/* ---------- DATA TABLE EVENT DELEGATION ---------- */

document.getElementById('dt-body').addEventListener('input', function (e) {
  const el = e.target;
  const field = el.dataset.field;
  const id = parseInt(el.dataset.id);
  if (!field || isNaN(id)) return;
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    snapshotUndo();
    if (field === 'name') {
      const trimmed = el.value.trim();
      task.name = trimmed || DEFAULT_TASK_NAME;
      if (!trimmed) el.value = task.name;
    }
    else if (field === 'start') {
      const newStart = el.value ? new Date(el.value + 'T00:00:00') : null;
      if (newStart && task.finish && newStart > task.finish) {
        task.finish = new Date(newStart);
        const finishEl = el.closest('tr')?.querySelector('[data-field="finish"]');
        if (finishEl) finishEl.value = el.value;
      }
      task.start = newStart;
      recalcDuration(task);
      propagateDependencies(task);
    }
    else if (field === 'finish') {
      const newFinish = el.value ? new Date(el.value + 'T00:00:00') : null;
      if (newFinish && task.start && newFinish < task.start) {
        task.start = new Date(newFinish);
        const startEl = el.closest('tr')?.querySelector('[data-field="start"]');
        if (startEl) startEl.value = el.value;
      }
      task.finish = newFinish;
      recalcDuration(task);
      propagateDependencies(task);
    }
    else if (field === 'percentComplete') {
      let v = parseInt(el.value) || 0;
      v = Math.max(0, Math.min(100, v));
      task.percentComplete = v / 100;
      // Only mark leaf tasks as manual progress; parent tasks auto-aggregate from children
      const isLeaf = !task.children || task.children.length === 0;
      if (isLeaf) task.manualProgress = true;
    }
    else if (field === 'bucket') { task.bucket = el.value; }
    else if (field === 'priority') { task.priority = el.value; }
    else if (field === 'dependsOn') {
      if (el.value && detectCircularDependency(task.id, el.value)) {
        alert('Circular dependency detected. This dependency would create a cycle.');
        el.value = task.dependsOn;
        return;
      }
      task.dependsOn = el.value;
    }
    else if (field === 'effort') { task.effort = el.value; }
    else if (field === 'notes') { task.notes = el.value; }
    else if (field === 'assigned') { task.assigned = el.value; }
    else if (field === 'status') { task.status = el.value; }
    else if (field === 'cost') { task.cost = el.value; }
    else if (field === 'sprint') { task.sprint = el.value; }
    else if (field === 'category') { task.category = el.value; }
    // Lightweight fields don't need full tree rebuild
    const lightFields = ['notes', 'effort', 'assigned', 'cost', 'sprint', 'category', 'bucket', 'priority'];
    if (lightFields.includes(field)) {
      reassignColors();
      if (currentTab === 'dati') refreshDataTableDOM();
      if (currentTab === 'roadmap') renderAll();
      scheduleSave();
      return;
    }
    rebuildAfterChange();
    if (currentTab === 'roadmap') renderAll();
    // Fields that affect parent aggregation need a full re-render
    const needsFullRender = ['percentComplete', 'start', 'finish'].includes(field);
    if (currentTab === 'dati') {
      if (needsFullRender) renderDataTable();
      else refreshDataTableDOM();
    }
  }, DEBOUNCE_INPUT_MS);
});

document.getElementById('dt-body').addEventListener('change', function (e) {
  const el = e.target;
  if (el.type === 'checkbox' && el.classList.contains('row-cb')) {
    const id = parseInt(el.dataset.id);
    if (el.checked) selectedRows.add(id); else selectedRows.delete(id);
    DOM.btnDeleteSel.style.display = selectedRows.size > 0 ? '' : 'none';
    return;
  }
  const field = el.dataset.field;
  const id = parseInt(el.dataset.id);
  if (!field || isNaN(id)) return;
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  snapshotUndo();
  if (field === 'bucket') task.bucket = el.value;
  else if (field === 'priority') task.priority = el.value;
  else if (field === 'isMilestone') task.isMilestone = el.checked;
  else if (field === 'status') task.status = el.value;
  rebuildAfterChange();
  if (currentTab === 'roadmap') renderAll();
  if (currentTab === 'dati') refreshDataTableDOM();
  scheduleSave();
});


/* ---------- KEYBOARD SHORTCUTS ---------- */

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeEditPanel(); closeContextMenu(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoEdit(); }
});

/* ---------- CONTEXT MENU DELEGATION ---------- */

document.getElementById('dt-body').addEventListener('contextmenu', function(e) {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const id = parseInt(tr.dataset.id);
  if (!isNaN(id)) showContextMenu(e, id);
});


/* ---------- RESIZE HANDLER ---------- */

let resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    if (currentTab === 'roadmap' && allTasks.length > 0) renderAll();
  }, DEBOUNCE_RESIZE_MS);
});


/* ---------- INTERACTIVE ZOOM ---------- */

const timelineBody = document.getElementById('timeline-body');
if (timelineBody) {
  let zoomDebounce = null;
  timelineBody.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      clearTimeout(zoomDebounce);
      zoomDebounce = setTimeout(() => {
        const zooms = ['day', 'week', 'month'];
        let idx = zooms.indexOf(currentZoom);
        if (e.deltaY > 0) idx = Math.min(idx + 1, zooms.length - 1);
        else idx = Math.max(idx - 1, 0);
        
        if (zooms[idx] !== currentZoom) setZoom(zooms[idx]);
      }, DEBOUNCE_ZOOM_MS);
    }
  }, { passive: false });
}

/* ---------- DRAGGABLE RESIZER ---------- */

const resizer = document.getElementById('drag-resizer');
const leftPanel = document.querySelector('.left-panel');
if (resizer && leftPanel) {
  let isResizing = false;
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = Math.max(150, Math.min(e.clientX, window.innerWidth - 300));
    document.documentElement.style.setProperty('--panel-w', newWidth + 'px');
  });
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      if (typeof renderAll === 'function' && currentTab === 'roadmap') renderAll();
    }
  });
}


/* ---------- INITIALIZATION ---------- */

(async function init() {
  initDOMCache();
  loadTheme();
  loadProjectsFromStorage();

  // Check for shared URL first
  if (location.hash.startsWith('#share=')) {
    await loadFromURL();
    return;
  }

  // If no projects exist, create a default blank one
  if (Object.keys(projects).length === 0) {
    const id = generateId();
    projects[id] = {
      name: 'New Project', meta: {}, tasks: [],
      labelColors: { ...LABEL_COLORS }, rolloutColors: { ...ROLLOUT_COLORS }
    };
    currentProjectId = id;
    saveCurrentProjectToStorage();
  }

  // Load current project or first available
  if (!currentProjectId || !projects[currentProjectId]) {
    currentProjectId = Object.keys(projects)[0];
  }

  loadProjectById(currentProjectId);

  // Init data table interactions
  initDragDrop();
  initKeyboardNav();
})();
