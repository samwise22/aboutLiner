const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/reorderMode.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix duplicate padding keys
content = content.replace(
  /listStyleType: 'none',\s+padding: 0,\s+position: 'relative',/g, 
  "listStyleType: 'none',\n            position: 'relative',"
);

// 2. Add global DEBUG_MODE if not present 
if (!content.includes('window.DEBUG_MODE')) {
  content = content.replace(
    /import React from 'react';/,
    "import React from 'react';\n\n// Define DEBUG_MODE globally\nwindow.DEBUG_MODE = true;"
  );
}

// 3. Replace references to DEBUG_MODE with window.DEBUG_MODE
content = content.replace(/\{DEBUG_MODE &&/g, '{window.DEBUG_MODE &&');

// 4. Fix unused variable warnings by removing the unused variable declarations
content = content.replace(/const currentSection = [^;]+;/g, '');

// Write the modified content back to the file
fs.writeFileSync(filePath, content);
console.log('Fixed ESLint issues in reorderMode.js');
