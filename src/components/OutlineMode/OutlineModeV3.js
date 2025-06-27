import React, { useState, useRef } from 'react';
import '../../styles/outlinev3.css';

/**
 * OutlineModeV3 - Working version with proper styling and robust keyboard navigation
 */
const OutlineModeV3 = ({
  sectionData,
  onDataChange,
  includeIds = true,
  includeHeaders = true,
  includeSections = true
}) => {
  // Essential state only
  const [focusedCell, setFocusedCell] = useState({ sectionIdx: null, rowIdx: null, colIdx: null });
  const [focusedNameField, setFocusedNameField] = useState(null);
  // Input refs for focus management
  const inputRefs = useRef({});

  // Keyboard navigation handler (up/down arrows for name/value fields)
  const handleNavigation = (direction, fieldType, opts = {}) => {
    if (opts.metaKey || opts.ctrlKey) {
      // Find the currently focused input's key
      let foundKey = null;
      for (const key in inputRefs.current) {
        if (inputRefs.current[key] === document.activeElement) {
          foundKey = key;
          break;
        }
      }
      if (!foundKey) return;
      // key format: sectionIdx-rowIdx-colIdx-field
      const [sectionIdx, rowIdx, colIdx, field] = foundKey.split('-').map((v, i) => (i < 3 ? parseInt(v, 10) : v));
      // Build a flat list of all rows (for level 1) or all cells at colIdx (for level 2)
      let flatList = [];
      if (colIdx === 0) {
        // Level 1: all rows in all sections
        sectionData.rowSections.forEach((section, sIdx) => {
          section.rows.forEach((row, rIdx) => {
            flatList.push({ sectionIdx: sIdx, rowIdx: rIdx });
          });
        });
        // Find current index in flatList
        const currentIdx = flatList.findIndex(item => item.sectionIdx === sectionIdx && item.rowIdx === rowIdx);
        let nextIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
        if (nextIdx < 0) nextIdx = flatList.length - 1;
        if (nextIdx >= flatList.length) nextIdx = 0;
        const { sectionIdx: nSectionIdx, rowIdx: nRowIdx } = flatList[nextIdx];
        const targetKey = `${nSectionIdx}-${nRowIdx}-0-${fieldType}`;
        const targetInput = inputRefs.current[targetKey];
        if (targetInput) targetInput.focus();
      } else {
        // Level 2: all cells at colIdx in all rows/sections
        sectionData.rowSections.forEach((section, sIdx) => {
          section.rows.forEach((row, rIdx) => {
            flatList.push({ sectionIdx: sIdx, rowIdx: rIdx, colIdx });
          });
        });
        const currentIdx = flatList.findIndex(item => item.sectionIdx === sectionIdx && item.rowIdx === rowIdx);
        let nextIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
        if (nextIdx < 0) nextIdx = flatList.length - 1;
        if (nextIdx >= flatList.length) nextIdx = 0;
        const { sectionIdx: nSectionIdx, rowIdx: nRowIdx, colIdx: nColIdx } = flatList[nextIdx];
        const targetKey = `${nSectionIdx}-${nRowIdx}-${nColIdx}-${fieldType}`;
        const targetInput = inputRefs.current[targetKey];
        if (targetInput) targetInput.focus();
      }
      return;
    }
    // Default: move to next/prev of same type in DOM order
    const selector = fieldType === 'name' ? '.label-input' : '.value-input';
    const inputs = document.querySelectorAll(`.outline-mode-v3 ${selector}`);
    const inputArray = Array.from(inputs);
    const activeElement = document.activeElement;
    const currentIndex = inputArray.indexOf(activeElement);
    if (currentIndex === -1) return;
    let nextIndex;
    if (direction === 'up') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : inputArray.length - 1;
    } else {
      nextIndex = currentIndex < inputArray.length - 1 ? currentIndex + 1 : 0;
    }
    if (inputArray[nextIndex]) {
      inputArray[nextIndex].focus();
    }
  };

  // Helper: move focus between name/value fields in the same row/cell
  const moveNameValueFocus = (sectionIdx, rowIdx, colIdx, fromField, direction) => {
    const targetField = fromField === 'name'
      ? (direction === 'right' ? 'value' : null)
      : (direction === 'left' ? 'name' : null);
    if (!targetField) return;
    const targetKey = `${sectionIdx}-${rowIdx}-${colIdx}-${targetField}`;
    const targetInput = inputRefs.current[targetKey];
    if (targetInput) {
      targetInput.focus();
      // Place caret at start or end as appropriate
      if (targetField === 'name') {
        const len = targetInput.value.length;
        targetInput.setSelectionRange(len, len);
      } else if (targetField === 'value') {
        targetInput.setSelectionRange(0, 0);
      }
    }
  };

  // Get the global row title header (for level 1 name fields)
  const getRowTitleHeader = () => {
    return sectionData.rowSections?.[0]?.rows?.[0]?.name || '';
  };

  // Update the global row title header (for level 1 name fields)
  const updateRowTitleHeader = (newTitle) => {
    const updatedSections = [...sectionData.rowSections];
    updatedSections.forEach(section => {
      section.rows.forEach(row => {
        row.name = newTitle;
      });
    });
    onDataChange({
      ...sectionData,
      rowSections: updatedSections
    });
  };

  // Update column header function
  const updateColumnHeader = (colIdx, newHeader) => {
    const cellIdx = colIdx - 1;
    const targetIdx = colIdx - 1;
    const updatedSections = [...sectionData.rowSections];
    updatedSections.forEach(section => {
      section.rows.forEach(row => {
        if (row.cells && row.cells[cellIdx]) {
          row.cells[cellIdx].name = newHeader;
        }
      });
    });
    const updatedColSections = [...(sectionData.colSections || [])];
    let targetSection = updatedColSections.find(section => 
      section.cols?.some(col => col.idx === targetIdx)
    );
    if (!targetSection) {
      targetSection = {
        sectionId: `col-section-${targetIdx}`,
        sectionName: '',
        cols: []
      };
      updatedColSections.push(targetSection);
    }
    const colIndex = targetSection.cols.findIndex(col => col.idx === targetIdx);
    if (colIndex >= 0) {
      targetSection.cols[colIndex].name = newHeader;
    } else {
      targetSection.cols.push({
        idx: targetIdx,
        name: newHeader,
        colIndex: colIdx
      });
    }
    onDataChange({
      ...sectionData,
      rowSections: updatedSections,
      colSections: updatedColSections
    });
  };

  // Get column header function
  const getColumnHeader = (colIdx) => {
    const targetIdx = colIdx - 1;
    if (sectionData.colSections) {
      for (const section of sectionData.colSections) {
        if (section.cols) {
          const col = section.cols.find(col => col.idx === targetIdx);
          if (col && col.name) {
            return col.name;
          }
        }
      }
    }
    if (sectionData.rowSections && sectionData.rowSections.length > 0) {
      for (const section of sectionData.rowSections) {
        if (section.rows && section.rows.length > 0) {
          for (const row of section.rows) {
            if (row.cells && row.cells[targetIdx] && row.cells[targetIdx].name) {
              return row.cells[targetIdx].name;
            }
          }
        }
      }
    }
    return '';
  };

  // Update cell value
  const updateCell = (sectionIdx, rowIdx, colIdx, field, value) => {
    const updatedSections = [...sectionData.rowSections];
    const section = updatedSections[sectionIdx];
    if (!section) return;
    const row = section.rows[rowIdx];
    if (!row) return;
    if (colIdx === 0) {
      const updatedRow = { ...row, [field]: value };
      updatedSections[sectionIdx] = {
        ...section,
        rows: [
          ...section.rows.slice(0, rowIdx),
          updatedRow,
          ...section.rows.slice(rowIdx + 1)
        ]
      };
    } else {
      const cellIdx = colIdx - 1;
      if (!row.cells || cellIdx >= row.cells.length) return;
      const updatedCells = [...row.cells];
      updatedCells[cellIdx] = {
        ...updatedCells[cellIdx],
        [field]: value
      };
      const updatedRow = { ...row, cells: updatedCells };
      updatedSections[sectionIdx] = {
        ...section,
        rows: [
          ...section.rows.slice(0, rowIdx),
          updatedRow,
          ...section.rows.slice(rowIdx + 1)
        ]
      };
    }
    onDataChange({
      ...sectionData,
      rowSections: updatedSections
    });
  };

  // Helper: check if all values in a column are empty
  const isColumnEmpty = (colIdx) => {
    for (const section of sectionData.rowSections) {
      for (const row of section.rows) {
        if (row.cells && row.cells[colIdx - 1] && row.cells[colIdx - 1].value && row.cells[colIdx - 1].value.trim() !== '') {
          return false;
        }
      }
    }
    return true;
  };

  // Helper: insert a new row after the given rowIdx in sectionIdx
  const insertRow = (sectionIdx, rowIdx) => {
    const section = sectionData.rowSections[sectionIdx];
    if (!section) return;
    const templateRow = section.rows[0] || { cells: [] };
    const newRow = {
      id: Math.random().toString(36).slice(2),
      name: '',
      value: '',
      cells: templateRow.cells.map(cell => ({
        colSectionId: cell.colSectionId || '',
        name: '',
        value: ''
      }))
    };
    const updatedSections = [...sectionData.rowSections];
    updatedSections[sectionIdx] = {
      ...section,
      rows: [
        ...section.rows.slice(0, rowIdx + 1),
        newRow,
        ...section.rows.slice(rowIdx + 1)
      ]
    };
    onDataChange({
      ...sectionData,
      rowSections: updatedSections
    });
    setTimeout(() => {
      const key = `${sectionIdx}-${rowIdx + 1}-0-value`;
      const input = inputRefs.current[key];
      if (input) input.focus();
    }, 0);
  };

  // Helper: insert a new column at colIdx+1 for all rows
  const insertColumn = (colIdx) => {
    const updatedSections = sectionData.rowSections.map(section => {
      const updatedRows = section.rows.map(row => {
        const newCells = [...row.cells];
        newCells.splice(colIdx, 0, { name: '', value: '' });
        return { ...row, cells: newCells };
      });
      return { ...section, rows: updatedRows };
    });
    onDataChange({
      ...sectionData,
      rowSections: updatedSections
    });
    setTimeout(() => {
      // Focus the new column's value field in the same row
      for (let s = 0; s < updatedSections.length; s++) {
        for (let r = 0; r < updatedSections[s].rows.length; r++) {
          const key = `${s}-${r}-${colIdx + 1}-value`;
          const input = inputRefs.current[key];
          if (input) {
            input.focus();
            return;
          }
        }
      }
    }, 0);
  };

  return (
    <div className="outline-mode-v3">
      {sectionData.rowSections.map((section, sectionIdx) => (
        <div key={section.sectionId} className="row-section">
          <div className="section-label">
            <input
              type="text"
              className="section-name-input"
              value={section.sectionName}
              onChange={(e) => {
                const updatedSections = [...sectionData.rowSections];
                updatedSections[sectionIdx] = {
                  ...section,
                  sectionName: e.target.value
                };
                onDataChange({
                  ...sectionData,
                  rowSections: updatedSections
                });
              }}
              placeholder="Section Name"
            />
          </div>
          <ul>
            {section.rows.map((row, rowIdx) => (
              <li key={row.id} className="row-item">
                <div className="cell-row">
                  <div className="bullet">•</div>
                  <div className={`row-label ${getRowTitleHeader() ? 'has-name' : ''} ${focusedNameField === `${sectionIdx}-${rowIdx}-0` ? 'name-input-focused' : ''}`}> 
                    {includeHeaders && (
                      <input
                        className="label-input"
                        ref={(el) => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-name`] = el)}
                        type="text"
                        placeholder="Row Title"
                        value={getRowTitleHeader()}
                        onChange={(e) => updateRowTitleHeader(e.target.value)}
                        onFocus={() => {
                          setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 });
                          setFocusedNameField(`${sectionIdx}-${rowIdx}-0`);
                        }}
                        onBlur={() => setFocusedNameField(null)}
                        onKeyDown={e => {
                          const caretAtEnd = e.target.selectionStart === e.target.value.length;
                          if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                            e.preventDefault();
                            handleNavigation(e.key === 'ArrowUp' ? 'up' : 'down', 'name', { metaKey: e.metaKey, ctrlKey: e.ctrlKey });
                          } else if (
                            e.key === 'ArrowRight' && (caretAtEnd || e.metaKey || e.ctrlKey)
                          ) {
                            e.preventDefault();
                            moveNameValueFocus(sectionIdx, rowIdx, 0, 'name', 'right');
                          }
                        }}
                        title="Row Header (expand on focus)"
                      />
                    )}
                    <input
                      className="value-input"
                      ref={(el) => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-value`] = el)}
                      type="text"
                      placeholder="Row Value"
                      value={row.value || ''}
                      onChange={(e) => updateCell(sectionIdx, rowIdx, 0, 'value', e.target.value)}
                      onFocus={() => setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 })}
                      onKeyDown={e => {
                        const caretAtStart = e.target.selectionStart === 0;
                        const caretAtEnd = e.target.selectionStart === e.target.value.length;
                        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                          e.preventDefault();
                          handleNavigation(e.key === 'ArrowUp' ? 'up' : 'down', 'value', { metaKey: e.metaKey, ctrlKey: e.ctrlKey });
                        } else if (
                          e.key === 'ArrowLeft' && (caretAtStart || e.metaKey || e.ctrlKey)
                        ) {
                          e.preventDefault();
                          moveNameValueFocus(sectionIdx, rowIdx, 0, 'value', 'left');
                        } else if (
                          e.key === 'Enter' && caretAtEnd
                        ) {
                          e.preventDefault();
                          // Level 1: add row
                          insertRow(sectionIdx, rowIdx);
                        }
                      }}
                    />
                    {includeHeaders && (
                      <span 
                        className="name-badge" 
                        title={getRowTitleHeader() || "Row Title"} 
                        onClick={() => {
                          const input = inputRefs.current[`${sectionIdx}-${rowIdx}-0-name`];
                          if (input) input.focus();
                        }}
                      >
                        {getRowTitleHeader() || 'Row Title'}
                      </span>
                    )}
                  </div>
                </div>
                {row.cells && row.cells.length > 0 && (
                  <ul className="sub-bullets">
                    {row.cells.map((cell, cellIdx) => {
                      const colIdx = cellIdx + 1;
                      return (
                        <li key={`sub-${cellIdx}`} className="sub-bullet">
                          <div className="sub-bullet-item">
                            <div className="bullet">-</div>
                            <div className={`row-label ${focusedNameField === `${sectionIdx}-${rowIdx}-${colIdx}` ? 'name-input-focused' : ''}`}> 
                              {includeHeaders && (
                                <input
                                  className="label-input"
                                  ref={(el) => (inputRefs.current[`${sectionIdx}-${rowIdx}-${colIdx}-name`] = el)}
                                  type="text"
                                  placeholder={`Column ${colIdx}`}
                                  value={getColumnHeader(colIdx)}
                                  onChange={(e) => updateColumnHeader(colIdx, e.target.value)}
                                  onFocus={() => {
                                    setFocusedCell({ sectionIdx, rowIdx, colIdx });
                                    setFocusedNameField(`${sectionIdx}-${rowIdx}-${colIdx}`);
                                  }}
                                  onBlur={() => setFocusedNameField(null)}
                                  onKeyDown={e => {
                                    const caretAtEnd = e.target.selectionStart === e.target.value.length;
                                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                      e.preventDefault();
                                      handleNavigation(e.key === 'ArrowUp' ? 'up' : 'down', 'name', { metaKey: e.metaKey, ctrlKey: e.ctrlKey });
                                    } else if (
                                      e.key === 'ArrowRight' && (caretAtEnd || e.metaKey || e.ctrlKey)
                                    ) {
                                      e.preventDefault();
                                      moveNameValueFocus(sectionIdx, rowIdx, colIdx, 'name', 'right');
                                    }
                                  }}
                                  title="Cell Header (expand on focus)"
                                />
                              )}
                              <input
                                className="value-input"
                                ref={(el) => (inputRefs.current[`${sectionIdx}-${rowIdx}-${colIdx}-value`] = el)}
                                type="text"
                                placeholder="Value"
                                value={cell.value || ''}
                                onChange={(e) => updateCell(sectionIdx, rowIdx, colIdx, 'value', e.target.value)}
                                onFocus={() => setFocusedCell({ sectionIdx, rowIdx, colIdx })}
                                onKeyDown={e => {
                                  const caretAtStart = e.target.selectionStart === 0;
                                  const caretAtEnd = e.target.selectionStart === e.target.value.length;
                                  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                    e.preventDefault();
                                    handleNavigation(e.key === 'ArrowUp' ? 'up' : 'down', 'value', { metaKey: e.metaKey, ctrlKey: e.ctrlKey });
                                  } else if (
                                    e.key === 'ArrowLeft' && (caretAtStart || e.metaKey || e.ctrlKey)
                                  ) {
                                    e.preventDefault();
                                    moveNameValueFocus(sectionIdx, rowIdx, colIdx, 'value', 'left');
                                  } else if (
                                    e.key === 'Enter' && caretAtEnd
                                  ) {
                                    e.preventDefault();
                                    // If last column in this row
                                    const isLastCol = colIdx === (row.cells.length);
                                    if (isLastCol) {
                                      if (!e.target.value && isColumnEmpty(colIdx)) {
                                        // Remove the last cell from this row (outdent)
                                        const updatedSections = sectionData.rowSections.map((section, sIdx) => {
                                          if (sIdx !== sectionIdx) return section;
                                          return {
                                            ...section,
                                            rows: section.rows.map((r, rIdx) => {
                                              if (rIdx !== rowIdx) return r;
                                              return {
                                                ...r,
                                                cells: r.cells.slice(0, -1)
                                              };
                                            })
                                          };
                                        });
                                        // Insert a new level 1 row (no sub-bullets) after the current row
                                        const section = updatedSections[sectionIdx];
                                        const newRow = {
                                          id: Math.random().toString(36).slice(2),
                                          name: '',
                                          value: '',
                                          cells: [] // No sub-bullets
                                        };
                                        section.rows = [
                                          ...section.rows.slice(0, rowIdx + 1),
                                          newRow,
                                          ...section.rows.slice(rowIdx + 1)
                                        ];
                                        onDataChange({
                                          ...sectionData,
                                          rowSections: updatedSections
                                        });
                                        setTimeout(() => {
                                          const key = `${sectionIdx}-${rowIdx + 1}-0-value`;
                                          const input = inputRefs.current[key];
                                          if (input) input.focus();
                                        }, 0);
                                      } else {
                                        insertColumn(colIdx);
                                      }
                                    }
                                  }
                                }}
                              />
                              {includeHeaders && (
                                <span 
                                  className="name-badge" 
                                  title={getColumnHeader(colIdx) || "Cell bullet"} 
                                  onClick={() => {
                                    const input = inputRefs.current[`${sectionIdx}-${rowIdx}-${colIdx}-name`];
                                    if (input) input.focus();
                                  }}
                                >
                                  {getColumnHeader(colIdx) || 'Cell bullet'}
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default OutlineModeV3;
