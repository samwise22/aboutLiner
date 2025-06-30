import React, { useState, useEffect, useRef } from 'react';
import logo from './aboutliner rectangle.png';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import TableView from './components/Table/TableView';
import OutlineModeV3 from './components/OutlineMode/OutlineModeV3';
import CopyModal from './components/CopyModal/CopyModal';
import { convertFlatToSectionBased, generateRowId } from './models/SectionModel';
import { parseTextToSectionModel, sectionModelToText } from './models/TextConverter';
import './styles/table.css';
import './styles/appv2.css';
import './styles/outlinev3.css';
import './styles/copyModal.css';
import './styles/app-compatibility.css';

// Sample data from original App.js (DISABLED for empty start)
// const sampleData = [ ... ];
const sampleData = [
  [
    { id: '', name: '', value: '' },
    { name: '', value: '' }
  ]
];

// Example text for import (DISABLED for empty start)
// const sampleText = [ ... ];
const sampleText = '';

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
  const [showOutlineMode, setShowOutlineMode] = useState(true);
  const [showReorderMode, setShowReorderMode] = useState(false);
  const [tableMode, setTableMode] = useState('merged'); // 'merged', 'break', 'simple'
  const [importText, setImportText] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [includeIds, setIncludeIds] = useState(true);
  const [includeSections, setIncludeSections] = useState(true);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  
  // Keyboard event handling
  const lastKeyPressTime = useRef(0);
  const keyPressCount = useRef(0);
  
  // Shared focus state (outline format)
  const [outlineFocusedCell, setOutlineFocusedCell] = useState({ sectionIdx: null, rowIdx: null, colIdx: null });

  // Helper: map outline focus to table focus
  function outlineToTableCell(sectionData, outlineCell) {
    if (!sectionData || outlineCell.sectionIdx == null || outlineCell.rowIdx == null || outlineCell.colIdx == null) return { row: null, col: null };
    // Flatten rows
    let flatRow = 0;
    for (let s = 0; s < outlineCell.sectionIdx; ++s) {
      flatRow += sectionData.rowSections[s]?.rows.length || 0;
    }
    flatRow += outlineCell.rowIdx;
    // Table col: 0 = row title, 1+ = data columns
    return { row: flatRow, col: outlineCell.colIdx };
  }
  // Helper: map table cell to outline focus
  function tableToOutlineCell(sectionData, tableCell) {
    if (!sectionData || tableCell.row == null || tableCell.col == null) return { sectionIdx: null, rowIdx: null, colIdx: null };
    let row = tableCell.row;
    let sectionIdx = 0;
    let rowIdx = row;
    for (let s = 0; s < sectionData.rowSections.length; ++s) {
      const len = sectionData.rowSections[s].rows.length;
      if (row < len) {
        sectionIdx = s;
        rowIdx = row;
        break;
      }
      row -= len;
    }
    return { sectionIdx, rowIdx: row, colIdx: tableCell.col };
  }

  // Handle cell click
  const handleCellClick = (rowIndex, colIndex, opts = {}) => {
    const outlineCell = tableToOutlineCell(sectionData, { row: rowIndex, col: colIndex });
    setOutlineFocusedCell({ ...outlineCell, focusName: opts.focusName });
    console.log(`Cell clicked: row ${rowIndex}, col ${colIndex}`);
    // In the full implementation, this would focus the appropriate input
  };

  // Handle cell double click
  const handleCellDoubleClick = (rowIndex, colIndex) => {
    console.log(`Cell double-clicked: row ${rowIndex}, col ${colIndex}`);
    // In the full implementation, this would select all text in the input
  };
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const meta = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      
      // Escape key closes modals
      if (e.key === 'Escape') {
        if (copyModalVisible) setCopyModalVisible(false);
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
      
      // Cmd/Ctrl + Shift + C open copy modal
      if (meta && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCopyModalVisible(true);
        return;
      }
      
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
  }, [copyModalVisible, showOutlineMode, showTextMode, showReorderMode]);
  
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
    <div className="app-container" style={{ position: 'relative', paddingTop: 80, overflow: 'hidden' }}>
      {/* App header */}
      <div className="app-logo-container" style={{ position: 'absolute', top: 16, left: 16 }}>
        <img src={logo} alt="aboutLiner logo" style={{ height: 56, pointerEvents: 'none' }} />
      </div>
      
      {/* Left panel for Outline/Text/Reorder modes - 33% width */}
      <div 
        className={`outline-panel${showTextMode ? ' export-mode' : ''}${showReorderMode ? ' reorder-mode' : ''}`}
        style={{
          position: 'relative',
          width: '25%', // Changed from 33% to 25%
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: '0',
          height: 'calc(100vh - 100px)' /* Adjusting height to prevent overflow */
        }}
      >
        <div className="mode-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgb(247, 247, 247)', padding: '6px 0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: '10px' }}>
            {/* Mode toggle icons */}
            <div className="mode-toggle-icons" style={{ display: 'flex', gap: '12px' }}>
            <span 
              className={`material-symbols-outlined mode-icon ${showTextMode ? 'active' : ''}`} 
              onClick={handleTextModeToggle}
              title="Text Mode (Ctrl+Shift+E)"
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
            >
              sort
            </span>
          </div>
        </div>
        
        {/* Show appropriate content based on selected mode */}
        {showTextMode ? (
          <div className="text-mode" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 32px)' }}>
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
              includeIds={false}
              includeHeaders={includeHeaders}
              includeSections={includeSections}
              focusedCell={outlineFocusedCell}
              setFocusedCell={setOutlineFocusedCell}
            />
          </div>
        ) : showReorderMode ? (
          <div className="reorder-mode-container" style={{ height: 'calc(100% - 32px)', overflow: 'auto' }}>
            Reorder Mode (Coming Soon)
            {/* Reorder mode will be implemented here */}
          </div>
        ) : (
          <div className="mode-select-message" style={{ height: 'calc(100% - 32px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Select a mode using the icons above</p>
          </div>
        )}
      </div>
      
      {/* Right panel for Table - 66% width */}
      <div className="table-panel" style={{ flex: 1, height: 'calc(100vh - 100px)', overflowY: 'auto', overflowX: 'hidden', marginTop: '0', margin: '0' }}>
        <div className="table-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'transparent', padding: '6px 0', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', paddingRight: '10px' }}>
            {/* Table controls icons */}
            <div className="table-control-icons" style={{ display: 'flex', gap: '12px' }}>
              {/* 
                Here are some alternative ID icon options.
                Choose your preferred one by uncommenting it and removing the others:
                
                Option 1: "tag" - A simple tag icon
              */}
              <span
                className="material-symbols-outlined table-icon"
                onClick={() => setShowIds(!showIds)}
                title="Toggle IDs"
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

              {/* Table Mode Selector */}
              <select 
                value={tableMode}
                onChange={(e) => setTableMode(e.target.value)}
                title="Table Display Mode"
                style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  border: '1px solid #ccc',
                  fontSize: '12px',
                  marginLeft: '8px'
                }}
              >
                <option value="merged">Merged Headers</option>
                <option value="break">Break Rows</option>
                <option value="simple">Simple</option>
              </select>
              
              <span
                className="material-symbols-outlined table-icon"
                onClick={handleCopyTable}
                title="Copy Table (Ctrl+Shift+C)"
              >
                content_copy
              </span>
            </div>
        </div>
        
        <TableView
          sectionData={sectionData}
          showIds={showIds}
          displayMode={tableMode === 'merged' ? 'mergedHeader' : tableMode === 'break' ? 'breakRow' : 'simple'}
          mdRender={renderMarkdown}
          onCellClick={handleCellClick}
          onCellDoubleClick={handleCellDoubleClick}
          onCopyTable={handleCopyTable}
          focusedCell={outlineToTableCell(sectionData, outlineFocusedCell)}
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
