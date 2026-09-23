import React from 'react';
import { Gauge, Info } from 'lucide-react';
import type { EfficiencyStats } from '../lib/efficiencyStats';

interface EfficiencyStatsPanelProps {
  stats: EfficiencyStats | null; // null while loading
  scopeLabel: string;
  error?: string | null;
}

const NOT_ENOUGH = 'ยังไม่มีข้อมูลเพียงพอ';

interface FigureCardProps {
  abbr: string;
  thaiName: string;
  englishName: string;
  value: string | null;
  n: number;
  nLabel: string;
  explanation: string;
  emptyReason?: string;
  footnote?: string;
}

const FigureCard: React.FC<FigureCardProps> = ({ abbr, thaiName, englishName, value, n, nLabel, explanation, emptyReason, footnote }) => (
  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
    <div className="flex items-baseline justify-between gap-2 flex-wrap">
      <p className="text-sm font-extrabold text-slate-800">
        {abbr} <span className="text-xs font-bold text-slate-500">· {thaiName}</span>
      </p>
      <span className="text-[11px] font-bold text-slate-400">{englishName}</span>
    </div>
    {value === null ? (
      <div>
        <p className="text-lg font-black text-slate-400">{NOT_ENOUGH}</p>
        {emptyReason && <p className="text-[11px] text-slate-500">{emptyReason}</p>}
      </div>
    ) : (
      <p className="text-3xl font-black text-indigo-700">{value}</p>
    )}
    <p className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1 w-fit">
      n = {n} <span className="font-medium text-slate-500">({nLabel})</span>
    </p>
    {footnote && <p className="text-[11px] text-slate-600">{footnote}</p>}
    <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1">
      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" /> {explanation}
    </p>
  </div>
);

// E1 / E2 / E.I. for TeacherAnalytics — see lib/efficiencyStats.ts for the exact formulas.
export const EfficiencyStatsPanel: React.FC<EfficiencyStatsPanelProps> = ({ stats, scopeLabel, error }) => {
  const ei = stats?.ei;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-600" /> ประสิทธิภาพและดัชนีประสิทธิผลของสื่อ (E1/E2, E.I.)
          <span className="text-xs font-bold text-indigo-500">— {scopeLabel}</span>
        </h3>
        {stats && <span className="text-xs font-bold text-slate-500">นักเรียนในขอบเขตนี้ทั้งหมด {stats.totalStudents} คน</span>}
      </div>

      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      {!stats && !error && <p className="text-xs text-slate-400">กำลังคำนวณจากข้อมูลนักเรียน...</p>}

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FigureCard
              abbr="E1"
              thaiName="ประสิทธิภาพกระบวนการ"
              englishName="Process Efficiency"
              value={stats.e1.value === null ? null : `${stats.e1.value.toFixed(2)}%`}
              n={stats.e1.n}
              nLabel="นักเรียนที่มีคะแนนบทเรียนอย่างน้อย 1 บท"
              emptyReason="ยังไม่มีนักเรียนที่เรียนจบบทเรียนพร้อมคะแนนคำถามท้ายบท"
              explanation="คะแนนระหว่างเรียน: เฉลี่ยคะแนนคำถามท้ายบทของแต่ละบทที่นักเรียนเรียนจบ (ถูกครั้งแรก = 1, ถูกครั้งที่ 2 = 0.5, ดูเฉลย = 0) เป็นค่าเฉลี่ยรายคน แล้วเฉลี่ยทุกคนอีกครั้ง"
            />
            <FigureCard
              abbr="E2"
              thaiName="ประสิทธิภาพผลลัพธ์"
              englishName="Outcome Efficiency"
              value={stats.e2.value === null ? null : `${stats.e2.value.toFixed(2)}%`}
              n={stats.e2.n}
              nLabel="นักเรียนที่ทำ Post-Test แล้ว"
              emptyReason="ยังไม่มีนักเรียนทำแบบทดสอบหลังเรียน"
              explanation="คะแนนเฉลี่ยของแบบทดสอบหลังเรียน (Post-Test) ของนักเรียนทุกคนที่ทำแล้ว"
            />
            <FigureCard
              abbr="E.I."
              thaiName="ดัชนีประสิทธิผล"
              englishName="Effectiveness Index"
              value={ei && ei.value !== null ? ei.value.toFixed(4) : null}
              n={ei ? ei.n : 0}
              nLabel="นักเรียนที่ทำครบทั้ง Pre-Test และ Post-Test"
              emptyReason={
                ei?.preAtCeiling
                  ? 'คำนวณไม่ได้: คะแนน Pre-Test เฉลี่ยเต็ม 100 ทำให้ตัวหาร (100 − ค่าเฉลี่ยก่อนเรียน) เป็น 0'
                  : 'ยังไม่มีนักเรียนที่ทำครบทั้งก่อนและหลังเรียน'
              }
              footnote={
                ei && ei.value !== null && ei.meanPre !== null && ei.meanPost !== null
                  ? `ผู้เรียนมีความก้าวหน้าเพิ่มขึ้นร้อยละ ${(ei.value * 100).toFixed(2)} (เฉลี่ยก่อนเรียน ${ei.meanPre.toFixed(2)}%, หลังเรียน ${ei.meanPost.toFixed(2)}%)`
                  : undefined
              }
              explanation="E.I. = (เฉลี่ยหลังเรียน − เฉลี่ยก่อนเรียน) ÷ (100 − เฉลี่ยก่อนเรียน) คิดเฉพาะนักเรียนที่มีคะแนนครบทั้งสองครั้ง ค่าอยู่ระหว่าง 0 ถึง 1 (ค่าลบหมายถึงหลังเรียนต่ำกว่าก่อนเรียน)"
            />
          </div>
          {stats.e1.value !== null && stats.e2.value !== null && (
            <p className="text-sm font-bold text-slate-700">
              E1/E2 = {stats.e1.value.toFixed(2)}/{stats.e2.value.toFixed(2)}
            </p>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            แต่ละค่าคำนวณจากกลุ่มนักเรียนคนละกลุ่ม (ดู n ของแต่ละค่า) ค่าที่แสดงปัดทศนิยมเฉพาะตอนแสดงผล การคำนวณใช้ค่าจริงทั้งหมด ·
            E1 นับเฉพาะบทเรียนที่เรียนจบหลังเริ่มบันทึกคะแนนคำถามท้ายบท บทที่เรียนจบก่อนหน้านั้นไม่มีคะแนนจึงไม่ถูกนับ
          </p>
        </>
      )}
    </div>
  );
};
