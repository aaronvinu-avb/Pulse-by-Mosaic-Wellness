import os

REPLACEMENTS = {
  "'#0A0908'": "'var(--bg-root)'",
  "'#0E0F0F'": "'var(--bg-root)'",
  "'#161412'": "'var(--bg-card)'",
  "'#1A1917'": "'var(--bg-card)'",
  "'#1C1917'": "'var(--border-subtle)'",
  "'#2C2A26'": "'var(--border-strong)'",
  "'#F0EBE4'": "'var(--text-primary)'",
  "'#F5EFE8'": "'var(--text-primary)'",
  "'#9B9490'": "'var(--text-secondary)'",
  "'#6B6762'": "'var(--text-muted)'",
  "#0A0908": "var(--bg-root)",
  "#0E0F0F": "var(--bg-root)",
  "#161412": "var(--bg-card)",
  "#1A1917": "var(--bg-card)",
  "#1C1917": "var(--border-subtle)",
  "#2C2A26": "var(--border-strong)",
  "#F0EBE4": "var(--text-primary)",
  "#F5EFE8": "var(--text-primary)",
  "#9B9490": "var(--text-secondary)",
  "#6B6762": "var(--text-muted)"
}

def process_file(filepath):
    if "ThemeProvider.tsx" in filepath or "ThemeToggle.tsx" in filepath:
        return
    if not filepath.endswith('.tsx'):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    for k, v in REPLACEMENTS.items():
        content = content.replace(k, v)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(base_dir, 'src')
    
    for root, _, files in os.walk(src_dir):
        for f in files:
            process_file(os.path.join(root, f))

if __name__ == "__main__":
    main()
