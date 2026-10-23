# UI languages

`next-intl` uses the saved native language as the UI locale. Supported locales are
`es` and `en`; the target language is always `en`. Existing routes are unchanged.

- `request.ts` resolves the authenticated learner's preferences once per request.
  An HttpOnly cookie is only a signed-out display hint, never account identity.
- `lib/preferences.ts` reads Postgres using the authenticated internal learner ID.
- `/api/profile` validates origin, supported locales and the fixed target language.
- `messages/es.json` and `messages/en.json` are the canonical translation catalogs.
  Keep their keys and interpolation variables identical. Use semantic keys for
  new copy and ICU plurals rather than joining translated sentence fragments.
- Existing extracted UI copy has stable content-hash IDs. Do not renumber IDs or
  use source-line numbers; components refer to these IDs directly.
- `static-text.ts` adapts existing fixed label registries (practice steps, metric
  names and taxonomy) through `static-message-ids.json`. Add a mapping to an existing
  catalog key when adding a registry label. Do not pass learner text, model output
  or historical evidence through this adapter.
- `progress-text.ts` translates structured statistic descriptions without changing
  the scoring rules, measured values or dates used to group practice days.

Add or edit a message in both catalogs and call `useTranslations` in synchronous
components or `await getTranslations` in async server components. Keep technical
identifiers, routes, SQL, provider prompts and persisted evidence out of UI catalogs.
For small interactive forms, prefer passing translated string props from the server.
`ProfilePage` does this for `ProfileSettings`: the form manages state and saving, but
does not require a client intl context to render or refresh after saving.
The account avatar uses Clerk's `UserButton.Action` / `UserButton.UserProfilePage`
APIs to open the same form at the `preferences` modal page. Server-translated copy
is passed through `AccountButton`; Clerk portals do not need an intl context.
`AccountPreferences` loads `/api/profile` only when mounted, without a cross-user
cache. A Clerk user-ID key remounts the panel on account changes; aborting pending
loads prevents late updates after closing it. The direct `/profile` route remains
available, but is not an extra main-navigation tab.
Dates use the active locale with the same explicit practice time zone on server
and client. English-learning examples remain in English in either UI language.

Run `pnpm test`, `pnpm lint`, `pnpm build` and `pnpm typecheck`. The i18n test checks
catalog parity/ICU syntax, the real profile page/form without a client intl provider,
bilingual UI, account isolation, CSRF, durable preferences
and an immutable English target without contacting a model or real database.
