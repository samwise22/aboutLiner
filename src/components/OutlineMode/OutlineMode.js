import React, { useRef, useEffect, useState } from 'react';
import { generateRowId } from '../../models/SectionModel';
import '../../styles/outline.css';

/**
 * OutlineMode component - allows editing the table in outline/bullet form
 * with keyboard navigation and smart handling of indentation, returns, etc.
 * Based on the original implementation from App.js with adaptations for the section model
 */
const OutlineMode = ({
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
    
    // Tab key - Changes indentation / creates new column in a row
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // If name field is focused and we want to tab to value (not in shift mode)
      if (field === 'name' && !e.shiftKey) {
        focusInput(sectionIdx, rowIdx, colIdx, 'value');
        return;
      }
      
      // If value field is focused and we want to go back to name (shift+tab)
      if (field === 'value' && e.shiftKey) {
        focusInput(sectionIdx, rowIdx, colIdx, 'name');
        return;
      }
      
      // Otherwise normal tab behavior or advanced control could be added
    }
    
    // Backspace key - Delete row if empty or at start
    if (e.key === 'Backspace') {
      const currentRow = rows[rowIdx];
      const target = e.target;
      
      // Only delete row if cursor is at position 0 and row is empty
      if (
        target.selectionStart === 0 && 
        target.selectionEnd === 0 &&
        ((field === 'name' && !currentRow.name && !currentRow.value) ||
         (field === 'value' && !currentRow.value))
      ) {
        // Don't delete the last row
        if (rows.length <= 1) {
          return;
        }
        
        e.preventDefault();
        
        // Remove row
        const updatedSectionData = {
          ...sectionData,
          rowSections: sectionData.rowSections.map((section, sIdx) => {
            if (sIdx === sectionIdx) {
              const newRows = [...section.rows];
              newRows.splice(rowIdx, 1);
              return {
                ...section,
                rows: newRows
              };
            }
            return section;
          })
        };
        
        // Update data
        onDataChange(updatedSectionData);
        
        // Focus on previous row
        setTimeout(() => {
          const prevRowIdx = Math.max(0, rowIdx - 1);
          focusInput(sectionIdx, prevRowIdx, colIdx, field);
        }, 0);
      }
    }
  };
  
  // Helper to calculate next position based on current and delta
  const calculateNextPosition = (sectionIdx, rowIdx, delta, field) => {
    const currentSection = sectionData.rowSections[sectionIdx];
     // Simple case - stay in same section
    if (
      rowIdx + delta >= 0 &&
      rowIdx + delta < currentSection.rows.length
    ) {
      return {
        sectionIdx,
        rowIdx: rowIdx + delta,
        field
      };
    }
    
    // Moving to previous section
    if (delta < 0 && sectionIdx > 0) {
      const prevSectionIdx = sectionIdx - 1;
      const prevSection = sectionData.rowSections[prevSectionIdx];
      return {
        sectionIdx: prevSectionIdx,
        rowIdx: prevSection.rows.length - 1,
        field
      };
    }
    
    // Moving to next section
    if (delta > 0 && sectionIdx < sectionData.rowSections.length - 1) {
      return {
        sectionIdx: sectionIdx + 1,
        rowIdx: 0,
        field
      };
    }
    
    // No valid move, stay in place
    return { sectionIdx, rowIdx, field };
  };
  
  // Handle changes to row header (name/value)
  const handleRowHeaderChange = (sectionIdx, rowIdx, field, value) => {
    const updatedSectionData = {
      ...sectionData,
      rowSections: sectionData.rowSections.map((section, sIdx) => {
        if (sIdx === rowSectionIdx) {
          const newRows = [...section.rows];
          newRows[rowIdx] = {
            ...newRows[rowIdx],
            [field]: value
          };
          return {
            ...section,
            rows: newRows
          };
        }
        return section;
      })
    };
    
    onDataChange(updatedSectionData);
  };
  
  // Handle changes to row values
  const handleRowValueChange = (sectionIdx, rowIdx, value) => {
    const updatedSectionData = {
      ...sectionData,
      rowSections: sectionData.rowSections.map((section, sIdx) => {
        if (sIdx === rowSectionIdx) {
          const newRows = [...section.rows];
          newRows[rowIdx] = {
            ...newRows[rowIdx],
            value
          };
          return {
            ...section,
            rows: newRows
          };
        }
        return section;
      })
    };
    
    onDataChange(updatedSectionData);
  };
  
  return (
    <div className="outline-mode">
      {sectionData.rowSections.map((section, sectionIdx) => (
        <div className="section-container" key={section.sectionId}>
          {/* Optionally render section name */}
          {section.sectionName && includeSections && (
            <div className="section-header">{section.sectionName}</div>
          )}
          
          {/* Render rows for this section */}
          <div className="section-rows">
            {section.rows.map((row, rowIdx) => {
              const rowKey = getRowKey(sectionIdx, rowIdx);
              
              return (
                <div className="outline-row" key={rowKey}>
                  {/* Row header with ID and name */}
                  <div className="row-header">
                    {includeIds && (
                      <span className="row-id">{row.id}</span>
                    )}
                    <input
                      ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-name`] = el)}
                      className="row-name-input"
                      type="text"
                      value={includeHeaders ? row.name : ''}
                      onChange={(e) => handleRowHeaderChange(sectionIdx, rowIdx, 'name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, sectionIdx, rowIdx, 0, 'name')}
                      onFocus={() => setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 })}
                    />
                  </div>
                  
                  {/* Row value */}
                  <div className="row-value">
                    <input
                      ref={el => (inputRefs.current[`${sectionIdx}-${rowIdx}-0-value`] = el)}
                      className="row-value-input"
                      type="text"
                      value={row.value}
                      onChange={(e) => handleRowValueChange(sectionIdx, rowIdx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, sectionIdx, rowIdx, 0, 'value')}
                      onFocus={() => setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OutlineMode;
