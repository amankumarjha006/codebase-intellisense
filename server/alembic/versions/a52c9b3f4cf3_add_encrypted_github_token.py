"""add encrypted github token

Revision ID: a52c9b3f4cf3
Revises: 318d0e4bd080
Create Date: 2026-09-13 15:15:10.382227+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a52c9b3f4cf3'
down_revision: Union[str, None] = '318d0e4bd080'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('github_accounts', sa.Column('access_token_encrypted', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('github_accounts', 'access_token_encrypted')
