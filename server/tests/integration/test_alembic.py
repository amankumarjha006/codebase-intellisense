import pytest
from alembic.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from app.core.db import Base

pytestmark = [pytest.mark.integration]

def test_alembic_metadata_matches_models(integration_engine):
    """
    Ensure the models defined in Python match the schema migrated by Alembic.
    """
    with integration_engine.connect() as conn:
        context = MigrationContext.configure(conn)
        diff = compare_metadata(context, Base.metadata)
        assert not diff, f"Alembic metadata differs from models: {diff}"
