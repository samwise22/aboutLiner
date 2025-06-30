/**
 * aboutLiner Section-Based Data Model
 * 
 * This module defines the section-based data structure and helper functions
 * for working with sectioned table data.
 */

// Helper: Generate short, human-friendly row ID (e.g. ZEK3)
export const generateRowId = () => {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  const rand = (set) => set[Math.floor(Math.random() * set.length)];
  return `${rand(consonants)}${rand(vowels)}${rand(consonants)}${Math.floor(Math.random() * 10)}`;
};

// Generate a short section ID (for future grouping/sections)
export const generateSectionId = (prefix = 'section') =>
  `${prefix}-${Math.random().toString(36).substr(2, 6)}`;

/**
 * Create a default "unsectioned" section for tables with no section data
 * 
 * @param {string} type - 'row' or 'col'
 * @returns {Object} - A default section object
 */
export const createDefaultSection = (type) => ({
  sectionId: `default-${type}-section`,
  sectionName: '',
  [type === 'row' ? 'rows' : 'cols']: []
});

/**
 * Create an empty section-based table structure
 * 
 * @returns {Object} - An empty section-based table structure
 */
export const createEmptySectionTable = () => ({
  rowSections: [createDefaultSection('row')],
  colSections: [createDefaultSection('col')]
});

/**
 * Convert a flat array of rows to a section-based structure
 * 
 * @param {Array} rows - The flat array of rows
 * @returns {Object} - A section-based table structure
 */
export const convertFlatToSectionBased = (rows) => {
  if (!rows || !rows.length) return createEmptySectionTable();

  const result = {
    rowSections: [],
    colSections: []
  };

  // Extract and deduplicate column sections first
  const colSectionMap = new Map();
  
  if (rows[0] && rows[0].length > 1) {
    rows[0].slice(1).forEach((cell, colIndex) => {
      const section = cell?.section;
      if (section) {
        const sectionId = section.sectionId || `colSection-${section.sectionName}`;
        
        if (!colSectionMap.has(sectionId)) {
          colSectionMap.set(sectionId, {
            sectionId,
            sectionName: section.sectionName || '',
            cols: []
          });
        }
        
        colSectionMap.get(sectionId).cols.push({
          idx: colIndex,
          name: cell.name || '',
          colIndex: colIndex + 1 // 1-based for the actual column index (0 is row title)
        });
      } else {
        // No section, use default
        if (!colSectionMap.has('default-col-section')) {
          colSectionMap.set('default-col-section', createDefaultSection('col'));
        }
        
        colSectionMap.get('default-col-section').cols.push({
          idx: colIndex,
          name: cell.name || '',
          colIndex: colIndex + 1
        });
      }
    });
  }

  // Extract row sections and organize rows by section
  const rowSectionMap = new Map();
  
  rows.forEach((row, rowIndex) => {
    const firstCell = row[0] || {};
    const section = firstCell.section;
    
    // Determine section ID and name
    const sectionId = section ? (section.sectionId || `rowSection-${section.sectionName}`) : 'default-row-section';
    const sectionName = section ? (section.sectionName || '') : '';
    
    // Create section if it doesn't exist
    if (!rowSectionMap.has(sectionId)) {
      rowSectionMap.set(sectionId, {
        sectionId,
        sectionName,
        rows: []
      });
    }
    
    // Build row data with cells
    const rowData = {
      id: firstCell.id || generateRowId(),
      name: firstCell.name || '',
      value: firstCell.value || '',
      cells: []
    };
    
    // Add all cells except the first one (which is row title/id)
    row.slice(1).forEach((cell, cellIndex) => {
      // Determine column section ID
      let colSectionId = 'default-col-section';
      if (cell.section) {
        colSectionId = cell.section.sectionId || `colSection-${cell.section.sectionName}`;
      }
      
      rowData.cells.push({
        colSectionId,
        name: cell.name || '',
        value: cell.value || ''
      });
    });
    
    // Add row to its section
    rowSectionMap.get(sectionId).rows.push(rowData);
  });
  
  // Convert maps to arrays for the final result
  result.rowSections = Array.from(rowSectionMap.values());
  result.colSections = Array.from(colSectionMap.values());
  
  // If either section array is empty, add default section
  if (result.rowSections.length === 0) {
    result.rowSections.push(createDefaultSection('row'));
  }
  
  if (result.colSections.length === 0) {
    result.colSections.push(createDefaultSection('col'));
  }
  
  return result;
};

/**
 * Convert a section-based structure back to a flat array of rows
 * 
 * @param {Object} sectionData - Section-based table structure
 * @returns {Array} - A flat array of rows
 */
export const convertSectionBasedToFlat = (sectionData) => {
  if (!sectionData || !sectionData.rowSections || !sectionData.colSections) {
    return [[{ id: generateRowId(), name: '', value: '' }]];
  }
  
  const rowSections = sectionData.rowSections;
  const colSections = sectionData.colSections;
  const rows = [];
  
  // Build a lookup for column sections to use when assigning section to cells
  const colSectionMap = new Map();
  colSections.forEach(colSection => {
    colSection.cols.forEach(col => {
      colSectionMap.set(col.idx, {
        sectionId: colSection.sectionId,
        sectionName: colSection.sectionName
      });
    });
  });
  
  // Process each row section
  rowSections.forEach(rowSection => {
    // Process each row in this section
    rowSection.rows.forEach(row => {
      const flatRow = [];
      
      // Add first cell (row title/id)
      flatRow.push({
        id: row.id || generateRowId(),
        name: row.name || '',
        value: row.value || '',
        section: rowSection.sectionId !== 'default-row-section' ? {
          sectionId: rowSection.sectionId,
          sectionName: rowSection.sectionName
        } : undefined
      });
      
      // Add the rest of the cells
      row.cells.forEach((cell, cellIndex) => {
        const sectionInfo = colSectionMap.get(cellIndex) || 
                           (cell.colSectionId !== 'default-col-section' ? {
                              sectionId: cell.colSectionId,
                              sectionName: colSections.find(s => s.sectionId === cell.colSectionId)?.sectionName || ''
                            } : undefined);
        
        flatRow.push({
          name: cell.name || '',
          value: cell.value || '',
          ...(sectionInfo ? { section: sectionInfo } : {})
        });
      });
      
      rows.push(flatRow);
    });
  });
  
  return rows;
};

/**
 * Count total columns in a section-based table
 * 
 * @param {Object} sectionData - Section-based table structure
 * @returns {number} - The total number of columns including the title column
 */
export const countTotalColumns = (sectionData) => {
  if (!sectionData || !sectionData.colSections) return 1;
  
  let maxColCount = 0;
  sectionData.colSections.forEach(section => {
    maxColCount += section.cols.length;
  });
  
  return maxColCount + 1; // +1 for the title column
};

/**
 * Get all column sections flattened into an array of column objects
 * 
 * @param {Object} sectionData - Section-based table structure
 * @returns {Array} - All columns with their section info
 */
export const getFlattenedColumns = (sectionData) => {
  if (!sectionData || !sectionData.colSections) return [];
  
  const columns = [];
  
  sectionData.colSections.forEach(section => {
    section.cols.forEach(col => {
      columns.push({
        ...col,
        sectionId: section.sectionId,
        sectionName: section.sectionName
      });
    });
  });
  
  // Sort by the index
  return columns.sort((a, b) => a.idx - b.idx);
};
