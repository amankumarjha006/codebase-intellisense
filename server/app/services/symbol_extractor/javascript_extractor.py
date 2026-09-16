import logging
from app.models.knowledge import File, Symbol
from .base import BaseExtractor

try:
    import tree_sitter_javascript
    import tree_sitter_typescript
    from tree_sitter import Language, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False


logger = logging.getLogger(__name__)

class JavaScriptExtractor(BaseExtractor):
    def __init__(self, language: str):
        if not TREE_SITTER_AVAILABLE:
            self.ts_lang = None
            self.parser = None
            return
            
        self.language_str = language.lower()
        if self.language_str == "typescript":
            self.ts_lang = Language(tree_sitter_typescript.language_typescript())
        elif self.language_str == "tsx":
            self.ts_lang = Language(tree_sitter_typescript.language_tsx())
        else:
            self.ts_lang = Language(tree_sitter_javascript.language())
            
        self.parser = Parser(self.ts_lang)

    def extract(self, file: File, source_code: bytes) -> list[Symbol]:
        if not TREE_SITTER_AVAILABLE:
            return []
            
        tree = self.parser.parse(source_code)
        
        symbols = []
        scope_stack = []

        def get_text(node):
            if not node: return ""
            return source_code[node.start_byte:node.end_byte].decode("utf-8", "ignore")

        def has_jsx(node):
            if node.type in ("jsx_element", "jsx_fragment"):
                return True
            for child in node.children:
                if has_jsx(child):
                    return True
            return False

        def add_symbol(name, sym_type, node):
            if not name: return
            qname = ".".join(scope_stack + [name]) if scope_stack else name
            
            # tree-sitter positions are 0-based, we want 1-based
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            
            symbols.append(Symbol(
                file_id=file.id,
                name=name,
                qualified_name=qname,
                symbol_type=sym_type,
                start_line=start_line,
                end_line=end_line
            ))

        def walk(node):
            original_scope_len = len(scope_stack)
            
            if node.type == "class_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    add_symbol(name, "class", node)
                    scope_stack.append(name)
            
            elif node.type == "function_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    sym_type = "function"
                    if has_jsx(node):
                        sym_type = "component"
                    elif name.startswith("use") and name != "use":
                        sym_type = "hook"
                    add_symbol(name, sym_type, node)
                    scope_stack.append(name)
                    
            elif node.type == "method_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    add_symbol(name, "method", node)
                    scope_stack.append(name)
                    
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if name_node and get_text(name_node):
                    name = get_text(name_node)
                    if value_node and value_node.type == "arrow_function":
                        sym_type = "function"
                        if has_jsx(value_node):
                            sym_type = "component"
                        elif name.startswith("use") and name != "use":
                            sym_type = "hook"
                        add_symbol(name, sym_type, node)
                        scope_stack.append(name)
                    else:
                        add_symbol(name, "variable", node)

            elif node.type == "interface_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    add_symbol(name, "interface", node)
                    scope_stack.append(name)

            elif node.type == "type_alias_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    add_symbol(name, "type", node)
                    scope_stack.append(name)

            elif node.type == "enum_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = get_text(name_node)
                    add_symbol(name, "enum", node)
                    scope_stack.append(name)

            elif node.type == "import_statement":
                # Find imported names
                import_clause = node.child_by_field_name("import") # Note: tree-sitter doesn't always name this field
                # Just find identifiers in import_clause
                def find_imports(n):
                    if n.type in ("identifier", "import_specifier"):
                        if n.type == "identifier":
                            add_symbol(get_text(n), "import", n)
                        elif n.type == "import_specifier":
                            alias_node = n.child_by_field_name("alias")
                            name_node = n.child_by_field_name("name")
                            if alias_node:
                                add_symbol(get_text(alias_node), "import", n)
                            elif name_node:
                                add_symbol(get_text(name_node), "import", n)
                    else:
                        for child in n.children:
                            if child.type != "string": # skip source
                                find_imports(child)
                find_imports(node)

            elif node.type == "export_statement":
                # Handle default exports
                if node.child(1) and node.child(1).type == "default":
                    pass # The actual declaration is handled by its own walk
                else:
                    def find_exports(n):
                        if n.type == "export_specifier":
                            name_node = n.child_by_field_name("alias") or n.child_by_field_name("name")
                            if name_node:
                                add_symbol(get_text(name_node), "export", n)
                        else:
                            for child in n.children:
                                find_exports(child)
                    find_exports(node)

            for child in node.children:
                walk(child)

            while len(scope_stack) > original_scope_len:
                scope_stack.pop()

        if tree.root_node.has_error:
            # We can still try to extract what we can
            pass

        walk(tree.root_node)
        return symbols
