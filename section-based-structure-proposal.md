# Section-Based Data Structure Proposal

## Current Data Structure
Currently, the aboutLiner app uses a flat array of rows, where each row contains cells with embedded section information:

```javascript
rows = [
  [
    { id: 'ZEK1', name: 'Row Title', value: 'Row_SecA_Row 1', section: { sectionId: 'rowSection-Row_SecA', sectionName: 'Row_SecA' } },
    { name: 'Col_SecA_Col 1', value: 'Row_SecA_Row 1 _ Col_SecA_Col 1', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } },
    { name: 'Col_SecA_Col 2', value: 'Row_SecA_Row 1 _ Col_SecA_Col 2', section: { sectionId: 'colSection-Col_SecA', sectionName: 'Col_SecA' } }
  ],
  // more rows...
]
```

## Proposed Section-Based Structure

A section-based primary data structure would look like:

```javascript
data = {
  rowSections: [
    {
      sectionId: 'rowSection-Row_SecA',
      sectionName: 'Row_SecA',
      rows: [
        {
          id: 'ZEK1',
          name: 'Row Title',
          value: 'Row_SecA_Row 1',
          cells: [
            {
              colSectionId: 'colSection-Col_SecA',
              name: 'Col_SecA_Col 1',
              value: 'Row_SecA_Row 1 _ Col_SecA_Col 1'
            },
            {
              colSectionId: 'colSection-Col_SecA',
              name: 'Col_SecA_Col 2',
              value: 'Row_SecA_Row 1 _ Col_SecA_Col 2'
            }
          ]
        },
        // More rows in this section...
      ]
    },
    // More row sections...
  ],
  colSections: [
    {
      sectionId: 'colSection-Col_SecA',
      sectionName: 'Col_SecA',
      cols: [
        { idx: 0, name: 'Col_SecA_Col 1' },
        { idx: 1, name: 'Col_SecA_Col 2' }
      ]
    },
    // More column sections...
  ]
}
```

## Benefits of Section-Based Structure

1. Direct representation of the hierarchical nature of the data
2. Easier to reason about sections as explicit objects
3. More natural for dragging and dropping sections and items within sections
4. Better supports both merged header and break row/column rendering styles

## Supporting Both Rendering Styles

### 1. Merged Header Rendering (Current Style)

This style merges section headers at the top of columns and left side of rows:

```
+----------+----------+-----------------+-----------------+
| Section  | Title    | Col_SecA        | Col_SecB        |
+----------+----------+-----------------+-----------------+
|          |          | Col 1 | Col 2   | Col 3 | Col 4   |
+----------+----------+-------+---------+-------+---------+
| Row_SecA | Row 1    | ...   | ...     | ...   | ...     |
|          +---------+-------+---------+-------+---------+
|          | Row 2    | ...   | ...     | ...   | ...     |
+----------+----------+-------+---------+-------+---------+
| Row_SecB | Row 3    | ...   | ...     | ...   | ...     |
|          +---------+-------+---------+-------+---------+
|          | Row 4    | ...   | ...     | ...   | ...     |
+----------+----------+-------+---------+-------+---------+
```

Implementation with section-based structure:
- Loop through rowSections and render a merged section header cell for each one
- Loop through colSections and render a merged header cell for each column section
- Then render regular cells within each section

### 2. Break Row/Column Rendering

This style adds "break rows" between sections and potentially visual separators between column sections:

```
+----------+---------+-------+---------+-------+---------+
| Title    | Col 1   | Col 2 | Col 3   | Col 4 | Col 5   |
+----------+---------+-------+---------+-------+---------+
| Row_SecA                                              |
+----------+---------+-------+---------+-------+---------+
| Row 1    | ...     | ...   | ...     | ...   | ...     |
+----------+---------+-------+---------+-------+---------+
| Row 2    | ...     | ...   | ...     | ...   | ...     |
+----------+---------+-------+---------+-------+---------+
| Row_SecB                                              |
+----------+---------+-------+---------+-------+---------+
| Row 3    | ...     | ...   | ...     | ...   | ...     |
+----------+---------+-------+---------+-------+---------+
| Row 4    | ...     | ...   | ...     | ...   | ...     |
+----------+---------+-------+---------+-------+---------+
```

Implementation with section-based structure:
- For column sections, add visual styling (borders, background colors) to visually separate them
- For row sections, insert a "break row" containing the section name before each section's rows
- Each break row would span all columns and have distinctive styling

## Implementation Steps

1. Create a new state variable for the display mode: `const [displayMode, setDisplayMode] = useState('mergedHeader'); // or 'breakRow'`
2. Refactor the data structure to use the section-based approach
3. Create a function to convert from the flat array to the section-based structure
4. Implement two different rendering functions for the table:
   - `renderMergedHeaderTable()` - similar to current implementation
   - `renderBreakRowTable()` - new implementation with break rows
5. Choose which rendering function to use based on displayMode
6. Update the SortableReorderMode component to work with the new data structure
7. Add UI controls to switch between display modes

## Supporting Tables with No Sections

For tables that don't use sections, there are two approaches:

1. Create a default "unsectioned" section:
   ```javascript
   data = {
     rowSections: [{
       sectionId: 'default',
       sectionName: '',
       rows: [
         // all rows here
       ]
     }],
     colSections: [{
       sectionId: 'default',
       sectionName: '',
       cols: [
         // all columns here
       ]
     }]
   }
   ```

2. Allow a mixed model with a flat array of rows for simple tables:
   ```javascript
   data = {
     hasSections: false,
     rows: [
       // flat rows like current implementation
     ]
   }
   ```

The first approach (default section) is more consistent and would simplify the codebase by having a single consistent data structure.
