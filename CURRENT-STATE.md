# Current App State — March 2026

## What's Working (Production)
- ✅ Google OAuth login with role-based access
- ✅ Work order CRUD with 2-step completion flow
- ✅ Time entry logging with per-entry descriptions
- ✅ Purchase order management with quick approve/reject
- ✅ Photo upload to Google Drive with compression
- ✅ Billing export (Excel + email with HTML + attachments)
- ✅ Projects with chambers, milestones, parts, photos, drawings, notes, team
- ✅ Project budget tracker (management+) with labor cost calculations
- ✅ Knowledge Base with 5 categories + approval workflow + file attachments
- ✅ Invoice generator (admin only) with DUFMD/DUMC templates
- ✅ Customer portal (read-only)
- ✅ Recurring PM auto-generation
- ✅ Dashboard analytics with 4-week trends
- ✅ Activity log on WOs
- ✅ Bulk actions on WO list
- ✅ Search + customer filter on WO list and PO list
- ✅ TMS tracking with one-tap toggle
- ✅ Dark/light mode
- ✅ Haptic feedback
- ✅ Pull-to-refresh
- ✅ Keyboard shortcuts
- ✅ Quick-log time floating button
- ✅ Recent WOs shortcut
- ✅ Tap notification to navigate
- ✅ Customer billing summary
- ✅ Profanity filter
- ✅ Targeted database reloads (performance)
- ✅ Real company logo in header (clickable → home)

## Role Visibility Matrix
| Feature | Tech | Manager | Admin |
|---------|------|---------|-------|
| Work Orders | Own + crew | All | All |
| PO amounts | Own POs only | All | All |
| Billing export | ❌ | ✅ | ✅ |
| Invoice generator | ❌ | ❌ | ✅ |
| Project budget | ❌ | ✅ | ✅ |
| Labor cost/profit | ❌ | ❌ | ✅ |
| Billing/cost rates | ❌ | ❌ | ✅ |
| Knowledge Base | View approved | Full + approve | Full + approve |
| Projects (edit) | View only | Edit | Edit |
| Users management | ❌ | ✅ | ✅ |
| Settings | ❌ | ❌ | ✅ |

## Known Issues / TODO
1. Invoice Excel template needs exact formatting match
2. RLS security needs proper role-based policies
3. Fully loaded labor cost calculator not built yet
4. Offline mode not built
5. Google Play APK OAuth fix needed
6. Code splitting needed (1,425 lines in single file)
