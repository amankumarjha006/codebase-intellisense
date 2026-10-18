"""add_is_archived_to_repositories

Revision ID: bea36be81196
Revises: 'df059d638a4a'
Create Date: 2026-10-18 06:55:32.919289+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bea36be81196'
down_revision: Union[str, None] = 'df059d638a4a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('repositories', sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.create_index('ix_repositories_is_archived', 'repositories', ['is_archived'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_repositories_is_archived', table_name='repositories')
    op.drop_column('repositories', 'is_archived')
