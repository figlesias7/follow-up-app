# Follow Up Local Web App V2

This version adds backup, CSV export, JSON backup, CSV/JSON import, and clear-device data controls.

## New in this version

- Tools tab
- Export Leads CSV
- Download Full Backup as JSON
- Import CSV backup
- Import JSON backup
- Clear all local leads
- Preserves existing V1 leads automatically if already stored in the browser

## Important

This is still local-only.

Each phone or computer has its own leads until we connect Supabase or another shared database.

## How to update GitHub Pages

1. Unzip this folder.
2. Go to your GitHub repository.
3. Upload and replace:
   - index.html
   - styles.css
   - app.js
   - manifest.json
   - service-worker.js
   - icon-192.png
   - icon-512.png
4. Commit changes.
5. Open the app link.
6. If the old version still shows, refresh once or close and reopen the Home Screen app.

## Best testing process

1. Add a few test leads.
2. Go to Tools.
3. Export CSV.
4. Download Full Backup.
5. Clear all leads.
6. Import the CSV or JSON backup.
7. Confirm leads return.

## Next upgrade

Supabase sync will let the desktop and phone share the same data.
