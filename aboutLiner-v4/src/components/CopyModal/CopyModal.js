import React, { useState } from 'react';
import { convertSectionBasedToFlat } from '../../models/SectionModel';
import { getExportText, getExportTSV, getExportTSVRich } from '../../models/TextConverter';
import '../../styles/copyModal.css';

/**
 * Export formats available in the copy modal
 */
const EXPORT_FORMATS = [
  { key: 'htmlRich', label: 'HTML' },
  { key: 'tsvEscaped', label: 'TSV' },
  { key: 'ascii', label: 'ASCII' },
  { key: 'cucumber', label: 'Cucumber' }
];

/**
 * CopyModal - A modal dialog to copy the table in various formats
 */
const CopyModal = ({ 
  sectionData, 
  includeHeaders = true, 
  includeIds = true, 
  includeSections = true, 
  onClose 
}) => {
  // Copy format state
  const [copyFormat, setCopyFormat] = useState('htmlRich');
  
  // Cucumber specific option
  const [includeCucumberHeaders, setIncludeCucumberHeaders] = useState(true);
  
  // Get flat rows format for export
  const flatRows = convertSectionBasedToFlat(sectionData);
  
  /**
   * Generate HTML table from the data
   */
  const getTableHTML = () => {
    const options = { includeHeaders, includeIds, includeSections };
    const rows = flatRows;
    
    // Start with the table tag
    let html = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">\n';
    
    // Add header row if needed
    if (includeHeaders) {
      html += '  <thead>\n    <tr>\n';
      
      rows[0].forEach((cell, idx) => {
        const headerText = idx === 0 
          ? (includeIds ? 'ID' : cell.name) 
          : cell.name;
        html += `      <th>${headerText}</th>\n`;
      });
      
      html += '    </tr>\n  </thead>\n';
    }
    
    // Add body rows
    html += '  <tbody>\n';
    
    rows.forEach(row => {
      html += '    <tr>\n';
      
      row.forEach((cell, idx) => {
        if (idx === 0) {
          // First column with ID+name or just name
          const cellContent = includeIds 
            ? `<strong>${cell.id}</strong>${cell.name ? ` ${cell.name}` : ''}` 
            : cell.name;
          html += `      <td>${cellContent}</td>\n`;
        } else {
          // Regular cell with value
          const cellValue = cell.value || '';
          
          // Convert newlines to <br>
          const formattedValue = cellValue.replace(/\n/g, '<br>');
          html += `      <td>${formattedValue}</td>\n`;
        }
      });
      
      html += '    </tr>\n';
    });
    
    html += '  </tbody>\n</table>';
    
    return html;
  };
  
  /**
   * Generate ASCII table - a text-based table representation
   */
  const getExportASCII = () => {
    const rows = flatRows;
    if (!rows || !rows.length) return '';
    
    // Calculate column widths
    const colWidths = [];
    
    // First pass - get minimum width of each column
    rows.forEach(row => {
      row.forEach((cell, i) => {
        const content = i === 0 
          ? (includeIds ? `${cell.id} ${cell.name || ''}` : cell.name || '') 
          : (cell.value || '');
          
        // Split by newline and find longest line
        const lines = content.split('\n');
        const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
        
        colWidths[i] = Math.max(colWidths[i] || 0, maxLineLength, i === 0 ? 4 : 1);
      });
    });
    
    // Add padding
    colWidths = colWidths.map(w => w + 2);
    
    // Build horizontal border
    const makeBorder = () => {
      let border = '+';
      colWidths.forEach(width => {
        border += '-'.repeat(width) + '+';
      });
      return border + '\n';
    };
    
    // Build header row
    const makeRow = (row) => {
      // Split each cell into lines
      const cellLines = row.map((cell, i) => {
        const content = i === 0 
          ? (includeIds ? `${cell.id} ${cell.name || ''}` : cell.name || '')
          : (cell.value || '');
        return content.split('\n');
      });
      
      // Find the maximum number of lines in any cell
      const maxLines = cellLines.reduce(
        (max, lines) => Math.max(max, lines.length),
        1
      );
      
      // Build each line of the row
      let result = '';
      
      for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
        result += '|';
        
        cellLines.forEach((lines, colIdx) => {
          const cellLine = lineIdx < lines.length ? lines[lineIdx] : '';
          const pad = colWidths[colIdx] - cellLine.length;
          result += ' ' + cellLine + ' '.repeat(pad - 1) + '|';
        });
        
        result += '\n';
      }
      
      return result;
    };
    
    // Build the complete ASCII table
    let result = makeBorder();
    
    // Add header row if needed
    if (includeHeaders) {
      const headerRow = rows[0].map((cell, idx) => ({
        id: '',
        name: idx === 0 ? (includeIds ? 'ID' : cell.name || '') : cell.name || '',
        value: ''
      }));
      
      result += makeRow(headerRow);
      result += makeBorder();
    }
    
    // Add data rows
    rows.forEach(row => {
      result += makeRow(row);
      result += makeBorder();
    });
    
    return result;
  };
  
  /**
   * Generate Cucumber (pipe delimited) format
   */
  const getExportCucumber = (includeHeaders = false) => {
    const rows = flatRows;
    if (!rows || !rows.length) return '';
    
    // Calculate column widths
    const colWidths = [];
    
    // First pass - determine minimum width of each column
    rows.forEach(row => {
      row.forEach((cell, i) => {
        const content = i === 0 
          ? (includeIds ? `${cell.id} ${cell.name || ''}` : cell.name || '')
          : (cell.value || '').split('\n')[0] || '';
          
        colWidths[i] = Math.max(colWidths[i] || 0, content.length);
      });
    });
    
    // For header row
    if (includeHeaders) {
      rows[0].forEach((cell, i) => {
        const headerText = i === 0 ? (includeIds ? 'ID' : cell.name || '') : cell.name || '';
        colWidths[i] = Math.max(colWidths[i] || 0, headerText.length);
      });
    }
    
    // Build the cucumber table
    let result = '';
    
    // Add header row if needed
    if (includeHeaders) {
      result += '| ';
      rows[0].forEach((cell, i) => {
        const headerText = i === 0 ? (includeIds ? 'ID' : cell.name || '') : cell.name || '';
        result += headerText.padEnd(colWidths[i]) + ' | ';
      });
      result += '\n';
    }
    
    // Add data rows
    rows.forEach(row => {
      result += '| ';
      row.forEach((cell, i) => {
        const content = i === 0 
          ? (includeIds ? `${cell.id} ${cell.name || ''}` : cell.name || '')
          : (cell.value || '').split('\n')[0] || '';
          
        result += content.padEnd(colWidths[i]) + ' | ';
      });
      result += '\n';
    });
    
    return result;
  };
  
  /**
   * Get content for the selected export format
   */
  const getExportContent = () => {
    const options = { includeHeaders, includeIds, includeSections };
    
    switch (copyFormat) {
      case 'htmlRich':
        return getTableHTML(options);
      case 'tsvEscaped':
        return getExportTSV(flatRows, options);
      case 'ascii':
        return getExportASCII(options);
      case 'cucumber':
        return getExportCucumber(includeCucumberHeaders);
      default:
        return '';
    }
  };
  
  /**
   * Copy content to clipboard
   */
  const handleCopy = async (e) => {
    try {
      if (copyFormat === 'htmlRich') {
        // Write as HTML to clipboard using Clipboard API
        const html = getTableHTML();
        const blob = new Blob([html], { type: 'text/html' });
        const item = new window.ClipboardItem({ 'text/html': blob });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(getExportContent());
      }
      
      const originalText = e.target.textContent;
      e.target.textContent = 'Copied!';
      
      setTimeout(() => {
        e.target.textContent = originalText;
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };
  
  return (
    <div className="modal-overlay">
      <div className="modal-content copy-modal">
        <h2>Copy Table</h2>
        
        <div className="format-selector">
          {EXPORT_FORMATS.map(format => (
            <button
              key={format.key}
              onClick={() => setCopyFormat(format.key)}
              className={`format-button ${copyFormat === format.key ? 'active' : ''}`}
            >
              {format.label}
            </button>
          ))}
        </div>
        
        <pre className={`export-preview ${copyFormat}`}>
          {getExportContent()}
        </pre>
        
        <div className="format-description">
          {{
            htmlRich: 'The most compatible format with full styling and structure. Works across Word, Excel, Confluence, Dropbox Paper, and Apple Notes.',
            tsvEscaped: 'Structured TSV ideal for spreadsheets and re-importing. Escaped newlines preserve data integrity.',
            ascii: 'Simple text-based table for plain environments like code snippets or terminals.',
            cucumber: 'A simple, pipe-delimited text document table often used in Cucumber tests.'
          }[copyFormat] || ''}
        </div>
        
        {copyFormat === 'cucumber' && (
          <label className="option-checkbox">
            Include Headers
            <input
              type="checkbox"
              checked={includeCucumberHeaders}
              onChange={() => setIncludeCucumberHeaders(!includeCucumberHeaders)}
            />
          </label>
        )}
        
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={handleCopy}
          >
            Copy
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyModal;
