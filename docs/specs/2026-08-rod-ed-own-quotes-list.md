# SPEC: Rod and Ed see only their own rows in All Quotes
Status: APPROVED        Owner: Epic Craftings        Issue: in-chat request (2026-08-04)

## Intent
When Rod or Ed opens All Quotes, the list must contain only quotes whose canonical sales
representative is that user. This restriction is specific to the listing and must not alter other
users, existing quote data, quote creation, or direct access rules used by assigned/shared work.

## Behavior contract
- GIVEN username `rod` WHEN `/api/quotes` is requested THEN only `sales_rep = user.full_name` rows
  are returned, regardless of blank representative or `assigned_to` values.
- GIVEN username `ed` in any letter case WHEN `/api/quotes` is requested THEN the same rule applies.
- GIVEN any existing list filter WHEN Rod or Ed uses it THEN the filter narrows their own rows; it
  can never widen the base dataset.
- GIVEN another sales rep, manager, viewer, or administrator WHEN the list is requested THEN the
  existing visibility behavior remains unchanged.
- GIVEN Rod or Ed opens a directly assigned/shared quote through another valid workflow THEN the
  existing `Quote::isVisibleTo()` behavior remains unchanged; this request concerns All Quotes only.

## Impact map and proof
- Policy source: `User::restrictsQuoteListingToOwnRepresentative()`
- Enforcement surface: `QuoteController::index()` before all optional filters
- UI/data consumer: `AllQuotes` through `GET /api/quotes`
- No persistence or migration changes
- Proof: authorization feature tests plus the complete backend regression suite
