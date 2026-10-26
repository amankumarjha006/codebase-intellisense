"""add_hnsw_vector_index

Revision ID: e4f5a6b7c8d9
Revises: 'bea36be81196'
Create Date: 2026-10-26 23:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'bea36be81196'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'CREATE INDEX IF NOT EXISTS ix_embeddings_vector_hnsw ON embeddings USING hnsw (vector vector_cosine_ops);'
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_embeddings_vector_hnsw;')
