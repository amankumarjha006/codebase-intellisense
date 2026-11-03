"""Main entry for python fixture."""
import sys
from my_pkg import FuncA
from ns_pkg.component.core import run

if __name__ == "__main__":
    print(FuncA(), run())

