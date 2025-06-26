/**
 * aboutLiner Text Mode Converter
 * 
 * This module provides functions to convert between the section-based data model 
 * and the text-based (markdown) representation, preserving the formatting and structure.
 */

import { generateRowId, generateSectionId, convertFlatToSectionBased, convertSectionBasedToFlat } from '../models/SectionModel';

/**
 * Parse a text-based outline into the section-based data model
 * 
 * @param {string} text - Text in outline format
 * @param {Object} options - Parse options
 * @param {boolean} options.includeHeaders - Whether to include column/row headers
 * @param {boolean} options.includeIds - Whether to parse/include row IDs
 * @param {boolean} options.includeSections - Whether to parse/include section info
 * @returns {Object} - Section-based data model
 */
export const parseTextToSectionModel = (text, options = {}) => {
  const { includeHeaders = true, includeIds = true, includeSections = true } = options;
  
  // First parse to the flat array format (similar to the original parseImportText)
  const flatResult = parseImportText(text, { includeHeaders, includeIds, includeSections });
  
  // If parsing failed, return empty section model
  if (!flatResult || !flatResult.rows) {
    return {
      rowSections: [{
        sectionId: 'default-row-section',
        sectionName: '',
        rows: []
      }],
      colSections: [{
        sectionId: 'default-col-section',
        sectionName: '',
        cols: []
      }]
    };
  }
  
  // Convert the flat array to the section-based model
  return convertFlatToSectionBased(flatResult.rows);
};

/**
 * Generate text export from section-based data model
 * 
 * @param {Object} sectionData - Section-based data model
 * @param {Object} options - Export options
 * @param {boolean} options.includeHeaders - Whether to include column/row headers
 * @param {boolean} options.includeIds - Whether to include row IDs
 * @param {boolean} options.includeSections - Whether to include section info
 * @returns {string} - Text representation in outline format
 */
export const sectionModelToText = (sectionData, options = {}) => {
  const { includeHeaders = true, includeIds = true, includeSections = true } = options;
  
  // First convert to flat array
  const flatRows = convertSectionBasedToFlat(sectionData);
  
  // Then use the existing getExportText logic
  return getExportText(flatRows, { includeHeaders, includeIds, includeSections });
};

/**
 * Parse text import (from original codebase)
 * This preserves the existing parsing logic from App.js
 */
export const parseImportText = (text, options = {}) => {
  const { includeHeaders = true, includeIds = true, includeSections = true } = options;
  
  const lines = text.split('\n');
  const rowsArr = [];
  let current = null;
  let lastSection = null;
  let sawSection = false;
  let defaultSection = null;
  // For sub-bullets, track per-column last section
  const colSectionMemory = {};
  
  // Parse line by line
  for (const line of lines) {
    // Handle blank lines => paragraph break in last sub-value
    if (/^\s*$/.test(line) && current && current.subs.length) {
      const lastSub = current.subs[current.subs.length - 1];
      // Append a blank line as Markdown paragraph separator
      lastSub.value = lastSub.value
        ? `${lastSub.value}\n\n`
        : `\n\n`;
      continue;
    }
    
    // Detect level-1 bullets (*) or -
    // Now: allow for optional section: "- ## SectionName ID | Name :: Value"
    const lvl1 = line.match(/^([*-])\s+(.*)/);
    // Detect third-level or deeper bullets (4+ spaces)
    const lvl3 = line.match(/^\s{4,}[-*]\s+(.*)/);
    // Detect level-2 bullets with exactly two spaces
    // Now: allow for optional section: "  - ## ColSection Name :: Value"
    const lvl2 = line.match(/^ {2}[-*]\s+(.*)/);
    
    if (lvl1) {
      // Push previous top-level if exists
      if (current) rowsArr.push(current);
      
      // Parse optional section: look for "## SectionName" at the start
      let raw = lvl1[2].trim();
      let section = null;
      let sectionMatch = raw.match(/^##\s*([^\s]+)\s+(.*)$/);
      
      if (includeSections && sectionMatch) {
        section = sectionMatch[1];
        raw = sectionMatch[2].trim();
        lastSection = section;
        sawSection = true;
      }
      
      // Parse optional title::value
      const idx = raw.indexOf('::');
      let title = '', value = raw;
      if (idx >= 0) {
        title = raw.slice(0, idx).trim();
        value = raw.slice(idx + 2).trim();
      }
      
      // If section is seen for the first time after first row, set a default section for prior rows
      if (includeSections && section && rowsArr.length > 0 && !defaultSection) {
        defaultSection = '_';
        // Assign default section to previous rows
        rowsArr.forEach(r => {
          if (!r.section) r.section = defaultSection;
        });
      }
      
      // If no section, fill-down from lastSection
      if (includeSections && !section && lastSection) {
        section = lastSection;
      }
      
      current = { 
        title, 
        value, 
        subs: [],
        ...(includeSections && section ? { section } : {})
      };
    }
    // Third-level or deeper bullets: append as Markdown list to last sub-value
    else if (lvl3 && current) {
      const itemText = lvl3[1].trim();
      const lastSub = current.subs[current.subs.length - 1];
      if (lastSub) {
        lastSub.value = lastSub.value
          ? `${lastSub.value}\n- ${itemText}`
          : `- ${itemText}`;
      }
    }
    else if (lvl2 && current) {
      // Parse optional section: look for "## ColSection" at the start
      let raw = lvl2[1].trim();
      let colSection = null;
      let colSectionMatch = raw.match(/^##\s*([^\s]+)\s+(.*)$/);
      
      if (includeSections && colSectionMatch) {
        colSection = colSectionMatch[1];
        raw = colSectionMatch[2].trim();
      }
      
      const idx = raw.indexOf('::');
      let subTitle = '', subValue = raw;
      if (idx >= 0) {
        subTitle = raw.slice(0, idx).trim();
        subValue = raw.slice(idx + 2).trim();
      }
      
      // Track per-column section
      let colIdx = current.subs.length + 1; // col 1 is first sub
      if (includeSections && colSection) {
        colSectionMemory[colIdx] = colSection;
      }
      
      // Fill-down if not set
      if (includeSections && !colSection && colSectionMemory[colIdx]) {
        colSection = colSectionMemory[colIdx];
      }
      
      current.subs.push(
        includeSections && colSection 
          ? { title: subTitle, value: subValue, section: colSection }
          : { title: subTitle, value: subValue }
      );
    }
    
    // Handle special Dropbox-style lists and other formatting if needed
    // This is simplified from the original implementation
  }
  
  // Push last group
  if (current) rowsArr.push(current);
  
  // If defaultSection was set, fill-down to all rows without section
  if (includeSections && defaultSection) {
    rowsArr.forEach(r => {
      if (!r.section) r.section = defaultSection;
    });
  }
  
  if (rowsArr.length === 0) return null;
  
  // Normalize sub-count to max across all bullets
  const maxSubCount = rowsArr.reduce((max, r) => Math.max(max, r.subs.length), 0);
  rowsArr.forEach(r => {
    while (r.subs.length < maxSubCount) {
      r.subs.push({ title: '', value: '' });
    }
  });
  
  // Build rows and columns
  const columns = maxSubCount + 1;
  
  // Gather parsed headers (from first row) and parsed IDs (from all rows)
  const parsedHeaders = includeHeaders 
    ? [rowsArr[0]?.title || '', ...rowsArr[0]?.subs.map(s => s.title) || []] 
    : [];
    
  const parsedIds = includeIds ? rowsArr.map(r => {
    const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
    return idMatch ? idMatch[1].toUpperCase() : generateRowId();
  }) : [];
  
  // Build final rows array with proper structure
  const rows = rowsArr.map((r, idx) => {
    // Always parse for ID and name using regex
    let id = includeIds ? (parsedIds[idx] || generateRowId()) : generateRowId();
    let parsedName = null;
    
    if (includeIds) {
      const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
      if (idMatch) {
        parsedName = idMatch[2].trim();
      }
    }
    
    let name = parsedName !== null ? parsedName : r.title;
    const row = [{
      id,
      name: includeHeaders ? name : '',
      value: r.value,
      ...(includeSections && r.section ? { 
        section: typeof r.section === 'string' 
          ? { 
              sectionId: `rowSection-${r.section.replace(/\s+/g, '_')}`, 
              sectionName: r.section 
            } 
          : r.section
      } : {})
    }];
    
    r.subs.forEach((sub, subIdx) =>
      row.push(
        includeSections && sub.section
          ? { 
              name: includeHeaders ? sub.title : '', 
              value: sub.value, 
              section: typeof sub.section === 'string'
                ? {
                    sectionId: `colSection-${sub.section.replace(/\s+/g, '_')}`,
                    sectionName: sub.section
                  }
                : sub.section
            }
          : { name: includeHeaders ? sub.title : '', value: sub.value }
      )
    );
    
    return row;
  });

  // Convert string section fields into section objects with ids
  if (includeSections) {
    const seenRowSections = {};
    const seenColSections = {};
    rows.forEach(row => {
      if (row[0].section && typeof row[0].section === 'string') {
        const name = row[0].section;
        if (!seenRowSections[name]) {
          seenRowSections[name] = {
            sectionId: 'rowSection-' + name.replace(/\s+/g, '_'),
            sectionName: name
          };
        }
        row[0].section = seenRowSections[name];
      }
      
      row.forEach((cell, i) => {
        if (i > 0 && cell.section && typeof cell.section === 'string') {
          const name = cell.section;
          if (!seenColSections[name]) {
            seenColSections[name] = {
              sectionId: 'colSection-' + name.replace(/\s+/g, '_'),
              sectionName: name
            };
          }
          cell.section = seenColSections[name];
        }
      });
    });
  }
  
  return { columns, rows, parsedHeaders, parsedIds };
};

/**
 * Export as text format (from original codebase)
 * This preserves the existing export logic from App.js
 */
export const getExportText = (rows, options = {}) => {
  const { includeHeaders = true, includeIds = true, includeSections = true } = options;
  
  const lines = [];
  
  rows.forEach(row => {
    const [first, ...subs] = row;
    let topLine;
    
    // Build the top level line
    if (includeIds && first.id) {
      // Include ID + optional name
      topLine = includeHeaders && first.name
        ? `- ${includeSections && first.section ? `${first.section.sectionName} ## ` : ''}${first.id} | ${first.name}:: ${first.value}`
        : `- ${includeSections && first.section ? `${first.section.sectionName} ## ` : ''}${first.id}:: ${first.value}`;
    } else {
      // No ID, just optional name
      topLine = includeHeaders && first.name
        ? `- ${includeSections && first.section ? `${first.section.sectionName} ## ` : ''}${first.name}:: ${first.value}`
        : `- ${includeSections && first.section ? `${first.section.sectionName} ## ` : ''}${first.value}`;
    }
    
    lines.push(topLine);
    
    // Add sub-bullets
    subs.forEach(cell => {
      const prefix = includeSections && cell.section ? `${cell.section.sectionName} ## ` : '';
      const subText = includeHeaders && cell.name
        ? `${prefix}${cell.name}:: ${cell.value}`
        : `${prefix}${cell.value}`;
        
      const subLines = subText.split('\n');
      lines.push(`  - ${subLines[0]}`);
      
      for (let i = 1; i < subLines.length; i++) {
        lines.push(`      ${subLines[i]}`);
      }
    });
  });
  
  return lines.join('\n');
};

/**
 * Parse TSV import (adapted from original codebase)
 */
export const parseImportTSV = (text, options = {}) => {
  const { includeHeaders = true, includeIds = true, includeSections = true } = options;
  
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { 
    columns: 1, 
    rows: [[{ name: '', value: '' }]] 
  };

  const headers = lines[0].split('\t');
  const body = lines.slice(1).map(line => line.split('\t'));

  const maxCols = headers.length;
  const resultRows = body.map((line, idx) => {
    const row = [];
    
    for (let i = 0; i < maxCols; i++) {
      const rawValue = line[i] || '';
      const value = rawValue.replace(/\\n/g, '\n');
      
      // Only set id for the first cell if the header is 'ID'
      if (i === 0) {
        if (includeIds && headers[0].toUpperCase() === 'ID') {
          const id = typeof value === 'string' && value.length === 4 ? value : generateRowId();
          row.push({ id, name: includeHeaders ? (headers[i] || '') : '', value });
        } else {
          row.push({ name: includeHeaders ? (headers[i] || '') : '', value });
        }
      } else {
        row.push({ name: includeHeaders ? (headers[i] || '') : '', value });
      }
    }
    
    return row;
  });

  return { columns: maxCols, rows: resultRows };
};

/**
 * Export as TSV (tab-separated values), escaping newlines
 */
export const getExportTSV = (rows, options = {}) => {
  const { includeHeaders = true, includeIds = true } = options;
  
  const tsvHeader = [];
  rows[0].forEach((cell, idx) => {
    if (idx === 0 && includeIds) tsvHeader.push('ID');
    if (includeHeaders) tsvHeader.push(cell.name || '');
    else tsvHeader.push('');
  });
  
  const tsvRows = [];
  tsvRows.push(tsvHeader.join('\t'));
  
  rows.forEach(row => {
    const line = [];
    row.forEach((cell, idx) => {
      if (idx === 0 && includeIds) line.push(cell.id || '');
      line.push((cell.value || '').replace(/\n/g, '\\n'));
    });
    tsvRows.push(line.join('\t'));
  });
  
  return tsvRows.join('\n');
};

/**
 * Export TSV with real newlines, for human-readable TSV
 */
export const getExportTSVRich = (rows, options = {}) => {
  const { includeHeaders = true, includeIds = true } = options;
  
  const tsvHeader = [];
  rows[0].forEach((cell, idx) => {
    if (idx === 0 && includeIds) tsvHeader.push('ID');
    if (includeHeaders) tsvHeader.push(cell.name || '');
    else tsvHeader.push('');
  });
  
  const tsvRows = [];
  tsvRows.push(tsvHeader.join('\t'));
  
  rows.forEach(row => {
    const line = [];
    row.forEach((cell, idx) => {
      if (idx === 0 && includeIds) line.push(cell.id || '');
      line.push(cell.value || '');
    });
    tsvRows.push(line.join('\t'));
  });
  
  return tsvRows.join('\n');
};
