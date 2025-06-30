import React from 'react';
import { getFlattenedColumns } from '../../models/SectionModel';
import '../../styles/table.css';

/**
 * MergedHeaderTable - Renders a table with merged headers for sections
 * 
 * This component implements the traditional view with merged column headers
 * and merged row section headers, similar to the original aboutLiner table.
 */
const MergedHeaderTable = ({
  sectionData,
  showIds = true,
  focusedCell = { row: null, col: null },
  hoveredCol = null,
  onCellClick,
  onCellDoubleClick,
  onCellHover,
  onCellLeave,
  mdRender
}) => {
  if (!sectionData || !sectionData.rowSections || !sectionData.colSections) {
    return <div>No table data available.</div>;
  }

  // Extract data for rendering
  const { rowSections, colSections } = sectionData;
  
  // Calculate column groups for the header
  const columnSectionGroups = [];
  let currentSectionId = null;
  let currentGroup = null;
  
  // Create column groups by section
  getFlattenedColumns(sectionData).forEach(col => {
    if (currentSectionId !== col.sectionId) {
      currentSectionId = col.sectionId;
      currentGroup = {
        sectionId: col.sectionId,
        sectionName: col.sectionName,
        cols: []
      };
      columnSectionGroups.push(currentGroup);
    }
    currentGroup.cols.push(col);
  });

  // Create row data for rendering
  const flattenedRows = [];
  rowSections.forEach(section => {
    section.rows.forEach((row, rowInSectionIdx) => {
      flattenedRows.push({
        row,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        rowInSectionIdx,
        rowsInSection: section.rows.length,
        firstInSection: rowInSectionIdx === 0
      });
    });
  });

  // Render function for cell content (with markdown support)
  const renderCellContent = (content) => {
    if (!content) return '';
    if (!mdRender) return content;
    
    // Use passed markdown renderer or return plain text
    return (
      <div
        className="markdown-cell"
        dangerouslySetInnerHTML={{
          __html: mdRender(content)
        }}
      />
    );
  };

  return (
    <table className="merged-header-table">
      <thead>
        <tr>
          {/* Section header */}
          <th rowSpan={2} className="corner-header">Section</th>
          
          {/* Row title header */}
          <th rowSpan={2}>{flattenedRows[0]?.row?.name || 'Title'}</th>
          
          {/* Column section headers (spanning columns) */}
          {columnSectionGroups.map(group => (
            <th
              key={group.sectionId}
              colSpan={group.cols.length}
              className="column-section-header"
            >
              {group.sectionName === '' ? '' : group.sectionName}
            </th>
          ))}
        </tr>
        
        <tr>
          {/* Column headers (individual) */}
          {columnSectionGroups.flatMap(group => 
            group.cols.map(col => (
              <th
                key={`col-${col.idx}`}
                className={hoveredCol === col.idx ? 'highlight-column' : ''}
                onClick={() => onCellClick && onCellClick(0, col.idx)}
                onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(0, col.idx)}
                onMouseEnter={() => onCellHover && onCellHover(col.idx)}
                onMouseLeave={() => onCellLeave && onCellLeave()}
              >
                <span
                  className="column-header-pill"
                  style={{ backgroundColor: `var(--col-color-${col.idx + 1})` }}
                >
                  {col.name || `Col ${col.idx + 1}`}
                </span>
              </th>
            ))
          )}
        </tr>
      </thead>
      
      <tbody>
        {flattenedRows.map((rowData, flatRowIdx) => {
          const { row, sectionId, sectionName, firstInSection, rowsInSection } = rowData;
          
          return (
            <tr key={`row-${row.id || flatRowIdx}`}>
              {/* Section cell (rowspan for the entire section) */}
              {firstInSection && (
                <td rowSpan={rowsInSection} className="row-section-cell">
                  {sectionName === '' ? '' : sectionName}
                </td>
              )}
              
              {/* Row title cell */}
              <td 
                className={
                  `row-title-cell ${focusedCell.row === flatRowIdx && focusedCell.col === 0 ? 'highlight-cell' : ''}`
                }
                onClick={() => onCellClick && onCellClick(flatRowIdx, 0)}
                onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(flatRowIdx, 0)}
              >
                {showIds && (
                  <span className="row-id">{row.id}</span>
                )}
                {row.value}
              </td>
              
              {/* Data cells */}
              {row.cells.map((cell, cellIdx) => (
                <td
                  key={`cell-${row.id}-${cellIdx}`}
                  className={`
                    data-cell
                    ${hoveredCol === cellIdx ? 'highlight-column' : ''}
                    ${focusedCell.row === flatRowIdx && focusedCell.col === cellIdx + 1 ? 'highlight-cell' : ''}
                  `}
                  onClick={() => onCellClick && onCellClick(flatRowIdx, cellIdx + 1)}
                  onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(flatRowIdx, cellIdx + 1)}
                >
                  {renderCellContent(cell.value)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default MergedHeaderTable;
