export function syncColumns(editor, activeRow, subIndex) {
  const json = editor.getJSON();
  const topList = json.content[0]?.content || [];
  const rows = topList.map(item => {
    const label = item.content[0]?.content[0]?.text || '';
    const nested = item.content.find(n => n.type === 'bulletList');
    const cells = nested
      ? nested.content.map(li => li.content[0]?.content[0]?.text || '')
      : [];
    return { label, cells };
  });

  rows.forEach((row, rowIndex) => {
    if (rowIndex === activeRow) return;
    const cellCount = row.cells.length;
    // If this row has fewer cells than needed
    if (cellCount <= subIndex) {
      let chain = editor.chain().focus();
      // If no nested list yet
      if (cellCount === 0) {
        chain = chain
          .setTextSelection({ path: [0, rowIndex, 0], offset: row.label.length })
          .wrapInList('bulletList');
      }
      // Move to the last existing cell (or newly created empty one)
      const lastCellIndex = cellCount === 0 ? 0 : cellCount - 1;
      chain = chain.setTextSelection({ path: [0, rowIndex, 1, lastCellIndex], offset: 0 });
      // Split until reaching subIndex
      for (let i = cellCount; i <= subIndex; i++) {
        chain = chain.splitListItem('listItem');
      }
      chain.run();
    }
  });
}