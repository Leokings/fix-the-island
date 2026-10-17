"""Generate the eight production site contracts and the local council evaluator.

The evaluator is a rehearsal artifact only. This tool never connects to a
network or sends transactions; --write only refreshes generated source files.
"""
import ast
import base64
import copy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
import python_minifier

ROOT = Path(__file__).resolve().parents[1]
assert importlib.metadata.version('python-minifier') == '3.2.0'
SOURCE = (ROOT / 'contracts/island_repairs.source.py').read_text(encoding='utf-8')
SITES = json.loads((ROOT / 'contracts/island_fixtures.json').read_text(encoding='utf-8'))
OPTIONS = dict(remove_annotations=False, remove_pass=False, remove_literal_statements=False,
               combine_imports=False, hoist_literals=False, rename_locals=False, rename_globals=False,
               remove_object_base=False, convert_posargs_to_args=False, preserve_shebang=False,
               remove_asserts=False, remove_debug=False, remove_explicit_return_none=False,
               remove_builtin_exception_brackets=False, constant_folding=False)


def pack(data):
    out, literals, positions = bytearray(), bytearray(), {}

    def flush():
        if literals:
            out.append(len(literals) - 1)
            out.extend(literals)
            literals.clear()

    def remember(index):
        if index + 2 < len(data):
            group = positions.setdefault(data[index:index + 3], [])
            group.append(index)
            if len(group) > 96:
                group.pop(0)

    index = 0
    while index < len(data):
        length = offset = 0
        for previous in reversed(positions.get(data[index:index + 3], [])):
            distance = index - previous
            if distance > 65535:
                break
            size = 0
            while size < 131 and index + size < len(data) and data[previous + size] == data[index + size]:
                size += 1
            if size > length:
                length, offset = size, distance
            if length == 131:
                break
        if length >= 4:
            flush()
            out.extend((128 + length - 4, offset >> 8, offset & 255))
            for size in range(length):
                remember(index + size)
            index += length
        else:
            literals.append(data[index])
            remember(index)
            index += 1
            if len(literals) == 128:
                flush()
    flush()
    return base64.b64encode(out).decode()


CTOR = '''
def __init__(self, dependency_addresses: str):
    if len(dependency_addresses) > 1024:
        _error('Dependency mapping too large')
    addresses = json.loads(dependency_addresses, object_pairs_hook=_pairs)
    required = next(iter(_SITES.values()))['requires']
    _shape(addresses, required)
    seen = set()
    for site_id in required:
        value = addresses[site_id]
        if not isinstance(value, str) or not re.fullmatch(r'0x[0-9a-fA-F]{40}', value):
            _error('Invalid dependency address')
        value = value.lower()
        if value == '0x' + '0' * 40 or value == str(gl.message.contract_address).lower() or value in seen:
            _error('Invalid dependency identity')
        seen.add(value)
        address = Address(value)
        self.dependencies[site_id] = address
    self.owner = gl.message.sender_address
'''
DEPENDENCIES = '''
def _dependencies_ready(self, caller, expedition_id):
    prefix = _run_key(caller, expedition_id, '')
    return all(prefix + 'dependency:' + parent in self.notifications for parent in next(iter(_SITES.values()))['requires'])
'''
EVALUATOR = '''
class CouncilEval(gl.Contract):
    last_result: str

    def __init__(self):
        self.last_result = ''

    @gl.public.write
    def judge(self, site_id: str, artifact_json: str, plan: str) -> dict:
        result = _judge_case(site_id, artifact_json, plan)
        self.last_result = _json(result)
        return result
'''


def embedded_catalog(sites):
    output = []
    for site in sites:
        item = copy.deepcopy(site)
        for key in ('requirements', 'rubric', 'initialArtifact'):
            item.pop(key, None)
        output.append(item)
    return output


def set_packed_catalog(tree, sites):
    packed = pack(json.dumps(embedded_catalog(sites), separators=(',', ':'), ensure_ascii=False).encode())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == '_PACKED_CATALOG' for target in node.targets):
            node.value = ast.Constant(packed)
        elif isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == '_VERSION' for target in node.targets):
            node.value = ast.Constant('island-2026-10-16-v5')


def replace_site_technical_branch(tree, site_id):
    node = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == '_technical')
    branch = next(n for n in node.body if isinstance(n, ast.If) and isinstance(n.test, ast.Compare) and
                  isinstance(n.test.left, ast.Name) and n.test.left.id == 'family')
    chosen = branch
    while chosen.test.comparators[0].value != site_id:
        chosen = chosen.orelse[0]
    position = node.body.index(branch)
    node.body[position:position + 1] = copy.deepcopy(chosen.body)


def configure_site_class(tree, site):
    children = [child for child in SITES if site['id'] in child['requires']]
    tree.body.extend(ast.parse('_CHILDREN = ' + repr([child['id'] for child in children]) +
                               '\n_CHILD_REQUIREMENTS = ' + repr({child['id']: child['requires'] for child in children})).body)
    for node in tree.body:
        if not isinstance(node, ast.ClassDef) or node.name != 'IslandRepairs':
            continue
        for index, method in enumerate(node.body):
            if isinstance(method, ast.FunctionDef) and method.name == '__init__':
                node.body[index] = ast.parse(CTOR).body[0]
            elif isinstance(method, ast.FunctionDef) and method.name == 'get_protocol':
                result = method.body[0].value
                result.keys.extend([ast.Constant('architecture'), ast.Constant('dependencies'), ast.Constant('dependents'), ast.Constant('dependentsConfigured')])
                result.values.extend([
                    ast.Constant('async-notify-v1'),
                    ast.parse("{parent:str(self.dependencies[parent]).lower() for parent in next(iter(_SITES.values()))['requires']}", mode='eval').body,
                    ast.parse("{child:str(self.dependencies['dependent:'+child]).lower() for child in _CHILDREN if 'dependent:'+child in self.dependencies}", mode='eval').body,
                    ast.Attribute(value=ast.Name(id='self', ctx=ast.Load()), attr='dependents_configured', ctx=ast.Load()),
                ])
            elif isinstance(method, ast.FunctionDef) and method.name == 'prepare_repair':
                for statement in method.body:
                    if isinstance(statement, ast.Assign) and ast.unparse(statement.targets[0]) == "flags['dependencies']":
                        statement.value = ast.Constant(True) if not site['requires'] else ast.parse('self._dependencies_ready(caller, expedition_id)', mode='eval').body
        node.body.insert(0, ast.parse('dependencies: TreeMap[str, Address]').body[0])
        node.body.append(ast.parse(DEPENDENCIES).body[0])


def render(tree):
    ast.fix_missing_locations(tree)
    readable = SOURCE.splitlines()[0] + '\n' + ast.unparse(tree) + '\n'
    compact = SOURCE.splitlines()[0] + '\n' + python_minifier.minify(readable, **OPTIONS) + '\n'
    assert ast.dump(ast.parse(readable)) == ast.dump(ast.parse(compact))
    return readable, compact


def generate_site(site):
    tree = ast.parse(SOURCE)
    set_packed_catalog(tree, [site])
    replace_site_technical_branch(tree, site['id'])
    configure_site_class(tree, site)
    tree.body = [node for node in tree.body if not (isinstance(node, ast.FunctionDef) and node.name == '_judge_case')]
    return render(tree)


def generate_evaluator():
    tree = ast.parse(SOURCE)
    set_packed_catalog(tree, SITES)
    tree.body = [node for node in tree.body if not (isinstance(node, ast.ClassDef) and node.name == 'IslandRepairs')]
    tree.body.append(ast.parse(EVALUATOR).body[0])
    return render(tree)


def output(path, text):
    if '--write' in sys.argv:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8', newline='\n')
    else:
        assert path.read_text(encoding='utf-8') == text, f'Stale generated file: {path}'


manifest = {}
for site in SITES:
    readable, compact = generate_site(site)
    output(ROOT / f"contracts/sites/{site['id']}.source.py", readable)
    output(ROOT / f"contracts/sites/{site['id']}.py", compact)
    manifest[site['id']] = {
        'file': f"contracts/sites/{site['id']}.py",
        'sourceBytes': len(compact.encode()),
        'codeHash': '0x' + hashlib.sha256(compact.encode()).hexdigest(),
        'requires': site['requires'],
        'constructorArgs': ['{}'] if not site['requires'] else ['JSON object of required site IDs to finalized verified addresses'],
    }
output(ROOT / 'contracts/sites/manifest.json', json.dumps(manifest, indent=2) + '\n')
output(ROOT / 'src/genlayer/site-contract-meta.ts', '// Generated by tools/build-site-contracts.py. Never accept arbitrary hashes from config.\nexport const SITE_CONTRACT_META = ' + json.dumps(manifest, indent=2) + ' as const;\n')
evaluator_source, evaluator_compact = generate_evaluator()
output(ROOT / 'contracts/council_eval.source.py', evaluator_source)
output(ROOT / 'contracts/council_eval.py', evaluator_compact)
print(json.dumps({'sites': manifest, 'councilEvalBytes': len(evaluator_compact.encode())}, indent=2))
