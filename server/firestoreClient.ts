// Shared Firestore client for server/classroomFileStore.ts and server/livePollFileStore.ts —
// both used to persist to a JSON file on local disk, which is unsafe on Cloud Run (the default
// writable filesystem is memory-backed, per-instance, and not persisted across restarts/
// redeploys/scaling). See FIRESTORE_MIGRATION_NOTES.md for the full migration rationale.
import { Firestore } from '@google-cloud/firestore';

let firestoreInstance: Firestore | undefined;

// FIRESTORE_EMULATOR_HOST, when set, is picked up automatically by the underlying gRPC client —
// this is the same environment variable every @google-cloud/* client library and firebase-admin
// recognize, so no manual branching is needed here. Set it (plus FIRESTORE_PROJECT_ID) to point
// local development at `firebase emulators:start --only firestore` instead of real Firestore —
// see FIRESTORE_MIGRATION_NOTES.md for the one-time setup.
//
// In production (Cloud Run), leave both unset: the client auto-detects the project and
// credentials from the service's own attached service account (Application Default
// Credentials) — no code path here needs to know it's running in production vs. locally.
export function getFirestore(): Firestore {
  if (!firestoreInstance) {
    const projectId = process.env.FIRESTORE_PROJECT_ID;
    firestoreInstance = projectId ? new Firestore({ projectId }) : new Firestore();
  }
  return firestoreInstance;
}
