"""
BetterBox: the email provider for phase 1.

Upstream is github.com/aidankmcalister/betterbox (betterbox.dev), a Gmail client
built on the Gmail API. Two consequences worth knowing before reading further:

  1. It is Gmail API only. There is no IMAP path, so a clinic on Outlook or on
     its own mail server cannot be served by this provider. A second email
     provider would be a sibling folder here, not a change to this one.
  2. It needs a Google OAuth app and a database of its own. The credentials are
     the clinic's, not ours.
"""
