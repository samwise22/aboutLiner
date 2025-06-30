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
  displayMode = 'mergedHeader', // Accept as prop
  mdRender,
  onCellClick,
  onCellDoubleClick,
  onCopyTable
}) => {
  // State for UI interactions
  const [hoveredCol, setHoveredCol] = useState(null);
  const [focusedCell, setFocusedCell] = useState({ row: null, col: null });
  
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
      ) : displayMode === 'breakRow' ? (
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
      ) : (
        <div>Simple Table Mode Not Implemented</div>
      )}
    </div>
  );
};

export default TableView;
