# Database rules

`database.rules.json` controls who can read and write the Realtime Database.

## What the rules allow

| Who | Read | Write |
|---|---|---|
| Admins and super admins (by login claim) | Everything | Everything |
| Signed-in members | Their own `users/{uid}` record, plus `events`, `eventTypes` and `locations` | Their own name, email, username, phone, emergency contact, position, department, service and join date; `profile/updatedAt`, `profile/authUid` (their own uid only) and `stats/lastLogin`; their own basic record once, if none exists, without a role |
| Signed-out visitors | Nothing | Nothing |

Admin access comes from the login claim (`admin`, `superAdmin` or `role`), not from the role stored in the database.

When an admin is demoted, the server sets the new claim and signs them out of every session. The `api/` functions refuse their old login at once. Their current login token keeps database access until it expires, which is within an hour.

Writes that need trust go through the server functions in `api/`, which use the Admin SDK:
- `api/admin/create-user.js` creates members.
- `api/admin/update-user-auth.js` changes logins and roles.
- `api/attendance/scan.js` clocks members in and out.

## Testing

```bash
npm run test:rules
```

This needs the Firebase CLI and Java. It starts the local database emulator under a demo project, so it never touches the real database.

## Deploying, in this order

1. **Deploy the app** with these changes, so member creation, role changes and scanning go through the server.
2. **Give every admin a role claim.** Run `node scripts/sync-role-claims.js` first as a dry run, then with `--apply`.
3. **Have admins reload the app**, or sign out and back in, so their login picks up the claim.
4. **Publish the rules.** First copy the current rules from the Firebase console (Realtime Database → Rules) so they can be restored. Then either paste `database.rules.json` into the console, or run `firebase deploy --only database --project <project-id>` from the `qr-code-system` folder, where `firebase.json` lives. There is deliberately no `.firebaserc`, so the CLI never picks a project on its own.
5. **Check admin screens and one employee login.** Then set `ALLOW_DB_ROLE_FALLBACK=false` in Vercel.

**Rollback:** paste the saved rules back into the console.

**Optional:** if your Firebase Authentication settings allow it, turn off user sign-up so that only admins can create logins.
