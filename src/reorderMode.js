import React, { useState, useRef, useEffect, useMemo } from 'react';
import './reorderMode.css';

/**
 * ReorderMode3 - Simplified section-aware drag and drop with virtual array mapping
 */

// Debug mode - can be turned on for additional information
// Set to true to show virtual array mapping and position indicators
const DEBUG_MODE = false;
// Set to true to show outline around drop indicators for positioning debugging
const DEBUG_OUTLINES = false;

/**
 * Virtual Position Types:
 * - ITEM: A regular draggable item
 * - SECTION_START: The start of a section (drop target)
 * - SECTION_END: The end of a section (drop target)
 * - SECTION_BETWEEN: Between sections (drop target)
 */
const POSITION_TYPE = {
  ITEM: 'item',
  SECTION_START: 'section_start',
  SECTION_END: 'section_end',
  SECTION_BETWEEN: 'section_between'
};

/**
 * Direct DOM-attached Drop Indicator - for maximum positioning accuracy
 */
const DropIndicator = ({ item }) => {
  if (!item) return null;
  
  // Use the DOM node directly
  const element = item.node;
  if (!element) return null;
  
  // Get the client rect for precise positioning
  const rect = element.getBoundingClientRect();
  
  // Determine position based on position type and position
  const isTop = item.type === POSITION_TYPE.SECTION_START || item.position === 'before';
  const isSection = item.type !== POSITION_TYPE.ITEM;
  
  // Create styles for the indicator - use exact pixel positioning
  const lineStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '3px',
    backgroundColor: isSection ? '#673ab7' : '#4d90fe', 
    boxShadow: isSection ? '0 0 8px #673ab7' : '0 0 8px #4d90fe',
    zIndex: 1000,
    top: isTop ? 0 : '100%',
    transform: 'translateY(-50%)'
  };
  
  // Create styles for the label - ensure it doesn't overlap with the item
  const labelStyle = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: isTop ? '-20px' : 'calc(100% + 5px)',
    backgroundColor: isSection ? '#673ab7' : '#4d90fe',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    zIndex: 1001,
    pointerEvents: 'none'
  };
  
  // Get appropriate description
  let description = '';
  if (item.type === POSITION_TYPE.SECTION_START) {
    description = `Start of ${item.sectionName || 'section'}`;
  } else if (item.type === POSITION_TYPE.SECTION_END) {
    description = `End of ${item.sectionName || 'section'}`;
  } else if (item.type === POSITION_TYPE.SECTION_BETWEEN) {
    description = 'Between sections';
  } else {
    description = item.position === 'before' ? 'Before item' : 'After item';
  }
  
  // Create a wrapper that matches the exact dimensions and position of the target element
  return (
    <div 
      className="drop-indicator-wrapper" 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        pointerEvents: 'none',
        outline: DEBUG_OUTLINES ? '1px dashed red' : 'none',
        outlineOffset: DEBUG_OUTLINES ? '-1px' : '0'
      }}
    >
      <div className="drop-indicator" style={lineStyle} />
      <div className="drop-indicator-label" style={labelStyle}>
        {description}
        {DEBUG_MODE && (
          <span style={{ display: 'block', fontSize: '9px' }}>
            {item.type}.{item.position} (idx: {item.index})
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Section Header Component
 */
const SectionHeader = React.forwardRef(({ section, onDragOver }, ref) => {
  return (
    <div 
      ref={ref}
      className="section-header"
      style={{
        padding: '8px 12px',
        backgroundColor: '#e8eaf6',
        borderRadius: '4px',
        marginBottom: '12px',
        fontWeight: 'bold',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        borderLeft: '4px solid #3f51b5',
        position: 'relative' // Important for drop indicator positioning
      }}
      onDragOver={onDragOver}
    >
      <span style={{ marginRight: '8px', color: '#3f51b5' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z"></path>
        </svg>
      </span>
      {section.sectionName}
    </div>
  );
});

/**
 * Main ReorderMode component
 */
const ReorderMode = ({
  reorderAxis,
  rows,
  columns,
  dragOverIndex,
  insertionLineTop,
  handleDragStart: externalDragStart,
  handleDragMove: externalDragMove,
  handleDragEnd: externalDragEnd,
  liRefs,
  colRefs,
  setRows
}) => {
  // Refs for DOM elements
  const sectionRefs = useRef({});
  const itemRefs = useRef({});
  
  // State for drag operations
  const [draggingItem, setDraggingItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extract sections from rows data
  const rowSections = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    const uniqueSections = new Map();
    
    rows.forEach(row => {
      const section = row[0]?.section;
      if (section && !uniqueSections.has(section.sectionId)) {
        uniqueSections.set(section.sectionId, section);
      }
    });
    
    return Array.from(uniqueSections.values());
  }, [rows]);
  
  // Extract column sections from rows data
  const colSections = useMemo(() => {
    if (!rows || rows.length === 0 || rows[0].length <= 1) return [];
    
    const uniqueSections = new Map();
    
    // Use first row to get column sections
    rows[0].slice(1).forEach(cell => {
      const section = cell?.section;
      if (section && !uniqueSections.has(section.sectionId)) {
        uniqueSections.set(section.sectionId, section);
      }
    });
    
    return Array.from(uniqueSections.values());
  }, [rows]);
  
  // Build the virtual reorder array for rows
  const rowReorderArray = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    const virtualArray = [];
    let currentSectionId = null;
    let virtualIndex = 0;
    
    rows.forEach((row, realIndex) => {
      const rowSection = row[0]?.section;
      const sectionId = rowSection?.sectionId;
      
      // If this row starts a new section
      if (sectionId !== currentSectionId) {
        // If not the first section, add a SECTION_BETWEEN position
        if (currentSectionId !== null) {
          virtualArray.push({
            virtualIndex: virtualIndex++,
            type: POSITION_TYPE.SECTION_BETWEEN,
            position: 'between',
            beforeSectionId: currentSectionId,
            afterSectionId: sectionId,
            index: realIndex
          });
        }
        
        // Add SECTION_START position
        virtualArray.push({
          virtualIndex: virtualIndex++,
          type: POSITION_TYPE.SECTION_START,
          sectionId,
          sectionName: rowSection?.sectionName,
          position: 'before',
          index: realIndex
        });
        
        currentSectionId = sectionId;
      }
      
      // Add the row item
      virtualArray.push({
        virtualIndex: virtualIndex++,
        type: POSITION_TYPE.ITEM,
        sectionId,
        position: 'middle',
        index: realIndex
      });
      
      // If it's the last row of its section, add a SECTION_END position
      const isLastInSection = rows[realIndex + 1]?.[0]?.section?.sectionId !== sectionId;
      if (isLastInSection || realIndex === rows.length - 1) {
        virtualArray.push({
          virtualIndex: virtualIndex++,
          type: POSITION_TYPE.SECTION_END,
          sectionId,
          sectionName: rowSection?.sectionName,
          position: 'after',
          index: realIndex + 1
        });
        
        // Reset current section to handle potential gap (rows with no section)
        if (isLastInSection) {
          currentSectionId = null;
        }
      }
    });
    
    return virtualArray;
  }, [rows]);
  
  // Build the virtual reorder array for columns
  const colReorderArray = useMemo(() => {
    if (!rows || rows.length === 0 || rows[0].length <= 1) return [];
    
    const virtualArray = [];
    let currentSectionId = null;
    let virtualIndex = 0;
    
    // Use first row to build column virtual positions
    const firstRow = rows[0];
    
    // Skip the first column (row titles)
    firstRow.slice(1).forEach((cell, colIndex) => {
      // Add 1 to colIndex since we're skipping the first column
      const realColIndex = colIndex + 1;
      
      const colSection = cell?.section;
      const sectionId = colSection?.sectionId;
      
      // If this column starts a new section
      if (sectionId !== currentSectionId) {
        // If not the first section, add a SECTION_BETWEEN position
        if (currentSectionId !== null) {
          virtualArray.push({
            virtualIndex: virtualIndex++,
            type: POSITION_TYPE.SECTION_BETWEEN,
            position: 'between',
            beforeSectionId: currentSectionId,
            afterSectionId: sectionId,
            index: realColIndex
          });
        }
        
        // Add SECTION_START position
        virtualArray.push({
          virtualIndex: virtualIndex++,
          type: POSITION_TYPE.SECTION_START,
          sectionId,
          sectionName: colSection?.sectionName,
          position: 'before',
          index: realColIndex
        });
        
        currentSectionId = sectionId;
      }
      
      // Add the column item
      virtualArray.push({
        virtualIndex: virtualIndex++,
        type: POSITION_TYPE.ITEM,
        sectionId,
        position: 'middle',
        index: realColIndex
      });
      
      // If it's the last column of its section, add a SECTION_END position
      const isLastInSection = firstRow[realColIndex + 1]?.section?.sectionId !== sectionId;
      if (isLastInSection || realColIndex === firstRow.length - 1) {
        virtualArray.push({
          virtualIndex: virtualIndex++,
          type: POSITION_TYPE.SECTION_END,
          sectionId,
          sectionName: colSection?.sectionName,
          position: 'after',
          index: realColIndex + 1
        });
        
        // Reset current section to handle potential gap (columns with no section)
        if (isLastInSection) {
          currentSectionId = null;
        }
      }
    });
    
    return virtualArray;
  }, [rows]);
  
  // Get the appropriate reorder array based on reorderAxis
  const reorderArray = reorderAxis === 'rows' ? rowReorderArray : colReorderArray;
  const sections = reorderAxis === 'rows' ? rowSections : colSections;
  
  // Check if an item is the only one in its section
  const isOnlyItemInSection = (index, sectionId) => {
    if (!sectionId) return false;
    
    // For rows
    if (reorderAxis === 'rows') {
      // Count items with the same section ID
      const itemsInSection = rows.filter(row => 
        row[0]?.section?.sectionId === sectionId
      ).length;
      
      return itemsInSection === 1;
    }
    // For columns
    else {
      // Skip the first column (row titles) and count columns with the same section ID
      // Use first row to count section columns
      const colsInSection = rows[0].slice(1).filter((cell, colIndex) => 
        cell?.section?.sectionId === sectionId
      ).length;
      
      return colsInSection === 1;
    }
  };
  
  // Handle drag start
  const handleDragStart = (e, virtualIndex, node) => {
    const item = reorderArray.find(item => item.virtualIndex === virtualIndex);
    if (!item || item.type !== POSITION_TYPE.ITEM) return;
    
    // Get section ID for this item
    let sectionId = null;
    if (reorderAxis === 'rows') {
      sectionId = rows[item.index]?.[0]?.section?.sectionId;
    } else {
      // For columns, use the first row to get section ID
      sectionId = rows[0]?.[item.index]?.section?.sectionId;
    }
    
    // Check if this is the only item in its section
    if (sectionId && isOnlyItemInSection(item.index, sectionId)) {
      // Prevent dragging the only item in a section
      e.preventDefault();
      
      // Show visual feedback for why it can't be dragged
      if (node) {
        node.classList.add('not-draggable');
        setTimeout(() => node.classList.remove('not-draggable'), 800);
      }
      
      // Show a tooltip or notification that this item can't be moved (using CSS animation)
      const tooltip = document.createElement('div');
      tooltip.className = 'cannot-drag-tooltip';
      tooltip.textContent = 'Cannot move: This is the only item in this section';
      tooltip.style.position = 'absolute';
      tooltip.style.backgroundColor = '#ff5252';
      tooltip.style.color = 'white';
      tooltip.style.padding = '8px 12px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.zIndex = '1000';
      tooltip.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      tooltip.style.fontSize = '12px';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.animation = 'fadeInOut 2s forwards';
      
      // Position tooltip near the element
      const rect = node.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX}px`;
      tooltip.style.top = `${rect.top + window.scrollY - 40}px`;
      
      // Add to DOM and remove after animation
      document.body.appendChild(tooltip);
      setTimeout(() => document.body.removeChild(tooltip), 2000);
      
      return;
    }
    
    // Add dragging class
    if (node) {
      node.classList.add('dragging');
    }
    
    setDraggingItem({
      ...item,
      node // Store the DOM node
    });
    
    // Required for Firefox
    e.dataTransfer.setData('text/plain', '');
    
    // Call external handler if provided
    if (externalDragStart) {
      externalDragStart(e, item.index);
    }
  };
  
  // Handle drag over
  const handleDragOver = (e, virtualIndex, node) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggingItem || !node) return;
    
    // Find the item in the reorder array
    const item = reorderArray.find(item => item.virtualIndex === virtualIndex);
    if (!item) return;
    
    // Get mouse position relative to the element to determine if we're in the top or bottom half
    const rect = node.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;
    
    // For items, determine if we should show the indicator before or after the item
    // For section indicators, we keep the default position
    let position = item.position;
    if (item.type === POSITION_TYPE.ITEM) {
      position = isTopHalf ? 'before' : 'after';
    }
    
    // Update drop target with node reference for precise positioning and position information
    setDropTarget({
      ...item,
      position,
      node
    });
    
    // Add visual drop target class
    node.classList.add('drop-target');
    
    // Call external handler if provided
    if (externalDragMove) {
      externalDragMove(e);
    }
  };
  
  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove drop-target class
    if (e.currentTarget) {
      e.currentTarget.classList.remove('drop-target');
    }
  };
  
  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggingItem || !dropTarget) return;
    
    // Remove classes
    if (e.currentTarget) {
      e.currentTarget.classList.remove('drop-target');
    }
    
    // Skip if dropping on self
    if (draggingItem.virtualIndex === dropTarget.virtualIndex) {
      resetDragState();
      return;
    }
    
    // Check if source item is the only one in its section (additional safety check)
    const sourceIndex = draggingItem.index;
    let sourceSectionId;
    if (reorderAxis === 'rows') {
      sourceSectionId = rows[sourceIndex]?.[0]?.section?.sectionId;
    } else {
      sourceSectionId = rows[0][sourceIndex]?.section?.sectionId;
    }
    
    if (sourceSectionId && isOnlyItemInSection(sourceIndex, sourceSectionId)) {
      resetDragState();
      return;
    }
    
    // Show brief loading state
    setIsLoading(true);
    
    // Determine source and target indices
    const sourceItemIndex = draggingItem.index;
    let targetIndex = dropTarget.index;
    const targetSectionId = dropTarget.sectionId;
    
    // Adjust target index if dropping after an item
    if (dropTarget.type === POSITION_TYPE.ITEM && dropTarget.position === 'after') {
      targetIndex += 1;
    }
    
    if (reorderAxis === 'rows') {
      // Handle row reordering
      const newRows = [...rows];
      
      // Deep copy the source row
      const sourceRow = JSON.parse(JSON.stringify(newRows[sourceItemIndex]));
      
      // Remove the source row
      newRows.splice(sourceItemIndex, 1);
      
      // Adjust target index if needed
      let adjustedTargetIndex = targetIndex;
      if (targetIndex > sourceItemIndex) {
        adjustedTargetIndex--;
      }
      
      // Insert the row at the target position
      newRows.splice(adjustedTargetIndex, 0, sourceRow);
      
      // Update section if needed
      if (targetSectionId && targetSectionId !== sourceRow[0].section?.sectionId) {
        const targetSection = rowSections.find(s => s.sectionId === targetSectionId);
        if (targetSection) {
          sourceRow[0].section = { ...targetSection };
        }
      }
      
      // Update rows state
      setRows(newRows);
    } else {
      // Handle column reordering
      const newRows = rows.map(row => [...row]);
      
      // Move the column in each row
      newRows.forEach((row, rowIndex) => {
        // Deep copy the source cell
        const sourceCell = JSON.parse(JSON.stringify(row[sourceItemIndex]));
        
        // Remove source cell
        row.splice(sourceItemIndex, 1);
        
        // Adjust target index
        let adjustedTargetIndex = targetIndex;
        if (targetIndex > sourceItemIndex) {
          adjustedTargetIndex--;
        }
        
        // Insert at target position
        row.splice(adjustedTargetIndex, 0, sourceCell);
        
        // Update section if needed (only in first row)
        if (rowIndex === 0 && targetSectionId && sourceCell.section?.sectionId !== targetSectionId) {
          const targetSection = colSections.find(s => s.sectionId === targetSectionId);
          if (targetSection) {
            sourceCell.section = { ...targetSection };
            
            // Also update the section for this column in all other rows
            for (let i = 1; i < newRows.length; i++) {
              if (newRows[i][adjustedTargetIndex]) {
                newRows[i][adjustedTargetIndex].section = { ...targetSection };
              }
            }
          }
        }
      });
      
      // Update rows state
      setRows(newRows);
    }
    
    // Clear loading state after a brief delay
    setTimeout(() => {
      setIsLoading(false);
      resetDragState();
    }, 300);
  };
  
  // Reset drag state
  const resetDragState = () => {
    // Remove classes from any elements
    document.querySelectorAll('.dragging, .drop-target').forEach(elem => {
      elem.classList.remove('dragging', 'drop-target');
    });
    
    setDraggingItem(null);
    setDropTarget(null);
  };
  
  // Handle drag end
  const handleDragEnd = (e) => {
    resetDragState();
    
    // Call external handler if provided
    if (externalDragEnd) {
      externalDragEnd(e);
    }
  };
  
  // Render rows or columns based on reorderAxis
  const renderItems = () => {
    if (reorderAxis === 'rows') {
      // Render rows with their section headers
      return (
        <ul style={{ listStyleType: 'none', padding: 0, margin: 0, position: 'relative' }}>
          {rows.map((row, rowIndex) => {
            const isFirstInSection = rowIndex === 0 || 
              row[0]?.section?.sectionId !== rows[rowIndex - 1]?.[0]?.section?.sectionId;
            
            // Find the virtual index for this row
            const virtualItem = reorderArray.find(
              item => item.type === POSITION_TYPE.ITEM && item.index === rowIndex
            );
            
            // Find the corresponding section start if this is first in section
            const sectionStart = isFirstInSection ? reorderArray.find(
              item => item.type === POSITION_TYPE.SECTION_START && 
                     item.sectionId === row[0]?.section?.sectionId &&
                     item.index === rowIndex
            ) : null;
            
            // Generate a unique key for this row
            const rowKey = `row-${row[0]?.id || rowIndex}`;
            
            // Check if this is the last row in its section
            const isLastInSection = rowIndex === rows.length - 1 || 
              rows[rowIndex + 1]?.[0]?.section?.sectionId !== row[0]?.section?.sectionId;
            
            // Find the corresponding section end if this is last in section
            const sectionEnd = isLastInSection && row[0]?.section ? reorderArray.find(
              item => item.type === POSITION_TYPE.SECTION_END && 
                     item.sectionId === row[0]?.section?.sectionId &&
                     item.index === rowIndex + 1
            ) : null;
            
            const sectionId = row[0]?.section?.sectionId;
            const cannotDrag = sectionId && isOnlyItemInSection(rowIndex, sectionId);
            
            return (
              <React.Fragment key={rowKey}>
                {/* Render section header if this is the first row in its section */}
                {isFirstInSection && row[0]?.section && (
                  <SectionHeader 
                    ref={node => {
                      if (node && sectionStart) {
                        sectionRefs.current[`section-${row[0].section.sectionId}`] = node;
                      }
                    }}
                    section={row[0].section}
                    onDragOver={(e) => {
                      if (sectionStart) {
                        const node = sectionRefs.current[`section-${row[0].section.sectionId}`];
                        handleDragOver(e, sectionStart.virtualIndex, node);
                      }
                    }}
                  />
                )}
                
                {/* Render the row */}
                <li
                  ref={node => {
                    if (node) {
                      itemRefs.current[rowKey] = node;
                      if (liRefs && liRefs.current) liRefs.current[rowIndex] = node;
                    }
                  }}
                  draggable={!cannotDrag}
                  onDragStart={(e) => {
                    if (virtualItem) {
                      const node = itemRefs.current[rowKey];
                      handleDragStart(e, virtualItem.virtualIndex, node);
                    }
                  }}
                  className={cannotDrag ? "undraggable-item" : ""}
                  title={cannotDrag ? "Cannot move: This is the only item in this section" : "Drag to reorder"}
                  onDragOver={(e) => {
                    if (virtualItem) {
                      const node = itemRefs.current[rowKey];
                      handleDragOver(e, virtualItem.virtualIndex, node);
                    }
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  style={{ 
                    padding: '10px', 
                    margin: '5px 0',
                    backgroundColor: cannotDrag ? '#fff9f9' : 'white',
                    border: cannotDrag ? '1px dashed #ffcccc' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: cannotDrag ? 'not-allowed' : 'move',
                    position: 'relative' // Important for indicator positioning
                  }}
                >
                  {/* Display row content */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {row[0].id && (
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
                    <span style={{ fontWeight: row[0].name ? 'normal' : 'italic' }}>
                      {row[0].value || (!row[0].name ? `Row ${rowIndex + 1}` : '')}
                    </span>
                    
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
                  
                  {/* Drop indicator */}
                  {dropTarget && dropTarget.virtualIndex === virtualItem?.virtualIndex && (
                    <DropIndicator item={dropTarget} />
                  )}
                </li>
                
                {/* Render section end drop target if this is the last row in a section */}
                {isLastInSection && sectionEnd && row[0]?.section && (
                  <div 
                    ref={node => {
                      if (node && sectionEnd) {
                        sectionRefs.current[`section-end-${row[0].section.sectionId}`] = node;
                      }
                    }}
                    className="section-end-target"
                    onDragOver={(e) => {
                      if (sectionEnd) {
                        const node = sectionRefs.current[`section-end-${row[0].section.sectionId}`];
                        if (node) {
                          handleDragOver(e, sectionEnd.virtualIndex, node);
                        }
                      }
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      padding: '8px 0',
                      margin: '0',
                      position: 'relative',
                      minHeight: '10px'
                    }}
                  >
                    {dropTarget && dropTarget.virtualIndex === sectionEnd.virtualIndex && (
                      <DropIndicator item={dropTarget} />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </ul>
      );
    } else {
      // Render columns (skip the first column as it's the row titles)
      return (
        <div style={{ display: 'block', position: 'relative', padding: '0 0 20px 0' }}>
          {Array.from({ length: columns - 1 }).map((_, colIndex) => {
            // Add 1 to colIndex since we're skipping the first column
            const realColIndex = colIndex + 1;
            
            const isFirstInSection = colIndex === 0 || 
              rows[0][realColIndex]?.section?.sectionId !== rows[0][realColIndex - 1]?.section?.sectionId;
            
            // Find the virtual index for this column
            const virtualItem = reorderArray.find(
              item => item.type === POSITION_TYPE.ITEM && item.index === realColIndex
            );
            
            // Find the corresponding section start if this is first in section
            const sectionStart = isFirstInSection ? reorderArray.find(
              item => item.type === POSITION_TYPE.SECTION_START && 
                     item.sectionId === rows[0][realColIndex]?.section?.sectionId &&
                     item.index === realColIndex
            ) : null;
            
            // Check if this is the last column in its section
            const isLastInSection = colIndex === columns - 2 || 
              rows[0][realColIndex + 1]?.section?.sectionId !== rows[0][realColIndex]?.section?.sectionId;
            
            // Find the corresponding section end if this is last in section
            const sectionEnd = isLastInSection && rows[0][realColIndex]?.section ? reorderArray.find(
              item => item.type === POSITION_TYPE.SECTION_END && 
                     item.sectionId === rows[0][realColIndex]?.section?.sectionId &&
                     item.index === realColIndex + 1
            ) : null;
            
            // Generate a unique key for this column
            const colKey = `col-${colIndex}`;
            
            // Check if this column is the only one in its section
            const sectionId = rows[0][realColIndex]?.section?.sectionId;
            const cannotDrag = sectionId && isOnlyItemInSection(realColIndex, sectionId);
            
            return (
              <div 
                key={colKey}
                style={{ display: 'block', marginBottom: '10px', position: 'relative' }}
              >
                {/* Render section header if this is the first column in its section */}
                {isFirstInSection && rows[0][realColIndex]?.section && (
                  <SectionHeader 
                    ref={node => {
                      if (node && sectionStart) {
                        sectionRefs.current[`col-section-${rows[0][realColIndex].section.sectionId}`] = node;
                      }
                    }}
                    section={rows[0][realColIndex].section}
                    onDragOver={(e) => {
                      if (sectionStart) {
                        const node = sectionRefs.current[`col-section-${rows[0][realColIndex].section.sectionId}`];
                        handleDragOver(e, sectionStart.virtualIndex, node);
                      }
                    }}
                  />
                )}
                
                {/* Render the column */}
                <div
                      ref={node => {
                        if (node) {
                          itemRefs.current[colKey] = node;
                          if (colRefs && colRefs.current) colRefs.current[colIndex] = node;
                        }
                      }}
                      draggable={!cannotDrag}
                      className={cannotDrag ? "undraggable-item" : ""}
                      title={cannotDrag ? "Cannot move: This is the only column in this section" : "Drag to reorder"}
                      onDragStart={(e) => {
                        if (virtualItem) {
                          const node = itemRefs.current[colKey];
                          handleDragStart(e, virtualItem.virtualIndex, node);
                        }
                      }}
                  onDragOver={(e) => {
                    if (virtualItem) {
                      const node = itemRefs.current[colKey];
                      handleDragOver(e, virtualItem.virtualIndex, node);
                    }
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  style={{ 
                    padding: '10px 15px', 
                    margin: '5px 0',
                    backgroundColor: cannotDrag ? '#fff9f9' : 'white',
                    border: cannotDrag ? '1px dashed #ffcccc' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: cannotDrag ? 'not-allowed' : 'move',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    textAlign: 'left',
                    position: 'relative' // Important for indicator positioning
                  }}
                >
                  {/* Display only the column name, or a placeholder if empty */}
                  {rows[0][realColIndex].name ? (
                    <span style={{ fontWeight: 'bold' }}>{rows[0][realColIndex].name}</span>
                  ) : (
                    <em>Column {colIndex + 1}</em>
                  )}
                  
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
                  
                  {/* Drop indicator */}
                  {dropTarget && dropTarget.virtualIndex === virtualItem?.virtualIndex && (
                    <DropIndicator item={dropTarget} />
                  )}
                </div>
                
                {/* Render section end drop target if this is the last column in a section */}
                {isLastInSection && sectionEnd && rows[0][realColIndex]?.section && (
                  <div 
                    ref={node => {
                      if (node && sectionEnd) {
                        sectionRefs.current[`col-section-end-${rows[0][realColIndex].section.sectionId}`] = node;
                      }
                    }}
                    className="section-end-target"
                    onDragOver={(e) => {
                      if (sectionEnd) {
                        const node = sectionRefs.current[`col-section-end-${rows[0][realColIndex].section.sectionId}`];
                        if (node) {
                          handleDragOver(e, sectionEnd.virtualIndex, node);
                        }
                      }
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      padding: '8px 0',
                      margin: '0',
                      position: 'relative',
                      minHeight: '10px'
                    }}
                  >
                    {dropTarget && dropTarget.virtualIndex === sectionEnd.virtualIndex && (
                      <DropIndicator item={dropTarget} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  };
  
  return (
    <div 
      className="reorder-mode-container"
      style={{
        padding: '20px',
        backgroundColor: '#f8f8f8',
        borderRadius: '8px',
        maxHeight: '600px',
        overflowY: 'auto',
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
      {/* Header section removed for cleaner UI */}
      
      {reorderArray.length === 0 ? (
        <div>No {reorderAxis} to reorder</div>
      ) : renderItems()}
      
      {DEBUG_MODE && (
        <div style={{ marginTop: '20px', fontSize: '12px', fontFamily: 'monospace' }}>
          <h4>Virtual Reorder Array:</h4>
          <pre style={{ overflowX: 'auto' }}>
            {JSON.stringify(reorderArray, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ReorderMode;
