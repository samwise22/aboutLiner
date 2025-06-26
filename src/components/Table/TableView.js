import React, { useState } from 'react';
import MergedHeaderTable from './MergedHeaderTable';
import BreakRowTable from './BreakRowTable';
import '../../styles/table.css';

/**
 * TableView - A component that wraps both table rendering styles
 * and provides controls to switch between them.
 */
const TableView = ({
  sectionData,
  showIds = true,
  mdRender,
  onCellClick,
  onCellDoubleClick,
  onCopyTable
}) => {
  // State for UI interactions
  const [hoveredCol, setHoveredCol] = useState(null);
  const [focusedCell, setFocusedCell] = useState({ row: null, col: null });
  
  // State for table display mode
  const [displayMode, setDisplayMode] = useState('mergedHeader'); // 'mergedHeader' or 'breakRow'
  
  // Handle cell click
  const handleCellClick = (rowIdx, colIdx) => {
    setFocusedCell({ row: rowIdx, col: colIdx });
    if (onCellClick) onCellClick(rowIdx, colIdx);
  };
  
  // Handle cell double click
  const handleCellDoubleClick = (rowIdx, colIdx) => {
    if (onCellDoubleClick) onCellDoubleClick(rowIdx, colIdx);
  };
  
  // Handle column hover
  const handleColumnHover = (colIdx) => {
    setHoveredCol(colIdx);
  };
  
  // Handle column leave
  const handleColumnLeave = () => {
    setHoveredCol(null);
  };
  
  return (
    <div className="table-view-container">
      {/* Display mode toggle */}
      <div className="table-display-controls" style={{ position: 'absolute', top: '-30px', right: '0' }}>
        <label className="display-mode-toggle">
          <span>Display Mode:</span>
          <select 
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="mergedHeader">Merged Headers</option>
            <option value="breakRow">Break Rows</option>
          </select>
        </label>
      </div>
      
      {/* Table container */}
      <div className="table-container">
        {displayMode === 'mergedHeader' ? (
          <MergedHeaderTable
            sectionData={sectionData}
            showIds={showIds}
            focusedCell={focusedCell}
            hoveredCol={hoveredCol}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            onCellHover={handleColumnHover}
            onCellLeave={handleColumnLeave}
            mdRender={mdRender}
          />
        ) : (
          <BreakRowTable
            sectionData={sectionData}
            showIds={showIds}
            focusedCell={focusedCell}
            hoveredCol={hoveredCol}
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
            onCellHover={handleColumnHover}
            onCellLeave={handleColumnLeave}
            mdRender={mdRender}
          />
        )}
      </div>
    </div>
  );
};

export default TableView;
