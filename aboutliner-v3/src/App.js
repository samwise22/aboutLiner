import React, { useState, useRef, useEffect } from 'react';
// tagging test
import logo from './aboutliner rectangle.png';

const parseImportText = (text) => {
  const lines = text.split('\n');
  const rowsArr = [];
  let current = null;
  for (const line of lines) {
    // Detect level-1 bullets (*) or -
    const lvl1 = line.match(/^([*-])\s+(.*)/);
    // Detect level-2 bullets with indentation
    const lvl2 = line.match(/^\s+[-*]\s+(.*)/);
    if (lvl1) {
      // Push previous top-level if exists
      if (current) rowsArr.push(current);
      // Parse optional title:value
      const raw = lvl1[2].trim();
      const idx = raw.indexOf(':');
      let title = '', value = raw;
      if (idx >= 0) {
        title = raw.slice(0, idx).trim();
        value = raw.slice(idx + 1).trim();
      }
      current = { title, value, subs: [] };
    } else if (lvl2 && current) {
      const raw = lvl2[1].trim();
      const idx = raw.indexOf(':');
      let subTitle = '', subValue = raw;
      if (idx >= 0) {
        subTitle = raw.slice(0, idx).trim();
        subValue = raw.slice(idx + 1).trim();
      }
      current.subs.push({ title: subTitle, value: subValue });
    }
  }
  // Push last group
  if (current) rowsArr.push(current);
  if (rowsArr.length === 0) return null;
  // Normalize sub-count to max across all bullets
  const maxSubCount = rowsArr.reduce((max, r) => Math.max(max, r.subs.length), 0);
  rowsArr.forEach(r => {
    while (r.subs.length < maxSubCount) {
      r.subs.push({ title: '', value: '' });
    }
  });
  // Build rows and columns
  const columns = maxSubCount + 1;
  const rows = rowsArr.map(r => {
    const row = [{ name: r.title, value: r.value }];
    r.subs.forEach(sub => row.push({ name: sub.title, value: sub.value }));
    return row;
  });
  return { columns, rows };
};

export default function App() {
  // Hues for level-2 column header pills
  const columnHues = [0, 60, 120, 240, 300]; // adjust length as needed
  // Hues for group-header pills (non-overlapping)
  const groupHues = [180, 210]; // one per group
  // Proof‑of‑concept section definitions
  const [rowSections, setRowSections] = useState([
    { name: 'Section 1', start: 0, end: 1 },
    { name: 'Section 2', start: 2, end: 3 }
  ]);
  const [colSections, setColSections] = useState([
    { name: 'Group A', start: 1, end: 2 },
    { name: 'Group B', start: 3, end: 4 }
  ]);
  const [columns, setColumns] = useState(5);
  const [rows, setRows] = useState([
    [ { name: '', value: 'R1' }, { name: '', value: 'A1' }, { name: '', value: 'A2' }, { name: '', value: 'B1' }, { name: '', value: 'B2' } ],
    [ { name: '', value: 'R2' }, { name: '', value: 'A3' }, { name: '', value: 'A4' }, { name: '', value: 'B3' }, { name: '', value: 'B4' } ],
    [ { name: '', value: 'R3' }, { name: '', value: 'A5' }, { name: '', value: 'A6' }, { name: '', value: 'B5' }, { name: '', value: 'B6' } ],
    [ { name: '', value: 'R4' }, { name: '', value: 'A7' }, { name: '', value: 'A8' }, { name: '', value: 'B7' }, { name: '', value: 'B8' } ]
  ]);
  const [editingCell, setEditingCell] = useState(null); // key = `${rowIndex}-${colIndex}`
  const inputRefs = useRef({}); // keys: `${rowIndex}-${colIndex}`
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const pendingDeleteTimer = useRef(null);
  // Two-step deletion for sub-bullet columns
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);

  const [showTextMode, setShowTextMode] = useState(false);

  // Build TSV by walking the rendered HTML table (fallback export)
  const buildTSVFromTableDOM = () => {
    const table = document.querySelector('.table-panel table');
    if (!table) return '';
    const rowsEls = Array.from(table.querySelectorAll('tr'));
    const matrix = [];
    rowsEls.forEach((tr, r) => {
      if (!matrix[r]) matrix[r] = [];
      let c = 0;
      Array.from(tr.children).forEach(cell => {
        // skip occupied slots
        while (matrix[r][c] !== undefined) c++;
        const text = cell.textContent.trim();
        const colSpan = parseInt(cell.getAttribute('colspan') || '1', 10);
        const rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        for (let dr = 0; dr < rowSpan; dr++) {
          for (let dc = 0; dc < colSpan; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (!matrix[rr]) matrix[rr] = [];
            matrix[rr][cc] = (dr === 0 && dc === 0) ? text : '';
          }
        }
        c += colSpan;
      });
    });
    return matrix.map(r => r.join('\t')).join('\n');
  };

  const [showClearModal, setShowClearModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [tableCopied, setTableCopied] = useState(false);
  // Toggle whether to use merged cells in HTML export
  const [useMergedCells, setUseMergedCells] = useState(true);
  // Currently-hovered row section name for highlighting
  const [hoveredSection, setHoveredSection] = useState(null);
  // Currently-hovered column section name for highlighting
  const [hoveredColSection, setHoveredColSection] = useState(null);
  // Currently-hovered individual column index for highlighting
  const [hoveredColIndex, setHoveredColIndex] = useState(null);
  const liRefs = useRef([]);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const colRefs = useRef([]);
  // refs for individual column-header pills and group pills
  const headerPillRefs = useRef([]);
  const groupPillRefs = useRef([]);

  // Helper to strip headers from export/import text
  const stripHeaders = (text) => {
    return text.split('\n').map(line => {
      // Top-level bullet
      const lvl1 = line.match(/^([*-]\s*)([^:]+):(.*)$/);
      if (lvl1) return `${lvl1[1]}${lvl1[3]}`;
      // Sub-bullet
      const lvl2 = line.match(/^(\s+[-*]\s*)([^:]+):(.*)$/);
      if (lvl2) return `${lvl2[1]}${lvl2[3]}`;
      return line;
    }).join('\n');
  };

  const handleClear = () => {
    // Reset to a single empty top-level row
    setColumns(1);
    setRows([[{ name: '', value: '' }]]);
    setShowClearModal(false);
  };

  const getExportText = () => {
    const lines = [];
    rows.forEach(row => {
      const [first, ...subs] = row;
      const topText = first.name
        ? `${first.name}:${first.value}`
        : `${first.value}`;
      lines.push(`* ${topText}`);
      subs.forEach(cell => {
        const subText = cell.name
          ? `${cell.name}:${cell.value}`
          : `${cell.value}`;
        lines.push(`  - ${subText}`);
      });
    });
    return lines.join('\n');
  };

  useEffect(() => {
    if (showTextMode) {
      // If document is initially empty, allow typing; otherwise load export text
      if (rows.length === 1 && columns === 1 && rows[0][0].value === '') {
        setImportText('');
      } else {
        setImportText(getExportText());
      }
    }
  }, [showTextMode, rows, columns]);

  const handleCopy = () => {
    const textToCopy = includeHeaders ? importText : stripHeaders(importText);
    navigator.clipboard.writeText(textToCopy);
  };

  // Generate markdown table from current rows and columns
  const getTableMarkdown = () => {
    // Headers from column names
    const headers = rows[0].map((cell, idx) =>
      cell.name || (idx === 0 ? 'Title' : `Column ${idx}`)
    );
    // Separator row
    const separator = headers.map(() => '---');
    // Body rows values
    const bodyRows = rows.map(row => row.map(cell => cell.value || ''));
    // Build markdown lines
    const lines = [];
    lines.push(`| ${headers.join(' | ')} |`);
    lines.push(`| ${separator.join(' | ')} |`);
    bodyRows.forEach(r => lines.push(`| ${r.join(' | ')} |`));
    return lines.join('\n');
  };

  // Build a 2D matrix of cell texts from the rendered table, respecting spans
  const buildMatrixFromTableDOM = () => {
    const table = document.querySelector('.table-panel table');
    if (!table) return [];
    const rowsEls = Array.from(table.querySelectorAll('tr'));
    const matrix = [];
    rowsEls.forEach((tr, r) => {
      if (!matrix[r]) matrix[r] = [];
      let c = 0;
      Array.from(tr.children).forEach(cell => {
        while (matrix[r][c] !== undefined) c++;
        const text = cell.textContent.trim();
        const colSpan = parseInt(cell.getAttribute('colspan') || '1', 10);
        const rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10);
        for (let dr = 0; dr < rowSpan; dr++) {
          for (let dc = 0; dc < colSpan; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (!matrix[rr]) matrix[rr] = [];
            matrix[rr][cc] = (dr === 0 && dc === 0) ? text : '';
          }
        }
        c += colSpan;
      });
    });
    return matrix;
  };

  // Copy the table to clipboard as HTML (merged or unmerged based on toggle)
  const handleCopyTable = async () => {
    const tableEl = document.querySelector('.table-panel table');
    let html = '';
    if (useMergedCells) {
      html = tableEl ? tableEl.outerHTML : '';
    } else {
      // Build unmerged HTML from the cell matrix
      const matrix = buildMatrixFromTableDOM();
      html = '<table>';
      matrix.forEach(row => {
        html += '<tr>';
        row.forEach(cellText => {
          html += `<td>${cellText}</td>`;
        });
        html += '</tr>';
      });
      html += '</table>';
    }
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' })
          })
        ]);
      } catch {
        await navigator.clipboard.writeText(html);
      }
    } else {
      await navigator.clipboard.writeText(html);
    }
    setTableCopied(true);
    setTimeout(() => setTableCopied(false), 3000);
  };

  // Copy only HTML to clipboard
  const handleCopyHTML = async () => {
    const tableEl = document.querySelector('.table-panel table');
    const html = tableEl ? tableEl.outerHTML : '';
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' })
          })
        ]);
      } catch {
        // fallback not needed
      }
    } else {
      // fallback: cannot write HTML only
      await navigator.clipboard.writeText(html);
    }
    setTableCopied(true);
    setTimeout(() => setTableCopied(false), 3000);
  };

  // Copy only TSV to clipboard
  const handleCopyTSV = async () => {
    const tsv = buildTSVFromTableDOM();
    await navigator.clipboard.writeText(tsv);
    setTableCopied(true);
    setTimeout(() => setTableCopied(false), 3000);
  };
  const pendingDeleteColTimer = useRef(null);

  // Helper to focus an input by row and column index and field
  const focusInput = (rowIndex, colIndex, field = 'value') => {
    const key = `${rowIndex}-${colIndex}-${field}`;
    const input = inputRefs.current[key];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  // On initial load, focus the first row label input
  useEffect(() => {
    focusInput(0, 0, 'value');
  }, []);

  // Insert a new row below the given rowIndex
  const insertRow = (rowIndex) => {
    // Build a new row that inherits column names
    const headerRow = rows[0] || [];
    const newRow = headerRow.map((cell, c) => ({
      name: cell.name,    // inherit name for every column
      value: ''           // empty value
    }));
    setRows((prevRows) => {
      const newRows = [...prevRows];
      newRows.splice(rowIndex + 1, 0, newRow);
      return newRows;
    });

    // Extend only the containing section and shift only later sections
    setRowSections(prev => {
      // Find index of the section that contains the insertion point
      const idx = prev.findIndex(sec => sec.start <= rowIndex && sec.end >= rowIndex);
      const newSecs = prev.map((sec, i) => {
        if (i === idx) {
          return { ...sec, end: sec.end + 1 };
        } else if (i > idx) {
          return { ...sec, start: sec.start + 1, end: sec.end + 1 };
        }
        return sec;
      });
      console.log('Updated rowSections after insertRow:', newSecs);
      return newSecs;
    });
    // We'll focus in the onUpdate or after insert
  };

  // Update a single cell field (name or value), with column name propagation
  const updateCell = (rowIndex, colIndex, field, value) => {
    setRows((prevRows) => {
      // If editing a column name, sync across all rows
      if (field === 'name') {
        return prevRows.map((row) =>
          row.map((cell, c) =>
            c === colIndex
              ? { ...cell, name: value }
              : cell
          )
        );
      }
      // Otherwise, only update the single cell value
      return prevRows.map((row, r) =>
        r === rowIndex
          ? row.map((cell, c) =>
              c === colIndex
                ? { ...cell, [field]: value }
                : cell
            )
          : row
      );
    });
  };

  // Check if all rows have last cell empty (value empty)
  const allLastCellsEmpty = () => {
    return rows.every((row) => row[columns - 1].value === '');
  };

  // Handle key down for inputs
  const handleKeyDown = (e, rowIndex, colIndex) => {
    // Arrow navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Build flat list of all positions (rowIndex, colIndex)
      const flat = [];
      rows.forEach((row, r) => {
        flat.push({ r, c: 0 });
        for (let c = 1; c < columns; c++) {
          flat.push({ r, c });
        }
      });
      // Find current pos
      const currentIdx = flat.findIndex(pos => pos.r === rowIndex && pos.c === colIndex);
      if (e.shiftKey) {
        // Move between rows at same column
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const targetRow = rowIndex + delta;
        if (targetRow >= 0 && targetRow < rows.length) {
          focusInput(targetRow, colIndex);
        }
      } else {
        // Move through flat list
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const target = currentIdx + delta;
        if (target >= 0 && target < flat.length) {
          focusInput(flat[target].r, flat[target].c, 'value');
        }
      }
      return;
    }
    if (e.key === 'Enter') {
      if (colIndex > 0 && rows[rowIndex][colIndex].value === '') {
        e.preventDefault();
        // If name box has text, move focus to value box instead of outdenting
        if (rows[rowIndex][colIndex].name !== '') {
          focusInput(rowIndex, colIndex, 'value');
          return;
        }
        // If any other row in this column has data, create next sub-bullet (column)
        const columnHasData = rows.some((r, idx) => idx !== rowIndex && r[colIndex].value !== '');
        if (columnHasData) {
          // Add new column
          setColumns(prev => prev + 1);
          setRows(prevRows => prevRows.map(r => [...r, { name: '', value: '' }]));
          setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
          return;
        }
        // Otherwise, outdent this empty sub-bullet into a new top-level row
        const newColumns = columns - 1;
        setColumns(newColumns);
        setRows(prevRows => {
          const newRows = prevRows.map(row => {
            const nr = [...row];
            nr.splice(colIndex, 1);
            return nr;
          });
          // Capture and trim current column names from header row to new length
          const headerNames = prevRows[0]
            .map(cell => cell.name)
            .slice(0, newColumns);
          // Promote the sub-bullet label (which is empty here) to a new row label
          const parentLabel = prevRows[rowIndex][colIndex];
          // Build the promoted row with inherited names
          const promotedRow = headerNames.map((colName, idx) => ({
            name: colName,
            value: idx === 0 ? parentLabel.value : ''
          }));
          newRows.splice(rowIndex + 1, 0, promotedRow);
          return newRows;
        });
        setTimeout(() => focusInput(rowIndex + 1, 0), 0);
        return;
      } else if (colIndex > 0 && rows[rowIndex][colIndex].value !== '') {
        e.preventDefault();
        // Add a new sub-bullet column
        setColumns(prev => prev + 1);
        setRows(prevRows => prevRows.map(r => [...r, { name: '', value: '' }]));
        setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
        return;
      }
      e.preventDefault();
      if (colIndex === 0) {
        // In row label: insert new row
        insertRow(rowIndex);
        setTimeout(() => focusInput(rowIndex + 1, 0), 0);
      } else {
        // In sub-bullet cell: create or move to next sub-bullet
        if (colIndex === columns - 1) {
          // Add new column
          setColumns(prev => prev + 1);
          setRows(prevRows =>
            prevRows.map((row, r) => {
              const newRow = [...row, { name: '', value: '' }];
              return newRow;
            })
          );
          setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
        } else {
          // Move to next sub-bullet
          focusInput(rowIndex, colIndex + 1);
        }
      }
    } else if (e.key === 'Tab') {
      // Indent row label into sub-bullet of previous row
      if (!e.shiftKey && colIndex === 0) {
        e.preventDefault();
        // Indent row into a sub-bullet of the previous row
        if (rowIndex > 0) {
          const newRows = [...rows];
          const [movedRow] = newRows.splice(rowIndex, 1);
          // Ensure at least 2 columns
          if (columns === 1) {
            setColumns(2);
            // Add empty cell to existing rows
            newRows.forEach(r => r.push({ name: '', value: '' }));
            movedRow.push({ name: '', value: '' });
          }
          // Insert movedRow[0].value into previous row's first sub-cell value, name empty
          newRows[rowIndex - 1][1] = { name: '', value: movedRow[0].value };
          setRows(newRows);
          // Focus the new sub-bullet cell
          setTimeout(() => focusInput(rowIndex - 1, 1, 'name'), 0);
        }
        return;
      }
      e.preventDefault();
      if (!e.shiftKey) {
        // Tab forward
        if (colIndex === columns - 1) {
          // Add new column
          setColumns((prev) => prev + 1);
          setRows((prevRows) =>
            prevRows.map((row) => {
              const newRow = [...row];
              newRow.push({ name: '', value: '' });
              return newRow;
            })
          );
          setTimeout(() => focusInput(rowIndex, columns, 'name'), 0);
        } else {
          // Move focus right
          focusInput(rowIndex, colIndex + 1);
        }
      } else {
        // Shift+Tab backward
        if (colIndex === 1) {
          // Move focus to row label input
          focusInput(rowIndex, 0);
        } else if (colIndex > 1) {
          focusInput(rowIndex, colIndex - 1);
        }
      }
    } else if (e.key === 'Backspace') {
      // Only handle if in last column and cell is empty
      if (
        colIndex === columns - 1 &&
        e.target.value === '' &&
        allLastCellsEmpty() &&
        columns > 1
      ) {
        e.preventDefault();
        // Remove last column
        setColumns((prev) => prev - 1);
        setRows((prevRows) =>
          prevRows.map((row) => {
            const newRow = row.slice(0, -1);
            return newRow;
          })
        );
        setTimeout(() => focusInput(rowIndex, columns - 2), 0);
      }
    }
  };

  // Render outline <ul>
  // Each top-level <li> has input for row label (col 0)
  // If columns > 1, nested <ul> with inputs for sub-cells (col 1..)
  // Reorder mode state
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderAxis, setReorderAxis] = useState('rows');

  // Drag-to-reorder handlers
  const handleDragStart = (e, index) => {
    e.preventDefault();
    setDraggingIndex(index);
    setDragOverIndex(index);
  };

  const handleDragMove = (e) => {
    if (draggingIndex === null) return;
    const y = e.clientY;
    let newOver = null;
    // Choose refs based on axis
    const refs = reorderAxis === 'rows' ? liRefs.current : colRefs.current;
    const count = reorderAxis === 'rows' ? rows.length : rows[0].length - 1;
    refs.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (y < rect.top + rect.height / 2 && newOver === null) {
        newOver = i;
      }
    });
    if (newOver === null) newOver = count;
    if (newOver !== dragOverIndex) setDragOverIndex(newOver);
  };

  const handleDragEnd = () => {
    if (draggingIndex !== null && dragOverIndex !== null) {
      const insertAt = dragOverIndex > draggingIndex
        ? dragOverIndex - 1
        : dragOverIndex;
      if (reorderAxis === 'rows') {
        // Reorder rows (unchanged)
        const newRows = [...rows];
        const [moved] = newRows.splice(draggingIndex, 1);
        newRows.splice(insertAt, 0, moved);
        setRows(newRows);
      } else {
        // Reorder sub-bullet columns, preserving column 1
        const sourceFullIndex = draggingIndex + 1;
        // Desired insertion before slice index dragOverIndex => full index = dragOverIndex + 1
        let destFullIndex = dragOverIndex + 1;
        // If moving downwards, removal shifts target left by 1
        if (destFullIndex > sourceFullIndex) {
          destFullIndex--;
        }
        const newRows = rows.map(row => {
          const copy = [...row];
          const [moved] = copy.splice(sourceFullIndex, 1);
          copy.splice(destFullIndex, 0, moved);
          return copy;
        });
        setRows(newRows);
      }
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="app-container" style={{ position: 'relative', paddingTop: 80 }}>
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <img src={logo} alt="aboutLiner logo" style={{ height: 56, pointerEvents: 'none' }} />
      </div>
      <div
        className={`outline-panel${showTextMode ? ' export-mode' : ''}${reorderMode ? ' reorder-mode' : ''}`}
        style={{
          position: 'relative',
          paddingTop: showTextMode
            ? '35px'
            : reorderMode
              ? '40px'  // additional space for rows/columns toggle
              : '16px'
        }}
        onMouseMove={reorderMode ? handleDragMove : undefined}
        onMouseUp={reorderMode ? handleDragEnd : undefined}
      >
        <button
          onClick={() => {
            if (showTextMode) {
              // exiting text mode
              if (importText.trim() === '') {
                // no input to parse: just exit text mode
                setShowTextMode(false);
                setShowInvalidModal(false);
              } else {
                // attempt to parse non-empty text
                const result = parseImportText(importText);
                if (result) {
                  setColumns(result.columns);
                  setRows(result.rows);
                  setShowTextMode(false);
                  setShowInvalidModal(false);
                } else {
                  // invalid format: stay in text mode and show modal
                  setShowInvalidModal(true);
                }
              }
            } else {
              setShowTextMode(true);
            }
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          {'</>'}
        </button>
        {/* Reorder mode toggle */}
        {!showTextMode && (
          <button
            onClick={() => setReorderMode(!reorderMode)}
            style={{
              position: 'absolute',
              top: 8,
              right: 35,
              padding: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', color: '#000' }}
            >
              swap_vert
            </span>
          </button>
        )}
        {/* Axis toggle for reordering */}
        {reorderMode && !showTextMode && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              border: '1px solid #ccc',
              borderRadius: 4,
              overflow: 'hidden',
              fontSize: '0.8em',
              marginBottom: '4px'
            }}
          >
            <button
              onClick={() => setReorderAxis('rows')}
              style={{
                padding: '4px 8px',
                background: reorderAxis === 'rows' ? '#4d90fe' : '#fff',
                color: reorderAxis === 'rows' ? '#fff' : '#000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Rows
            </button>
            <button
              onClick={() => setReorderAxis('columns')}
              style={{
                padding: '4px 8px',
                background: reorderAxis === 'columns' ? '#4d90fe' : '#fff',
                color: reorderAxis === 'columns' ? '#fff' : '#000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Columns
            </button>
          </div>
        )}
        {showTextMode ? (
          <>
            <textarea
              readOnly={!(rows.length === 1 && columns === 1 && rows[0][0].value === '')}
              value={includeHeaders ? importText : stripHeaders(importText)}
              onChange={e => setImportText(e.target.value)}
              style={{ width: '100%', height: 'calc(100% - 40px)', boxSizing: 'border-box' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8
              }}
            >
              <div>
                <button className="btn btn-primary" onClick={handleCopy}>
                  Copy
                </button>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 8 }}
                  onClick={() => setShowClearModal(true)}
                >
                  Clear
                </button>
              </div>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.8em',
                  color: '#666',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  userSelect: 'none'
                }}
              >
                Include Headers
                <input
                  type="checkbox"
                  checked={includeHeaders}
                  onChange={() => setIncludeHeaders(!includeHeaders)}
                  style={{ marginLeft: 4 }}
                />
              </label>
            </div>
            {showClearModal && (
              <div style={{
                position: 'fixed', top: 0, left: 0,
                width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  background: '#fff', padding: 24,
                  borderRadius: 8, maxWidth: 400,
                  textAlign: 'center'
                }}>
                  <p>This will delete all data, are you sure?</p>
                  <button className="btn btn-primary" style={{ marginRight: 8 }} onClick={() => setShowClearModal(false)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleClear}>Confirm</button>
                </div>
              </div>
            )}
            {showInvalidModal && (
              <div style={{
                position: 'fixed', top: 0, left: 0,
                width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  background: '#fff', padding: 24,
                  borderRadius: 8, maxWidth: 400,
                  textAlign: 'center'
                }}>
                  <p>Invalid format</p>
                  <button className="btn btn-primary" onClick={() => setShowInvalidModal(false)}>Ok</button>
                </div>
              </div>
            )}
          </>
        ) : (
          reorderMode && reorderAxis === 'columns' ? (
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {rows[0].slice(1).map((cell, idx) => {
                const colIndex = idx + 1;
                return (
                  <React.Fragment key={colIndex}>
                    {dragOverIndex === idx && (
                      <div className="insertion-line" />
                    )}
                    <li
                      ref={el => colRefs.current[idx] = el}
                      key={colIndex}
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
                          backgroundColor: `var(--col-color-${colIndex + 1})`,
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
              {dragOverIndex === rows[0].length - 1 && (
                <div className="insertion-line" />
              )}
            </ul>
          ) : (
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {reorderMode && dragOverIndex === rowIndex && (
                    <div className="insertion-line" />
                  )}
                  <li
                    ref={el => liRefs.current[rowIndex] = el}
                    key={rowIndex}
                    className={
                      (pendingDeleteRow === rowIndex ? 'pending-delete ' : '') +
                      (rowIndex !== 0 && rowSections.some(s => s.start === rowIndex) ? 'section-break' : '')
                    }
                    style={{
                      marginBottom: 8,
                      ...(reorderMode ? { display: 'flex', alignItems: 'center' } : {})
                    }}
                  >
                    {reorderMode && (
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
                    )}
                    {/* existing row content */}
                    <div className="sub-bullet__cell" style={{ display: 'flex', gap: '4px' }}>
                      {!reorderMode && (
                        <input
                          className="cell-name"
                          type="text"
                          placeholder="Title"
                          value={row[0].name}
                          onChange={e => updateCell(rowIndex, 0, 'name', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            if (e.key === 'Tab' && !e.shiftKey) {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            handleKeyDown(e, rowIndex, 0);
                          }}
                          ref={el => (inputRefs.current[`${rowIndex}-0-name`] = el)}
                          aria-label={`Row ${rowIndex + 1} column 1 name`}
                        />
                      )}
                      <input
                        className="cell-value"
                        type="text"
                        placeholder="Value"
                        style={{ width: reorderMode ? '200%' : '100%' }}
                        value={row[0].value}
                        onChange={e => updateCell(rowIndex, 0, 'value', e.target.value)}
                        onKeyDown={e => {
                          // Two-step deletion when sub-bullets have values
                          if (
                            e.key === 'Backspace' &&
                            row[0].value === '' &&
                            columns > 1 &&
                            rows[rowIndex].slice(1).some(cell => cell.value !== '')
                          ) {
                            e.preventDefault();
                            if (pendingDeleteRow !== rowIndex) {
                              setPendingDeleteRow(rowIndex);
                              clearTimeout(pendingDeleteTimer.current);
                              pendingDeleteTimer.current = setTimeout(() => {
                                setPendingDeleteRow(null);
                              }, 5000);
                            } else {
                              clearTimeout(pendingDeleteTimer.current);
                              setPendingDeleteRow(null);
                              setRows(prev => {
                                const copy = [...prev];
                                copy.splice(rowIndex, 1);
                                return copy;
                              });
                              setTimeout(() => focusInput(Math.max(0, rowIndex - 1), 0, 'value'), 0);
                            }
                            return;
                          }
                          // Backspace on empty level-1 with all sub-values empty => remove row
                          if (
                            e.key === 'Backspace' &&
                            row[0].value === '' &&
                            columns > 1 &&
                            rows[rowIndex].slice(1).every(cell => cell.value === '')
                          ) {
                            e.preventDefault();
                            setRows(prev => {
                              const copy = [...prev];
                              copy.splice(rowIndex, 1);
                              return copy;
                            });
                            // focus previous row's value
                            setTimeout(() => {
                              const target = Math.max(0, rowIndex - 1);
                              focusInput(target, 0, 'value');
                            }, 0);
                            return;
                          }
                          // Custom backspace: if only one column and value empty, delete row
                          if (
                            e.key === 'Backspace' &&
                            columns === 1 &&
                            row[0].value === ''
                          ) {
                            e.preventDefault();
                            if (rowIndex > 0) {
                              // Remove this row
                              setRows(prev => {
                                const copy = [...prev];
                                copy.splice(rowIndex, 1);
                                return copy;
                              });
                              // Focus previous row's value after state update
                              setTimeout(() => focusInput(rowIndex - 1, 0, 'value'), 0);
                            }
                            return;
                          }
                          // Preserve existing arrow-left reveal and other handling
                          if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                            e.preventDefault();
                            setEditingCell(`${rowIndex}-0-name`);
                            focusInput(rowIndex, 0, 'name');
                            return;
                          }
                          handleKeyDown(e, rowIndex, 0);
                        }}
                        ref={el => (inputRefs.current[`${rowIndex}-0-value`] = el)}
                        aria-label={`Row ${rowIndex + 1} column 1 value`}
                        onFocus={() => { setEditingCell(`${rowIndex}-0-value`); setPendingDeleteRow(null); clearTimeout(pendingDeleteTimer.current); }}
                      />
                    </div>
                    {!reorderMode && columns > 1 && (
                      <ul style={{ listStyleType: 'none', paddingLeft: 16, marginTop: 4 }}>
                        {row.slice(1).map((cell, colIndex) => (
                          <li
                            key={colIndex}
                            className={colIndex !== 0 && colSections.some(sec => sec.start === colIndex + 1) ? 'group-break' : ''}
                          >
                            <div
                              className={
                                'sub-bullet__cell' +
                                (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name` ? ' collapsed-name' : '') +
                                (pendingDeleteCol === colIndex ? ' pending-delete-col' : '')
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseDown={e => {
                                // Only focus when clicking the container, not its child inputs
                                if (e.target !== e.currentTarget) return;
                                e.preventDefault();
                                setEditingCell(`${rowIndex}-${colIndex + 1}-name`);
                                focusInput(rowIndex, colIndex + 1, 'name');
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Title"
                                value={row[colIndex + 1].name}
                                onChange={e => updateCell(rowIndex, colIndex + 1, 'name', e.target.value)}
                                style={{
                                  // circle when name exists and not focused; pill otherwise
                                  width: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? '16px'
                                    : '15%',
                                  height: '16px',
                                  borderRadius: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? '50%'
                                    : '999px',
                                  backgroundColor: `hsl(${columnHues[colIndex % columnHues.length]}, 50%, 80%)`,
                                  color: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? 'transparent'
                                    : '#333',
                                  overflow: 'hidden',
                                  border: 'none',
                                  padding: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`) ? '0' : '0 8px',
                                  transition: 'all 0.2s ease'
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault();
                                    focusInput(rowIndex, colIndex + 1, 'value');
                                    return;
                                  }
                                  if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
                                    e.preventDefault();
                                    focusInput(rowIndex, colIndex + 1, 'value');
                                  }
                                  handleKeyDown(e, rowIndex, colIndex + 1);
                                }}
                                ref={(el) => (inputRefs.current[`${rowIndex}-${colIndex + 1}-name`] = el)}
                                aria-label={`Row ${rowIndex + 1} column ${colIndex + 2} name`}
                                onFocus={() => setEditingCell(`${rowIndex}-${colIndex + 1}-name`)}
                                onBlur={() => setEditingCell(null)}
                              />
                              <textarea
                                placeholder="Value"
                                value={row[colIndex + 1].value}
                                onChange={e => {
                                  updateCell(rowIndex, colIndex + 1, 'value', e.target.value);
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                style={{ flex: 1, resize: 'vertical', minHeight: '1.5em', overflow: 'hidden' }}
                                rows={1}
                                onKeyDown={e => {
                                  // Two-step deletion for sub-bullets with mixed data
                                  if (
                                    e.key === 'Backspace' &&
                                    e.target.value === '' &&
                                    columns > 1 &&
                                    rows.some(r => r[colIndex + 1].value !== '')
                                  ) {
                                    e.preventDefault();
                                    if (pendingDeleteCol !== colIndex) {
                                      setPendingDeleteCol(colIndex);
                                      clearTimeout(pendingDeleteColTimer.current);
                                      pendingDeleteColTimer.current = setTimeout(() => {
                                        setPendingDeleteCol(null);
                                      }, 5000);
                                    } else {
                                      clearTimeout(pendingDeleteColTimer.current);
                                      setPendingDeleteCol(null);
                                      // remove column
                                      setColumns(prev => prev - 1);
                                      setRows(prevRows =>
                                        prevRows.map(r => {
                                          const copy = [...r];
                                          copy.splice(colIndex + 1, 1);
                                          return copy;
                                        })
                                      );
                                      // focus prior column or row label
                                      setTimeout(() => {
                                        if (colIndex > 0) {
                                          focusInput(rowIndex, colIndex, 'value');
                                        } else {
                                          focusInput(rowIndex, 0, 'value');
                                        }
                                      }, 0);
                                    }
                                    return;
                                  }
                                  // If backspace on an empty sub-cell and entire column is empty: remove that column across all rows
                                  if (
                                    e.key === 'Backspace' &&
                                    e.target.value === '' &&
                                    rows.every(r => r[colIndex + 1].value === '')
                                  ) {
                                    e.preventDefault();
                                    // remove column
                                    setColumns(prev => prev - 1);
                                    setRows(prevRows =>
                                      prevRows.map(r => {
                                        const copy = [...r];
                                        copy.splice(colIndex + 1, 1);
                                        return copy;
                                      })
                                    );
                                    // determine new focus position: same row, previous column (or level-1 if none)
                                    setTimeout(() => {
                                      if (colIndex > 0) {
                                        focusInput(rowIndex, colIndex, 'value');
                                      } else {
                                        focusInput(rowIndex, 0, 'value');
                                      }
                                    }, 0);
                                    return;
                                  }
                                  // Enter creates new column/row behavior; Shift+Enter inserts newline
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleKeyDown(e, rowIndex, colIndex + 1);
                                  }
                                  // ArrowUp/ArrowDown navigate between cells
                                  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    handleKeyDown(e, rowIndex, colIndex + 1);
                                  }
                                  // ArrowLeft at start moves focus back to name input and set editingCell
                                  else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                                    e.preventDefault();
                                    const key = `${rowIndex}-${colIndex + 1}-name`;
                                    setEditingCell(key);
                                    focusInput(rowIndex, colIndex + 1, 'name');
                                    return;
                                  }
                                }}
                                ref={el => (inputRefs.current[`${rowIndex}-${colIndex + 1}-value`] = el)}
                                aria-label={`Row ${rowIndex + 1} column ${colIndex + 2} value`}
                                onFocus={() => {
                                  setEditingCell(`${rowIndex}-${colIndex + 1}-value`);
                                  setPendingDeleteCol(null);
                                  clearTimeout(pendingDeleteColTimer.current);
                                }}
                                onBlur={() => setEditingCell(null)}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </React.Fragment>
              ))}
              {reorderMode && dragOverIndex === rows.length && (
                <div className="insertion-line" />
              )}
            </ul>
          )
        )}
      </div>
      <div
        className="table-panel"
        style={{ position: 'relative', paddingTop: '8px' }}
        onMouseLeave={() => setHoveredSection(null)}
      >
        <table className="styled-table">
          <thead>
            {/* First header row: blank for row-sections, Title header, then column groups */}
            <tr>
              <th rowSpan="2" className="styled-table__header-cell section-cell"></th>
              <th rowSpan="2" className="styled-table__header-cell section-cell" style={{ textAlign: 'left', paddingLeft: '8px' }}>
                {rows[0][0].name || 'Title'}
              </th>
              {colSections.map((sec, i) => (
                <th
                  key={i}
                  colSpan={sec.end - sec.start + 1}
                  className={
                    'styled-table__header-cell section-cell' +
                    (hoveredColSection === sec.name ? ' highlight-col' : '')
                  }
                  onMouseEnter={() => setHoveredColSection(sec.name)}
                  onMouseLeave={() => setHoveredColSection(null)}
                >
                  <span
                    className="column-group-pill"
                    ref={el => (groupPillRefs.current[i] = el)}
                    style={{ backgroundColor: `hsl(${groupHues[i % groupHues.length]}, 50%, 80%)` }}
                  >
                    {sec.name}
                  </span>
                </th>
              ))}
            </tr>
            {/* Second header row: individual column headers */}
            <tr>
              {/* skip the two left section cells */}
              {Array.from({ length: 2 }).map((_, i) => null)}
                  {rows[0].slice(1).map((cell, idx) => {
                    const colIndex = idx + 1;
                    const colSec = colSections.find(s => colIndex >= s.start && colIndex <= s.end);
                    const isColHighlighted = hoveredColSection && colSec && hoveredColSection === colSec.name;
                    return (
                      <th
                        key={idx}
                        className={
                          'styled-table__header-cell' +
                          (pendingDeleteCol === idx ? ' pending-delete-col' : '') +
                          (isColHighlighted ? ' highlight-col' : '') +
                          (hoveredColIndex === colIndex ? ' highlight-col-cell' : '')
                        }
                        onMouseEnter={() => setHoveredColIndex(colIndex)}
                        onMouseLeave={() => setHoveredColIndex(null)}
                      >
                        <span
                          ref={el => (headerPillRefs.current[idx + 1] = el)}
                          style={{
                            display: 'inline-block',
                            backgroundColor: `hsl(${columnHues[(idx) % columnHues.length]}, 50%, 80%)`,
                            padding: '4px 12px',
                            borderRadius: '999px',
                            color: '#333',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                          onMouseDown={e => { e.preventDefault(); focusInput(0, idx + 1, 'name'); }}
                          onDoubleClick={() => {
                            const key = `0-${idx + 1}-name`;
                            const input = inputRefs.current[key];
                            if (input) {
                              input.focus();
                              input.setSelectionRange(0, input.value.length);
                            }
                          }}
                        >
                          {cell.name || `Col ${idx + 1}`}
                        </span>
                      </th>
                    );
                  })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => {
              // find row section label, if any
              const sec = rowSections.find(s => rIdx >= s.start && rIdx <= s.end);
              return (
                <tr
                  key={rIdx}
                  className={hoveredSection === (sec && sec.name) ? 'highlight-section' : ''}
                >
                  {sec && rIdx === sec.start && (
                    <td
                      rowSpan={sec.end - sec.start + 1}
                      className="section-cell"
                      onMouseEnter={() => setHoveredSection(sec.name)}
                      onMouseLeave={() => setHoveredSection(null)}
                    >
                      {sec.name}
                    </td>
                  )}
                  {/* Title cell */}
                  <td
                    className="styled-table__cell"
                    onMouseDown={e => { e.preventDefault(); focusInput(rIdx, 0, 'value'); }}
                    style={{ cursor: 'pointer', textAlign: 'left', paddingLeft: '8px' }}
                  >
                    {row[0].value}
                  </td>
                  {/* Data cells */}
                  {row.slice(1).map((cell, cIdx) => {
                    const colIndex = cIdx + 1;
                    const colSec = colSections.find(s => colIndex >= s.start && colIndex <= s.end);
                    const isColHighlighted = hoveredColSection && colSec && hoveredColSection === colSec.name;
                    return (
                      <td
                        key={cIdx}
                        className={
                          'styled-table__cell' +
                          (pendingDeleteCol === cIdx ? ' pending-delete-col' : '') +
                          (isColHighlighted ? ' highlight-col' : '') +
                          (hoveredColIndex === colIndex ? ' highlight-col-cell' : '')
                        }
                        onMouseDown={e => { e.preventDefault(); focusInput(rIdx, colIndex, 'value'); }}
                        onDoubleClick={() => {
                          const key = `${rIdx}-${colIndex}-value`;
                          const input = inputRefs.current[key];
                          if (input) {
                            input.focus();
                            input.setSelectionRange(0, input.value.length);
                          }
                        }}
                      >
                        {cell.value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: '8px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.8em', color: '#333', marginRight: '8px' }}>
            <input
              type="checkbox"
              checked={useMergedCells}
              onChange={() => setUseMergedCells(!useMergedCells)}
              style={{ marginRight: '4px' }}
            />
            Use merged cells
          </label>
          <button className="btn btn-primary" onClick={handleCopyTable}>
            {tableCopied ? 'Copied!' : 'Copy Table'}
          </button>
        </div>
      </div>
    </div>
  );
}
