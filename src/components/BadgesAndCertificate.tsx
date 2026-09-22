import { useState } from 'react';
import { Award, CheckCircle2, Download, Printer, Shield, Sparkles, X } from 'lucide-react';
import { StudentProgress, CURRICULUM_LESSONS } from '../lib/learningStore';

export interface BadgeInfo {
  id: string;
  name: string;
  thaiName: string;
  description: string;
  icon: string;
  category: string;
}

export const ALL_BADGES: BadgeInfo[] = [
  {
    id: 'matrix_explorer',
    name: 'Matrix Explorer',
    thaiName: 'นักสำรวจเมทริกซ์',
    description: 'เข้าใจการจัดรูปสมการเชิงเส้นเป็น AX = B',
    icon: '🧭',
    category: 'basics'
  },
  {
    id: 'determinant_master',
    name: 'Determinant Master',
    thaiName: 'ปรมาจารย์ Determinant',
    description: 'เชี่ยวชาญการหาค่า det(A) และประเมินลักษณะคำตอบ',
    icon: '💎',
    category: 'matrix_ops'
  },
  {
    id: 'inverse_solver',
    name: 'Inverse Solver',
    thaiName: 'ผู้เชี่ยวชาญ Inverse Matrix',
    description: 'แก้สมการเชิงเส้นโดยใช้ A⁻¹B ได้อย่างถูกต้อง',
    icon: '🔑',
    category: 'methods'
  },
  {
    id: 'cramer_specialist',
    name: 'Cramer Specialist',
    thaiName: 'ผู้เชี่ยวชาญกฎของคราเมอร์',
    description: 'ใช้กฎของคราเมอร์แก้สมการและแทนที่คอลัมน์แม่นยำ',
    icon: '⚡',
    category: 'methods'
  },
  {
    id: 'gaussian_expert',
    name: 'Gaussian Expert',
    thaiName: 'ผู้เชี่ยวชาญ Gaussian Elimination',
    description: 'เชี่ยวชาญการทำ Row Operations และ Row Echelon Form',
    icon: '🎯',
    category: 'methods'
  },
  {
    id: 'matrix_master',
    name: 'Matrix Master',
    thaiName: 'มหาบัณฑิตเมทริกซ์ (Matrix Master)',
    description: `สำเร็จหลักสูตรระบบสมการเชิงเส้นและเมทริกซ์ครบ ${CURRICULUM_LESSONS.length} บทเรียน`,
    icon: '🏆',
    category: 'completion'
  }
];

interface Props {
  progress: StudentProgress;
  // Whether to show the XP / Badges stat cells — reflects the teacher's enableXp/enableBadges
  // settings (see TeacherSettingsPage.tsx). Defaults to true so any other caller of this modal
  // that doesn't pass them keeps the previous unconditional behavior.
  showXp?: boolean;
  showBadges?: boolean;
  onCloseCertificate?: () => void;
}

export function BadgesList({ progress }: { progress: StudentProgress }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {ALL_BADGES.map((badge) => {
        const isEarned = progress.earnedBadges.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={`p-4 rounded-2xl border transition-all flex items-start gap-3 ${
              isEarned
                ? 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 shadow-sm'
                : 'bg-slate-50 border-slate-200 opacity-60 grayscale'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner ${
                isEarned ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {badge.icon}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-indigo-900">{badge.name}</p>
                {isEarned && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] font-semibold text-slate-700">{badge.thaiName}</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">{badge.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CertificateModal({ progress, showXp = true, showBadges = true, onCloseCertificate }: Props) {
  const [studentName, setStudentName] = useState(progress.studentName || 'นักเรียนใหม่');
  const [isEditingName, setIsEditingName] = useState(false);

  const averageMastery = Math.round(
    Object.values(progress.topicMastery).reduce((a, b) => a + b, 0) /
      Object.keys(progress.topicMastery).length
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden relative my-8">
        {/* Top Control Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="font-bold text-sm">ใบรับรองการผ่านการเรียนรู้ (Completion Certificate)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> พิมพ์เกียรติบัตร
            </button>
            {onCloseCertificate && (
              <button
                onClick={onCloseCertificate}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Certificate Paper Container */}
        <div id="printable-certificate" className="p-10 bg-amber-50/30 border-8 border-indigo-900/10 relative">
          {/* Watermark / Decorative Frame */}
          <div className="border-2 border-dashed border-indigo-900/20 p-8 rounded-2xl bg-white/80 shadow-inner text-center relative">
            <div className="absolute top-4 left-4 text-indigo-900/20 text-4xl">❖</div>
            <div className="absolute top-4 right-4 text-indigo-900/20 text-4xl">❖</div>
            <div className="absolute bottom-4 left-4 text-indigo-900/20 text-4xl">❖</div>
            <div className="absolute bottom-4 right-4 text-indigo-900/20 text-4xl">❖</div>

            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl text-white shadow-lg mb-4">
              <Shield className="w-8 h-8 text-amber-300" />
            </div>

            <h1 className="text-2xl font-black text-slate-800 tracking-wider uppercase mb-1">
              ใบประกาศนียบัตรเชิดชูเกียรติ
            </h1>
            <p className="text-xs font-bold text-indigo-600 tracking-widest uppercase mb-6">
              Certificate of Achievement • MatrixMaster Pro
            </p>

            <p className="text-sm text-slate-600">ขอมอบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</p>

            {/* Editable Student Name */}
            <div className="my-4 inline-block">
              {isEditingName ? (
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  className="text-2xl font-black text-indigo-950 text-center border-b-2 border-indigo-600 focus:outline-none bg-transparent"
                  autoFocus
                />
              ) : (
                <p
                  onClick={() => setIsEditingName(true)}
                  className="text-2xl font-black text-indigo-950 border-b-2 border-indigo-300 px-6 py-1 cursor-pointer hover:border-indigo-600 transition-colors"
                  title="คลิกเพื่อแก้ไขชื่อ"
                >
                  {studentName}
                </p>
              )}
            </div>

            <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
              ได้ผ่านการศึกษาและผ่านการประเมินผลการเรียนรู้ในรายวิชา
            </p>
            <p className="text-lg font-extrabold text-indigo-900 mt-1">
              "การแก้ระบบสมการเชิงเส้นโดยใช้เมทริกซ์"
            </p>
            <p className="text-xs text-slate-500 mt-1">
              (Inverse Matrix, Cramer's Rule, and Gaussian Elimination)
            </p>

            {/* Stats Badge Strip — mastery is always shown; XP/Badges cells follow the
                teacher's enableXp/enableBadges settings (see TeacherSettingsPage.tsx), same as
                everywhere else those stats appear. */}
            <div
              className={`grid gap-4 max-w-md mx-auto my-6 p-3 bg-slate-50 rounded-xl border border-slate-200 ${
                (showXp ? 1 : 0) + (showBadges ? 1 : 0) === 2
                  ? 'grid-cols-3'
                  : (showXp ? 1 : 0) + (showBadges ? 1 : 0) === 1
                  ? 'grid-cols-2'
                  : 'grid-cols-1'
              }`}
            >
              {showXp && (
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">คะแนนสะสม</p>
                  <p className="text-base font-black text-indigo-600">{progress.xp} XP</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">ความเชี่ยวชาญรวม</p>
                <p className="text-base font-black text-emerald-600">{averageMastery}%</p>
              </div>
              {showBadges && (
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">ตราสัญลักษณ์</p>
                  <p className="text-base font-black text-amber-600">{progress.earnedBadges.length} Badges</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-end mt-8 pt-6 border-t border-slate-200 px-6 text-left">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">วันที่ออกใบรับรอง</p>
                <p className="text-xs font-bold text-slate-700">
                  {new Date().toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="text-right">
                <div className="w-32 h-10 border-b border-slate-400 mx-auto flex items-end justify-center pb-1 font-serif text-indigo-900 italic text-sm font-bold">
                  MatrixMaster AI
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">ระบบประเมินผลอัตโนมัติ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
