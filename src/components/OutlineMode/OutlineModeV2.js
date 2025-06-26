import React, { useRef, useEffect, useState } from 'react';
import { generateRowId } from '../../models/SectionModel';
import '../../styles/outline.css';

/**
 * OutlineModeV2 component - allows editing the table in outline/bullet form
 * with keyboard navigation and smart handling of indentation, returns, etc.
 * Based on the original implementation from App.js with adaptations for the section model
 */
const OutlineModeV2 = ({
  sectionData,
  onDataChange,
  includeIds = true,
  includeHeaders = true,
  includeSections = true
}) => {
  // Track focused cell for highlighting
  const [focusedCell, setFocusedCell] = useState({ sectionIdx: null, rowIdx: null, colIdx: null });
  
  // Track editing state (which cell is being edited)
  const [editingCell, setEditingCell] = useState(null); // format: "sectionIdx-rowIdx-colIdx-field"
  
  // Track pending deletion
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null); // format: "sectionIdx-rowIdx"
  const pendingDeleteTimer = useRef(null);
  
  // Track pending column deletion
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);
  const pendingDeleteColTimer = useRef(null);
  
  // References to input elements
  const inputRefs = useRef({});
  
  // References to list items for all rows
  const liRefs = useRef({});
  
  // Initialize/clean up on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timers when component unmounts
      clearTimeout(pendingDeleteTimer.current);
      clearTimeout(pendingDeleteColTimer.current);
    };
  }, []);

  // Helper to focus an input by section, row, column, and field
  const focusInput = (sectionIdx, rowIdx, colIdx, field = 'value') => {
    const key = `${sectionIdx}-${rowIdx}-${colIdx}-${field}`;
    const input = inputRefs.current[key];
    if (input) {
      input.focus();
      
      // If it's a text input, position cursor at the end
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }
    }
  };
  
  // Insert a new row after the given row
  const insertRow = (sectionIdx, rowIdx) => {
    const section = sectionData.rowSections[sectionIdx];
    if (!section) return;
    
    // Create a new row with empty cells that match the structure of existing rows
    const firstRow = section.rows[0];
    if (!firstRow) return;
    
    // Create new row with matching cell structure
    const newRow = {
      id: generateRowId(),
      name: '',
      value: '',
      cells: firstRow.cells.map(cell => ({
        colSectionId: cell.colSectionId,
        name: '',
        value: ''
      }))
    };
    
    // Insert the new row and update the data
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
    
    // Focus the new row after state update
    setTimeout(() => focusInput(sectionIdx, rowIdx + 1, 0, 'value'), 0);
  };
  
  // Check if all rows have last cell empty (value empty)
  const canDeleteColumn = (colIdx) => {
    // Check if all cells in this column are empty
    for (const section of sectionData.rowSections) {
      for (const row of section.rows) {
        if (colIdx === 0) {
          if (row.value !== '') return false;
        } else {
          if (row.cells[colIdx - 1]?.value !== '') return false;
        }
      }
    }
    return true;
  };
  
  // Update a cell's value or name
  const updateCell = (sectionIdx, rowIdx, colIdx, field, value) => {
    const updatedSections = [...sectionData.rowSections];
    const section = updatedSections[sectionIdx];
    if (!section) return;
    
    const row = section.rows[rowIdx];
    if (!row) return;
    
    // For main row (colIdx === 0)
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
      // For cells (colIdx > 0)
      if (!row.cells || colIdx - 1 >= row.cells.length) return;
      
      const updatedCells = [...row.cells];
      updatedCells[colIdx - 1] = {
        ...updatedCells[colIdx - 1],
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
  
  // Handle key navigation and special keys
  const handleKeyDown = (e, sectionIdx, rowIdx, colIdx, field) => {
    const section = sectionData.rowSections[sectionIdx];
    if (!section) return;
    
    const rows = section.rows;
    
    // Enter key - Create new row
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertRow(sectionIdx, rowIdx);
      return;
    }
    
    // Tab key - Navigate between fields (name/value)
    if (e.key === 'Tab') {
      if (!e.shiftKey) {
        // Forward tab
        if (field === 'name') {
          e.preventDefault();
          focusInput(sectionIdx, rowIdx, colIdx, 'value');
          return;
        } else if (colIdx < section.rows[0].cells.length) {
          e.preventDefault();
          focusInput(sectionIdx, rowIdx, colIdx + 1, 'name');
          return;
        }
      } else {
        // Backward tab
        if (field === 'value' && colIdx > 0) {
          e.preventDefault();
          focusInput(sectionIdx, rowIdx, colIdx, 'name');
          return;
        } else if (colIdx > 0) {
          e.preventDefault();
          focusInput(sectionIdx, rowIdx, colIdx - 1, 'value');
          return;
        }
      }
    }
    
    // Arrow keys for navigation
    if (e.key === 'ArrowUp' && !e.altKey) {
      if (rowIdx > 0) {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx - 1, colIdx, field);
      } else if (sectionIdx > 0) {
        e.preventDefault();
        const prevSection = sectionData.rowSections[sectionIdx - 1];
        if (prevSection && prevSection.rows.length > 0) {
          focusInput(sectionIdx - 1, prevSection.rows.length - 1, colIdx, field);
        }
      }
      return;
    }
    
    if (e.key === 'ArrowDown' && !e.altKey) {
      if (rowIdx < rows.length - 1) {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx + 1, colIdx, field);
      } else if (sectionIdx < sectionData.rowSections.length - 1) {
        e.preventDefault();
        const nextSection = sectionData.rowSections[sectionIdx + 1];
        if (nextSection && nextSection.rows.length > 0) {
          focusInput(sectionIdx + 1, 0, colIdx, field);
        }
      }
      return;
    }
    
    // Backspace on empty cell to delete row or column
    if (e.key === 'Backspace') {
      if (field === 'value' && colIdx === 0 && e.target.value === '') {
        // Backspace on empty main row value - delete row
        e.preventDefault();
        
        // Two-step deletion when row has cell values
        const hasNonEmptyCells = rows[rowIdx].cells.some(cell => cell.value !== '');
        if (hasNonEmptyCells) {
          // First press marks for deletion, second press confirms
          if (pendingDeleteRow === `${sectionIdx}-${rowIdx}`) {
            clearTimeout(pendingDeleteTimer.current);
            setPendingDeleteRow(null);
            
            // Delete the row
            const updatedSections = [...sectionData.rowSections];
            updatedSections[sectionIdx] = {
              ...section,
              rows: [
                ...rows.slice(0, rowIdx),
                ...rows.slice(rowIdx + 1)
              ]
            };
            
            onDataChange({
              ...sectionData,
              rowSections: updatedSections
            });
            
            // Focus the previous row
            if (rowIdx > 0) {
              setTimeout(() => focusInput(sectionIdx, rowIdx - 1, colIdx, field), 0);
            } else if (rowIdx === 0 && rows.length > 1) {
              setTimeout(() => focusInput(sectionIdx, 0, colIdx, field), 0);
            }
          } else {
            setPendingDeleteRow(`${sectionIdx}-${rowIdx}`);
            clearTimeout(pendingDeleteTimer.current);
            pendingDeleteTimer.current = setTimeout(() => {
              setPendingDeleteRow(null);
            }, 5000);
          }
        } else {
          // Simple deletion for rows with no cell data
          const updatedSections = [...sectionData.rowSections];
          updatedSections[sectionIdx] = {
            ...section,
            rows: [
              ...rows.slice(0, rowIdx),
              ...rows.slice(rowIdx + 1)
            ]
          };
          
          onDataChange({
            ...sectionData,
            rowSections: updatedSections
          });
          
          // Focus the previous row
          if (rowIdx > 0) {
            setTimeout(() => focusInput(sectionIdx, rowIdx - 1, colIdx, field), 0);
          } else if (rowIdx === 0 && rows.length > 1) {
            setTimeout(() => focusInput(sectionIdx, 0, colIdx, field), 0);
          }
        }
        return;
      } else if (field === 'value' && colIdx > 0 && e.target.value === '') {
        // Backspace on empty cell value - consider column deletion
        
        // Two-step deletion for columns with mixed data
        const canDelete = canDeleteColumn(colIdx);
        
        if (!canDelete) {
          // First press marks for deletion, second press confirms
          if (pendingDeleteCol === colIdx) {
            clearTimeout(pendingDeleteColTimer.current);
            setPendingDeleteCol(null);
            
            // Delete column values
            const updatedSections = sectionData.rowSections.map(section => ({
              ...section,
              rows: section.rows.map(row => {
                const updatedCells = [...row.cells];
                updatedCells[colIdx - 1] = {
                  ...updatedCells[colIdx - 1],
                  name: '',
                  value: ''
                };
                return { ...row, cells: updatedCells };
              })
            }));
            
            onDataChange({
              ...sectionData,
              rowSections: updatedSections
            });
          } else {
            setPendingDeleteCol(colIdx);
            clearTimeout(pendingDeleteColTimer.current);
            pendingDeleteColTimer.current = setTimeout(() => {
              setPendingDeleteCol(null);
            }, 5000);
          }
        } else {
          // Clear that column's data
          const updatedSections = sectionData.rowSections.map(section => ({
            ...section,
            rows: section.rows.map(row => {
              const updatedCells = [...row.cells];
              updatedCells[colIdx - 1] = {
                ...updatedCells[colIdx - 1],
                name: '',
                value: ''
              };
              return { ...row, cells: updatedCells };
            })
          }));
          
          onDataChange({
            ...sectionData,
            rowSections: updatedSections
          });
        }
        
        // Focus previous column
        setTimeout(() => focusInput(sectionIdx, rowIdx, colIdx - 1, field), 0);
        return;
      }
    }
    
    // Left arrow when at start of input - move to previous field
    if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      if (field === 'value') {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx, colIdx, 'name');
        return;
      } else if (colIdx > 0) {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx, colIdx - 1, 'value');
        return;
      }
    }
    
    // Right arrow when at end of input - move to next field
    if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      if (field === 'name') {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx, colIdx, 'value');
        return;
      } else if (colIdx < section.rows[0].cells.length) {
        e.preventDefault();
        focusInput(sectionIdx, rowIdx, colIdx + 1, 'name');
        return;
      }
    }
  };

  return (
    <div className="outline-mode">
      {sectionData.rowSections.map((section, sectionIdx) => (
        <div className="outline-section" key={section.sectionId}>
          {/* Display section name if sections are included */}
          {includeSections && section.sectionName && (
            <div className="section-heading">{section.sectionName}</div>
          )}
          
          {/* List of rows */}
          <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
            {section.rows.map((row, rowIdx) => (
              <li
                ref={el => liRefs.current[`${sectionIdx}-${rowIdx}`] = el}
                key={`${sectionIdx}-${rowIdx}`}
                className={pendingDeleteRow === `${sectionIdx}-${rowIdx}` ? 'pending-delete' : ''}
                style={{ marginBottom: 8 }}
              >
                {/* Main row (level 1) */}
                <div className="outline-row" style={{ display: 'flex', gap: '4px' }}>
                  {/* Row ID if showing IDs */}
                  {includeIds && (
                    <div className="row-id" style={{ minWidth: '40px', color: '#888' }}>
                      {row.id}
                    </div>
                  )}
                  
                  {/* Row header */}
                  {includeHeaders && (
                    <input
                      className="cell-name"
                      type="text"
                      placeholder="Title"
                      value={row.name}
                      onChange={e => updateCell(sectionIdx, rowIdx, 0, 'name', e.target.value)}
                      onKeyDown={e => handleKeyDown(e, sectionIdx, rowIdx, 0, 'name')}
                      ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-name`] = el)}
                      aria-label={`Row ${rowIdx + 1} title`}
                      onFocus={() => setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 })}
                      onBlur={() => setFocusedCell({ sectionIdx: null, rowIdx: null, colIdx: null })}
                      style={{ width: '150px' }}
                    />
                  )}
                  
                  {/* Row value */}
                  <input
                    className="cell-value"
                    type="text"
                    placeholder="Value"
                    value={row.value}
                    onChange={e => updateCell(sectionIdx, rowIdx, 0, 'value', e.target.value)}
                    onKeyDown={e => handleKeyDown(e, sectionIdx, rowIdx, 0, 'value')}
                    ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-value`] = el)}
                    aria-label={`Row ${rowIdx + 1} value`}
                    onFocus={() => {
                      setEditingCell(`${sectionIdx}-${rowIdx}-0-value`);
                      setPendingDeleteRow(null);
                      clearTimeout(pendingDeleteTimer.current);
                      setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 });
                    }}
                    onBlur={() => {
                      setEditingCell(null);
                      setFocusedCell({ sectionIdx: null, rowIdx: null, colIdx: null });
                    }}
                    style={{ flex: 1 }}
                  />
                </div>
                
                {/* Sub-rows (columns) */}
                {row.cells && row.cells.length > 0 && (
                  <ul style={{ listStyleType: 'none', paddingLeft: 24, marginTop: 4 }}>
                    {row.cells.map((cell, cellIdx) => {
                      const colIdx = cellIdx + 1; // cellIdx is 0-indexed, colIdx is 1-indexed (0 is main row)
                      const isPendingDelete = pendingDeleteCol === colIdx;
                      
                      return (
                        <li key={cellIdx}>
                          <div
                            className={`sub-bullet__cell${isPendingDelete ? ' pending-delete-col' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {/* Column name/title */}
                            {includeHeaders && (
                              <input
                                type="text"
                                placeholder="Title"
                                value={cell.name}
                                onChange={e => updateCell(sectionIdx, rowIdx, colIdx, 'name', e.target.value)}
                                onKeyDown={e => handleKeyDown(e, sectionIdx, rowIdx, colIdx, 'name')}
                                ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-${colIdx}-name`] = el)}
                                onFocus={() => {
                                  setEditingCell(`${sectionIdx}-${rowIdx}-${colIdx}-name`);
                                  setFocusedCell({ sectionIdx, rowIdx, colIdx });
                                }}
                                onBlur={() => {
                                  setEditingCell(null);
                                  setFocusedCell({ sectionIdx: null, rowIdx: null, colIdx: null });
                                }}
                                style={{ 
                                  width: '150px',
                                  backgroundColor: `var(--col-color-${colIdx + 1})`,
                                }}
                              />
                            )}
                            
                            {/* Column value */}
                            <textarea
                              placeholder="Value"
                              value={cell.value}
                              onChange={e => {
                                updateCell(sectionIdx, rowIdx, colIdx, 'value', e.target.value);
                                // Auto-resize textarea
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                              }}
                              onKeyDown={e => handleKeyDown(e, sectionIdx, rowIdx, colIdx, 'value')}
                              ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-${colIdx}-value`] = el)}
                              style={{ flex: 1, resize: 'vertical', minHeight: '1.5em', overflow: 'hidden' }}
                              rows={1}
                              onFocus={() => {
                                setEditingCell(`${sectionIdx}-${rowIdx}-${colIdx}-value`);
                                setPendingDeleteCol(null);
                                clearTimeout(pendingDeleteColTimer.current);
                                setFocusedCell({ sectionIdx, rowIdx, colIdx });
                              }}
                              onBlur={() => {
                                setEditingCell(null);
                                setFocusedCell({ sectionIdx: null, rowIdx: null, colIdx: null });
                              }}
                            />
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

export default OutlineModeV2;
