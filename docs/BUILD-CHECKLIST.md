# Build checklist

Deadline: **27 Oct 2026, 23:59 IST**. Ordered so the pass/fail submission
artifacts are reachable even if the lower items get cut.

## P0 — make the product exist
- [x] 1. Design pass: revise tokens away from generic dark+acid-green
- [x] 2. `POST /api/plans` — persist a generated plan (wizard currently cannot save)
- [x] 3. Fix: `/api/plans/preview` is publicly callable, no session or rate limit
- [x] 4. Seed script — so screens have data to render before Strava exists
- [x] 5. Today screen on real data
- [x] 6. Plan screen on real data
- [x] 7. Calendar screen on real data
- [x] 8. Link screen — manual activity entry + linking (no OAuth needed)
- [x] 9. Progress screen on real data
- [x] 10. Session in header + sign out

## P0 — submission artifacts (pass/fail)
- [ ] 11. Neon database connected  *(needs Shrikant)*
- [ ] 12. Deployed to Vercel  *(needs Shrikant)*
- [x] 13. README to the brief's required structure
- [ ] 14. Demo video, 3-5 min  *(needs Shrikant)*
- [ ] 15. Submission form  *(needs Shrikant)*

## P1 — only if time remains
- [ ] 16. Strava OAuth + "Sync now"
- [ ] 17. Workout detail screen
- [ ] 18. Manage Plan + regeneration diff
- [ ] 19. Drag-and-drop rearranging

## Cut
Webhooks · per-rep lap analysis · month grid · `/settings/debug` · Plan Guide

## Round 2 — from local testing (26 Oct)
- [x] B1. Hydration warning from the Dark Reader extension
- [x] B2. "Connect Strava" dead-loops Link ↔ Settings; neither connects anything
- [x] F1. Explain each run type: what it is and how to run it
- [x] F2. Week navigation on Today
- [x] F3. Delete a plan, then be able to build a new one
- [x] F4. Yellow-toned palette (frontend-design pass)
