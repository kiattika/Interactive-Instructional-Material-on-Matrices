import React, { useState } from 'react';
import { ClipboardList, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import {
  SURVEY_SECTIONS,
  SURVEY_QUESTION_IDS,
  SURVEY_COMMENT_MAX_LENGTH,
  LIKERT_LABELS,
  LikertScore,
  SurveyQuestionId
} from '../lib/surveyStore';
import { submitSurvey } from '../lib/surveyClient';

interface SatisfactionSurveyProps {
  classCode: string;
  // Called once the student submits or skips — the parent records the local "don't re-prompt"
  // flag (StudentProgress.hasCompletedSurvey). Never receives or sends any survey answers.
  onResolved: (outcome: 'submitted' | 'dismissed') => void;
}

const SCORES: LikertScore[] = [1, 2, 3, 4, 5];

// Anonymous post-course satisfaction survey (แบบประเมินความพึงพอใจ), offered after the Post-Test.
// Skippable: starts as a small invite card and only expands into the form on request.
export const SatisfactionSurvey: React.FC<SatisfactionSurveyProps> = ({ classCode, onResolved }) => {
  const [stage, setStage] = useState<'invite' | 'form' | 'done'>('invite');
  const [answers, setAnswers] = useState<Partial<Record<SurveyQuestionId, LikertScore>>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = SURVEY_QUESTION_IDS.filter((id) => answers[id] !== undefined).length;
  const allAnswered = answeredCount === SURVEY_QUESTION_IDS.length;

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await submitSurvey(classCode, answers as Record<SurveyQuestionId, LikertScore>, comment);
    setSubmitting(false);
    if (result.ok) {
      setStage('done');
      onResolved('submitted');
    } else {
      setError(result.error || 'ไม่สามารถส่งแบบประเมินได้ ลองใหม่อีกครั้ง');
    }
  }

  if (stage === 'done') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-left flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-bold text-emerald-800">ขอบคุณที่ช่วยประเมินครับ! ความคิดเห็นของคุณช่วยให้ครูพัฒนาสื่อการสอนนี้ต่อไป</p>
      </div>
    );
  }

  if (stage === 'invite') {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 text-left space-y-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-extrabold text-indigo-900">ช่วยประเมินความพึงพอใจสื่อการสอนนี้หน่อยนะครับ</p>
            <p className="text-xs text-indigo-700 mt-0.5">11 ข้อ ใช้เวลาประมาณ 2 นาที — ไม่ระบุตัวตน</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStage('form')}
            className="px-4 py-2 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm sm:text-xs font-bold transition-colors"
          >
            ทำแบบประเมิน
          </button>
          <button
            onClick={() => onResolved('dismissed')}
            className="px-4 py-2 min-h-11 sm:min-h-0 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 rounded-xl text-sm sm:text-xs font-bold transition-colors"
          >
            ข้าม
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 text-left space-y-5 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" /> แบบประเมินความพึงพอใจ
        </h3>
        <p className="text-xs text-slate-600 flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            แบบประเมินนี้ <strong>ไม่เก็บชื่อหรือรหัสนักเรียน</strong> ครูจะเห็นเฉพาะค่าเฉลี่ยรวมและข้อเสนอแนะโดยไม่ระบุตัวตน
            ตอบตามความรู้สึกจริงได้เลย
          </span>
        </p>
        <p className="text-xs text-slate-500">
          ระดับความคิดเห็น: {SCORES.map((s) => `${s} = ${LIKERT_LABELS[s]}`).join(', ')}
        </p>
      </div>

      {SURVEY_SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3">
          <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide">{section.title}</p>
          {section.questions.map((q) => {
            const selected = answers[q.id];
            const number = SURVEY_QUESTION_IDS.indexOf(q.id) + 1;
            return (
              <fieldset key={q.id} className="space-y-2">
                <legend className="text-sm text-slate-800 font-medium">
                  {number}. {q.text}
                </legend>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 max-w-md">
                  {SCORES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: s }))}
                      aria-label={`${s} ${LIKERT_LABELS[s]}`}
                      aria-pressed={selected === s}
                      className={`min-h-11 rounded-xl border text-base sm:text-sm font-black transition-colors ${
                        selected === s
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 h-4">{selected ? LIKERT_LABELS[selected] : ''}</p>
              </fieldset>
            );
          })}
        </div>
      ))}

      <div className="space-y-2">
        <label htmlFor="survey-comment" className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide">
          ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)
        </label>
        <textarea
          id="survey-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={SURVEY_COMMENT_MAX_LENGTH}
          rows={3}
          placeholder="อยากให้ปรับปรุงหรือเพิ่มอะไร เขียนได้เลย (ไม่ต้องใส่ชื่อ)"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-base sm:text-sm focus:outline-none focus:border-indigo-400"
        />
      </div>

      {error && <p className="text-sm sm:text-xs font-bold text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="px-5 py-2.5 min-h-11 sm:min-h-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm sm:text-xs font-bold transition-colors flex items-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />} ส่งแบบประเมิน
        </button>
        <span className="text-xs text-slate-500">
          ตอบแล้ว {answeredCount} / {SURVEY_QUESTION_IDS.length} ข้อ
        </span>
        <button
          onClick={() => onResolved('dismissed')}
          className="ml-auto min-h-11 sm:min-h-0 text-xs font-bold text-slate-400 hover:text-slate-600 underline"
        >
          ข้ามแบบประเมิน
        </button>
      </div>
    </div>
  );
};
