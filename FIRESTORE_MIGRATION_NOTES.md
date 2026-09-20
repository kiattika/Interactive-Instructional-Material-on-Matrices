# Firestore Migration Notes

## Why this migration happened

The classroom-sync and live-poll features (`server/classroomFileStore.ts`,
`server/livePollFileStore.ts`) used to persist to JSON files on local disk
(`data/classroom.json`, `data/live-polls.json`). That's unsafe on Cloud Run: the default
writable filesystem there is memory-backed, **not shared across instances**, and **not
persisted** across restarts, redeploys, or scale-up. Concretely, any of the following used to
silently lose classroom/live-poll data:

- Publishing a new revision (fresh filesystem, old data gone).
- An instance cold-starting after inactivity (same thing).
- Cloud Run scaling to more than one instance under concurrent load — each instance has its own
  separate filesystem, so two students hitting different instances during the same Live Quiz
  wouldn't see each other's answers at all.

Both stores are now backed by Firestore instead. `src/lib/classroomStore.ts` and
`src/lib/livePollStore.ts` (the pure, no-I/O logic layer, unit-tested in
`src/tests/classroomStore.test.ts` / `src/tests/livePollStore.test.ts`) were **not touched** —
those tests still exercise the same in-memory logic, unchanged. Only the wrapper layer's
internals changed; `server.ts`'s route handlers didn't need to change at all, since the wrapper
functions kept the same names/signatures.

## Schema

```
classes/{classCode}                            — classCode, createdAt, active, note?
classes/{classCode}/students/{studentId}       — StudentRecord (one doc per roster entry)

livePolls/{pollId}                             — pollId, classCode, question, options,
                                                  correctAnswer, status, createdAt, closedAt?
livePolls/{pollId}/answers/{studentId}         — displayName, selectedOption, answeredAt
livePolls/{pollId}/acknowledgedAwards/{studentId} — acknowledgedAt (marker doc; existence = ack'd)
```

The key design point carried over from the old file-lock queue: avoid whole-document
read-modify-write races. Syncing one student's progress, or one student's poll answer, is now a
single atomic document write to that student's own doc — never a read-modify-write of the whole
roster/poll. Firestore transactions are used exactly where the pure logic used to depend on
read-then-write consistency:

- `syncStudentProgress` — transactionally checks the class is still active before writing the
  student doc, so a concurrent `closeClass` can't race a student's sync into succeeding anyway.
- `submitAnswer` / `closePoll` — both transactionally touch the same poll document, so Firestore
  serializes them: a student can't get "answer accepted" from a poll the teacher is
  simultaneously closing, and `closePoll`'s correctness tally sees a stable answers snapshot.

## A real bug this migration surfaced (and fixed)

`server/classroomFileStore.ts` and `server/livePollFileStore.ts` originally called
`getFirestore()` once at **module top level** (`const db = getFirestore();`). That's wrong: ES
module imports are evaluated before the importing module's own top-level code runs, so
`server.ts`'s own top-level `dotenv.config()` call (which loads `FIRESTORE_EMULATOR_HOST`/
`FIRESTORE_PROJECT_ID` from `.env`) hadn't run yet by the time `getFirestore()` first fired —
the Firestore client would try to auto-detect a project ID with nothing in the environment yet,
and every classroom/live-poll route would fail with "Unable to detect a Project Id". Fixed by
calling `getFirestore()` lazily inside each function instead of once at module scope. Caught via
the manual `npm run dev` + curl verification below — the emulator-backed test file didn't catch
it, because that file's own dynamic `import()` of the wrapper modules happens to already be
positioned after its env vars are set, which the real `server.ts` entry point isn't. Worth
remembering if either file is refactored again.

## Local development: the Firestore emulator

Local dev now needs a Firestore emulator running (previously, classroom features worked with
zero setup — this is a genuinely new local-dev requirement).

**One-time setup:** nothing to install globally — `firebase-tools` is already a devDependency.
The emulator itself (a JVM-based binary) is downloaded automatically the first time you run it,
which needs Java 11+ on your machine and a working internet connection for that first download.

**Every time you want classroom/live-poll features to work locally:**

```powershell
# Terminal 1 — leave this running
npm run emulators

# Terminal 2
npm run dev
```

`npm run emulators` runs `firebase emulators:start --only firestore --project demo-matrixmaster`.
The `demo-` project id prefix is a Firebase emulator convention meaning "never touch real GCP" —
no login, no billing, no real Firebase project needed at all for local dev.

Set these two vars in your `.env` (see `.env.example`) so `npm run dev` actually talks to the
emulator instead of trying (and failing) to reach real Firestore:

```
FIRESTORE_PROJECT_ID="demo-matrixmaster"
FIRESTORE_EMULATOR_HOST="localhost:8080"
```

Leave both unset in production/Cloud Run — the Firestore client auto-detects the real project
and credentials from Cloud Run's own attached service account (Application Default Credentials).

Config files added for the emulator: `firebase.json` (declares the Firestore emulator on port
8080 + emulator UI on port 4000), `.firebaserc` (default project `demo-matrixmaster`),
`firestore.rules` (deny-all — this app's Express server is the only Firestore reader/writer,
using Admin-level credentials that bypass rules entirely either way; the deny-all is just a
safety net).

The old `data/classroom.json` / `data/live-polls.json` files (and the `data/` directory) are now
unused leftovers from before this migration — safe to delete locally.

## Testing

- `src/tests/classroomStore.test.ts` / `src/tests/livePollStore.test.ts` — **unchanged**, still
  test the pure in-memory logic directly. Not affected by this migration at all.
- `src/tests/firestoreStores.test.ts` — **new**. This is what actually proves the Firestore
  migration works: it spawns a real Firestore emulator as a child process, waits for it to be
  ready, runs the Firestore-backed wrapper functions (`classroomFileStore.ts`,
  `livePollFileStore.ts`) against it — full class lifecycle, roster, close/reopen gating, note
  clearing, student removal, poll lifecycle, answer-after-close rejection, and the
  pending-award/acknowledge handshake — then tears the emulator down. Runs via
  `npx tsx src/tests/firestoreStores.test.ts` like every other test file in this project.
  - Requires Java (the emulator is JVM-based) and, on first run, network access to download the
    emulator binary. If either is unavailable, this test **skips with a clear console message**
    (exit code 0) instead of failing the suite.
  - **Verified passing in this environment**: all 27 assertions pass against a real emulator
    instance, spawned and torn down cleanly (confirmed no orphaned Java process afterward).

### Manual end-to-end verification also performed (beyond the automated test)

The automated emulator test proves the wrapper functions work correctly against Firestore, but
doesn't by itself prove the actual production bug is fixed (data surviving process boundaries).
This was additionally verified by hand during this migration:

1. Started the Firestore emulator (`npm run emulators`) and the real dev server (`npm run dev`)
   pointed at it.
2. `POST /api/classroom` → created a real class code via the running server.
3. `POST /api/classroom/:code/sync` → synced a student's progress via the running server.
4. Read that student back via a **completely separate Node process** (not the running server —
   simulating a second Cloud Run instance) calling `fetchRoster` directly against the same
   emulator: **the second process saw the data the first process wrote.** This is the exact
   failure mode the migration fixes — two different instances now share data, instead of each
   having its own isolated filesystem.
5. Killed and restarted the dev server process entirely, then re-fetched the same class's
   roster via `GET /api/classroom/:code/roster`: **the data survived the restart** — the exact
   "publishing a new revision" / "cold start" failure mode from the bug report.

**If you want to re-verify this by hand yourself** (e.g. after further changes to these files):
start the emulator + dev server, create a classroom in one browser tab, join it from a second
browser tab (or `curl`) with a different name, confirm the teacher's roster (Analytics or
Settings page) shows both students, then restart `npm run dev` (Ctrl+C, run it again) and
confirm the classroom code still works and the roster is unchanged.

## Open question for the teacher — not resolved in code

Google's docs describe AI Studio as able to auto-provision Firestore when it generates an app
**natively via its own chat interface**. It's genuinely unclear whether that same
auto-provisioning triggers for an app that was developed externally (this Claude Code + local
PowerShell workflow) and then brought into AI Studio via "Import from GitHub" — this may
instead need you to manually create a Firestore database and grant the Cloud Run service
account access to it via Google Cloud Console at deploy time. `metadata.json` has a
`majorCapabilities` field (currently just `["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`) that
looks like the kind of flag that might control auto-provisioning for a capability like this, but
there's no documentation available here confirming whether a Firestore-equivalent flag exists or
what it would be called — this needs checking against AI Studio's own current docs/UI at deploy
time, or a support question to Google, rather than guessing. If it turns out manual provisioning
is needed: create a Firestore database (Native mode) in the same GCP project as the Cloud Run
service, and grant that service's runtime service account the `roles/datastore.user` IAM role
(or equivalent) so it can read/write it.
