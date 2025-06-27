import React, { useState, useRef } from 'react';
import '../../styles/outlinev3.css';

/**
 * OutlineModeV3 - Working version with proper styling
 */
const OutlineModeV3Working = ({
  sectionData,
  onDataChange,
  includeIds = true,
  includeHeaders = true,
  includeSections = true
}) => {
  // Essential state only
  const [focusedCell, setFocusedCell] = useState({ sectionIdx: null, rowIdx: null, colIdx: null });
  const [focusedNameField, setFocusedNameField] = useState(null);
  const [debugInfo, setDebugInfo] = useState('OutlineModeV3 initialized');
  
  // Input refs for focus management
  const inputRefs = useRef({});

  // Get the global row title header (for level 1 name fields)
  const getRowTitleHeader = () => {
    // Use the same source that the table uses: first row's name field
    return sectionData.rowSections?.[0]?.rows?.[0]?.name || '';
  };
  
  // Update the global row title header (for level 1 name fields)
  const updateRowTitleHeader = (newTitle) => {
    // Update all rows' name field to keep them synchronized
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

  // Update column header function (working version from simple component)
  const updateColumnHeader = (colIdx, newHeader) => {
    console.log('updateColumnHeader called:', { colIdx, newHeader });
    setDebugInfo(`Updating column ${colIdx} to "${newHeader}"`);
    
    const cellIdx = colIdx - 1; // Convert 1-based colIdx to 0-based cellIdx
    const targetIdx = colIdx - 1; // 0-based index for colSections
    
    // Update all cells' name field at this column index
    const updatedSections = [...sectionData.rowSections];
    updatedSections.forEach(section => {
      section.rows.forEach(row => {
        if (row.cells && row.cells[cellIdx]) {
          row.cells[cellIdx].name = newHeader;
        }
      });
    });
    
    // Update colSections for table synchronization
    const updatedColSections = [...(sectionData.colSections || [])];
    
    // Find or create column section
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
    
    // Update or create column entry
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
    
    // Look in colSections first
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
    
    // Fallback: look at any row's cell name at this column index
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
      // Row title
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
      // Cell
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
                        onChange={(e) => {
                          console.log('Level 1 name changed:', e.target.value);
                          setDebugInfo(`Updating row title to: ${e.target.value}`);
                          updateRowTitleHeader(e.target.value);
                        }}
                        onFocus={() => {
                          setFocusedCell({ sectionIdx, rowIdx, colIdx: 0 });
                          setFocusedNameField(`${sectionIdx}-${rowIdx}-0`);
                        }}
                        onBlur={() => {
                          setFocusedNameField(null);
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
                    />
                    
                    {/* Always show name badge for level 1 bullets */}
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
                                  onChange={(e) => {
                                    console.log('onChange fired for column', colIdx, 'with value:', e.target.value);
                                    updateColumnHeader(colIdx, e.target.value);
                                  }}
                                  onFocus={() => {
                                    setFocusedCell({ sectionIdx, rowIdx, colIdx });
                                    setFocusedNameField(`${sectionIdx}-${rowIdx}-${colIdx}`);
                                  }}
                                  onBlur={() => {
                                    setFocusedNameField(null);
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
                                  {getColumnHeader(colIdx) || ''}
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

export default OutlineModeV3Working;
