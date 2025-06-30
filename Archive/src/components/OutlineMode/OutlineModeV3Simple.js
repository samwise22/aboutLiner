import React, { useState } from 'react';

/**
 * Simple version of OutlineModeV3 for debugging
 */
const OutlineModeV3Simple = ({
  sectionData,
  onDataChange,
  includeIds = true,
  includeHeaders = true,
  includeSections = true
}) => {
  const [debugInfo, setDebugInfo] = useState('Component initialized');

  return (
    <div className="outline-mode-v3">
      <div style={{background: 'yellow', padding: '10px', marginBottom: '10px', border: '2px solid red'}}>
        <strong>DEBUG:</strong> OutlineModeV3Simple is rendering successfully!
      </div>
      <div>
        <p>Component loaded. SectionData has {sectionData?.rowSections?.length || 0} row sections.</p>
        <p>includeHeaders: {includeHeaders ? 'true' : 'false'}</p>
        <p>Debug info: {debugInfo}</p>
        
        {/* Show section data with editable column names */}
        {sectionData?.rowSections?.map((section, sectionIdx) => (
          <div key={sectionIdx} style={{margin: '10px', padding: '10px', border: '1px solid #ccc'}}>
            <h4>Section {sectionIdx + 1}: {section.sectionName || 'Unnamed'}</h4>
            {section.rows?.map((row, rowIdx) => (
              <div key={rowIdx} style={{marginLeft: '20px'}}>
                <div>• {row.value || 'Empty row'}</div>
                {row.cells?.map((cell, cellIdx) => (
                  <div key={cellIdx} style={{marginLeft: '40px'}}>
                    - Column {cellIdx + 1}: 
                    <input 
                      type="text" 
                      value={cell.name || ''} 
                      onChange={(e) => {
                        console.log('Level 2 name changed:', e.target.value);
                        setDebugInfo(`Level 2 name changed to: ${e.target.value}`);
                        
                        // Update the section data properly
                        const updatedSections = [...sectionData.rowSections];
                        updatedSections[sectionIdx].rows[rowIdx].cells[cellIdx].name = e.target.value;
                        
                        // Also update colSections for table synchronization
                        const updatedColSections = [...(sectionData.colSections || [])];
                        const targetIdx = cellIdx; // 0-based index for colSections
                        
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
                          targetSection.cols[colIndex].name = e.target.value;
                        } else {
                          targetSection.cols.push({
                            idx: targetIdx,
                            name: e.target.value,
                            colIndex: cellIdx + 1 // 1-based for compatibility
                          });
                        }
                        
                        // Call onDataChange to update the state
                        onDataChange({
                          ...sectionData,
                          rowSections: updatedSections,
                          colSections: updatedColSections
                        });
                      }}
                      placeholder="Column name"
                      style={{marginLeft: '5px', marginRight: '10px', width: '120px'}}
                    />
                    = {cell.value || 'empty'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutlineModeV3Simple;
