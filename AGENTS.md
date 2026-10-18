# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

### NASA research

This repo maps NASA public data and APIs so future NASA hackathons and contests can start from checked sources.

- Root `README.md` holds the living notes until a folder becomes its own boundary, including the **Tech stack (NSAC)** section (offline LLM, RAG, drift detection, NASA OSDR, UI, packaging).
- Every factual claim needs a source URL and the date it was checked. Figures from the 2019 Open-Innovation Tour for Space Apps are historical; refresh them against the live site before a contest.
- Harvest catalogs (`data.nasa.gov`, `api.nasa.gov`) suit name lookup. Domain archives (Planetary Data System, Earthdata, STI, and similar) suit discovery. Do not treat a harvest miss as proof a dataset does not exist.
- Keep NASA API keys and tokens out of the repo.

### Architecture Principles

Code follows **Clean Architecture**: dependencies point inward (entities → use cases → adapters → frameworks). Business rules never depend on UI, DB, or framework details.

#### SOLID

- **S**: One reason to change per module
- **O**: Extend behavior with new types, not edits to stable code
- **L**: Subtypes must honor base contracts
- **I**: Small, role-specific interfaces
- **D**: Inner layers depend on abstractions, not concrete frameworks

#### Frontend: feature layer

Organize by feature under `features/<name>/` (components, hooks, api, types). Features may import `shared/`; `shared/` never imports features. Export only the public surface via `index.ts`.

#### Deep modules

Prefer modules with **simple interfaces and substantial hidden complexity**. Avoid shallow pass-through wrappers. Split only when a module hides real complexity — not to hit arbitrary file-size limits.

#### Design patterns

Use GoF patterns when they match a recurring problem — not for decoration. Catalog: https://refactoring.guru/design-patterns/catalog

## Child DOX Index

No child `AGENTS.md` files. The only durable content is root `README.md`, and the root doc owns it. Add a child `AGENTS.md` when a folder gains its own purpose, such as a catalog, an API client, or a contest entry.
