# Backlog / TODO

## High-priority (deferred)
- Implement safe archive/soft-delete workflow for completed tasks (requested 2025-08-25).
  - Problem: Current client-side AsyncStorage "archive" only hides items locally. We discussed options:
    - Local-only (current): fast UX, no backend changes, not synced across devices.
    - Soft-delete in DB: add `is_archived boolean`, `archived_at timestamptz`, `archived_by uuid` and show/hide tasks based on this flag.
    - Hard delete in DB: irreversible; NOT recommended without KargoMarketing consent and audit logging.
  - Recommended plan (when ready):
    1. Add DB migration to introduce soft-delete columns to `gorevler`.
    2. Create secure RPC `archive_task(id)` (SECURITY DEFINER) and grant `EXECUTE` to `authenticated` so clients can request archive safely.
    3. Add audit table or trigger to log archive actions.
    4. Update client UI: replace local-only archive with server call; keep local AsyncStorage as cache until server commit.
    5. Add admin/restore UI to allow unarchive and audit review.
  - Notes: Hard deletes should only be allowed for admin/service roles and always logged; get KargoMarketing sign-off before deleting authoritative records.

Status: Deferred by user (will implement later upon explicit request).

-- Added by automation on 2025-08-25
