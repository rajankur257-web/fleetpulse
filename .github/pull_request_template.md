## Summary of Changes

<!-- Brief 2-3 sentence overview of what this PR introduces or fixes -->

### Related Milestone / Issue
- Milestone: <!-- e.g., M11: Testing & CI Pipeline -->
- Issue / Ref: <!-- e.g., #42 -->

---

## Type of Change
- [ ] `feat`: New feature or capability
- [ ] `fix`: Bug fix
- [ ] `test`: New or updated tests
- [ ] `docs`: Documentation updates
- [ ] `refactor`: Code change that neither fixes a bug nor adds a feature
- [ ] `perf`: Performance improvement
- [ ] `chore`: Build, tooling, or dependency updates

---

## Hard Rules Checklist (Fleet Pulse AGENTS.md)
- [ ] **Haversine Rule**: Imported exclusively from `@fleet-pulse/shared` (no duplication).
- [ ] **Atomic Assignment**: Driver assignment uses Redis lock or conditional SQL `UPDATE ... WHERE status = 'available'`.
- [ ] **Dispatch Strategies**: Implements `DispatchStrategy` without breaking callers.
- [ ] **Input Validation**: All DTOs/Zod schemas validate inputs (lat: -90..90, lng: -180..180).
- [ ] **Secrets & Config**: No hardcoded secrets; validated at startup via `validateEnv`.
- [ ] **TypeScript Strict**: No `any` without an explanatory comment.
- [ ] **Conventional Commits**: Commit messages follow conventional commit style (`feat:`, `fix:`, `test:`, `docs:`).

---

## Quality & Testing Verification
- [ ] `pnpm lint` passed with 0 errors
- [ ] `pnpm typecheck` passed with 0 errors
- [ ] `pnpm test` unit tests passing across all packages
- [ ] Supertest API integration tests passing
- [ ] Playwright Web E2E tests passing
- [ ] Coverage threshold met (>=95% geo, >=90% dispatch strategies)
- [ ] Documentation updated in `/docs`

### Commands Executed & Evidence
```bash
# Paste verification commands run and output summary
```
