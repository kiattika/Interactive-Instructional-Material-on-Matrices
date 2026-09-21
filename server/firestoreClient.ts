// Shared Firestore client for server/classroomFileStore.ts and server/livePollFileStore.ts —
// both used to persist to a JSON file on local disk, which is unsafe on Cloud Run (the default
// writable filesystem is memory-backed, per-instance, and not persisted across restarts/
// redeploys/scaling). See FIRESTORE_MIGRATION_NOTES.md for the full migration rationale.
import { Firestore, Settings } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | undefined;

// Loads applet config if present (generated during Firebase provisioning in AI Studio).
function loadAppletConfig(): { projectId?: string; firestoreDatabaseId?: string } {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Ignore if not present or cannot be parsed
  }
  return {};
}

// FIRESTORE_EMULATOR_HOST, when set, is picked up automatically by the underlying gRPC client —
// this is the same environment variable every @google-cloud/* client library and firebase-admin
// recognize, so no manual branching is needed here. Set it (plus FIRESTORE_PROJECT_ID) to point
// local development at `firebase emulators:start --only firestore` instead of real Firestore —
// see FIRESTORE_MIGRATION_NOTES.md for the one-time setup.
//
// In production / Cloud Run / AI Studio:
// The client reads projectId and named firestoreDatabaseId from firebase-applet-config.json
// or environment variables, with fallback to Application Default Credentials.
export function getFirestore(): Firestore {
  if (!firestoreInstance) {
    const config = loadAppletConfig();
    const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
    const options: Settings = {};

    const projectId = process.env.FIRESTORE_PROJECT_ID || config.projectId;
    if (projectId) {
      options.projectId = projectId;
    }

    const databaseId =
      process.env.FIRESTORE_DATABASE_ID ||
      (!isEmulator && config.firestoreDatabaseId ? config.firestoreDatabaseId : undefined);

    if (databaseId && databaseId !== '(default)') {
      options.databaseId = databaseId;
    }

    firestoreInstance = new Firestore(options);
  }
  return firestoreInstance;
}
