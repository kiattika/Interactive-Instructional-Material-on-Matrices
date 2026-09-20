// Node-only persistence for the live-poll feature: wraps the pure logic in
// src/lib/livePollStore.ts with a JSON file on disk — same pattern as classroomFileStore.ts
// (a handful of open polls at a time, not a scale where JSON I/O matters).
import { promises as fs } from 'fs';
import path from 'path';
import {
  LivePollDB,
  LivePoll,
  PollResults,
  PollCloseSummary,
  createEmptyDB,
  createPoll as createPollPure,
  submitAnswer as submitAnswerPure,
  getResults as getResultsPure,
  closePoll as closePollPure,
  getPendingAwardsForStudent as getPendingAwardsPure,
  acknowledgePoll as acknowledgePollPure
} from '../src/lib/livePollStore';

const DB_PATH = path.join(process.cwd(), 'data', 'live-polls.json');

// Same write-queue/lock pattern as classroomFileStore.ts — serializes every read-modify-write
// so concurrent requests (many students answering at once) never interleave and drop an update.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function readDB(): Promise<LivePollDB> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(raw) as LivePollDB;
  } catch {
    return createEmptyDB();
  }
}

async function writeDB(db: LivePollDB): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  await fs.rename(tmpPath, DB_PATH);
}

export function createPoll(
  classCode: string,
  question: string,
  options: string[],
  correctAnswer: string
): Promise<{ pollId: string }> {
  return withLock(async () => {
    const db = await readDB();
    const { db: nextDB, pollId } = createPollPure(db, classCode, question, options, correctAnswer);
    await writeDB(nextDB);
    return { pollId };
  });
}

export function submitAnswer(
  pollId: string,
  studentId: string,
  displayName: string,
  selectedOption: string
): Promise<{ ok: true } | { ok: false; error: 'poll_not_found' | 'poll_closed' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = submitAnswerPure(db, pollId, studentId, displayName, selectedOption);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true };
  });
}

export async function fetchResults(pollId: string): Promise<PollResults | null> {
  const db = await readDB();
  return getResultsPure(db, pollId);
}

export function closePoll(
  pollId: string
): Promise<{ ok: true; summary: PollCloseSummary } | { ok: false; error: 'poll_not_found' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = closePollPure(db, pollId);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true, summary: result.summary };
  });
}

export async function fetchPendingAwards(classCode: string, studentId: string): Promise<LivePoll[]> {
  const db = await readDB();
  return getPendingAwardsPure(db, classCode, studentId);
}

export function acknowledgePoll(
  pollId: string,
  studentId: string
): Promise<{ ok: true } | { ok: false; error: 'poll_not_found' }> {
  return withLock(async () => {
    const db = await readDB();
    const result = acknowledgePollPure(db, pollId, studentId);
    if (!result.ok) return result;
    await writeDB(result.db);
    return { ok: true };
  });
}
