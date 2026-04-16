import os

def process_file(filepath):
    if not filepath.endswith('.tsx') and not filepath.endswith('.ts') and not filepath.endswith('.css'):
        return

    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    # In CSS
    content = content.replace("font-family: 'Inter',", "font-family: 'Outfit',")
    content = content.replace("font-family: 'DM Sans',", "font-family: 'Plus Jakarta Sans',")
    
    # In Inline Styles (usually they are strings)
    content = content.replace("'Inter'", "'Outfit'")
    content = content.replace('"Inter"', '"Outfit"')
    content = content.replace("'DM Sans'", "'Plus Jakarta Sans'")
    content = content.replace('"DM Sans"', '"Plus Jakarta Sans"')

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated fonts in {filepath}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    src_dir = os.path.join(base_dir, 'src')
    
    for root, _, files in os.walk(src_dir):
        for f in files:
            process_file(os.path.join(root, f))

if __name__ == "__main__":
    main()
