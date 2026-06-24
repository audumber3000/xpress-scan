# MolarPlus Backend — Hetzner → AWS Cutover Runbook

Lift-and-shift of the backend stack (FastAPI + nexus + RQ workers + Postgres + Redis)
from the single Hetzner Docker-Compose box to AWS (EC2 + RDS).

**Goal:** zero app-store release, minimal downtime (target < 30 min write-freeze),
clean rollback path.

---

## 0. Facts this runbook is built on

| Thing | Value |
|---|---|
| Backend domain | `api.molarplus.com` (the ONLY public hostname — flip this) |
| Nexus | **internal only** — backend reaches it over the docker network (`http://nexus:8001`). NOT public, no DNS record. Comes along inside the compose stack; nothing to flip. |
| AWS target | EC2 Elastic IP `13.207.97.83`, RDS `molarplus-db.ch8c2s2qg0dt.ap-south-1.rds.amazonaws.com` (ap-south-1) |
| Web frontend | `app.molarplus.com` (hosted separately — **not** migrating here) |
| DB | Postgres 16, db name `molarplus`, user `postgres`, container `molarplus-db-1` |
| Redis | container, `--appendonly yes`, RQ broker only |
| Object storage | Cloudflare R2 — **stays put, not migrated** |
| TLS today | nginx + certbot on host (`backend/scripts/setup_ssl.sh`) |
| Clients | Mobile app + web both resolve by **domain name**, not IP → cutover = DNS flip |

**Key consequence:** the entire cutover is flipping ONE A record (`api.molarplus.com`)
to `13.207.97.83`. Every installed mobile app follows it automatically — no EAS build,
no store review. (`nexus.molarplus.com` appears in the mobile config but has never
existed in DNS — a pre-existing dead setting, unaffected by this migration.)

Webhooks (all on `api.molarplus.com` → auto-follow the DNS flip):
- Cashfree notify: `https://api.molarplus.com/api/v1/subscriptions/webhook/cashfree`
- Cashfree return: `https://app.molarplus.com/subscription` (frontend — unaffected)
- Meta WhatsApp webhook → confirm the configured callback is on `api.molarplus.com`
  (nexus isn't public, so any inbound webhook must arrive via the api host).

---

## Phase 1 — Pre-provision (do days ahead, no downtime)

### 1.1 Provision AWS infra
- [ ] **EC2** instance (`t3.large` to start), Ubuntu 22.04, in a VPC with a public subnet.
      Assign an **Elastic IP** (stable target).
- [ ] **RDS for PostgreSQL 16**, `db.t3.small` (Multi-AZ optional), same major version (16)
      to keep `pg_dump`/`pg_restore` clean. Private subnet; SG allows 5432 only from the EC2 SG.
- [ ] **Security groups:** EC2 inbound 80/443 from world, 22 from your IP. RDS 5432 from EC2 SG only.
- [ ] Install Docker + docker-compose-plugin on EC2.
- [ ] Confirm RDS Postgres supports any extensions the DB uses:
      `docker exec molarplus-db-1 psql -U postgres -d molarplus -c "\dx"` on Hetzner, compare against RDS.

### 1.2 Get the app running on EC2 against a COPY of the DB (rehearsal)
- [ ] Clone the repo onto EC2, copy `.env.production` (update `DATABASE_URL` to the RDS endpoint,
      drop the `db` host → use the RDS hostname; remember `@` in password must be `%40`).
- [ ] In `docker-compose.prod.yml`: **remove the `db` service** (RDS replaces it). Keep `redis`.
      (See companion task: "Rework deploy.sh for RDS".)
- [ ] Take a **non-final** dump from Hetzner and restore into RDS to rehearse:
      ```bash
      # On Hetzner
      docker exec molarplus-db-1 pg_dump -U postgres -Fc -d molarplus > /tmp/molarplus_rehearsal.dump
      # Copy to a machine that can reach RDS (or to EC2), then:
      pg_restore --no-owner --no-acl -h <RDS_ENDPOINT> -U postgres -d molarplus /tmp/molarplus_rehearsal.dump
      ```
- [ ] Bring the stack up on EC2 (`docker compose -f docker-compose.prod.yml --env-file .env.production up -d`),
      hit it directly by EC2 IP / a temp hostname (e.g. `api-staging.molarplus.com`) and smoke test:
      login, list patients, create appointment, trigger a WhatsApp/email, an R2 upload/download.
- [ ] Confirm Firebase JSON is mounted and push works; confirm R2 env vars work end-to-end.

### 1.3 TLS on AWS
Pick ONE:
- **Option A — nginx + certbot on EC2** (closest to today): reuse `setup_ssl.sh`, issue certs for
  `api.molarplus.com` AND `nexus.molarplus.com`. *Certbot needs DNS already pointing at EC2,* so
  issue these during the cutover window (or use DNS-01 challenge to pre-issue).
- **Option B — ALB + ACM** (recommended longer-term): request an ACM cert for both hostnames
  (DNS validation, can be done now), put an ALB in front of the EC2 box, target group → :8000 / :8001.
  TLS is then independent of the box.

### 1.4 Lower DNS TTL (do ~24–48h before cutover)
- [ ] Set TTL on `api.molarplus.com` and `nexus.molarplus.com` to **60–300s**.
      This makes the flip propagate in minutes and enables fast rollback.

---

## Phase 2 — Cutover (the maintenance window, ~15–30 min)

> Announce a short maintenance window. The write-freeze is the only user-visible downtime.

1. [ ] **Freeze writes on Hetzner.** Stop the app + workers so no new rows are written
       (DB stays up for the dump):
       ```bash
       docker compose -f docker-compose.prod.yml --env-file .env.production stop backend backend-worker nexus nexus-worker
       ```
       (Optionally show a maintenance page at nginx.)

2. [ ] **Final dump** from Hetzner:
       ```bash
       docker exec molarplus-db-1 pg_dump -U postgres -Fc -d molarplus > /tmp/molarplus_final.dump
       ```

3. [ ] **Restore into RDS** (drop/recreate or restore into a fresh empty DB to avoid the rehearsal data):
       ```bash
       # Easiest: drop + recreate the RDS db so it's clean, then:
       pg_restore --no-owner --no-acl -h <RDS_ENDPOINT> -U postgres -d molarplus /tmp/molarplus_final.dump
       ```
       - [ ] Sanity check row counts match Hetzner for key tables (`clinics`, `users`, `patients`, `appointments`, `subscriptions`).

4. [ ] **Start the stack on EC2** against RDS:
       ```bash
       docker compose -f docker-compose.prod.yml --env-file .env.production up -d
       curl -s https://<ec2-or-temp-host>/health   # expect "healthy"
       ```

5. [ ] **Issue/confirm TLS** for both hostnames on AWS (if using certbot Option A, run it now once DNS is flipped, step 6).

6. [ ] **Flip DNS** — point `api.molarplus.com` and `nexus.molarplus.com` at AWS
       (Route 53 ALIAS → ALB, or A record → EC2 Elastic IP).

7. [ ] **Verify on the real domains:**
       - [ ] `curl -s https://api.molarplus.com/health` → healthy
       - [ ] Mobile app: cold-start, login, load a clinic, create an appointment.
       - [ ] Web `app.molarplus.com`: login + a read + a write.
       - [ ] Fire one WhatsApp + one email (nexus path).
       - [ ] One R2 file upload + download.
       - [ ] One Cashfree sandbox/real webhook round-trip (or confirm the endpoint is reachable).

---

## Phase 3 — Stabilize & decommission

- [ ] **Keep Hetzner running, app stopped, for 24–72h** as rollback insurance (DNS may be cached).
- [ ] Watch CloudWatch / logs for errors, especially webhook deliveries and worker jobs.
- [ ] Raise DNS TTL back to 3600s once stable.
- [ ] Confirm **RDS automated backups + a manual snapshot** are in place.
- [ ] Set CloudWatch alarms: EC2 CPU, RDS connections/CPU/storage, ALB 5xx (if used).
- [ ] After the soak period: snapshot Hetzner, then decommission.

---

## Rollback (if something breaks during the window)

Because writes were frozen before the dump, Hetzner's DB is still authoritative and unchanged:
1. Flip DNS back to the Hetzner IP (fast, thanks to low TTL).
2. Restart the Hetzner app: `docker compose ... up -d backend backend-worker nexus nexus-worker`.
3. You're back to the pre-migration state with **zero data loss** (no writes happened on AWS yet,
   or if a few did, you accept re-doing the cutover later). Investigate, retry another day.

---

## Open items to confirm before scheduling the window
- [ ] SSH host/credentials for the **new EC2** box (the deploy flow points at an SSH host).
- [ ] Exact Meta WhatsApp webhook URL — confirm it's on `nexus.molarplus.com` (domain-based).
- [ ] Whether `backend/uploads` holds anything (currently 0B → assumed unused; everything's on R2).
- [ ] Redis: nothing to migrate (RQ queue is transient) — just ensure the EC2 redis volume persists.
- [ ] Companion change: `deploy.sh` migration steps must switch from `docker exec molarplus-db-1 psql`
      to `psql -h <RDS_ENDPOINT>` (no DB container on AWS).
