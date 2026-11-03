"""drop_symbol_relationships

Revision ID: f1a2b3c4d5e6
Revises: e4f5a6b7c8d9
Create Date: 2026-11-04 02:50:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_symbol_relationships_target_symbol_id', table_name='symbol_relationships')
    op.drop_index('ix_symbol_relationships_source_symbol_id', table_name='symbol_relationships')
    op.drop_index('ix_symbol_relationships_repository_version_id', table_name='symbol_relationships')
    op.drop_table('symbol_relationships')


def downgrade() -> None:
    op.create_table(
        'symbol_relationships',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('repository_version_id', sa.UUID(), nullable=False),
        sa.Column('source_symbol_id', sa.UUID(), nullable=False),
        sa.Column('target_symbol_id', sa.UUID(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "relationship_type IN ('CALLS', 'REFERENCES', 'INHERITS', 'IMPLEMENTS')",
            name='ck_symbol_relationships_type'
        ),
        sa.ForeignKeyConstraint(['repository_version_id'], ['repository_versions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_symbol_id'], ['symbols.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_symbol_id'], ['symbols.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_symbol_relationships_repository_version_id', 'symbol_relationships', ['repository_version_id'], unique=False)
    op.create_index('ix_symbol_relationships_source_symbol_id', 'symbol_relationships', ['source_symbol_id'], unique=False)
    op.create_index('ix_symbol_relationships_target_symbol_id', 'symbol_relationships', ['target_symbol_id'], unique=False)

