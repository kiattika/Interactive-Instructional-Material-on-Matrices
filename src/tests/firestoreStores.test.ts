// Spins up a REAL Firestore emulator, runs the Firestore-backed persistence wrappers
// (server/classroomFileStore.ts, server/livePollFileStore.ts) against it end-to-end, then tears
// the emulator down. This is the one layer classroomStore.test.ts and livePollStore.test.ts
// intentionally don't cover — those test the pure in-memory logic only and are untouched by the
// Firestore migration (see FIRESTORE_MIGRATION_NOTES.md). This file is what actually proves the
// migration itself works: real transactions, real collision-retry, real Firestore semantics.
//
// Requires Java (the Firestore emulator runs on the JVM) and, on first run, network access to
// download the emulator binary. If either is unavailable, this test SKIPS with a clear message
// (exit 0) rather than failing the whole suite — see FIRESTORE_MIGRATION_NOTES.md's "manual
// verification" section for what to check by hand in an environment that can't run this.
import { spawn, ChildProcess } from 'child_process';
import net from 'net';
import type { SyncedProgress } from '../lib/classroomStore';

const EMULATOR_HOST = 'localhost';
const EMULATOR_PORT = 8080;
const STARTUP_TIMEOUT_MS = 90_000;
const PROJECT_ID = 'demo-matrixmaster';

const results = { failed: false };
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    results.failed = true;
  } else {
    console.log(`✓ PASS: ${msg}`);
  }
}

function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    function attempt() {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(attempt, 1000);
      });
    }
    attempt();
  });
}

function killEmulator(emulator: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!emulator.pid) return resolve();
    if (process.platform === 'win32') {
      // The firebase CLI -> node -> java.exe chain on Windows isn't a POSIX process group, so
      // killing just the top process leaves the JVM (the actual emulator) orphaned. `/T` kills
      // the whole descendant tree.
      const killer = spawn('taskkill', ['/pid', String(emulator.pid), '/T', '/F']);
      killer.on('exit', () => resolve());
      killer.on('error', () => resolve());
    } else {
      try {
        process.kill(-emulator.pid, 'SIGTERM');
      } catch {
        emulator.kill('SIGTERM');
      }
      resolve();
    }
  });
}

async function main() {
  console.log('='.repeat(50));
  console.log('  QA: FIRESTORE-BACKED CLASSROOM/LIVE-POLL STORES');
  console.log('='.repeat(50));

  const emulatorArgs = ['firebase', 'emulators:start', '--only', 'firestore', '--project', PROJECT_ID];
  const emulator =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/c', 'npx', ...emulatorArgs], { stdio: 'pipe' })
      : spawn('npx', emulatorArgs, { stdio: 'pipe', detached: true });

  let emulatorOutput = '';
  emulator.stdout?.on('data', (d) => (emulatorOutput += d.toString()));
  emulator.stderr?.on('data', (d) => (emulatorOutput += d.toString()));
  emulator.on('error', (err) => {
    emulatorOutput += `\n[spawn error] ${err}`;
  });

  const ready = await waitForPort(EMULATOR_HOST, EMULATOR_PORT, STARTUP_TIMEOUT_MS);
  if (!ready) {
    console.log('⚠ SKIPPED: Firestore emulator did not become ready within the timeout.');
    console.log('  This usually means Java is missing, or the emulator jar could not be');
    console.log('  downloaded (no network access). See FIRESTORE_MIGRATION_NOTES.md\'s manual');
    console.log('  verification steps to run instead.');
    console.log('  --- last emulator output ---');
    console.log(emulatorOutput.slice(-2000));
    await killEmulator(emulator);
    return;
  }
  console.log('  Firestore emulator is ready — running real assertions against it.');

  process.env.FIRESTORE_PROJECT_ID = PROJECT_ID;
  process.env.FIRESTORE_EMULATOR_HOST = `${EMULATOR_HOST}:${EMULATOR_PORT}`;

  try {
    // Dynamic import (not a static top-level import) is required here: static ESM imports are
    // evaluated before this file's own top-level code runs, which would call getFirestore()
    // (via classroomFileStore.ts's/livePollFileStore.ts's module-level `const db = ...`) before
    // FIRESTORE_EMULATOR_HOST is set above.
    const classroom = await import('../../server/classroomFileStore');
    const poll = await import('../../server/livePollFileStore');

    const blankProgress: SyncedProgress = {
      xp: 0,
      completedLessons: [],
      preTestCompleted: false,
      preTestScore: 0,
      postTestCompleted: false,
      postTestScore: 0,
      topicMastery: {
        matrixNotation: 0,
        determinant: 0,
        inverseMethod: 0,
        cramerRule: 0,
        gaussianElimination: 0,
        solutionTypes: 0
      },
      earnedBadges: []
    };

    // 1. Class lifecycle: create, sync, roster, close/reopen gating, note, listing.
    const { classCode } = await classroom.createClass('ทดสอบห้อง');
    assert(classCode.length === 6, 'createClass returns a 6-char code');
    assert(await classroom.isClassUsable(classCode), 'a freshly created class is usable');

    const syncRes = await classroom.syncStudentProgress(classCode, 'stu1', 'สมชาย', { ...blankProgress, xp: 10 });
    assert(syncRes.ok === true, 'syncStudentProgress succeeds for a real, active class');

    const roster = await classroom.fetchRoster(classCode);
    assert(
      roster !== null && roster.length === 1 && roster[0].studentId === 'stu1' && roster[0].progress.xp === 10,
      'fetchRoster reflects the just-synced student, as its own document (not a whole-roster blob)'
    );

    const badSync = await classroom.syncStudentProgress('NOPE99', 'stu1', 'x', blankProgress);
    assert(
      badSync.ok === false && (badSync as { error: string }).error === 'class_not_found',
      'syncing to a nonexistent class fails with class_not_found'
    );

    assert((await classroom.closeClass(classCode)).ok === true, 'closeClass succeeds');
    assert(!(await classroom.isClassUsable(classCode)), 'a closed class is no longer usable');
    const closedSync = await classroom.syncStudentProgress(classCode, 'stu2', 'y', blankProgress);
    assert(closedSync.ok === false, 'syncing to a closed class is rejected, exactly like a nonexistent one');

    assert((await classroom.reopenClass(classCode)).ok === true, 'reopenClass succeeds');
    assert(await classroom.isClassUsable(classCode), 'a reopened class is usable again');

    assert((await classroom.setClassNote(classCode, '  ม.5/1  ')).ok === true, 'setClassNote succeeds and trims');
    const listAfterNote = await classroom.listClasses();
    const summary = listAfterNote.find((c) => c.classCode === classCode);
    assert(
      !!summary && summary.note === 'ม.5/1' && summary.studentCount === 1,
      'listClasses reflects the trimmed note and a real student count (via count() aggregation, not a full roster read)'
    );

    assert((await classroom.setClassNote(classCode, '   ')).ok === true, 'clearing a note (blank input) still succeeds');
    const listAfterClear = await classroom.listClasses();
    assert(
      listAfterClear.find((c) => c.classCode === classCode)?.note === undefined,
      'a blank note removes the field entirely, not just sets it to an empty string'
    );

    assert((await classroom.removeStudent(classCode, 'stu1')).ok === true, 'removeStudent succeeds');
    const rosterAfterRemove = await classroom.fetchRoster(classCode);
    assert(rosterAfterRemove !== null && rosterAfterRemove.length === 0, 'removed student is gone from the roster');
    assert(
      (await classroom.removeStudent(classCode, 'stu1')).ok === true,
      'removing an already-absent student is an idempotent success, not an error'
    );

    // 2. Live poll lifecycle: create, answer, results (no answer-key leak), close with correct
    // tallying, reject-after-close, pending-award pull-and-acknowledge handshake.
    const { pollId } = await poll.createPoll(classCode, 'det(A) เท่ากับเท่าใด?', ['1', '2', '3'], '2');
    assert(!!pollId, 'createPoll returns a pollId');

    assert((await poll.submitAnswer(pollId, 'stu1', 'สมชาย', '2')).ok === true, 'submitAnswer succeeds while the poll is open');

    const liveResults = await poll.fetchResults(pollId);
    assert(
      !!liveResults && liveResults.totalAnswers === 1 && liveResults.voteCounts['2'] === 1,
      'fetchResults tallies the submitted answer correctly'
    );
    assert(!('correctAnswer' in (liveResults as object)), 'fetchResults never leaks correctAnswer to pollers');

    const closeResult = await poll.closePoll(pollId);
    assert(closeResult.ok === true, 'closePoll succeeds');
    if (closeResult.ok) {
      assert(closeResult.summary.correctStudentIds.includes('stu1'), 'closePoll correctly identifies the correct student');
    }

    const afterCloseAnswer = await poll.submitAnswer(pollId, 'stu2', 'ครู', '1');
    assert(
      afterCloseAnswer.ok === false && (afterCloseAnswer as { error: string }).error === 'poll_closed',
      'submitAnswer after close is rejected as poll_closed, not silently accepted (the exact race the old file-lock queue guarded against)'
    );

    const pending = await poll.fetchPendingAwards(classCode, 'stu1');
    assert(pending.length === 1 && pending[0].pollId === pollId, 'the correct student sees exactly one pending award');

    assert((await poll.acknowledgePoll(pollId, 'stu1')).ok === true, 'acknowledgePoll succeeds');
    const pendingAfterAck = await poll.fetchPendingAwards(classCode, 'stu1');
    assert(pendingAfterAck.length === 0, 'the award is no longer pending after acknowledging (never granted twice)');
    assert((await poll.acknowledgePoll(pollId, 'stu1')).ok === true, 're-acknowledging an already-acknowledged poll is idempotent');
  } catch (err) {
    console.error('❌ FAIL: unexpected error while exercising the Firestore-backed stores:', err);
    results.failed = true;
  } finally {
    await killEmulator(emulator);
  }

  if (results.failed) {
    console.error('\n' + '='.repeat(50));
    console.error('  FIRESTORE STORE QA FAILED — SEE ❌ ABOVE');
    console.error('='.repeat(50));
    process.exit(1);
  } else {
    console.log('\n' + '='.repeat(50));
    console.log('  ALL FIRESTORE STORE QA TESTS PASSED!');
    console.log('='.repeat(50));
  }
}

main();
