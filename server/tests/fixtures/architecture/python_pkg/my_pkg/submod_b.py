"""Submodule B creating import cycle with A and importing from sibling."""
from .submod_a import FuncA
from ..sibling import Helper

def FuncB() -> str:
    return "B" + Helper()

