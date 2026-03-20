/* ===================================================================
   EXPORT.JS — Export panel: Copy PNG, Download PNG, PPTX, HTML
   =================================================================== */

/* ---------- MODAL CONTROLS ---------- */

function openExportModal() {
  document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
  document.getElementById('export-modal').classList.remove('active');
}

function _exportFeedback(msg, isError) {
  const fb = document.getElementById('export-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.className = 'export-feedback show' + (isError ? ' error' : '');
  clearTimeout(fb._t);
  fb._t = setTimeout(() => fb.classList.remove('show'), 3000);
}

function _setExportBusy(btnEl, busy) {
  if (!btnEl) return;
  if (busy) {
    btnEl.classList.add('busy');
    btnEl.style.pointerEvents = 'none';
  } else {
    btnEl.classList.remove('busy');
    btnEl.style.pointerEvents = '';
  }
}


/* ====================================================================
   1. COPY PNG TO CLIPBOARD
   ==================================================================== */

/**
 * Prepare the DOM for PNG capture by expanding the timeline to full width.
 * Returns { el, cleanup } where cleanup() restores all original styles.
 *
 * Instead of cloning (which loses flex layout), we temporarily expand the
 * actual DOM so html2canvas can capture the full-width timeline at 1:1 scale.
 */
function _buildPNGCaptureElement() {
  const gantt = document.getElementById('gantt-wrapper');
  const leftPanel = document.querySelector('.left-panel');
  const rightPanel = document.querySelector('.right-panel');
  const timelineBody = document.getElementById('timeline-body');
  const timelineHeader = document.getElementById('timeline-header');
  const timelineCanvas = document.getElementById('timeline-canvas');
  const legendBar = document.getElementById('legend-bar');
  const hasLegend = legendBar && legendBar.classList.contains('open');

  // Calculate the full content width
  const leftW = leftPanel ? leftPanel.offsetWidth : 270;
  const contentW = timelineCanvas ? parseInt(timelineCanvas.style.width) || timelineCanvas.scrollWidth : canvasWidth || 1200;
  const fullW = leftW + contentW + 2; // +2 for border

  // Save original styles
  const saved = {
    ganttW: gantt.style.width,
    ganttMaxW: gantt.style.maxWidth,
    ganttOverflow: gantt.style.overflow,
    ganttPos: gantt.style.position,
    rightOverflow: rightPanel ? rightPanel.style.overflow : '',
    bodyOverflow: timelineBody ? timelineBody.style.overflow : '',
    headerOverflow: timelineHeader ? timelineHeader.style.overflow : '',
    bodyScrollLeft: timelineBody ? timelineBody.scrollLeft : 0,
    headerScrollLeft: timelineHeader ? timelineHeader.scrollLeft : 0,
  };

  // Expand: remove overflow clipping, set full width
  gantt.style.width = fullW + 'px';
  gantt.style.maxWidth = fullW + 'px';
  gantt.style.overflow = 'visible';
  if (rightPanel) rightPanel.style.overflow = 'visible';
  if (timelineBody) { timelineBody.style.overflow = 'visible'; timelineBody.scrollLeft = 0; }
  if (timelineHeader) { timelineHeader.style.overflow = 'visible'; timelineHeader.scrollLeft = 0; }

  // If legend is open, create a wrapper that contains gantt + legend at full width
  let captureEl = gantt;
  let wrapper = null;

  if (hasLegend) {
    wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;width:' + fullW + 'px;background:var(--bg,#fff);';

    // Move the gantt temporarily into the wrapper (keeps live DOM — no clone needed)
    const ganttParent = gantt.parentNode;
    const ganttNext = gantt.nextSibling;
    saved._ganttParent = ganttParent;
    saved._ganttNext = ganttNext;
    wrapper.appendChild(gantt);

    // Clone legend (lightweight, no layout issues)
    const legendClone = legendBar.cloneNode(true);
    legendClone.style.maxHeight = 'none';
    legendClone.style.padding = '8px 12px';
    legendClone.style.width = '100%';
    wrapper.appendChild(legendClone);

    document.body.appendChild(wrapper);
    captureEl = wrapper;
  }

  function cleanup() {
    // Restore gantt to original position
    if (wrapper) {
      if (saved._ganttParent) {
        if (saved._ganttNext) saved._ganttParent.insertBefore(gantt, saved._ganttNext);
        else saved._ganttParent.appendChild(gantt);
      }
      wrapper.remove();
    }
    // Restore styles
    gantt.style.width = saved.ganttW;
    gantt.style.maxWidth = saved.ganttMaxW;
    gantt.style.overflow = saved.ganttOverflow;
    if (rightPanel) rightPanel.style.overflow = saved.rightOverflow;
    if (timelineBody) { timelineBody.style.overflow = saved.bodyOverflow; timelineBody.scrollLeft = saved.bodyScrollLeft; }
    if (timelineHeader) { timelineHeader.style.overflow = saved.headerOverflow; timelineHeader.scrollLeft = saved.headerScrollLeft; }
  }

  return { el: captureEl, cleanup: cleanup };
}

async function exportCopyPNG() {
  const btn = document.querySelector('[onclick="exportCopyPNG()"]');
  _setExportBusy(btn, true);
  _exportFeedback('Generating PNG...');
  const cap = _buildPNGCaptureElement();
  try {
    const canvas = await html2canvas(cap.el, {
      scale: 2, useCORS: true,
      backgroundColor: null,                 // transparent → inherits from DOM
      width: cap.el.scrollWidth,
      height: cap.el.scrollHeight,
      windowWidth: cap.el.scrollWidth + 50,  // ensure full width is rendered
    });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    _exportFeedback('PNG copied to clipboard');
  } catch (e) {
    _exportFeedback('Failed: ' + e.message, true);
  }
  cap.cleanup();
  _setExportBusy(btn, false);
}


/* ====================================================================
   2. DOWNLOAD PNG
   ==================================================================== */

async function exportDownloadPNG() {
  const btn = document.querySelector('[onclick="exportDownloadPNG()"]');
  _setExportBusy(btn, true);
  _exportFeedback('Generating high-res PNG...');
  const cap = _buildPNGCaptureElement();
  try {
    const canvas = await html2canvas(cap.el, {
      scale: 3, useCORS: true,
      backgroundColor: null,
      width: cap.el.scrollWidth,
      height: cap.el.scrollHeight,
      windowWidth: cap.el.scrollWidth + 50,
    });
    const a = document.createElement('a');
    a.download = _exportFileName() + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    _exportFeedback('PNG downloaded');
  } catch (e) {
    _exportFeedback('Failed: ' + e.message, true);
  }
  cap.cleanup();
  _setExportBusy(btn, false);
}


/* ====================================================================
   3. PPTX EXPORT — Native PowerPoint shapes
   ==================================================================== */

async function exportPPTX() {
  if (typeof PptxGenJS === 'undefined') {
    _exportFeedback('PptxGenJS library not loaded. Check your connection.', true);
    return;
  }
  const btn = document.querySelector('[onclick="exportPPTX()"]');
  _setExportBusy(btn, true);
  _exportFeedback('Generating PPTX...');
  try {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'GANTT_WIDE', width: 13.333, height: 7.5 });
    pptx.layout = 'GANTT_WIDE';

    const slide = pptx.addSlide({ bkgd: 'FFFFFF' });
    const L = _pptxCalcLayout(pptx);

    _pptxDrawTitle(slide, L, pptx);
    _pptxDrawHeader(slide, L, pptx);
    _pptxDrawGrid(slide, L, pptx);
    _pptxDrawTaskNames(slide, L, pptx);
    _pptxDrawBars(slide, L, pptx);
    _pptxDrawToday(slide, L, pptx);
    _pptxDrawArrows(slide, L, pptx);
    _pptxDrawLegend(slide, L, pptx);

    const fileName = _exportFileName() + '.pptx';
    await pptx.writeFile({ fileName });
    _exportFeedback('PPTX downloaded');
  } catch (e) {
    console.error('PPTX export error:', e);
    _exportFeedback('Failed: ' + e.message, true);
  }
  _setExportBusy(btn, false);
}


/* --- PPTX Layout Calculator --- */

function _pptxCalcLayout(pptx) {
  const rows = visibleRows; // use current visible rows
  const numRows = rows.length;
  const SW = 13.333, SH = 7.5;

  // Title area
  const titleY = 0.12, titleH = 0.55;

  // Header (months + weeks)
  const headerY = 0.78;
  const monthH = 0.26, weekH = 0.20;
  const headerH = monthH + weekH;

  // Body
  const bodyY = headerY + headerH;
  const maxBodyH = SH - bodyY - 0.55;
  const rowH = Math.min(0.30, maxBodyH / Math.max(numRows, 1));
  const bodyH = numRows * rowH;

  // Columns
  const leftX = 0.2;
  const leftW = 2.0;
  const tlX = leftX + leftW + 0.05;
  const tlW = SW - tlX - 0.12;

  // Date mapping
  const td = totalDays || 1;
  const dayW = tlW / td;

  // Font sizes
  const taskFont = Math.max(5.5, Math.min(8.5, rowH * 26));
  const barFont = Math.max(5, Math.min(7, rowH * 22));
  const headerFont = 7.5;
  const weekFont = 6;

  // Legend
  const legendY = bodyY + bodyH + 0.12;

  return {
    SW, SH, titleY, titleH,
    headerY, monthH, weekH, headerH,
    bodyY, bodyH, rowH, numRows,
    leftX, leftW, tlX, tlW,
    dayW, td,
    taskFont, barFont, headerFont, weekFont,
    legendY, rows
  };
}

function _dateToInch(date, L) {
  if (!date || !minDate) return L.tlX;
  const days = (date - minDate) / 86400000;
  return L.tlX + days * L.dayW;
}

function _hex(color) {
  return (color || '#64748B').replace('#', '');
}

function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }


/* --- PPTX: Title --- */

function _pptxDrawTitle(slide, L, pptx) {
  const name = projectMeta.projectName?.value || projects[currentProjectId]?.name || 'Roadmap';
  slide.addText(String(name), {
    x: L.leftX, y: L.titleY, w: L.SW - 0.4, h: L.titleH,
    fontSize: 20, fontFace: 'Arial', bold: true, color: '1E293B',
    valign: 'middle'
  });
}


/* --- PPTX: Header (Months + Weeks) --- */

function _pptxDrawHeader(slide, L, pptx) {
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const shortMonths = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // "PHASE" column header background
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: L.leftX, y: L.headerY, w: L.leftW, h: L.headerH,
    fill: { color: 'E2E8F0' },
    line: { color: 'CBD5E1', width: 0.5 }
  });
  slide.addText('PHASE', {
    x: L.leftX + 0.08, y: L.headerY, w: L.leftW - 0.1, h: L.monthH,
    fontSize: L.headerFont, fontFace: 'Arial', bold: true, color: '475569',
    valign: 'middle', align: 'left'
  });
  slide.addText('Week', {
    x: L.leftX + 0.08, y: L.headerY + L.monthH, w: L.leftW - 0.1, h: L.weekH,
    fontSize: L.weekFont, fontFace: 'Arial', color: '94A3B8',
    valign: 'middle', align: 'left'
  });

  // Month columns
  let d = new Date(minDate); d.setDate(1);
  while (d <= maxDate) {
    const x = _dateToInch(d, L);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const xEnd = _dateToInch(nextMonth > maxDate ? maxDate : nextMonth, L);
    const w = xEnd - x;
    if (w > 0.2) {
      slide.addShape(pptx.shapes.RECTANGLE, {
        x, y: L.headerY, w, h: L.monthH,
        fill: { color: 'E2E8F0' },
        line: { color: 'CBD5E1', width: 0.4 }
      });
      const label = w > 1.0 ? monthNames[d.getMonth()] : shortMonths[d.getMonth()];
      slide.addText(label, {
        x, y: L.headerY, w, h: L.monthH,
        fontSize: L.headerFont, fontFace: 'Arial', bold: true, color: '334155',
        valign: 'middle', align: 'center'
      });
    }
    d = nextMonth;
  }

  // Week sub-labels
  let wd = new Date(minDate);
  const dow = wd.getDay() || 7;
  wd.setDate(wd.getDate() - dow + 1);
  while (wd <= maxDate) {
    const x = _dateToInch(wd, L);
    const wEnd = new Date(wd.getTime() + 7 * 86400000);
    const xEnd = _dateToInch(wEnd > maxDate ? maxDate : wEnd, L);
    const w = xEnd - x;
    if (x >= L.tlX - 0.05 && w > 0.08) {
      const wNum = getWeekNumber(wd);
      const clampedX = Math.max(x, L.tlX);
      const clampedW = Math.min(w, xEnd - clampedX);
      // Week background
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: clampedX, y: L.headerY + L.monthH, w: clampedW, h: L.weekH,
        fill: { color: 'F1F5F9' },
        line: { color: 'E2E8F0', width: 0.3 }
      });
      if (clampedW > 0.15) {
        slide.addText('W' + wNum, {
          x: clampedX, y: L.headerY + L.monthH, w: clampedW, h: L.weekH,
          fontSize: L.weekFont, fontFace: 'Arial', color: '94A3B8',
          valign: 'middle', align: 'center'
        });
      }
    }
    wd = wEnd;
  }
}


/* --- PPTX: Grid lines --- */

function _pptxDrawGrid(slide, L, pptx) {
  const tlRight = L.tlX + L.tlW;

  // Horizontal row lines
  for (let i = 0; i <= L.numRows; i++) {
    const y = L.bodyY + i * L.rowH;
    slide.addShape(pptx.shapes.LINE, {
      x: L.leftX, y, w: L.SW - 0.35, h: 0,
      line: { color: 'E2E8F0', width: 0.3 }
    });
  }

  // Alternating row backgrounds
  for (let i = 0; i < L.numRows; i++) {
    if (i % 2 === 1) {
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: L.leftX, y: L.bodyY + i * L.rowH, w: L.SW - 0.35, h: L.rowH,
        fill: { color: 'F8FAFC' }
      });
    }
  }

  // Vertical month lines
  let d = new Date(minDate); d.setDate(1);
  while (d <= maxDate) {
    const x = _dateToInch(d, L);
    if (x >= L.tlX && x <= tlRight) {
      slide.addShape(pptx.shapes.LINE, {
        x, y: L.bodyY, w: 0, h: L.bodyH,
        line: { color: 'E2E8F0', width: 0.3 }
      });
    }
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  // Vertical week lines (lighter)
  let wd = new Date(minDate);
  const dow2 = wd.getDay() || 7;
  wd.setDate(wd.getDate() - dow2 + 1);
  while (wd <= maxDate) {
    const x = _dateToInch(wd, L);
    if (x > L.tlX && x <= tlRight) {
      slide.addShape(pptx.shapes.LINE, {
        x, y: L.bodyY, w: 0, h: L.bodyH,
        line: { color: 'F1F5F9', width: 0.2 }
      });
    }
    wd = new Date(wd.getTime() + 7 * 86400000);
  }
}


/* --- PPTX: Task names (left column) --- */

function _pptxDrawTaskNames(slide, L, pptx) {
  L.rows.forEach((r, idx) => {
    const t = r.task;
    const y = L.bodyY + idx * L.rowH;
    const indent = r.depth * 0.15;
    const isParent = r.hasChildren;
    const name = t.name || '';

    // Outline number
    const numW = 0.35;
    slide.addText(t.outline || '', {
      x: L.leftX + 0.04, y, w: numW, h: L.rowH,
      fontSize: L.taskFont - 1, fontFace: 'Arial', color: '94A3B8',
      valign: 'middle', align: 'left'
    });

    // Task name
    slide.addText(name, {
      x: L.leftX + numW + indent, y, w: L.leftW - numW - indent - 0.06, h: L.rowH,
      fontSize: L.taskFont, fontFace: 'Arial',
      bold: isParent,
      color: isParent ? '1E293B' : '475569',
      valign: 'middle', align: 'left',
      shrinkText: true
    });
  });
}


/* --- PPTX: Task bars & milestones --- */

function _pptxDrawBars(slide, L, pptx) {
  L.rows.forEach((r, idx) => {
    const t = r.task;
    if (!t.start) return;
    const y = L.bodyY + idx * L.rowH;

    const x1 = _dateToInch(t.start, L);
    const x2 = t.finish ? _dateToInch(t.finish, L) : x1;
    const pct = Math.round(t.percentComplete * 100);
    const color = _hex(t.color);
    const barColor = t.barColors && t.barColors.length > 0 ? _hex(t.barColors[0]) : color;

    if (r.childrenVisible && r.hasChildren) {
      // Parent expanded: thin summary bar at bottom of row
      const barW = Math.max(x2 - x1, 0.02);
      const barH = 0.06;
      const barY = y + L.rowH - barH - 0.02;

      slide.addShape(pptx.shapes.RECTANGLE, {
        x: x1, y: barY, w: barW, h: barH,
        fill: { color: barColor },
        line: { type: 'none' }
      });
      // Start/end ticks
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: x1, y: barY - 0.04, w: 0.02, h: barH + 0.04,
        fill: { color: barColor }
      });
      slide.addShape(pptx.shapes.RECTANGLE, {
        x: x1 + barW - 0.02, y: barY - 0.04, w: 0.02, h: barH + 0.04,
        fill: { color: barColor }
      });

    } else if (t.isMilestone) {
      // Standalone milestone (not inline)
      const msSize = Math.min(L.rowH * 0.55, 0.16);
      const msY = y + (L.rowH - msSize) / 2;
      const msColor = _hex(getMilestoneColor(t));

      slide.addShape(pptx.shapes.DIAMOND, {
        x: x1 - msSize / 2, y: msY, w: msSize, h: msSize,
        fill: { color: msColor },
        line: { color: '475569', width: 0.3 }
      });

      // Milestone label to the right
      const labelX = x1 + msSize / 2 + 0.04;
      const dateStr = t.finish ? _shortDate(t.finish) : '';
      slide.addText(t.name + (dateStr ? ' (' + dateStr + ')' : ''), {
        x: labelX, y: msY - 0.01, w: 2.0, h: msSize + 0.02,
        fontSize: L.barFont, fontFace: 'Arial', bold: true, color: '334155',
        valign: 'middle', align: 'left'
      });

    } else {
      // Normal bar (leaf or collapsed parent)
      const barW = Math.max(x2 - x1, 0.02);
      const barH = L.rowH * 0.58;
      const barY = y + (L.rowH - barH) / 2;
      const radius = 0.03;

      // Background bar
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: x1, y: barY, w: barW, h: barH,
        fill: { color: barColor },
        rectRadius: radius,
        line: { type: 'none' }
      });

      // Progress fill (darker overlay)
      if (pct > 0 && pct < 100) {
        const progW = barW * pct / 100;
        slide.addShape(pptx.shapes.RECTANGLE, {
          x: x1, y: barY, w: progW, h: barH,
          fill: { color: _darkenHex(barColor, 25) },
          line: { type: 'none' }
        });
      } else if (pct >= 100) {
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
          x: x1, y: barY, w: barW, h: barH,
          fill: { color: _darkenHex(barColor, 25) },
          rectRadius: radius,
          line: { type: 'none' }
        });
      }

      // Bar label (if wide enough)
      if (barW > 0.6) {
        slide.addText(t.name, {
          x: x1 + 0.04, y: barY, w: barW - 0.08, h: barH,
          fontSize: L.barFont, fontFace: 'Arial', color: 'FFFFFF',
          valign: 'middle', align: 'left',
          shrinkText: true
        });
      }
    }

    // Inline milestones
    if (r.inlineMilestones && r.inlineMilestones.length > 0) {
      _pptxDrawInlineMilestones(slide, L, pptx, r, idx);
    }
  });
}


/* --- PPTX: Inline milestones with collision avoidance --- */

function _pptxDrawInlineMilestones(slide, L, pptx, row, rowIdx) {
  const y = L.bodyY + rowIdx * L.rowH;
  const msSize = Math.min(L.rowH * 0.45, 0.13);
  const charW = 0.042; // approx inch per char at small font
  const iconW = msSize + 0.02;
  const padding = 0.05;

  // Collect positions
  const items = row.inlineMilestones
    .filter(ms => ms.start)
    .map(ms => {
      const mx = _dateToInch(ms.start, L);
      const dateStr = ms.finish ? ' (' + _shortDate(ms.finish) + ')' : '';
      const label = ms.name + dateStr;
      const labelW = iconW + label.length * charW;
      return { ms, mx, label, labelW, right: mx + labelW };
    })
    .sort((a, b) => a.mx - b.mx);

  // Tier assignment (collision avoidance)
  const tiers = [[]];
  items.forEach(item => {
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

  const stepY = L.rowH * 0.35;
  items.forEach(item => {
    const { ms, mx, label, tier } = item;
    let yOff = 0;
    if (tier > 0) {
      const level = Math.ceil(tier / 2);
      const dir = tier % 2 === 1 ? -1 : 1;
      yOff = dir * level * stepY;
    }
    const msY = y + (L.rowH - msSize) / 2 + yOff;
    const msColor = _hex(getMilestoneColor(ms));

    // Diamond
    slide.addShape(pptx.shapes.DIAMOND, {
      x: mx - msSize / 2, y: msY, w: msSize, h: msSize,
      fill: { color: msColor },
      line: { color: '475569', width: 0.2 }
    });

    // Label
    slide.addText(label, {
      x: mx + msSize / 2 + 0.02, y: msY - 0.01, w: 1.8, h: msSize + 0.02,
      fontSize: L.barFont - 0.5, fontFace: 'Arial', bold: true, color: '334155',
      valign: 'middle', align: 'left'
    });
  });
}


/* --- PPTX: Today line --- */

function _pptxDrawToday(slide, L, pptx) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!minDate || !maxDate || today < minDate || today > maxDate) return;

  const x = _dateToInch(today, L);
  slide.addShape(pptx.shapes.LINE, {
    x, y: L.headerY, w: 0, h: L.bodyY + L.bodyH - L.headerY,
    line: { color: 'EF4444', width: 1.5 }
  });
}


/* --- PPTX: Dependency arrows --- */

function _pptxDrawArrows(slide, L, pptx) {
  if (!showArrows) return;

  L.rows.forEach((r, idx) => {
    const task = r.task;
    if (!task.dependsOn || !task.start) return;
    const deps = parseDependency(task.dependsOn);
    if (!deps || deps.length === 0) return;

    const x2 = _dateToInch(task.start, L);
    const y2 = L.bodyY + idx * L.rowH + L.rowH / 2;

    deps.forEach(dep => {
      const pred = allTasks.find(t => t.taskNumber === dep.taskNum);
      if (!pred || !pred.finish) return;
      const rIdx1 = L.rows.findIndex(r => r.task.id === pred.id);
      if (rIdx1 === -1) return;

      const x1 = _dateToInch(pred.finish, L);
      const y1 = L.bodyY + rIdx1 * L.rowH + L.rowH / 2;

      // Determine line geometry
      const lineX = Math.min(x1, x2);
      const lineY = Math.min(y1, y2);
      const lineW = Math.abs(x2 - x1) || 0.01;
      const lineH = Math.abs(y2 - y1) || 0.01;
      const flipH = x2 < x1;
      const flipV = y2 < y1;

      slide.addShape(pptx.shapes.LINE, {
        x: lineX, y: lineY, w: lineW, h: lineH,
        flipH, flipV,
        line: {
          color: '3B82F6', width: 1,
          dashType: 'dash',
          endArrowType: 'triangle'
        }
      });
    });
  });
}


/* --- PPTX: Legend --- */

function _pptxDrawLegend(slide, L, pptx) {
  let x = L.leftX + 0.1;
  const y = L.legendY;
  const h = 0.22;

  // Milestone symbol
  slide.addShape(pptx.shapes.DIAMOND, {
    x, y: y + 0.03, w: 0.12, h: 0.12,
    fill: { color: 'F59E0B' },
    line: { color: '475569', width: 0.3 }
  });
  x += 0.18;
  slide.addText('Milestone', {
    x, y, w: 0.7, h,
    fontSize: 7, fontFace: 'Arial', color: '475569', valign: 'middle'
  });
  x += 0.75;

  // Bucket/label colors from data
  const buckets = {};
  allTasks.forEach(t => {
    if (t.bucket && t.color) buckets[t.bucket] = t.color;
  });
  Object.entries(buckets).forEach(([name, color]) => {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y: y + 0.04, w: 0.25, h: 0.10,
      fill: { color: _hex(color) },
      rectRadius: 0.02,
      line: { type: 'none' }
    });
    x += 0.30;
    slide.addText(name, {
      x, y, w: 1.2, h,
      fontSize: 6.5, fontFace: 'Arial', color: '475569', valign: 'middle'
    });
    x += _clamp(name.length * 0.055, 0.5, 1.3) + 0.1;
  });
}


/* --- PPTX: Color helpers --- */

function _darkenHex(hex, amount) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, r - amount);
  g = Math.max(0, g - amount);
  b = Math.max(0, b - amount);
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function _shortDate(d) {
  if (!d) return '';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}


/* ====================================================================
   4. STANDALONE INTERACTIVE HTML
   ==================================================================== */

function showHTMLExportDialog() {
  let projStart = null, projFinish = null, taskCount = allTasks.length;
  allTasks.forEach(t => {
    if (t.start && (!projStart || t.start < projStart)) projStart = t.start;
    if (t.finish && (!projFinish || t.finish > projFinish)) projFinish = t.finish;
  });
  const dateRange = projStart ? fmtDate(projStart) + ' - ' + fmtDate(projFinish) : 'No dates';
  const projectName = projects[currentProjectId]?.name || 'Roadmap';

  const depthCounts = {};
  allTasks.forEach(t => { depthCounts[t.depth] = (depthCounts[t.depth] || 0) + 1; });
  const maxDepth = Math.max(...Object.keys(depthCounts).map(Number), 1);

  // Depth options
  let optionsHtml = `<label class="html-export-option">
    <input type="radio" name="html-depth" value="0" checked onchange="htmlExportUpdateL1(this)"> <strong>All levels</strong> <span class="html-export-count">${taskCount} tasks</span>
  </label>`;
  for (let d = 1; d <= Math.min(maxDepth, 4); d++) {
    const count = allTasks.filter(t => t.depth <= d).length;
    const label = d === 1 ? 'Level 1 only' : `Levels 1-${d}`;
    optionsHtml += `<label class="html-export-option">
      <input type="radio" name="html-depth" value="${d}" onchange="htmlExportUpdateL1(this)"> ${label} <span class="html-export-count">${count} tasks</span>
    </label>`;
  }

  // L1 task selection (exclude milestones - they're not projects)
  const l1Tasks = allTasks.filter(t => t.depth === 1 && !t.isMilestone);
  let l1Html = '';
  l1Tasks.forEach(t => {
    const childCount = allTasks.filter(c => c.outline.startsWith(t.outline + '.')).length;
    const dateStr = t.start ? fmtDate(t.start) + (t.finish ? ' - ' + fmtDate(t.finish) : '') : '';
    l1Html += `<label class="html-export-l1-item">
      <input type="checkbox" name="html-l1" value="${t.id}" checked>
      <span class="html-export-l1-name">${_escHtml(t.name)}</span>
      <span class="html-export-l1-meta">${childCount > 0 ? childCount + ' sub-tasks' : 'leaf'} ${dateStr ? '&middot; ' + dateStr : ''}</span>
    </label>`;
  });

  const dialog = document.createElement('div');
  dialog.className = 'html-export-dialog-overlay';
  dialog.innerHTML = `<div class="html-export-dialog">
    <h3>Export Interactive HTML</h3>
    <p class="html-export-info">${_escHtml(projectName)} &middot; ${dateRange}</p>
    <div class="html-export-desc">Standalone HTML page with interactive read-only roadmap. Anyone can open it in a browser.</div>
    <div class="html-export-section-label">Depth</div>
    <div class="html-export-options">${optionsHtml}</div>
    <div class="html-export-section-label">Include <span class="html-export-toggle-all"><a href="#" onclick="event.preventDefault();document.querySelectorAll('#html-export-l1-list input').forEach(c=>c.checked=true)">all</a> / <a href="#" onclick="event.preventDefault();document.querySelectorAll('#html-export-l1-list input').forEach(c=>c.checked=false)">none</a></span></div>
    <div class="html-export-l1-list" id="html-export-l1-list">${l1Html}</div>
    <div class="html-export-actions">
      <button class="html-export-cancel" onclick="this.closest('.html-export-dialog-overlay').remove()">Cancel</button>
      <button class="html-export-confirm" onclick="doHTMLExport(this)">Export HTML</button>
    </div>
  </div>`;
  document.body.appendChild(dialog);
}

function htmlExportUpdateL1(radio) {
  // When depth changes, update L1 checkboxes to reflect what's relevant
  const list = document.getElementById('html-export-l1-list');
  if (!list) return;
  const items = list.querySelectorAll('input[name="html-l1"]');
  // All depths show L1 selection
  items.forEach(cb => { cb.disabled = false; });
}

async function doHTMLExport(btnEl) {
  const overlay = btnEl.closest('.html-export-dialog-overlay');
  const depthVal = parseInt(overlay.querySelector('input[name="html-depth"]:checked').value) || 0;

  // Get selected L1 task IDs
  const selectedL1 = new Set();
  overlay.querySelectorAll('input[name="html-l1"]:checked').forEach(cb => {
    selectedL1.add(parseInt(cb.value));
  });

  if (selectedL1.size === 0) {
    showToast('Select at least one item to export.', 'warn');
    return;
  }

  btnEl.textContent = 'Exporting...';
  btnEl.disabled = true;

  try {
    // Load source files for self-contained HTML export
    // Strategy: Storage cache -> HTTP fetch -> sync XHR -> DOM extraction (CSS only)
    const SRC_VERSION = 'v22';

    async function loadSource(filename) {
      const cacheKey = 'planview-src-' + filename;
      const versionKey = 'planview-src-version';
      // Check cache (only if version matches)
      const cachedVersion = AppStorage.getCacheItem(versionKey);
      if (cachedVersion === SRC_VERSION) {
        const cached = AppStorage.getCacheItem(cacheKey);
        if (cached) return cached;
      }
      // Try HTTP fetch
      try {
        const r = await fetch('js/' + filename + '?t=' + Date.now());
        if (r.ok) {
          const t = await r.text();
          AppStorage.setCacheItem(cacheKey, t);
          AppStorage.setCacheItem(versionKey, SRC_VERSION);
          return t;
        }
      } catch(e) {}
      // Try sync XHR (works on some browsers with file://)
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'js/' + filename, false);
        xhr.send();
        if (xhr.responseText) {
          AppStorage.setCacheItem(cacheKey, xhr.responseText);
          AppStorage.setCacheItem(versionKey, SRC_VERSION);
          return xhr.responseText;
        }
      } catch(e) {}
      // Last resort: return stale cache if any
      const stale = AppStorage.getCacheItem(cacheKey);
      if (stale) return stale;
      return '';
    }

    function loadCSS() {
      // Primary: extract from loaded stylesheets in the DOM (always works)
      let css = '';
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.href && !sheet.href.includes('fonts.googleapis.com')) {
            for (const rule of sheet.cssRules) css += rule.cssText + '\n';
          }
        } catch(e) {}
      }
      if (css) return css;
      // Fallback: try cache or fetch
      const cacheKey = 'planview-src-style.css';
      const cached = AppStorage.getCacheItem(cacheKey);
      if (cached) return cached;
      return '';
    }

    const cssText = loadCSS();
    const [stateJs, utilsJs, dataJs, renderJs] = await Promise.all([
      loadSource('state.js'),
      loadSource('utils.js'),
      loadSource('data.js'),
      loadSource('render.js'),
    ]);

    if (!stateJs && !renderJs) {
      throw new Error('Could not load source files.\n\nIf you opened this page from a local file (file://), try serving it via a local web server first:\n  python -m http.server 8000\nThen open http://localhost:8000 and export from there.');
    }

    // Build selected L1 outlines for prefix matching
    const selectedOutlines = allTasks
      .filter(t => selectedL1.has(t.id) && t.depth === 1)
      .map(t => t.outline);

    // Filter tasks: must belong to a selected L1 tree AND within depth limit
    const allSerialized = serializeTasks();
    const filteredTasks = allSerialized.filter(t => {
      const outline = t.outline || '1';
      const depth = outline.split('.').length;
      // Check if task belongs to a selected L1 group
      const l1Outline = outline.split('.')[0];
      if (!selectedOutlines.includes(l1Outline)) return false;
      // Check depth limit
      if (depthVal > 0 && depth > depthVal) return false;
      return true;
    });

    const stateData = {
      tasks: filteredTasks,
      projectMeta: JSON.parse(JSON.stringify(projectMeta)),
      bucketColors: { ...BUCKET_COLORS },
      labelColors: { ...LABEL_COLORS },
      priorityColors: { ...PRIORITY_COLORS },
      milestoneInline: milestoneInline,
      showArrows: showArrows,
      currentZoom: currentZoom,
      workingDaysMode: workingDaysMode,
      splitBarsMode: splitBarsMode,
      calendars: JSON.parse(JSON.stringify(calendars)),
    };

    const projectName = projects[currentProjectId]?.name || 'Roadmap';

    // Compute actual max depth in filtered data for depth selector
    const exportMaxDepth = filteredTasks.reduce((mx, t) => {
      const d = (t.outline || '1').split('.').length;
      return d > mx ? d : mx;
    }, 1);

    const html = _buildStandaloneHTML({
      cssText, stateJs, utilsJs, dataJs, renderJs,
      stateData, projectName, taskCount: filteredTasks.length,
      exportMaxDepth, exportDepthLimit: depthVal
    });

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    const suffix = depthVal > 0 ? `_L${depthVal}` : '';
    a.download = _exportFileName() + suffix + '_interactive.html';
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    overlay.remove();
    updateSaveIndicator('HTML exported (' + filteredTasks.length + ' tasks)');
  } catch (e) {
    console.error('HTML export error:', e);
    showToast('Export failed: ' + e.message, 'error');
    btnEl.textContent = 'Export HTML';
    btnEl.disabled = false;
  }
}

function _buildStandaloneHTML({ cssText, stateJs, utilsJs, dataJs, renderJs, stateData, projectName, taskCount, exportMaxDepth, exportDepthLimit }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${_escHtml(projectName)} - Interactive Roadmap</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
${cssText}
/* --- Read-only overrides --- */
.top-bar { display: none !important; }
.toolbar .btn-icon[onclick*="addNewTask"],
.toolbar .btn-icon[onclick*="deleteSelected"],
.toolbar .btn-icon[onclick*="undoEdit"],
.toolbar .btn-icon[onclick*="exportExcel"],
.toolbar .btn-icon[onclick*="openSettings"],
.toolbar .btn-icon[onclick*="showAllTasks"],
.toolbar .save-indicator,
#btn-show-all, #btn-delete-sel, #btn-undo { display: none !important; }
.tab[data-tab="dati"] { display: none !important; }
#dati-wrapper { display: none !important; }
.edit-panel-overlay, .modal-overlay, .drop-overlay { display: none !important; }
body { padding-top: 0; }
.ro-title-bar {
  background: linear-gradient(135deg, #0F1B2D 0%, #1E3A5F 100%);
  color: #fff; padding: 0.8rem 1.5rem; font-family: 'Inter', sans-serif;
  display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
}
.ro-title-name { font-size: 1.2rem; font-weight: 700; }
.ro-title-meta { font-size: 0.75rem; opacity: 0.6; font-weight: 400; }
.toolbar { border-top: none; }
.btn-icon.btn-sm{font-size:.7rem;padding:.25rem .4rem}
.btn-icon.btn-sm svg{width:12px;height:12px}
.tl-weekend{position:absolute;top:0;height:100%;background:var(--body-fg);opacity:.03;z-index:0;pointer-events:none}
.tl-weekend-header{position:absolute;top:0;background:var(--body-fg);opacity:.04;z-index:0;pointer-events:none}
.tl-day-label{position:absolute;top:54px;font-size:.5rem;color:var(--grey-txt);white-space:nowrap;display:flex;align-items:center;justify-content:center;height:18px}
.tl-day-label.weekend{color:var(--red);opacity:.5}
.legend-bar{border-top:1px solid var(--border);background:var(--card);padding:0;overflow:hidden;max-height:0;transition:max-height .25s ease,padding .25s ease}
.legend-bar.open{max-height:200px;padding:.5rem .8rem}
.legend-content{display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-start}
.legend-section{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap}
.legend-section-title{font-weight:600;color:var(--grey-txt);text-transform:uppercase;font-size:.6rem;letter-spacing:.04em;margin-right:.2rem;white-space:nowrap}
.legend-item{display:inline-flex;align-items:center;gap:.2rem;padding:.1rem .35rem;border-radius:4px;font-size:.68rem;white-space:nowrap;color:var(--body-fg)}
.legend-item .legend-swatch{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.legend-item .legend-star{flex-shrink:0;line-height:0}
</style>
</head>
<body>

<div id="app-screen">
  <div class="ro-title-bar">
    <span class="ro-title-name">${_escHtml(projectName)}</span>
    <span class="ro-title-meta">${taskCount || stateData.tasks.length} tasks &middot; Generated ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
  <div class="toolbar" id="toolbar">
    <div class="search-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="text" id="search-input" placeholder="Search tasks..." oninput="applyFilters()">
    </div>
    <div class="sep"></div>
    <select id="filter-label" onchange="applyFilters()"><option value="">All labels</option></select>
    <select id="filter-bucket" onchange="applyFilters()"><option value="">All buckets</option></select>
    <div class="sep"></div>
    <button onclick="setZoom('month')" id="zoom-month" class="active">Month</button>
    <button onclick="setZoom('week')" id="zoom-week">Week</button>
    <button onclick="setZoom('day')" id="zoom-day">Day</button>
    <button onclick="toggleWorkingDays()" id="working-days-btn" class="btn-icon btn-sm" title="Toggle working days / calendar days">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
      <span>Working Days</span>
    </button>
    <div class="sep"></div>
    <select id="depth-select" onchange="setDepth(this.value)" title="Visible depth levels">
      ${(() => {
        let opts = '';
        const md = exportMaxDepth || 3;
        for (let d = 1; d <= md; d++) {
          const label = d === 1 ? 'Level 1' : 'Levels 1-' + d;
          opts += '<option value="' + d + '"' + (d === 1 ? ' selected' : '') + '>' + label + '</option>';
        }
        if (md > 1) opts += '<option value="0">All levels</option>';
        return opts;
      })()}
    </select>
    <button onclick="toggleMilestoneInline()" id="ms-inline-btn" class="btn-icon" title="MS inline/separate">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
      <span id="ms-inline-label">MS Inline</span>
    </button>
    <button onclick="toggleArrows()" id="arrows-btn" class="btn-icon" title="Toggle dependencies">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
      <span id="arrows-label">Hide Dependencies</span>
    </button>
    <div class="sep"></div>
    <button onclick="scrollToToday()" class="btn-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Today
    </button>
    <button onclick="toggleExpandAll()" id="expand-btn" class="btn-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l4-4 4 4M4 16l4 4 4-4"/></svg>
      <span id="expand-label">Expand all</span>
    </button>
    <button onclick="toggleLegend()" id="legend-toggle" class="btn-icon" title="Show/hide legend">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      Legend
    </button>
  </div>

  <div class="tab-bar">
    <div class="tab active" data-tab="roadmap">Roadmap</div>
  </div>

  <div class="gantt-wrapper active" id="gantt-wrapper">
    <div class="left-panel">
      <div class="left-header" id="left-header-panel">
        <div class="lh-top">
          <span style="flex:1">Tasks</span>
          <span style="font-size:.72rem;color:var(--grey-txt);font-weight:400" id="task-count"></span>
        </div>
        <div class="breadcrumb" id="breadcrumb"></div>
      </div>
      <div class="left-body" id="left-body"></div>
    </div>
    <div class="resizer" id="drag-resizer" title="Resize panel"></div>
    <div class="right-panel">
      <div class="timeline-header" id="timeline-header"></div>
      <div class="timeline-body" id="timeline-body">
        <div class="timeline-canvas" id="timeline-canvas"></div>
      </div>
    </div>
  </div>
  <div class="legend-bar" id="legend-bar">
    <div class="legend-content" id="legend-content"></div>
  </div>
</div>

<div class="tooltip" id="tooltip"></div>
<div class="edit-panel-overlay" id="edit-panel-overlay" style="display:none">
  <div class="backdrop"></div>
  <div class="edit-panel" id="edit-panel"></div>
</div>
<div class="modal-overlay" id="settings-modal" style="display:none"></div>

<script>
// === EMBEDDED DATA ===
const __EMBEDDED_DATA__ = ${JSON.stringify(stateData)};
const READ_ONLY = true;
</script>
<script>
// === STATE ===
${stateJs}
</script>
<script>
// === UTILS ===
${utilsJs}
</script>
<script>
// === DATA ===
${dataJs}
</script>
<script>
// === RENDER ===
${renderJs}
</script>
<script>
// === READ-ONLY UI (minimal) ===
${_getMinimalUICode()}
</script>
<script>
// === INIT ===
(function() {
  // Initialize DOM cache (required by all render functions)
  initDOMCache();
  // Provide no-op elements for DOM refs that don't exist in read-only mode
  const _noop = document.createElement('div');
  ['projectSelect','projectInfo','saveIndicator','settingsBody',
   'datiWrapper','dtHeader','dtBody','btnDeleteSel','btnShowAll',
   'loading','dropOverlay','fileInput'].forEach(k => {
    if (!DOM[k]) DOM[k] = _noop;
  });

  // Restore embedded state
  const d = __EMBEDDED_DATA__;
  Object.assign(BUCKET_COLORS, d.bucketColors || {});
  Object.assign(LABEL_COLORS, d.labelColors || {});
  Object.assign(PRIORITY_COLORS, d.priorityColors || {});
  milestoneInline = d.milestoneInline !== false;
  showArrows = d.showArrows !== false;
  currentZoom = d.currentZoom || 'month';
  workingDaysMode = d.workingDaysMode || false;
  splitBarsMode = d.splitBarsMode !== undefined ? d.splitBarsMode : true;
  projectMeta = d.projectMeta || {};
  if (d.calendars) { calendars = d.calendars; invalidateHolidayCache(); }

  // Deserialize tasks
  allTasks = (d.tasks || []).map(s => ({
    ...s,
    start: s.start ? new Date(s.start) : null,
    finish: s.finish ? new Date(s.finish) : null,
    children: [], parent: null, color: '#64748B',
    labels: s.labels || [], barColors: []
  }));

  // Build tree & render
  buildTree();
  if (typeof reassignColors === 'function') reassignColors();
  if (typeof computeDateRange === 'function') computeDateRange();
  if (typeof populateFilterDropdowns === 'function') populateFilterDropdowns();

  // Set button states
  const msBtn = document.getElementById('ms-inline-btn');
  if (msBtn) msBtn.classList.toggle('active', milestoneInline);
  const wdBtn = document.getElementById('working-days-btn');
  if (wdBtn) wdBtn.classList.toggle('active', workingDaysMode);
  const sbBtn = document.getElementById('split-bars-btn');
  if (sbBtn) sbBtn.classList.toggle('active', splitBarsMode);

  renderAll();

  // Scroll sync
  const lb = document.getElementById('left-body');
  const tb = document.getElementById('timeline-body');
  if (lb && tb) {
    lb.addEventListener('scroll', () => { tb.scrollTop = lb.scrollTop; });
    tb.addEventListener('scroll', () => { lb.scrollTop = tb.scrollTop; });
  }

  // Panel resizer
  const resizer = document.getElementById('drag-resizer');
  if (resizer) {
    let startX, startW;
    resizer.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startW = document.querySelector('.left-panel').offsetWidth;
      const onMove = ev => {
        const w = Math.max(120, Math.min(500, startW + ev.clientX - startX));
        document.documentElement.style.setProperty('--panel-w', w + 'px');
        renderTimeline();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // Zoom with Ctrl+Wheel
  document.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const zooms = ['month', 'week', 'day'];
    const idx = zooms.indexOf(currentZoom);
    const next = e.deltaY > 0 ? Math.max(0, idx - 1) : Math.min(2, idx + 1);
    if (next !== idx) setZoom(zooms[next]);
  }, { passive: false });

  // Window resize
  window.addEventListener('resize', () => { clearTimeout(window._rr); window._rr = setTimeout(() => renderAll(), 200); });
})();
</script>
</body>
</html>`;
}

function _getMinimalUICode() {
  // Minimal UI functions needed for the standalone HTML
  return `
// Read-only UI stubs & navigation functions
function openEditPanel() {}
function closeEditPanel() {}
function saveEditPanel() {}
function openSettings() {}
function closeSettings() {}
function triggerFileUpload() {}
function addNewTask() {}
function loadTemplate() {}
function insertTaskBelow() {}
function openDataLabelPicker() {}
function toggleSelectAll() {}
function updateShowAllBtn() {}
function handleTaskRowClick(e, outline, taskId, hasChildren) {
  var arrow = e.target.closest('.arrow');
  if (arrow && !arrow.classList.contains('hidden')) { toggleExpand(outline); }
}
function toggleTaskVisibility(taskId) {
  if (hiddenTasks.has(taskId)) hiddenTasks.delete(taskId);
  else hiddenTasks.add(taskId);
  renderAll();
}
function handleBarClick(id, hasChildren) { if (hasChildren) navigateInto(id); }
let tooltipTimeout;
function showTooltip(e, id) {
  const task = allTasks.find(x => x.id === id);
  if (!task) return;
  clearTimeout(tooltipTimeout);
  const pct = Math.round(task.percentComplete * 100);
  let html = '<div class="tt-name" style="color:' + (task.color || '#64748B') + '">' + esc(task.name) + '</div>';
  html += '<div class="tt-row"><span class="tt-label">Start:</span><span>' + (task.start ? fmtDate(task.start) : '—') + '</span></div>';
  html += '<div class="tt-row"><span class="tt-label">End:</span><span>' + (task.finish ? fmtDate(task.finish) : '—') + '</span></div>';
  html += '<div class="tt-row"><span class="tt-label">Duration:</span><span>' + (task.duration || '—') + '</span></div>';
  html += '<div class="tt-row"><span class="tt-label">Complete:</span><span>' + pct + '%</span></div>';
  html += '<div class="tt-progress"><div class="fill" style="width:' + pct + '%;background:' + (task.color || '#64748B') + '"></div></div>';
  if (task.labels && task.labels.length) {
    html += '<div class="tt-tags">';
    task.labels.forEach(function(l) {
      var c = LABEL_COLORS[l] || '#64748B';
      html += '<span class="tt-tag" style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44">' + esc(l) + '</span>';
    });
    html += '</div>';
  }
  if (task.bucket) html += '<div class="tt-row" style="margin-top:.3rem"><span class="tt-label">Bucket:</span><span>' + esc(task.bucket) + '</span></div>';
  if (task.priority) html += '<div class="tt-row"><span class="tt-label">Priority:</span><span>' + esc(task.priority) + '</span></div>';
  if (task.dependsOn) html += '<div class="tt-row"><span class="tt-label">Depends on:</span><span>' + esc(task.dependsOn) + '</span></div>';
  DOM.tooltip.innerHTML = html;
  DOM.tooltip.classList.add('visible');
  moveTooltip(e);
}
function moveTooltip(e) {
  var x = e.clientX + 12, y = e.clientY + 12;
  var rect = DOM.tooltip.getBoundingClientRect();
  if (x + 320 > window.innerWidth) x = e.clientX - 320;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 8;
  DOM.tooltip.style.left = x + 'px';
  DOM.tooltip.style.top = y + 'px';
}
function hideTooltip() {
  tooltipTimeout = setTimeout(function() { DOM.tooltip.classList.remove('visible'); }, 100);
}

function navigateInto(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task || !task.children || task.children.length === 0) return;
  navStack.push({ taskId: task.id, label: task.name });
  renderAll();
}
function navigateBack() {
  if (navStack.length > 0) { navStack.pop(); renderAll(); }
}
function navigateToLevel(idx) {
  navStack.length = idx;
  renderAll();
}
function getCurrentScope() {
  if (navStack.length === 0) return taskTree;
  const last = navStack[navStack.length - 1];
  const t = allTasks.find(x => x.id === last.taskId);
  return t ? (t.filteredChildren || t.children) : taskTree;
}
// countWorkingDays and isWeekend are provided by utils.js (calendar-aware)
function _smartDatePadding(dMin, dMax) {
  var mn = new Date(dMin), mx = new Date(dMax);
  if (currentZoom === 'day') {
    mn.setTime(mn.getTime() - 2 * 86400000);
    mx.setTime(mx.getTime() + 3 * 86400000);
  } else if (currentZoom === 'week') {
    var dow = mn.getDay() || 7;
    mn.setDate(mn.getDate() - dow + 1);
    var dowEnd = mx.getDay() || 7;
    mx.setDate(mx.getDate() + (7 - dowEnd) + 7);
  } else {
    mn.setDate(1);
    mx.setTime(mx.getTime() + 14 * 86400000);
  }
  return { min: mn, max: mx };
}
function getScopeDateRange(scope) {
  let mn = Infinity, mx = -Infinity;
  function walk(nodes) {
    nodes.forEach(t => {
      if (t.start && t.start.getTime() < mn) mn = t.start.getTime();
      if (t.finish && t.finish.getTime() > mx) mx = t.finish.getTime();
      if (t.start && !t.finish && t.start.getTime() > mx) mx = t.start.getTime();
      const ch = t.filteredChildren || t.children;
      if (ch && ch.length) walk(ch);
    });
  }
  walk(scope);
  if (mn === Infinity) return null;
  return _smartDatePadding(mn, mx);
}

function setZoom(z) {
  currentZoom = z;
  document.querySelectorAll('[id^="zoom-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('zoom-' + z);
  if (btn) btn.classList.add('active');
  renderTimeline();
}
function setDepth(v) {
  getState().visibleDepth = parseInt(v) || 1;
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  renderAll();
}
function toggleExpand(outline) {
  const st = getState();
  const maxDepth = st.visibleDepth === 0 ? 999 : st.visibleDepth;
  const t = allTasks.find(x => x.outline === outline);
  if (!t) return;
  const depthLevel = (outline.split('.').length - 1);
  const depthAllows = depthLevel + 1 < maxDepth;
  if (depthAllows) {
    if (st.collapsedSet.has(outline)) st.collapsedSet.delete(outline);
    else st.collapsedSet.add(outline);
  } else {
    if (st.expandedSet.has(outline)) st.expandedSet.delete(outline);
    else st.expandedSet.add(outline);
  }
  renderAll();
}
function toggleExpandAll() {
  const st = getState();
  if (!st.allExpanded) {
    st.visibleDepth = 0;
    st.collapsedSet.clear();
    st.expandedSet.clear();
    st.allExpanded = true;
    document.getElementById('expand-label').textContent = 'Collapse all';
  } else {
    st.collapsedSet.clear();
    st.expandedSet.clear();
    allTasks.forEach(t => { if (t.children.length > 0) st.collapsedSet.add(t.outline); });
    st.allExpanded = false;
    document.getElementById('expand-label').textContent = 'Expand all';
  }
  renderAll();
}
function toggleMilestoneInline() {
  milestoneInline = !milestoneInline;
  const btn = document.getElementById('ms-inline-btn');
  if (btn) btn.classList.toggle('active', milestoneInline);
  const lbl = document.getElementById('ms-inline-label');
  if (lbl) lbl.textContent = milestoneInline ? 'MS Inline' : 'MS Separate';
  renderAll();
}
function toggleArrows() {
  showArrows = !showArrows;
  const lbl = document.getElementById('arrows-label');
  if (lbl) lbl.textContent = showArrows ? 'Hide Dependencies' : 'Show Dependencies';
  renderAll();
}
function toggleWorkingDays() {
  workingDaysMode = !workingDaysMode;
  var btn = document.getElementById('working-days-btn');
  if (btn) btn.classList.toggle('active', workingDaysMode);
  var defaultCalId = typeof getDefaultCalendarId === 'function' ? getDefaultCalendarId() : null;
  allTasks.forEach(function(t) {
    if (t.start && t.finish) {
      var days;
      if (workingDaysMode) {
        var calId = t.calendarId || defaultCalId;
        days = countWorkingDays(t.start, t.finish, calId);
        if (t.isMilestone) days = 0;
      } else {
        var raw = Math.round((t.finish - t.start) / 86400000);
        days = raw === 0 ? (t.isMilestone ? 0 : 1) : raw;
      }
      t.duration = days + (days === 1 ? ' day' : ' days');
    }
  });
  renderAll();
}
function scrollToToday() {
  const tb = document.getElementById('timeline-body');
  const tl = document.querySelector('.tl-today');
  if (tb && tl) tb.scrollLeft = tl.offsetLeft - tb.clientWidth / 2;
}
function syncScroll() {
  const lb = document.getElementById('left-body');
  const tb = document.getElementById('timeline-body');
  if (lb && tb) { tb.scrollTop = lb.scrollTop; }
}
function filterTree(scope) { return scope; }
function applyFilters() {
  const s = document.getElementById('search-input')?.value?.toLowerCase() || '';
  const l = document.getElementById('filter-label')?.value || '';
  const b = document.getElementById('filter-bucket')?.value || '';
  getState().filters = { search: s, label: l, bucket: b };
  renderAll();
}
function switchTab() {}
function renderDataTable() {}
function scheduleSave() {}
function snapshotUndo() {}

// Legend
var legendOpen = false;
function toggleLegend() {
  legendOpen = !legendOpen;
  var bar = document.getElementById('legend-bar');
  var btn = document.getElementById('legend-toggle');
  if (!bar || !btn) return;
  if (legendOpen) {
    renderLegend();
    bar.classList.add('open');
    btn.classList.add('active');
  } else {
    bar.classList.remove('open');
    btn.classList.remove('active');
  }
}
function renderLegend() {
  var container = document.getElementById('legend-content');
  if (!container) return;
  var html = '';
  var labelEntries = Object.entries(LABEL_COLORS);
  if (labelEntries.length > 0) {
    html += '<div class="legend-section"><span class="legend-section-title">Labels:</span>';
    labelEntries.forEach(function(e) {
      html += '<span class="legend-item"><span class="legend-swatch" style="background:' + e[1] + '"></span>' + esc(e[0]) + '</span>';
    });
    html += '</div>';
  }
  var bucketEntries = Object.entries(BUCKET_COLORS);
  if (bucketEntries.length > 0) {
    html += '<div class="legend-section"><span class="legend-section-title">Buckets:</span>';
    bucketEntries.forEach(function(e) {
      html += '<span class="legend-item"><span class="legend-swatch" style="background:' + e[1] + '"></span>' + esc(e[0]) + '</span>';
    });
    html += '</div>';
  }
  html += '<div class="legend-section"><span class="legend-section-title">Milestones:</span>';
  PRIORITY_OPTIONS.forEach(function(p) {
    var c = PRIORITY_COLORS[p] || '#64748B';
    html += '<span class="legend-item"><span class="legend-star">' + starSVG(10, c) + '</span>' + esc(p) + '</span>';
  });
  html += '</div>';
  container.innerHTML = html;
}
`;
}


/* ====================================================================
   HELPERS
   ==================================================================== */

function _exportFileName() {
  return (projects[currentProjectId]?.name || 'Gantt-Roadmap')
    .replace(/[^a-zA-Z0-9_\- ]/g, '_');
}

function _escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
