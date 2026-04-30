Upload app.js and index.html to GitHub.

IMPORTANT ORDER:
1. Upload these files first.
2. Open the app.
3. Send yourself a login link and confirm you can log in.
4. THEN run the SQL in supabase_rls_policies.sql.
5. Turn RLS on only after login works.

This version adds:
- Login screen
- Magic link login through Supabase Auth
- Logout button
- Blocks the app unless logged in
- Keeps global search, cadence, notifications, and sync
