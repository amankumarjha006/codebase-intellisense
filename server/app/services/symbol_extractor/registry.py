from .base import BaseExtractor
from .python_extractor import PythonExtractor
from .javascript_extractor import JavaScriptExtractor

def get_extractor(language: str) -> BaseExtractor | None:
    language = language.lower()
    if language == "python":
        return PythonExtractor()
    elif language in ("javascript", "typescript", "jsx", "tsx"):
        return JavaScriptExtractor(language)
    return None
