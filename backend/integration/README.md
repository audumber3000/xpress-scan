# Integration API

MolarPlus's implementation of the ClinoHealth Integration API — the contract the
group CRM reads every product through. The contract itself lives in the
`clinohealth-crm` repo: `docs/INTEGRATION_API.md` for the prose,
`docs/integration-api.openapi.yaml` for the machine-readable spec.

Mounted at `/integration/v1` by two lines in `main.py`:

```python
from integration.mount import mount_integration_api
mount_integration_api(app)
```

Nothing else about the CRM appears anywhere near the product's own routes, and
it should stay that way. The callers are different — another system rather than
a person — the auth is different, the error envelope is different, and the
versioning is different: a breaking change here means `/integration/v2` beside
`/v1`, while the product's APIs carry on unversioned.

## Why it lives here

The support console used to read these same tables from outside, over an SSH
tunnel into production, with a hand-maintained copy of the models that drifted
every time this schema changed. Serving the contract from inside the product
removes that second reader and the tunnel with it: the CRM asks the application
that owns the data, and the application answers.

## Configuration

Two environment variables, both lists of `name=token` pairs:

```
INTEGRATION_TOKENS=crm-actions=<secret>            # read + write actions
INTEGRATION_READONLY_TOKENS=crm-sync=<secret>      # the sync orchestrator
```

Give the orchestrator a read-only token and the CRM's action buttons a separate
write-scoped one. They are different callers with different blast radii, and
one token for both means a compromised sync can suspend accounts.

Absent tokens mean the API refuses every request rather than running open.

## What it serves

| Endpoint | |
|---|---|
| `GET /meta` | what this product can answer; the sync skips what is false |
| `GET /accounts`, `/accounts/{id}`, `/accounts/{id}/stats` | organisations and their roll-ups |
| `GET /branches` | one row per site |
| `GET /subscriptions`, `/payments` | what the customer pays ClinoHealth |
| `GET /leads` | the pipeline, out of `growth_leads` |
| `GET /tickets` | declared `false` in `/meta` — not built yet |
| `PATCH /accounts/{id}`, `POST /accounts/{id}/plan`, `/suspend`, `/activate` | the write actions, all idempotency-keyed |

## Layout

```
mount.py        the only thing main.py touches
reads.py        the GET endpoints
actions.py      the writes, with the idempotency ledger
shapes.py       rows -> the shapes the spec declares
aggregates.py   patient/appointment/invoice counts — never rows
org.py          the organisation shim over parent_clinic_id
plans_view.py   the two plan questions core/plans.py does not answer
leads.py        the growth_leads table the retired console created
auth.py         service-token authentication
store.py        idempotency ledger + audit log
wire.py         money, timestamps, cursors, the error envelope
```

## Tests

```bash
./venv/bin/python -m pytest tests/test_integration_contract.py -q
```

61 tests against a seeded SQLite database — no tunnel, no production, no
network. They are the contract's conformance suite: cursor pagination that is
stable under concurrent writes, money as integer micros, unknown amounts as
null rather than zero, `mrr` normalised to a month, retired plan names mapped
onto the current three, and every action idempotent under replay.

## Two rules that are easy to break

**No endpoint may return a patient record.** The aggregates module counts rows
and sums invoice totals; it never selects a name, a phone number or a clinical
field. The CRM is a business system and has no lawful need for health data.

**`mrr` is what the customer pays ClinoHealth**, normalised to one month. It is
not what the clinic bills its own patients — that is `monthly_gmv` on
`/accounts/{id}/stats`, and it is an account-health signal, never revenue.
