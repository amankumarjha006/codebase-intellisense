"""Base protocol for import resolvers."""

from typing import Callable, Protocol, Sequence
from ..types import FileReader, ImportEvidence


class ImportResolver(Protocol):
    """Protocol for language-specific import resolvers."""

    def resolve(
        self,
        files: Sequence[tuple[str, str]],  # (repo_relative_path, language)
        read_file: FileReader,
        clock: Callable[[], float] | None = None,
        timeout_seconds: float = 60.0,
    ) -> tuple[list[ImportEvidence], list[str]]:
        """Resolves imports for the indexed files.

        Returns (list_of_evidences, list_of_unparseable_files).
        """
        ...

