"""email verification resend limit

Revision ID: 20260527_0016
Revises: 20260526_0015
Create Date: 2026-05-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260527_0016"
down_revision: str | None = "20260526_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_verification_otps",
        sa.Column("resend_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_column("email_verification_otps", "resend_count")

