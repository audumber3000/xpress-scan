"""
What BetterBox needs to run, and where it comes from.

Nothing here is committed. The Google client id and secret are the clinic's own
OAuth app, read from the environment, and the refresh token is per-clinic and
lives in the database beside the connection row.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class BetterBoxConfig:
    client_id: str
    client_secret: str
    redirect_uri: str
    # Read and send. Deliberately not gmail.modify: nothing in this feature
    # deletes or relabels a clinic's mail, and the narrower scope is easier to
    # get past a Google review.
    scopes: tuple = (
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
    )

    @classmethod
    def from_env(cls) -> "BetterBoxConfig":
        return cls(
            client_id=os.getenv("BETTERBOX_GOOGLE_CLIENT_ID", ""),
            client_secret=os.getenv("BETTERBOX_GOOGLE_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("BETTERBOX_REDIRECT_URI", ""),
        )

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.redirect_uri)
