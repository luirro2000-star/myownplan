# Daylight — Checkpoint 4G Audit

Date: 2026-10-03

## Scope

Review and harden the account-protected AI endpoints before the first signed-in trial. The live production site remains on checkpoint 4A.

## Findings

- Assistant and brain-dump AI endpoints now reject requests from an unverified origin after checking sign-in. Goal breakdown and cloud write endpoints already used the same Netlify Identity origin check.
- The two endpoints reject request bodies larger than 1 million characters before JSON parsing or provider use. Assistant messages are capped at 4,000 characters; brain-dump text remains capped at 30,000 characters.
- The server-side API key remains in Netlify environment variables for Functions and is not included in the browser bundle. The value was not opened or copied during this audit.

## Verification

- `npm test` passed, including new checks for rejected origin and excessive request/body sizes. `npm run build` passed and `git diff --check` found no whitespace errors.
- Netlify's project activity showed Deploy Preview commit `dbd89d8` completed. Production remained on commit `c7efff7`.
- Netlify displayed the `ANTHROPIC_API_KEY` variable as a secret scoped to Builds, Functions, and Runtime across five deploy contexts. Its presence does not prove the provider accepts it.
- The team billing page showed 138.8 of 300 free credits remaining for the Sep 12–Oct 11 period: 150 credits for ten earlier production deploys, 11 compute credits, and about 0.2 credits for requests/bandwidth. Netlify documents Deploy Previews as zero deployment credits; active database/function compute and web use are metered.

## Remaining checks

- The owner must accept the Netlify Identity invitation and sign in to the Deploy Preview. Then verify AI response, Inbox AI review, account sync, conflict resolution, snapshot restore, and cloud deletion with a disposable test plan.
- A real provider request is needed to distinguish a valid key/model from a provider authentication or model error. No password or invitation token should be shared with the agent.
- Keep production publication on hold until the signed-in checks and remaining release audits pass.
