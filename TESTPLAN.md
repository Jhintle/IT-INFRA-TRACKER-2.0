End-to-End Test Plan
- Objective: Validate all CRUD endpoints and dashboard rendering after CSP and API hardening.

Prereqs:
- A valid admin JWT token or session for authenticated endpoints (if used)
- Cloud Run revision deployed with latest code

1) Projects
- Create: POST /api/projects
- Update: PUT /api/projects/{id} with partial data (e.g. {"title": "New"}) -> expect 200 + updated row
- Delete: DELETE /api/projects/{id} -> expect 200 { "success": true } or 404 if not found

2) Weekly Tasks
- Create: POST /api/weekly-tasks
- Update: PUT /api/weekly-tasks/{id} with partial data -> expect 200
- Delete: DELETE /api/weekly-tasks/{id} -> expect 200
- Verify that deleting a task does not remove its checklist items separately

3) Vulnerabilities
- Create/Update/Delete similarly
  - 404 if not found on PUT/DELETE

4) Risks
- Create/Update/Delete with 404 handling

5) Critical Tasks
- Create/Update/Delete with 404 handling

6) Dashboard
- GET /api/dashboard/stats
- Ensure charts render after data is present in the database

7) CSP
- Ensure browser console shows no CSP blocks for external scripts (chart.js, sql wasm). If blocked, patch CSP headers as described in CSP patch.

Notes:
- If you see 404s on PUT/DELETE after performing an operation, verify IDs match the ones returned from GET after creation.
- If you see 400 No valid fields to update, adjust payload to include at least one updatable field.
