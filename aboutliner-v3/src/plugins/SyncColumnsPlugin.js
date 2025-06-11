// src/plugins/SyncColumnsPlugin.js
import { Plugin } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';

export const SyncColumnsPlugin = new Plugin({
  appendTransaction: (transactions, oldState, newState) => {
    console.log('SyncColumnsPlugin.appendTransaction fired', transactions.map(t => t.steps.map(s => s.constructor.name)));
    let tr = newState.tr;
    const schema = newState.schema;
    const bulletList = schema.nodes.bulletList;
    const listItem  = schema.nodes.listItem;

    transactions.forEach(transaction => {
      transaction.steps.forEach(step => {
        console.log('  ▶️ Step seen:', step.constructor.name, 'pos:', step.pos);
        const stepName = step.constructor.name;
        if (stepName === 'SplitListItem' || stepName === 'SinkListItem') {
          console.log('   → Handling indent/outdent step:', stepName);
          // Position where new listItem was inserted
          const pos = step.pos;

          // Find the parent bulletList and the index of the new item
          const $pos = tr.doc.resolve(pos);
          const parentList = $pos.node($pos.depth - 1);
          const listIndex = $pos.index($pos.depth - 1);

          // Determine rowIndex (index of top-level list item)
          // Top-level bulletList assumed at depth 1
          let depth = $pos.depth;
          let rowIndex;
          for (let d = depth; d >= 1; d--) {
            const node = $pos.node(d);
            if (node.type === bulletList) {
              rowIndex = $pos.index(d);
              break;
            }
          }

          console.log(`Detected ${stepName} at pos`, pos);
          console.log('Resolved depth', $pos.depth, 'path indexes', $pos.path);
          console.log('Determined rowIndex', rowIndex, 'listIndex (subIndex)', listIndex);

          // Locate the actual top-level bulletList in the document
          let rootList = null;
          newState.doc.descendants((node, pos) => {
            if (!rootList && node.type === bulletList) {
              rootList = node;
              return false;
            }
          });
          if (!rootList) return;
          rootList.content.forEach((item, idx) => {
            const hasNested = item.childCount > 1 && item.child(1).type === bulletList;
            console.log(`Sibling row ${idx}: hasNested=${hasNested}, childCount=${item.childCount}`);
            if (idx === rowIndex) return;
            // Ensure nested list exists

            // Find position of the top-level item
            let posCursor = 0;
            for (let i = 0; i < idx; i++) {
              posCursor += rootList.child(i).nodeSize;
            }
            const itemStart = posCursor + 1; // position of the item node inside doc

            if (!hasNested) {
              // Wrap the item in a bulletList to create nested list
              tr = tr.wrap(itemStart, itemStart + item.nodeSize, [{ type: bulletList }]);
            }

            // After wrapping, re-resolve the item position
            const updatedItem = tr.doc.nodeAt(itemStart);
            if (!updatedItem) return;

            // Position after paragraph (first child)
            const afterPara = itemStart + updatedItem.child(0).nodeSize;

            // Nested list node
            const nested = updatedItem.childCount > 1 && updatedItem.child(1).type === bulletList
              ? updatedItem.child(1)
              : null;

            if (!nested) return;

            // Count current nested list items
            const currentCount = nested.childCount;

            // Count of nested items in the newly split list item's nested list
            const newRowNested = parentList.child(listIndex);
            const newNested = newRowNested.childCount > 1 && newRowNested.child(1).type === bulletList
              ? newRowNested.child(1)
              : null;
            const newNestedCount = newNested ? newNested.childCount : 0;

            console.log(`Row ${idx} current nested count:`, currentCount, 'target count:', newNestedCount);

            // Insert missing listItems to match newNestedCount
            for (let j = currentCount; j < newNestedCount; j++) {
              tr = tr.insert(afterPara + nested.nodeSize, listItem.createAndFill());
            }
          });
        }
      });
    });

    console.log('   ▶️ Final tr.docChanged =', tr.docChanged);
    return tr.docChanged ? tr : null;
  }
});