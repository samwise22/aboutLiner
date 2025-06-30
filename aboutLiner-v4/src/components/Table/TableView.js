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
  onCopyTable,
  focusedCell // <-- controlled focus from parent
}) => {
  // State for UI interactions
  const [hoveredCol, setHoveredCol] = useState(null);
  // Remove local focus state
  // const [focusedCell, setFocusedCell] = useState({ row: null, col: null });

  // Handle cell click
  const handleCellClick = (rowIdx, colIdx) => {
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
  
  // Only render row section headers if sectionName is non-empty and colCount is defined
  const renderRowSectionHeader = (section, colCount) => section.sectionName ? (
    <tr className="row-section-header">
      <th colSpan={(colCount || 0) + 1}>{section.sectionName}</th>
    </tr>
  ) : null;

  // Only render column section headers if sectionName is non-empty and colCount is defined
  const renderColSectionHeader = (colSection, colCount) => colSection.sectionName ? (
    <tr className="col-section-header">
      <th></th>
      <th colSpan={colCount || 0}>{colSection.sectionName}</th>
    </tr>
  ) : null;
  
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
          onCellHover={setHoveredCol}
          onCellLeave={() => setHoveredCol(null)}
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
          onCellHover={setHoveredCol}
          onCellLeave={() => setHoveredCol(null)}
          mdRender={mdRender}
        />
      ) : (
        <div>Simple Table Mode Not Implemented</div>
      )}
    </div>
  );
};

export default TableView;
