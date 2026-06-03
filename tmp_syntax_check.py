import pathlib
import sys
for name in ['main.js','equipment_combined.js']:
    p = pathlib.Path(name)
    code = p.read_text(encoding='utf-8')
    try:
        compile(code, name, 'exec')
        print(f'{name}: ok')
    except Exception as e:
        print(f'{name}: {e}')
        sys.exit(1)
