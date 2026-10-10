[← Game design index](../GAME-DESIGN.md)

# 5. Player onboarding

1. **Sign up** with name, email, password. ✅
   - Name: `Firstname Lastname`-style pattern.
   - Password: 6–20 chars, at least one digit, one uppercase, one lowercase, one special character from
     `-#$.%&@(){}[]!?+*`.
2. **Confirm email** — a verification link (valid 24 h) is sent; the account becomes `active`. ✅
3. **Deploy your base** — a prominent red button, **"Deploy your base to start"**, appears while the player has no base. 🟡
   The player sets the base's **access password** (mandatory, §11.2.2) and may enter or create a **spawn seed** to
   start near friends (§22.3).
4. **On click** — a base bot is created on a free cell chosen by the base-spawn rule (§4.1), its module kit is attached,
   its map point is upserted, and the monitor (canvas map) is shown. ✅ (backend) / 🔴 (canvas map)
5. **Tutorial** — an optional, skippable guided checklist starts (§16.1). 🔴

A player may own exactly **one living base**; attempting to deploy a second while one is alive returns
`403 User base already exists`. ✅ If the base was destroyed (it became a [corpse base](./06-the-base.md#63-base-destruction-corpse-base)),
the player may deploy a new base. 🔴
