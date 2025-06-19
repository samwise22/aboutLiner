import React from 'react';

export default function ReorderModeUI({
  reorderAxis,
  rows,
  columns,
  dragOverIndex,
  insertionLineTop,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  liRefs,
  colRefs,
  pendingDeleteRow,
  inputRefs,
  updateCell,
  focusInput,
  setRows,
  setPendingDeleteRow,
  pendingDeleteTimer,
  setFocusedCell,
  handleKeyDown,
  rowSections = [],
  colSections = [],
  ...rest
}) {
  // Helper: get section name for a column (by col index)
  function getColSectionName(idx) {
    return rows[0][idx + 1]?.section?.sectionName || '';
  }
  // Helper: get section name for a row (by row index)
  function getRowSectionName(rowIndex) {
    return rows[rowIndex][0]?.section?.sectionName || '';
  }
  // Track section drop targets
  const [sectionDragOver, setSectionDragOver] = React.useState(null);

  // Helper: normalize all section objects in rows/columns by sectionId
  function normalizeSectionsInRows(rows) {
    // Row sections
    const rowSectionMap = new Map();
    rows.forEach(row => {
      const sec = row[0].section;
      if (sec && sec.sectionId) {
        if (!rowSectionMap.has(sec.sectionId)) rowSectionMap.set(sec.sectionId, sec);
      }
    });
    rows.forEach(row => {
      const sec = row[0].section;
      if (sec && sec.sectionId && rowSectionMap.has(sec.sectionId)) {
        row[0].section = rowSectionMap.get(sec.sectionId);
      }
    });
    // Column sections
    if (rows.length > 0) {
      const colSectionMap = new Map();
      rows[0].forEach((cell, idx) => {
        if (idx === 0) return;
        const sec = cell.section;
        if (sec && sec.sectionId) {
          if (!colSectionMap.has(sec.sectionId)) colSectionMap.set(sec.sectionId, sec);
        }
      });
      rows.forEach(row => {
        row.forEach((cell, idx) => {
          if (idx === 0) return;
          const sec = cell.section;
          if (sec && sec.sectionId && colSectionMap.has(sec.sectionId)) {
            cell.section = colSectionMap.get(sec.sectionId);
          }
        });
      });
    }
    return rows;
  }

  // --- COLUMN REORDER MODE ---
  if (reorderAxis === 'columns') {
    // Group columns by section
    const colGroups = [];
    let lastSection = null;
    let group = null;
    rows[0].slice(1).forEach((cell, idx) => {
      const section = cell.section?.sectionName || '';
      if (section !== lastSection) {
        group = { section, cols: [], startIdx: idx };
        colGroups.push(group);
        lastSection = section;
      }
      group.cols.push({ ...cell, idx });
    });
    let colIdx = 0;
    return (
      <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
        {colGroups.map((group, gIdx) => (
          <React.Fragment key={gIdx}>
            {group.section && (
              <li
                style={{ fontWeight: 600, color: '#4d90fe', margin: '8px 0 4px 0', fontSize: '0.95em', letterSpacing: '0.5px', background: sectionDragOver === `col-section-${gIdx}` ? '#e3f0ff' : undefined, transition: 'background 0.2s' }}
                onDragOver={e => { e.preventDefault(); setSectionDragOver(`col-section-${gIdx}`); }}
                onDragLeave={e => setSectionDragOver(null)}
                onDrop={e => {
                  setSectionDragOver(null);
                  if (rest.draggingIndex != null) {
                    // Always assign the section of the drop target group
                    const targetSection = group.cols[0]?.section;
                    if (!targetSection) return;
                    const fromIdx = rest.draggingIndex + 1;
                    setRows(prevRows => {
                      const newRows = prevRows.map(row => [...row]);
                      const movedCells = newRows.map(row => row.splice(fromIdx, 1)[0]);
                      // Find the insert index (after the last col in this section group)
                      const insertIdx = group.startIdx + group.cols.length + 1 - 1;
                      newRows.forEach((row, r) => {
                        row.splice(insertIdx, 0, movedCells[r]);
                        // Assign the section of the drop target group directly
                        movedCells[r].section = {
                          sectionId: targetSection.sectionId,
                          sectionName: targetSection.sectionName
                        };
                      });
                      return normalizeSectionsInRows(newRows);
                    });
                  }
                }}
              >
                <input
                  type="text"
                  value={group.section}
                  onChange={e => {
                    // Update all columns in this group to have the new section name
                    group.cols.forEach(cell => {
                      if (cell.section) cell.section.sectionName = e.target.value;
                    });
                    // Force update by calling updateCell on the first cell in the group
                    if (group.cols[0]) {
                      updateCell(0, group.startIdx + 1, 'section', { ...group.cols[0].section, sectionName: e.target.value });
                    }
                  }}
                  style={{
                    fontWeight: 600,
                    color: '#4d90fe',
                    fontSize: '0.95em',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px dashed #4d90fe',
                    outline: 'none',
                    marginBottom: 2,
                    minWidth: 60
                  }}
                  aria-label={`Edit column section name`}
                />
              </li>
            )}
            {group.cols.map((cell, idxInGroup) => {
              const idx = group.startIdx + idxInGroup;
              colIdx++;
              return (
                <React.Fragment key={idx}>
                  {dragOverIndex === idx && insertionLineTop != null && (
                    <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
                  )}
                  <li
                    ref={el => colRefs.current[idx] = el}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <span
                      className="material-symbols-outlined"
                      draggable={false}
                      onMouseDown={e => handleDragStart(e, idx)}
                      style={{
                        fontSize: '16px',
                        color: '#000',
                        marginRight: '8px',
                        cursor: 'grab'
                      }}
                    >
                      drag_indicator
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        backgroundColor: `var(--col-color-${idx + 2})`,
                        padding: '4px 12px',
                        borderRadius: '999px',
                        color: '#333'
                      }}
                    >
                      {cell.name || `Column ${idx + 1}`}
                    </span>
                  </li>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}
        {dragOverIndex === rows[0].length - 1 && insertionLineTop != null && (
          <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
        )}
      </ul>
    );
  }
  // --- ROW REORDER MODE ---
  // Group rows by section
  const rowGroups = [];
  let lastSection = null;
  let group = null;
  rows.forEach((row, rowIndex) => {
    const section = row[0].section?.sectionName || '';
    if (section !== lastSection) {
      group = { section, rows: [], startIdx: rowIndex };
      rowGroups.push(group);
      lastSection = section;
    }
    group.rows.push({ ...row, rowIndex });
  });
  let rIdx = 0;
  return (
    <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
      {rowGroups.map((group, gIdx) => (
        <React.Fragment key={gIdx}>
          {group.section && (
            <li
              style={{ fontWeight: 600, color: '#4d90fe', margin: '8px 0 4px 0', fontSize: '0.95em', letterSpacing: '0.5px', background: sectionDragOver === `row-section-${gIdx}` ? '#e3f0ff' : undefined, transition: 'background 0.2s' }}
              onDragOver={e => { e.preventDefault(); setSectionDragOver(`row-section-${gIdx}`); }}
              onDragLeave={e => setSectionDragOver(null)}
              onDrop={e => {
                setSectionDragOver(null);
                if (rest.draggingIndex != null) {
                  // Pass drop intent: at start of section
                  rest.onSectionDrop && rest.onSectionDrop({
                    draggingIndex: rest.draggingIndex,
                    targetSectionIndex: group.startIdx,
                    axis: 'rows',
                    dropAtSectionStart: true
                  });
                }
              }}
            >
              <input
                type="text"
                value={group.section}
                onChange={e => {
                  // Update all rows in this group to have the new section name
                  group.rows.forEach(row => {
                    if (row[0].section) row[0].section.sectionName = e.target.value;
                  });
                  // Force update by calling updateCell on the first row in the group
                  if (group.rows[0]) {
                    updateCell(group.startIdx, 0, 'section', { ...group.rows[0][0].section, sectionName: e.target.value });
                  }
                }}
                style={{
                  fontWeight: 600,
                  color: '#4d90fe',
                  fontSize: '0.95em',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: '1px dashed #4d90fe',
                  outline: 'none',
                  marginBottom: 2,
                  minWidth: 60
                }}
                aria-label={`Edit row section name`}
              />
            </li>
          )}
          {group.rows.map((row, idxInGroup) => {
            const rowIndex = group.startIdx + idxInGroup;
            rIdx++;
            return (
              <React.Fragment key={rowIndex}>
                {dragOverIndex === rowIndex && insertionLineTop != null && (
                  <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
                )}
                <li
                  ref={el => liRefs.current[rowIndex] = el}
                  className={pendingDeleteRow === rowIndex ? 'pending-delete' : ''}
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    draggable={false}
                    onMouseDown={e => handleDragStart(e, rowIndex)}
                    style={{
                      fontSize: '16px',
                      color: '#000',
                      marginRight: '8px',
                      cursor: 'grab'
                    }}
                  >
                    drag_indicator
                  </span>
                  <div className="sub-bullet__cell" style={{ display: 'flex', gap: '4px' }}>
                    <input
                      className="cell-value"
                      type="text"
                      placeholder="Value"
                      style={{ width: '200%' }}
                      value={row[0].value}
                      onChange={e => updateCell(rowIndex, 0, 'value', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, rowIndex, 0)}
                      ref={el => (inputRefs.current[`${rowIndex}-0-value`] = el)}
                      aria-label={`Row ${rowIndex + 1} column 1 value`}
                      onFocus={() => setFocusedCell({ row: rowIndex, col: 0 })}
                      onBlur={() => setFocusedCell({ row: null, col: null })}
                      onDoubleClick={e => e.target.select()}
                    />
                  </div>
                </li>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}
      {dragOverIndex === rows.length && insertionLineTop != null && (
        <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
      )}
      {/* Add a log in the render function to see what rows is on every render */}
      {console.log('rows in render:', rows.map(r => r[0].section))}
    </ul>
  );
}
