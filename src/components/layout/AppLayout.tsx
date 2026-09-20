import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Beaker,
  BookOpen,
  BarChart,
  Compass,
  FileCheck2,
  Tv2,
  Users,
  Sparkles,
  GraduationCap,
  Menu,
  X,
  Network
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { loadStudentProgress } from '../../lib/learningStore';
import { getClassroomLink, hasSeenOnboarding } from '../../lib/classroomSync';
import { ClassroomJoinModal } from '../ClassroomJoinModal';

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [appMode, setAppMode] = useState<'student' | 'teacher'>('student');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const progress = loadStudentProgress();
  const classroomLink = getClassroomLink();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!hasSeenOnboarding()) setShowJoinModal(true);
  }, []);

  const studentNav = [
    { name: 'Dashboard (หน้าแรก)', path: '/', icon: LayoutDashboard },
    { name: 'เส้นทางการเรียนรู้ (12 บท)', path: '/learning', icon: Compass },
    { name: 'Pre/Post-Test (วัดระดับ)', path: '/diagnostic', icon: FileCheck2 },
    { name: 'Matrix Lab (วิเคราะห์)', path: '/lab', icon: Beaker },
    { name: 'ระบบสมการขั้นสูง (4x4)', path: '/higher-order-lab', icon: Network },
    { name: 'แบบฝึกหัด (Practice)', path: '/exercises', icon: BookOpen },
  ];

  const teacherNav = [
    { name: 'Presentation (โหมดฉายจอ)', path: '/presentation', icon: Tv2 },
    { name: 'วิเคราะห์ผลการเรียน (Analytics)', path: '/analysis', icon: BarChart },
    { name: 'ตั้งค่าชั้นเรียน (Settings)', path: '/analysis', icon: Users },
  ];

  const currentNav = appMode === 'student' ? studentNav : [...teacherNav, ...studentNav];

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md">
            M
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black text-slate-800 tracking-tight">
              MatrixMaster <span className="text-indigo-600">Pro</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase"> Classroom Learning Platform</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => {
              setAppMode('student');
              navigate('/learning');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              appMode === 'student'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Student Mode
          </button>
          <button
            onClick={() => {
              setAppMode('teacher');
              navigate('/presentation');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              appMode === 'teacher'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tv2 className="w-4 h-4 text-amber-400" /> Teacher Mode
          </button>
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {progress.studentName}
            </span>
            <span className="text-xs font-extrabold text-indigo-600">
              {progress.xp} XP • {progress.earnedBadges.length} Badges
            </span>
          </div>
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-100 text-indigo-700 rounded-full border-2 border-indigo-200 flex items-center justify-center font-black text-xs">
            {progress.studentName.slice(0, 2)}
          </div>
        </div>
      </header>

      <main className="flex-grow flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-10 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Sidebar Nav */}
        <nav className={cn(
          "absolute md:static w-64 md:w-60 h-full bg-white md:bg-transparent border-r md:border-r-0 border-slate-200 p-4 md:p-3 flex flex-col gap-1.5 z-20 transition-transform duration-200 ease-in-out md:translate-x-0 overflow-y-auto",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="md:bg-white md:rounded-2xl md:border md:border-slate-200 md:p-3 flex flex-col gap-1.5 md:shadow-sm h-full overflow-y-auto">
            {/* Mobile Mode Switcher (visible only on mobile menu) */}
            <div className="lg:hidden flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 mb-4 flex-shrink-0">
              <button
                onClick={() => {
                  setAppMode('student');
                  navigate('/learning');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  appMode === 'student'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Student
              </button>
              <button
                onClick={() => {
                  setAppMode('teacher');
                  navigate('/presentation');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  appMode === 'teacher'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tv2 className="w-4 h-4 text-amber-400" /> Teacher
              </button>
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase px-3 mb-1 tracking-widest">
              {appMode === 'student' ? 'เมนูนักเรียน (Student)' : 'เมนูครูผู้สอน (Teacher)'}
            </p>
            {currentNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors font-bold flex-shrink-0',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'text-slate-600 hover:bg-slate-50'
                    )
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}

            <button
              onClick={() => setShowJoinModal(true)}
              className="mt-auto p-3 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              {classroomLink ? `ห้องเรียน: ${classroomLink.classCode}` : 'เข้าร่วมห้องเรียน (ไม่บังคับ)'}
            </button>

            <div className="p-3.5 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl text-white space-y-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5" /> Matrix Assistant
              </div>
              <p className="text-[11px] text-indigo-200 leading-tight">
                ครูผู้ช่วย AI ตอบคำถามและแนะนำการแก้โจทย์ทีละขั้นตอน
              </p>
            </div>

            {/* Creator Attribution */}
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700 flex flex-col gap-0.5 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" /> ผู้จัดทำสื่อการสอน
              </div>
              <p className="text-xs font-bold text-slate-800">
                ครูเกียรติศักดิ์ แก้วหล้า
              </p>
              <p className="text-[11px] text-slate-600 font-medium leading-tight">
                ครูโรงเรียนอุตรดิตถ์
              </p>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">
                วิทยฐานะ ครูชำนาญการพิเศษ
              </p>
            </div>
          </div>
        </nav>

        <section className="flex-grow overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 relative w-full overflow-x-hidden">
          {children}
        </section>
      </main>

      {showJoinModal && (
        <ClassroomJoinModal progress={progress} onClose={() => setShowJoinModal(false)} />
      )}
    </div>
  );
}
