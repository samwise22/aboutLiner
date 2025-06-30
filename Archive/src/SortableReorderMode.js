import React, { useState, useMemo } from 'react';
import { ReactSortable } from 'react-sortablejs';
import './reorderMode.css';

/**
 * SortableReorderMode - Improved drag and drop with react-sortablejs
 * 
 * This component uses react-sortablejs to provide a more intuitive and robust
 * drag-and-drop experience with gap-only feedback. Version 2.0 now supports:
 * - Keeping section headers inline with their items
 * - Structure for future section reordering
 * - Nested sortable lists for a more intuitive UI
 */

/**
 * Section Header Component (inline within sorted list, but not draggable)
 */
const SectionHeader = ({ section, sectionId }) => {
  return (
    <div 
      className="section-header undraggable-item"
      data-type="section-header"
      data-section-id={sectionId}
      style={{
        padding: '8px 12px',
        backgroundColor: '#e8eaf6',
        borderRadius: '4px',
        marginBottom: '8px',
        marginTop: '16px',
        fontWeight: 'bold',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        borderLeft: '4px solid #3f51b5',
        cursor: 'default'
      }}
    >
      <span style={{ marginRight: '8px', color: '#3f51b5' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z"></path>
        </svg>
      </span>
      {section.sectionName}
    </div>
  );
};

/**
 * Main SortableReorderMode component
 */
const SortableReorderMode = ({
  reorderAxis,
  rows,
  columns,
  setRows
}) => {
  // Track loading state for visual feedback
  const [isLoading, setIsLoading] = useState(false);
  
  // Added key state to force re-evaluation of the useMemo when we know a drag operation has completed
  const [forceRegroupKey, setForceRegroupKey] = useState(0);

  // Debug helpers for tracking translation between flat and hierarchical models
  const DEBUG_VIRTUAL_ARRAY = true; // Enable debug logging to help diagnose dragging issues
  
  // Group items by section for nested sortable lists
  const { sectionsWithItems, itemsWithoutSection, colSections } = useMemo(() => {
    if (!rows || rows.length === 0) return { sectionsWithItems: [], itemsWithoutSection: [], colSections: [] };
    
    console.log('📊 Regrouping items by section due to data change');
    
    // Handle row reordering case
    if (reorderAxis === 'rows') {
      const sections = {};
      const noSectionItems = [];
      
      // Create a virtual mapping to track position in flat array vs. hierarchical structure
      // This is crucial for translating between the two models
      const virtualPositionMap = {};
      let virtualIndex = 0;
      
      // First pass: group rows by section with improved ID handling
      rows.forEach((row, index) => {
        const section = row[0]?.section;
        const sectionId = section?.sectionId;
        
        // Generate a consistent and unique ID for this row
        let rowId;
        if (row[0]?.id) {
          rowId = row[0].id;
        } else {
          // For rows without IDs, generate a consistent identifier
          rowId = `row-${index}`;
          // If we have a chance to, set an ID on the row to improve stability
          if (row[0]) {
            row[0].id = rowId;
          }
        }
        
        // Store the mapping between real array position and virtual position
        // This helps us track where items came from and should go back to
        virtualPositionMap[rowId] = {
          realIndex: index,
          virtualIndex: virtualIndex++,
          originalSection: sectionId
        };
        
        if (sectionId) {
          // Initialize section if it doesn't exist yet
          if (!sections[sectionId]) {
            sections[sectionId] = {
              sectionInfo: section,
              sectionId,
              items: []
            };
          }
          
          // Add this row to its section
          sections[sectionId].items.push({
            id: rowId,
            index,
            sectionId,
            isOnlyItemInSection: false, // We'll update this in the second pass
            originalData: row // Store original row data for reference
          });
        } else {
          // No section, add to unsectioned items
          noSectionItems.push({
            id: rowId,
            index,
            sectionId: null,
            isOnlyItemInSection: false,
            originalData: row // Store original row data for reference
          });
        }
      });
      
      // Second pass: mark items that are alone in their section
      Object.values(sections).forEach(section => {
        if (section.items.length === 1) {
          section.items[0].isOnlyItemInSection = true;
        }
      });
      
      // Convert sections object to array and sort by their first item's index
      const sectionsArray = Object.values(sections).sort((a, b) => {
        const aFirstIndex = a.items[0]?.index || 0;
        const bFirstIndex = b.items[0]?.index || 0;
        return aFirstIndex - bFirstIndex;
      });
      
      return { 
        sectionsWithItems: sectionsArray, 
        itemsWithoutSection: noSectionItems,
        colSections: [] // Not relevant in row mode
      };
    }
    // Handle column reordering case
    else {
      const sections = {};
      const noSectionItems = [];
      
      // Use first row to get column sections
      if (rows[0]) {
        rows[0].slice(1).forEach((cell, colIndex) => {
          const realColIndex = colIndex + 1; // Skip first column
          const section = cell?.section;
          const sectionId = section?.sectionId;
          
          // Generate a consistent and unique ID for this column
          const colId = `col-${colIndex}`;
          
          if (sectionId) {
            // Initialize section if it doesn't exist yet
            if (!sections[sectionId]) {
              sections[sectionId] = {
                sectionInfo: JSON.parse(JSON.stringify(section)), // Deep copy to avoid reference issues
                sectionId,
                items: []
              };
            }
            
            // Add this column to its section
            sections[sectionId].items.push({
              id: colId,
              index: realColIndex,
              sectionId,
              isOnlyItemInSection: false, // We'll update this in the second pass
              originalData: rows.map(row => row[realColIndex]) // Store original column data
            });
          } else {
            // No section, add to unsectioned items
            noSectionItems.push({
              id: colId,
              index: realColIndex,
              sectionId: null,
              isOnlyItemInSection: false,
              originalData: rows.map(row => row[realColIndex]) // Store original column data
            });
          }
        });
      }
      
      // Second pass: mark items that are alone in their section
      Object.values(sections).forEach(section => {
        if (section.items.length === 1) {
          section.items[0].isOnlyItemInSection = true;
        }
      });
      
      // Convert sections object to array and sort by their first item's index
      const sectionsArray = Object.values(sections).sort((a, b) => {
        const aFirstIndex = a.items[0]?.index || 0;
        const bFirstIndex = b.items[0]?.index || 0;
        return aFirstIndex - bFirstIndex;
      });
      
      return { 
        sectionsWithItems: sectionsArray, 
        itemsWithoutSection: noSectionItems,
        colSections: sectionsArray 
      };
    }
    // Added forceRegroupKey to force re-evaluation when section changes happen
    // This is critical for ensuring section changes are reflected in the UI immediately
  }, [rows, reorderAxis, columns, forceRegroupKey]);
  
  // Handle item reordering (with a completely restructured approach for virtual-to-real array translation)
  const handleItemReorder = (newState, sectionId = null) => {
    setIsLoading(true);
    
    try {
      console.log('===== HANDLING ITEM REORDER =====');
      console.log('Target section:', sectionId);
      console.log('New state items:', newState.length);
      console.log('Items dragged to section:', newState.map(item => item.id));
      
      // Step 1: Get the current flat array data (original)
      const originalRows = JSON.parse(JSON.stringify(rows));
      
      // Step 2: Create position tracking maps for original data
      // This gives us fast lookup by index or by ID
      const rowsByIndex = {}; // For looking up by index position
      const rowsById = {};    // For looking up by ID
      
      // Build the lookup tables
      originalRows.forEach((row, index) => {
        rowsByIndex[index] = row;
        
        // Use ID from row if available, otherwise generate one
        const rowId = row[0]?.id || `row-${index}`;
        if (!row[0]?.id && row[0]) {
          // Add ID if missing (improves stability)
          row[0].id = rowId;
        }
        
        rowsById[rowId] = {
          row,
          index,
          sectionId: row[0]?.section?.sectionId || null
        };
      });
      
      // Step 3: Handle row reordering based on the new hierarchical state from sortable
      if (reorderAxis === 'rows') {
        console.log('Translating hierarchical sortable state back to flat array');
        
        // CRITICAL: Track section assignments that need to be updated
        // Any item now in this newState list that wasn't in this section before
        // needs its section assignment updated
        const sectionUpdates = [];
        
        // Analyze each item in the new section state to determine required changes
        newState.forEach(item => {
          // Get the original item's data for comparison
          const originalItemData = rowsById[item.id];
          
          // Skip invalid items that we can't find
          if (!originalItemData) {
            console.warn(`Could not find original data for item ${item.id}`);
            return;
          }
          
          const origSectionId = originalItemData.sectionId;
          
          // If section has changed, track that we need to update it
          if (origSectionId !== sectionId) {
            console.log(`Item ${item.id} moved from section ${origSectionId || 'none'} to ${sectionId || 'none'}`);
            
            sectionUpdates.push({
              id: item.id,
              rowIndex: originalItemData.index,
              fromSectionId: origSectionId,
              toSectionId: sectionId,
              row: originalItemData.row
            });
          }
        });
        
        console.log('Items requiring section updates:', sectionUpdates.length);
        
        // Step 4: Apply section updates to original row data
        // This updates the section property on each row that moved between sections
        sectionUpdates.forEach(update => {
          console.log(`Updating section for row ${update.rowIndex} from ${update.fromSectionId || 'none'} to ${update.toSectionId || 'none'}`);
          
          // Get the row that needs updating
          const rowToUpdate = originalRows[update.rowIndex];
          if (!rowToUpdate || !rowToUpdate[0]) {
            console.warn(`Could not find row at index ${update.rowIndex} to update section`);
            return;
          }
          
          // Create a fresh copy of the first cell to avoid reference issues
          const updatedFirstCell = { ...rowToUpdate[0] };
          
          if (update.toSectionId) {
            // Find an example of a row with this section to copy its structure
            const exampleRow = originalRows.find(
              r => r[0]?.section?.sectionId === update.toSectionId
            );
            
            if (exampleRow && exampleRow[0]?.section) {
              // Copy the section structure from the example
              updatedFirstCell.section = JSON.parse(JSON.stringify(exampleRow[0].section));
            } else {
              // Create a basic section if we can't find a good example
              updatedFirstCell.section = {
                sectionId: update.toSectionId,
                sectionName: `Section ${update.toSectionId}`
              };
            }
            
            console.log(`✅ Set section ${update.toSectionId} for row ${update.rowIndex}`);
          } else {
            // Remove section assignment
            delete updatedFirstCell.section;
            console.log(`🗑️ Removed section from row ${update.rowIndex}`);
          }
          
          // Replace the first cell in the row
          rowToUpdate[0] = updatedFirstCell;
        });
        
        // Step 5: Now we need to rebuild the array in the correct order
        // We'll track rows in each section (including the moves we just processed above)
        const sectionsMap = {};
        const unsectionedRows = [];
        
        // Organize rows by section
        originalRows.forEach((row, idx) => {
          const sectionId = row[0]?.section?.sectionId;
          const rowId = row[0]?.id || `row-${idx}`;
          
          if (sectionId) {
            if (!sectionsMap[sectionId]) {
              sectionsMap[sectionId] = [];
            }
            sectionsMap[sectionId].push({ row, rowId, originalIndex: idx });
          } else {
            unsectionedRows.push({ row, rowId, originalIndex: idx });
          }
        });
        
        // Step 6: Build final array in the correct order based on the sortable state
        let finalRows = [];
        const processedIds = new Set();
        
        // If this section is the target of the drag operation,
        // we need to order its items according to the newState
        if (sectionId !== null && sectionsMap[sectionId]) {
          // Get rows for this section
          const sectionRows = sectionsMap[sectionId];
          
          // Create a lookup map by ID for quick access
          const sectionRowsById = {};
          sectionRows.forEach(rowData => {
            sectionRowsById[rowData.rowId] = rowData;
          });
          
          // Items in newState represent the new ordering within this section
          const orderedSectionRows = [];
          
          // Process items in their new order from the sortable state
          newState.forEach(item => {
            // First check if we can find it in sectionRowsById (already in this section)
            let rowData = sectionRowsById[item.id];
            
            // If not found, it might be an item from another section that was dragged here
            if (!rowData) {
              // Look for this item in the original rows
              for (const [idx, row] of originalRows.entries()) {
                const rowId = row[0]?.id || `row-${idx}`;
                if (rowId === item.id) {
                  // Found the item in original data, prepare it to be added to this section
                  const rowCopy = JSON.parse(JSON.stringify(row));
                  
                  // Update its section assignment to the new section
                  if (sectionId) {
                    // Find an example row with this section to use as template
                    const exampleRow = originalRows.find(r => 
                      r[0]?.section?.sectionId === sectionId
                    );
                    
                    if (exampleRow && exampleRow[0]?.section) {
                      // Copy section structure from template
                      rowCopy[0].section = JSON.parse(JSON.stringify(exampleRow[0].section));
                    } else {
                      // Create basic section structure
                      rowCopy[0].section = {
                        sectionId: sectionId,
                        sectionName: `Section ${sectionId}`
                      };
                    }
                  } else {
                    // Remove section if it's being moved to unsectioned area
                    if (rowCopy[0]) {
                      delete rowCopy[0].section;
                    }
                  }
                  
                  // Use this modified row
                  rowData = {
                    row: rowCopy,
                    rowId: item.id,
                    originalIndex: idx
                  };
                  
                  // Add to processed IDs to prevent duplicates
                  console.log(`Item ${item.id} was moved from another section to section ${sectionId || 'unsectioned'}`);
                  break;
                }
              }
            }
            
            // If we found the row data (either in this section or from another section)
            if (rowData) {
              orderedSectionRows.push(rowData.row);
              processedIds.add(rowData.rowId);
            }
          });
          
          // Add any remaining items in the section that weren't in newState
          sectionRows.forEach(rowData => {
            if (!processedIds.has(rowData.rowId)) {
              orderedSectionRows.push(rowData.row);
              processedIds.add(rowData.rowId);
            }
          });
          
          console.log(`Ordered section ${sectionId} with ${orderedSectionRows.length} rows`);
          
          // Add this section's rows to the final array
          finalRows.push(...orderedSectionRows);
        }
        
        // Process unsectioned rows if they are the target of the drag
        if (sectionId === null && unsectionedRows.length > 0) {
          // Create map for quick lookup
          const unsectionedRowsById = {};
          unsectionedRows.forEach(rowData => {
            unsectionedRowsById[rowData.rowId] = rowData;
          });
          
          // Order according to newState
          const orderedUnsectionedRows = [];
          
          // Process items in their new order
          newState.forEach(item => {
            // First check if we can find it in unsectionedRowsById (already unsectioned)
            let rowData = unsectionedRowsById[item.id];
            
            // If not found, it might be an item from a section that was dragged to unsectioned
            if (!rowData) {
              // Look for this item in the original rows
              for (const [idx, row] of originalRows.entries()) {
                const rowId = row[0]?.id || `row-${idx}`;
                if (rowId === item.id) {
                  // Found the item in original data, prepare it for unsectioned area
                  const rowCopy = JSON.parse(JSON.stringify(row));
                  
                  // Remove section assignment
                  if (rowCopy[0] && rowCopy[0].section) {
                    delete rowCopy[0].section;
                    console.log(`Removed section from row ${rowId} as it was moved to unsectioned area`);
                  }
                  
                  rowData = {
                    row: rowCopy,
                    rowId: item.id,
                    originalIndex: idx
                  };
                  
                  console.log(`Item ${item.id} was moved from a section to unsectioned area`);
                  break;
                }
              }
            }
            
            if (rowData) {
              orderedUnsectionedRows.push(rowData.row);
              processedIds.add(rowData.rowId);
            }
          });
          
          // Add any remaining unsectioned items that weren't in newState
          unsectionedRows.forEach(rowData => {
            if (!processedIds.has(rowData.rowId)) {
              orderedUnsectionedRows.push(rowData.row);
              processedIds.add(rowData.rowId);
            }
          });
          
          console.log(`Ordered unsectioned area with ${orderedUnsectionedRows.length} rows`);
          
          // Add unsectioned rows to the final array
          finalRows.push(...orderedUnsectionedRows);
        }
        
        // Now add all other sections (those not involved in the current drag)
        // We preserve their original ordering
        Object.keys(sectionsMap).forEach(secId => {
          // Skip the section we already processed
          if (secId === sectionId) return;
          
          const sectionRows = sectionsMap[secId].map(data => data.row);
          console.log(`Adding ${sectionRows.length} rows from untouched section ${secId}`);
          finalRows.push(...sectionRows);
        });
        
        // Add any remaining unsectioned rows (if unsectioned wasn't the target)
        if (sectionId !== null) {
          const remainingUnsectioned = unsectionedRows
            .filter(data => !processedIds.has(data.rowId))
            .map(data => data.row);
            
          console.log(`Adding ${remainingUnsectioned.length} untouched unsectioned rows`);
          finalRows.push(...remainingUnsectioned);
        }
        
        // Final validation to prevent data loss
        if (finalRows.length !== originalRows.length) {
          console.error(`⚠️ Row count mismatch! Original: ${originalRows.length}, New: ${finalRows.length}`);
          
          // If we have fewer rows than before, revert to original to prevent data loss
          if (finalRows.length < originalRows.length) {
            console.warn('Row count decreased! Reverting to original rows to prevent data loss.');
            setIsLoading(false);
            return; // Don't update state
          }
        }
        
        // Optional validation: Double check section assignments for items that were moved
        sectionUpdates.forEach(update => {
          // Find the row in our final array that corresponds to this update
          const rowToCheck = finalRows.find(row => 
            row[0]?.id === update.id || 
            finalRows.indexOf(row) === update.rowIndex
          );
          
          if (!rowToCheck) {
            console.warn(`Could not find row to verify section: ${update.id}`);
            return;
          }
          
          const actualSectionId = rowToCheck[0]?.section?.sectionId;
          const expectedSectionId = update.toSectionId;
          
          // Verify section assignment is correct
          if (actualSectionId !== expectedSectionId) {
            console.error(`Section mismatch for row ${update.id}: expected ${expectedSectionId}, got ${actualSectionId}`);
            
            // Fix the section right here
            if (expectedSectionId) {
              // Find another row with the right section as template
              const templateRow = finalRows.find(r => r[0]?.section?.sectionId === expectedSectionId);
              
              if (templateRow && templateRow[0]?.section) {
                // Copy section structure
                rowToCheck[0] = { 
                  ...rowToCheck[0],
                  section: JSON.parse(JSON.stringify(templateRow[0].section))
                };
              } else {
                // Create minimal section
                rowToCheck[0] = {
                  ...rowToCheck[0],
                  section: {
                    sectionId: expectedSectionId,
                    sectionName: `Section ${expectedSectionId}`
                  }
                };
              }
              console.log(`Fixed section assignment for row ${update.id}`);
            } else {
              // Should have no section
              delete rowToCheck[0].section;
              console.log(`Removed incorrect section from row ${update.id}`);
            }
          }
        });
        
        // Update the rows with a deep clone to ensure no reference issues
        const safeFinalRows = JSON.parse(JSON.stringify(finalRows));
        console.log('Setting new rows:', safeFinalRows.length);
        
        // Update the main data array
        setRows(safeFinalRows);
        
        // Force a regroup to ensure the UI reflects the updated structure
        // Do this directly instead of with setTimeout to avoid timing issues
        setForceRegroupKey(prev => prev + 1);
      } else {
        // --------- HANDLE COLUMN REORDERING -----------
        // Column reordering with section support
        const newRows = originalRows.map(row => {
          // Always keep the first column (row headers)
          const newRow = [JSON.parse(JSON.stringify(row[0]))]; 
          
          // Get all column indices from newState
          const colIndices = newState.map(item => item.index);
          
          // Add columns in the order specified by newState
          for (const colIndex of colIndices) {
            if (row[colIndex]) {
              // Make a deep copy of the column
              const colCopy = JSON.parse(JSON.stringify(row[colIndex]));
              
              // Update column section if it changed (for the header row)
              if (row === originalRows[0]) {
                const originalSectionId = colCopy?.section?.sectionId;
                
                // If this column now belongs to a new section
                if (originalSectionId !== sectionId) {
                  if (sectionId) {
                    // Find section info
                    const sectionInfo = colSections.find(s => s.sectionId === sectionId)?.sectionInfo;
                    if (sectionInfo) {
                      colCopy.section = JSON.parse(JSON.stringify(sectionInfo));
                    }
                  } else {
                    // Remove section
                    delete colCopy.section;
                  }
                }
              }
              
              newRow.push(colCopy);
            }
          }
          
          // Add any columns that weren't included in newState (from other sections)
          for (let j = 1; j < row.length; j++) {
            if (!colIndices.includes(j)) {
              newRow.push(JSON.parse(JSON.stringify(row[j])));
            }
          }
          
          return newRow;
        });
        
        // Final check to ensure all columns are preserved
        if (newRows[0].length !== originalRows[0].length) {
          console.error(`Column count mismatch! Original: ${originalRows[0].length}, New: ${newRows[0].length}`);
          
          if (newRows[0].length < originalRows[0].length) {
            console.warn('Column count decreased! Reverting to prevent data loss.');
            setIsLoading(false);
            return;
          }
        }
        
        // Call setRows with a deep clone of the new array
        const safeNewRows = JSON.parse(JSON.stringify(newRows));
        setRows(safeNewRows);
        
        // Force a regroup directly to ensure the UI reflects the updated structure
        setForceRegroupKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error in handleItemReorder:', error);
      // Don't update state on error
      setIsLoading(false);
      return;
    }
    
    // Clear loading state after a very short delay
    // Just enough to allow the UI to show the loading indicator briefly
    setTimeout(() => {
      setIsLoading(false);
      console.log('✅ Reordering operation completed successfully');
    }, 100);
  };
  // Render a sortable item (row or column)
  const renderItem = (item, rowIndex = null, colIndex = null) => {
    // Handle row mode
    if (reorderAxis === 'rows') {
      // Safely get the row data
      const rowIndex = item.index;
      
      // Safety check - make sure the row exists
      if (!rows[rowIndex] || !rows[rowIndex][0]) {
        console.warn(`Row at index ${rowIndex} not found or has invalid structure`);
        return (
          <div 
            key={item.id}
            className="reorder-item-container"
            style={{ 
              padding: '10px', 
              margin: '5px 0',
              backgroundColor: '#ffebee',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              position: 'relative',
            }}
          >
            Invalid row data
          </div>
        );
      }
      
      const row = rows[rowIndex];
      const cannotDrag = item.isOnlyItemInSection;
      
      return (
        <div
          key={item.id}
          className={`reorder-item-container ${cannotDrag ? "undraggable-item" : ""}`}
          style={{ 
            padding: '10px', 
            margin: '5px 0',
            backgroundColor: cannotDrag ? '#fff9f9' : 'white',
            border: cannotDrag ? '1px dashed #ffcccc' : '1px solid #ddd',
            borderRadius: '4px',
            cursor: cannotDrag ? 'not-allowed' : 'grab',
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}
          title={cannotDrag ? "Cannot move: This is the only item in this section" : "Drag to reorder"}
        >
          {/* Drag handle */}
          {!cannotDrag && (
            <div className="drag-handle" style={{ 
              cursor: 'grab', 
              marginRight: '10px',
              color: '#757575'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path>
              </svg>
            </div>
          )}
          
          {/* Display row content */}
          <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            {row[0]?.id && (
              <span style={{ 
                backgroundColor: '#e0e0e0', 
                padding: '3px 5px',
                marginRight: '10px',
                borderRadius: '3px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {row[0].id}
              </span>
            )}
            {/* Display value directly without title prefix */}
            <span style={{ fontWeight: row[0]?.name ? 'normal' : 'italic' }}>
              {row[0]?.value || (!row[0]?.name ? `Row ${rowIndex + 1}` : '')}
            </span>
          </div>
          
          {/* Add a lock icon for items that can't be moved */}
          {cannotDrag && (
            <span style={{ 
              marginLeft: 'auto',
              color: '#ff5252',
              fontSize: '14px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"></path>
              </svg>
            </span>
          )}
        </div>
      );
    } 
    // Handle column mode
    else {
      // Safely get column data
      const colIndex = item.index;
      
      // Safety check - make sure the column exists
      if (!rows[0] || !rows[0][colIndex]) {
        console.warn(`Column at index ${colIndex} not found or has invalid structure`);
        return (
          <div 
            key={item.id}
            className="reorder-item-container"
            style={{ 
              padding: '10px', 
              margin: '5px 0',
              backgroundColor: '#ffebee',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              position: 'relative',
            }}
          >
            Invalid column data
          </div>
        );
      }
      
      const cell = rows[0][colIndex]; // Get column header from first row
      const cannotDrag = item.isOnlyItemInSection;
      
      return (
        <div
          key={item.id}
          className={`reorder-item-container ${cannotDrag ? "undraggable-item" : ""}`}
          style={{ 
            padding: '10px 15px', 
            margin: '5px 0',
            backgroundColor: cannotDrag ? '#fff9f9' : 'white',
            border: cannotDrag ? '1px dashed #ffcccc' : '1px solid #ddd',
            borderRadius: '4px',
            cursor: cannotDrag ? 'not-allowed' : 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            textAlign: 'left',
            position: 'relative',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={cannotDrag ? "Cannot move: This is the only column in this section" : "Drag to reorder"}
        >
          {/* Drag handle */}
          {!cannotDrag && (
            <div className="drag-handle" style={{ 
              cursor: 'grab', 
              marginRight: '10px',
              color: '#757575'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"></path>
              </svg>
            </div>
          )}
          
          {/* Display column name */}
          <div style={{ 
            flexGrow: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {cell?.name ? (
              <span style={{ fontWeight: 'bold' }}>
                {cell.name}
              </span>
            ) : (
              <em>Column {colIndex}</em>
            )}
          </div>
          
          {/* Add a lock icon for items that can't be moved */}
          {cannotDrag && (
            <span style={{ 
              marginLeft: '8px',
              color: '#ff5252',
              fontSize: '14px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"></path>
              </svg>
            </span>
          )}
        </div>
      );
    }
  };

  // Render either rows or columns in their section groups
  const renderItems = () => {
    const isRowMode = reorderAxis === 'rows';
    const sections = isRowMode ? sectionsWithItems : colSections;
    const unsectionedItems = itemsWithoutSection || [];
    
    // Debug the sections structure to ensure they're in the right order
    if (DEBUG_VIRTUAL_ARRAY) {
      console.log('Sections to render:', sections.map(s => ({
        id: s.sectionId,
        name: s.sectionInfo.sectionName,
        itemCount: s.items.length,
        firstItemIndex: s.items[0]?.index
      })));
    }
    
    // Safety check - verify data
    if (!sections || !Array.isArray(sections)) {
      console.warn('Invalid sections data:', sections);
      return <div>Error loading sections data</div>;
    }
    
    // Debug logging to help diagnose issues
    console.debug('Rendering with data:', {
      rowCount: rows.length,
      columnCount: rows[0]?.length || 0,
      sectionCount: sections.length,
      unsectionedCount: unsectionedItems.length,
      mode: isRowMode ? 'rows' : 'columns'
    });
    
    return (
      <div className="sortable-nested-container">
        {/* First render all sections with their headers and items */}
        {[...sections].map((section) => {
          // Safety checks 
          if (!section || !section.sectionId || !section.sectionInfo) {
            console.warn('Invalid section data:', section);
            return null;
          }
          
          // Safety check for section items
          if (!section.items || !Array.isArray(section.items) || section.items.length === 0) {
            return (
              <div key={`empty-section-${section.sectionId}`} className="section-group">
                <SectionHeader 
                  section={section.sectionInfo} 
                  sectionId={section.sectionId}
                />
                <div className="section-items-empty" style={{
                  padding: '10px 20px',
                  color: '#999',
                  fontStyle: 'italic',
                  borderLeft: '1px solid #e0e0e0',
                  marginLeft: '10px'
                }}>
                  No items in this section
                </div>
              </div>
            );
          }
          
          return (
            <div key={`section-group-${section.sectionId}`} className="section-group">
              {/* Section header is part of this group but not draggable */}
              <SectionHeader 
                section={section.sectionInfo} 
                sectionId={section.sectionId}
              />
              
              {/* Items within this section can be reordered */}
              <ReactSortable
                key={`section-items-${section.sectionId}`}
                list={section.items}
                setList={(newState) => handleItemReorder(newState, section.sectionId)}
                animation={150}
                ghostClass="sortable-ghost"
                chosenClass="sortable-chosen"
                dragClass="sortable-drag"
                handle=".drag-handle"
                filter=".undraggable-item"
                forceFallback={true}
                fallbackClass="sortable-fallback"
                removeCloneOnHide={true}
                emptyInsertThreshold={10}
                delayOnTouchOnly={true}
                delay={100}
                group={{
                  name: isRowMode ? "rows" : "columns",
                  pull: true,
                  put: true
                }}
                className="section-items"
                style={{
                  paddingLeft: '20px', // Indent section items
                  borderLeft: '1px solid #e0e0e0',
                  marginLeft: '10px'
                }}
              >
                {section.items.map((item) => {
                  // Safety check for item
                  if (!item || typeof item.index !== 'number') {
                    console.warn('Invalid item in section:', item);
                    return null;
                  }
                  return renderItem(item);
                })}
              </ReactSortable>
            </div>
          );
        })}
        
        {/* Then render unsectioned items in their own group */}
        {unsectionedItems.length > 0 && (
          <div className="unsectioned-group" style={{ marginTop: '20px' }}>
            <div className="unsectioned-header" style={{ 
              padding: '8px 12px',
              backgroundColor: '#f5f5f5',
              marginBottom: '8px',
              fontSize: '0.9em',
              color: '#757575',
              borderRadius: '4px',
              borderLeft: '4px solid #bdbdbd',
            }}>
              Unsectioned {isRowMode ? 'Rows' : 'Columns'}
            </div>
            
            <ReactSortable
              key="unsectioned-items"
              list={unsectionedItems}
              setList={(newState) => handleItemReorder(newState, null)}
              animation={150}
              ghostClass="sortable-ghost"
              chosenClass="sortable-chosen"
              dragClass="sortable-drag"
              handle=".drag-handle"
              filter=".undraggable-item"
              forceFallback={true}
              fallbackClass="sortable-fallback"
              removeCloneOnHide={true}
              emptyInsertThreshold={10}
              delayOnTouchOnly={true}
              delay={100}
              group={{
                name: isRowMode ? "rows" : "columns",
                pull: true,
                put: true
              }}
              className="unsectioned-items"
            >
              {unsectionedItems.map((item) => {
                // Safety check for item
                if (!item || typeof item.index !== 'number') {
                  console.warn('Invalid unsectioned item:', item);
                  return null;
                }
                return renderItem(item);
              })}
            </ReactSortable>
          </div>
        )}
      </div>
    );
  };
  
  // Handle future section reordering (moving entire sections)
  // eslint-disable-next-line no-unused-vars
  const handleSectionReorder = (newSectionsOrder) => {
    // This function is prepared for future implementation
    // It will be called when sections themselves are reordered
    // For now, it's just a placeholder as we're focused on 
    // the sectioned item reordering
    
    // setIsLoading(true);
    
    // Logic for reordering entire sections would go here
    
    // setTimeout(() => {
    //   setIsLoading(false);
    // }, 200);
  };
  
  // Debug utility to track section assignments - helps diagnose section issues
  const logSectionAssignments = (rowsData, label = "Current sections") => {
    console.log(`🔍 ${label}:`);
    
    // Track sections by ID
    const sectionCounts = {};
    const sectionItems = {};
    
    rowsData.forEach((row, idx) => {
      const sectionId = row[0]?.section?.sectionId;
      const rowId = row[0]?.id || `row-${idx}`;
      const value = row[0]?.value || 'Unknown';
      
      if (sectionId) {
        sectionCounts[sectionId] = (sectionCounts[sectionId] || 0) + 1;
        sectionItems[sectionId] = sectionItems[sectionId] || [];
        sectionItems[sectionId].push({ rowId, value, index: idx });
      } else {
        sectionCounts['unsectioned'] = (sectionCounts['unsectioned'] || 0) + 1;
        sectionItems['unsectioned'] = sectionItems['unsectioned'] || [];
        sectionItems['unsectioned'].push({ rowId, value, index: idx });
      }
    });
    
    console.log('Section counts:', sectionCounts);
    console.log('Section items:', sectionItems);
  };
  
  return (
    <div 
      className="reorder-mode-container"
      style={{
        padding: '20px',
        backgroundColor: '#f8f8f8',
        borderRadius: '8px',
        maxHeight: '600px',
        overflow: 'auto',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0',
        position: 'relative'
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3f51b5',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            animation: 'spin 1s linear infinite',
          }}></div>
        </div>
      )}
      
      {/* Render items or show message if empty */}
      {rows.length === 0 ? (
        <div>No {reorderAxis} to reorder</div>
      ) : (
        <div className="sortable-nested-container">
          {/* Main wrapper for future section reordering */}
          {/* For now, we're just rendering the items with their sections */}
          {/* In the future, this could be a top-level ReactSortable */}
          {renderItems()}
        </div>
      )}
    </div>
  );
};

export default SortableReorderMode;
