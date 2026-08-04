# SPEC: Mandatory two-factor authentication
Status: APPROVED        Owner: Epic Craftings        Issue: in-chat request (2026-08-04)

## 1. Intent
Every real user must prove possession of an authenticator after proving their password. A password
alone must never create a usable session, including for accounts that have not enrolled yet.

## 2. Behavior contract
- GIVEN an unenrolled account WHEN its password is accepted THEN setup details are shown, no API
  token is issued, and a valid current authenticator code is required before the first session.
- GIVEN an enrolled account WHEN its password is accepted THEN the existing code/recovery-code
  challenge remains unchanged.
- GIVEN a pre-existing token for an unenrolled account WHEN it calls a protected endpoint THEN it
  is rejected; beginning setup revokes those old tokens so they cannot revive after confirmation.
- GIVEN a lost phone WHEN an administrator resets that user's 2FA THEN all of that user's sessions
  are revoked and their next password login requires fresh enrolment.
- GIVEN an authenticated user WHEN they try to disable 2FA THEN the server refuses because the
  organization policy is mandatory.
- GIVEN an impersonation session WHEN an enrolled administrator views another account THEN the
  borrowed session remains usable; this is an audited admin action, not a target-user login.

## 3. Vertical slice checklist
- [x] UI: mandatory setup is part of login; account page shows required status
- [x] Endpoint: public throttled setup-confirm endpoint; existing challenge retained
- [x] Persistence: existing encrypted 2FA columns; no new migration
- [x] Validation: encrypted purpose-bound challenge plus RFC 6238 verification
- [x] Error state: invalid/expired setup returns actionable 422 response
- [x] Recovery: single-use recovery codes plus admin reset/re-enrolment

## 4. Impact map
- Backend: `AuthController`, `TwoFactorController`, `RequireTwoFactor`, API routes and middleware aliases
- Frontend: `authSlice`, `Login`, `LoginTwoFactorSetup`, `TwoFactorPanel`
- Persistence: `users.two_factor_*` (existing migration), Sanctum personal access tokens
- Connected behavior: normal login, recovery login, old sessions, admin reset, impersonation
- Executable proof: `SecurityTest.php`, full backend feature suite, frontend production build

## 5. Security decisions
- Setup challenges are encrypted, expire after five minutes, and carry a distinct purpose so they
  cannot be exchanged at the normal second-factor endpoint.
- No token is created before setup confirmation.
- Existing tokens are revoked at setup start and admin reset.
- Secrets and recovery codes remain encrypted at rest; QR rendering stays local in the browser.
