import React, { useState, useRef, useEffect } from 'react';
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
  // Initial simple outline seed
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState([
    [{ name: '', value: '' }]
  ]);
  const [editingCell, setEditingCell] = useState(null); // key = `${rowIndex}-${colIndex}`
  const inputRefs = useRef({}); // keys: `${rowIndex}-${colIndex}`
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const pendingDeleteTimer = useRef(null);
  // Two-step deletion for sub-bullet columns
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);

  const [showTextMode, setShowTextMode] = useState(false);

  const [showClearModal, setShowClearModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  // Disable sections/groups logic by stubbing empty arrays
  const rowSections = [];
  const colSections = [];

  // Debug: log current rows and columns on change
  useEffect(() => {
    console.log('DEBUG rows:', rows);
    console.log('DEBUG columns:', columns);
  }, [rows, columns]);
  const [tableCopied, setTableCopied] = useState(false);
  const liRefs = useRef([]);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const colRefs = useRef([]);
  // For drag-and-drop insertion line vertical position
  const [insertionLineTop, setInsertionLineTop] = useState(null);

  // Track which column header is hovered
  const [hoveredCol, setHoveredCol] = useState(null);

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

  // Remove section/group arrays - now unused

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

  // Example 5×5 seed in text-mode format
  const exampleText = [
    '* RT:R1-N',
    '  - C1-N:R1-C1',
    '  - C2-N:R1-C2',
    '  - C3-N:R1-C3',
    '  - C4-N:R1-C4',
    '  - C5-N:R1-C5',
    '* RT:R2-N',
    '  - C1-N:R2-C1',
    '  - C2-N:R2-C2',
    '  - C3-N:R2-C3',
    '  - C4-N:R2-C4',
    '  - C5-N:R2-C5',
    '* RT:R3-N',
    '  - C1-N:R3-C1',
    '  - C2-N:R3-C2',
    '  - C3-N:R3-C3',
    '  - C4-N:R3-C4',
    '  - C5-N:R3-C5',
    '* RT:R4-N',
    '  - C1-N:R4-C1',
    '  - C2-N:R4-C2',
    '  - C3-N:R4-C3',
    '  - C4-N:R4-C4',
    '  - C5-N:R4-C5',
    '* RT:R5-N',
    '  - C1-N:R5-C1',
    '  - C2-N:R5-C2',
    '  - C3-N:R5-C3',
    '  - C4-N:R5-C4',
    '  - C5-N:R5-C5'
  ].join('\n');

  // Handler to paste example into the textarea
  const handlePasteExample = () => {
    setImportText(exampleText);
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

  // Copy the table to clipboard as a flat HTML table and TSV
  const handleCopyTable = async () => {
    // Build a flat HTML table export
    let html = '<table><thead>';
    html += '<tr>';
    // Column headers: Title then sub-headers
    rows[0].forEach((cell, idx) => {
      html += `<th>${cell.name || (idx === 0 ? 'Title' : '')}</th>`;
    });
    html += '</tr></thead><tbody>';
    // Table body rows
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell.value || ''}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';

    // Build TSV (tab-separated values)
    const tsvRows = [];
    // Header row: just column names
    const tsvHeader = [];
    rows[0].forEach(cell => {
      tsvHeader.push(cell.name || '');
    });
    tsvRows.push(tsvHeader.join('\t'));
    // Body rows
    rows.forEach(row => {
      const line = [];
      row.forEach(cell => line.push(cell.value || ''));
      tsvRows.push(line.join('\t'));
    });
    const tsv = tsvRows.join('\n');

    // Write both to clipboard
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([tsv], { type: 'text/plain' })
          })
        ]);
      } catch {
        await navigator.clipboard.writeText(tsv);
      }
    } else {
      await navigator.clipboard.writeText(tsv);
    }
    setTableCopied(true);
    setTimeout(() => setTableCopied(false), 1000);
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
    // Compute midpoint between items for the insertion line
    const containerRect = e.currentTarget.getBoundingClientRect();
    let aboveEl = refs[newOver - 1];
    let belowEl = refs[newOver];
    if (!aboveEl) aboveEl = { getBoundingClientRect: () => containerRect };
    if (!belowEl) belowEl = { getBoundingClientRect: () => containerRect };
    const rectAbove = aboveEl.getBoundingClientRect();
    const rectBelow = belowEl.getBoundingClientRect();
    const midY = (rectAbove.bottom + rectBelow.top) / 2;
    setInsertionLineTop(midY - containerRect.top);
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
    setInsertionLineTop(null);
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
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 8 }}
                  onClick={handlePasteExample}
                >
                  Paste Example
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
            <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
              {rows[0].slice(1).map((cell, idx) => {
                const colIndex = idx + 1;
                return (
                  <React.Fragment key={colIndex}>
                    {dragOverIndex === idx && insertionLineTop != null && (
                      <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
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
              {dragOverIndex === rows[0].length - 1 && insertionLineTop != null && (
                <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
              )}
            </ul>
          ) : (
            <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
              {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {reorderMode && dragOverIndex === rowIndex && insertionLineTop != null && (
                    <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
                  )}
                  <li
                    ref={el => liRefs.current[rowIndex] = el}
                    key={rowIndex}
                    className={pendingDeleteRow === rowIndex ? 'pending-delete' : ''}
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
                          <li key={colIndex}>
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
                                  backgroundColor: `var(--col-color-${colIndex + 2})`,
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
              {reorderMode && dragOverIndex === rows.length && insertionLineTop != null && (
                <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
              )}
            </ul>
          )
        )}
      </div>
      <div className="table-panel" style={{ position: 'relative' }}>
        <table>
          <thead>
            <tr>
              {rows[0].map((cell, idx) => (
                <th
                  key={idx}
                  style={{ cursor: 'pointer' }}
                  onClick={() => focusInput(0, idx, 'name')}
                  onDoubleClick={() => {
                    focusInput(0, idx, 'name');
                    const ref = inputRefs.current[`0-${idx}-name`];
                    if (ref) ref.setSelectionRange(0, ref.value.length);
                  }}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(null)}
                  className={hoveredCol === idx ? 'highlight-column' : ''}
                >
                  {idx === 0 ? (cell.name || 'Title') : (
                    <span
                      className="column-header-pill"
                      style={{ backgroundColor: `var(--col-color-${idx + 1})` }}
                    >
                      {cell.name || `Col ${idx}`}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{ cursor: 'pointer' }}
                    onClick={() => focusInput(rIdx, cIdx, 'value')}
                    onDoubleClick={() => {
                      focusInput(rIdx, cIdx, 'value');
                      const ref = inputRefs.current[`${rIdx}-${cIdx}-value`];
                      if (ref) ref.setSelectionRange(0, ref.value.length);
                    }}
                    className={hoveredCol === cIdx ? 'highlight-column' : ''}
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={handleCopyTable}
          className="btn-copy-table"
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            padding: '8px 12px',
            border: 'none',
            background: '#4d90fe',
            color: '#fff',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {tableCopied ? 'Copied!' : 'Copy Table'}
        </button>
      </div>
    </div>
  );
}
