# Security Specification & Threat Model: CivicBridge

## 1. Core Architecture & Security Pillars
CivicBridge enforces a Zero-Trust security model governed by the Eight Pillars of Hardened Rules:
1. **The Master Gate**: Relational synchronization. All modifications to grievance dockets, community innovations, and policy consultations strictly check authenticated identity against record ownership and administrative roles.
2. **Validation Blueprints**: Strict `isValidUser()`, `isValidProblem()`, `isValidInnovation()`, and `isValidConsultation()` validators enforcing boundary limits, key invariants, and type checks.
3. **Path Variable Hardening**: All collection document ID paths are sanitized against length and regex guards (`^[a-zA-Z0-9_\-]+$`).
4. **Tiered Identity Logic**:
   - *Tier 1 (Super Admin / Department Admin)*: Master triage, re-assignment, policy management.
   - *Tier 2 (Assigned Field Officer)*: Restricted to appending resolution evidence, work-orders, and status transitions to 'Resolution Submitted'.
   - *Tier 3 (Reporting Citizen / Creator)*: Restricted to modifying only their own verification status or disputing resolution.
   - *Tier 4 (Public / Citizens)*: Can cast exactly 1 upvote on innovations and 1 response per consultation.
5. **Total Array Guarding**: Evidence lists, timeline events, voter UID sets, and category tags are strictly bounded in length and type.
6. **PII Isolation & Schema Constraints**: User profiles are isolated to their owner (`isOwner(userId)`) or verified administrators (`isAdmin()`). Contact details in complaints are bounded and protected.
7. **The Atomicity Guarantee**: Status transitions and timeline events occur atomically within transaction dockets.
8. **Secure List Queries**: Queries are enforced server-side against authorization boundaries.

---

## 2. Data Invariants

### User Entity (`/users/{userId}`)
- `id` matches `request.auth.uid` and path variable `userId`.
- `role` can only be set to `citizen` during public self-registration. Role escalation to `officer`, `department_admin`, `super_admin`, or `expert` requires administrative authority.
- `createdAt` is immutable.

### Problem Entity (`/problems/{problemId}`)
- `id` matches path variable `problemId`.
- `reporterUid` must equal `request.auth.uid` during creation.
- A citizen cannot modify officer assignment or department routing once submitted.
- An officer can only update assigned cases or submit resolution evidence.
- A problem in terminal status (`Resolved`, `Rejected`) cannot have arbitrary fields modified without formal reopening or administrative override.

### Innovation Entity (`/innovations/{innovationId}`)
- `id` matches path variable `innovationId`.
- `submitterUid` matches `request.auth.uid`.
- Voting: `voters` array must contain unique UIDs. A user can only toggle their own UID in `voters` and increment/decrement `votes` by 1.
- Reviews: Only certified `expert` or `super_admin` can append official evaluations and approve pilot stages.

### Consultation Entity (`/consultations/{consultationId}`)
- Only administrators can create or alter consultation question definitions.
- Citizens can only participate by appending their responses and recording their UID in `voters`.
- Duplicate voting by the same UID is forbidden.

---

## 3. The "Dirty Dozen" Threat Payloads

The following 12 adversarial payloads test the boundaries of Identity, Integrity, and State:

1. **Payload 1 (Privilege Escalation on Signup)**:
   Unauthenticated or regular citizen submits a new `/users/{uid}` document with `role: "super_admin"`.
   *Expected Result: PERMISSION_DENIED*.

2. **Payload 2 (User ID Poisoning / Impersonation)**:
   Authenticated user `uid_alice` attempts to write or overwrite `/users/uid_bob`.
   *Expected Result: PERMISSION_DENIED*.

3. **Payload 3 (Ghost Field / Shadow Property Injection)**:
   Malicious client attempts to create `/problems/CIV-2026-9999` with shadow field `__bypassSecurity: true` or `verifiedByGovernor: true`.
   *Expected Result: PERMISSION_DENIED*.

4. **Payload 4 (Citizen Self-Assignment of Field Officer)**:
   Citizen creates a problem docket and sets `assignedOfficer.id: "officer_123"` and `status: "Resolved"` directly on create.
   *Expected Result: PERMISSION_DENIED*.

5. **Payload 5 (Unassigned Case Hijacking)**:
   Officer A attempts to update or submit fake resolution on a problem assigned to Officer B in an unrelated department.
   *Expected Result: PERMISSION_DENIED*.

6. **Payload 6 (Terminal State Mutation / Post-Closure Tampering)**:
   Malicious actor attempts to edit description, photos, or citizen details on a case marked `Resolved`.
   *Expected Result: PERMISSION_DENIED*.

7. **Payload 7 (Denial of Wallet - 50MB Base64 String Flood)**:
   Attacker posts an evidence item containing a 50MB malicious string instead of a valid URL.
   *Expected Result: PERMISSION_DENIED*.

8. **Payload 8 (Vote Tampering / Infinite Upvoting)**:
   User sends an update to `/innovations/INV-2026-001` incrementing `votes` by 500 without recording individual voter UIDs.
   *Expected Result: PERMISSION_DENIED*.

9. **Payload 9 (Expert Review Impersonation)**:
   Non-expert citizen attempts to append an `InnovationReview` giving a score of 100/100 and setting stage to `Pilot Approved`.
   *Expected Result: PERMISSION_DENIED*.

10. **Payload 10 (Consultation Hijacking / Ballot Stuffing)**:
    Citizen attempts to submit a consultation vote without adding their UID to `voters`, or attempts to vote twice.
    *Expected Result: PERMISSION_DENIED*.

11. **Payload 11 (PII Scraping via Blanket List)**:
    Unauthenticated caller tries to read `/users` or query other citizen's private phone and email data.
    *Expected Result: PERMISSION_DENIED*.

12. **Payload 12 (Path Injection / Long Identifier Attack)**:
    Attacker tries to create a document at `/problems/../../../system_config` or with a 2048-byte random character path.
    *Expected Result: PERMISSION_DENIED*.
