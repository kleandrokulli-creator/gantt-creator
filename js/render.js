/* ===================================================================
   RENDER.JS — All rendering: left panel, timeline, data table
   =================================================================== */

/* ---------- MAIN RENDER ORCHESTRATOR ---------- */

function renderAll() {
  const scope = getCurrentScope();
  filteredTree = filterTree(scope);

  // Recalculate date range based on current scope
  const range = getScopeDateRange(scope);
  if (range) { minDate = range.min; maxDate = range.max; }
  else { computeDateRange(); }

  renderProjectInfo();
  renderBreadcrumb();
  renderLeftPanel();
  renderTimeline();
  syncScroll();
}


/* ---------- PROJECT INFO (top bar) ---------- */

function renderProjectInfo() {
  const info = DOM.projectInfo;
  const m = projectMeta;
  let html = '';

  // Project name: from meta or project name
  const projName = m.projectName?.value || projects[currentProjectId]?.name || '';
  if (projName) html += `<span><strong>${esc(String(projName))}</strong></span>`;

  // Dates: dynamically calculated from tasks (fallback to meta)
  let projStart = null, projFinish = null;
  allTasks.forEach(t => {
    if (t.start && (!projStart || t.start < projStart)) projStart = t.start;
    if (t.finish && (!projFinish || t.finish > projFinish)) projFinish = t.finish;
  });
  if (!projStart && m.startDate) projStart = excelDateToJS(m.startDate.value);
  if (!projFinish && m.finishDate) projFinish = excelDateToJS(m.finishDate?.value);
  if (projStart) {
    html += `<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${fmtDate(projStart)}${projFinish ? ' &rarr; ' + fmtDate(projFinish) : ''}</span>`;
  }

  // Completion: dynamically calculated from top-level tasks
  if (allTasks.length > 0) {
    const topLevel = allTasks.filter(t => t.depth === 1);
    let totalWeight = 0, weightedPct = 0;
    topLevel.forEach(t => {
      const days = (t.start && t.finish)
        ? (workingDaysMode ? countWorkingDays(t.start, t.finish) : Math.max(Math.round((t.finish - t.start) / MS_PER_DAY), 1))
        : 1;
      totalWeight += days;
      weightedPct += t.percentComplete * days;
    });
    const pct = totalWeight > 0 ? Math.round((weightedPct / totalWeight) * 100) : 0;
    html += `<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 16h2v-4H7v4zM12 16h2V8h-2v8zM17 16h2v-6h-2v6z"/></svg> ${pct}% complete</span>`;
  }

  info.innerHTML = html;
}


/* ---------- BREADCRUMB ---------- */

function renderBreadcrumb() {
  const bc = DOM.breadcrumb;
  if (navStack.length === 0) {
    bc.innerHTML = '';
    bc.style.display = 'none';
    return;
  }
  bc.style.display = 'flex';
  let html = `<span class="bc-item" onclick="navigateToLevel(0)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Project</span>`;
  navStack.forEach((item, i) => {
    html += `<span class="bc-sep">›</span>`;
    if (i < navStack.length - 1) {
      html += `<span class="bc-item" onclick="navigateToLevel(${i + 1})">${esc(item.label)}</span>`;
    } else {
      html += `<span class="bc-item bc-current">${esc(item.label)}</span>`;
    }
  });
  bc.innerHTML = html;
}


/* ---------- LEFT PANEL (task list) ---------- */

function collectInlineMilestones(nodes) {
  const msMap = new Map();
  if (!milestoneInline) return msMap;
  function walk(list, parentTask) {
    list.forEach((t, idx) => {
      if (t.isMilestone && milestoneInline) {
        let hostNum = null;
        // 1. Check explicit dependency
        if (t.dependsOn) {
          const m = String(t.dependsOn).match(/(\d+)/);
          if (m) hostNum = parseInt(m[1]);
        }
        // 2. Find previous non-milestone sibling
        if (!hostNum) {
          for (let i = idx - 1; i >= 0; i--) {
            if (!list[i].isMilestone) { hostNum = list[i].taskNumber; break; }
          }
        }
        // 3. Fall back to parent task
        if (!hostNum && parentTask) {
          hostNum = parentTask.taskNumber;
        }
        if (hostNum) {
          if (!msMap.has(hostNum)) msMap.set(hostNum, []);
          msMap.get(hostNum).push(t);
        }
      }
      const children = t.filteredChildren || t.children;
      if (children && children.length > 0) walk(children, t);
    });
  }
  walk(nodes, null);
  return msMap;
}

function buildVisibleList(tree, opts) {
  const skipInlineMs = opts?.skipInlineMs !== false; // default true for roadmap
  const tabState = opts?.tabState || getState();
  const inlineMs = collectInlineMilestones(tree);
  const rows = [];
  const msIdsInline = new Set();
  for (const arr of inlineMs.values()) arr.forEach(m => msIdsInline.add(m.id));

  function walk(nodes, depth) {
    nodes.forEach(t => {
      // Skip inline milestones only for roadmap view
      if (skipInlineMs && milestoneInline && t.isMilestone && msIdsInline.has(t.id)) return;
      const children = t.filteredChildren || t.children;
      const hasChildren = children.length > 0;
      const myMs = inlineMs.get(t.taskNumber) || [];
      const maxDepth = tabState.visibleDepth === 0 ? 999 : tabState.visibleDepth;
      const depthAllows = depth + 1 < maxDepth;
      const childrenVisible = hasChildren && ((depthAllows && !tabState.collapsedSet.has(t.outline)) || (!depthAllows && tabState.expandedSet.has(t.outline)));
      const isHidden = hiddenTasks.has(t.id);
      rows.push({ task: t, depth, hasChildren, childrenVisible, inlineMilestones: myMs, isHidden });
      if (childrenVisible) {
        walk(children, depth + 1);
      }
    });
  }
  walk(tree, 0);
  return rows;
}

function renderLeftPanel() {
  const body = DOM.leftBody;
  visibleRows = buildVisibleList(filteredTree);

  if (allTasks.length === 0) {
    body.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>
        <path d="M13 14h4M13 17h2"/>
      </svg>
      <h2>No tasks</h2>
      <p>Load an Excel file to import tasks, or add them manually.</p>
      <div class="empty-state-actions">
        <button class="create-btn" onclick="addNewTask()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Create First Task
        </button>
        <button class="upload-btn" onclick="triggerFileUpload()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          Load Excel
        </button>
      </div>
      <div class="empty-state-templates">
        <p style="font-size:.8rem;margin-top:.5rem">Or start from a template:</p>
        <div class="template-chips">
          <button class="template-chip" onclick="loadTemplate('software')">Software Development</button>
          <button class="template-chip" onclick="loadTemplate('marketing')">Marketing Campaign</button>
          <button class="template-chip" onclick="loadTemplate('event')">Event Planning</button>
          <button class="template-chip" onclick="loadTemplate('sap')">SAP Implementation</button>
          <button class="template-chip template-chip-more" onclick="showTemplateModal()">More templates...</button>
        </div>
      </div>
    </div>`;
    DOM.taskCount.textContent = '0 tasks';
    return;
  }

  let html = '';
  const isInDrillDown = navStack.length > 0;

  if (isInDrillDown) {
    const parentName = navStack.length > 1 ? navStack[navStack.length - 2].label : 'Project';
    html += `<div class="task-row" style="padding-left:8px;opacity:.7" onclick="navigateBack()">
      <span class="arrow" style="transform:rotate(180deg)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg></span>
      <span class="task-name" style="color:var(--blue);font-weight:500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:2px"><path d="M19 12H5M5 12l6 6M5 12l6-6"/></svg> Back to ${esc(parentName)}</span>
    </div>`;
  }

  const nowTime = new Date().setHours(0, 0, 0, 0);
  visibleRows.forEach(r => {
    const t = r.task;
    const indent = r.depth * 20;
    const pct = Math.round(t.percentComplete * 100);
    const isExpanded = r.childrenVisible;
    const canDrillOrExpand = r.hasChildren;
    const showArrow = canDrillOrExpand;
    const isOverdue = t.finish && t.finish.getTime() < nowTime && t.percentComplete < 1;
    const overdueBadge = isOverdue
      ? `<span class="overdue-badge" title="Overdue"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></span>`
      : '';
    const msIndicators = r.inlineMilestones.length > 0
      ? `<span class="ms-count" title="${r.inlineMilestones.map(m => m.name).join('\n')}"><svg width="10" height="10" viewBox="0 0 24 24" fill="${getMilestoneColor(r.inlineMilestones[0])}" stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>${r.inlineMilestones.length > 1 ? r.inlineMilestones.length : ''}</span>`
      : '';
    const drillIcon = canDrillOrExpand
      ? `<span class="drill-btn" title="Drill down into ${esc(t.name)}" onclick="event.stopPropagation();navigateInto(${t.id})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></span>`
      : '';
    const isHidden = r.isHidden;
    const eyeIcon = isHidden
      ? `<button class="eye-btn hidden-task" style="opacity:0.6" onclick="event.stopPropagation();toggleTaskVisibility(${t.id})" title="Unmute task"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12a3 3 0 11-4.24-4.24"/></svg></button>`
      : `<button class="eye-btn" onclick="event.stopPropagation();toggleTaskVisibility(${t.id})" title="Mute task"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`;
    
    let pctColor = 'var(--grey-txt)';
    if (isOverdue) pctColor = 'var(--red)';
    else if (pct === 100) pctColor = 'var(--green)';
    else if (pct > 0) pctColor = 'var(--blue)';

    const mutedCls = isHidden ? ' task-muted' : '';
    html += `<div class="task-row ${canDrillOrExpand ? 'parent' : ''}${mutedCls}" data-outline="${t.outline}" data-id="${t.id}" style="padding-left:${indent + 8}px" onclick="handleTaskRowClick(event,'${t.outline}',${t.id},${canDrillOrExpand})">
      <span class="arrow ${isExpanded ? 'expanded' : ''} ${!showArrow ? 'hidden' : ''}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg></span>
      ${t.isMilestone ? `<span class="ms-star" title="Milestone"><svg width="12" height="12" viewBox="0 0 24 24" fill="${getMilestoneColor(t)}" stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></span>` : ''}
      <span class="task-name" title="${esc(t.name)}">${esc(t.name)}</span>
      ${overdueBadge}
      ${msIndicators}
      ${drillIcon}
      <span class="dur-badge">${t.duration}</span>
      <span class="pct" style="color:${pctColor};font-weight:600;min-width:36px;text-align:right">${pct}%</span>
      ${eyeIcon}
    </div>`;
  });

  body.innerHTML = html;
  DOM.taskCount.textContent = `${visibleRows.length} tasks`;
}


/* ---------- TIMELINE ---------- */

function renderTimeline() {
  if (!minDate || !maxDate) return;
  totalDays = Math.ceil((maxDate - minDate) / MS_PER_DAY);
  const dpx = getResponsiveDayPx();
  // Extra padding for milestone labels and bar labels that extend beyond the last date
  let trailingPad = 0;
  allTasks.forEach(t => {
    if (!t.start) return;
    const endDate = t.finish || t.start;
    const endX = Math.ceil((endDate - minDate) / MS_PER_DAY) * dpx[currentZoom];
    let extraW = 0;
    if (t.isMilestone && t.name) {
      extraW = t.name.length * 6.5 + 30; // star + text
    }
    const overflow = (endX + extraW) - (totalDays * dpx[currentZoom]);
    if (overflow > trailingPad) trailingPad = overflow;
  });
  canvasWidth = Math.max(totalDays * dpx[currentZoom] + Math.max(trailingPad, 20), document.querySelector('.right-panel')?.clientWidth || 600);
  renderTimelineHeader(dpx);
  renderTimelineBars(dpx);
}

function renderTimelineHeader(dpx) {
  const header = DOM.timelineHeader;
  const headerH = 72;
  let html = `<div style="position:relative;width:${canvasWidth}px;height:${headerH}px">`;
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Row 0: Years
  let startYear = minDate.getFullYear();
  let endYear = maxDate.getFullYear();
  for (let yr = startYear; yr <= endYear; yr++) {
    const yrStart = new Date(yr, 0, 1);
    const yrEnd = new Date(yr + 1, 0, 1);
    const x = dateToPxR(yrStart < minDate ? minDate : yrStart, dpx);
    const xEnd = dateToPxR(yrEnd > maxDate ? maxDate : yrEnd, dpx);
    const w = Math.max(xEnd - x, 20);
    html += `<div class="tl-year-label" style="left:${x}px;width:${w}px">${yr}</div>`;
  }

  // Row 1: Months
  let d = new Date(minDate); d.setDate(1);
  while (d <= maxDate) {
    const x = dateToPxR(d, dpx);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const w = dateToPxR(nextMonth > maxDate ? maxDate : nextMonth, dpx) - x;
    const label = w > 30 ? monthNames[d.getMonth()] : monthNames[d.getMonth()].charAt(0);
    html += `<div class="tl-month-label" style="left:${x}px;width:${Math.max(w, 12)}px">${label}</div>`;
    d = nextMonth;
  }

  // Separator lines
  html += `<div style="position:absolute;left:0;right:0;top:18px;height:1px;background:var(--border);opacity:.4"></div>`;
  html += `<div style="position:absolute;left:0;right:0;top:36px;height:1px;background:var(--border);opacity:.3"></div>`;
  html += `<div style="position:absolute;left:0;right:0;top:54px;height:1px;background:var(--border);opacity:.3"></div>`;

  // Row 2: Week numbers + Row 3: Date ranges
  let wd = new Date(minDate);
  const dow = wd.getDay() || 7;
  wd.setDate(wd.getDate() - dow + 1);
  while (wd <= maxDate) {
    const x = dateToPxR(wd, dpx);
    const wFri = new Date(wd.getTime() + 4 * MS_PER_DAY);
    const wEnd = dateToPxR(new Date(wd.getTime() + 7 * MS_PER_DAY), dpx);
    const wWidth = wEnd - x;
    if (x >= -50) {
      const wNum = getWeekNumber(wd);
      html += `<div class="tl-week-label" style="left:${x}px;width:${Math.max(wWidth, 10)}px">W${wNum}</div>`;
      if (wWidth > 22) {
        const monStr = wd.getDate();
        const friStr = wFri.getDate();
        const spansBoundary = wd.getMonth() !== wFri.getMonth();
        let dateLabel;
        if (wWidth > 55 && spansBoundary) {
          dateLabel = `${monStr}/${wd.getMonth() + 1}-${friStr}/${wFri.getMonth() + 1}`;
        } else {
          dateLabel = `${monStr}-${friStr}`;
        }
        html += `<div class="tl-date-label" style="left:${x}px;width:${Math.max(wWidth, 10)}px">${dateLabel}</div>`;
      }
      html += `<div style="position:absolute;left:${x}px;top:36px;width:1px;height:${headerH - 36}px;background:var(--border);opacity:.15"></div>`;
    }
    wd = new Date(wd.getTime() + 7 * MS_PER_DAY);
  }

  // Day-level labels at Day zoom
  if (currentZoom === 'day') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let dd = new Date(minDate); dd.setHours(0, 0, 0, 0);
    while (dd <= maxDate) {
      const x = dateToPxR(dd, dpx);
      const dayW = dpx.day;
      const dayOfWeek = dd.getDay();
      const isWE = dayOfWeek === 0 || dayOfWeek === 6;
      if (dayW > 18) {
        const label = dayW > 30 ? dayNames[dayOfWeek] : dd.getDate();
        html += `<div class="tl-day-label${isWE ? ' weekend' : ''}" style="left:${x}px;width:${dayW}px">${label}</div>`;
      }
      if (isWE) {
        html += `<div class="tl-weekend-header" style="left:${x}px;width:${dayW}px;height:${headerH}px"></div>`;
      }
      dd = new Date(dd.getTime() + MS_PER_DAY);
    }
  }

  // Month vertical lines
  d = new Date(minDate); d.setDate(1);
  while (d <= maxDate) {
    const x = dateToPxR(d, dpx);
    html += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${headerH}px;background:var(--border);opacity:.5"></div>`;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  // Year vertical lines
  for (let yr = startYear; yr <= endYear + 1; yr++) {
    const yrStart = new Date(yr, 0, 1);
    if (yrStart >= minDate && yrStart <= maxDate) {
      const x = dateToPxR(yrStart, dpx);
      html += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${headerH}px;background:var(--border);opacity:.7"></div>`;
    }
  }

  html += '</div>';
  header.innerHTML = html;
}

function renderTimelineBars(dpx) {
  const canvas = DOM.timelineCanvas;
  canvas.style.width = canvasWidth + 'px';
  let html = '';

  // Vertical grid lines
  let d = new Date(minDate); d.setDate(1);
  while (d <= maxDate) {
    const x = dateToPxR(d, dpx);
    html += `<div class="tl-grid-line month-line" style="left:${x}px"></div>`;
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    let wd = new Date(d);
    const dow = wd.getDay();
    wd.setDate(wd.getDate() - dow + 1);
    while (wd < next && wd <= maxDate) {
      const wx = dateToPxR(wd, dpx);
      if (wx > x) html += `<div class="tl-grid-line week-line" style="left:${wx}px"></div>`;
      wd.setDate(wd.getDate() + 7);
    }
    d = next;
  }

  // Build holiday set early so weekend shading can skip holiday-covered weekends
  const _hasCalendars = Object.keys(calendars).length > 0;
  const _scopedHolidays = _hasCalendars ? buildScopedHolidayLookup() : new Set();

  // Weekend shading (only at week/day zoom, or always in working-days mode)
  if (currentZoom !== 'month' || workingDaysMode) {
    const satW = dpx[currentZoom]; // 1 day width
    if (satW >= 2) { // only if wide enough to be visible
      let wd2 = new Date(minDate);
      wd2.setHours(0, 0, 0, 0);
      while (wd2 <= maxDate) {
        const dayOfWeek = wd2.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          // Skip weekend shading if this day is covered by a holiday/closure
          const ds = wd2.getFullYear() + '-' + String(wd2.getMonth() + 1).padStart(2, '0') + '-' + String(wd2.getDate()).padStart(2, '0');
          if (!_scopedHolidays.has(ds)) {
            const wx = dateToPxR(wd2, dpx);
            html += `<div class="tl-weekend" style="left:${wx}px;width:${Math.max(satW, 1)}px"></div>`;
          }
        }
        wd2 = new Date(wd2.getTime() + MS_PER_DAY);
      }
    }
  }

  // Holiday shading (scoped to current view's calendars)
  // Always show holiday shading regardless of workingDaysMode
  if (_hasCalendars && _scopedHolidays.size > 0) {
    const bridgedWeekends = buildScopedBridgedWeekends();
    const dayW = dpx[currentZoom];
    const opacity = dayW < 4 ? '55' : '40';
    const colW = Math.max(dayW, 2);

    // Shade all holidays including weekends that fall within a closure
    for (const dateStr of _scopedHolidays) {
      const hDate = new Date(dateStr + 'T00:00:00');
      if (hDate < minDate || hDate > maxDate) continue;
      const x = dateToPxR(hDate, dpx);
      const infos = getScopedHolidayInfo(dateStr);
      if (infos.length === 0) continue;
      const tooltip = infos.map(i => `${i.calendarName}: ${i.label}`).join(' / ');
      let bg;
      if (infos.length === 1) {
        bg = infos[0].color + opacity;
      } else {
        const stripeW = 6;
        const stops = [];
        infos.forEach((info, i) => {
          const s = ((i * stripeW) / (infos.length * stripeW) * 100).toFixed(1);
          const e = (((i + 1) * stripeW) / (infos.length * stripeW) * 100).toFixed(1);
          stops.push(`${info.color}${opacity} ${s}%`, `${info.color}${opacity} ${e}%`);
        });
        bg = `repeating-linear-gradient(135deg, ${stops.join(', ')})`;
      }
      html += `<div class="tl-holiday" style="left:${x}px;width:${colW}px;background:${bg}" title="${esc(tooltip)}"></div>`;
    }

    // Shade bridged weekends (Sat/Sun between holidays, not already in a closure)
    for (const dateStr of bridgedWeekends) {
      if (_scopedHolidays.has(dateStr)) continue; // already rendered as holiday
      const wDate = new Date(dateStr + 'T00:00:00');
      if (wDate < minDate || wDate > maxDate) continue;
      const x = dateToPxR(wDate, dpx);
      const scopedIds = getScopedCalendarIds();
      const bridgeColor = scopedIds.length === 1 && calendars[scopedIds[0]]
        ? calendars[scopedIds[0]].color || '#EF4444' : '#EF4444';
      html += `<div class="tl-holiday" style="left:${x}px;width:${colW}px;background:${bridgeColor}${dayW < 4 ? '30' : '20'}" title="Weekend (holiday bridge)"></div>`;
    }
  }

  // Today line
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today >= minDate && today <= maxDate) {
    html += `<div class="tl-today" style="left:${dateToPxR(today, dpx)}px"></div>`;
  }

  // Row layout
  const rowH = ROW_HEIGHT;
  document.documentElement.style.setProperty('--row-h', rowH + 'px');
  const backRow = navStack.length > 0 ? 1 : 0;
  const offsetRows = backRow;
  const totalRows = visibleRows.length + offsetRows;

  // Horizontal row grid lines
  for (let i = 0; i <= totalRows; i++) {
    html += `<div class="tl-row-line" style="top:${i * rowH}px"></div>`;
  }
  // Alternating row backgrounds
  for (let i = 0; i < totalRows; i++) {
    if (i % 2 === 1) {
      html += `<div style="position:absolute;left:0;right:0;top:${i * rowH}px;height:${rowH}px;background:var(--row-alt);pointer-events:none"></div>`;
    }
  }

  // Task bars — use scoped holiday set for splitting (matches shading)
  const scopedHolidaySet = workingDaysMode ? buildScopedHolidayLookup() : new Set();
  const todayTime = new Date().setHours(0, 0, 0, 0);
  visibleRows.forEach((r, idx) => {
    const task = r.task;
    const y = (idx + offsetRows) * rowH;
    if (!task.start) return;

    const x1 = dateToPxR(task.start, dpx);
    const x2 = task.finish ? dateToPxR(task.finish, dpx) : x1;
    const pct = Math.round(task.percentComplete * 100);
    const barBg = getBarBackground(task.barColors);
    const isOverdue = task.finish && task.finish.getTime() < todayTime && task.percentComplete < 1;
    const overdueClass = isOverdue ? ' tl-bar-overdue' : '';
    const mutedCls = r.isHidden ? ' task-muted' : '';

    if (r.childrenVisible && r.hasChildren) {
      // Parent expanded: thin "bracket" summary bar
      const barW = Math.max(x2 - x1, 4);
      const barH = 6;
      const barY = y + rowH - barH - 2; // bottom of the row
      html += `<div class="tl-bar tl-bar-summary${overdueClass}${mutedCls}" style="left:${x1}px;top:${barY}px;width:${barW}px;height:${barH}px;background:${barBg};opacity:.6"
        onclick="handleBarClick(${task.id},true)" onmouseenter="showTooltip(event,${task.id})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
        <div class="bar-progress" style="width:${pct}%"></div>
      </div>`;
      // Small downward ticks at start and end
      html += `<div style="position:absolute;left:${x1}px;top:${barY - 4}px;width:2px;height:${barH + 4}px;background:${task.color};opacity:.5;z-index:2"></div>`;
      html += `<div style="position:absolute;left:${x1 + barW - 2}px;top:${barY - 4}px;width:2px;height:${barH + 4}px;background:${task.color};opacity:.5;z-index:2"></div>`;
    } else if (task.isMilestone) {
      const msSize = 20;
      const msY = y + (rowH - msSize) / 2;
      const msColor = getMilestoneColor(task);
      html += `<div class="tl-milestone${overdueClass}${mutedCls}" style="left:${x1 - msSize / 2}px;top:${msY}px;width:${msSize}px;height:${msSize}px"
        onclick="handleBarClick(${task.id},${r.hasChildren})" onmouseenter="showTooltip(event,${task.id})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">${starSVG(msSize, msColor)}</div>`;
    } else {
      // Normal bar (leaf task or collapsed parent)
      const barH = 18;
      const barY = y + (rowH - barH) / 2;
      const cls = r.hasChildren ? 'summary' : '';
      const shouldSplit = workingDaysMode && task.finish && scopedHolidaySet.size > 0;
      const holidayGaps = shouldSplit ? findHolidayGaps(task.start, task.finish, scopedHolidaySet) : [];

      if (holidayGaps.length > 0) {
        // Split bar into segments around closure gaps
        const segments = [];
        let segStart = task.start;
        for (const gap of holidayGaps) {
          if (gap.start > segStart) {
            segments.push({ start: new Date(segStart), end: new Date(gap.start) });
          }
          segStart = gap.end;
        }
        if (segStart < task.finish) {
          segments.push({ start: new Date(segStart), end: new Date(task.finish) });
        }
        // Render each segment
        const totalBarW = Math.max(x2 - x1, 4);
        const labelRendered = false;
        segments.forEach((seg, si) => {
          const sx1 = dateToPxR(seg.start, dpx);
          const sx2 = dateToPxR(seg.end, dpx);
          const segW = Math.max(sx2 - sx1, 2);
          // Progress: distribute proportionally across segments
          const segRatio = segW / totalBarW;
          const segPctW = Math.min(pct * (totalBarW / segW), 100);
          // Compute which portion of progress falls in this segment
          const segStartRatio = (sx1 - x1) / totalBarW;
          const segEndRatio = (sx1 - x1 + segW) / totalBarW;
          let segProgress = 0;
          if (pct / 100 > segStartRatio) {
            segProgress = Math.min((pct / 100 - segStartRatio) / (segEndRatio - segStartRatio), 1) * 100;
          }
          const segLabel = si === 0 && segW > 50 ? task.name : '';
          // Rounded ends: first segment gets left radius, last gets right radius
          const borderRadius = segments.length === 1 ? '4px'
            : si === 0 ? '4px 0 0 4px'
            : si === segments.length - 1 ? '0 4px 4px 0'
            : '0';
          html += `<div class="tl-bar ${cls}${overdueClass}${mutedCls}" style="left:${sx1}px;top:${barY}px;width:${segW}px;height:${barH}px;background:${barBg};border-radius:${borderRadius}"
            onclick="handleBarClick(${task.id},${r.hasChildren})" onmouseenter="showTooltip(event,${task.id})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
            <div class="bar-progress" style="width:${segProgress}%;border-radius:${borderRadius}"></div>
            ${segLabel ? `<div class="bar-label">${esc(segLabel)}</div>` : ''}
          </div>`;
        });
      } else {
        // Single continuous bar (no closures or Month zoom)
        const barW = Math.max(x2 - x1, 4);
        const label = barW > 50 ? task.name : '';
        html += `<div class="tl-bar ${cls}${overdueClass}${mutedCls}" style="left:${x1}px;top:${barY}px;width:${barW}px;height:${barH}px;background:${barBg}"
          onclick="handleBarClick(${task.id},${r.hasChildren})" onmouseenter="showTooltip(event,${task.id})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
          <div class="bar-progress" style="width:${pct}%"></div>
          ${label ? `<div class="bar-label">${esc(label)}</div>` : ''}
        </div>`;
      }
    }
    // Inline milestones with collision avoidance
    if (r.inlineMilestones.length > 0) {
      const inMsSize = 16;
      const charW = 5.5; // approx px per char at .68rem
      const iconW = inMsSize + 3; // star + gap
      const padding = 6; // min gap between labels

      // Collect all milestone positions and estimated widths
      const msItems = r.inlineMilestones
        .filter(ms => ms.start)
        .map(ms => {
          const mx = dateToPxR(ms.start, dpx);
          const labelW = iconW + ms.name.length * charW;
          return { ms, mx, labelW, right: mx + labelW };
        })
        .sort((a, b) => a.mx - b.mx);

      // Assign vertical offsets to avoid overlaps
      // Track occupied horizontal ranges per vertical tier
      const tiers = [[]]; // tier 0 = default row center
      msItems.forEach(item => {
        let placed = false;
        for (let t = 0; t < tiers.length; t++) {
          const overlaps = tiers[t].some(prev =>
            item.mx < prev.right + padding && item.right + padding > prev.mx
          );
          if (!overlaps) {
            tiers[t].push(item);
            item.tier = t;
            placed = true;
            break;
          }
        }
        if (!placed) {
          item.tier = tiers.length;
          tiers.push([item]);
        }
      });

      // Render with vertical staggering (alternating up/down from center)
      const stepY = 12; // px offset per tier
      // Check if parent bar exists to detect overlap
      const parentBarRight = r.task.finish ? dateToPxR(r.task.finish, dpx) : 0;

      msItems.forEach(item => {
        const { ms, mx, labelW, tier } = item;
        let yOffset = 0;
        if (tier > 0) {
          const level = Math.ceil(tier / 2);
          const direction = tier % 2 === 1 ? -1 : 1;
          yOffset = direction * level * stepY;
        }
        const inMsY = y + (rowH - inMsSize) / 2 + yOffset;
        const inMsColor = getMilestoneColor(ms);

        // Decide label position: right of star (default) or left if it would overlap the parent bar end or go off-canvas
        const labelRight = mx + labelW;
        const useLeftLabel = labelRight > canvasWidth - 20 || (parentBarRight > 0 && mx < parentBarRight && labelRight > parentBarRight);
        const flexDir = useLeftLabel ? 'flex-direction:row-reverse;' : '';
        const leftPos = useLeftLabel ? mx - labelW + inMsSize / 2 : mx - inMsSize / 2;

        html += `<div class="tl-milestone" style="left:${leftPos}px;top:${inMsY}px;height:${inMsSize}px;white-space:nowrap;display:flex;align-items:center;gap:3px;${flexDir}z-index:${10 - tier}"
          onclick="openEditPanel(${ms.id})" onmouseenter="showTooltip(event,${ms.id})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">${starSVG(inMsSize, inMsColor)}<span class="tl-ms-label">${esc(ms.name)}</span></div>`;
      });
    }
  });

  // Dependencies arrows (curved SVG paths)
  const showArrowsFlag = typeof showArrows !== 'undefined' ? showArrows : true;
  if (showArrowsFlag) {
    let svgPaths = '';
    visibleRows.forEach((r, idx) => {
      const task = r.task;
      if (!task.dependsOn || !task.start) return;
      const deps = parseDependency(task.dependsOn);
      if (deps.length === 0) return;

      const x2 = dateToPxR(task.start, dpx);
      const y2 = (idx + offsetRows) * rowH + rowH / 2;

      deps.forEach(dep => {
        const pred = allTasks.find(t => t.taskNumber === dep.taskNum);
        if (!pred || !pred.finish) return;
        const rIdx1 = visibleRows.findIndex(r => r.task.id === pred.id);
        if (rIdx1 === -1) return;

        const x1 = dateToPxR(pred.finish, dpx);
        const y1 = (rIdx1 + offsetRows) * rowH + rowH / 2;

        // Curved path: horizontal out, curve down/up, horizontal in
        const dx = x2 - x1;
        const dy = y2 - y1;
        const offsetX = Math.min(Math.abs(dx) * 0.4, 40);
        const cpx1 = x1 + offsetX;
        const cpx2 = x2 - offsetX;

        svgPaths += `<path d="M${x1},${y1} C${cpx1},${y1} ${cpx2},${y2} ${x2},${y2}" fill="none" stroke="var(--blue)" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5"/>`;
        // Arrowhead
        const angle = Math.atan2(y2 - ((y1+y2)/2), x2 - cpx2);
        const aSize = 5;
        const ax1 = x2 - aSize * Math.cos(angle - 0.4);
        const ay1 = y2 - aSize * Math.sin(angle - 0.4);
        const ax2 = x2 - aSize * Math.cos(angle + 0.4);
        const ay2 = y2 - aSize * Math.sin(angle + 0.4);
        svgPaths += `<polygon points="${x2},${y2} ${ax1},${ay1} ${ax2},${ay2}" fill="var(--blue)" opacity="0.7"/>`;
      });
    });
    if (svgPaths) {
      html += `<svg class="dep-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;overflow:visible">${svgPaths}</svg>`;
    }
  }

  const totalH = totalRows * rowH;
  canvas.style.height = totalH + 'px';
  canvas.innerHTML = html;
}


/* ---------- DATA TABLE ---------- */

function renderDataTable() {
  const headerTr = DOM.dtHeader;
  // Build visible column list in order, respecting custom column order if set
  let visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));
  if (columnOrder && Array.isArray(columnOrder)) {
    const ordered = [];
    columnOrder.forEach(id => {
      const col = visCols.find(c => c.id === id);
      if (col) ordered.push(col);
    });
    // Append any visible columns not in columnOrder (new columns)
    visCols.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    visCols = ordered;
  }
  // Map column id -> sortable index for backwards-compatible sorting
  const SORT_MAP = { taskNum:1, outline:2, name:3, start:4, finish:5, duration:6, milestone:7, labels:8, bucket:9, priority:10, pct:11, deps:12, effort:13, notes:14, assigned:15, status:16, cost:17, sprint:18, category:19, calendar:20 };
  // Default min-widths per column type
  const DEFAULT_WIDTHS = DEFAULT_COLUMN_WIDTHS;

  // Compute sticky-name-left offset
  let stickyNameLeft = 0;
  if (visibleColumns.has('select')) {
    stickyNameLeft += columnWidths['select'] || DEFAULT_WIDTHS['select'] || 36;
  }
  if (isDataEditMode) stickyNameLeft += 28; // drag handle width
  const table = document.getElementById('data-table');
  if (table) table.style.setProperty('--sticky-name-left', stickyNameLeft + 'px');

  let hhtml = '';
  // Drag handle header
  if (isDataEditMode) hhtml += `<th style="width:28px;min-width:28px;max-width:28px;padding:0"></th>`;
  visCols.forEach(col => {
    const si = SORT_MAP[col.id];
    // Multi-sort: find this column in sortColumns array
    const sortEntry = sortColumns.find(s => s.col === si);
    const sortIdx = sortEntry ? sortColumns.indexOf(sortEntry) : -1;
    const sortable = si ? `onclick="sortTable(${si}, event)"` : '';
    let arrow = '';
    if (sortEntry) {
      arrow = `<span class="sort-arrow ${sortEntry.dir}"></span>`;
      if (sortColumns.length > 1) arrow += `<span class="sort-badge">${sortIdx + 1}</span>`;
    } else if (si) {
      arrow = '<span class="sort-arrow"></span>';
    }
    // Column filter icon
    const hasFilter = columnFilters[col.id] && (columnFilters[col.id].search || (columnFilters[col.id].values && columnFilters[col.id].values.size > 0));
    const filterIcon = (si && col.id !== 'select') ? `<span class="col-filter-icon${hasFilter ? ' active' : ''}" onclick="event.stopPropagation();openColumnFilter(event,'${col.id}')" title="Filter"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg></span>` : '';
    const w = columnWidths[col.id] || DEFAULT_WIDTHS[col.id] || 100;
    const minW = (typeof MIN_COL_WIDTHS !== 'undefined' && MIN_COL_WIDTHS[col.id]) || MIN_COLUMN_WIDTH;
    const wStyle = `style="width:${w}px;min-width:${minW}px"`;
    const resizeHandle = (col.id !== 'select') ? `<div class="col-resize-handle" data-col="${col.id}" onmousedown="startColResize(event,'${col.id}')"></div>` : '';
    // Column drag reorder attributes
    const dragAttr = (col.id !== 'select') ? `draggable="true" ondragstart="colDragStart(event,'${col.id}')" ondragover="colDragOver(event,'${col.id}')" ondrop="colDrop(event,'${col.id}')" ondragend="colDragEnd(event)"` : '';
    if (col.id === 'select') {
      if (isDataEditMode) {
        hhtml += `<th data-col-id="select" ${wStyle}><input type="checkbox" class="row-cb" onchange="toggleSelectAll(this.checked)">${resizeHandle}</th>`;
      } else {
        hhtml += `<th data-col-id="select" ${wStyle}>${resizeHandle}</th>`;
      }
    } else {
      hhtml += `<th data-col-id="${col.id}" ${wStyle} ${sortable} ${dragAttr}>${col.label}${arrow}${filterIcon}${resizeHandle}</th>`;
    }
  });
  headerTr.innerHTML = hhtml;

  let tasks;
  const isSorted = sortColumns.length > 0;
  if (isSorted) {
    tasks = sortTaskListMulti(getFilteredFlatTasks(), sortColumns);
  } else {
    // Build independent visible list for Data tab: show all milestones, use dati tab state
    const dataRows = buildVisibleList(filteredTree, { skipInlineMs: false, tabState: viewStates.dati });
    tasks = dataRows.map(r => r.task);
  }
  // Apply column filters
  tasks = applyColumnFilters(tasks, visCols);
  
  const tbody = DOM.dtBody;
  let bhtml = '';
  const bucketsArr = getAllBuckets();
  let prevL1 = null;
  let groupIndex = 0; // Feature 12: group striping
  const todayTime = new Date().setHours(0, 0, 0, 0);
  tasks.forEach((t, idx) => {
    const isParent = t.children && t.children.length > 0;
    const autoCalcPct = isParent;
    const depth = isSorted ? 1 : (t.depth || 1);
    const indent = (depth - 1) * 20;
    const pct = Math.round(t.percentComplete * 100);
    const checked = selectedRows.has(t.id) ? 'checked' : '';
    const startStr = t.start ? dateToInputStr(t.start) : '';
    const finishStr = t.finish ? dateToInputStr(t.finish) : '';
    const tagsHtml = t.labels.map(l => {
      const c = LABEL_COLORS[l] || '#64748B';
      return `<span class="tag" style="background:${c}22;color:${c}">${esc(l)}</span>`;
    }).join('');

    // Detect new level-1 group for separator
    const l1 = t.outline.split('.')[0];
    const isNewGroup = depth === 1 && prevL1 !== null && l1 !== prevL1;
    if (isNewGroup) groupIndex++;
    prevL1 = depth === 1 ? l1 : prevL1;

    // Feature 3: Conditional formatting
    const isOverdue = t.finish && t.finish.getTime() < todayTime && pct < 100;
    const isComplete = pct === 100;
    const dateWarn = t.start && t.finish && t.finish < t.start;

    // Row classes
    const rowCls = [
      isParent ? 'parent-row' : '',
      depth === 1 ? 'dt-level1' : '',
      depth === 2 ? 'dt-level2' : '',
      depth >= 3 ? 'dt-level3-plus' : '',
      isNewGroup ? 'dt-group-sep' : '',
      isOverdue ? 'dt-overdue' : '',
      isComplete ? 'dt-complete' : '',
      (groupIndex % 2 === 1) ? 'dt-group-alt' : ''
    ].filter(Boolean).join(' ');

    // Completion cell: greyed out for auto-calc parents
    const pctDisabled = autoCalcPct ? 'disabled title="Auto-calcolato dai sotto-task"' : '';
    const pctClass = autoCalcPct ? 'cell-pct cell-pct-auto' : 'cell-pct';

    // Tree indent with connector line for children
    const indentHtml = depth > 1
      ? `<span class="dt-tree-line" style="width:${indent}px"><span class="dt-tree-connector"></span></span>`
      : '';

    const isExpanded = !getState().collapsedSet.has(t.outline);
    const arrowCls = isExpanded ? 'dt-arrow expanded' : 'dt-arrow';
    
    // In Data tab, we make the parent icon clickable to toggle expansion
    const typeIcon = isParent 
      ? `<span class="${arrowCls}" onclick="toggleExpand('${t.outline}')" title="Collapse/Expand"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></span>`
      : `<span class="dt-icon-wrap leaf-icon"><svg width="6" height="6" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg></span>`;

    // Status options for the custom column
    // STATUS_OPTIONS is defined globally in state.js

    // Build cells per visible column
    let rowContent = '';
    visCols.forEach(col => {
      if (isDataEditMode) {
        switch(col.id) {
          case 'select': rowContent += `<td data-col="select" class="dt-action-cell"><input type="checkbox" class="row-cb" ${checked} data-id="${t.id}"><button class="dt-insert-btn" onclick="insertTaskBelow(${t.id})" title="Inserisci task sotto">+</button></td>`; break;
          case 'taskNum': rowContent += `<td data-col="taskNum" style="color:var(--grey-txt);font-size:.75rem">${t.taskNumber}</td>`; break;
          case 'outline': rowContent += `<td data-col="outline" style="color:var(--grey-txt);font-size:.78rem">${esc(t.outline)}</td>`; break;
          case 'name': rowContent += `<td data-col="name" title="${esc(t.name)}"><div class="task-name-cell">${indentHtml}${typeIcon}<input type="text" value="${esc(t.name)}" data-field="name" data-id="${t.id}" title="${esc(t.name)}"></div></td>`; break;
          case 'start': rowContent += `<td data-col="start"${dateWarn ? ' class="dt-cell-warn"' : ''}><input type="date" value="${startStr}" data-field="start" data-id="${t.id}"></td>`; break;
          case 'finish': rowContent += `<td data-col="finish"${dateWarn ? ' class="dt-cell-warn"' : ''}><input type="date" value="${finishStr}" data-field="finish" data-id="${t.id}"></td>`; break;
          case 'duration': rowContent += `<td data-col="duration"><input type="number" min="0" value="${parseInt(t.duration) || 0}" data-field="duration" data-id="${t.id}" style="width:55px;font-size:.78rem" title="${workingDaysMode ? 'Working days (Mon-Fri, excl. holidays)' : 'Calendar days'}"></td>`; break;
          case 'milestone': rowContent += `<td data-col="milestone" style="text-align:center"><input type="checkbox" class="ms-cb" data-field="isMilestone" data-id="${t.id}" ${t.isMilestone ? 'checked' : ''} title="Milestone"></td>`; break;
          case 'labels': rowContent += `<td data-col="labels"><div class="cell-tags cell-tags-edit" data-id="${t.id}" onclick="openDataLabelPicker(this,${t.id})">${tagsHtml}<span class="tag-add-hint">+</span></div></td>`; break;
          case 'bucket': rowContent += `<td data-col="bucket"><select data-field="bucket" data-id="${t.id}">${bucketsArr.map(b => `<option value="${b}" ${b === t.bucket ? 'selected' : ''}>${b || '—'}</option>`).join('')}</select></td>`; break;
          case 'priority': rowContent += `<td data-col="priority"><select data-field="priority" data-id="${t.id}">${['', 'Urgent', 'Important', 'Medium', 'Low'].map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p || '—'}</option>`).join('')}</select></td>`; break;
          case 'pct': rowContent += `<td data-col="pct"><div class="${pctClass}"><input type="number" min="0" max="100" value="${pct}" data-field="percentComplete" data-id="${t.id}" style="width:50px" ${pctDisabled}><div class="mini-prog"><div class="fill" style="width:${pct}%;background:${t.color}"></div></div></div></td>`; break;
          case 'deps': rowContent += `<td data-col="deps" class="dep-cell-wrap" title="${esc(buildDepTooltip(t.dependsOn))}">${t.dependsOn ? `<div class="dep-hover-edit" data-dep-tip="${esc(buildDepTooltip(t.dependsOn))}">` : '<div>'}<input type="text" value="${esc(t.dependsOn)}" data-field="dependsOn" data-id="${t.id}" title="${esc(buildDepTooltip(t.dependsOn))}"></div></td>`; break;
          case 'effort': rowContent += `<td data-col="effort"><input type="text" value="${esc(String(t.effort || ''))}" data-field="effort" data-id="${t.id}"></td>`; break;
          case 'notes': rowContent += `<td data-col="notes" title="${esc(t.notes || '')}"><input type="text" value="${esc(t.notes || '')}" data-field="notes" data-id="${t.id}" title="${esc(t.notes || '')}"></td>`; break;
          case 'assigned': rowContent += `<td data-col="assigned" title="${esc(t.assigned || '')}"><input type="text" value="${esc(t.assigned || '')}" data-field="assigned" data-id="${t.id}" placeholder="..." title="${esc(t.assigned || '')}"></td>`; break;
          case 'status': rowContent += `<td data-col="status"><select data-field="status" data-id="${t.id}">${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === (t.status||'') ? 'selected' : ''}>${s || '—'}</option>`).join('')}</select></td>`; break;
          case 'cost': rowContent += `<td data-col="cost"><input type="text" value="${esc(t.cost || '')}" data-field="cost" data-id="${t.id}" placeholder="..."></td>`; break;
          case 'sprint': rowContent += `<td data-col="sprint"><input type="text" value="${esc(t.sprint || '')}" data-field="sprint" data-id="${t.id}" placeholder="..."></td>`; break;
          case 'category': rowContent += `<td data-col="category"><input type="text" value="${esc(t.category || '')}" data-field="category" data-id="${t.id}" placeholder="..."></td>`; break;
          case 'calendar': {
            const calIds = Object.keys(calendars);
            const curCal = t.calendarId || getDefaultCalendarId();
            rowContent += `<td data-col="calendar"><select data-field="calendarId" data-id="${t.id}">${calIds.map(id => `<option value="${id}" ${id === curCal ? 'selected' : ''}>${esc(calendars[id].name)}</option>`).join('')}</select></td>`;
            break;
          }
        }
      } else {
        const dispStart = t.start ? fmtDate(t.start) : '—';
        const dispFinish = t.finish ? fmtDate(t.finish) : '—';
        const msIcon = t.isMilestone ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="${getMilestoneColor(t)}" stroke="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>` : `<span style="color:var(--border)">—</span>`;
        switch(col.id) {
          case 'select': rowContent += `<td data-col="select" class="dt-action-cell"><input type="checkbox" class="row-cb" ${checked} data-id="${t.id}" style="opacity:0;pointer-events:none"></td>`; break;
          case 'taskNum': rowContent += `<td data-col="taskNum" style="color:var(--grey-txt);font-size:.75rem">${t.taskNumber}</td>`; break;
          case 'outline': rowContent += `<td data-col="outline" style="color:var(--grey-txt);font-size:.78rem">${esc(t.outline)}</td>`; break;
          case 'name': rowContent += `<td data-col="name" title="${esc(t.name)}"><div class="task-name-cell">${indentHtml}${typeIcon}<span class="ro-text" style="font-weight:500" title="${esc(t.name)}">${esc(t.name)}</span></div></td>`; break;
          case 'start': rowContent += `<td data-col="start"${dateWarn ? ' class="dt-cell-warn"' : ''}><span class="ro-text">${dispStart}</span></td>`; break;
          case 'finish': rowContent += `<td data-col="finish"${dateWarn ? ' class="dt-cell-warn"' : ''}><span class="ro-text">${dispFinish}</span></td>`; break;
          case 'duration': rowContent += `<td data-col="duration" style="font-size:.78rem;color:var(--grey-txt)">${esc(t.duration)}</td>`; break;
          case 'milestone': rowContent += `<td data-col="milestone" style="text-align:center">${msIcon}</td>`; break;
          case 'labels': rowContent += `<td data-col="labels"><div class="cell-tags">${tagsHtml}</div></td>`; break;
          case 'bucket': rowContent += `<td data-col="bucket"><span class="ro-text" style="color:var(--grey-txt)">${esc(t.bucket || '—')}</span></td>`; break;
          case 'priority': rowContent += `<td data-col="priority"><span class="ro-text" style="color:var(--grey-txt)">${esc(t.priority || '—')}</span></td>`; break;
          case 'pct': rowContent += `<td data-col="pct"><div class="${pctClass}"><span class="ro-text" style="width:40px;display:inline-block;text-align:right;font-size:0.85rem">${pct}%</span><div class="mini-prog" style="margin-left:8px"><div class="fill" style="width:${pct}%;background:${t.color}"></div></div></div></td>`; break;
          case 'deps': rowContent += `<td data-col="deps" title="${esc(buildDepTooltip(t.dependsOn))}">${t.dependsOn ? `<span class="ro-text dep-hover" data-dep-tip="${esc(buildDepTooltip(t.dependsOn))}" title="${esc(buildDepTooltip(t.dependsOn))}">${esc(t.dependsOn)}</span>` : '<span class="ro-text">—</span>'}</td>`; break;
          case 'effort': rowContent += `<td data-col="effort"><span class="ro-text">${esc(String(t.effort || '—'))}</span></td>`; break;
          case 'notes': rowContent += `<td data-col="notes" title="${esc(t.notes || '')}"><span class="ro-text" style="color:var(--grey-txt);font-style:italic" title="${esc(t.notes || '')}">${esc(t.notes || '')}</span></td>`; break;
          case 'assigned': rowContent += `<td data-col="assigned" title="${esc(t.assigned || '')}"><span class="ro-text" style="color:var(--grey-txt)" title="${esc(t.assigned || '—')}">${esc(t.assigned || '—')}</span></td>`; break;
          case 'status': rowContent += `<td data-col="status">${renderStatusBadge(t.status)}</td>`; break;
          case 'cost': rowContent += `<td data-col="cost"><span class="ro-text" style="color:var(--grey-txt)">${esc(t.cost || '—')}</span></td>`; break;
          case 'sprint': rowContent += `<td data-col="sprint"><span class="ro-text" style="color:var(--grey-txt)">${esc(t.sprint || '—')}</span></td>`; break;
          case 'category': rowContent += `<td data-col="category"><span class="ro-text" style="color:var(--grey-txt)">${esc(t.category || '—')}</span></td>`; break;
          case 'calendar': {
            const calId = t.calendarId || getDefaultCalendarId();
            const calName = calendars[calId] ? calendars[calId].name : '—';
            rowContent += `<td data-col="calendar"><span class="ro-text" style="color:var(--grey-txt)">${esc(calName)}</span></td>`;
            break;
          }
        }
      }
    });

    // Drag handle for edit mode
    const dragHandleHtml = isDataEditMode
      ? `<td style="width:28px;padding:0;text-align:center"><div class="dt-drag-handle" draggable="false" data-drag-id="${t.id}" title="Drag to reorder"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2.2"/><circle cx="16" cy="4" r="2.2"/><circle cx="8" cy="12" r="2.2"/><circle cx="16" cy="12" r="2.2"/><circle cx="8" cy="20" r="2.2"/><circle cx="16" cy="20" r="2.2"/></svg></div></td>`
      : '';

    bhtml += `<tr class="${rowCls}" data-id="${t.id}" data-row-idx="${idx}">
      ${dragHandleHtml}${rowContent}
    </tr>`;
  });

  // Quick-add row (always visible)
  const qaColSpan = visCols.length + (isDataEditMode ? 1 : 0);
  bhtml += `<tr class="quick-add-row">
    ${isDataEditMode ? '<td style="width:24px;padding:0"><span class="quick-add-plus">+</span></td>' : ''}
    ${visCols.map((col, ci) => {
      if (col.id === 'name') return `<td colspan="1"><input type="text" class="quick-add-input" id="quick-add-input" placeholder="Add new task... (Enter to add)" onkeydown="handleQuickAdd(event)"></td>`;
      if (col.id === 'select') return '<td></td>';
      return '<td></td>';
    }).join('')}
  </tr>`;

  tbody.innerHTML = bhtml;

  const countEl = document.getElementById('dati-task-count');
  if (countEl) countEl.textContent = `${tasks.length} tasks`;

  // Feature 8: Bulk edit bar
  if (typeof showBulkEditBar === 'function') showBulkEditBar(visCols);

  // Reset keyboard nav state
  activeCell = null;
  cellEditMode = false;

  // Apply table layout mode (fit vs scroll)
  if (typeof applyTableLayoutMode === 'function') applyTableLayoutMode();

  // Sync the toggle button state and check if fit is possible
  const togBtn = document.getElementById('table-layout-btn');
  if (togBtn) {
    togBtn.classList.toggle('active', tableScrollMode);
    const sp = togBtn.querySelector('span');
    if (sp) sp.textContent = tableScrollMode ? 'Scroll' : 'Fit';

    // Check if fit mode is possible (columns min-width fits in container)
    const container = document.querySelector('.dati-table-container');
    if (container && tableScrollMode) {
      const MIN_COL_W = MIN_COLUMN_WIDTH;
      const colCount = visCols.length + (isDataEditMode ? 1 : 0);
      const minNeeded = colCount * MIN_COL_W;
      const fitPossible = minNeeded <= container.clientWidth;
      togBtn.disabled = !fitPossible;
      togBtn.classList.toggle('disabled', !fitPossible);
      if (!fitPossible) togBtn.title = 'Too many columns to fit. Hide some columns first.';
    } else {
      togBtn.disabled = false;
      togBtn.classList.remove('disabled');
    }
  }
}

/** Build a readable tooltip for a dependsOn string like "5FS", "3FS+2d" */
function buildDepTooltip(depStr) {
  if (!depStr || depStr === '—') return '';
  const deps = parseDependency(depStr);
  if (deps.length === 0) return '';
  const typeLabels = { FS: 'Finish-to-Start', SF: 'Start-to-Finish', SS: 'Start-to-Start', FF: 'Finish-to-Finish' };
  return deps.map(d => {
    const task = allTasks.find(t => t.taskNumber === d.taskNum);
    const name = task ? task.name : '?';
    const lag = d.lag ? (d.lag > 0 ? ' +' : ' ') + d.lag + 'd' : '';
    return `#${d.taskNum} ${name}\n${typeLabels[d.type] || d.type}${lag}`;
  }).join('\n---\n');
}

/** Render a colored status badge */
function renderStatusBadge(status) {
  if (!status) return '<span class="ro-text">—</span>';
  const colors = { 'Not Started':'#94A3B8', 'In Progress':'#3B82F6', 'On Hold':'#F59E0B', 'Done':'#10B981', 'Blocked':'#EF4444' };
  const c = colors[status] || '#64748B';
  return `<span class="status-badge" style="background:${c}18;color:${c};border:1px solid ${c}44">${esc(status)}</span>`;
}

function getAllBuckets() {
  const s = new Set(['']);
  allTasks.forEach(t => { if (t.bucket) s.add(t.bucket); });
  customBuckets.forEach(b => s.add(b));
  return [...s].sort();
}

function sortTaskList(tasks, col, dir) {
  const keys = [null, 'idx', 'outline', 'name', 'start', 'finish', 'duration', 'isMilestone', 'labels', 'bucket', 'priority', 'percentComplete', 'dependsOn', 'effort', 'notes', 'assigned', 'status', 'cost', 'sprint', 'category', 'calendarId'];
  const key = keys[col];
  if (!key) return tasks;
  tasks.sort((a, b) => {
    let va, vb;
    if (key === 'idx') return 0;
    if (key === 'start' || key === 'finish') {
      va = a[key] ? a[key].getTime() : 0;
      vb = b[key] ? b[key].getTime() : 0;
    } else if (key === 'percentComplete') {
      va = a.percentComplete; vb = b.percentComplete;
    } else if (key === 'labels') {
      va = a.labels.join(';'); vb = b.labels.join(';');
    } else {
      va = String(a[key] || '').toLowerCase();
      vb = String(b[key] || '').toLowerCase();
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return tasks;
}

/** Multi-column sort: sorts by each column in priority order */
function sortTaskListMulti(tasks, sortCols) {
  if (!sortCols || sortCols.length === 0) return tasks;
  const keys = [null, 'idx', 'outline', 'name', 'start', 'finish', 'duration', 'isMilestone', 'labels', 'bucket', 'priority', 'percentComplete', 'dependsOn', 'effort', 'notes', 'assigned', 'status', 'cost', 'sprint', 'category'];
  tasks.sort((a, b) => {
    for (const sc of sortCols) {
      const key = keys[sc.col];
      if (!key || key === 'idx') continue;
      let va, vb;
      if (key === 'start' || key === 'finish') {
        va = a[key] ? a[key].getTime() : 0;
        vb = b[key] ? b[key].getTime() : 0;
      } else if (key === 'percentComplete') {
        va = a.percentComplete; vb = b.percentComplete;
      } else if (key === 'labels') {
        va = a.labels.join(';'); vb = b.labels.join(';');
      } else {
        va = String(a[key] || '').toLowerCase();
        vb = String(b[key] || '').toLowerCase();
      }
      if (va < vb) return sc.dir === 'asc' ? -1 : 1;
      if (va > vb) return sc.dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
  return tasks;
}

function sortTable(colIdx, event) {
  // Suppress sort if a column resize just finished
  if (typeof _colResizeJustFinished !== 'undefined' && _colResizeJustFinished) return;

  const shiftKey = event && event.shiftKey;

  if (shiftKey) {
    // Multi-sort: add/toggle this column
    const existing = sortColumns.findIndex(s => s.col === colIdx);
    if (existing >= 0) {
      if (sortColumns[existing].dir === 'asc') {
        sortColumns[existing].dir = 'desc';
      } else {
        sortColumns.splice(existing, 1);
      }
    } else {
      sortColumns.push({ col: colIdx, dir: 'asc' });
    }
  } else {
    // Single sort: replaces everything
    const existing = sortColumns.find(s => s.col === colIdx);
    if (existing) {
      if (existing.dir === 'asc') {
        sortColumns = [{ col: colIdx, dir: 'desc' }];
      } else {
        sortColumns = [];
      }
    } else {
      sortColumns = [{ col: colIdx, dir: 'asc' }];
    }
  }

  // Sync legacy variables for backward compat
  if (sortColumns.length === 1) {
    sortCol = sortColumns[0].col;
    sortDir = sortColumns[0].dir;
  } else if (sortColumns.length === 0) {
    sortCol = null;
    sortDir = null;
  } else {
    sortCol = sortColumns[0].col;
    sortDir = sortColumns[0].dir;
  }

  renderDataTable();
}

/** Apply column filters to a task list */
function applyColumnFilters(tasks, visCols) {
  if (!columnFilters || Object.keys(columnFilters).length === 0) return tasks;
  return tasks.filter(t => {
    for (const colId of Object.keys(columnFilters)) {
      const filter = columnFilters[colId];
      if (!filter) continue;
      const hasValues = filter.values && filter.values.size > 0;
      const hasSearch = filter.search && filter.search.trim().length > 0;
      if (!hasValues && !hasSearch) continue;

      let cellVal = '';
      switch (colId) {
        case 'name': cellVal = t.name || ''; break;
        case 'start': cellVal = t.start ? dateToInputStr(t.start) : ''; break;
        case 'finish': cellVal = t.finish ? dateToInputStr(t.finish) : ''; break;
        case 'duration': cellVal = t.duration || ''; break;
        case 'bucket': cellVal = t.bucket || ''; break;
        case 'priority': cellVal = t.priority || ''; break;
        case 'labels': cellVal = t.labels.join(', '); break;
        case 'status': cellVal = t.status || ''; break;
        case 'assigned': cellVal = t.assigned || ''; break;
        case 'notes': cellVal = t.notes || ''; break;
        case 'deps': cellVal = t.dependsOn || ''; break;
        case 'effort': cellVal = String(t.effort || ''); break;
        case 'cost': cellVal = t.cost || ''; break;
        case 'sprint': cellVal = t.sprint || ''; break;
        case 'category': cellVal = t.category || ''; break;
        case 'pct': cellVal = String(Math.round(t.percentComplete * 100)); break;
        case 'outline': cellVal = t.outline || ''; break;
        case 'taskNum': cellVal = String(t.taskNumber); break;
        default: cellVal = '';
      }

      if (hasSearch && !cellVal.toLowerCase().includes(filter.search.toLowerCase())) return false;
      if (hasValues && !filter.values.has(cellVal)) return false;
    }
    return true;
  });
}

function syncScroll() {
  const tbody = DOM.timelineBody;
  const theader = DOM.timelineHeader;
  const lbody = DOM.leftBody;
  tbody.onscroll = () => { theader.scrollLeft = tbody.scrollLeft; lbody.scrollTop = tbody.scrollTop; };
  lbody.onscroll = () => { tbody.scrollTop = lbody.scrollTop; };
}

function refreshDataTableDOM() {
  const tbody = DOM.dtBody;
  if (!tbody) return;
  allTasks.forEach(t => {
    const row = tbody.querySelector(`tr[data-id="${t.id}"]`);
    if (!row) return;
    
    const inputs = {
      name: row.querySelector('input[data-field="name"]'),
      start: row.querySelector('input[data-field="start"]'),
      finish: row.querySelector('input[data-field="finish"]'),
      percentComplete: row.querySelector('input[data-field="percentComplete"]'),
      dependsOn: row.querySelector('input[data-field="dependsOn"]'),
      effort: row.querySelector('input[data-field="effort"]'),
      notes: row.querySelector('input[data-field="notes"]')
    };

    const durationCell = row.children[6];
    
    if (inputs.start && document.activeElement !== inputs.start) inputs.start.value = t.start ? dateToInputStr(t.start) : '';
    if (inputs.finish && document.activeElement !== inputs.finish) inputs.finish.value = t.finish ? dateToInputStr(t.finish) : '';
    if (durationCell && durationCell.tagName === 'TD') durationCell.textContent = t.duration || '';
    if (inputs.percentComplete && document.activeElement !== inputs.percentComplete) {
      inputs.percentComplete.value = Math.round(t.percentComplete * 100) || 0;
      const fill = row.querySelector('.mini-prog .fill');
      if (fill) fill.style.width = Math.round(t.percentComplete * 100) + '%';
    }
    if (inputs.dependsOn && document.activeElement !== inputs.dependsOn) inputs.dependsOn.value = t.dependsOn || '';
    if (inputs.effort && document.activeElement !== inputs.effort) inputs.effort.value = String(t.effort || '');
    if (inputs.notes && document.activeElement !== inputs.notes) inputs.notes.value = t.notes || '';
  });
}
