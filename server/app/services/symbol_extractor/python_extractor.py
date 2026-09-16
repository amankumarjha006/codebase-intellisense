import ast
from app.models.knowledge import File, Symbol
from .base import BaseExtractor

class PythonExtractor(BaseExtractor):
    def extract(self, file: File, source_code: bytes) -> list[Symbol]:
        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            raise ValueError("Malformed Python file")
            
        symbols = []
        
        class Visitor(ast.NodeVisitor):
            def __init__(self):
                self.scope_stack = []

            def _add_symbol(self, node, name, sym_type):
                qname = ".".join(self.scope_stack + [name]) if self.scope_stack else name
                
                start_line = getattr(node, "lineno", 1)
                end_line = getattr(node, "end_lineno", start_line)
                
                symbols.append(Symbol(
                    file_id=file.id,
                    name=name,
                    qualified_name=qname,
                    symbol_type=sym_type,
                    start_line=start_line,
                    end_line=end_line
                ))
                return qname

            def visit_ClassDef(self, node):
                self._add_symbol(node, node.name, "class")
                self.scope_stack.append(node.name)
                self.generic_visit(node)
                self.scope_stack.pop()

            def visit_FunctionDef(self, node):
                self._visit_func(node)
                
            def visit_AsyncFunctionDef(self, node):
                self._visit_func(node)
                
            def _visit_func(self, node):
                # If we are inside a class, it's a method
                sym_type = "method" if self.scope_stack else "function"
                self._add_symbol(node, node.name, sym_type)
                self.scope_stack.append(node.name)
                self.generic_visit(node)
                self.scope_stack.pop()
                
            def visit_Import(self, node):
                for alias in node.names:
                    self._add_symbol(node, alias.name, "import")
                self.generic_visit(node)
                
            def visit_ImportFrom(self, node):
                module = node.module or ""
                for alias in node.names:
                    original_scope = list(self.scope_stack)
                    if module:
                        self.scope_stack = [module]
                    else:
                        self.scope_stack = []
                    self._add_symbol(node, alias.name, "import")
                    self.scope_stack = original_scope
                self.generic_visit(node)
                
            def visit_Assign(self, node):
                # Handle __all__ exports
                if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id == "__all__":
                    if isinstance(node.value, (ast.List, ast.Tuple)):
                        for elt in node.value.elts:
                            if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                self._add_symbol(node, elt.value, "export")
                self.generic_visit(node)
                
        Visitor().visit(tree)
        return symbols
