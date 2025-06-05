// app.js — v0.1 fully working modular version

const editor = document.getElementById('editor');
const tableContainer = document.getElementById('tableContainer');

function placeCaretAtStart(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function syncSubBulletsAcrossTopLevel() {
  const topLevelLis = [...editor.querySelectorAll(':scope > ul > li')];
  let maxSubs = 0;

  topLevelLis.forEach(li => {
    const count = li.querySelectorAll(':scope > ul > li').length;
    if (count > maxSubs) maxSubs = count;
  });

  topLevelLis.forEach(li => {
    let subUl = li.querySelector(':scope > ul');
    if (!subUl && maxSubs > 0) {
      subUl = document.createElement('ul');
      li.appendChild(subUl);
    }
    while (subUl && subUl.children.length < maxSubs) {
      const newLi = document.createElement('li');
      subUl.appendChild(newLi);
    }
  });
}

editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let li = sel.anchorNode;
    while (li && li.nodeName !== 'LI') {
      li = li.parentNode;
    }
    if (!li) return;

    if (e.shiftKey) {
      const parentUl = li.parentNode;
      const grandParentLi = parentUl.parentNode.closest('li');
      if (!grandParentLi) return;

      parentUl.removeChild(li);
      grandParentLi.parentNode.insertBefore(li, grandParentLi.nextSibling);

      if (parentUl.children.length === 0) {
        parentUl.remove();
      }

    } else {
      const prevLi = li.previousElementSibling;
      if (!prevLi) return;

      let subUl = prevLi.querySelector('ul');
      if (!subUl) {
        subUl = document.createElement('ul');
        prevLi.appendChild(subUl);
      }

      li.parentNode.removeChild(li);
      subUl.appendChild(li);
    }

    syncSubBulletsAcrossTopLevel();
    updateTable();
  }

  if (e.key === 'Enter') {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let li = sel.anchorNode;
    while (li && li.nodeName !== 'LI') {
      li = li.parentNode;
    }
    if (!li) return;

    const parentUl = li.parentNode;
    const grandParentLi = parentUl.parentNode.closest('li');

    if (grandParentLi) {
      if (li.textContent.trim() === '' || li.innerHTML === '<br>') {
        e.preventDefault();

        parentUl.removeChild(li);
        grandParentLi.parentNode.insertBefore(li, grandParentLi.nextSibling);

        if (parentUl.children.length === 0) {
          parentUl.remove();
        }

        syncSubBulletsAcrossTopLevel();
        placeCaretAtStart(li);
        updateTable();
        return;
      }
    }
  }
});

function parseList(ul) {
  const rows = [];
  const topLevelLis = [...ul.children].filter(el => el.tagName === 'LI');

  let maxCols = 1;
  topLevelLis.forEach(li => {
    const colCount = li.querySelectorAll(':scope > ul > li').length + 1;
    if (colCount > maxCols) maxCols = colCount;
  });

  topLevelLis.forEach(li => {
    const row = [];
    row.push(li.firstChild ? li.firstChild.textContent.trim() : '');

    const subLis = li.querySelectorAll(':scope > ul > li');
    subLis.forEach(subLi => {
      row.push(subLi.textContent.trim());
    });

    while (row.length < maxCols) {
      row.push('');
    }
    rows.push(row);
  });

  return rows;
}

function renderTable(rows) {
  if (rows.length === 0) return '<p>No data to show.</p>';

  let html = '<table><thead><tr><th></th>';
  for (let i = 1; i < rows[0].length; i++) {
    html += `<th>Column ${i}</th>`;
  }
  html += '</tr></thead><tbody>';

  rows.forEach((row) => {
    html += `<tr><th>${row[0]}</th>`;
    for (let j = 1; j < row.length; j++) {
      html += `<td>${row[j]}</td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

function updateTable() {
  const ul = editor.querySelector('ul');
  if (!ul) {
    tableContainer.innerHTML = '<p>No outline found.</p>';
    return;
  }

  const rows = parseList(ul);
  tableContainer.innerHTML = renderTable(rows);
}

editor.addEventListener('input', () => {
  syncSubBulletsAcrossTopLevel();
  updateTable();
});

editor.addEventListener('keyup', () => {
  syncSubBulletsAcrossTopLevel();
  updateTable();
});

updateTable();

editor.addEventListener('focus', () => {
  if (editor.innerHTML.trim() === '') {
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    ul.appendChild(li);
    editor.appendChild(ul);

    const range = document.createRange();
    range.selectNodeContents(li);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
});