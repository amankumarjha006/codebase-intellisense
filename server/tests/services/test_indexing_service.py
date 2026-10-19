from unittest.mock import MagicMock, patch
from uuid import uuid4
import pytest

from app.models.knowledge import File, CodeChunk
from app.models.repository import RepositoryVersion
from app.services.indexing import IndexingService


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def version():
    v = RepositoryVersion(
        id=uuid4(),
        repository_id=uuid4(),
        commit_sha="abc1234",
        branch="main",
    )
    return v


def test_index_repository_bulk_creates_files(mock_db, version):
    """Verify that discovered files are persisted in bulk rather than individual flushes."""
    mock_files = [
        ("src/main.py", "/fake/repo/src/main.py"),
        ("src/utils.py", "/fake/repo/src/utils.py"),
        ("README.md", "/fake/repo/README.md"),
    ]

    service = IndexingService(mock_db)

    with patch("app.services.indexing.discover_files_with_stats", return_value=(mock_files, {})), \
         patch("app.services.indexing.read_file_content", return_value=("code", "hash123")), \
         patch("app.services.indexing.KnowledgeRepository") as mock_knowledge_repo_cls, \
         patch("app.services.symbol_extractor.SymbolExtractorService"), \
         patch("app.services.chunking.ChunkBuilderService"):

        mock_knowledge_repo = MagicMock()
        mock_knowledge_repo.delete_files_for_version.return_value = 0
        mock_knowledge_repo_cls.return_value = mock_knowledge_repo

        mock_file_instances = [
            File(
                id=uuid4(),
                repository_version_id=version.id,
                file_path=p,
                file_name=p.split("/")[-1],
                language="python",
                size_bytes=4,
                hash="hash123",
            )
            for p, _ in mock_files
        ]
        mock_db.execute.return_value.scalars.return_value.all.return_value = mock_file_instances

        service._index_repository("/fake/repo", version)

        # bulk_create_files should have been called once with all 3 files
        mock_knowledge_repo.bulk_create_files.assert_called_once()
        created_files = mock_knowledge_repo.bulk_create_files.call_args[0][0]
        assert len(created_files) == 3
        assert [f.file_path for f in created_files] == ["src/main.py", "src/utils.py", "README.md"]

        # mock_db.flush should NOT be called per file
        assert mock_db.flush.call_count == 0


def test_embedding_generation_joins_file_table(mock_db, version):
    """Verify that chunk query uses SQL JOIN on File rather than an IN clause of file UUIDs."""
    mock_files = [("src/main.py", "/fake/repo/src/main.py")]

    mock_embedding_service = MagicMock()
    service = IndexingService(mock_db, embedding_service=mock_embedding_service)

    with patch("app.services.indexing.discover_files_with_stats", return_value=(mock_files, {})), \
         patch("app.services.indexing.read_file_content", return_value=("code", "hash123")), \
         patch("app.services.indexing.KnowledgeRepository") as mock_knowledge_repo_cls, \
         patch("app.services.symbol_extractor.SymbolExtractorService"), \
         patch("app.services.chunking.ChunkBuilderService"):

        mock_knowledge_repo = MagicMock()
        mock_knowledge_repo.delete_files_for_version.return_value = 0
        mock_knowledge_repo_cls.return_value = mock_knowledge_repo

        mock_file = File(
            id=uuid4(),
            repository_version_id=version.id,
            file_path="src/main.py",
            file_name="main.py",
            language="python",
            size_bytes=4,
            hash="hash123",
        )
        mock_chunk = MagicMock(spec=CodeChunk)

        executed_statements = []

        def fake_execute(stmt):
            executed_statements.append(stmt)
            result = MagicMock()
            if len(executed_statements) == 1:
                result.scalars.return_value.all.return_value = [mock_file]
            else:
                result.scalars.return_value.unique.return_value.all.return_value = [mock_chunk]
            return result

        mock_db.execute.side_effect = fake_execute

        service._index_repository("/fake/repo", version)

        assert len(executed_statements) == 2
        chunk_stmt = executed_statements[1]

        # Verify the chunk statement compiles with a JOIN on File and no file_id.in_ clause
        sql_str = str(chunk_stmt.compile(compile_kwargs={"literal_binds": False}))
        assert "JOIN files ON" in sql_str
        assert "files.repository_version_id = " in sql_str
        assert "code_chunks.file_id IN" not in sql_str


def test_index_file_backward_compatibility(mock_db, version):
    """Verify that _index_file still works when called directly."""
    service = IndexingService(mock_db)

    with patch("app.services.indexing.read_file_content", return_value=("print('hello')", "abc")):
        f = service._index_file("/repo", "test.py", "/repo/test.py", version)

        assert f.file_path == "test.py"
        assert f.language == "python"
        mock_db.add.assert_called_once_with(f)
        mock_db.flush.assert_called_once()


def test_index_repository_handles_bare_file_list(mock_db, version):
    """Verify that _index_repository handles discover_files_with_stats returning just a list without stats."""
    mock_files = [("src/main.py", "/fake/repo/src/main.py")]
    service = IndexingService(mock_db)

    with patch("app.services.indexing.discover_files_with_stats", return_value=mock_files), \
         patch("app.services.indexing.read_file_content", return_value=("code", "hash123")), \
         patch("app.services.indexing.KnowledgeRepository") as mock_knowledge_repo_cls, \
         patch("app.services.symbol_extractor.SymbolExtractorService"), \
         patch("app.services.chunking.ChunkBuilderService"):

        mock_knowledge_repo = MagicMock()
        mock_knowledge_repo.delete_files_for_version.return_value = 0
        mock_knowledge_repo_cls.return_value = mock_knowledge_repo
        mock_db.execute.return_value.scalars.return_value.all.return_value = []

        service._index_repository("/fake/repo", version)
        mock_knowledge_repo.bulk_create_files.assert_called_once()

