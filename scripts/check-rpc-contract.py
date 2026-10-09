import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIRED_RPCS = {
    'apply_voucher',
    'remove_voucher',
    'update_store_settings',
    'set_staff_role',
    'set_staff_active',
    'get_sales_report',
    'get_order_history',
}


def matching_delimiter(text: str, start: int, opening: str, closing: str) -> int:
    depth = 0
    quote = ''
    escaped = False
    for position in range(start, len(text)):
        char = text[position]
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = ''
            continue
        if char in ('"', "'", '`'):
            quote = char
        elif char == opening:
            depth += 1
        elif char == closing:
            depth -= 1
            if depth == 0:
                return position
    raise ValueError(f'Unclosed {opening!r} delimiter at offset {start}')


def split_top_level(text: str, delimiter: str = ',') -> list[str]:
    parts: list[str] = []
    start = 0
    stack: list[str] = []
    quote = ''
    escaped = False
    closing_for = {'(': ')', '[': ']', '{': '}'}
    for position, char in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = ''
            continue
        if char in ('"', "'", '`'):
            quote = char
        elif char in closing_for:
            stack.append(closing_for[char])
        elif stack and char == stack[-1]:
            stack.pop()
        elif char == delimiter and not stack:
            parts.append(text[start:position])
            start = position + 1
    parts.append(text[start:])
    return parts


def sql_signatures() -> dict[str, set[frozenset[str]]]:
    signatures: dict[str, set[frozenset[str]]] = {}
    declaration = re.compile(r'create\s+(?:or\s+replace\s+)?function\s+([a-z_][\w.]*)\s*\(', re.I)
    for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        text = path.read_text(encoding='utf-8')
        for match in declaration.finditer(text):
            opening = text.find('(', match.start(), match.end())
            closing = matching_delimiter(text, opening, '(', ')')
            names: set[str] = set()
            for parameter in split_top_level(text[opening + 1:closing]):
                name = re.match(r'\s*(p_[a-z_][\w]*)\b', parameter, re.I)
                if name:
                    names.add(name.group(1).lower())
            function_name = match.group(1).split('.')[-1].lower()
            signatures.setdefault(function_name, set()).add(frozenset(names))
    return signatures


def object_argument_names(body: str) -> set[str]:
    names: set[str] = set()
    for member in split_top_level(body):
        key = re.match(r'\s*([a-z_$][\w$]*)\s*:', member, re.I)
        if key and key.group(1).lower().startswith('p_'):
            names.add(key.group(1).lower())
    return names


def main() -> int:
    signatures = sql_signatures()
    errors: list[str] = []
    missing = sorted(REQUIRED_RPCS - signatures.keys())
    if missing:
        errors.append(f'Missing required SQL RPCs: {", ".join(missing)}')

    call = re.compile(r'\.rpc\s*\(\s*([\'"])([a-z_][\w]*)\1\s*,\s*\{', re.I)
    for path in sorted((ROOT / 'apps/web/src').rglob('*')):
        if path.suffix not in {'.ts', '.tsx', '.js', '.jsx'}:
            continue
        text = path.read_text(encoding='utf-8')
        for match in call.finditer(text):
            function_name = match.group(2).lower()
            opening = match.end() - 1
            try:
                closing = matching_delimiter(text, opening, '{', '}')
            except ValueError as error:
                errors.append(f'{path.relative_to(ROOT)}: {error}')
                continue
            actual = frozenset(object_argument_names(text[opening + 1:closing]))
            candidates = signatures.get(function_name, set())
            if not candidates:
                errors.append(f'{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: no SQL signature for {function_name}')
            elif actual not in candidates:
                expected = ' or '.join(str(sorted(candidate)) for candidate in sorted(candidates, key=lambda item: sorted(item)))
                errors.append(
                    f'{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: '
                    f'{function_name} arguments {sorted(actual)} do not match SQL signature(s) {expected}'
                )

    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print('RPC contracts match SQL signatures; required RPCs are present.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())