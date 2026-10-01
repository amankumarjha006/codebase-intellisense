class RAGQueryError(Exception):
    pass

class InvalidQueryError(RAGQueryError):
    pass

class NoIndexedVersionError(RAGQueryError):
    pass

class InvalidRepositoryVersionError(RAGQueryError):
    pass
