# YAFT Agent Working Agreement

YAFT handles private financial records. Every agent must keep real statements, extracted text, rendered pages, passwords, account identifiers, and broker exports out of Git, build contexts, logs, fixtures, screenshots, and final messages.

## Repository boundaries

- Real input files live only in `/Users/yaft/Code/YAFT-private-inputs`.
- Temporary parsing artefacts live outside the repository and must be removed after use.
- Never commit `.env`, `samples/`, `tmp/`, `work/`, `uploads/`, PDFs, spreadsheets, extracted text, or rendered statement pages.
- Never add a Git remote unless the owner explicitly requests one.
- Use synthetic, anonymised fixtures in committed tests.

## Agent ownership

- `agent/axis-parser` may edit only `apps/api/src/imports/axis-pdf-parser.ts` and `apps/api/src/imports/axis-pdf-parser.spec.ts`.
- `agent/sbi-parser` may edit only `apps/api/src/imports/sbi-pdf-parser.ts` and `apps/api/src/imports/sbi-pdf-parser.spec.ts`.
- The integrator owns every shared file: parser contracts and routing, PNB compatibility, Prisma schema and migrations, encryption, API, UI, documentation, dependency files, and integration tests.
- Parser agents must not modify shared files to make their code compile. Report a required contract change to the integrator.

## Parser requirements

- Fail closed when the layout is unknown, ambiguous, malformed, or unreconciled.
- Never guess a password, institution, missing amount, or transaction identity.
- Validate the running balance and printed statement totals before returning rows.
- Return signed integer minor units; debits are negative and credits are positive.
- Preserve legitimate reversals and repeated transactions through bank-specific dedupe identities.
- Do not emit partial rows when validation fails.

## Credentials and logging

- Statement passwords are document-opening credentials only. Never accept or store banking passwords, PINs, OTPs, or CVVs.
- Never hardcode, print, log, snapshot, place in a URL, or commit a real password or encryption key.
- The PDF password may exist only in request memory or encrypted storage.
- Do not return ciphertext, IVs, authentication tags, keys, or plaintext credentials through an API.

## Verification and commits

- Each parser branch must include synthetic tests for its supported layout and its rejection paths.
- Private smoke tests may read the owner's sample from `/Users/yaft/Code/YAFT-private-inputs`, but must never copy it into a worktree.
- Run the relevant tests before committing and report both the command result and the private row count without exposing transaction details.
- Review `git diff --cached` before every commit. Commits must contain only the files owned by that agent.
