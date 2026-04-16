const fs = require('fs');
const path = require('path');

const REPLACEMENTS = {
  "'#0A0908'": "'var(--bg-root)'",
  "'#0E0F0F'": "'var(--bg-root)'",
  "'#161412'": "'var(--bg-card)'",
  "'#1A1917'": "'var(--bg-card)'", // slightly lighter card header
  "'#1C1917'": "'var(--border-subtle)'",
  "'#2C2A26'": "'var(--border-strong)'",
  "'#F0EBE4'": "'var(--text-primary)'",
  "'#F5EFE8'": "'var(--text-primary)'",
  "'#9B9490'": "'var(--text-secondary)'",
  "'#6B6762'": "'var(--text-muted)'"
};

// Also replace missing quotes if they were inside template literals
const EXT_REPS = {
  "#0E0F0F": "var(--bg-root)",
  "#161412": "var(--bg-card)",
  "#1C1917": "var(--border-subtle)",
  "#2C2A26": "var(--border-strong)",
  "#F0EBE4": "var(--text-primary)",
  "#9B9490": "var(--text-secondary)",
  "#6B6762": "var(--text-muted)"
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDirs = [
  path.join(__dirname, 'src', 'pages'),
  path.join(__dirname, 'src', 'components')
];

targetDirs.forEach(dir => {
  walkDir(dir, function(filePath) {
    if (filePath.endsWith('.tsx') && !filePath.includes('ThemeProvider.tsx') && !filePath.includes('ThemeToggle.tsx')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalStart = content;
      
      // Exact string replaces
      for (const [key, value] of Object.entries(REPLACEMENTS)) {
        content = content.replaceAll(key, value);
      }
      
      // Fallback for unquoted inside template literals or gradients
      for (const [key, value] of Object.entries(EXT_REPS)) {
        // Only replace if it's not already replaced or part of another hex
        // Simplified replacement for gradients etc
        content = content.replace(new RegExp(key, 'g'), value);
      }

      if (content !== originalStart) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Refactored colors in: ${filePath}`);
      }
    }
  });
});
console.log('Done refactoring colors.');
