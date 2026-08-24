"""
Inbox providers, one subtree each.

Same rule the imaging integrations follow: every vendor gets its own directory
and nothing vendor-specific is allowed to leak upward. `base.py` defines what a
provider must do; `registry.py` is the only place that knows which vendors
exist. Everything above this package talks to the protocol, never to BetterBox
or WaSphere by name, so adding a third provider is a new folder and one line in
the registry rather than a hunt through the domain.
"""
