"""case billing linkage: delivered_at, invoice_id, invoiced_at

Adds billing-integrity columns to `cases`:
- delivered_at: stamped when a case transitions to "delivered"; billing keys the
  statement period off this (not received_date).
- invoice_id / invoiced_at: which monthly statement billed the case (NULL = un-invoiced),
  so the same delivered case can't be billed twice.

Revision ID: a1b2c3d4e5f6
Revises: c635447ccfd0
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c635447ccfd0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cases', sa.Column('delivered_at', sa.DateTime(), nullable=True))
    op.add_column('cases', sa.Column('invoice_id', sa.Integer(), nullable=True))
    op.add_column('cases', sa.Column('invoiced_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_cases_invoice_id'), 'cases', ['invoice_id'], unique=False)
    op.create_foreign_key(
        'fk_cases_invoice_id', 'cases', 'invoices', ['invoice_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_cases_invoice_id', 'cases', type_='foreignkey')
    op.drop_index(op.f('ix_cases_invoice_id'), table_name='cases')
    op.drop_column('cases', 'invoiced_at')
    op.drop_column('cases', 'invoice_id')
    op.drop_column('cases', 'delivered_at')
