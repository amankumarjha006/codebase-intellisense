"""add_fts_index

Revision ID: 47f628c41157
Revises: 'f8ce76f3b9ee'
Create Date: 2026-09-21 15:41:21.070026+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '47f628c41157'
down_revision: Union[str, None] = 'f8ce76f3b9ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_code_chunk_content_fts ON code_chunks USING gin(to_tsvector('english', content));"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_code_chunk_content_fts;")
