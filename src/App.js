//v4.2.0
import React, { useState, useRef, useEffect } from 'react';
import logo from './aboutliner rectangle.png';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

// Generate short, human-friendly row ID (e.g. ZEK3)
const generateRowId = () => {
  const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
  const vowels = 'AEIOU';
  const rand = (set) => set[Math.floor(Math.random() * set.length)];
  return `${rand(consonants)}${rand(vowels)}${rand(consonants)}${Math.floor(Math.random() * 10)}`;
};

const parseImportText = (text) => {
  const lines = text.split('\n');
  const rowsArr = [];
  let current = null;
  // Do not use includeIds/includeHeaders during parsing; always parse all info
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
    const lvl1 = line.match(/^([*-])\s+(.*)/);
    // Detect third-level or deeper bullets (4+ spaces)
    const lvl3 = line.match(/^\s{4,}[-*]\s+(.*)/);
    // Detect level-2 bullets with exactly two spaces
    const lvl2 = line.match(/^ {2}[-*]\s+(.*)/);
    if (lvl1) {
      // Push previous top-level if exists
      if (current) rowsArr.push(current);
      // Parse optional title::value
      const raw = lvl1[2].trim();
      const idx = raw.indexOf('::');
      let title = '', value = raw;
      if (idx >= 0) {
        title = raw.slice(0, idx).trim();
        value = raw.slice(idx + 2).trim();
      }
      current = { title, value, subs: [] };
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
      const raw = lvl2[1].trim();
      const idx = raw.indexOf('::');
      let subTitle = '', subValue = raw;
      if (idx >= 0) {
        subTitle = raw.slice(0, idx).trim();
        subValue = raw.slice(idx + 2).trim();
      }
      current.subs.push({ title: subTitle, value: subValue });
    }
    // Fallback: detect structure by indent when no colons are present
    const indentMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (indentMatch) {
      const indent = indentMatch[1].length;
      const content = indentMatch[2];
      if (indent === 4) {
        // Level 1
        if (current) rowsArr.push(current);
        current = { title: '', value: content, subs: [] };
      } else if (indent === 8 && current) {
        // Level 2
        current.subs.push({ title: '', value: content });
      } else if (indent >= 12 && current) {
        // Level 3+: nested list item
        const lastSub = current.subs[current.subs.length - 1];
        if (lastSub) {
          lastSub.value = lastSub.value
            ? `${lastSub.value}\n- ${content}`
            : `- ${content}`;
        }
      }
    }
  }
  // Push last group
  if (current) rowsArr.push(current);
  // Fallback: handle Dropbox-style lists if nothing parsed or structure is unusable (no subs)
  // Improved Dropbox-style detection: trigger only if 2-space sub-bullets are missing but 4-space and top-level bullets exist
  const hasLvl2 = lines.some(l => /^ {2}[-*]\s+/.test(l));
  const hasLvl4 = lines.some(l => /^ {4}[-*]\s+/.test(l));
  const hasLvl1 = lines.some(l => /^[-*]\s+/.test(l));
  const maybeDropboxStyle =
    (!hasLvl2 && hasLvl4 && hasLvl1);
  if (maybeDropboxStyle) {
    const rows = [];
    let current = null;
    for (const line of lines) {
      const match = line.match(/^(\s*)[-*]\s+(.*)/);
      if (!match) continue;
      const indent = match[1].length;
      const content = match[2].trim();
      if (indent === 0) {
        if (current) rows.push(current);
        // Split content into name/value if :: exists
        const idx = content.indexOf('::');
        let title = '', value = content;
        if (idx >= 0) {
          title = content.slice(0, idx).trim();
          value = content.slice(idx + 2).trim();
        }
        current = { title, value, subs: [] };
      } else if (indent === 4 && current) {
        // Split content into name/value if :: exists
        const idx = content.indexOf('::');
        let title = '', value = content;
        if (idx >= 0) {
          title = content.slice(0, idx).trim();
          value = content.slice(idx + 2).trim();
        }
        current.subs.push({ title, value });
      } else if (indent >= 8 && current && current.subs.length > 0) {
        const last = current.subs[current.subs.length - 1];
        // Always treat as a new bullet for Markdown list formatting at indent 8+
        const formatted = `- ${content}`;
        last.value += `\n${formatted}`;
      }
    }
    if (current) rows.push(current);
    if (rows.length > 0) {
      const maxSubCount = rows.reduce((m, r) => Math.max(m, r.subs.length), 0);
      rows.forEach(r => {
        while (r.subs.length < maxSubCount) r.subs.push({ title: '', value: '' });
      });
      // Parse headers and IDs
      const parsedHeaders = [rows[0]?.title || '', ...rows[0]?.subs.map(s => s.title) || []];
      const parsedIds = rows.map(r => {
        const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
        return idMatch ? idMatch[1].toUpperCase() : generateRowId();
      });
      return {
        columns: maxSubCount + 1,
        rows: rows.map((r, idx) => {
          let id = parsedIds[idx];
          let name = '';
          const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
          if (idMatch) {
            name = idMatch[2].trim();
          } else {
            name = r.title;
          }
          const row = [{
            id,
            name,
            value: r.value
          }];
          r.subs.forEach(s => row.push({ name: s.title, value: s.value }));
          return row;
        }),
        parsedHeaders,
        parsedIds
      };
    }
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
  const parsedHeaders = [rowsArr[0]?.title || '', ...rowsArr[0]?.subs.map(s => s.title) || []];
  const parsedIds = rowsArr.map(r => {
    const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
    return idMatch ? idMatch[1].toUpperCase() : generateRowId();
  });
  const rows = rowsArr.map((r, idx) => {
    // Always parse for ID and name using regex
    let id = parsedIds[idx];
    let parsedName = null;
    const idMatch = r.title.match(/^([BCDFGHJKLMNPQRSTVWXYZ][AEIOU][BCDFGHJKLMNPQRSTVWXYZ]\d)\s*\|\s*(.*)$/i);
    if (idMatch) {
      parsedName = idMatch[2].trim();
    }
    let name = parsedName !== null ? parsedName : r.title;
    const row = [{
      id,
      name,
      value: r.value
    }];
    r.subs.forEach(sub => row.push({ name: sub.title, value: sub.value }));
    return row;
  });
  return { columns, rows, parsedHeaders, parsedIds };
};

export default function App() {
  // Markdown parser (no HTML, support lists and links)
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true
  });
  // Keep reference to default list_item_open renderer
  const defaultListItemOpen = md.renderer.rules.list_item_open
    || function(tokens, idx, options, env, self) {
         return self.renderToken(tokens, idx, options);
       };
  // Inject inline styles on <li> to collapse vertical spacing and adjust spacing for Apple Notes compatibility
  md.renderer.rules.list_item_open = (tokens, idx, options, env, self) => {
    // Add inline style to collapse margins/padding and adjust left indent/line spacing for Apple Notes clarity
    tokens[idx].attrPush(['style', 'margin:0 0 0 1em;padding:0;line-height:1.2;']);
    return defaultListItemOpen(tokens, idx, options, env, self);
  };
  // Bullet list (ul) margin/padding collapse
  const defaultBulletListOpen = md.renderer.rules.bullet_list_open
    || function(tokens, idx, options, env, self) {
         return self.renderToken(tokens, idx, options);
       };
  md.renderer.rules.bullet_list_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrPush(['style', 'margin:0;padding:0;']);
    return defaultBulletListOpen(tokens, idx, options, env, self);
  };
  // Ordered list (ol) margin/padding collapse
  const defaultOrderedListOpen = md.renderer.rules.ordered_list_open
    || function(tokens, idx, options, env, self) {
         return self.renderToken(tokens, idx, options);
       };
  md.renderer.rules.ordered_list_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrPush(['style', 'margin:0;padding:0;']);
    return defaultOrderedListOpen(tokens, idx, options, env, self);
  };
  // Initial simple outline seed
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState([
    [{ id: generateRowId(), name: '', value: '' }]
  ]);
  const [showIds, setShowIds] = useState(true);
  // New state: includeIds
  const [includeIds, setIncludeIds] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // key = `${rowIndex}-${colIndex}`
  const inputRefs = useRef({}); // keys: `${rowIndex}-${colIndex}`
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const pendingDeleteTimer = useRef(null);
  // Two-step deletion for sub-bullet columns
  const [pendingDeleteCol, setPendingDeleteCol] = useState(null);

  const [showTextMode, setShowTextMode] = useState(false);

  // Text/table mode for text mode export/import
  const [textModeFormat, setTextModeFormat] = useState('text'); // 'text' or 'tables'

  const [showClearModal, setShowClearModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  // Disable sections/groups logic by stubbing empty arrays
  const rowSections = [];
  const colSections = [];

  // Debug: log current rows and columns on change
  useEffect(() => {
    console.log('DEBUG rows:', rows);
    console.log('DEBUG columns:', columns);
  }, [rows, columns]);
  const [tableCopied, setTableCopied] = useState(false);
  const liRefs = useRef([]);
  const initialisedFromText = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const colRefs = useRef([]);
  // For drag-and-drop insertion line vertical position
  const [insertionLineTop, setInsertionLineTop] = useState(null);

  // Track which column header is hovered
  const [hoveredCol, setHoveredCol] = useState(null);

  // Track which outline cell is focused to highlight table cell
  const [focusedCell, setFocusedCell] = useState({ row: null, col: null });

  // Helper to strip headers from export/import text
  const stripHeaders = (text) => {
    return text.split('\n').map(line => {
      // Top-level bullet
      const lvl1 = line.match(/^([*-]\s*)([^:]+):(.*)$/);
      if (lvl1) return `${lvl1[1]}${lvl1[3]}`;
      // Sub-bullet
      const lvl2 = line.match(/^(\s+[-*]\s*)([^:]+):(.*)$/);
      if (lvl2) return `${lvl2[1]}${lvl2[3]}`;
      return line;
    }).join('\n');
  };

  // Remove section/group arrays - now unused

  const handleClear = () => {
    // Reset to a single empty top-level row
    setColumns(1);
    setRows([[{ id: generateRowId(), name: '', value: '' }]]);
    setShowClearModal(false);
    setImportText('');
  };

  // Export text mode (outline) as Markdown-style text.
  // Accepts optional parameters useHeaders and useIds (default to current includeHeaders/includeIds).
  const getExportText = (useHeaders = includeHeaders, useIds = includeIds) => {
    const lines = [];
    rows.forEach(row => {
      const [first, ...subs] = row;
      const topLine =
        (showIds && useIds)
          ? `- ${first.id} | ${useHeaders && first.name ? `${first.name}:: ` : ''}${first.value}`
          : useHeaders && first.name
            ? `- ${first.name}:: ${first.value}`
            : `- ${first.value}`;
      lines.push(topLine);
      subs.forEach(cell => {
        const subText = useHeaders && cell.name
          ? `${cell.name}:: ${cell.value}`
          : `${cell.value}`;
        const subLines = subText.split('\n');
        lines.push(`  - ${subLines[0]}`);
        for (let i = 1; i < subLines.length; i++) {
          lines.push(`      ${subLines[i]}`);
        }
      });
    });
    return lines.join('\n');
  };

  // Export as TSV (tab-separated values), escaping newlines as \n
  // Accepts optional parameters useHeaders and useIds (default to current includeHeaders/includeIds).
  const getExportTSV = (useHeaders = includeHeaders, useIds = includeIds) => {
    const tsvHeader = [];
    rows[0].forEach((cell, idx) => {
      if (idx === 0 && showIds && useIds) tsvHeader.push('ID');
      if (useHeaders) tsvHeader.push(cell.name || '');
      else tsvHeader.push('');
    });
    const tsvRows = [];
    tsvRows.push(tsvHeader.join('\t'));
    rows.forEach(row => {
      const line = [];
      row.forEach((cell, idx) => {
        if (idx === 0 && showIds && useIds) line.push(cell.id || '');
        line.push((cell.value || '').replace(/\n/g, '\\n'));
      });
      tsvRows.push(line.join('\t'));
    });
    return tsvRows.join('\n');
  };

  // Export TSV with real newlines, for human-readable TSV (TSV Rich)
  const getExportTSVRich = (useHeaders = includeHeaders, useIds = includeIds) => {
    const tsvHeader = [];
    rows[0].forEach((cell, idx) => {
      if (idx === 0 && showIds && useIds) tsvHeader.push('ID');
      if (useHeaders) tsvHeader.push(cell.name || '');
      else tsvHeader.push('');
    });
    const tsvRows = [];
    tsvRows.push(tsvHeader.join('\t'));
    rows.forEach(row => {
      const line = [];
      row.forEach((cell, idx) => {
        if (idx === 0 && showIds && useIds) line.push(cell.id || '');
        line.push(cell.value || '');
      });
      tsvRows.push(line.join('\t'));
    });
    return tsvRows.join('\n');
  };
  // Parse TSV import, unescaping \n to real newlines
  const parseImportTSV = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { columns: 1, rows: [[{ name: '', value: '' }]] };

    const headers = lines[0].split('\t');
    const body = lines.slice(1).map(line => line.split('\t'));

    const maxCols = headers.length;
    const resultRows = body.map((line, idx) => {
      const row = [];
      for (let i = 0; i < maxCols; i++) {
        const rawValue = line[i] || '';
        const value = rawValue.replace(/\\n/g, '\n');
        // Only set id for the first cell if the header is 'ID'
        // (preserve ID if header is 'ID' for TSV import)
        // if (i === 0 && headers[0].toUpperCase() === 'ID') {
        if (i === 0 /*&& headers[0].toUpperCase() === 'ID'*/) {
          if (headers[0].toUpperCase() === 'ID') {
            const id = typeof value === 'string' && value.length === 4 ? value : generateRowId();
            row.push({ id, name: headers[i] || '', value });
          } else {
            row.push({ name: headers[i] || '', value });
          }
        } else {
          row.push({ name: headers[i] || '', value });
        }
      }
      return row;
    });

    return { columns: maxCols, rows: resultRows };
  };

  useEffect(() => {
    if (showTextMode) {
      const isEmpty = rows.length === 1 && columns === 1 && rows[0][0].value === '';
      if (isEmpty) {
        initialisedFromText.current = true;
        setImportText('');
      } else {
        setImportText(
          textModeFormat === 'tables'
            ? getExportTSV(includeHeaders, includeIds)
            : getExportText(includeHeaders, includeIds)
        );
      }
    } else if (initialisedFromText.current) {
      const isEmpty = rows.length === 1 && columns === 1 && rows[0][0].value === '';
      if (!isEmpty) {
        initialisedFromText.current = false;
        return;
      }
      let result = textModeFormat === 'tables'
        ? parseImportTSV(importText)
        : parseImportText(importText);
      if (result) {
        // If includeHeaders is false, override parsedHeaders with blanks
        let columnsCount = result.columns;
        let rowsArr = result.rows;
        let parsedHeaders = result.parsedHeaders || [];
        let parsedIds = result.parsedIds || [];
        // For text mode, if includeHeaders is false, blank header names
        if (!includeHeaders && rowsArr.length > 0) {
          // Blank out all cell.name in first row, and propagate to all rows
          rowsArr = rowsArr.map(row => row.map((cell, idx) => ({
            ...cell,
            name: ''
          })));
          parsedHeaders = Array(columnsCount).fill('');
        }
        // If includeIds is false, regenerate IDs for all rows
        if (!includeIds && rowsArr.length > 0) {
          rowsArr = rowsArr.map(row => [
            { ...row[0], id: generateRowId() },
            ...row.slice(1)
          ]);
          parsedIds = rowsArr.map(row => row[0].id);
        }
        setColumns(columnsCount);
        setRows(rowsArr);
        // Optionally store parsedHeaders/parsedIds if needed elsewhere
      }
      initialisedFromText.current = false;
    }
  }, [showTextMode, textModeFormat, includeHeaders, includeIds]);

  const handleCopy = () => {
    const textToCopy = includeHeaders ? importText : stripHeaders(importText);
    navigator.clipboard.writeText(textToCopy);
  };

  // Example 5×5 seed in Markdown-compatible text-mode format (using :: delimiters)
  const exampleText = [
    '- RT::R1-N',
    '  - C1-N:: R1-C1',
    '  - C2-N:: R1-C2',
    '  - C3-N:: R1-C3',
    '  - C4-N:: R1-C4',
    '  - C5-N:: R1-C5',
    '- RT::R2-N',
    '  - C1-N:: R2-C1',
    '  - C2-N:: R2-C2',
    '  - C3-N:: R2-C3',
    '  - C4-N:: R2-C4',
    '  - C5-N:: R2-C5',
    '- RT::R3-N',
    '  - C1-N:: R3-C1',
    '  - C2-N:: R3-C2',
    '  - C3-N:: R3-C3',
    '  - C4-N:: R3-C4',
    '  - C5-N:: R3-C5',
    '- RT::R4-N',
    '  - C1-N:: R4-C1',
    '  - C2-N:: R4-C2',
    '  - C3-N:: R4-C3',
    '  - C4-N:: R4-C4',
    '  - C5-N:: R4-C5',
    '- RT::R5-N',
    '  - C1-N:: **Bold Text**',
    '  - C2-N:: *Italic Text*',
    '  - C3-N:: List:',
    '      - Item A',
    '      - Item B',
    '      - Item C',
    '  - C4-N:: > Blockquote example',
    '  - C5-N:: `Inline code sample`'
  ].join('\n');

  // Handler to paste example into the textarea
  const handlePasteExample = () => {
    initialisedFromText.current = true;
    setImportText(exampleText);
  };

  // Generate Rich HTML table from current rows and columns, rendering Markdown
  const getTableHTML = () => {
    const headers = rows[0].map((cell, idx) =>
      cell.name || (idx === 0 ? 'Title' : `Column ${idx}`)
    );
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const tbody = rows.map(row => {
      const cells = row.map(cell => {
        const rendered = md.render(cell.value || '')
          .replace(/^<p>(?!- )/, '') // Only strip <p> if not followed by "- "
          .replace(/<\/p>\n?$/, '')
          .replace(/<p>(- .+?)<\/p>/g, '$1'); // Remove <p> wrapping list items
        return `<td>${rendered}</td>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    }).join('');
    return `<table>${thead}<tbody>${tbody}</tbody></table>`;
  };

  // Generate Plain HTML table with inline styles, no thead/tbody, for Apple Notes/email
  const getPlainHTML = () => {
    // Inline styles for table, th, td
    const tableStyle = 'border-collapse:collapse;border:1px solid #888;font-family:sans-serif;font-size:12px;';
    const thStyle = 'border:1px solid #888;padding:4px 8px;background:#f5f5f5;font-weight:bold;';
    const tdStyle = 'border:1px solid #888;padding:4px 8px;';
    let html = `<table style="${tableStyle}">`;
    // Header row
    html += '<tr>';
    rows[0].forEach((cell, idx) => {
      html += `<td style="${thStyle}">${cell.name || (idx === 0 ? 'Title' : `Column ${idx}`)}</td>`;
    });
    html += '</tr>';
    // Data rows
    rows.forEach((row, rIdx) => {
      if (rIdx === 0) return; // skip header row
      html += '<tr>';
      row.forEach(cell => {
        html += `<td style="${tdStyle}">${(cell.value || '').replace(/\n/g, '<br>')}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  };

  // Modal state and format for copy table modal
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  // Update default format to 'htmlRich'
  const [copyFormat, setCopyFormat] = useState('htmlRich'); // 'htmlRich' | 'htmlPlain' | 'tsvEscaped' | 'tsvRich' | 'ascii'
  const [includeCucumberHeaders, setIncludeCucumberHeaders] = useState(true);

  // Handler to open copy modal and set default format
  const handleCopyTable = () => {
    setCopyModalVisible(true);
    setCopyFormat('htmlRich');
  };

  // Export ASCII-art table (handles embedded Markdown lists and multiline cells)
  const getExportASCII = () => {
    // Prepare column names
    const columnNames = rows[0].map((cell, idx) =>
      idx === 0 ? (showIds ? 'ID' : 'Title') : cell.name || `Col ${idx}`
    );
    // Prepare data rows (array of arrays of string)
    const dataRows = rows.map(row =>
      row.map((cell, idx) =>
        idx === 0 && showIds ? `${cell.id}` : (cell.value || '')
      )
    );
    // All rows, including header
    const allRows = [columnNames, ...dataRows];

    // Expand cells with line breaks into arrays of lines
    const expandedRows = allRows.map(row =>
      row.map(cell => (cell || '').split('\n'))
    );

    // For each row, determine the max number of lines in any cell
    const rowHeights = expandedRows.map(row =>
      Math.max(...row.map(lines => lines.length))
    );

    // Pad each cell in each row so all cells have the same number of lines as the row's height
    const normalizedRows = expandedRows.map((row, rowIdx) =>
      row.map(lines => {
        const height = rowHeights[rowIdx];
        const padded = [...lines];
        while (padded.length < height) padded.push('');
        return padded;
      })
    );

    // Flatten normalizedRows so that each logical row becomes multiple visual rows
    const visualRows = [];
    for (let i = 0; i < normalizedRows.length; i++) {
      const height = rowHeights[i];
      for (let j = 0; j < height; j++) {
        visualRows.push(normalizedRows[i].map(cellLines => cellLines[j]));
      }
    }

    // Column widths: for each column, find the max width among all lines in that column
    const colWidths = columnNames.map((_, colIdx) =>
      Math.max(...visualRows.map(r => (r[colIdx] || '').length))
    );

    // Row rendering helpers
    const makeRow = row =>
      '| ' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |';
    const sepRow = '+-' + colWidths.map(w => '-'.repeat(w)).join('-+-') + '-+';

    // Output: header separator, header, separator, body, separator
    return [
      sepRow,
      makeRow(columnNames),
      sepRow,
      ...visualRows.slice(1).map(makeRow),
      sepRow
    ].join('\n');
  };
  // Export Cucumber pipe-delimited table (columns aligned, padded to max width)
  const getExportCucumber = (includeHeaders = false) => {
    const columnNames = rows[0].map((cell, idx) =>
      idx === 0 ? (showIds ? 'ID' : 'Title') : cell.name || `Col ${idx}`
    );
    const dataRows = rows.map(row =>
      row.map((cell, idx) =>
        idx === 0 && showIds
          ? cell.id
          : (cell.value || '').replace(/\n/g, '\\n')
      )
    );
    const allRows = includeHeaders ? [columnNames, ...dataRows] : dataRows;

    // Calculate max width for each column
    const colWidths = columnNames.map((_, colIdx) =>
      Math.max(...allRows.map(row => (row[colIdx] || '').length))
    );

    return allRows.map(row =>
      '| ' + row.map((cell, idx) => `${cell}`.padEnd(colWidths[idx])).join(' | ') + ' |'
    ).join('\n');
  };
  const pendingDeleteColTimer = useRef(null);

  // Helper to focus an input by row and column index and field
  const focusInput = (rowIndex, colIndex, field = 'value') => {
    const key = `${rowIndex}-${colIndex}-${field}`;
    const input = inputRefs.current[key];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  // On initial load, focus the first row label input
  useEffect(() => {
    focusInput(0, 0, 'value');
  }, []);

  // Insert a new row below the given rowIndex
  const insertRow = (rowIndex) => {
    // Build a new row that inherits column names
    const headerRow = rows[0] || [];
    const newRow = headerRow.map((cell, c) => ({
      name: cell.name,    // inherit name for every column
      value: ''           // empty value
    }));
    newRow[0].id = generateRowId();
    setRows((prevRows) => {
      const newRows = [...prevRows];
      newRows.splice(rowIndex + 1, 0, newRow);
      return newRows;
    });
    // We'll focus in the onUpdate or after insert
  };

  // Update a single cell field (name or value), with column name propagation
  const updateCell = (rowIndex, colIndex, field, value) => {
    setRows((prevRows) => {
      // Prevent editing the id field
      if (field === 'id') {
        return prevRows; // Disallow editing the ID
      }
      // If editing a column name, sync across all rows
      if (field === 'name') {
        return prevRows.map((row) =>
          row.map((cell, c) =>
            c === colIndex
              ? { ...cell, name: value }
              : cell
          )
        );
      }
      // Otherwise, only update the single cell value
      return prevRows.map((row, r) =>
        r === rowIndex
          ? row.map((cell, c) =>
              c === colIndex
                ? { ...cell, [field]: value }
                : cell
            )
          : row
      );
    });
  };

  // Check if all rows have last cell empty (value empty)
  const allLastCellsEmpty = () => {
    return rows.every((row) => row[columns - 1].value === '');
  };

  // Handle key down for inputs
  const handleKeyDown = (e, rowIndex, colIndex) => {
    // Arrow navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Build flat list of all positions (rowIndex, colIndex)
      const flat = [];
      rows.forEach((row, r) => {
        flat.push({ r, c: 0 });
        for (let c = 1; c < columns; c++) {
          flat.push({ r, c });
        }
      });
      // Find current pos
      const currentIdx = flat.findIndex(pos => pos.r === rowIndex && pos.c === colIndex);
      if (e.shiftKey) {
        // Move between rows at same column
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const targetRow = rowIndex + delta;
        if (targetRow >= 0 && targetRow < rows.length) {
          focusInput(targetRow, colIndex);
        }
      } else {
        // Move through flat list
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const target = currentIdx + delta;
        if (target >= 0 && target < flat.length) {
          focusInput(flat[target].r, flat[target].c, 'value');
        }
      }
      return;
    }
    if (e.key === 'Enter') {
      if (colIndex > 0 && rows[rowIndex][colIndex].value === '') {
        e.preventDefault();
        // If name box has text, move focus to value box instead of outdenting
        if (rows[rowIndex][colIndex].name !== '') {
          focusInput(rowIndex, colIndex, 'value');
          return;
        }
        // If any other row in this column has data, create next sub-bullet (column)
        const columnHasData = rows.some((r, idx) => idx !== rowIndex && r[colIndex].value !== '');
        if (columnHasData) {
          // Add new column
          setColumns(prev => prev + 1);
          setRows(prevRows => prevRows.map(r => [...r, { name: '', value: '' }]));
          setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
          return;
        }
        // Otherwise, outdent this empty sub-bullet into a new top-level row
        const newColumns = columns - 1;
        setColumns(newColumns);
        setRows(prevRows => {
          const newRows = prevRows.map(row => {
            const nr = [...row];
            nr.splice(colIndex, 1);
            return nr;
          });
          // Capture and trim current column names from header row to new length
          const headerNames = prevRows[0]
            .map(cell => cell.name)
            .slice(0, newColumns);
          // Promote the sub-bullet label (which is empty here) to a new row label
          const parentLabel = prevRows[rowIndex][colIndex];
          // Build the promoted row with inherited names
          const promotedRow = headerNames.map((colName, idx) => ({
            name: colName,
            value: idx === 0 ? parentLabel.value : ''
          }));
          newRows.splice(rowIndex + 1, 0, promotedRow);
          return newRows;
        });
        setTimeout(() => focusInput(rowIndex + 1, 0), 0);
        return;
      } else if (colIndex > 0 && rows[rowIndex][colIndex].value !== '') {
        e.preventDefault();
        // Add a new sub-bullet column
        setColumns(prev => prev + 1);
        setRows(prevRows => prevRows.map(r => [...r, { name: '', value: '' }]));
        setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
        return;
      }
      e.preventDefault();
      if (colIndex === 0) {
        // In row label: insert new row
        insertRow(rowIndex);
        setTimeout(() => focusInput(rowIndex + 1, 0), 0);
      } else {
        // In sub-bullet cell: create or move to next sub-bullet
        if (colIndex === columns - 1) {
          // Add new column
          setColumns(prev => prev + 1);
          setRows(prevRows =>
            prevRows.map((row, r) => {
              const newRow = [...row, { name: '', value: '' }];
              return newRow;
            })
          );
          setTimeout(() => focusInput(rowIndex, colIndex + 1, 'name'), 0);
        } else {
          // Move to next sub-bullet
          focusInput(rowIndex, colIndex + 1);
        }
      }
    } else if (e.key === 'Tab') {
      // Indent row label into sub-bullet of previous row
      if (!e.shiftKey && colIndex === 0) {
        e.preventDefault();
        // Indent row into a sub-bullet of the previous row
        if (rowIndex > 0) {
          const newRows = [...rows];
          const [movedRow] = newRows.splice(rowIndex, 1);
          // Ensure at least 2 columns
          if (columns === 1) {
            setColumns(2);
            // Add empty cell to existing rows
            newRows.forEach(r => r.push({ name: '', value: '' }));
            movedRow.push({ name: '', value: '' });
          }
          // Insert movedRow[0].value into previous row's first sub-cell value, name empty
          newRows[rowIndex - 1][1] = { name: '', value: movedRow[0].value };
          setRows(newRows);
          // Focus the new sub-bullet cell
          setTimeout(() => focusInput(rowIndex - 1, 1, 'name'), 0);
        }
        return;
      }
      e.preventDefault();
      if (!e.shiftKey) {
        // Tab forward
        if (colIndex === columns - 1) {
          // Add new column
          setColumns((prev) => prev + 1);
          setRows((prevRows) =>
            prevRows.map((row) => {
              const newRow = [...row];
              newRow.push({ name: '', value: '' });
              return newRow;
            })
          );
          setTimeout(() => focusInput(rowIndex, columns, 'name'), 0);
        } else {
          // Move focus right
          focusInput(rowIndex, colIndex + 1);
        }
      } else {
        // Shift+Tab backward
        if (colIndex === 1) {
          // Move focus to row label input
          focusInput(rowIndex, 0);
        } else if (colIndex > 1) {
          focusInput(rowIndex, colIndex - 1);
        }
      }
    } else if (e.key === 'Backspace') {
      // Only handle if in last column and cell is empty
      if (
        colIndex === columns - 1 &&
        e.target.value === '' &&
        allLastCellsEmpty() &&
        columns > 1
      ) {
        e.preventDefault();
        // Remove last column
        setColumns((prev) => prev - 1);
        setRows((prevRows) =>
          prevRows.map((row) => {
            const newRow = row.slice(0, -1);
            return newRow;
          })
        );
        setTimeout(() => focusInput(rowIndex, columns - 2), 0);
      }
    }
  };

  // Render outline <ul>
  // Each top-level <li> has input for row label (col 0)
  // If columns > 1, nested <ul> with inputs for sub-cells (col 1..)
  // Reorder mode state
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderAxis, setReorderAxis] = useState('rows');

  // Drag-to-reorder handlers
  const handleDragStart = (e, index) => {
    e.preventDefault();
    setDraggingIndex(index);
    setDragOverIndex(index);
  };

  const handleDragMove = (e) => {
    if (draggingIndex === null) return;
    const y = e.clientY;
    let newOver = null;
    // Choose refs based on axis
    const refs = reorderAxis === 'rows' ? liRefs.current : colRefs.current;
    const count = reorderAxis === 'rows' ? rows.length : rows[0].length - 1;
    refs.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (y < rect.top + rect.height / 2 && newOver === null) {
        newOver = i;
      }
    });
    if (newOver === null) newOver = count;
    // Compute midpoint between items for the insertion line
    const containerRect = e.currentTarget.getBoundingClientRect();
    let aboveEl = refs[newOver - 1];
    let belowEl = refs[newOver];
    if (!aboveEl) aboveEl = { getBoundingClientRect: () => containerRect };
    if (!belowEl) belowEl = { getBoundingClientRect: () => containerRect };
    const rectAbove = aboveEl.getBoundingClientRect();
    const rectBelow = belowEl.getBoundingClientRect();
    const midY = (rectAbove.bottom + rectBelow.top) / 2;
    setInsertionLineTop(midY - containerRect.top);
    if (newOver !== dragOverIndex) setDragOverIndex(newOver);
  };

  const handleDragEnd = () => {
    if (draggingIndex !== null && dragOverIndex !== null) {
      const insertAt = dragOverIndex > draggingIndex
        ? dragOverIndex - 1
        : dragOverIndex;
      if (reorderAxis === 'rows') {
        // Reorder rows (unchanged)
        const newRows = [...rows];
        const [moved] = newRows.splice(draggingIndex, 1);
        newRows.splice(insertAt, 0, moved);
        setRows(newRows);
      } else {
        // Reorder sub-bullet columns, preserving column 1
        const sourceFullIndex = draggingIndex + 1;
        // Desired insertion before slice index dragOverIndex => full index = dragOverIndex + 1
        let destFullIndex = dragOverIndex + 1;
        // If moving downwards, removal shifts target left by 1
        if (destFullIndex > sourceFullIndex) {
          destFullIndex--;
        }
        const newRows = rows.map(row => {
          const copy = [...row];
          const [moved] = copy.splice(sourceFullIndex, 1);
          copy.splice(destFullIndex, 0, moved);
          return copy;
        });
        setRows(newRows);
      }
    }
    setDraggingIndex(null);
    setDragOverIndex(null);
    setInsertionLineTop(null);
  };

  return (
    <>
    <div className="app-container" style={{ position: 'relative', paddingTop: 80 }}>
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <img src={logo} alt="aboutLiner logo" style={{ height: 56, pointerEvents: 'none' }} />
      </div>
      <div
        className={`outline-panel${showTextMode ? ' export-mode' : ''}${reorderMode ? ' reorder-mode' : ''}`}
        style={{
          position: 'relative',
          paddingTop: showTextMode
            ? '35px'
            : reorderMode
              ? '40px'  // additional space for rows/columns toggle
              : '16px'
        }}
        onMouseMove={reorderMode ? handleDragMove : undefined}
        onMouseUp={reorderMode ? handleDragEnd : undefined}
      >
        <button
          onClick={() => {
            if (showTextMode) {
              if (textModeFormat === 'text') {
                const isBlank = rows.length === 1 && columns === 1 && rows[0][0].value === '';
                if (!isBlank) {
                  setShowTextMode(false);
                  setShowInvalidModal(false);
                  return;
                }
                if (importText.trim() === '') {
                  setShowTextMode(false);
                  setShowInvalidModal(false);
                } else {
                  // Parse input text and apply header/id logic after parsing
                  let result = parseImportText(importText);
                  if (result) {
                    let columnsCount = result.columns;
                    let rowsArr = result.rows;
                    let parsedHeaders = result.parsedHeaders || [];
                    let parsedIds = result.parsedIds || [];
                    // If includeHeaders is false, blank out header names
                    if (!includeHeaders && rowsArr.length > 0) {
                      rowsArr = rowsArr.map(row => row.map((cell, idx) => ({
                        ...cell,
                        name: ''
                      })));
                      parsedHeaders = Array(columnsCount).fill('');
                    }
                    // If includeIds is false, regenerate IDs
                    if (!includeIds && rowsArr.length > 0) {
                      rowsArr = rowsArr.map(row => [
                        { ...row[0], id: generateRowId() },
                        ...row.slice(1)
                      ]);
                      parsedIds = rowsArr.map(row => row[0].id);
                    }
                    setColumns(columnsCount);
                    setRows(rowsArr);
                    initialisedFromText.current = true;
                    setShowTextMode(false);
                    setShowInvalidModal(false);
                  } else {
                    setShowInvalidModal(true);
                  }
                }
              } else {
                const isBlank = rows.length === 1 && columns === 1 && rows[0][0].value === '';
                if (!isBlank) {
                  setShowTextMode(false);
                  setShowInvalidModal(false);
                  return;
                }
                try {
                  // Parse TSV and apply header/id logic after parsing
                  let result = parseImportTSV(importText);
                  if (result) {
                    let columnsCount = result.columns;
                    let rowsArr = result.rows;
                    // If includeHeaders is false, blank out header names
                    if (!includeHeaders && rowsArr.length > 0) {
                      rowsArr = rowsArr.map(row => row.map((cell, idx) => ({
                        ...cell,
                        name: ''
                      })));
                    }
                    // If includeIds is false, regenerate IDs
                    if (!includeIds && rowsArr.length > 0) {
                      rowsArr = rowsArr.map(row => [
                        { ...row[0], id: generateRowId() },
                        ...row.slice(1)
                      ]);
                    }
                    setColumns(columnsCount);
                    setRows(rowsArr);
                    initialisedFromText.current = true;
                    setShowTextMode(false);
                    setShowInvalidModal(false);
                  } else {
                    setShowInvalidModal(true);
                  }
                } catch {
                  setShowInvalidModal(true);
                }
              }
            } else {
              setShowTextMode(true);
            }
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          {'<t>'}
        </button>
        {/* Toggle IDs button */}
        {!showTextMode && (
          <button
            onClick={() => setShowIds(!showIds)}
            style={{
              position: 'absolute',
              top: 8,
              right: 60,
              padding: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
            title="Toggle IDs"
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: showIds ? '#000' : '#ccc',
                fontFamily: 'sans-serif',
                letterSpacing: '0.5px'
              }}
            >
              ID
            </span>
          </button>
        )}
        {/* Reorder mode toggle */}
        {!showTextMode && (
          <button
            onClick={() => setReorderMode(!reorderMode)}
            style={{
              position: 'absolute',
              top: 8,
              right: 35,
              padding: '4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', color: '#000' }}
            >
              swap_vert
            </span>
          </button>
        )}
        {/* Axis toggle for reordering */}
        {reorderMode && !showTextMode && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'inline-flex',
              border: '1px solid #ccc',
              borderRadius: 4,
              overflow: 'hidden',
              fontSize: '0.8em',
              marginBottom: '4px'
            }}
          >
            <button
              onClick={() => setReorderAxis('rows')}
              style={{
                padding: '4px 8px',
                background: reorderAxis === 'rows' ? '#4d90fe' : '#fff',
                color: reorderAxis === 'rows' ? '#fff' : '#000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Rows
            </button>
            <button
              onClick={() => setReorderAxis('columns')}
              style={{
                padding: '4px 8px',
                background: reorderAxis === 'columns' ? '#4d90fe' : '#fff',
                color: reorderAxis === 'columns' ? '#fff' : '#000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Columns
            </button>
          </div>
        )}
        {showTextMode ? (
          <>
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'inline-flex',
                border: '1px solid #ccc',
                borderRadius: 4,
                overflow: 'hidden',
                fontSize: '0.8em',
                marginBottom: '4px'
              }}
            >
              {['text','tables'].map((fmt, i) => (
                <button
                  key={fmt}
                  onClick={() => setTextModeFormat(fmt)}
                  style={{
                    padding: '4px 8px',
                    background: textModeFormat === fmt ? '#4d90fe' : '#fff',
                    color: textModeFormat === fmt ? '#fff' : '#000',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {fmt === 'text' ? 'Text' : 'Table'}
                </button>
              ))}
            </div>
            <textarea
              readOnly={!(rows.length === 1 && columns === 1 && rows[0][0].value === '')}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              style={{ width: '100%', height: 'calc(100% - 40px)', boxSizing: 'border-box' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8
              }}
            >
              <div>
                <button className="btn btn-primary" onClick={handleCopy}>
                  Copy
                </button>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 8 }}
                  onClick={() => setShowClearModal(true)}
                >
                  Clear
                </button>
                <button
                  className="btn btn-primary"
                  style={{ marginLeft: 8 }}
                  onClick={handlePasteExample}
                >
                  Paste Example
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.8em',
                    color: '#666',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    marginBottom: 4,
                    textAlign: 'right'
                  }}
                >
                  Include Headers
                  <input
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={() => setIncludeHeaders(!includeHeaders)}
                    style={{ marginLeft: 4 }}
                  />
                </label>
                {showIds && (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '0.8em',
                      color: '#666',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      textAlign: 'right'
                    }}
                  >
                    Include IDs
                    <input
                      type="checkbox"
                      checked={includeIds}
                      onChange={() => setIncludeIds(!includeIds)}
                      style={{ marginLeft: 4 }}
                    />
                  </label>
                )}
              </div>
            </div>
            {showClearModal && (
              <div style={{
                position: 'fixed', top: 0, left: 0,
                width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  background: '#fff', padding: 24,
                  borderRadius: 8, maxWidth: 400,
                  textAlign: 'center'
                }}>
                  <p>This will delete all data, are you sure?</p>
                  <button className="btn btn-primary" style={{ marginRight: 8 }} onClick={() => setShowClearModal(false)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleClear}>Confirm</button>
                </div>
              </div>
            )}
            {showInvalidModal && (
              <div style={{
                position: 'fixed', top: 0, left: 0,
                width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  background: '#fff', padding: 24,
                  borderRadius: 8, maxWidth: 400,
                  textAlign: 'center'
                }}>
                  <p>Invalid format</p>
                  <button className="btn btn-primary" onClick={() => setShowInvalidModal(false)}>Ok</button>
                </div>
              </div>
            )}
          </>
        ) : (
          reorderMode && reorderAxis === 'columns' ? (
            <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
              {rows[0].slice(1).map((cell, idx) => {
                const colIndex = idx + 1;
                return (
                  <React.Fragment key={colIndex}>
                    {dragOverIndex === idx && insertionLineTop != null && (
                      <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
                    )}
                    <li
                      ref={el => colRefs.current[idx] = el}
                      key={colIndex}
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <span
                        className="material-symbols-outlined"
                        draggable={false}
                        onMouseDown={e => handleDragStart(e, idx)}
                        style={{
                          fontSize: '16px',
                          color: '#000',
                          marginRight: '8px',
                          cursor: 'grab'
                        }}
                      >
                        drag_indicator
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: `var(--col-color-${colIndex + 1})`,
                          padding: '4px 12px',
                          borderRadius: '999px',
                          color: '#333'
                        }}
                      >
                        {cell.name || `Column ${idx + 1}`}
                      </span>
                    </li>
                  </React.Fragment>
                );
              })}
              {dragOverIndex === rows[0].length - 1 && insertionLineTop != null && (
                <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
              )}
            </ul>
          ) : (
            <ul style={{ listStyleType: 'none', paddingLeft: 0, position: 'relative' }}>
              {rows.map((row, rowIndex) => (
                <React.Fragment key={rowIndex}>
                  {reorderMode && dragOverIndex === rowIndex && insertionLineTop != null && (
                    <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
                  )}
                  <li
                    ref={el => liRefs.current[rowIndex] = el}
                    key={rowIndex}
                    className={pendingDeleteRow === rowIndex ? 'pending-delete' : ''}
                    style={{
                      marginBottom: 8,
                      ...(reorderMode ? { display: 'flex', alignItems: 'center' } : {})
                    }}
                  >
                    {reorderMode && (
                      <span
                        className="material-symbols-outlined"
                        draggable={false}
                        onMouseDown={e => handleDragStart(e, rowIndex)}
                        style={{
                          fontSize: '16px',
                          color: '#000',
                          marginRight: '8px',
                          cursor: 'grab'
                        }}
                      >
                        drag_indicator
                      </span>
                    )}
                    {/* existing row content */}
                    <div className="sub-bullet__cell" style={{ display: 'flex', gap: '4px' }}>
                      {!reorderMode && (
                        <input
                          className="cell-name"
                          type="text"
                          placeholder="Title"
                          value={row[0].name}
                          onChange={e => updateCell(rowIndex, 0, 'name', e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            if (e.key === 'Tab' && !e.shiftKey) {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
                              e.preventDefault();
                              focusInput(rowIndex, 0, 'value');
                              return;
                            }
                            handleKeyDown(e, rowIndex, 0);
                          }}
                          ref={el => (inputRefs.current[`${rowIndex}-0-name`] = el)}
                          aria-label={`Row ${rowIndex + 1} column 1 name`}
                          onFocus={() => setFocusedCell({ row: rowIndex, col: 0 })}
                          onBlur={() => setFocusedCell({ row: null, col: null })}
                          onDoubleClick={e => e.target.select()}
                        />
                      )}
                      <input
                        className="cell-value"
                        type="text"
                        placeholder="Value"
                        style={{ width: reorderMode ? '200%' : '100%' }}
                        value={row[0].value}
                        onChange={e => updateCell(rowIndex, 0, 'value', e.target.value)}
                        onKeyDown={e => {
                          // Two-step deletion when sub-bullets have values
                          if (
                            e.key === 'Backspace' &&
                            row[0].value === '' &&
                            columns > 1 &&
                            rows[rowIndex].slice(1).some(cell => cell.value !== '')
                          ) {
                            e.preventDefault();
                            if (pendingDeleteRow !== rowIndex) {
                              setPendingDeleteRow(rowIndex);
                              clearTimeout(pendingDeleteTimer.current);
                              pendingDeleteTimer.current = setTimeout(() => {
                                setPendingDeleteRow(null);
                              }, 5000);
                            } else {
                              clearTimeout(pendingDeleteTimer.current);
                              setPendingDeleteRow(null);
                              setRows(prev => {
                                const copy = [...prev];
                                copy.splice(rowIndex, 1);
                                return copy;
                              });
                              setTimeout(() => focusInput(Math.max(0, rowIndex - 1), 0, 'value'), 0);
                            }
                            return;
                          }
                          // Backspace on empty level-1 with all sub-values empty => remove row
                          if (
                            e.key === 'Backspace' &&
                            row[0].value === '' &&
                            columns > 1 &&
                            rows[rowIndex].slice(1).every(cell => cell.value === '')
                          ) {
                            e.preventDefault();
                            setRows(prev => {
                              const copy = [...prev];
                              copy.splice(rowIndex, 1);
                              return copy;
                            });
                            // focus previous row's value
                            setTimeout(() => {
                              const target = Math.max(0, rowIndex - 1);
                              focusInput(target, 0, 'value');
                            }, 0);
                            return;
                          }
                          // Custom backspace: if only one column and value empty, delete row
                          if (
                            e.key === 'Backspace' &&
                            columns === 1 &&
                            row[0].value === ''
                          ) {
                            e.preventDefault();
                            if (rowIndex > 0) {
                              // Remove this row
                              setRows(prev => {
                                const copy = [...prev];
                                copy.splice(rowIndex, 1);
                                return copy;
                              });
                              // Focus previous row's value after state update
                              setTimeout(() => focusInput(rowIndex - 1, 0, 'value'), 0);
                            }
                            return;
                          }
                          // Preserve existing arrow-left reveal and other handling
                          if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                            e.preventDefault();
                            setEditingCell(`${rowIndex}-0-name`);
                            focusInput(rowIndex, 0, 'name');
                            return;
                          }
                          handleKeyDown(e, rowIndex, 0);
                        }}
                        ref={el => (inputRefs.current[`${rowIndex}-0-value`] = el)}
                        aria-label={`Row ${rowIndex + 1} column 1 value`}
                        onFocus={() => { setEditingCell(`${rowIndex}-0-value`); setPendingDeleteRow(null); clearTimeout(pendingDeleteTimer.current); setFocusedCell({ row: rowIndex, col: 0 }); }}
                        onBlur={() => setFocusedCell({ row: null, col: null })}
                        onDoubleClick={e => e.target.select()}
                      />
                    </div>
                    {!reorderMode && columns > 1 && (
                      <ul style={{ listStyleType: 'none', paddingLeft: 16, marginTop: 4 }}>
                        {row.slice(1).map((cell, colIndex) => (
                          <li key={colIndex}>
                            <div
                              className={
                                'sub-bullet__cell' +
                                (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name` ? ' collapsed-name' : '') +
                                (pendingDeleteCol === colIndex ? ' pending-delete-col' : '')
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onMouseDown={e => {
                                // Only focus when clicking the container, not its child inputs
                                if (e.target !== e.currentTarget) return;
                                e.preventDefault();
                                setEditingCell(`${rowIndex}-${colIndex + 1}-name`);
                                focusInput(rowIndex, colIndex + 1, 'name');
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Title"
                                value={row[colIndex + 1].name}
                                onChange={e => updateCell(rowIndex, colIndex + 1, 'name', e.target.value)}
                                style={{
                                  // circle when name exists and not focused; pill otherwise
                                  width: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? '16px'
                                    : '15%',
                                  height: '16px',
                                  borderRadius: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? '50%'
                                    : '999px',
                                  backgroundColor: `var(--col-color-${colIndex + 2})`,
                                  color: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`)
                                    ? 'transparent'
                                    : '#333',
                                  overflow: 'hidden',
                                  border: 'none',
                                  padding: (row[colIndex + 1].name && editingCell !== `${rowIndex}-${colIndex + 1}-name`) ? '0' : '0 8px',
                                  transition: 'all 0.2s ease'
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Tab' && !e.shiftKey) {
                                    e.preventDefault();
                                    focusInput(rowIndex, colIndex + 1, 'value');
                                    return;
                                  }
                                  if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
                                    e.preventDefault();
                                    focusInput(rowIndex, colIndex + 1, 'value');
                                  }
                                  handleKeyDown(e, rowIndex, colIndex + 1);
                                }}
                                ref={(el) => (inputRefs.current[`${rowIndex}-${colIndex + 1}-name`] = el)}
                                aria-label={`Row ${rowIndex + 1} column ${colIndex + 2} name`}
                                onFocus={() => { setEditingCell(`${rowIndex}-${colIndex + 1}-name`); setFocusedCell({ row: rowIndex, col: colIndex + 1 }); }}
                                onBlur={() => { setEditingCell(null); setFocusedCell({ row: null, col: null }); }}
                                onDoubleClick={e => e.target.select()}
                              />
                              <textarea
                                placeholder="Value"
                                value={row[colIndex + 1].value}
                                onChange={e => {
                                  updateCell(rowIndex, colIndex + 1, 'value', e.target.value);
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                style={{ flex: 1, resize: 'vertical', minHeight: '1.5em', overflow: 'hidden' }}
                                rows={1}
                                onKeyDown={e => {
                                  // Two-step deletion for sub-bullets with mixed data
                                  if (
                                    e.key === 'Backspace' &&
                                    e.target.value === '' &&
                                    columns > 1 &&
                                    rows.some(r => r[colIndex + 1].value !== '')
                                  ) {
                                    e.preventDefault();
                                    if (pendingDeleteCol !== colIndex) {
                                      setPendingDeleteCol(colIndex);
                                      clearTimeout(pendingDeleteColTimer.current);
                                      pendingDeleteColTimer.current = setTimeout(() => {
                                        setPendingDeleteCol(null);
                                      }, 5000);
                                    } else {
                                      clearTimeout(pendingDeleteColTimer.current);
                                      setPendingDeleteCol(null);
                                      // remove column
                                      setColumns(prev => prev - 1);
                                      setRows(prevRows =>
                                        prevRows.map(r => {
                                          const copy = [...r];
                                          copy.splice(colIndex + 1, 1);
                                          return copy;
                                        })
                                      );
                                      // focus prior column or row label
                                      setTimeout(() => {
                                        if (colIndex > 0) {
                                          focusInput(rowIndex, colIndex, 'value');
                                        } else {
                                          focusInput(rowIndex, 0, 'value');
                                        }
                                      }, 0);
                                    }
                                    return;
                                  }
                                  // If backspace on an empty sub-cell and entire column is empty: remove that column across all rows
                                  if (
                                    e.key === 'Backspace' &&
                                    e.target.value === '' &&
                                    rows.every(r => r[colIndex + 1].value === '')
                                  ) {
                                    e.preventDefault();
                                    // remove column
                                    setColumns(prev => prev - 1);
                                    setRows(prevRows =>
                                      prevRows.map(r => {
                                        const copy = [...r];
                                        copy.splice(colIndex + 1, 1);
                                        return copy;
                                      })
                                    );
                                    // determine new focus position: same row, previous column (or level-1 if none)
                                    setTimeout(() => {
                                      if (colIndex > 0) {
                                        focusInput(rowIndex, colIndex, 'value');
                                      } else {
                                        focusInput(rowIndex, 0, 'value');
                                      }
                                    }, 0);
                                    return;
                                  }
                                  // Enter creates new column/row behavior; Shift+Enter inserts newline
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleKeyDown(e, rowIndex, colIndex + 1);
                                  }
                                  // ArrowUp/ArrowDown navigate between cells
                                  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    handleKeyDown(e, rowIndex, colIndex + 1);
                                  }
                                  // ArrowLeft at start moves focus back to name input and set editingCell
                                  else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
                                    e.preventDefault();
                                    const key = `${rowIndex}-${colIndex + 1}-name`;
                                    setEditingCell(key);
                                    focusInput(rowIndex, colIndex + 1, 'name');
                                    return;
                                  }
                                }}
                                ref={el => (inputRefs.current[`${rowIndex}-${colIndex + 1}-value`] = el)}
                                aria-label={`Row ${rowIndex + 1} column ${colIndex + 2} value`}
                                onFocus={() => {
                                  setEditingCell(`${rowIndex}-${colIndex + 1}-value`);
                                  setPendingDeleteCol(null);
                                  clearTimeout(pendingDeleteColTimer.current);
                                  setFocusedCell({ row: rowIndex, col: colIndex + 1 });
                                }}
                                onBlur={() => { setEditingCell(null); setFocusedCell({ row: null, col: null }); }}
                                onDoubleClick={e => e.target.select()}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </React.Fragment>
              ))}
              {reorderMode && dragOverIndex === rows.length && insertionLineTop != null && (
                <div className="insertion-line" style={{ top: `${insertionLineTop}px` }} />
              )}
            </ul>
          )
        )}
      </div>
      <div className="table-panel" style={{ position: 'relative' }}>
        <table>
          <thead>
            <tr>
              {showIds && <th style={{ fontSize: '0.75em', color: '#888' }}>ID</th>}
              {rows[0].map((cell, idx) => (
                <th
                  key={idx}
                  style={{ cursor: 'pointer' }}
                  onClick={() => focusInput(0, idx, 'name')}
                  onDoubleClick={() => {
                    // focus then select all after focus has taken effect
                    focusInput(0, idx, 'name');
                    setTimeout(() => {
                      const ref = inputRefs.current[`0-${idx}-name`];
                      if (ref) {
                        ref.focus();
                        if (typeof ref.select === 'function') {
                          ref.select();
                        } else {
                          ref.setSelectionRange(0, ref.value.length);
                        }
                      }
                    }, 0);
                  }}
                  onMouseEnter={() => setHoveredCol(idx)}
                  onMouseLeave={() => setHoveredCol(null)}
                  className={hoveredCol === idx ? 'highlight-column' : ''}
                >
                  {idx === 0 ? (cell.name || 'Title') : (
                    <span
                      className="column-header-pill"
                      style={{ backgroundColor: `var(--col-color-${idx + 1})` }}
                    >
                      {cell.name || `Col ${idx}`}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {showIds && (
                  <td style={{ fontSize: '0.75em', fontFamily: 'monospace', color: '#666' }}>
                    {row[0].id}
                  </td>
                )}
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      cursor: 'pointer',
                      ...(focusedCell.row === rIdx && focusedCell.col === cIdx
                        ? {
                            backgroundColor: 'rgba(25, 118, 210, 0.1)',
                            outline: '1px solid rgba(25, 118, 210, 0.4)',
                            outlineOffset: '-1px',
                          }
                        : {})
                    }}
                    onClick={() => focusInput(rIdx, cIdx, 'value')}
                    onDoubleClick={() => {
                      // focus then select all after focus has taken effect
                      focusInput(rIdx, cIdx, 'value');
                      setTimeout(() => {
                        const ref = inputRefs.current[`${rIdx}-${cIdx}-value`];
                        if (ref) {
                          ref.focus();
                          if (typeof ref.select === 'function') {
                            ref.select();
                          } else {
                            ref.setSelectionRange(0, ref.value.length);
                          }
                        }
                      }, 0);
                    }}
                    className={
                      (hoveredCol === cIdx ? 'highlight-column ' : '') +
                      (focusedCell.row === rIdx && focusedCell.col === cIdx ? 'highlight-cell' : '')
                    }
                  >
                    {cIdx > 0
                      ? (
                        <div
                          className="markdown-cell"
                          style={{
                            lineHeight: '1',
                            margin: 0,
                            padding: 0
                          }}
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(md.render(cell.value || ''))
                          }}
                        />
                      )
                      : cell.value
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={handleCopyTable}
          className="btn-copy-table"
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            padding: '8px 12px',
            border: 'none',
            background: '#4d90fe',
            color: '#fff',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Copy Table
        </button>
      </div>
    </div>
    {/* Copy Table Modal */}
    {copyModalVisible && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          width: '90%',
          maxWidth: '600px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: 8 }}>
            {[
              { key: 'htmlRich', label: 'HTML' },
              { key: 'tsvEscaped', label: 'TSV' },
              { key: 'ascii', label: 'ASCII' },
              { key: 'cucumber', label: 'Cucumber' }
            ].map(fmt => (
              <button
                key={fmt.key}
                onClick={() => setCopyFormat(fmt.key)}
                style={{
                  padding: '4px 8px',
                  marginRight: 4,
                  background: copyFormat === fmt.key ? '#4d90fe' : '#fff',
                  color: copyFormat === fmt.key ? '#fff' : '#000',
                  border: '1px solid #ccc',
                  borderRadius: 4
                }}
              >
                {fmt.label}
              </button>
            ))}
          </div>
          <pre
            style={{
              width: '100%',
              height: 200,
              overflowX: 'auto',
              overflowY: 'scroll',
              whiteSpace:
                copyFormat === 'htmlRich'
                  ? 'pre-line'
                  : 'pre',
              fontFamily: 'monospace',
              fontSize: '12px',
              background: '#f9f9f9',
              border: '1px solid #ccc',
              padding: '8px'
            }}
          >
            {
              copyFormat === 'htmlRich'
                ? getTableHTML()
                : copyFormat === 'tsvEscaped'
                ? getExportTSV()
                : copyFormat === 'ascii'
                ? getExportASCII()
                : copyFormat === 'cucumber'
                ? getExportCucumber(includeCucumberHeaders)
                : ''
            }
          </pre>
          <div style={{ fontSize: '0.8em', color: '#555', marginTop: 8 }}>
            {{
              htmlRich: 'The most compatible format with full styling and structure. Works across Word, Excel, Confluence, Dropbox Paper, and Apple Notes.',
              tsvEscaped: 'Structured TSV ideal for spreadsheets and re-importing. Escaped newlines preserve data integrity.',
              ascii: 'Simple text-based table for plain environments like code snippets or terminals.',
              cucumber: 'A simple, pipe-delimited text document table often used in Cucumber tests.'
            }[copyFormat]}
          </div>
          {copyFormat === 'cucumber' && (
            <label style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', fontSize: '0.8em', color: '#666' }}>
              Include Headers
              <input
                type="checkbox"
                checked={includeCucumberHeaders}
                onChange={() => setIncludeCucumberHeaders(!includeCucumberHeaders)}
                style={{ marginLeft: 4 }}
              />
            </label>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={async (e) => {
                const text =
                  copyFormat === 'htmlRich'
                    ? getTableHTML()
                    : copyFormat === 'tsvEscaped'
                    ? getExportTSV()
                    : copyFormat === 'ascii'
                    ? getExportASCII()
                    : copyFormat === 'cucumber'
                    ? getExportCucumber(includeCucumberHeaders)
                    : '';
                if (copyFormat === 'htmlRich') {
                  // Write as HTML to clipboard using Clipboard API
                  const html = getTableHTML();
                  const blob = new Blob([html], { type: 'text/html' });
                  const item = new window.ClipboardItem({ 'text/html': blob });
                  await navigator.clipboard.write([item]);
                } else {
                  await navigator.clipboard.writeText(text);
                }
                const originalText = e.target.textContent;
                e.target.textContent = 'Copied!';
                setTimeout(() => {
                  e.target.textContent = originalText;
                  setCopyModalVisible(false);
                }, 1000);
              }}
            >
              Copy
            </button>
            <button
              style={{ marginLeft: 8 }}
              onClick={() => setCopyModalVisible(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    <div style={{
      textAlign: 'center',
      fontSize: '0.75em',
      color: '#888',
      marginTop: '16px'
    }}>
      v4.2.1
    </div>
    </>
  );
}
