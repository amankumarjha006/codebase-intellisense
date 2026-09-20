"""add_pg_trgm_index

Revision ID: f8ce76f3b9ee
Revises: 'a5633f95e4b0'
Create Date: 2026-09-20 16:43:04.294893+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8ce76f3b9ee'
down_revision: Union[str, None] = 'a5633f95e4b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')
    op.execute('CREATE INDEX ix_code_chunks_content_trgm ON code_chunks USING gin (content gin_trgm_ops);')


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_code_chunks_content_trgm;')
