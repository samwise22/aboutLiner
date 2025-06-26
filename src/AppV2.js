import React, { useState, useEffect, useCallback, useRef } from 'react';
import logo from './aboutliner rectangle.png';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import TableView from './components/Table/TableView';
import OutlineModeV3 from './components/OutlineMode/OutlineModeV3';
import CopyModal from './components/CopyModal/CopyModal';
import { convertFlatToSectionBased, generateRowId } from './models/SectionModel';
import { parseTextToSectionModel, sectionModelToText } from './models/TextConverter';
// Import necessary styles
import './styles/table.css';
import './styles/outlinev3.css';

// Custom styles for mode icons
const modeIconStyle = {
  cursor: 'pointer',
  padding: '3px', // Reduced from 4px (20% reduction)
  borderRadius: '3px', // Reduced from 4px (20% reduction)
  transition: 'all 0.2s ease',
  background: 'transparent', // Ensure background is transparent by default
  fontSize: '20px', // Reduced icon size by 20% from default 24px
};

const modeIconHoverStyle = {
  background: 'rgba(0,0,0,0.05)', // Just the background property that changes on hover
};

const modeIconActiveStyle = {
  color: '#1976d2',
  background: 'transparent', // Active state shouldn't have a background unless hovered
  fontWeight: 'bold',
};

// Sample data from original App.js
const sampleData = [
  [
    { id: 'ZEK1', name: 'Row Title', value: 'Row_SecA_Row 1', section: { sectionId: 'rowSection-Row_SecA', sectionName: 'Row_SecA' } },
    { name: 'Col_SecA_Col 1', value: 'Row_SecA_Row 1 _ Col_SecA_Col 1', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecA_Col 2', value: 'Row_SecA_Row 1 _ Col_SecA_Col 2', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecB_Col 3', value: 'Row_SecA_Row 1 _ Col_SecB_Col 3', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
    { name: 'Col_SecB_Col 4', value: 'Row_SecA_Row 1 _ Col_SecB_Col 4', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
  ],
  [
    { id: 'ZEK2', name: 'Row Title', value: 'Row_SecA_Row 2', section: { sectionId: 'rowSection-Row_SecA', sectionName: 'Row_SecA' } },
    { name: 'Col_SecA_Col 1', value: 'Row_SecA_Row 2 _ Col_SecA_Col 1', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecA_Col 2', value: 'Row_SecA_Row 2 _ Col_SecA_Col 2', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecB_Col 3', value: 'Row_SecA_Row 2 _ Col_SecB_Col 3', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
    { name: 'Col_SecB_Col 4', value: 'Row_SecA_Row 2 _ Col_SecB_Col 4', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
  ],
  [
    { id: 'ZEK3', name: 'Row Title', value: 'Row_SecB_Row 3', section: { sectionId: 'rowSection-Row_SecB', sectionName: 'Row_SecB' } },
    { name: 'Col_SecA_Col 1', value: 'Row_SecB_Row 3 _ Col_SecA_Col 1', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecA_Col 2', value: 'Row_SecB_Row 3 _ Col_SecA_Col 2', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecB_Col 3', value: 'Row_SecB_Row 3 _ Col_SecB_Col 3', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
    { name: 'Col_SecB_Col 4', value: 'Row_SecB_Row 3 _ Col_SecB_Col 4', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
  ],
  [
    { id: 'ZEK4', name: 'Row Title', value: 'Row_SecB_Row 4', section: { sectionId: 'rowSection-Row_SecB', sectionName: 'Row_SecB' } },
    { name: 'Col_SecA_Col 1', value: 'Row_SecB_Row 4 _ Col_SecA_Col 1', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecA_Col 2', value: 'Row_SecB_Row 4 _ Col_SecA_Col 2', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecB_Col 3', value: 'Row_SecB_Row 4 _ Col_SecB_Col 3', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
    { name: 'Col_SecB_Col 4', value: 'Row_SecB_Row 4 _ Col_SecB_Col 4', section: { sectionId: 'colSection-Col_SecB', sectionName: 'Col_SecB' } },
  ]
];

// Example text for import
const sampleText = [
  '- Row_SecA ## ZEK1 | Row Title::Row_SecA_Row 1',
  '  - Col_SecA ## Col_SecA_Col 1:: Row_SecA_Row 1 _ Col_SecA_Col 1',
  '  - Col_SecA ## Col_SecA_Col 2:: Row_SecA_Row 1 _ Col_SecA_Col 2',
  '  - Col_SecB ## Col_SecB_Col 3:: Row_SecA_Row 1 _ Col_SecB_Col 3',
  '  - Col_SecB ## Col_SecB_Col 4:: Row_SecA_Row 1 _ Col_SecB_Col 4',
  '- Row_SecA ## ZEK2 | Row Title::Row_SecA_Row 2',
  '  - Col_SecA ## Col_SecA_Col 1:: Row_SecA_Row 2 _ Col_SecA_Col 1',
  '  - Col_SecA ## Col_SecA_Col 2:: Row_SecA_Row 2 _ Col_SecA_Col 2',
  '  - Col_SecB ## Col_SecB_Col 3:: Row_SecA_Row 2 _ Col_SecB_Col 3',
  '  - Col_SecB ## Col_SecB_Col 4:: Row_SecA_Row 2 _ Col_SecB_Col 4',
  '- Row_SecB ## ZEK3 | Row Title::Row_SecB_Row 3',
  '  - Col_SecA ## Col_SecA_Col 1:: Row_SecB_Row 3 _ Col_SecA_Col 1',
  '  - Col_SecA ## Col_SecA_Col 2:: Row_SecB_Row 3 _ Col_SecA_Col 2',
  '  - Col_SecB ## Col_SecB_Col 3:: Row_SecB_Row 3 _ Col_SecB_Col 3',
  '  - Col_SecB ## Col_SecB_Col 4:: Row_SecB_Row 3 _ Col_SecB_Col 4',
  '- Row_SecB ## ZEK4 | Row Title::Row_SecB_Row 4',
  '  - Col_SecA ## Col_SecA_Col 1:: Row_SecB_Row 4 _ Col_SecA_Col 1',
  '  - Col_SecA ## Col_SecA_Col 2:: Row_SecB_Row 4 _ Col_SecA_Col 2',
  '  - Col_SecB ## Col_SecB_Col 3:: Row_SecB_Row 4 _ Col_SecB_Col 3',
  '  - Col_SecB ## Col_SecB_Col 4:: Row_SecB_Row 4 _ Col_SecB_Col 4'
].join('\n');

/**
 * AppV2 - New section-based app component
 */
const AppV2 = () => {
  // Initialize Markdown parser
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true
  });

  // Initialize state with section-based model
  const [sectionData, setSectionData] = useState(() => convertFlatToSectionBased(sampleData));
  const [showIds, setShowIds] = useState(true);
  const [showTextMode, setShowTextMode] = useState(false);
  const [showOutlineMode, setShowOutlineMode] = useState(false);
  const [showReorderMode, setShowReorderMode] = useState(false);
  const [importText, setImportText] = useState(sampleText);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeIds, setIncludeIds] = useState(true);
  const [includeSections, setIncludeSections] = useState(true);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  
  // Pending delete states - for highlighting in outline and table views
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);

  // For input focusing and keyboard navigation
  const inputRefs = useRef({});
  const pendingDeleteTimer = useRef(null);
  const pendingDeleteColTimer = useRef(null);
  const [focusedCell, setFocusedCell] = useState({ row: null, col: null });
  const [editingCell, setEditingCell] = useState(null);
  
  // Quickfill functionality
  const [quickfillState, setQuickfillState] = useState({
    open: false,
    rowIndex: null,
    colIndex: null,
    selectedIndex: 0
  });
  
  // Keyboard event handling
  const lastKeyPressTime = useRef(0);
  const keyPressCount = useRef(0);
  
  // Handle cell click
  const handleCellClick = (rowIndex, colIndex) => {
    console.log(`Cell clicked: row ${rowIndex}, col ${colIndex}`);
    // In the full implementation, this would focus the appropriate input
  };

  // Handle cell double click
  const handleCellDoubleClick = (rowIndex, colIndex) => {
    console.log(`Cell double-clicked: row ${rowIndex}, col ${colIndex}`);
    // In the full implementation, this would select all text in the input
  };
  
  // Focus a specific input field
  const focusInput = (rowIndex, colIndex, field = 'value') => {
    const key = `${rowIndex}-${colIndex}-${field}`;
    const input = inputRefs.current[key];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  // Insert a new row
  const insertRow = (rowIndex) => {
    if (sectionData.rowSections.length === 0) return;
    
    const rowSection = sectionData.rowSections.find(section => {
      const sectionLastRowIdx = section.rows.length - 1;
      return section.rows.some((row, idx) => {
        const globalRowIdx = sectionData.rowSections.slice(0, sectionData.rowSections.indexOf(section))
          .reduce((sum, s) => sum + s.rows.length, 0) + idx;
        return globalRowIdx === rowIndex;
      });
    });

    if (!rowSection) return;

    // Get the index of the row within its section
    let rowInSectionIndex = 0;
    let globalRowIdx = 0;
    for (const section of sectionData.rowSections) {
      if (section.sectionId === rowSection.sectionId) {
        for (let i = 0; i < section.rows.length; i++) {
          if (globalRowIdx === rowIndex) {
            rowInSectionIndex = i;
            break;
          }
          globalRowIdx++;
        }
        break;
      }
      globalRowIdx += section.rows.length;
    }
    
    // Create new row with appropriate section
    const newRow = {
      id: generateRowId(),
      name: '',
      value: '',
      cells: rowSection.rows[0]?.cells.map(cell => ({
        colSectionId: cell.colSectionId,
        name: '',
        value: ''
      })) || []
    };
    
    const updatedSectionData = {
      ...sectionData,
      rowSections: sectionData.rowSections.map(section => {
        if (section.sectionId === rowSection.sectionId) {
          const newRows = [...section.rows];
          newRows.splice(rowInSectionIndex + 1, 0, newRow);
          return {
            ...section,
            rows: newRows
          };
        }
        return section;
      })
    };
    
    setSectionData(updatedSectionData);
    
    // Focus the new row after a short delay
    setTimeout(() => {
      const newRowGlobalIndex = rowIndex + 1;
      if (inputRefs.current[`${newRowGlobalIndex}-0-value`]) {
        focusInput(newRowGlobalIndex, 0, 'value');
      }
    }, 0);
  };

  // Handle keyboard navigation and actions
  const handleKeyDown = (e, sectionIdx, rowInSectionIdx, colIndex) => {
    // Calculate the global row index
    let globalRowIdx = 0;
    for (let i = 0; i < sectionIdx; i++) {
      globalRowIdx += sectionData.rowSections[i].rows.length;
    }
    globalRowIdx += rowInSectionIdx;
    
    // Arrow navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      // Build flat list of all positions (rowIndex, colIndex)
      const flat = [];
      let totalRowCount = 0;
      
      for (let s = 0; s < sectionData.rowSections.length; s++) {
        const section = sectionData.rowSections[s];
        for (let r = 0; r < section.rows.length; r++) {
          flat.push({ s, r, c: 0 });
          for (let c = 0; c < section.rows[r].cells.length; c++) {
            flat.push({ s, r, c: c + 1 });
          }
        }
        totalRowCount += section.rows.length;
      }
      
      // Find current position
      const currentIdx = flat.findIndex(pos => 
        pos.s === sectionIdx && pos.r === rowInSectionIdx && pos.c === colIndex);
        
      if (e.shiftKey) {
        // Move between rows at same column
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        
        let targetFound = false;
        let targetSectionIdx = sectionIdx;
        let targetRowInSectionIdx = rowInSectionIdx + delta;
        
        // Check if we need to move to a different section
        if (targetRowInSectionIdx < 0) {
          // Move up to previous section
          if (sectionIdx > 0) {
            targetSectionIdx = sectionIdx - 1;
            targetRowInSectionIdx = sectionData.rowSections[targetSectionIdx].rows.length - 1;
            targetFound = true;
          }
        } else if (targetRowInSectionIdx >= sectionData.rowSections[sectionIdx].rows.length) {
          // Move down to next section
          if (sectionIdx < sectionData.rowSections.length - 1) {
            targetSectionIdx = sectionIdx + 1;
            targetRowInSectionIdx = 0;
            targetFound = true;
          }
        } else {
          targetFound = true;
        }
        
        if (targetFound) {
          // Calculate global row index for the target
          let targetGlobalRowIdx = 0;
          for (let i = 0; i < targetSectionIdx; i++) {
            targetGlobalRowIdx += sectionData.rowSections[i].rows.length;
          }
          targetGlobalRowIdx += targetRowInSectionIdx;
          
          focusInput(targetGlobalRowIdx, colIndex);
        }
      } else {
        // Move through flat list
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const target = currentIdx + delta;
        if (target >= 0 && target < flat.length) {
          const targetPos = flat[target];
          
          // Calculate global row index for the target
          let targetGlobalRowIdx = 0;
          for (let i = 0; i < targetPos.s; i++) {
            targetGlobalRowIdx += sectionData.rowSections[i].rows.length;
          }
          targetGlobalRowIdx += targetPos.r;
          
          focusInput(targetGlobalRowIdx, targetPos.c, 'value');
        }
      }
      return;
    }
    
    if (e.key === 'Enter') {
      if (colIndex > 0 && e.target.value === '') {
        e.preventDefault();
        // Empty sub-bullet handling
        if (rowInSectionIdx > 0 || sectionIdx > 0) {
          // If this is not the first row, insert a new row
          insertRow(globalRowIdx);
        } else {
          // In first row, just move focus to the next cell if possible
          if (colIndex < sectionData.colSections.length) {
            focusInput(globalRowIdx, colIndex + 1);
          }
        }
      } else {
        e.preventDefault();
        if (colIndex === 0) {
          // In row label: insert new row
          insertRow(globalRowIdx);
        } else {
          // In sub-bullet cell
          const totalColSections = sectionData.colSections.length;
          if (colIndex === totalColSections) {
            // At the last column, create new row and focus its first cell
            insertRow(globalRowIdx);
            setTimeout(() => focusInput(globalRowIdx + 1, 0), 0);
          } else {
            // Move to next column
            focusInput(globalRowIdx, colIndex + 1);
          }
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!e.shiftKey) {
        // Tab forward
        const totalColSections = sectionData.colSections.length;
        if (colIndex === totalColSections) {
          // At last column, move to first column of next row if possible
          const nextRowGlobalIdx = globalRowIdx + 1;
          const totalRows = sectionData.rowSections.reduce((sum, section) => sum + section.rows.length, 0);
          
          if (nextRowGlobalIdx < totalRows) {
            focusInput(nextRowGlobalIdx, 0);
          }
        } else {
          // Move focus right
          focusInput(globalRowIdx, colIndex + 1);
        }
      } else {
        // Shift+Tab backward
        if (colIndex === 1) {
          // Move focus to row label input
          focusInput(globalRowIdx, 0);
        } else if (colIndex > 1) {
          focusInput(globalRowIdx, colIndex - 1);
        } else if (colIndex === 0 && globalRowIdx > 0) {
          // Move to last column of previous row
          const prevRowGlobalIdx = globalRowIdx - 1;
          const totalColSections = sectionData.colSections.length;
          focusInput(prevRowGlobalIdx, totalColSections);
        }
      }
    }
  };

  // Get quickfill options for a cell
  const getQuickfillOptions = (colIndex, rowIndex) => {
    // If not in outline mode, no quickfill
    if (!showOutlineMode) return [];
    
    // Calculate the global row index and find the section and row
    let globalRowIdx = 0;
    let targetSection;
    let targetRowInSection;
    
    for (const section of sectionData.rowSections) {
      if (globalRowIdx + section.rows.length > rowIndex) {
        targetSection = section;
        targetRowInSection = rowIndex - globalRowIdx;
        break;
      }
      globalRowIdx += section.rows.length;
    }
    
    if (!targetSection) return [];
    
    // Find unique values in this column from other rows
    const colSectionId = colIndex === 0 ? null : 
      targetSection.rows[targetRowInSection].cells[colIndex - 1]?.colSectionId;
    
    if (!colSectionId) return [];
    
    // Collect all non-empty values from other rows in the same column section
    const options = new Set();
    
    sectionData.rowSections.forEach(section => {
      section.rows.forEach(row => {
        row.cells.forEach(cell => {
          if (cell.colSectionId === colSectionId && cell.value && cell.value.trim()) {
            options.add(cell.value.trim());
          }
        });
      });
    });
    
    return Array.from(options);
  };
  
  // Handle quickfill dropdown
  const openQuickfill = (rowIndex, colIndex) => {
    setQuickfillState({
      open: true,
      rowIndex,
      colIndex,
      selectedIndex: 0
    });
  };
  
  const closeQuickfill = () => {
    setQuickfillState(prev => ({
      ...prev,
      open: false
    }));
  };
  
  // Handle quickfill key events
  const handleQuickfillKeyDown = (e, rowIndex, colIndex) => {
    const options = getQuickfillOptions(colIndex, rowIndex);
    
    if (quickfillState.open && quickfillState.rowIndex === rowIndex && quickfillState.colIndex === colIndex) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setQuickfillState(state => ({
          ...state,
          selectedIndex: (state.selectedIndex + 1) % options.length
        }));
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setQuickfillState(state => ({
          ...state,
          selectedIndex: (state.selectedIndex - 1 + options.length) % options.length
        }));
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // Insert selected value
        if (options.length > 0) {
          // Update the cell value
          const newSectionData = {...sectionData};
          let globalRowIdx = 0;
          let targetSection;
          let targetRowInSection;
          
          for (const section of newSectionData.rowSections) {
            if (globalRowIdx + section.rows.length > rowIndex) {
              targetSection = section;
              targetRowInSection = rowIndex - globalRowIdx;
              break;
            }
            globalRowIdx += section.rows.length;
          }
          
          if (targetSection) {
            if (colIndex === 0) {
              targetSection.rows[targetRowInSection].value = options[quickfillState.selectedIndex];
            } else if (targetSection.rows[targetRowInSection].cells[colIndex - 1]) {
              targetSection.rows[targetRowInSection].cells[colIndex - 1].value = options[quickfillState.selectedIndex];
            }
            setSectionData(newSectionData);
          }
          
          closeQuickfill();
          setTimeout(() => focusInput(rowIndex, colIndex, 'value'), 0);
        }
        return true;
      }
      if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        e.preventDefault();
        closeQuickfill();
        setTimeout(() => focusInput(rowIndex, colIndex, 'value'), 0);
        return true;
      }
    }
    
    // Open quickfill dropdown on ArrowRight if field is empty and options exist
    if (!quickfillState.open && e.key === 'ArrowRight' && e.target.value === '') {
      const opts = getQuickfillOptions(colIndex, rowIndex);
      if (opts.length > 0) {
        e.preventDefault();
        openQuickfill(rowIndex, colIndex);
        return true;
      }
    }
    
    return false;
  };
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const meta = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      
      // Escape key closes modals and cancels pending actions
      if (e.key === 'Escape') {
        if (copyModalVisible) setCopyModalVisible(false);
        if (quickfillState.open) closeQuickfill();
        if (pendingDeleteRow !== null) setPendingDeleteRow(null);
        if (pendingDeleteCol !== null) setPendingDeleteCol(null);
        return;
      }
      
      // Cmd/Ctrl + Enter toggle outline mode
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        setShowOutlineMode(!showOutlineMode);
        if (showTextMode) setShowTextMode(false);
        if (showReorderMode) setShowReorderMode(false);
        return;
      }
      
      // Cmd/Ctrl + Shift + . toggle shortcuts help
      if (meta && e.shiftKey && e.key === '.') {
        e.preventDefault();
        // Display keyboard shortcuts help modal (to be implemented)
        return;
      }
      
      // Cmd/Ctrl + Shift + E toggle text mode
      if (meta && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleTextModeToggle();
        if (showOutlineMode) setShowOutlineMode(false);
        if (showReorderMode) setShowReorderMode(false);
        return;
      }
      
      // Cmd/Ctrl + Shift + R toggle reorder mode
      if (meta && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowReorderMode(!showReorderMode);
        if (showOutlineMode) setShowOutlineMode(false);
        if (showTextMode) setShowTextMode(false);
        return;
      }
      
      // Cmd/Ctrl + Shift + C for copy table (currently commented for DevTools access)
      /*if (meta && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCopyModalVisible(true);
        return;
      }*/
      
      // Handle double-hit Cmd/Ctrl+I to insert row
      if (meta && e.key.toLowerCase() === 'i') {
        const now = Date.now();
        if (now - lastKeyPressTime.current < 500) {
          keyPressCount.current++;
        } else {
          keyPressCount.current = 1;
        }
        lastKeyPressTime.current = now;
        
        if (keyPressCount.current === 2) {
          e.preventDefault();
          handleInsertRow();
          keyPressCount.current = 0;
        }
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [copyModalVisible, showOutlineMode, showTextMode, showReorderMode, pendingDeleteRow, pendingDeleteCol, quickfillState.open]);
  
  // Insert row function
  const handleInsertRow = () => {
    if (sectionData.rowSections.length === 0) return;
    
    const firstSection = sectionData.rowSections[0];
    const newRow = {
      id: generateRowId(),
      name: '',
      value: '',
      cells: firstSection.rows[0]?.cells.map(cell => ({
        colSectionId: cell.colSectionId,
        name: '',
        value: ''
      })) || []
    };
    
    const updatedSectionData = {
      ...sectionData,
      rowSections: [
        {
          ...firstSection,
          rows: [...firstSection.rows, newRow]
        },
        ...sectionData.rowSections.slice(1)
      ]
    };
    
    setSectionData(updatedSectionData);
  };

  // Handle text import
  const handleImportText = () => {
    try {
      // Parse text to section data
      const newSectionData = parseTextToSectionModel(importText, {
        includeHeaders,
        includeIds,
        includeSections
      });
      
      // Update section data
      setSectionData(newSectionData);
      
      // Exit text mode
      setShowTextMode(false);
    } catch (error) {
      console.error("Error importing text:", error);
      alert("There was an error importing the text. Please check the format and try again.");
    }
  };

  // Handle text export
  const handleExportText = () => {
    // Generate text from current section data
    const text = sectionModelToText(sectionData, { 
      includeHeaders, 
      includeIds, 
      includeSections 
    });
    
    // Update text area
    setImportText(text);
  };

  // Handle switching to text mode
  const handleTextModeToggle = () => {
    if (!showTextMode) {
      // Generate text from section data when switching to text mode
      const text = sectionModelToText(sectionData, { 
        includeHeaders, 
        includeIds, 
        includeSections 
      });
      setImportText(text);
    } else {
      // Parse text to section data when switching from text mode
      const newSectionData = parseTextToSectionModel(importText, {
        includeHeaders,
        includeIds,
        includeSections
      });
      setSectionData(newSectionData);
    }
    setShowTextMode(!showTextMode);
  };

  // Handle copy table button
  const handleCopyTable = () => {
    setCopyModalVisible(true);
  };

  // Render markdown with sanitization
  const renderMarkdown = (text) => {
    if (!text) return '';
    return DOMPurify.sanitize(md.render(text));
  };

  return (
    <div className="app-container debug-mode" style={{ position: 'relative', paddingTop: 80, overflow: 'hidden' }}>
      {/* App header */}
      <div className="app-logo-container" style={{ position: 'absolute', top: 16, left: 16 }}>
        <img src={logo} alt="aboutLiner logo" style={{ height: 56, pointerEvents: 'none' }} />
      </div>
      
      {/* Left panel for Outline/Text/Reorder modes - 33% width */}
      <div 
        className={`outline-panel${showTextMode ? ' export-mode' : ''}${showReorderMode ? ' reorder-mode' : ''}`}
        style={{
          position: 'relative',
          width: '33%',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: '0',
          paddingLeft: '12px',
          paddingRight: '12px',
          height: 'calc(100vh - 100px)', /* Adjusting height to prevent overflow */
          backgroundColor: '#fafafa' /* Almost white background color for the outline area */
        }}
      >
        <div className="mode-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fafafa', padding: '8px 0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: '12px' }}>
            {/* Mode toggle icons */}
            <div className="mode-toggle-icons" style={{ 
              display: 'flex', 
              gap: '10px', // Reduced from 12px (20% reduction)
              background: 'white',
              borderRadius: '6px', // Reduced from 8px (20% reduction)
              padding: '5px 8px', // Reduced from 6px 10px (20% reduction)
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.03)'
            }}>
            <span 
              className={`material-symbols-outlined mode-icon ${showTextMode ? 'active' : ''}`} 
              onClick={handleTextModeToggle}
              title="Text Mode (Ctrl+Shift+E)"
              style={{
                ...modeIconStyle,
                ...(showTextMode ? modeIconActiveStyle : {})
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = modeIconHoverStyle.background; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              text_format
            </span>
            
            <span 
              className={`material-symbols-outlined mode-icon ${showOutlineMode ? 'active' : ''}`}
              onClick={() => {
                setShowOutlineMode(!showOutlineMode);
                if (showTextMode) setShowTextMode(false);
                if (showReorderMode) setShowReorderMode(false);
              }}
              title="Outline Mode (Ctrl+Enter)"
              style={{
                ...modeIconStyle,
                ...(showOutlineMode ? modeIconActiveStyle : {})
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = modeIconHoverStyle.background; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              format_list_bulleted
            </span>
            
            <span 
              className={`material-symbols-outlined mode-icon ${showReorderMode ? 'active' : ''}`}
              onClick={() => {
                setShowReorderMode(!showReorderMode);
                if (showTextMode) setShowTextMode(false);
                if (showOutlineMode) setShowOutlineMode(false);
              }}
              title="Reorder Mode"
              style={{
                ...modeIconStyle,
                ...(showReorderMode ? modeIconActiveStyle : {})
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = modeIconHoverStyle.background; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              sort
            </span>
          </div>
        </div>
        
        {/* Show appropriate content based on selected mode */}
        {showTextMode ? (
          <div className="text-mode" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 32px)', paddingBottom: '10px' }}>
            <div className="text-mode-controls">
              <button
                className="btn-v2 btn-v2-primary"
                onClick={handleImportText}
              >
                Import Text
              </button>
              <button
                className="btn-v2"
                onClick={handleExportText}
              >
                Export Text
              </button>
              
              <div className="checkbox-group" style={{ marginTop: '10px' }}>
                <label className="checkbox-v2">
                  <input
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={() => setIncludeHeaders(!includeHeaders)}
                  />
                  Include Headers
                </label>
                <label className="checkbox-v2">
                  <input
                    type="checkbox"
                    checked={includeIds}
                    onChange={() => setIncludeIds(!includeIds)}
                  />
                  Include IDs
                </label>
                <label className="checkbox-v2">
                  <input
                    type="checkbox"
                    checked={includeSections}
                    onChange={() => setIncludeSections(!includeSections)}
                  />
                  Include Sections
                </label>
              </div>
            </div>
            
            <textarea
              className="text-mode-editor"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              style={{ width: '100%', height: '100%', flex: '1 1 auto', fontFamily: 'monospace' }}
            />
          </div>
        ) : showOutlineMode ? (
          <div className="outline-mode-container" style={{ height: 'calc(100% - 32px)', overflow: 'auto', paddingBottom: '10px' }}>
            <OutlineModeV3
              sectionData={sectionData}
              onDataChange={setSectionData}
              includeIds={false} /* Always hide IDs in outline view */
              includeHeaders={includeHeaders}
              includeSections={includeSections}
              onPendingDeleteChange={(row, col) => {
                setPendingDeleteRow(row);
                setPendingDeleteCol(col);
              }}
              // Keyboard navigation functionality
              inputRefs={inputRefs}
              handleKeyDown={handleKeyDown}
              focusInput={focusInput}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              focusedCell={focusedCell}
              setFocusedCell={setFocusedCell}
              pendingDeleteRow={pendingDeleteRow}
              pendingDeleteCol={pendingDeleteCol}
              setPendingDeleteRow={setPendingDeleteRow}
              setPendingDeleteCol={setPendingDeleteCol}
              pendingDeleteTimer={pendingDeleteTimer}
              pendingDeleteColTimer={pendingDeleteColTimer}
              // Quickfill functionality
              quickfillState={quickfillState}
              handleQuickfillKeyDown={handleQuickfillKeyDown}
              openQuickfill={openQuickfill}
              closeQuickfill={closeQuickfill}
              getQuickfillOptions={getQuickfillOptions}
            />
          </div>
        ) : showReorderMode ? (
          <div className="reorder-mode-container" style={{ height: 'calc(100% - 32px)', overflow: 'auto', paddingBottom: '10px' }}>
            Reorder Mode (Coming Soon)
            {/* Reorder mode will be implemented here */}
          </div>
        ) : (
          <div className="mode-select-message" style={{ height: 'calc(100% - 32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '10px' }}>
            <p>Select a mode using the icons above</p>
          </div>
        )}
      </div>
      
      {/* Right panel for Table - 66% width */}
      <div className="table-panel" style={{ flex: 1, height: 'calc(100vh - 100px)', overflowY: 'auto', overflowX: 'hidden', paddingTop: 0, paddingLeft: '12px', paddingRight: '12px', margin: 0, backgroundColor: '#fafafa' }}>
        <div className="table-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fafafa', padding: '8px 0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: '12px' }}>
            {/* Table controls icons */}
            <div className="table-control-icons" style={{ 
              display: 'flex', 
              gap: '10px', // Reduced from 12px (20% reduction)
              background: 'white',
              borderRadius: '6px', // Reduced from 8px (20% reduction)
              padding: '5px 8px', // Reduced from 6px 10px (20% reduction)
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              border: '1px solid rgba(0,0,0,0.03)'
            }}>
              {/* 
                Here are some alternative ID icon options.
                Choose your preferred one by uncommenting it and removing the others:
                
                Option 1: "tag" - A simple tag icon
              */}
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
                style={{
                  ...modeIconStyle,
                  ...(showIds ? modeIconActiveStyle : {})
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = modeIconHoverStyle.background; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                tag
              </span>
              
              {/* 
                Option 2: "badge" - A credential/badge icon
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
              >
                badge
              </span>
              */}
              
              {/* 
                Option 3: "key" - A key icon representing unique identifiers
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
              >
                key
              </span>
              */}
              
              {/* 
                Option 4: "numbers" - A numeric icon representing IDs as numbers
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
              >
                numbers
              </span>
              */}
              
              {/* 
                Option 5: "visibility" - A visibility toggle icon (on/off)
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
              >
                {showIds ? "visibility" : "visibility_off"}
              </span>
              */}
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={handleCopyTable}
                title="Copy Table (Ctrl+Shift+C)"
                style={modeIconStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = modeIconHoverStyle.background; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                content_copy
              </span>
            </div>
        </div>
        
        <TableView
          sectionData={sectionData}
          showIds={showIds}
          mdRender={renderMarkdown}
          onCellClick={handleCellClick}
          onCellDoubleClick={handleCellDoubleClick}
          onCopyTable={handleCopyTable}
          pendingDeleteRow={pendingDeleteRow}
          pendingDeleteCol={pendingDeleteCol}
        />
      </div>
      
      {/* Copy/Export Modal */}
      {copyModalVisible && (
        <CopyModal
          sectionData={sectionData}
          includeHeaders={includeHeaders}
          includeIds={includeIds}
          includeSections={includeSections}
          onClose={() => setCopyModalVisible(false)}
        />
      )}
    </div>
  );
};

export default AppV2;
