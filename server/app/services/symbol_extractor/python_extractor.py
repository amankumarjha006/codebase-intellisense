import ast
from app.models.knowledge import File, Symbol
from .base import BaseExtractor


class PythonExtractor(BaseExtractor):
    def extract(self, file: File, source_code: bytes) -> list[Symbol]:
        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            raise ValueError("Malformed Python file")

        symbols: list[Symbol] = []

        class Visitor(ast.NodeVisitor):
            def __init__(self):
                # Each entry is (name: str, is_class: bool)
                self.scope_stack: list[tuple[str, bool]] = []

            def _qname(self, name: str) -> str:
                parts = [s[0] for s in self.scope_stack] + [name]
                return ".".join(parts)

            def _add_symbol(self, node, name: str, sym_type: str) -> None:
                qname = self._qname(name) if self.scope_stack else name
                start_line = getattr(node, "lineno", 1)
                end_line = getattr(node, "end_lineno", start_line)
                symbols.append(Symbol(
                    file_id=file.id,
                    name=name,
                    qualified_name=qname,
                    symbol_type=sym_type,
                    start_line=start_line,
                    end_line=end_line,
                ))

            def visit_ClassDef(self, node):
                self._add_symbol(node, node.name, "class")
                self.scope_stack.append((node.name, True))
                self.generic_visit(node)
                self.scope_stack.pop()

            def visit_FunctionDef(self, node):
                self._visit_func(node)

            def visit_AsyncFunctionDef(self, node):
                self._visit_func(node)

            def _visit_func(self, node):
                # Classify as "method" only when the immediate enclosing scope is a class.
                # Nested functions (inside other functions) are classified as "function".
                in_class = bool(self.scope_stack) and self.scope_stack[-1][1]
                sym_type = "method" if in_class else "function"
                self._add_symbol(node, node.name, sym_type)
                self.scope_stack.append((node.name, False))
                self.generic_visit(node)
                self.scope_stack.pop()

            def visit_Import(self, node):
                for alias in node.names:
                    self._add_symbol(node, alias.name, "import")
                self.generic_visit(node)

            def visit_ImportFrom(self, node):
                # Use the local binding name (asname if aliased, otherwise the imported name).
                # The qualified_name is just the local name — no artificial module-prefix scope.
                for alias in node.names:
                    local_name = alias.asname if alias.asname else alias.name
                    self._add_symbol(node, local_name, "import")
                self.generic_visit(node)

            def visit_Assign(self, node):
                # Detect explicit exports declared via __all__.
                if (
                    len(node.targets) == 1
                    and isinstance(node.targets[0], ast.Name)
                    and node.targets[0].id == "__all__"
                    and isinstance(node.value, (ast.List, ast.Tuple))
                ):
                    for elt in node.value.elts:
                        if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                            self._add_symbol(node, elt.value, "export")
                self.generic_visit(node)

        Visitor().visit(tree)
        return symbols
