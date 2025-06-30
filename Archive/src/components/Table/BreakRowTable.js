import React from 'react';
import { getFlattenedColumns } from '../../models/SectionModel';
import '../../styles/table.css';

/**
 * BreakRowTable - Renders a table with break rows between sections
 * 
 * This component implements the alternative view with break rows for sections
 * and visual separators for column sections, but no merged cells.
 */
const BreakRowTable = ({
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
  
  // Get all columns in order
  const columns = getFlattenedColumns(sectionData);
  
  // Create column group map to determine column section boundaries
  const columnGroups = {};
  let currentGroup = null;
  
  columns.forEach((col, idx) => {
    if (!currentGroup || currentGroup.sectionId !== col.sectionId) {
      currentGroup = {
        sectionId: col.sectionId,
        sectionName: col.sectionName,
        startIdx: idx,
        endIdx: idx
      };
      columnGroups[col.sectionId] = currentGroup;
    } else {
      currentGroup.endIdx = idx;
    }
  });
  
  // Function to determine if column is at the start of a section
  const isColumnSectionStart = (colIdx) => {
    return columns[colIdx] && (colIdx === 0 || columns[colIdx].sectionId !== columns[colIdx-1].sectionId);
  };
  
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
  
  let globalRowIndex = 0;

  return (
    <table className="break-row-table">
      <thead>
        <tr>
          {/* Row title header */}
          <th className="row-title-header">
            {rowSections[0]?.rows[0]?.name || 'Title'}
          </th>
          
          {/* Column headers */}
          {columns.map((col, colIdx) => (
            <th
              key={`col-${col.idx}`}
              className={`
                ${hoveredCol === col.idx ? 'highlight-column' : ''}
                ${isColumnSectionStart(colIdx) ? 'column-section-start' : ''}
              `}
              onClick={() => onCellClick && onCellClick(0, col.idx)}
              onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(0, col.idx)}
              onMouseEnter={() => onCellHover && onCellHover(col.idx)}
              onMouseLeave={() => onCellLeave && onCellLeave()}
              style={{
                borderLeft: isColumnSectionStart(colIdx) ? '2px solid #3f51b5' : null
              }}
            >
              <span
                className="column-header-pill"
                style={{ backgroundColor: `var(--col-color-${col.idx + 1})` }}
              >
                {col.name || `Col ${col.idx + 1}`}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      
      <tbody>
        {rowSections.map((section, sectionIdx) => {
          // Reset row counter for debugging/tracking
          const rowsInThisSection = section.rows.length;
          
          return (
            <React.Fragment key={`section-${section.sectionId}`}>
              {/* Section break row */}
              {section.sectionName !== '' && (
                <tr className="section-break-row">
                  <td colSpan={columns.length + 1} className="section-title">
                    {section.sectionName}
                  </td>
                </tr>
              )}
              
              {/* Rows in this section */}
              {section.rows.map((row, rowInSectionIdx) => {
                const currentRowIndex = globalRowIndex++;
                
                return (
                  <tr 
                    key={`row-${row.id || currentRowIndex}`}
                    className={`section-${section.sectionId} ${rowInSectionIdx === rowsInThisSection - 1 ? 'last-in-section' : ''}`}
                  >
                    {/* Row title cell */}
                    <td 
                      className={`
                        row-title-cell 
                        ${focusedCell.row === currentRowIndex && focusedCell.col === 0 ? 'highlight-cell' : ''}
                      `}
                      onClick={() => onCellClick && onCellClick(currentRowIndex, 0)}
                      onDoubleClick={() => onCellDoubleClick && onCellDoubleClick(currentRowIndex, 0)}
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
                          ${focusedCell.row === currentRowIndex && focusedCell.col === cellIdx + 1 ? 'highlight-cell' : ''}
                          ${isColumnSectionStart(cellIdx) ? 'column-section-start' : ''}
                        `}
                        onClick={() => onCellClick && onCellClick(currentRowIndex, cellIdx + 1)}
                        onDoubleClick={() => 
                          onCellDoubleClick && onCellDoubleClick(currentRowIndex, cellIdx + 1)
                        }
                        style={{
                          borderLeft: isColumnSectionStart(cellIdx) ? '2px solid #3f51b5' : null
                        }}
                      >
                        {renderCellContent(cell.value)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export default BreakRowTable;
