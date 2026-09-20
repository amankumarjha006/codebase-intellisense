import ast
import os
import sys
import importlib

# Common typing names to look for
TYPING_NAMES = {
    "Any", "Optional", "Union", "List", "Dict", "Tuple", "Set", 
    "Callable", "Sequence", "TypeVar", "Generic", "Type", "Iterable",
    "Mapping", "Awaitable", "Coroutine"
}

def extract_names_from_annotation(node):
    names = set()
    if isinstance(node, ast.Name):
        names.add(node.id)
    elif isinstance(node, ast.Subscript):
        names.update(extract_names_from_annotation(node.value))
        names.update(extract_names_from_annotation(node.slice))
    elif isinstance(node, ast.Tuple):
        for el in node.elts:
            names.update(extract_names_from_annotation(el))
    elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        # Handle X | Y syntax
        names.update(extract_names_from_annotation(node.left))
        names.update(extract_names_from_annotation(node.right))
    return names

def check_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        source = f.read()
    
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        print(f"[SyntaxError] {filepath}: {e}")
        return False
        
    imported_names = set()
    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_names.add(alias.asname or alias.name)
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                imported_names.add(alias.asname or alias.name)
                
    used_types = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.arg) and node.annotation:
            used_types.update(extract_names_from_annotation(node.annotation))
        elif isinstance(node, ast.FunctionDef) and node.returns:
            used_types.update(extract_names_from_annotation(node.returns))
        elif isinstance(node, ast.AnnAssign) and node.annotation:
            used_types.update(extract_names_from_annotation(node.annotation))

    missing = set()
    for t in used_types:
        if t in TYPING_NAMES and t not in imported_names:
            # Maybe it's defined in the file?
            defined = any(isinstance(n, ast.ClassDef) and n.name == t for n in tree.body)
            if not defined:
                missing.add(t)
                
    if missing:
        print(f"[Missing Import] {filepath}: {missing}")
        return False
    return True

def main():
    app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app"))
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    
    has_error = False
    modules_to_import = []
    
    for root, _, files in os.walk(app_dir):
        for f in files:
            if f.endswith(".py"):
                filepath = os.path.join(root, f)
                if not check_file(filepath):
                    has_error = True
                
                # Build module path
                rel_path = os.path.relpath(filepath, os.path.dirname(app_dir))
                mod_name = rel_path.replace(os.sep, ".")[:-3]
                if mod_name.endswith(".__init__"):
                    mod_name = mod_name[:-9]
                if mod_name:
                    modules_to_import.append(mod_name)
                    
    print("\n--- Empirical Import Sweep ---")
    for mod in modules_to_import:
        try:
            importlib.import_module(mod)
        except Exception as e:
            print(f"[Import Error] {mod}: {type(e).__name__} - {e}")
            has_error = True
            
    if not has_error:
        print("All checks passed!")
    else:
        print("Errors found.")

if __name__ == "__main__":
    main()
