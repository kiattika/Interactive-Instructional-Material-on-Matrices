import React, { useState } from 'react';
import { Wand2, Trash2 } from 'lucide-react';
import { TOPIC_LABELS, TopicKey } from '../lib/topics';
import type { StudentRecord } from '../lib/classroomStore';
import { RenderTextWithMath } from './math/MathComponents';

interface StudentRosterRowProps {
  student: StudentRecord;
  masteryThreshold: number;
  classCode: string;
  // Only supplied where removal makes sense (TeacherSettingsPage's expandable roster) — omit
  // to hide the remove control entirely, e.g. from TeacherAnalytics.tsx's read-focused view.
  onRemove?: (studentId: string) => void;
}

// Shared by TeacherAnalytics.tsx (whole-classroom overview) and TeacherSettingsPage.tsx (the
// expandable per-class roster) so both surfaces render the same student summary and the same
// AI-remediation trigger, rather than two subtly different implementations drifting apart.
// Typed as React.FC (matching MathComponents.tsx's convention) rather than a plain function —
// this project has no @types/react installed, so a plain function component's props interface
// gets checked against raw JSX attributes including `key`, which fails to type-check.
export const StudentRosterRow: React.FC<StudentRosterRowProps> = ({ student, masteryThreshold, classCode, onRemove }) => {
  const [aiTopic, setAiTopic] = useState<TopicKey | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  const weakTopics = (Object.keys(TOPIC_LABELS) as TopicKey[]).filter(
    (k) => student.progress.topicMastery[k] < masteryThreshold
  );

  async function handleGenerateProblem(topic: TopicKey) {
    setAiTopic(topic);
    setAiLoading(true);
    setAiText('');
    try {
      const res = await fetch('/api/ai-practice-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, classCode, studentId: student.studentId })
      });
      const data = await res.json();
      setAiText(data.problemText || 'ขออภัยครับ ไม่สามารถสร้างโจทย์ได้ในขณะนี้');
    } catch {
      setAiText('เกิดข้อผิดพลาดในการเชื่อมต่อ AI โปรดลองใหม่อีกครั้ง');
    } finally {
      setAiLoading(false);
    }
  }

  function handleRemove() {
    if (!onRemove) return;
    if (window.confirm(`ลบ "${student.displayName}" ออกจากห้องเรียนนี้?\n(ถ้ายังมีรหัสห้องอยู่ นักเรียนคนนี้ sync เข้ามาใหม่ได้ตามปกติ — นี่ไม่ใช่การแบน)`)) {
      onRemove(student.studentId);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="font-bold text-slate-800 text-sm">{student.displayName}</span>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 flex-wrap">
          <span>{student.progress.xp} XP</span>
          <span>{student.progress.completedLessons.length} บทเรียน</span>
          <span>Pre {student.progress.preTestCompleted ? `${student.progress.preTestScore}%` : '—'}</span>
          <span>Post {student.progress.postTestCompleted ? `${student.progress.postTestScore}%` : '—'}</span>
          <span>{student.progress.earnedBadges.length} Badges</span>
          {onRemove && (
            <button
              onClick={handleRemove}
              className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700"
              title="ลบนักเรียนออกจากห้อง"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบ
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400">
        อัปเดตล่าสุด: {new Date(student.lastSyncedAt).toLocaleString('th-TH')}
      </p>

      {weakTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {weakTopics.map((t) => (
            <button
              key={t}
              onClick={() => handleGenerateProblem(t)}
              disabled={aiLoading && aiTopic === t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 transition-colors disabled:opacity-60"
            >
              <Wand2 className="w-3 h-3" />
              {TOPIC_LABELS[t]} ({student.progress.topicMastery[t]}%)
            </button>
          ))}
        </div>
      )}

      {aiTopic && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
          {aiLoading ? (
            <span className="text-slate-400">กำลังแต่งโจทย์สำหรับนักเรียนคนนี้...</span>
          ) : (
            <RenderTextWithMath text={aiText} />
          )}
        </div>
      )}
    </div>
  );
};
