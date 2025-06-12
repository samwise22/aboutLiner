import React, { useState, useRef, useEffect } from 'react';
import logo from './aboutliner rectangle.png';

export default function App() {
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState([
    [ { name: '', value: '' } ]
  ]);
  const [editingCell, setEditingCell] = useState(null); // key = `${rowIndex}-${colIndex}`
  const inputRefs = useRef({}); // keys: `${rowIndex}-${colIndex}`
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const pendingDeleteTimer = useRef(null);
  // Two-step deletion for sub-bullet columns
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);
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
  return (
    <div className="app-container" style={{ position: 'relative', paddingTop: 80 }}>
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <img src={logo} alt="aboutLiner logo" style={{ height: 56, pointerEvents: 'none' }} />
      </div>
      <div className="outline-panel">
        <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
          {rows.map((row, rowIndex) => (
            <li
              key={rowIndex}
              className={pendingDeleteRow === rowIndex ? 'pending-delete' : ''}
              style={{ marginBottom: 8 }}
            >
              <div className="sub-bullet__cell" style={{ display: 'flex', gap: '4px' }}>
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
                    handleKeyDown(e, rowIndex, 0);
                  }}
                  ref={el => (inputRefs.current[`${rowIndex}-0-name`] = el)}
                  aria-label={`Row ${rowIndex + 1} column 1 name`}
                />
                <input
                  className="cell-value"
                  type="text"
                  placeholder="Value"
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
              {columns > 1 && (
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
                        onClick={() => setEditingCell(`${rowIndex}-${colIndex + 1}`)}
                      >
                        <input
                          type="text"
                          placeholder="Column name"
                          value={row[colIndex + 1].name}
                          onChange={e => updateCell(rowIndex, colIndex + 1, 'name', e.target.value)}
                          style={{
                            // circle when name exists and not focused; pill otherwise
                            width: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                              ? '16px'
                              : 'auto',
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
                            padding: editingCell === `${rowIndex}-${colIndex + 1}-name` ? '0 8px' : '0',
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
          ))}
        </ul>
      </div>
      <div className="table-panel">
        <table className="styled-table">
          <thead>
            <tr>
              <th className="styled-table__header-cell"></th>
              {columns > 1 && rows[0].slice(1).map((cell, idx) => (
                <th
                  key={idx}
                  className={
                    'styled-table__header-cell' +
                    (pendingDeleteCol === idx ? ' pending-delete-col' : '')
                  }
                >
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: `var(--col-color-${idx + 2})`,
                      padding: '4px 12px',
                      borderRadius: '999px',
                      color: '#333',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => focusInput(0, idx + 1, 'name')}
                  >
                    {cell.name || `Column ${idx + 1}`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={pendingDeleteRow === rIdx ? 'pending-delete-row' : ''}
              >
                <td
                  className={`styled-table__cell ${
                    editingCell === `${rIdx}-0-value` ? 'focused-cell' : ''
                  }`}
                  onClick={() => focusInput(rIdx, 0, 'value')}
                  style={{ cursor: 'pointer' }}
                >
                  {row[0].value}
                </td>
                {row.slice(1).map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={
                      'styled-table__cell' +
                      (editingCell === `${rIdx}-${cIdx + 1}-value` ? ' focused-cell' : '') +
                      (pendingDeleteCol === cIdx ? ' pending-delete-col' : '')
                    }
                    onClick={() => focusInput(rIdx, cIdx + 1, 'value')}
                    style={{ cursor: 'pointer' }}
                  >
                    {cell.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
