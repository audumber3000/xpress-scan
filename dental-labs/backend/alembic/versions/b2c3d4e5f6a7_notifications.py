"""notifications: notification_logs table + labs.notification_settings

Adds:
- notification_logs: one row per attempted send (per channel) for support visibility.
- labs.notification_settings: per-event channel toggles (JSON).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_NOTIFICATION_SETTINGS = {
    "case_received": ["whatsapp"],
    "case_dispatched": ["whatsapp"],
    "case_delivered": [],
    "statement_ready": ["email"],
}


def upgrade() -> None:
    op.create_table(
        'notification_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lab_id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=40), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('template_name', sa.String(length=80), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='queued'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('provider_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['lab_id'], ['labs.id']),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notification_logs_id'), 'notification_logs', ['id'], unique=False)
    op.create_index(op.f('ix_notification_logs_lab_id'), 'notification_logs', ['lab_id'], unique=False)
    op.create_index(op.f('ix_notification_logs_case_id'), 'notification_logs', ['case_id'], unique=False)
    op.create_index('ix_notification_logs_lab_created', 'notification_logs', ['lab_id', 'created_at'], unique=False)

    # JSON column for per-event channel toggles; backfill existing labs with the default.
    op.add_column('labs', sa.Column('notification_settings', sa.JSON(), nullable=True))
    labs = sa.table('labs', sa.column('notification_settings', sa.JSON()))
    op.execute(labs.update().values(notification_settings=DEFAULT_NOTIFICATION_SETTINGS))
    op.alter_column('labs', 'notification_settings', nullable=False)


def downgrade() -> None:
    op.drop_column('labs', 'notification_settings')
    op.drop_index('ix_notification_logs_lab_created', table_name='notification_logs')
    op.drop_index(op.f('ix_notification_logs_case_id'), table_name='notification_logs')
    op.drop_index(op.f('ix_notification_logs_lab_id'), table_name='notification_logs')
    op.drop_index(op.f('ix_notification_logs_id'), table_name='notification_logs')
    op.drop_table('notification_logs')
