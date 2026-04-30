# Security Specification - Solar ROI Calculator

## Data Invariants
- An entry must belong to a specific user and cannot be modified by others.
- `discountValue` and `totalBill` must be positive numbers.
- `month` must be between 1 and 12.
- `investmentValue` must be at least 0.
- Users can only read and write their own data.

## The "Dirty Dozen" Payloads (Deny Cases)
1. Creating an entry for another user ID.
2. Reading another user's entry.
3. Updating the `userId` field (immutable).
4. Creating an entry with a `month` of 13.
5. Creating an entry with a negative `discountValue`.
6. Setting a string for `injectedkWh`.
7. Anonymous user trying to write data.
8. Unverified user trying to write data (if required).
9. Updating `createdAt` timestamp.
10. Injecting extra fields not defined in schema (Ghost fields).
11. Reading the entire `users` collection (No blanket reads).
12. Deleting settings without admin rights (if restricted).

## Test Cases for Rules
- `create` entry: Success if `userId == auth.uid` and types match.
- `update` entry: Success if `userId == auth.uid` and only content fields change.
- `list` entries: Success if query filters by `userId`.
- `delete` entry: Success if `userId == auth.uid`.
