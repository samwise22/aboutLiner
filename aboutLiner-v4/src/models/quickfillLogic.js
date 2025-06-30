// Logic for determining quickfill options for a column
import quickfillSets from './quickfillSets';

// Normalize a value to a set value if possible
export function normalizeToSet(val, set, aliases) {
  if (!val) return null;
  const trimmed = val.trim();
  if (set.includes(trimmed)) return trimmed;
  if (aliases && Object.prototype.hasOwnProperty.call(aliases, trimmed)) return aliases[trimmed];
  return null;
}

// Main function: get quickfill options for a column
export function getQuickfillOptions({ sectionData, colIdx, rowIdx, getColumnHeader }) {
  // Gather all values for this column, excluding current row, trim and exclude empty
  let values = [];
  sectionData.rowSections.forEach(section => {
    section.rows.forEach((row, rIdx) => {
      if (rIdx !== rowIdx && row.cells && row.cells[colIdx - 1]) {
        const v = row.cells[colIdx - 1].value;
        if (v && v.trim() !== '') values.push(v.trim());
      }
    });
  });
  // 1. Check column header for known set name or alias
  let headerName = getColumnHeader(colIdx)?.trim() || '';
  if (headerName) {
    for (const { name, set, aliases, aliasesForColumn } of quickfillSets) {
      const headerLower = headerName.toLowerCase();
      const nameLower = name.toLowerCase();
      let isHeaderMatch = headerLower === nameLower;
      if (!isHeaderMatch && set.some(val => val.toLowerCase() === headerLower)) isHeaderMatch = true;
      if (!isHeaderMatch && Array.isArray(aliasesForColumn)) {
        if (aliasesForColumn.some(alias => alias.toLowerCase() === headerLower)) isHeaderMatch = true;
      }
      if (!isHeaderMatch && aliases && Object.keys(aliases).some(alias => alias.toLowerCase() === headerLower)) isHeaderMatch = true;
      if (isHeaderMatch) {
        // If any value in the column does not normalize to the set, do not suggest the set
        let allValid = true;
        for (const v of values) {
          if (!normalizeToSet(v, set, aliases)) {
            allValid = false;
            break;
          }
        }
        if (allValid) return set;
      }
    }
  }
  // 2. Check for two or more values from a known set (via alias or direct match)
  let bestSet = null;
  let bestMatchCount = 0;
  for (const { set, aliases } of quickfillSets) {
    const mapped = values.map(v => normalizeToSet(v, set, aliases));
    const matchCount = mapped.filter(m => m !== null).length;
    if (matchCount >= 2 && matchCount > bestMatchCount) {
      bestSet = set;
      bestMatchCount = matchCount;
    }
  }
  if (bestSet) return bestSet;
  // 3. Fallback: just offer the other values in the column
  return Array.from(new Set(values));
}
