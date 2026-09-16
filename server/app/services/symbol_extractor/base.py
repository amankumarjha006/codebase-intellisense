import abc
from app.models.knowledge import File, Symbol

class BaseExtractor(abc.ABC):
    @abc.abstractmethod
    def extract(self, file: File, source_code: bytes) -> list[Symbol]:
        """
        Extract symbols from the given file and source code.
        """
        pass
