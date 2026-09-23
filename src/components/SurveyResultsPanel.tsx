import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList, RefreshCw, ShieldCheck, MessageSquare } from 'lucide-react';
import { SURVEY_SECTIONS, SURVEY_QUESTION_IDS, SurveyAggregate, SurveyQuestionStat, interpretLikertMean } from '../lib/surveyStore';
import { fetchSurveyResults } from '../lib/surveyClient';
import { cn } from '../lib/utils';

interface SurveyResultsPanelProps {
  classCode: string | null; // null = all classrooms combined
  scopeLabel: string;
}

// Below this many responses the averages are too noisy to lean on (and, with anonymous data,
// the only reliability signal available is n itself — shown prominently at the top).
const LOW_N_THRESHOLD = 5;

// Teacher-facing aggregate of the anonymous satisfaction survey. Only ever receives averages,
// SDs, n and comment text from the server — never individual responses (see surveyStore.ts).
export const SurveyResultsPanel: React.FC<SurveyResultsPanelProps> = ({ classCode, scopeLabel }) => {
  const [data, setData] = useState<SurveyAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may update the panel: switching scope quickly (or the page setting
  // its default class right after mount) must never let an older scope's response land last and
  // show one scope's numbers under another scope's label.
  const latestRequest = useRef(0);

  async function refresh() {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    const result = await fetchSurveyResults(classCode);
    if (requestId !== latestRequest.current) return;
    setLoading(false);
    if (result) setData(result);
    else setError('ไม่สามารถดึงผลแบบประเมินได้ ลองรีเฟรชอีกครั้ง');
  }

  useEffect(() => {
    setData(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode]);

  const statById = new Map<string, SurveyQuestionStat>((data?.questions || []).map((q) => [q.id, q] as [string, SurveyQuestionStat]));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" /> ผลแบบประเมินความพึงพอใจ
          <span className="text-xs font-bold text-indigo-500">— {scopeLabel}</span>
        </h3>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> รีเฟรช
        </button>
      </div>

      <p className="text-xs text-slate-500 flex items-start gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        ไม่ระบุตัวตน: ระบบไม่เก็บชื่อหรือรหัสนักเรียนในแบบประเมิน จึงแสดงได้เฉพาะค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน และจำนวนผู้ตอบ (n)
      </p>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      {!data && loading && <p className="text-xs text-slate-400">กำลังโหลดผลแบบประเมิน...</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">จำนวนผู้ตอบ</p>
              <p className="text-3xl font-black text-indigo-600">n = {data.n}</p>
            </div>
            {data.n > 0 && data.n < LOW_N_THRESHOLD && (
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ผู้ตอบยังน้อย (น้อยกว่า {LOW_N_THRESHOLD} คน) — ค่าเฉลี่ยอาจยังไม่สะท้อนภาพรวม
              </p>
            )}
          </div>

          {data.n === 0 ? (
            <p className="text-xs text-slate-500">ยังไม่มีผู้ตอบแบบประเมินในขอบเขตนี้</p>
          ) : (
            <div className="space-y-4">
              {SURVEY_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-2">
                  <p className="text-xs font-extrabold text-indigo-700">{section.title}</p>
                  {section.questions.map((q) => {
                    const stat = statById.get(q.id);
                    const mean = stat?.mean ?? null;
                    return (
                      <div key={q.id} className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-1 items-center text-xs">
                        <p className="md:col-span-7 text-slate-700">
                          {SURVEY_QUESTION_IDS.indexOf(q.id) + 1}. {q.text}
                        </p>
                        <div className="md:col-span-5 flex items-center gap-2">
                          <div className="flex-grow h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: mean === null ? '0%' : `${((mean - 1) / 4) * 100}%` }}
                            />
                          </div>
                          <span className="font-black text-slate-800 w-10 text-right">{mean === null ? '—' : mean.toFixed(2)}</span>
                          <span className="text-slate-400 w-16 text-right">
                            S.D. {stat?.sd === null || stat?.sd === undefined ? '—' : stat.sd.toFixed(2)}
                          </span>
                          <span className="text-slate-500 w-16 text-right">{mean === null ? '' : interpretLikertMean(mean)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <p className="text-[11px] text-slate-400">
                คะแนน 1-5 (1 = น้อยที่สุด, 5 = มากที่สุด) · เกณฑ์แปลผล: 4.51-5.00 มากที่สุด, 3.51-4.50 มาก, 2.51-3.50 ปานกลาง,
                1.51-2.50 น้อย, 1.00-1.50 น้อยที่สุด
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600" /> ข้อเสนอแนะเพิ่มเติม ({data.comments.length})
            </p>
            {data.comments.length === 0 ? (
              <p className="text-xs text-slate-400">ยังไม่มีข้อเสนอแนะ</p>
            ) : (
              <ul className="space-y-1.5">
                {data.comments.map((c, i) => (
                  <li key={i} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 whitespace-pre-line">
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
