# Quality gates

Run these commands from the repository root before sharing a build:

```bash
npm run typecheck
npm test
npm run build
npm run check:bundle
```

`npm run check` runs the same sequence. The web bundle gate measures every file in `web/dist` after a successful build. It enforces a 3,500,000-byte total budget and a 1,000,000-byte budget for each JavaScript or CSS asset. Fonts and other static files count toward the total budget because they are shipped to browsers, while the per-file check focuses on the asset types most likely to block startup or rendering.

The budgets can be tightened or temporarily adjusted for a planned change without editing the script:

```powershell
$env:WEB_DIST_MAX_TOTAL_BYTES = '3500000'
$env:WEB_DIST_MAX_ASSET_BYTES = '1000000'
npm run check:bundle
```

The gate fails when `web/dist` is missing, the total output exceeds its budget, or a JavaScript/CSS asset exceeds its per-file budget. It prints the five largest output files to make a failure actionable.

Vitest coverage is intentionally not part of the default quality gate yet. The current repository does not install a Vitest coverage provider; adding one would add a new dependency solely for reporting. Existing Vitest test commands remain unchanged, and coverage can be added later when the project chooses and installs a provider compatible with the pinned Vitest version.
