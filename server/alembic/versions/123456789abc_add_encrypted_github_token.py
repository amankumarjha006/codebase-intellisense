"""Add encrypted access token to github_accounts

Revision ID: 123456789abc
Revises: 318d0e4bd080
Create Date: 2026-09-12 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '123456789abc'
down_revision: Union[str, None] = '318d0e4bd080'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('github_accounts', sa.Column('access_token_encrypted', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('github_accounts', 'access_token_encrypted')
