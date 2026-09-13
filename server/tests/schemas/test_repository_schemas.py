"""
Phase 3.1 Repository Schema Tests
Verifies API contract alignment, field presence, field absence, Pydantic validation,
ORM compatibility, and pagination semantics.
"""
import pytest
from pydantic import ValidationError
from uuid import UUID, uuid4
from datetime import datetime, timezone
from app.schemas.repository import (
    RepositoryCreate,
    RepositoryOut,
    RepositoryListOut,
    RepositoryVersionSummary,
    RepositoryDetailOut,
    RepositoryAnalyzeRequest,
    AnalyzeRepositoryOut,
    IndexJobOut,
    AnalysisResultOut,
)


# ---------------------------------------------------------------------------
# RepositoryCreate
# ---------------------------------------------------------------------------

class TestRepositoryCreate:
    def test_valid_url(self):
        schema = RepositoryCreate(url="https://github.com/owner/repo")
        assert schema.url == "https://github.com/owner/repo"

    def test_url_preserved_as_is(self):
        url = "https://github.com/owner/my-repo"
        assert RepositoryCreate(url=url).url == url

    def test_invalid_empty_string(self):
        with pytest.raises(ValidationError):
            RepositoryCreate(url="")

    def test_invalid_whitespace_only(self):
        with pytest.raises(ValidationError):
            RepositoryCreate(url="   ")

    def test_invalid_tab_whitespace(self):
        with pytest.raises(ValidationError):
            RepositoryCreate(url="\t")

    def test_missing_url_raises(self):
        with pytest.raises(ValidationError):
            RepositoryCreate()  # type: ignore

    def test_non_github_url_accepted_at_schema_level(self):
        # Schema only checks structural validity; GitHub validation is service-layer
        schema = RepositoryCreate(url="https://gitlab.com/owner/repo")
        assert schema.url == "https://gitlab.com/owner/repo"


# ---------------------------------------------------------------------------
# RepositoryOut — no sensitive fields exposed
# ---------------------------------------------------------------------------

class TestRepositoryOut:
    def _make(self, **overrides):
        defaults = dict(
            id=uuid4(),
            owner="tiangolo",
            name="fastapi",
            is_private=False,
            created_at=datetime.now(timezone.utc),
        )
        defaults.update(overrides)
        return RepositoryOut(**defaults)

    def test_valid_construction(self):
        schema = self._make()
        assert schema.owner == "tiangolo"
        assert schema.name == "fastapi"
        assert schema.is_private is False

    def test_id_is_uuid(self):
        schema = self._make()
        assert isinstance(schema.id, UUID)

    def test_created_at_is_datetime(self):
        schema = self._make()
        assert isinstance(schema.created_at, datetime)

    def test_private_repo(self):
        schema = self._make(is_private=True)
        assert schema.is_private is True

    def test_clone_url_not_in_schema(self):
        # clone_url must NOT be exposed through the API
        schema_fields = RepositoryOut.model_fields
        assert "clone_url" not in schema_fields

    def test_github_installation_id_not_in_schema(self):
        schema_fields = RepositoryOut.model_fields
        assert "github_installation_id" not in schema_fields

    def test_from_attributes_enabled(self):
        assert RepositoryOut.model_config.get("from_attributes") is True

    def test_from_attributes_orm_object(self):
        """Simulate ORM object serialization via from_attributes."""
        from app.models.repository import Repository

        orm_obj = Repository()
        orm_obj.id = uuid4()
        orm_obj.owner = "tiangolo"
        orm_obj.name = "fastapi"
        orm_obj.is_private = False
        orm_obj.created_at = datetime.now(timezone.utc)
        # Set internal fields that must not leak
        orm_obj.clone_url = "https://github.com/tiangolo/fastapi.git"
        orm_obj.github_installation_id = None
        orm_obj.github_repo_id = "12345"

        schema = RepositoryOut.model_validate(orm_obj)
        assert schema.owner == "tiangolo"
        assert schema.name == "fastapi"
        # Ensure dump does not contain clone_url
        dumped = schema.model_dump()
        assert "clone_url" not in dumped
        assert "github_installation_id" not in dumped


# ---------------------------------------------------------------------------
# RepositoryVersionSummary
# ---------------------------------------------------------------------------

class TestRepositoryVersionSummary:
    def test_valid(self):
        schema = RepositoryVersionSummary(
            id=uuid4(),
            commit_sha="abc123",
            status="SUCCESS",
        )
        assert schema.commit_sha == "abc123"
        assert schema.status == "SUCCESS"

    def test_id_is_uuid(self):
        schema = RepositoryVersionSummary(id=uuid4(), commit_sha="abc", status="PENDING")
        assert isinstance(schema.id, UUID)

    def test_from_attributes_enabled(self):
        assert RepositoryVersionSummary.model_config.get("from_attributes") is True

    def test_from_attributes_orm_object(self):
        from app.models.repository import RepositoryVersion

        orm_obj = RepositoryVersion()
        orm_obj.id = uuid4()
        orm_obj.commit_sha = "deadbeef"
        orm_obj.index_status = "SUCCESS"
        # Note: API contract uses `status`, model column is `index_status`.
        # The schema field is `status` — it must be set explicitly when
        # building from the ORM object in the endpoint (the endpoint maps it).
        # from_attributes reads by attribute name; so we test with manual mapping here.
        schema = RepositoryVersionSummary(
            id=orm_obj.id,
            commit_sha=orm_obj.commit_sha,
            status=orm_obj.index_status,
        )
        assert schema.status == "SUCCESS"

    def test_from_orm_version_mapper(self):
        from app.models.repository import RepositoryVersion
        
        orm_obj = RepositoryVersion()
        orm_obj.id = uuid4()
        orm_obj.commit_sha = "deadbeef"
        orm_obj.index_status = "SUCCESS"
        
        schema = RepositoryVersionSummary.from_orm_version(orm_obj)
        assert schema.id == orm_obj.id
        assert schema.commit_sha == orm_obj.commit_sha
        assert schema.status == orm_obj.index_status


# ---------------------------------------------------------------------------
# RepositoryDetailOut
# ---------------------------------------------------------------------------

class TestRepositoryDetailOut:
    def test_no_active_version(self):
        schema = RepositoryDetailOut(
            id=uuid4(),
            owner="owner",
            name="repo",
            is_private=False,
            active_version=None,
        )
        assert schema.active_version is None

    def test_with_active_version(self):
        version = RepositoryVersionSummary(id=uuid4(), commit_sha="abc", status="SUCCESS")
        schema = RepositoryDetailOut(
            id=uuid4(),
            owner="owner",
            name="repo",
            is_private=False,
            active_version=version,
        )
        assert schema.active_version.status == "SUCCESS"

    def test_clone_url_not_in_schema(self):
        assert "clone_url" not in RepositoryDetailOut.model_fields

    def test_github_installation_id_not_in_schema(self):
        assert "github_installation_id" not in RepositoryDetailOut.model_fields

    def test_from_attributes_enabled(self):
        assert RepositoryDetailOut.model_config.get("from_attributes") is True


# ---------------------------------------------------------------------------
# RepositoryListOut
# ---------------------------------------------------------------------------

class TestRepositoryListOut:
    def _item(self):
        return RepositoryOut(
            id=uuid4(), owner="o", name="r", is_private=False, created_at=datetime.now(timezone.utc)
        )

    def test_valid(self):
        schema = RepositoryListOut(items=[self._item()], total=1, page=1, limit=50, has_more=False)
        assert schema.total == 1
        assert schema.page == 1
        assert schema.limit == 50
        assert schema.has_more is False

    def test_empty_items(self):
        schema = RepositoryListOut(items=[], total=0, page=1, limit=50, has_more=False)
        assert schema.items == []
        assert schema.total == 0

    # Page boundaries
    def test_page_1_valid(self):
        assert RepositoryListOut(items=[], total=0, page=1, limit=10, has_more=False)

    def test_page_0_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=0, page=0, limit=10, has_more=False)

    def test_page_negative_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=0, page=-1, limit=10, has_more=False)

    # Limit boundaries
    def test_limit_1_valid(self):
        assert RepositoryListOut(items=[], total=0, page=1, limit=1, has_more=False)

    def test_limit_100_valid(self):
        assert RepositoryListOut(items=[], total=0, page=1, limit=100, has_more=False)

    def test_limit_0_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=0, page=1, limit=0, has_more=False)

    def test_limit_negative_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=0, page=1, limit=-1, has_more=False)

    def test_limit_101_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=0, page=1, limit=101, has_more=False)

    def test_total_zero_valid(self):
        assert RepositoryListOut(items=[], total=0, page=1, limit=10, has_more=False)

    def test_total_negative_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryListOut(items=[], total=-1, page=1, limit=10, has_more=False)

    def test_has_more_is_bool(self):
        schema = RepositoryListOut(items=[], total=0, page=1, limit=10, has_more=False)
        assert isinstance(schema.has_more, bool)


# ---------------------------------------------------------------------------
# RepositoryAnalyzeRequest
# ---------------------------------------------------------------------------

class TestRepositoryAnalyzeRequest:
    def test_omitted_branch(self):
        assert RepositoryAnalyzeRequest().branch is None

    def test_none_branch(self):
        assert RepositoryAnalyzeRequest(branch=None).branch is None

    def test_valid_branch(self):
        assert RepositoryAnalyzeRequest(branch="main").branch == "main"

    def test_valid_branch_with_slash(self):
        assert RepositoryAnalyzeRequest(branch="feature/my-feature").branch == "feature/my-feature"

    def test_empty_branch_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryAnalyzeRequest(branch="")

    def test_whitespace_branch_invalid(self):
        with pytest.raises(ValidationError):
            RepositoryAnalyzeRequest(branch="   ")


# ---------------------------------------------------------------------------
# AnalyzeRepositoryOut
# ---------------------------------------------------------------------------

class TestAnalyzeRepositoryOut:
    def test_valid(self):
        schema = AnalyzeRepositoryOut(
            job_id=uuid4(),
            repository_version_id=uuid4(),
            status="QUEUED",
            message="Analysis job queued successfully.",
        )
        assert schema.status == "QUEUED"
        assert schema.message == "Analysis job queued successfully."

    def test_uuid_fields(self):
        schema = AnalyzeRepositoryOut(
            job_id=uuid4(),
            repository_version_id=uuid4(),
            status="QUEUED",
            message="ok",
        )
        assert isinstance(schema.job_id, UUID)
        assert isinstance(schema.repository_version_id, UUID)


# ---------------------------------------------------------------------------
# IndexJobOut
# ---------------------------------------------------------------------------

class TestIndexJobOut:
    def test_all_nullables_none(self):
        schema = IndexJobOut(
            id=uuid4(),
            repository_id=uuid4(),
            repository_version_id=uuid4(),
            status="INDEXING",
            started_at=None,
            completed_at=None,
            error_message=None,
        )
        assert schema.started_at is None
        assert schema.completed_at is None
        assert schema.error_message is None

    def test_with_timestamps(self):
        now = datetime.now(timezone.utc)
        schema = IndexJobOut(
            id=uuid4(),
            repository_id=uuid4(),
            repository_version_id=uuid4(),
            status="READY",
            started_at=now,
            completed_at=now,
            error_message=None,
        )
        assert schema.started_at == now
        assert schema.completed_at == now

    def test_uuid_fields(self):
        schema = IndexJobOut(
            id=uuid4(),
            repository_id=uuid4(),
            repository_version_id=uuid4(),
            status="QUEUED",
            started_at=None,
            completed_at=None,
            error_message=None,
        )
        assert isinstance(schema.id, UUID)
        assert isinstance(schema.repository_id, UUID)
        assert isinstance(schema.repository_version_id, UUID)

    def test_from_attributes_enabled(self):
        assert IndexJobOut.model_config.get("from_attributes") is True

    def test_no_internal_fields(self):
        fields = IndexJobOut.model_fields
        assert "clone_url" not in fields
        assert "github_installation_id" not in fields


# ---------------------------------------------------------------------------
# AnalysisResultOut
# ---------------------------------------------------------------------------

class TestAnalysisResultOut:
    def test_basic_payload(self):
        schema = AnalysisResultOut(
            analysis_type="OVERVIEW",
            repository_version_id=uuid4(),
            payload={"description": "A fast framework"},
        )
        assert schema.analysis_type == "OVERVIEW"
        assert schema.payload["description"] == "A fast framework"

    def test_nested_payload(self):
        schema = AnalysisResultOut(
            analysis_type="TECH_STACK",
            repository_version_id=uuid4(),
            payload={"technologies": [{"name": "Python", "confidence": "HIGH"}]},
        )
        assert schema.payload["technologies"][0]["name"] == "Python"

    def test_empty_payload(self):
        schema = AnalysisResultOut(
            analysis_type="ARCHITECTURE",
            repository_version_id=uuid4(),
            payload={},
        )
        assert schema.payload == {}

    def test_uuid_field(self):
        schema = AnalysisResultOut(
            analysis_type="OVERVIEW",
            repository_version_id=uuid4(),
            payload={},
        )
        assert isinstance(schema.repository_version_id, UUID)

    def test_from_attributes_enabled(self):
        assert AnalysisResultOut.model_config.get("from_attributes") is True
