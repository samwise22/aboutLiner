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
 * NOTE: This component is referenced in several places in the render functions
 * and must return null to avoid rendering visual indicators
 */
const DropIndicator = ({ item }) => {
  return null;
};

/**
 * Section Header Component
 * The section header itself is not a drop zone, but has a drop zone below it
 */
const SectionHeader = React.forwardRef(({ section, onDragOver, onDrop }, ref) => {
  return (
    <div className="section-header-container" style={{ position: 'relative' }}>
      {/* The actual section header - not a drop zone */}
      <div 
        className="section-header"
        style={{
          padding: '8px 12px',
          backgroundColor: '#e8eaf6',
          borderRadius: '4px',
          marginBottom: '8px',
          fontWeight: 'bold',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          borderLeft: '4px solid #3f51b5',
        }}
      >
        <span style={{ marginRight: '8px', color: '#3f51b5' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 5h16v2H4zm0 6h16v2H4zm0 6h16v2H4z"></path>
          </svg>
        </span>
        {section.sectionName}
      </div>
      
      {/* The drop zone below the section header */}
      <div 
        ref={ref}
        className="section-drop-zone reorder-item-container"
        style={{
          height: '38px', /* Standard row height */
          marginBottom: '4px',
          position: 'relative',
          backgroundColor: 'transparent',
          border: '1px dashed rgba(0,0,0,0.1)',
          borderRadius: '4px',
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
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
  const [dropPosition, setDropPosition] = useState(null); // Track drop position for gap effect
  
  // Add effect to clean up any visual states when component updates or unmounts
  useEffect(() => {
    // Clean up any lingering drag state on unmount
    return () => {
      // Use a comprehensive cleanup approach when unmounting
      try {
        // Remove all visual indicator classes
        document.querySelectorAll('.dragging, .drop-target, .gap-before, .gap-after, .not-draggable').forEach(el => {
          if (el) {
            el.classList.remove('dragging', 'drop-target', 'gap-before', 'gap-after', 'not-draggable');
          }
        });
        
        // Remove any tooltips that might have been created
        document.querySelectorAll('.cannot-drag-tooltip').forEach(el => {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
        
        // Remove any gap overlay elements
        document.querySelectorAll('.gap-overlay-before, .gap-overlay-after').forEach(el => {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      } catch (err) {
        console.error('Error in cleanup effect:', err);
      }
      
      // Reset state variables
      setDraggingItem(null);
      setDropTarget(null);
      setDropPosition(null);
    };
  }, []);
  
  // Runs a comprehensive cleanup to remove all DropIndicator references
  useEffect(() => {
    // Run only once on initial render to remove all DropIndicator references from the DOM
    const removeDropIndicators = () => {
      try {
        // Find and remove all rendered DropIndicator components
        const dropIndicatorElements = document.querySelectorAll('[data-drop-indicator]');
        dropIndicatorElements.forEach(element => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      } catch (err) {
        console.error('Error removing drop indicators:', err);
      }
    };

    // Remove any drop indicators that might have been rendered
    removeDropIndicators();
    
    // Ensure we don't have any visual artifacts
    resetVisualState();
  }, []);
  
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
        try {
          node.classList.add('not-draggable');
          setTimeout(() => {
            try {
              if (node) node.classList.remove('not-draggable');
            } catch (err) {
              console.error('Error removing not-draggable class:', err);
            }
          }, 800);
        } catch (err) {
          console.error('Error adding not-draggable class:', err);
        }
      }
      
      // Show a tooltip or notification that this item can't be moved
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
    
    // Clean up any lingering gap or drop-target classes first
    document.querySelectorAll('.drop-target, .gap-before, .gap-after').forEach(el => {
      if (el) {
        el.classList.remove('drop-target', 'gap-before', 'gap-after');
      }
    });
    
    // Add dragging class and hide the original item
    if (node) {
      try {
        // Add dragging class to make the original item nearly invisible
        node.classList.add('dragging');
        
        // Create a reference to the node that won't become stale
        const nodeRef = node;
        
        setDraggingItem({
          ...item,
          node: nodeRef // Store the DOM node with a stable reference
        });
      } catch (err) {
        console.error('Error adding dragging class:', err);
        
        // Still set the dragging item even if adding the class fails
        setDraggingItem({
          ...item,
          node: null 
        });
      }
    } else {
      // Handle case where node is null
      setDraggingItem({
        ...item,
        node: null
      });
    }
    
    // Required for Firefox
    e.dataTransfer.setData('text/plain', '');
    
    // Call external handler if provided
    if (externalDragStart) {
      externalDragStart(e, item.index);
    }
  };    // Handle drag over
  const handleDragOver = (e, virtualIndex, node) => {
    e.preventDefault(); // Critical - this allows the drop
    e.stopPropagation();
    
    if (!draggingItem || !node) return;
    
    // Skip if trying to drag over the exact same virtual item (prevents self-drop)
    if (draggingItem.virtualIndex === virtualIndex) {
      return;
    }
    
    // Check if this is a gap overlay or section drop zone element
    const isGapOverlay = e.target.classList.contains('gap-overlay-before') || 
                         e.target.classList.contains('gap-overlay-after');
    const isSectionDropZone = e.target.classList.contains('section-drop-zone');
    
    // If this is a gap overlay, we get its parent node and we know the position
    let isInOverlay = false;
    let overlayPosition = null;
    
    if (isGapOverlay) {
      if (e.target.classList.contains('gap-overlay-before')) {
        overlayPosition = 'before';
        isInOverlay = true;
      } else if (e.target.classList.contains('gap-overlay-after')) {
        overlayPosition = 'after';
        isInOverlay = true;
      }
    } else if (isSectionDropZone) {
      // Section drop zones are always 'before' the first item
      overlayPosition = 'before';
      isInOverlay = true;
    }
    
    // Find the item in the reorder array
    const item = reorderArray.find(i => i.virtualIndex === virtualIndex);
    if (!item) return;
    
    // Check if we're over the original position
    const isOriginalPosition = (item.type === POSITION_TYPE.ITEM && item.index === draggingItem.index) ||
        ((item.type === POSITION_TYPE.SECTION_START || item.type === POSITION_TYPE.SECTION_END) && 
         item.sectionId === draggingItem.sectionId &&
         ((item.type === POSITION_TYPE.SECTION_START && item.index === draggingItem.index) ||
          (item.type === POSITION_TYPE.SECTION_END && item.index - 1 === draggingItem.index)));
    
    // Determine position - use overlay position if in gap overlay or section drop zone
    let position;
    if (isInOverlay) {
      position = overlayPosition;
    } else if (e.target.classList.contains('section-drop-zone')) {
      // Section drop zones are always 'before' position
      position = 'before';
    } else {
      // Get mouse position relative to the element to determine if we're in the top or bottom half
      const rect = node.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const isTopHalf = relativeY < rect.height / 2;
      
      // For items, determine if we should show the gap before or after the item
      // For section indicators, we keep the default position
      position = item.position;
      if (item.type === POSITION_TYPE.ITEM) {
        position = isTopHalf ? 'before' : 'after';
      }
    }
    
    // Check if the drop position has changed
    const currentNodeId = node.getAttribute('id') || node.getAttribute('data-id') || `item-${item.virtualIndex}`;
    if (dropPosition && dropPosition.nodeId === currentNodeId && dropPosition.position === position) {
      // Position hasn't changed, no need to update classes
      return;
    }
    
    console.log(`Setting drop target: item=${item.type}, index=${item.index}, position=${position}, inOverlay=${isInOverlay}, originalPosition=${isOriginalPosition}`);
    
    // Update drop target with node reference for precise positioning and position information
    setDropTarget({
      ...item,
      position,
      node
    });
    
    // Update drop position for gap effect
    setDropPosition({
      nodeId: currentNodeId,
      position,
      virtualIndex: item.virtualIndex,
      index: item.index, // Make sure we store the actual index value
      inGapOverlay: isInOverlay
    });
    
    try {
      // Remove any existing gap classes and overlays first
      document.querySelectorAll('.gap-before, .gap-after, .drop-target, .gap-overlay-before, .gap-overlay-after').forEach(el => {
        if (el) {
          el.classList.remove('gap-before', 'gap-after', 'drop-target');
          // Remove any existing overlay elements
          if (el.classList.contains('gap-overlay-before') || el.classList.contains('gap-overlay-after')) {
            el.parentNode.removeChild(el);
          }
        }
      });
      
      // Apply appropriate classes for gap behavior - but skip if over original position
      if (node && !isOriginalPosition) {
        // Special handling for section headers and section start positions
        const isSectionStart = item.type === POSITION_TYPE.SECTION_START;
        
        // Use a consistent gap for all valid positions
        if (position === 'before') {
          node.classList.add('gap-before');
          
          // Create a gap overlay for better drop targeting
          const gapOverlay = document.createElement('div');
          gapOverlay.className = 'gap-overlay-before';
          gapOverlay.setAttribute('data-virtual-index', virtualIndex);
          
          // For section starts, make sure the overlay is full width and height
          if (isSectionStart) {
            gapOverlay.style.width = '100%';
            gapOverlay.style.height = '38px'; // Consistent row height
          }
          
          // Add the same drag event handlers to the overlay
          gapOverlay.addEventListener('dragover', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
          });
          
          gapOverlay.addEventListener('drop', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            handleDrop(evt);
          });
          
          node.appendChild(gapOverlay);
        } else if (position === 'after') {
          node.classList.add('gap-after');
          
          // Create a gap overlay for better drop targeting
          const gapOverlay = document.createElement('div');
          gapOverlay.className = 'gap-overlay-after';
          gapOverlay.setAttribute('data-virtual-index', virtualIndex);
          
          // For section ends, make sure the overlay is full width and height
          if (item.type === POSITION_TYPE.SECTION_END) {
            gapOverlay.style.width = '100%';
            gapOverlay.style.height = '38px'; // Consistent row height
          }
          
          // Add the same drag event handlers to the overlay
          gapOverlay.addEventListener('dragover', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
          });
          
          gapOverlay.addEventListener('drop', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            handleDrop(evt);
          });
          
          node.appendChild(gapOverlay);
        }
        
        // Make sure we mark this as a drop target to track it
        node.classList.add('drop-target');
      } else if (isOriginalPosition && node) {
        // Even though we don't add a gap for the original position,
        // we still need to mark it as a drop target so the drop handler works
        node.classList.add('drop-target');
      }
    } catch (err) {
      console.error('Error updating classes:', err);
    }
    
    // Call external handler if provided
    if (externalDragMove) {
      externalDragMove(e);
    }
  };
  
  // Handle drag leave
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // We need to check if we're actually leaving the element and not just entering a child element
    // This uses a small timeout to ensure we're really leaving
    const checkIfReallyLeft = (target, callback) => {
      setTimeout(() => {
        try {
          const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
          if (!target.contains(elementAtPoint)) {
            callback(); // Only remove classes if truly leaving the element
          }
        } catch (err) {
          console.error('Error in drag leave check:', err);
        }
      }, 10); // Small delay for accuracy
    };
    
    // Check if we're really leaving the element
    if (e.currentTarget) {
      checkIfReallyLeft(e.currentTarget, () => {
        try {
          // Only remove classes from the current target (not all elements)
          // This ensures we don't remove the gap from the new target
          if (e.currentTarget) {
            e.currentTarget.classList.remove('drop-target', 'gap-before', 'gap-after');
          }
          
          // We keep the dropTarget and dropPosition state so that
          // when the drop happens, we still know where it was supposed to go
        } catch (err) {
          console.error('Error removing classes on drag leave:', err);
        }
      });
    }
  };
  
  // Handle drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the drop occurred on a gap overlay
    const isGapOverlay = e.target.classList.contains('gap-overlay-before') || 
                         e.target.classList.contains('gap-overlay-after');
    
    // Use the same drop target logic for gap overlays
    if (isGapOverlay) {
      // We're already handling this with the correct drop target from drag over
      console.log('Drop occurred in a gap overlay:', e.target.className);
    }
    
    // Check if we're dropping at the original position
    const isOriginalPosition = draggingItem?.index === dropTarget?.index;
    
    console.log('Handling drop event', { 
      draggingItem, 
      dropTarget,
      draggingItemIndex: draggingItem?.index,
      dropTargetIndex: dropTarget?.index,
      dropTargetPosition: dropTarget?.position,
      inGapOverlay: isGapOverlay,
      isOriginalPosition
    });
    
    if (!draggingItem || !dropTarget) {
      console.error('Drop failed: Missing dragging item or drop target');
      resetDragState();
      return;
    }
    
    // Reset all visual indicators immediately
    resetVisualState();
    
    // Skip if dropping on self
    if (draggingItem.virtualIndex === dropTarget.virtualIndex) {
      console.log('Dropping on self, ignoring');
      resetDragState();
      return;
    }
    
    // Get the source and target indices from the dragging items
    const sourceIndex = draggingItem.index;
    
    // Check if source item is the only one in its section
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
    
    // Set up target information
    let targetIndex = dropTarget.index;
    const targetSectionId = dropTarget.sectionId;
    
    console.log('Drop details:', {
      sourceIndex, 
      targetIndex, 
      targetSectionId,
      dropTargetType: dropTarget.type,
      dropTargetPosition: dropTarget.position
    });
    
    // Adjust target index if dropping after an item
    if (dropTarget.type === POSITION_TYPE.ITEM && dropTarget.position === 'after') {
      targetIndex += 1;
      console.log(`Adjusted target index to ${targetIndex} (after item)`);
    }
    
    if (reorderAxis === 'rows') {
      // Handle row reordering
      console.log('Reordering rows', { sourceIndex, targetIndex, rows });
      
      // Create a simple shallow copy of the rows array to start with
      const newRows = [...rows];
      
      // Get a copy of the source row
      const sourceRow = [...newRows[sourceIndex]];
      
      // Remove the source row first
      newRows.splice(sourceIndex, 1);
      
      // Adjust target index if needed
      let adjustedTargetIndex = targetIndex;
      if (targetIndex > sourceIndex) {
        adjustedTargetIndex--;
      }
      
      console.log('Adjusted target index', { 
        originalTarget: targetIndex,
        adjustedTarget: adjustedTargetIndex,
        sourceIndex
      });
      
      // Insert the row at the target position
      newRows.splice(adjustedTargetIndex, 0, sourceRow);
      
      // Update section if needed
      if (targetSectionId && targetSectionId !== sourceRow[0]?.section?.sectionId) {
        const targetSection = rowSections.find(s => s.sectionId === targetSectionId);
        if (targetSection) {
          sourceRow[0] = {
            ...sourceRow[0],
            section: { ...targetSection }
          };
        }
      }
      
      // Debug before update
      console.log('UPDATING ROWS', {
        oldRows: rows,
        newRows: newRows,
        sourceIndex,
        targetIndex: adjustedTargetIndex
      });
      
      // Call the parent component's setState function directly
      setRows(newRows);
      
      console.log('Rows should be updated now');
    } else {
      // Handle column reordering
      console.log('Reordering columns', { sourceIndex, targetIndex, columns });
      
      // Create a simple shallow copy of the rows array
      const newRows = rows.map(row => [...row]);
      
      // Move the column in each row
      newRows.forEach((row, rowIndex) => {
        // Get the source cell
        const sourceCell = { ...row[sourceIndex] };
        
        // Remove source cell
        row.splice(sourceIndex, 1);
        
        // Adjust target index
        let adjustedTargetIndex = targetIndex;
        if (targetIndex > sourceIndex) {
          adjustedTargetIndex--;
        }
        
        // Insert at target position
        row.splice(adjustedTargetIndex, 0, sourceCell);
        
        // Update section if needed (only in first row)
        if (rowIndex === 0 && targetSectionId && sourceCell.section?.sectionId !== targetSectionId) {
          const targetSection = colSections.find(s => s.sectionId === targetSectionId);
          if (targetSection) {
            // Update the section in the current position
            row[adjustedTargetIndex].section = { ...targetSection };
            
            // Also update the section for this column in all other rows
            for (let i = 1; i < newRows.length; i++) {
              if (newRows[i][adjustedTargetIndex]) {
                newRows[i][adjustedTargetIndex].section = { ...targetSection };
              }
            }
          }
        }
      });
      
      // Debug before update
      console.log('UPDATING COLUMNS', {
        oldRows: rows,
        newRows: newRows,
        sourceIndex,
        targetIndex
      });
      
      // Call the parent component's setState function directly
      setRows(newRows);
      
      console.log('Columns should be updated now');
    }
    
    // Immediately reset drag state to ensure UI is responsive
    resetDragState();
    
    // Clear loading state with a small delay
    setTimeout(() => {
      setIsLoading(false);
      
      // Log success message
      console.log('%cDrag and drop operation completed', 'color: green; font-weight: bold;');
    }, 100);
  };
  
  // Add effect to track changes in rows data
  useEffect(() => {
    // Log when rows data changes from the parent
    if (rows && rows.length > 0) {
      console.log('%cRows data updated from parent', 'background: green; color: white; padding: 2px 5px;', {
        rowCount: rows.length,
        firstRow: rows[0]
      });
    }
  }, [rows]);
  
  // No need to redefine the Section Header Component since we've defined it at the top
  // with proper handling for the drop event
  
  // Add effect to update our local dragging state when rows change
  useEffect(() => {
    // Reset drag state if we have a state change while dragging
    if (draggingItem !== null) {
      resetDragState();
    }
  }, [rows.length]);
  
  // Debug function to help track state updates
  const debugRowUpdate = (newRows, message) => {
    console.log(`%c${message}`, 'background: #3f51b5; color: white; padding: 2px 5px; border-radius: 3px;', {
      rowCount: newRows.length,
      firstRow: newRows[0],
      lastRow: newRows[newRows.length - 1]
    });
  };
  
  // Utility function to reset just the visual state (classes)
  const resetVisualState = () => {
    try {
      // First ensure any dragging items are restored to visibility
      const draggingElements = document.querySelectorAll('.dragging');
      if (draggingElements.length > 0) {
        draggingElements.forEach(elem => {
          if (elem) {
            elem.classList.remove('dragging');
          }
        });
      }
      
      // Then remove all other visual indicator classes
      document.querySelectorAll('.drop-target, .gap-before, .gap-after').forEach(elem => {
        if (elem) {
          elem.classList.remove('drop-target', 'gap-before', 'gap-after');
        }
      });
      
      // Remove active state from section drop zones
      document.querySelectorAll('.section-drop-zone.drop-target').forEach(elem => {
        if (elem) {
          elem.classList.remove('drop-target');
        }
      });
      
      // Remove any gap overlay elements
      document.querySelectorAll('.gap-overlay-before, .gap-overlay-after').forEach(elem => {
        if (elem && elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      });
    } catch (err) {
      console.error('Error resetting visual state:', err);
    }
  };

  // Reset full drag state (both visual and state variables)
  const resetDragState = () => {
    // Reset visual classes first
    resetVisualState();
    
    // Then reset state variables
    setDraggingItem(null);
    setDropTarget(null);
    setDropPosition(null);
  };
  
  // Handle drag end
  const handleDragEnd = (e) => {
    // Don't reset the drag state here immediately
    // since the drop event might be about to fire
    
    // Instead, use setTimeout to allow drop to process first if it's going to
    setTimeout(() => {
      // Only reset if it hasn't been reset by a drop event
      if (draggingItem) {
        console.log('Drag ended without drop, resetting state');
        
        // Make sure we restore any hidden items
        if (draggingItem.node) {
          try {
            draggingItem.node.classList.remove('dragging');
          } catch (err) {
            console.error('Error removing dragging class:', err);
          }
        }
        
        resetDragState();
      }
      
      // Call external handler if provided
      if (externalDragEnd) {
        externalDragEnd(e);
      }
    }, 50); // Small delay to ensure drop fires first if it's going to
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
                        // Use the same handler to ensure consistent gap behavior
                        handleDragOver(e, sectionStart.virtualIndex, node);
                      }
                    }}
                    onDrop={handleDrop}
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
                  className={`reorder-item-container ${cannotDrag ? "undraggable-item" : ""}`}
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
        <div style={{ 
          display: 'block', 
          position: 'relative', 
          padding: '0 0 20px 0',
          width: '100%', /* Ensure container takes full width available */
          maxWidth: '100%', /* Prevent expanding beyond parent */
          boxSizing: 'border-box' /* Include padding in width calculation */
        }}>
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
                        // Use the same handler to ensure consistent gap behavior
                        handleDragOver(e, sectionStart.virtualIndex, node);
                      }
                    }}
                    onDrop={handleDrop}
                  />
                )}
                
                {/* Render the column */}                  <div
                      ref={node => {
                        if (node) {
                          itemRefs.current[colKey] = node;
                          if (colRefs && colRefs.current) colRefs.current[colIndex] = node;
                        }
                      }}
                      draggable={!cannotDrag}
                      className={`reorder-item-container ${cannotDrag ? "undraggable-item" : ""}`}
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
                    maxWidth: '100%', /* Prevent expanding beyond parent */
                    boxSizing: 'border-box', /* Include padding in width calculation */
                    textAlign: 'left',
                    position: 'relative', /* Important for indicator positioning */
                    overflow: 'hidden', /* Hide any text that might overflow */
                    textOverflow: 'ellipsis' /* Show ellipsis for overflowing text */
                  }}
                >
                  {/* Display only the column name, or a placeholder if empty */}
                  {rows[0][realColIndex].name ? (
                    <span style={{ 
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 'calc(100% - 30px)' /* Leave space for lock icon if needed */
                    }}>
                      {rows[0][realColIndex].name}
                    </span>
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
        overflow: 'auto', /* Change from overflowY to handle both directions */
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
