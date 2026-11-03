[← Game design index](../game-design/GAME-DESIGN.md)

# Admin console: the starting point (history)

Moved from design §25.1 by task 15.4 of the development plan. It records the review of the code before the admin console existed (written
before Phase 0 of the plan). Nothing here describes the product today; the product is design §25.

## Starting point (review of the current code)

There is **no admin UI today**, and there never was one: no branch and no commit of the repository contains an admin
page. The commented-out admin routes were copied in with the authorization work (commit `a9e31af`) from another project's
template, and the components they refer to were never added. What exists:

- **Roles:** `admin`, `owner`, `user`, `unlimited`, `banned` (`UserStatus`). `admin` and `owner` are treated the same; a root
  admin is created from `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD`.
- **API:** `GET /api/private/statistics` (admin only): users by status, document counts per collection, start time and the
  size of a `public` directory (left over from another project). `DELETE /api/private/debug/collections` (admin only):
  deletes every document of the named collections, with no confirmation and no environment guard.
- **Client:** admin routes (`AdminLayout`, `Dashboard`, `Users`, `Settings`) are commented out in `routes/private.tsx` and the
  components do not exist; `ADMIN_URL` (the Socket.IO CORS origin) is a remnant of a former separate admin app.
- **Security findings (fixed by task 0.8, with 1.9, 1.11 and 8.2; every finding below except token revocation and the shared-store rate limit was fixed by 0.8 on 2026-10-11):**
  - `GET /api/private/users` and `PUT /api/private/users/:id` are behind the *login* check only, so **any logged-in player
    can list all users and edit any user, including setting their `status` to `admin`** (the next token refresh then carries
    the new role) or `active` to `true`.
  - The list endpoint passes a client-supplied JSON filter straight into a database query.
  - The debug endpoint can wipe whole collections in production.
  - The admin check trusts the role inside the token; banned and unverified users are not rejected anywhere on the server
    (`isActive` and `hasUserStatus` exist but are never used), and login and refresh do not check them either.
  - The Socket.IO handshake accepts an expired token and the event handlers then fail on the missing user; event payloads
    such as `botId` are not validated, so malformed input throws inside async handlers.
  - JWT payloads are not validated, refresh tokens cannot be revoked (logout only clears the cookie), and there is no rate
    limiting on login, signup or refresh.
