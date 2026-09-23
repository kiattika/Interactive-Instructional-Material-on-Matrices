import { LinearSystem } from '../types';
import { TopicKey } from './topics';
import { syncProgressToClassroom } from './classroomSync';

export interface Lesson {
  id: number;
  title: string;
  subtitle: string;
  category: 'basics' | 'matrix_ops' | 'methods' | 'advanced';
  prerequisites?: number[];
  estimatedMinutes: number;
  description: string;
  content: {
    sectionTitle: string;
    explanationText: string;
    exampleSystem?: LinearSystem;
    keyTakeaway: string;
  }[];
  checkQuestions: {
    question: string;
    options: string[];
    correctIndex: number;
    // Parallel to options: why each WRONG option is wrong (its most likely misconception), shown
    // after a first wrong pick instead of revealing the answer (see lib/checkAttempts.ts). The
    // entry at correctIndex is null.
    whyWrong: (string | null)[];
    explanation: string;
  }[];
}

export type SolvingMethod = 'inverse' | 'cramer' | 'gauss';

export interface StudentProgress {
  studentName: string;
  xp: number;
  completedLessons: number[]; // Lesson IDs
  lessonScores: Record<number, number>; // lessonId -> percentage
  preTestCompleted: boolean;
  preTestScore: number; // 0-100
  preTestAnswers: Record<string, number>;
  preTestDate?: string;
  postTestCompleted: boolean;
  postTestScore: number; // 0-100
  postTestAnswers: Record<string, number>;
  postTestDate?: string;
  topicMastery: Record<TopicKey, number>; // each 0-100
  errorLog: {
    topic: string;
    errorType: string;
    timestamp: string;
  }[];
  earnedBadges: string[];
  // Keys of the form "lesson{id}-check{qIdx}" for check-questions that have already earned
  // their small per-question XP bonus (see CHECK_QUESTION_CORRECT_XP below). Without this, a
  // student could reset and re-answer the same check-question — or just revisit a completed
  // lesson — to farm XP indefinitely.
  // Since the two-strike flow (lib/checkAttempts.ts) this also holds keys whose XP was forfeited
  // by revealing the answer after two wrong picks — i.e. "this question's XP is settled".
  checkQuestionXpAwarded: string[];
  // Keys (same format as above) of practice questions where the student's first pick was wrong.
  // Persisted so resetting/revisiting can't turn a second try into a full-XP "first" try.
  checkQuestionFirstTryMissed: string[];
  // One-time flags for completing an interactive lab walkthrough (see LAB_WALKTHROUGH_XP below)
  // — tracked separately per lab so a student doing both gets credit for both, not one shared
  // flag. "Completing" means actually stepping through the walkthrough to its final step
  // (MatrixLab's manual Gauss mode, HigherOrderLab's progressive reveal), not just opening the
  // tab, so re-visiting an already-completed walkthrough never re-awards XP.
  matrixLabGaussCompleted: boolean;
  higherOrderLabCompleted: boolean;
  // Solving methods the student has actually used in Matrix Lab (opened that method's tab or,
  // for the default Inverse tab, expanded one of its steps) — drives the Versatile Solver badge.
  // Local-only (not synced to the classroom roster), like checkQuestionXpAwarded.
  methodsUsed: SolvingMethod[];
  // Student-local calendar days ("YYYY-MM-DD", sorted, bounded) with any learning activity —
  // answering/finishing lessons, exercises, tests, live polls, lab work. Only a date per day, no
  // timestamps or durations; it exists solely for the Dashboard streak (see motivation.ts).
  activityDates: string[];
  // Whether this device already completed OR dismissed the anonymous post-course survey, so it
  // isn't re-prompted. Local-only: never sent with the survey answers, and not part of the
  // classroom sync payload either (classroomSync.ts whitelists synced fields).
  hasCompletedSurvey: boolean;
}

// A check-question is a much smaller unit of effort than finishing a whole lesson (+50 XP,
// LessonView.tsx) or a live in-class poll question (LIVE_POLL_CORRECT_XP = 10,
// livePollStore.ts) — it's just confirming understanding of one fact while reading. Kept
// smaller than both so the XP scale still reflects relative effort/stakes.
export const CHECK_QUESTION_CORRECT_XP = 5;

// Correct on the second attempt after one wrong pick (see lib/checkAttempts.ts): half of the full
// award. XP is an integer everywhere, so the 2.5 rounds up in the student's favor.
export const CHECK_QUESTION_SECOND_TRY_XP = Math.ceil(CHECK_QUESTION_CORRECT_XP / 2);

// Completing a full Pre-Test or Post-Test (10 questions, requires actually knowing/recalling
// material across the whole course) is a bigger one-time effort than a single check-question
// but smaller than the accumulated XP from studying and completing several lessons — so it
// sits between the two on the same scale.
export const DIAGNOSTIC_TEST_XP = 25;

// Stepping through an entire interactive lab walkthrough (MatrixLab's manual Gauss elimination,
// or HigherOrderLab's 4x4 progressive reveal) takes more sustained engagement than answering one
// live-poll question (LIVE_POLL_CORRECT_XP = 10) — it's several sequential operations, not one
// tap — but far less than the study + practice behind finishing a whole lesson (+50). Sits just
// above the live-poll award on the same scale.
export const LAB_WALKTHROUGH_XP = 15;

export interface TeacherSettings {
  masteryThreshold: number; // default 70
  enableAiTutor: boolean;
  enableHints: boolean;
  enableXp: boolean;
  enableBadges: boolean;
}

export const CURRICULUM_LESSONS: Lesson[] = [
  {
    id: 1,
    title: 'บทที่ 1: ระบบสมการเชิงเส้นคืออะไร?',
    subtitle: 'ทำความเข้าใจความหมายและที่มาของระบบสมการเชิงเส้นในชีวิตจริง',
    category: 'basics',
    estimatedMinutes: 10,
    description: 'เรียนรู้พื้นฐานของระบบสมการเชิงเส้น ตัวแปร และคำตอบของระบบสมการในระนาบ 2 มิติและ 3 มิติ',
    content: [
      {
        sectionTitle: '1. นิยามและแนวคิดพื้นฐานของระบบสมการเชิงเส้น',
        explanationText: 'ระบบสมการเชิงเส้น (System of Linear Equations) คือชุดของสมการเชิงเส้นตั้งแต่สองสมการขึ้นไปที่มีตัวแปรชุดเดียวกัน เช่น ตัวแปร $x$ และ $y$ ในรูป $ax + by = c$ โดยไม่มีการคูณกันของตัวแปร และไม่มีตัวแปรยกกำลังมากกว่า 1\n\n**ตัวอย่างในชีวิตจริง:** การขายตั๋วเข้าชมสวนสนุก ถ้าตั๋วผู้ใหญ่ราคา 200 บาท ($x$) และตั๋วเด็กราคา 100 บาท ($y$) โดยขายตั๋วรวมได้ 150 ใบ เป็นเงินรวม 22,000 บาท เราเขียนระบบสมการได้ดังนี้:\n1) $x + y = 150$\n2) $200x + 100y = 22,000$',
        exampleSystem: {
          dimension: '2x2',
          A: [[2, 1], [1, -1]],
          B: [5, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'คำตอบของระบบสมการคือค่า $(x, y)$ ที่เมื่อแทนลงในทุกสมการแล้วทำให้ทุกสมการเป็นจริงพร้อมกัน'
      },
      {
        sectionTitle: '2. การตีความทางเรขาคณิต (Geometric Interpretation)',
        explanationText: 'ในระนาบ 2 มิติ สมการเชิงเส้นแต่ละสมการแทนเส้นตรง 1 เส้น คำตอบของระบบสมการมีได้ 3 กรณีดังนี้:\n- **1) คำตอบเดียว (Unique Solution):** เส้นตรงสองเส้นตัดกันที่จุดๆ เดียว (เกิดขึ้นเมื่อความชันไม่เท่ากัน)\n- **2) ไม่มีคำตอบ (No Solution):** เส้นตรงสองเส้นขนานกัน ไม่ตัดกันเลย (เกิดขึ้นเมื่อความชันเท่ากันแต่ระยะตัดแกนต่างกัน)\n- **3) มีคำตอบนับไม่ถ้วน (Infinitely Many Solutions):** เส้นตรงสองเส้นทับกันเป็นเส้นเดียวกัน (เกิดขึ้นเมื่อสมการสมบูรณ์แบบเดียวกัน)',
        keyTakeaway: 'จุดตัดบนกราฟของเส้นตรงคือคำตอบของระบบสมการเชิงเส้น'
      },
      {
        sectionTitle: '3. ขั้นตอนการตรวจคำตอบ (Verification)',
        explanationText: 'เมื่อได้ค่าตัวแปร เช่น $x = 2, y = 1$ เราต้องแทนค่ากลับเข้าไปในทุกสมการในระบบ:\n- สมการที่ 1: $2(2) + 1 = 4 + 1 = 5$ (เป็นจริง)\n- สมการที่ 2: $2 - 1 = 1$ (เป็นจริง)\nหากเป็นจริงทุกสมการ แสดงว่า $(2, 1)$ คือคำตอบที่ถูกต้องแน่นอน',
        keyTakeaway: 'การตรวจคำตอบย้อนกลับช่วยป้องกันความผิดพลาดในการคำนวณได้อย่าง 100%'
      }
    ],
    checkQuestions: [
      {
        question: 'คำตอบของระบบสมการ $2x + y = 5$ และ $x - y = 1$ คือจุดตัด $(x, y)$ ในข้อใด?',
        options: ['$x = 1, y = 2$', '$x = 2, y = 1$', '$x = 3, y = -1$', '$x = 0, y = 5$'],
        correctIndex: 1,
        whyWrong: [
          'สลับค่า $x$ กับ $y$ — แทนลงสมการแรกได้ $2(1) + 2 = 4 \\neq 5$',
          null,
          'เป็นจริงแค่สมการแรก $2(3) - 1 = 5$ แต่สมการที่สองได้ $3 - (-1) = 4 \\neq 1$ — คำตอบต้องเป็นจริงทุกสมการพร้อมกัน',
          'เป็นจริงแค่สมการแรก $2(0) + 5 = 5$ แต่สมการที่สองได้ $0 - 5 = -5 \\neq 1$'
        ],
        explanation: 'เมื่อแทนค่า $x = 2, y = 1$ ในสมการ $2(2) + 1 = 5$ (ถูกต้อง) และ $2 - 1 = 1$ (ถูกต้อง)'
      },
      {
        question: 'หากกราฟของระบบสมการเป็นเส้นตรงสองเส้นที่ขนานกันและไม่ตัดกันเลย ระบบสมการนี้จะมีคำตอบอย่างไร?',
        options: ['มี 1 คำตอบเดียว', 'ไม่มีคำตอบ (No Solution)', 'มีคำตอบนับไม่ถ้วน', 'มี 2 คำตอบ'],
        correctIndex: 1,
        whyWrong: [
          'คำตอบเดียวเกิดเมื่อเส้นตรงตัดกันที่จุดเดียว แต่เส้นขนานไม่มีจุดตัดเลย',
          null,
          'คำตอบนับไม่ถ้วนเกิดเมื่อเส้นตรงทับกันเป็นเส้นเดียว ไม่ใช่ขนานกัน',
          'เส้นตรงสองเส้นที่ไม่ทับกันตัดกันได้มากที่สุดแค่ 1 จุด ระบบเชิงเส้นจึงไม่มีทางมีคำตอบ 2 ชุดพอดี'
        ],
        explanation: 'เส้นตรงขนานกันไม่มีจุดตัดร่วมกันเลย จึงไม่มีค่า $(x, y)$ ใดที่สอดคล้องกับทั้งสองสมการพร้อมกัน'
      },
      {
        question: 'ในสมการเชิงเส้น ตัวแปรแต่ละตัวจะมีกำลังสูงสุดเท่ากับเท่าใด?',
        options: ['กำลัง 0', 'กำลัง 1', 'กำลัง 2', 'ขึ้นอยู่กับจำนวนสมการ'],
        correctIndex: 1,
        whyWrong: [
          'ตัวแปรกำลัง 0 มีค่าเท่ากับ 1 เสมอ จึงไม่ใช่ตัวแปรอีกต่อไป',
          null,
          'ตัวแปรกำลัง 2 เช่น $x^2$ ทำให้กราฟเป็นเส้นโค้ง (พาราโบลา) ไม่ใช่เส้นตรง',
          'จำนวนสมการไม่เกี่ยวกับเลขชี้กำลัง — สมการเชิงเส้นทุกสมการมีตัวแปรกำลัง 1 เสมอ'
        ],
        explanation: 'สมการเชิงเส้น (Linear) ตัวแปรทุกตัวต้องมีเลขชี้กำลังเป็น 1 เสมอ'
      },
      {
        question: 'จากตัวอย่างการขายตั๋ว: ตั๋วผู้ใหญ่ราคา 200 บาท ($x$ ใบ) ตั๋วเด็กราคา 100 บาท ($y$ ใบ) ขายรวม 150 ใบ ได้เงิน 22,000 บาท ขายตั๋วผู้ใหญ่ไปกี่ใบ?',
        options: ['80 ใบ', '110 ใบ', '150 ใบ', '70 ใบ'],
        correctIndex: 3,
        whyWrong: [
          'นั่นคือจำนวนตั๋วเด็ก ($y$) — ระวังสลับตัวแปรกัน',
          'ได้จากการคิด $22,000 \\div 200 = 110$ โดยลืมว่ามีรายได้จากตั๋วเด็กรวมอยู่ด้วย',
          'นั่นคือจำนวนตั๋วทั้งหมด ($x + y$) ไม่ใช่เฉพาะตั๋วผู้ใหญ่',
          null
        ],
        explanation: 'ระบบสมการคือ $x + y = 150$ และ $200x + 100y = 22,000$ หารสมการที่สองด้วย 100 ได้ $2x + y = 220$ แล้วลบด้วยสมการแรก ได้ $x = 70$ ใบ (และ $y = 80$ ใบ) ตรวจ: $200(70) + 100(80) = 22,000$'
      },
      {
        question: 'ระบบสมการ $x + 2y = 4$ และ $2x + 4y = 8$ มีกราฟเป็นอย่างไร?',
        options: ['เส้นตรงสองเส้นทับกันเป็นเส้นเดียว จึงมีคำตอบนับไม่ถ้วน', 'เส้นตรงตัดกันที่จุดเดียว จึงมีคำตอบเดียว', 'เส้นตรงขนานกัน จึงไม่มีคำตอบ', 'เส้นตรงตั้งฉากกัน'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ตัดกันจุดเดียวต้องมีความชันต่างกัน แต่ทั้งสองสมการมีความชันเท่ากัน ($-\\frac{1}{2}$)',
          'ขนานกันต้องมีความชันเท่ากันแต่ค่าคงที่ไม่เป็นสัดส่วนเดียวกัน — ที่นี่ $8$ ก็เป็น 2 เท่าของ $4$ ด้วย',
          'เส้นตั้งฉากต้องมีผลคูณความชันเท่ากับ $-1$ แต่สองเส้นนี้มีความชันเท่ากัน'
        ],
        explanation: 'สมการที่สองคือสมการแรกคูณ 2 ทั้งสองข้าง จึงเป็นเส้นตรงเส้นเดียวกัน ทุกจุดบนเส้นเป็นคำตอบของระบบ'
      }
    ]
  },
  {
    id: 2,
    title: 'บทที่ 2: การเขียนระบบสมการในรูป AX = B',
    subtitle: 'แปลงสมการเชิงเส้นให้อยู่ในรูปเมทริกซ์สัมปสิทธิ์ เมทริกซ์ตัวแปร และเมทริกซ์ค่าคงที่',
    category: 'basics',
    estimatedMinutes: 12,
    description: 'การแปลงสมการหลายตัวแปรให้อยู่ในรูปแบบ AX = B ช่วยให้ประมวลผลด้วยเมทริกซ์ได้ง่ายขึ้น',
    content: [
      {
        sectionTitle: '1. การแยกองค์ประกอบเมทริกซ์ AX = B',
        explanationText: 'เมื่อมีระบบสมการเชิงเส้น เช่น $3x + 2y = 12$ และ $x - y = 1$ เราสามารถแปลงให้อยู่ในรูปสมการเมทริกซ์ $AX = B$ โดยแยกออกเป็น 3 ส่วนหลัก:\n- **$A$ (Coefficient Matrix):** เมทริกซ์สัมปสิทธิ์หน้าตัวแปร $A = \\begin{bmatrix} 3 & 2 \\\\ 1 & -1 \\end{bmatrix}$\n- **$X$ (Variable Vector):** เมทริกซ์หลักของตัวแปร $X = \\begin{bmatrix} x \\\\ y \\end{bmatrix}$\n- **$B$ (Constant Vector):** เมทริกซ์หลักของค่าคงที่ฝั่งขวา $B = \\begin{bmatrix} 12 \\\\ 1 \\end{bmatrix}$',
        exampleSystem: {
          dimension: '2x2',
          A: [[3, 2], [1, -1]],
          B: [12, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'สัมปสิทธิ์หน้าตัวแปรเรียงตามแถวและคอลัมน์จะกลายเป็นสมาชิกของเมทริกซ์ A'
      },
      {
        sectionTitle: '2. การพิสูจน์การคูณเมทริกซ์ $A \\cdot X = B$',
        explanationText: 'เมื่อนำ $A$ คูณกับ $X$ ตามกฎแถวคูณคอลัมน์:\n$$\\begin{bmatrix} 3 & 2 \\\\ 1 & -1 \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\end{bmatrix} = \\begin{bmatrix} 3x + 2y \\\\ 1x - 1y \\end{bmatrix}$$\nจับเท่ากับ $B = \\begin{bmatrix} 12 \\\\ 1 \\end{bmatrix}$ จะได้ระบบสมการเดิมกลับมาทันที ซึ่งพิสูจน์ว่ารูปแบบ $AX = B$ สมบูรณ์แบบทุกประการ',
        keyTakeaway: 'โครงสร้าง $AX = B$ ช่วยให้เราใช้วิธีพีชคณิตเมทริกซ์แก้สมการที่มีตัวแปรจำนวนมากได้รวดเร็ว'
      },
      {
        sectionTitle: '3. ข้อควรระวังเมื่อจัดเรียงสมการสำหรับระบบ 3 ตัวแปร',
        explanationText: 'หากมีระบบสมการ 3 ตัวแปร เช่น $x + z = 5$ และ $2y - z = 1$ ต้องสังเกตว่าตัวแปรบางตัวหายไป:\n- สมการที่ 1: $1x + 0y + 1z = 5$\n- สมการที่ 2: $0x + 2y - 1z = 1$\nดังนั้นสัมปสิทธิ์ตัวที่หายไปต้องใส่เป็น **0** ในเมทริกซ์ $A$ ห้ามมองข้ามเด็ดขาด!',
        keyTakeaway: 'ต้องเรียงลำดับตัวแปร $(x, y, z)$ ให้ตรงคอลัมน์กันทุกสมการก่อนสร้างเมทริกซ์ A'
      }
    ],
    checkQuestions: [
      {
        question: 'สำหรับระบบสมการ $3x + 2y = 12$ และ $x - y = 1$ เมทริกซ์สัมปสิทธิ์ $A$ คือข้อใด?',
        options: ['$\\begin{bmatrix} 3 & 2 \\\\ 1 & -1 \\end{bmatrix}$', '$\\begin{bmatrix} 12 & 1 \\\\ 3 & 2 \\end{bmatrix}$', '$\\begin{bmatrix} 3 & 1 \\\\ 2 & -1 \\end{bmatrix}$', '$\\begin{bmatrix} 12 & 3 \\\\ 1 & 2 \\end{bmatrix}$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นำค่าคงที่ $12, 1$ ฝั่งขวามาใส่ใน $A$ ด้วย — ค่าคงที่ต้องอยู่ในเวกเตอร์ $B$ เท่านั้น',
          'เรียงสัมประสิทธิ์ตามคอลัมน์แทนแถว (ได้ $A^T$) — แต่ละแถวของ $A$ ต้องมาจากสมการเดียวกัน',
          'นำค่าคงที่ $12$ มาปนใน $A$ และเรียงตำแหน่งผิด — $A$ มีเฉพาะสัมประสิทธิ์หน้าตัวแปร'
        ],
        explanation: 'เมทริกซ์ $A$ เก็บเฉพาะสัมปสิทธิ์หน้า $x$ และ $y$ คือ แถวที่ 1 $[3, 2]$ และ แถวที่ 2 $[1, -1]$'
      },
      {
        question: 'เมทริกซ์ $B$ ในรูปแบบ $AX = B$ สื่อถึงสิ่งใดในระบบสมการเชิงเส้น?',
        options: ['สัมปสิทธิ์หน้าตัวแปร', 'ค่าตัวแปรที่ต้องการหาคำตอบ', 'ตัวเลขค่าคงที่ทางขวามือของสมการ', 'ผลคูณของตัวแปร'],
        correctIndex: 2,
        whyWrong: [
          'สัมประสิทธิ์หน้าตัวแปรอยู่ในเมทริกซ์ $A$ ไม่ใช่ $B$',
          'ตัวแปรที่ต้องการหาค่าอยู่ในเวกเตอร์ $X$',
          null,
          'สมการเชิงเส้นไม่มีการคูณกันของตัวแปร และ $B$ เป็นตัวเลขที่รู้ค่าอยู่แล้ว'
        ],
        explanation: 'เมทริกซ์ $B$ คือ Vector หลักที่บรรจุตัวเลขค่าคงที่ทางขวาของเครื่องหมายเท่ากับ'
      },
      {
        question: 'หากระบบสมการมี 3 ตัวแปร $(x, y, z)$ เมทริกซ์ตัวแปร $X$ จะมีมิติเป็นเท่าใด?',
        options: ['$1 \\times 3$', '$3 \\times 1$', '$3 \\times 3$', '$2 \\times 3$'],
        correctIndex: 1,
        whyWrong: [
          '$1 \\times 3$ คือเมทริกซ์แถว (แนวนอน) แต่ $X$ ต้องเป็นเมทริกซ์หลัก (แนวตั้ง) จึงจะคูณต่อจาก $A$ ได้',
          null,
          '$3 \\times 3$ คือขนาดของเมทริกซ์สัมประสิทธิ์ $A$ ไม่ใช่ $X$',
          'จำนวนแถวของ $X$ ต้องเท่ากับจำนวนตัวแปร (3) และมีเพียง 1 คอลัมน์'
        ],
        explanation: 'เมทริกซ์ $X$ จะเป็น Column Matrix ขนาด $3 \\times 1$ ประกอบด้วยตัวแปร $x, y, z$ ตามลำดับแนวตั้ง'
      },
      {
        question: 'ระบบสมการ $x + z = 5$ และ $2y - z = 1$ (เรียงตัวแปรเป็น $x, y, z$) แถวแรกของเมทริกซ์สัมประสิทธิ์ $A$ คือข้อใด?',
        options: ['$[1 \\quad 1]$', '$[1 \\quad 0 \\quad 1]$', '$[1 \\quad 1 \\quad 5]$', '$[0 \\quad 1 \\quad 1]$'],
        correctIndex: 1,
        whyWrong: [
          'ข้ามตัวแปร $y$ ที่หายไป — แถวของ $A$ ต้องมีครบ 3 ช่องตาม $x, y, z$ โดยใส่ $0$ แทน $y$',
          null,
          'นำค่าคงที่ $5$ มาใส่ในแถวของ $A$ และลืมใส่ $0$ ให้ $y$',
          'วางสัมประสิทธิ์ผิดคอลัมน์ — คอลัมน์แรกเป็นของ $x$ ซึ่งมีสัมประสิทธิ์ $1$'
        ],
        explanation: 'สมการแรกเขียนเต็มได้ $1x + 0y + 1z = 5$ ตัวแปร $y$ ที่หายไปต้องใส่สัมประสิทธิ์ $0$ แถวแรกจึงเป็น $[1 \\quad 0 \\quad 1]$'
      },
      {
        question: 'ผลคูณ $\\begin{bmatrix} 3 & 2 \\\\ 1 & -1 \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\end{bmatrix}$ มีสมาชิกในแถวแรกเท่ากับข้อใด?',
        options: ['$3x + y$', '$3x - y$', '$3x + 2y$', '$5xy$'],
        correctIndex: 2,
        whyWrong: [
          'ใช้สมาชิกคอลัมน์แรกของ $A$ ($3$ และ $1$) แทนที่จะใช้แถวแรก ($3$ และ $2$) — การคูณเมทริกซ์คือแถวคูณคอลัมน์',
          'ผสมสมาชิกจากสองแถว ($3$ จากแถว 1 และ $-1$ จากแถว 2) — ต้องใช้แถวที่ 1 ทั้งแถว',
          null,
          'การคูณเมทริกซ์ให้ผลรวมของผลคูณทีละคู่ ($3 \\cdot x + 2 \\cdot y$) ไม่ใช่การนำตัวแปรมาคูณกัน'
        ],
        explanation: 'นำแถวที่ 1 ของ $A$ คือ $[3, 2]$ คูณกับคอลัมน์ $X = [x, y]$ ได้ $3x + 2y$ ซึ่งก็คือฝั่งซ้ายของสมการแรกนั่นเอง'
      }
    ]
  },
  {
    id: 3,
    title: 'บทที่ 3: ดีเทอร์มิแนนต์ (Determinant)',
    subtitle: 'การหาค่า det(A) และความหมายของการเกิดคำตอบเดียว คำตอบนับไม่ถ้วน หรือไม่มีคำตอบ',
    category: 'matrix_ops',
    estimatedMinutes: 15,
    description: 'ดีเทอร์มิแนนต์บอกคุณสมบัติของเมทริกซ์ ถ้า det(A) ≠ 0 ระบบสมการจะมีคำตอบเดียวแน่นอน',
    content: [
      {
        sectionTitle: '1. การคำนวณดีเทอร์มิแนนต์ขนาด 2x2 และ 3x3',
        explanationText: 'ดีเทอร์มิแนนต์ใช้สัญลักษณ์ $|A|$ หรือ $\\det(A)$ เป็นค่าสเกลาร์ที่คำนวณจากเมทริกซ์จัตุรัส:\n- **สำหรับขนาด 2x2:** ถ้า $A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ จะได้ $\\det(A) = ad - bc$ (คูณเฉียงลง ลบ คูณเฉียงขึ้น)\n- **สำหรับขนาด 3x3:** ใช้กฎของซารร์รุส (Sarrus\' Rule) โดยต่อ 2 คอลัมน์แรกแล้วหา (ผลบวกเฉียงลง) - (ผลบวกเฉียงขึ้น) หรือใช้การกระจายโคแฟกเตอร์ (Cofactor Expansion)',
        exampleSystem: {
          dimension: '2x2',
          A: [[4, 2], [1, 3]],
          B: [10, 5],
          variables: ['x', 'y']
        },
        keyTakeaway: 'สูตร 2x2 คือ คูณเฉียงลง (ad) ลบด้วย คูณเฉียงขึ้น (bc)'
      },
      {
        sectionTitle: '2. ความหมายของ det(A) ต่อคำตอบของระบบสมการ',
        explanationText: 'ค่า $\\det(A)$ เป็นตัวชี้วัดสำคัญของระบบสมการ $AX = B$:\n- **ถ้า $\\det(A) \\neq 0$ (Non-singular Matrix):** เมทริกซ์ $A$ มีเมทริกซ์ผกผัน $A^{-1}$ และระบบสมการจะมี **คำตอบเดียวเสมอ** (Unique Solution)\n- **ถ้า $\\det(A) = 0$ (Singular Matrix):** เมทริกซ์ $A$ ไม่มี $A^{-1}$ ระบบสมการอาจ **ไม่มีคำตอบ** หรือ **มีคำตอบนับไม่ถ้วน**',
        keyTakeaway: 'ถ้า det(A) = 0 จะไม่สามารถหาคำตอบด้วยวิธี Inverse Matrix หรือ Cramer\'s Rule ได้'
      },
      {
        sectionTitle: '3. สมบัติที่สำคัญของ Determinant',
        explanationText: '1) $\\det(A^T) = \\det(A)$\n2) $\\det(AB) = \\det(A) \\cdot \\det(B)$\n3) $\\det(A^{-1}) = \\frac{1}{\\det(A)}$\n4) ถ้าสลับสองแถวใดๆ ค่า $\\det$ จะเปลี่ยนเป็นเครื่องหมายตรงข้าม (ติดลบ)',
        keyTakeaway: 'สมบัติของ det ช่วยลดเวลาในการคำนวณโจทย์ซับซ้อนได้อย่างมาก'
      }
    ],
    checkQuestions: [
      {
        question: 'ค่า $\\det(A)$ ของเมทริกซ์ $A = \\begin{bmatrix} 4 & 2 \\\\ 1 & 3 \\end{bmatrix}$ เท่ากับเท่าใด?',
        options: ['10', '14', '12', '8'],
        correctIndex: 0,
        whyWrong: [
          null,
          'บวกผลคูณเฉียงทั้งสองแทนการลบ: $12 + 2 = 14$ — สูตรคือ $ad - bc$',
          'คิดแค่ผลคูณเฉียงลง $ad = 12$ แล้วลืมลบ $bc = 2$',
          'ไม่ตรงกับสูตร $ad - bc$ — ตรวจว่าคูณเฉียงลง $(4 \\times 3)$ และเฉียงขึ้น $(2 \\times 1)$ ถูกคู่หรือไม่'
        ],
        explanation: '$\\det(A) = (4 \\times 3) - (2 \\times 1) = 12 - 2 = 10$'
      },
      {
        question: 'หากคำนวณพบว่า $\\det(A) = 0$ ข้อสรุปใดเกี่ยวกับเมทริกซ์ $A$ ที่ถูกต้องที่สุด?',
        options: ['เมทริกซ์ $A$ หา Inverse Matrix $A^{-1}$ ไม่ได้', 'ระบบสมการมีคำตอบเดียวแน่นอน', '$A$ เป็น Identity Matrix', '$\\det(A^{-1}) = 1$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'กลับกัน — คำตอบเดียวแน่นอนเกิดเมื่อ $\\det(A) \\neq 0$ ถ้า $\\det(A) = 0$ อาจไม่มีคำตอบหรือมีนับไม่ถ้วน',
          'เมทริกซ์เอกลักษณ์ $I$ มี $\\det(I) = 1$ ไม่ใช่ $0$',
          '$\\det(A^{-1}) = \\frac{1}{\\det(A)}$ ซึ่งหารด้วย $0$ ไม่ได้ — และ $A^{-1}$ ไม่มีอยู่ตั้งแต่แรก'
        ],
        explanation: 'เมื่อ $\\det(A) = 0$ จะทำให้ตัวหารในสูตร $A^{-1} = \\frac{1}{\\det(A)} \\operatorname{adj}(A)$ เป็น 0 จึงหา $A^{-1}$ ไม่ได้'
      },
      {
        question: 'ค่า $\\det(A)$ ของ $A = \\begin{bmatrix} 1 & 0 & 2 \\\\ 0 & 3 & 0 \\\\ 4 & 0 & 5 \\end{bmatrix}$ มีค่าเท่าใด?',
        options: ['-9', '15', '3', '-3'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คูณเฉพาะเส้นทแยงมุมหลัก $1 \\times 3 \\times 5 = 15$ — ทางลัดนี้ใช้ได้เฉพาะเมทริกซ์สามเหลี่ยม แต่เมทริกซ์นี้มี $2$ และ $4$ นอกแนวทแยง',
          'ใช้แค่ค่า $3$ ที่ใช้กระจายโคแฟกเตอร์ แต่ลืมคูณด้วยดีเทอร์มิแนนต์ย่อย $(5 - 8)$',
          'หาดีเทอร์มิแนนต์ย่อย $(5 - 8) = -3$ ถูกแล้ว แต่ลืมคูณด้วยสมาชิก $3$ ที่ใช้กระจาย'
        ],
        explanation: 'กระจายโคแฟกเตอร์ตามแถวที่ 2: $3 \\times \\det\\begin{bmatrix} 1 & 2 \\\\ 4 & 5 \\end{bmatrix} = 3 \\times (5 - 8) = 3 \\times (-3) = -9$'
      },
      {
        question: 'ถ้า $\\det(A) = 7$ และสร้างเมทริกซ์ $B$ โดยสลับแถวที่ 1 กับแถวที่ 2 ของ $A$ ค่าของ $\\det(B)$ คือข้อใด?',
        options: ['$7$', '$0$', '$\\frac{1}{7}$', '$-7$'],
        correctIndex: 3,
        whyWrong: [
          'การสลับแถวไม่ได้คงค่า det ไว้ แต่กลับเครื่องหมาย (สมบัติที่คงค่า det คือ $\\det(A^T) = \\det(A)$)',
          'det เป็น $0$ เมื่อมีสองแถวเหมือนกันหรือเป็นสัดส่วนกัน แต่การสลับแถวไม่ได้ทำให้เป็นเช่นนั้น',
          '$\\frac{1}{\\det(A)}$ คือสมบัติของ $\\det(A^{-1})$ ไม่ใช่การสลับแถว',
          null
        ],
        explanation: 'การสลับสองแถวใดๆ ทำให้ดีเทอร์มิแนนต์เปลี่ยนเป็นเครื่องหมายตรงข้าม จึงได้ $\\det(B) = -7$'
      },
      {
        question: 'ถ้า $\\det(A) = 2$ และ $\\det(B) = 5$ ค่าของ $\\det(AB)$ คือข้อใด?',
        options: ['$10$', '$7$', '$\\frac{2}{5}$', '$0$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นำ det มาบวกกัน — สมบัติที่ถูกคือ $\\det(AB) = \\det(A) \\cdot \\det(B)$ (คูณ ไม่ใช่บวก)',
          'นำ det มาหารกัน — สมบัติที่ถูกคือการคูณ',
          'ผลคูณของเมทริกซ์ที่ det ไม่เป็นศูนย์ทั้งคู่จะมี det ไม่เป็นศูนย์เสมอ'
        ],
        explanation: 'ใช้สมบัติ $\\det(AB) = \\det(A) \\cdot \\det(B) = 2 \\times 5 = 10$ โดยไม่ต้องคูณเมทริกซ์จริงเลย'
      }
    ]
  },
  {
    id: 4,
    title: 'บทที่ 4: การหา Inverse Matrix (A⁻¹)',
    subtitle: 'สูตรการหาเมทริกซ์ผกผันสำหรับขนาด 2x2 และ 3x3 ด้วย Adjugate',
    category: 'matrix_ops',
    prerequisites: [3],
    estimatedMinutes: 15,
    description: 'เรียนรู้วิธีคำนวณ A⁻¹ = (1/det(A)) × adj(A) เพื่อใช้แก้ระบบสมการเชิงเส้น',
    content: [
      {
        sectionTitle: '1. นิยามของ Inverse Matrix (เมทริกซ์ผกผัน)',
        explanationText: 'เมทริกซ์ผกผัน $A^{-1}$ คือเมทริกซ์ที่เมื่อนำมาคูณกับ $A$ แล้วได้เมทริกซ์เอกลักษณ์ $I$ (Identity Matrix):\n$$A \\cdot A^{-1} = A^{-1} \\cdot A = I = \\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}$$\nเมทริกซ์ผกผันจะเกิดขึ้นได้เมื่อ $A$ เป็นเมทริกซ์จัตุรัสและ $\\det(A) \\neq 0$ เท่านั้น',
        exampleSystem: {
          dimension: '2x2',
          A: [[2, 1], [1, -1]],
          B: [5, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'เมทริกซ์ผกผันเปรียบเสมือนส่วนกลับของการคูณในตัวเลขทั่วไป'
      },
      {
        sectionTitle: '2. สูตร Inverse Matrix สำหรับขนาด 2x2',
        explanationText: 'ถ้า $A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}$ สูตรการหา $A^{-1}$ คือ:\n$$A^{-1} = \\frac{1}{\\det(A)} \\operatorname{adj}(A) = \\frac{1}{ad - bc} \\begin{bmatrix} d & -b \\\\ -c & a \\end{bmatrix}$$\n**หลักการจำ:** สลับตำแหน่งสมาชิกบนเส้นทแยงมุมหลัก ($a \\leftrightarrow d$) และใส่เครื่องหมายลบหน้าสมาชิกเส้นทแยงมุมรอง ($-b, -c$)',
        keyTakeaway: 'สลับตำแหน่ง $a, d$ และเปลี่ยนเครื่องหมาย $b, c$ เป็นตรงข้าม'
      },
      {
        sectionTitle: '3. การหา Inverse Matrix ขนาด 3x3 ด้วย Adjugate',
        explanationText: 'สำหรับขนาด 3x3 หรือใหญ่กว่า เราใช้วิธี Adjugate Matrix:\n1) หา Minor $M_{ij}$ และ Cofactor $C_{ij} = (-1)^{i+j} M_{ij}$\n2) สร้างเมทริกซ์โคแฟกเตอร์ $\\operatorname{Cof}(A)$\n3) สลับเปลี่ยนเมทริกซ์โคแฟกเตอร์เพื่อหา Adjugate: $\\operatorname{adj}(A) = \\operatorname{Cof}(A)^T$\n4) คำนวณ $A^{-1} = \\frac{1}{\\det(A)} \\operatorname{adj}(A)$',
        keyTakeaway: 'Adjugate คือ Transpose ของ Cofactor Matrix'
      }
    ],
    checkQuestions: [
      {
        question: 'ถ้า $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$ ข้อใดคือ Adjugate Matrix $\\operatorname{adj}(A)$?',
        options: ['$\\begin{bmatrix} -1 & -1 \\\\ -1 & 2 \\end{bmatrix}$', '$\\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$', '$\\begin{bmatrix} 1 & -1 \\\\ -1 & 2 \\end{bmatrix}$', '$\\begin{bmatrix} -1 & 1 \\\\ 1 & 2 \\end{bmatrix}$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นี่คือเมทริกซ์ $A$ เดิม — ยังไม่ได้สลับ $a, d$ และเปลี่ยนเครื่องหมาย $b, c$',
          'ใส่ $d$ ผิดเครื่องหมาย — สลับ $a \\leftrightarrow d$ แล้วตำแหน่งซ้ายบนคือ $d = -1$ โดยไม่ต้องเปลี่ยนเครื่องหมาย',
          'สลับ $a, d$ ถูกแล้ว แต่ลืมเปลี่ยนเครื่องหมาย $b$ และ $c$ ให้เป็น $-1$'
        ],
        explanation: 'สลับ $a=2, d=-1$ ได้ $[-1, 2]$ และเปลี่ยนเครื่องหมาย $b=1, c=1$ ได้ $[-1, -1]$ รวมเป็น $\\begin{bmatrix} -1 & -1 \\\\ -1 & 2 \\end{bmatrix}$'
      },
      {
        question: 'เมทริกซ์ผกผัน $A^{-1}$ สามารถคำนวณได้เมื่อเงื่อนไขใดเป็นจริง?',
        options: ['$\\det(A) = 0$', '$\\det(A) \\neq 0$', '$A$ เป็นเมทริกซ์แนวเฉียงเท่านั้น', '$A$ มีขนาด $2 \\times 3$'],
        correctIndex: 1,
        whyWrong: [
          'เมื่อ $\\det(A) = 0$ ต้องหารด้วยศูนย์ในสูตร $\\frac{1}{\\det(A)}$ จึงหา $A^{-1}$ ไม่ได้',
          null,
          'เมทริกซ์ทั่วไปที่ไม่ใช่แนวเฉียงก็มีเมทริกซ์ผกผันได้ ขอแค่เป็นจัตุรัสและ $\\det(A) \\neq 0$',
          'เมทริกซ์ $2 \\times 3$ ไม่ใช่จัตุรัส จึงหาดีเทอร์มิแนนต์และเมทริกซ์ผกผันไม่ได้'
        ],
        explanation: '$A^{-1}$ หาได้เฉพาะเมื่อ $\\det(A) \\neq 0$ เท่านั้น เพื่อให้ $1/\\det(A)$ มีค่าทางคณิตศาสตร์'
      },
      {
        question: 'ถ้า $A = \\begin{bmatrix} 3 & 0 \\\\ 0 & 2 \\end{bmatrix}$ ข้อใดคือเมทริกซ์ผกผัน $A^{-1}$?',
        options: ['$\\begin{bmatrix} 1/3 & 0 \\\\ 0 & 1/2 \\end{bmatrix}$', '$\\begin{bmatrix} 2 & 0 \\\\ 0 & 3 \\end{bmatrix}$', '$\\begin{bmatrix} -3 & 0 \\\\ 0 & -2 \\end{bmatrix}$', '$\\begin{bmatrix} 1/2 & 0 \\\\ 0 & 1/3 \\end{bmatrix}$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นี่คือ $\\operatorname{adj}(A)$ ที่ยังไม่ได้คูณด้วย $\\frac{1}{\\det(A)} = \\frac{1}{6}$',
          'เมทริกซ์ผกผันไม่ใช่การเปลี่ยนเครื่องหมาย — สำหรับเมทริกซ์แนวเฉียงคือส่วนกลับของสมาชิกแต่ละตัว',
          'ใช้ส่วนกลับถูกแล้วแต่สลับตำแหน่ง — สมาชิก $3$ ต้องกลายเป็น $\\frac{1}{3}$ ในตำแหน่งเดิม'
        ],
        explanation: '$\\det(A) = 6$ และ $\\operatorname{adj}(A) = \\begin{bmatrix} 2 & 0 \\\\ 0 & 3 \\end{bmatrix}$ นำ $1/6$ คูณจะได้ $\\begin{bmatrix} 2/6 & 0 \\\\ 0 & 3/6 \\end{bmatrix} = \\begin{bmatrix} 1/3 & 0 \\\\ 0 & 1/2 \\end{bmatrix}$'
      },
      {
        question: 'ข้อใดใช้ตรวจสอบได้ว่าเมทริกซ์ $B$ เป็นเมทริกซ์ผกผันของ $A$ จริง?',
        options: ['$AB = 0$ (เมทริกซ์ศูนย์)', '$AB = I$ (เมทริกซ์เอกลักษณ์)', '$A + B = I$', '$\\det(A) = \\det(B)$'],
        correctIndex: 1,
        whyWrong: [
          'เทียบกับตัวเลข: $5 \\times \\frac{1}{5} = 1$ ไม่ใช่ $0$ — ผลคูณกับตัวผกผันต้องได้เอกลักษณ์',
          null,
          'เมทริกซ์ผกผันนิยามด้วยการคูณ ไม่ใช่การบวก',
          'ที่จริง $\\det(A^{-1}) = \\frac{1}{\\det(A)}$ ซึ่งมักไม่เท่ากับ $\\det(A)$'
        ],
        explanation: 'นิยามของเมทริกซ์ผกผันคือ $A \\cdot A^{-1} = A^{-1} \\cdot A = I$ ถ้าคูณกันแล้วได้เมทริกซ์เอกลักษณ์ แสดงว่า $B = A^{-1}$ จริง'
      },
      {
        question: 'สำหรับเมทริกซ์ขนาด 3x3 เมทริกซ์ผูกพัน $\\operatorname{adj}(A)$ ได้มาจากข้อใด?',
        options: ['เมทริกซ์โคแฟกเตอร์ $\\operatorname{Cof}(A)$ โดยไม่ต้อง Transpose', 'Transpose ของ $A$ โดยตรง ($A^T$)', 'Transpose ของเมทริกซ์โคแฟกเตอร์ $\\operatorname{Cof}(A)^T$', 'สลับสมาชิกบนเส้นทแยงมุมหลักแล้วเปลี่ยนเครื่องหมายสมาชิกที่เหลือ'],
        correctIndex: 2,
        whyWrong: [
          'ขาดขั้นตอนสุดท้าย — ต้อง Transpose เมทริกซ์โคแฟกเตอร์ก่อน ไม่เช่นนั้นตำแหน่งจะผิดเมื่อเมทริกซ์ไม่สมมาตร',
          '$A^T$ แค่สลับแถวกับคอลัมน์ของ $A$ ยังไม่ได้คำนวณ Minor และ Cofactor เลย',
          null,
          'นั่นคือทางลัดสำหรับเมทริกซ์ 2x2 เท่านั้น ใช้กับ 3x3 ไม่ได้'
        ],
        explanation: 'หา Cofactor $C_{ij} = (-1)^{i+j} M_{ij}$ ทุกตำแหน่งเพื่อสร้าง $\\operatorname{Cof}(A)$ แล้ว Transpose จะได้ $\\operatorname{adj}(A) = \\operatorname{Cof}(A)^T$'
      }
    ]
  },
  {
    id: 5,
    title: 'บทที่ 5: การแก้ระบบสมการด้วย A⁻¹B',
    subtitle: 'นำ Inverse Matrix มาคูณกับ B เพื่อหาค่าตัวแปร X = A⁻¹B',
    category: 'methods',
    prerequisites: [2, 3, 4],
    estimatedMinutes: 15,
    description: 'วิธี Inverse Matrix เป็นวิธียอดนิยมในการแก้ AX = B โดยคูณ A⁻¹ ทางซ้ายทั้งสองข้าง ได้ X = A⁻¹B',
    content: [
      {
        sectionTitle: '1. พิสูจน์ที่มาของสมการ $X = A^{-1}B$',
        explanationText: 'จากสมการเมทริกซ์ $AX = B$ นำ $A^{-1}$ มาคูณด้านซ้ายสุดของทั้งสองข้าง:\n$$A^{-1}(AX) = A^{-1}B$$\n$$(A^{-1}A)X = A^{-1}B$$\n$$IX = A^{-1}B \\implies X = A^{-1}B$$\n**ข้อระวังสำคัญ:** การคูณเมทริกซ์ไม่มีสมบัติสลับที่ ($A^{-1}B \\neq BA^{-1}$) ดังนั้นต้องคูณ $A^{-1}$ ด้านซ้ายมือของ $B$ เสมอ!',
        exampleSystem: {
          dimension: '2x2',
          A: [[2, 1], [1, -1]],
          B: [5, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'ต้องคูณ A⁻¹ ไว้ด้านซ้ายของ B เสมอ เนื่องจากมิติและการคูณเมทริกซ์ไม่สลับที่'
      },
      {
        sectionTitle: '2. ขั้นตอนการหาคำตอบแบบ Step-by-Step',
        explanationText: '1) หา $\\det(A)$ หาก $\\det(A) = 0$ ให้หยุดทันที (ใช้วิธีนี้ไม่ได้)\n2) คำนวณ $A^{-1} = \\frac{1}{\\det(A)} \\operatorname{adj}(A)$\n3) นำ $A^{-1}$ คูณกับ $B$ ตามกฎการคูณเมทริกซ์\n4) ผลลัพธ์ที่ได้ในเมทริกซ์ $X$ คือค่าคำตอบของตัวแปรแต่ละตัว',
        keyTakeaway: 'การคูณเมทริกซ์ A⁻¹ กับ B ให้คำตอบของทุกตัวแปรพร้อมกันในครั้งเดียว'
      },
      {
        sectionTitle: '3. ประโยชน์เมื่อแก้ระบบสมการที่มีค่าคงที่ B หลายชุด',
        explanationText: 'ในทางวิศวกรรม หากโครงสร้างระบบ $A$ คงเดิม แต่ต้องการทดสอบแรงกระทำภายนอก $B_1, B_2, B_3$ หลายๆ แบบ เราคำนวณ $A^{-1}$ เพียงครั้งเดียว แล้วนำไปคูณกับ $B_1, B_2, B_3$ ได้คำตอบทันทีโดยไม่ต้องเริ่มคำนวณใหม่ทั้งหมด',
        keyTakeaway: 'ประหยัดเวลามากที่สุดเมื่อเมทริกซ์ A คงที่แต่ B เปลี่ยนแปลงเรื่อยๆ'
      }
    ],
    checkQuestions: [
      {
        question: 'จากสมการ $AX = B$ ข้อใดคือขั้นตอนการคูณที่ถูกต้องตามหลักพีชคณิตเมทริกซ์?',
        options: ['$X = A^{-1}B$', '$X = BA^{-1}$', '$X = B / A$', '$X = \\det(A) \\cdot B$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'การคูณเมทริกซ์สลับที่ไม่ได้ — ต้องคูณ $A^{-1}$ ทางซ้ายของ $B$ (และ $BA^{-1}$ คูณไม่ได้ด้วยซ้ำเพราะมิติไม่เข้ากัน)',
          'ไม่มีการหารด้วยเมทริกซ์ — ใช้การคูณด้วย $A^{-1}$ แทน',
          '$\\det(A)$ เป็นตัวเลขเพียงตัวเดียว คูณ $B$ ด้วยค่านี้ไม่ได้ย้อนผลของ $A$'
        ],
        explanation: 'ต้องคูณ $A^{-1}$ ทางซ้ายของสมการเสมอ เพื่อให้ $A^{-1}A = I$ ได้ $X = A^{-1}B$'
      },
      {
        question: 'ถ้า $A^{-1} = \\begin{bmatrix} 1/3 & 1/3 \\\\ 1/3 & -2/3 \\end{bmatrix}$ และ $B = \\begin{bmatrix} 5 \\\\ 1 \\end{bmatrix}$ ค่าของ $X = A^{-1}B$ เท่ากับเท่าใด?',
        options: ['$\\begin{bmatrix} 2 \\\\ 1 \\end{bmatrix}$', '$\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}$', '$\\begin{bmatrix} 3 \\\\ 0 \\end{bmatrix}$', '$\\begin{bmatrix} 5 \\\\ 1 \\end{bmatrix}$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ได้ตัวเลขถูกแต่สลับตำแหน่ง — แถวแรกของผลคูณคือ $x = \\frac{1}{3}(5) + \\frac{1}{3}(1) = 2$',
          'ตรวจการคูณแถวคูณคอลัมน์อีกครั้ง: แถวที่ 2 คือ $\\frac{1}{3}(5) - \\frac{2}{3}(1) = 1$ ไม่ใช่ $0$',
          'นี่คือ $B$ เดิม — ยังไม่ได้คูณด้วย $A^{-1}$'
        ],
        explanation: '$x = (1/3)(5) + (1/3)(1) = 6/3 = 2$ และ $y = (1/3)(5) + (-2/3)(1) = 3/3 = 1$'
      },
      {
        question: 'วิธีแก้ระบบสมการด้วย $X = A^{-1}B$ จะล้มเหลวไม่สามารถหาคำตอบได้ในกรณีใด?',
        options: ['เมื่อ $\\det(A) = 0$', 'เมื่อเมทริกซ์ $B$ มีสมาชิกเป็นลบ', 'เมื่อ $A$ มีขนาด $3 \\times 3$', 'เมื่อตัวแปรมีค่าเป็นเศษส่วน'],
        correctIndex: 0,
        whyWrong: [
          null,
          'สมาชิกของ $B$ เป็นจำนวนลบได้ตามปกติ ไม่กระทบการหา $A^{-1}$',
          'วิธีนี้ใช้กับ 3x3 ได้ (หา $A^{-1}$ ด้วย Adjugate) แค่คำนวณยาวขึ้น',
          'คำตอบเป็นเศษส่วนได้ตามปกติ ไม่ได้ทำให้วิธีนี้ล้มเหลว'
        ],
        explanation: 'เมื่อ $\\det(A) = 0$ เมทริกซ์ $A$ ไม่มี Inverse Matrix ($A^{-1}$) จึงใช้วิธีนี้ไม่ได้'
      },
      {
        question: 'ขั้นตอนแรกที่ควรทำก่อนเริ่มแก้ระบบสมการด้วยวิธี $X = A^{-1}B$ คือข้อใด?',
        options: ['คูณ $A$ กับ $B$ ทันที', 'หา $\\operatorname{adj}(B)$', 'แทนค่า $x = 0$ ในทุกสมการ', 'คำนวณ $\\det(A)$ เพื่อตรวจว่าไม่เท่ากับ $0$'],
        correctIndex: 3,
        whyWrong: [
          'สูตรคือ $A^{-1}B$ ไม่ใช่ $AB$ — และต้องรู้ก่อนว่า $A^{-1}$ มีอยู่จริงหรือไม่',
          '$B$ เป็นเวกเตอร์ค่าคงที่ ไม่ใช่เมทริกซ์จัตุรัส — Adjugate ที่ต้องใช้คือของ $A$',
          'การเดาแทนค่าไม่ใช่ขั้นตอนของวิธีเมทริกซ์ผกผัน',
          null
        ],
        explanation: 'ต้องตรวจ $\\det(A)$ ก่อน ถ้าเป็น $0$ แสดงว่าไม่มี $A^{-1}$ ให้หยุดและเปลี่ยนวิธีทันทีโดยไม่เสียเวลาคำนวณต่อ'
      },
      {
        question: 'ถ้าหา $A^{-1} = \\begin{bmatrix} 1 & 1 \\\\ 0 & 1 \\end{bmatrix}$ ไว้แล้ว และมีเวกเตอร์ค่าคงที่ชุดใหม่ $B_2 = \\begin{bmatrix} 3 \\\\ 2 \\end{bmatrix}$ คำตอบ $X_2$ คือข้อใด?',
        options: ['$\\begin{bmatrix} 5 \\\\ 2 \\end{bmatrix}$', '$\\begin{bmatrix} 3 \\\\ 2 \\end{bmatrix}$', '$\\begin{bmatrix} 3 \\\\ 5 \\end{bmatrix}$', 'ต้องคำนวณ $A^{-1}$ ใหม่ก่อน'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นี่คือ $B_2$ เดิม ยังไม่ได้คูณด้วย $A^{-1}$',
          'คูณผิดแถว — แถวแรกของผลคูณคือ $1(3) + 1(2) = 5$ และแถวที่สองคือ $0(3) + 1(2) = 2$',
          'ไม่ต้อง — $A^{-1}$ ขึ้นกับ $A$ เท่านั้น เมื่อ $A$ ไม่เปลี่ยนก็คูณ $A^{-1}$ เดิมได้เลย นี่คือจุดเด่นของวิธีนี้'
        ],
        explanation: 'เมื่อ $A$ ไม่เปลี่ยน ใช้ $A^{-1}$ เดิมได้ทันที: $X_2 = A^{-1}B_2 = \\begin{bmatrix} 1(3) + 1(2) \\\\ 0(3) + 1(2) \\end{bmatrix} = \\begin{bmatrix} 5 \\\\ 2 \\end{bmatrix}$'
      }
    ]
  },
  {
    id: 6,
    title: 'บทที่ 6: กฎของคราเมอร์ (Cramer\'s Rule)',
    subtitle: 'การแก้สมการโดยใช้การแทนที่คอลัมน์และอัตราส่วนของ Determinants',
    category: 'methods',
    prerequisites: [3],
    estimatedMinutes: 15,
    description: 'กฎของคราเมอร์ช่วยหาคำตอบทีละตัวแปร เช่น x = det(Ax)/det(A) เหมาะสำหรับคำนวณอย่างรวดเร็ว',
    content: [
      {
        sectionTitle: '1. แนวคิดและการสร้างเมทริกซ์แทนที่ $A_{x_i}$',
        explanationText: 'กฎของคราเมอร์ใช้ Determinant ในการหาคำตอบของแต่ละตัวแปรโดยตรง ไม่ต้องหา Inverse Matrix โดยสร้างเมทริกซ์ย่อย $A_x, A_y, A_z$:\n- **$A_x$:** นำ Column Vector $B$ ไปแทนที่คอลัมน์ที่ 1 (คอลัมน์ของตัวแปร $x$)\n- **$A_y$:** นำ Column Vector $B$ ไปแทนที่คอลัมน์ที่ 2 (คอลัมน์ของตัวแปร $y$)\n- **$A_z$:** นำ Column Vector $B$ ไปแทนที่คอลัมน์ที่ 3 (คอลัมน์ของตัวแปร $z$)',
        exampleSystem: {
          dimension: '2x2',
          A: [[2, 1], [1, -1]],
          B: [5, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'ต้องการหาตัวแปรใด ให้นำ B ไปแทนที่ในคอลัมน์ของตัวแปรนั้น'
      },
      {
        sectionTitle: '2. สูตรคำนวณอัตราส่วน Determinant',
        explanationText: 'สูตรสำหรับหาค่าตัวแปรด้วยกฎของคราเมอร์:\n$$x = \\frac{\\det(A_x)}{\\det(A)}, \\quad y = \\frac{\\det(A_y)}{\\det(A)}, \\quad z = \\frac{\\det(A_z)}{\\det(A)}$$\n**เงื่อนไขสำคัญ:** ต้องใช้ได้เมื่อ $\\det(A) \\neq 0$ เท่านั้น',
        keyTakeaway: 'คำตอบแต่ละตัวแปรคือ อัตราส่วนของ det เมทริกซ์แทนที่ หารด้วย det(A)'
      },
      {
        sectionTitle: '3. จุดเด่นและข้อจำกัดของกฎของคราเมอร์',
        explanationText: 'ข้อดีคือ หากเราต้องการหาค่าเฉพาะตัวแปรเดียว เช่น อยากรู้แค่ค่า $y$ โดยไม่สนใจ $x$ หรือ $z$ เราหาเฉพาะ $\\det(A_y)$ และ $\\det(A)$ ได้ทันที ไม่ต้องคำนวณตัวแปรอื่นให้เสียเวลา',
        keyTakeaway: 'เหมาะสำหรับการหาคำตอบเฉพาะบางตัวแปรโดยไม่ต้องทำทั้งระบบ'
      }
    ],
    checkQuestions: [
      {
        question: 'ในการหาค่า $x$ ด้วยกฎของคราเมอร์ เมทริกซ์ $A_x$ ถูกสร้างขึ้นมาอย่างไร?',
        options: ['เอาเมทริกซ์ $B$ ไปแทนที่ในคอลัมน์ที่ 1 ของ $A$', 'เอาเมทริกซ์ $B$ ไปแทนที่ในคอลัมน์ที่ 2 ของ $A$', 'เอาแถวที่ 1 ของ $A$ คูณด้วย $B$', 'เอา $\\det(A)$ ไปคูณกับ $B$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'แทนคอลัมน์ที่ 2 จะได้ $A_y$ ซึ่งใช้หาค่า $y$ ไม่ใช่ $x$',
          'กฎของคราเมอร์ใช้การแทนที่คอลัมน์ ไม่ใช่การคูณแถวกับ $B$',
          '$\\det(A)$ เป็นตัวหารในสูตร ไม่ได้นำไปคูณ $B$ เพื่อสร้างเมทริกซ์'
        ],
        explanation: '$A_x$ เกิดจากการนำ Column Vector $B$ ไปแทนที่คอลัมน์แรก (คอลัมน์ของ $x$) ในเมทริกซ์ $A$'
      },
      {
        question: 'ถ้าระบบสมการมี $\\det(A) = -3$ และเมื่อสร้าง $A_y$ ได้ $\\det(A_y) = -3$ ค่าของ $y$ คือเท่าใด?',
        options: ['$y = 1$', '$y = -1$', '$y = 9$', '$y = 0$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ลบหารลบได้บวก: $\\frac{-3}{-3} = 1$',
          'คูณ $\\det(A_y) \\times \\det(A)$ แทนที่จะหาร',
          'นำ det สองค่ามาลบกัน ($-3 - (-3) = 0$) — สูตรคือการหาร'
        ],
        explanation: '$y = \\frac{\\det(A_y)}{\\det(A)} = \\frac{-3}{-3} = 1$'
      },
      {
        question: 'ข้อดีที่โดดเด่นที่สุดของกฎของคราเมอร์เมื่อเทียบกับวิธี $X = A^{-1}B$ คือข้อใด?',
        options: ['สามารถหาค่าตัวแปรเฉพาะตัวที่ต้องการได้โดยไม่ต้องหาตัวแปรอื่น', 'ไม่ต้องหา Determinant เลย', 'ใช้ได้กับระบบสมการที่ det(A) = 0', 'ใช้ได้กับเมทริกซ์ทุกมิติไม่จำเป็นต้องเป็นจัตุรัส'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คราเมอร์ต้องหาดีเทอร์มิแนนต์ถึง $N + 1$ ชุด',
          'คราเมอร์หารด้วย $\\det(A)$ จึงใช้ไม่ได้เมื่อ $\\det(A) = 0$',
          'ดีเทอร์มิแนนต์หาได้เฉพาะเมทริกซ์จัตุรัส คราเมอร์จึงใช้ได้เฉพาะเมื่อจำนวนสมการเท่ากับจำนวนตัวแปร'
        ],
        explanation: 'คราเมอร์ช่วยให้เราหาเฉพาะค่า $x$ หรือ $y$ ได้โดยตรงจาก $\\det(A_x)/\\det(A)$'
      },
      {
        question: 'ระบบ $2x + y = 5$ และ $x - y = 1$ มี $\\det(A) = -3$ ข้อใดคือค่า $\\det(A_x)$ และ $x$ ที่ถูกต้อง?',
        options: ['$\\det(A_x) = -3$ และ $x = 1$', '$\\det(A_x) = -6$ และ $x = 2$', '$\\det(A_x) = 6$ และ $x = -2$', '$\\det(A_x) = -6$ และ $x = \\frac{1}{2}$'],
        correctIndex: 1,
        whyWrong: [
          'ใช้ $\\det(A)$ แทน $\\det(A_x)$ — ต้องนำ $B$ ไปแทนคอลัมน์ที่ 1 ก่อนหา det',
          null,
          'ผิดเครื่องหมาย: $(5)(-1) - (1)(1) = -5 - 1 = -6$ ไม่ใช่ $6$',
          'หารกลับด้าน — สูตรคือ $x = \\frac{\\det(A_x)}{\\det(A)}$ ไม่ใช่ $\\frac{\\det(A)}{\\det(A_x)}$'
        ],
        explanation: '$A_x = \\begin{bmatrix} 5 & 1 \\\\ 1 & -1 \\end{bmatrix}$ ได้ $\\det(A_x) = (5)(-1) - (1)(1) = -6$ ดังนั้น $x = \\frac{-6}{-3} = 2$'
      },
      {
        question: 'ในระบบสมการ 3 ตัวแปร $(x, y, z)$ ถ้าต้องการหาเฉพาะค่า $z$ ด้วยกฎของคราเมอร์ ต้องคำนวณดีเทอร์มิแนนต์อย่างน้อยกี่ชุด?',
        options: ['1 ชุด: $\\det(A_z)$ เท่านั้น', '3 ชุด: $\\det(A_x), \\det(A_y), \\det(A_z)$', '2 ชุด: $\\det(A)$ และ $\\det(A_z)$', '4 ชุด: ครบทุกเมทริกซ์'],
        correctIndex: 2,
        whyWrong: [
          'ยังขาดตัวหาร $\\det(A)$',
          '$\\det(A_x)$ และ $\\det(A_y)$ ใช้หา $x, y$ ซึ่งไม่จำเป็นเมื่อต้องการแค่ $z$ — และยังขาด $\\det(A)$',
          null,
          'ครบ 4 ชุดใช้เมื่อต้องการทุกตัวแปร ถ้าต้องการแค่ $z$ ใช้เพียง 2 ชุด'
        ],
        explanation: '$z = \\frac{\\det(A_z)}{\\det(A)}$ ใช้เพียง 2 ค่า ($A_z$ คือนำ $B$ ไปแทนคอลัมน์ที่ 3) ไม่ต้องหา $x$ หรือ $y$ เลย — นี่คือจุดเด่นของกฎของคราเมอร์'
      }
    ]
  },
  {
    id: 7,
    title: 'บทที่ 7: เมทริกซ์แต่งเติม (Augmented Matrix)',
    subtitle: 'การรวมเมทริกซ์ A และ B เข้าด้วยกันเป็น [A | B] เพื่อเตรียมกำจัดแบบเกาส์',
    category: 'matrix_ops',
    prerequisites: [2],
    estimatedMinutes: 10,
    description: 'เมทริกซ์แต่งเติม [A | B] ช่วยย่อข้อมูลระบบสมการให้สั้นและพร้อมทำ Row Operations',
    content: [
      {
        sectionTitle: '1. รูปแบบและสัญกรณ์ของ Augmented Matrix $[A \\mid B]$',
        explanationText: 'เมทริกซ์แต่งเติมคือการเขียนรวมเมทริกซ์สัมปสิทธิ์ $A$ และเมทริกซ์ค่าคงที่ $B$ เข้าด้วยกันในตารางเดียว โดยมีเส้นแนวตั้งคั่นกลาง:\nสำหรับระบบ $2x + y = 5$ และ $x - y = 1$ เขียนเป็น Augmented Matrix ได้ดังนี้:\n$$\\left[\\begin{array}{cc|c} 2 & 1 & 5 \\\\ 1 & -1 & 1 \\end{array}\\right]$$',
        exampleSystem: {
          dimension: '2x2',
          A: [[2, 1], [1, -1]],
          B: [5, 1],
          variables: ['x', 'y']
        },
        keyTakeaway: 'เส้นแบ่งคั่นกลางช่วยแยกสัมปสิทธิ์ตัวแปรฝั่งซ้ายและค่าคงที่ฝั่งขวา'
      },
      {
        sectionTitle: '2. การอ่านความหมายและการเทียบเคียงสมการ',
        explanationText: 'แต่ละแถวใน $[A \\mid B]$ แทนหนึ่งสมการในระบบ:\n- แถวที่ 1: $[2 \\quad 1 \\mid 5] \\implies 2x + 1y = 5$\n- แถวที่ 2: $[1 \\quad -1 \\mid 1] \\implies 1x - 1y = 1$\nข้อดีคือเราไม่ต้องเขียนตัวแปร $x, y, z$ ซ้ำๆ ในทุกขั้นตอนการคำนวณ',
        keyTakeaway: 'ลดความซับซ้อนของการเขียนชื่อตัวแปรซ้ำซ้อนในสมการ'
      },
      {
        sectionTitle: '3. มิติของ Augmented Matrix และกรณีพิเศษ',
        explanationText: 'ถ้ามี $m$ สมการ และ $n$ ตัวแปร เมทริกซ์แต่งเติมจะมีขนาด $m \\times (n+1)$ เช่น ระบบ 2 สมการ 2 ตัวแปร จะได้เมทริกซ์แต่งเติมขนาด $2 \\times 3$',
        keyTakeaway: 'จำนวนคอลัมน์จะมากกว่าจำนวนตัวแปรอยู่ 1 คอลัมน์เสมอ (คอลัมน์ B)'
      }
    ],
    checkQuestions: [
      {
        question: 'สำหรับระบบสมการ 2 สมการ 3 ตัวแปร เมทริกซ์แต่งเติม $[A \\mid B]$ จะมีขนาดมิติเท่าใด?',
        options: ['$2 \\times 4$', '$2 \\times 3$', '$3 \\times 3$', '$3 \\times 4$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นับแค่คอลัมน์สัมประสิทธิ์ 3 คอลัมน์ แต่ลืมคอลัมน์ค่าคงที่ $B$ อีก 1 คอลัมน์',
          'จำนวนแถวต้องเท่ากับจำนวนสมการ (2) ไม่ใช่จำนวนตัวแปร',
          'สลับแถวกับตัวแปร — แถวคือสมการ (2 แถว) คอลัมน์คือตัวแปรบวก 1'
        ],
        explanation: 'มี 2 แถว (สมการ) และ 4 คอลัมน์ (คอลัมน์สัมปสิทธิ์ 3 ตัวแปร + คอลัมน์ค่าคงที่ B 1 คอลัมน์ = 4)'
      },
      {
        question: 'หากในกระบวนการคำนวณพบแถวหนึ่งเป็น $\\left[\\begin{array}{cc|c} 0 & 0 & 0 \\end{array}\\right]$ แสดงว่าอย่างไร?',
        options: ['สมการแถวนั้นกลายเป็น $0 = 0$ ซึ่งเป็นจริงเสมอ', 'ระบบสมการไม่มีคำตอบ', 'คำนวณผิดพลาด', 'ตัวแปรทุกตัวมีค่าเท่ากับ 0'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ไม่มีคำตอบเกิดจากแถว $[0 \\quad 0 \\mid k]$ ที่ $k \\neq 0$ แต่แถวนี้คือ $0 = 0$ ซึ่งเป็นจริง',
          'แถวศูนย์ทั้งแถวเกิดได้ตามปกติเมื่อมีสมการซ้ำซ้อน ไม่ได้แปลว่าคำนวณผิด',
          '$0x + 0y = 0$ เป็นจริงกับทุกค่าของ $x, y$ ไม่ได้บังคับให้ตัวแปรเป็น $0$'
        ],
        explanation: 'แถว $[0 \\quad 0 \\mid 0]$ หมายถึง $0x + 0y = 0$ ซึ่งเป็นจริงเสมอ บ่งบอกถึงการมีตัวแปรอิสระ (Infinite Solutions)'
      },
      {
        question: 'หากแถวสุดท้ายของเมทริกซ์แต่งเติมกลายเป็น $\\left[\\begin{array}{cc|c} 0 & 0 & 5 \\end{array}\\right]$ แสดงว่าอย่างไร?',
        options: ['ระบบสมการไม่มีคำตอบ (No Solution)', 'ระบบสมการมีคำตอบเดียวคือ $y = 5$', 'ระบบสมการมีคำตอบนับไม่ถ้วน', 'ต้องสลับแถวใหม่'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ถ้าจะได้ $y = 5$ แถวต้องเป็น $[0 \\quad 1 \\mid 5]$ แต่แถวนี้สัมประสิทธิ์ของ $y$ เป็น $0$',
          'คำตอบนับไม่ถ้วนเกิดจากแถว $[0 \\quad 0 \\mid 0]$ แต่แถวนี้ให้ $0 = 5$ ซึ่งเป็นเท็จ',
          'การสลับแถวไม่เปลี่ยนชุดคำตอบ — แถว $0 = 5$ ยังอยู่เหมือนเดิม'
        ],
        explanation: 'แถว $[0 \\quad 0 \\mid 5]$ หมายถึง $0x + 0y = 5$ ซึ่งเป็นเท็จ ขัดแย้งทางคณิตศาสตร์ จึงไม่มีคำตอบ'
      },
      {
        question: 'ระบบสมการ $x + 2y = 4$ และ $3x - y = 5$ เขียนเป็นเมทริกซ์แต่งเติมได้ตามข้อใด?',
        options: ['$\\left[\\begin{array}{cc|c} 1 & 3 & 4 \\\\ 2 & -1 & 5 \\end{array}\\right]$', '$\\left[\\begin{array}{cc|c} 1 & 2 & 5 \\\\ 3 & -1 & 4 \\end{array}\\right]$', '$\\begin{bmatrix} 1 & 2 \\\\ 3 & -1 \\end{bmatrix}$', '$\\left[\\begin{array}{cc|c} 1 & 2 & 4 \\\\ 3 & -1 & 5 \\end{array}\\right]$'],
        correctIndex: 3,
        whyWrong: [
          'เรียงสัมประสิทธิ์ตามคอลัมน์แทนแถว — แถวแรกต้องมาจากสมการแรก $x + 2y = 4$ คือ $[1 \\quad 2 \\mid 4]$',
          'สลับค่าคงที่ของสองสมการ — $4$ ต้องอยู่แถวเดียวกับ $x + 2y$',
          'นี่เป็นแค่เมทริกซ์ $A$ ยังขาดคอลัมน์ค่าคงที่ $B$ ทางขวาของเส้นคั่น',
          null
        ],
        explanation: 'แต่ละแถวคือหนึ่งสมการ: สัมประสิทธิ์ของ $x, y$ อยู่ซ้ายเส้นคั่น ค่าคงที่อยู่ขวา แถวแรก $[1 \\quad 2 \\mid 4]$ แถวที่สอง $[3 \\quad -1 \\mid 5]$'
      },
      {
        question: 'แถว $\\left[\\begin{array}{ccc|c} 2 & 0 & -1 & 7 \\end{array}\\right]$ ในเมทริกซ์แต่งเติมของระบบตัวแปร $x, y, z$ แทนสมการใด?',
        options: ['$2x - z = 7$', '$2x - y = 7$', '$2x - z + 7 = 0$', '$2x + y - z = 7$'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ข้ามเลข $0$ ทำให้ $-1$ ไปอยู่หน้า $y$ — คอลัมน์ที่ 3 คือ $z$ ส่วน $y$ มีสัมประสิทธิ์ $0$',
          'ย้ายค่าคงที่ผิดข้าง — $7$ อยู่ขวาเส้นคั่นจึงอยู่ฝั่งขวาของเครื่องหมายเท่ากับ (ย้ายข้างแล้วได้ $2x - z - 7 = 0$)',
          'สัมประสิทธิ์ของ $y$ เป็น $0$ แปลว่าไม่มี $y$ ในสมการ ไม่ใช่ $1$'
        ],
        explanation: 'อ่านตามคอลัมน์: $2x + 0y + (-1)z = 7$ พจน์ที่สัมประสิทธิ์เป็น $0$ หายไป จึงได้ $2x - z = 7$'
      }
    ]
  },
  {
    id: 8,
    title: 'บทที่ 8: Gaussian Elimination',
    subtitle: 'การกำจัดแบบเกาส์และการดำเนินการตามแถวขั้นพื้นฐาน (Elementary Row Operations)',
    category: 'methods',
    prerequisites: [7],
    estimatedMinutes: 20,
    description: 'แปลง [A | B] ให้อยู่ในรูป Row Echelon Form (สามเหลี่ยมบน) เพื่อแก้สมการย้อนกลับได้อย่างมีประสิทธิภาพ',
    content: [
      {
        sectionTitle: '1. การดำเนินการตามแถวขั้นพื้นฐาน (Elementary Row Operations - ERO)',
        explanationText: 'การกำจัดแบบเกาส์ใช้ 3 กฎเหล็กของ ERO ซึ่งไม่เปลี่ยนชุดคำตอบของระบบสมการ:\n1) **สลับสองแถวใดๆ ($R_i \\leftrightarrow R_j$):** สลับตำแหน่งสมการ\n2) **คูณแถวด้วยค่าคงที่ไม่เป็นศูนย์ ($k R_i$ โดย $k \\neq 0$):** ขยายหรือทอนสมการ\n3) **บวกแถวด้วยพหุคูณของแถวอื่น ($R_i + k R_j$):** นำแถวอื่นมาหักล้างตัวแปร',
        exampleSystem: {
          dimension: '2x2',
          A: [[1, 1], [2, -1]],
          B: [6, 3],
          variables: ['x', 'y']
        },
        keyTakeaway: 'ห้ามคูณแถวด้วยเลข 0 เด็ดขาด เพราะจะทำให้ข้อมูลในสมการสูญหาย'
      },
      {
        sectionTitle: '2. รูปแบบขั้นบันไดตามแถว (Row Echelon Form - REF)',
        explanationText: 'เป้าหมายของเกาส์คือแปลงฝั่งซ้าย $A$ ให้เป็นรูปสามเหลี่ยมบน (Upper Triangular Matrix):\n1) สมาชิกตัวแรกที่ไม่ใช่ศูนย์ของแต่ละแถวต้องเป็น **1** (เรียกว่า Leading 1)\n2) สมาชิกที่อยู่ใต้ Leading 1 ในคอลัมน์เดียวกันต้องเป็น **0** ทั้งหมด\n3) แถวที่มีสมาชิกเป็น 0 ทั้งหมดต้องอยู่ล่างสุด',
        keyTakeaway: 'ทำให้สมาชิกใต้เส้นทแยงมุมหลักกลายเป็น 0 ทั้งหมด'
      },
      {
        sectionTitle: '3. การแทนค่าย้อนกลับ (Back-Substitution)',
        explanationText: 'เมื่อได้รูป REF เช่น:\n$$\\left[\\begin{array}{cc|c} 1 & 1 & 6 \\\\ 0 & 1 & 3 \\end{array}\\right]$$\n- จากแถวที่ 2: $1y = 3 \\implies y = 3$\n- แทน $y = 3$ ย้อนกลับในแถวที่ 1: $x + 3 = 6 \\implies x = 3$\nได้คำตอบ $(x, y) = (3, 3)$ รวดเร็วและแม่นยำ',
        keyTakeaway: 'หาค่าตัวแปรล่างสุดก่อน แล้วนำไปแทนค่าย้อนกลับขึ้นไปแถวบน'
      }
    ],
    checkQuestions: [
      {
        question: 'ข้อใดเป็นการดำเนินการตามแถว (ERO) ที่ **ผิดกฎ** ทางคณิตศาสตร์?',
        options: ['การนำเลข 0 ไปคูณทุกสมาชิกในแถว ($0 \\cdot R_1$)', 'การสลับตำแหน่งแถวที่ 1 และแถวที่ 2 ($R_1 \\leftrightarrow R_2$)', 'การนำแถวที่ 1 คูณด้วย 5 ($5R_1$)', 'การนำ $-2 R_1$ ไปบวกเข้ากับแถวที่ 2 ($R_2 - 2R_1$)'],
        correctIndex: 0,
        whyWrong: [
          null,
          'การสลับแถวเป็น ERO ที่ถูกกฎ (กฎข้อที่ 1) — คำถามถามหาข้อที่ผิดกฎ',
          'การคูณแถวด้วยค่าคงที่ที่ไม่เป็นศูนย์ เช่น $5$ ถูกกฎ (กฎข้อที่ 2)',
          'การบวกพหุคูณของแถวอื่นถูกกฎ (กฎข้อที่ 3) และใช้บ่อยที่สุดในการกำจัดตัวแปร'
        ],
        explanation: 'ห้ามคูณแถวด้วย 0 เด็ดขาด เพราะจะทำให้ข้อมูลสมการถูกทำลายกลายเป็น $0=0$'
      },
      {
        question: 'คุณลักษณะสำคัญของเมทริกซ์ในรูป Row Echelon Form (REF) คือข้อใด?',
        options: ['สมาชิกที่อยู่ใต้ตัวนำ 1 ในทุกคอลัมน์ต้องเป็น 0 ทั้งหมด', 'สมาชิกทุกตัวนอกเส้นทแยงมุมหลักเป็น 0', 'เป็นเมทริกซ์เอกลักษณ์ $I$', 'จำนวนแถวต้องมากกว่าจำนวนคอลัมน์'],
        correctIndex: 0,
        whyWrong: [
          null,
          'นั่นเข้มกว่า REF — REF บังคับแค่สมาชิกใต้ Leading 1 เป็น $0$ สมาชิกเหนือเส้นทแยงมุมไม่จำเป็นต้องเป็น $0$',
          'เมทริกซ์เอกลักษณ์คือเป้าหมายของ RREF (Gauss-Jordan) ไม่จำเป็นสำหรับ REF',
          'REF ไม่ได้กำหนดจำนวนแถวหรือคอลัมน์ ใช้กับเมทริกซ์ทุกขนาด'
        ],
        explanation: 'รูป REF กำหนดให้สมาชิกใต้ตัวนำ 1 (Leading 1) ในคอลัมน์เดียวกันต้องกลายเป็น 0 ทั้งหมด'
      },
      {
        question: 'กระบวนการหาค่าตัวแปรหลังจากแปลงเมทริกซ์แต่งเติมให้อยู่ในรูปสามเหลี่ยมบนเรียกว่าอะไร?',
        options: ['การแทนค่าย้อนกลับ (Back-Substitution)', 'การหา Adjugate', 'การกระจายโคแฟกเตอร์', 'การสลับคอลัมน์'],
        correctIndex: 0,
        whyWrong: [
          null,
          'Adjugate ใช้ในวิธีเมทริกซ์ผกผัน ไม่ใช่ขั้นตอนหลังได้รูป REF',
          'การกระจายโคแฟกเตอร์ใช้หาดีเทอร์มิแนนต์ ไม่ได้ใช้หาค่าตัวแปรจาก REF',
          'การสลับคอลัมน์ไม่ใช่ ERO และจะทำให้ตัวแปรสลับตำแหน่งกัน'
        ],
        explanation: 'เมื่อได้รูปสามเหลี่ยมบน เราจะทราบค่าตัวแปรสุดท้าย แล้วแทนค่าย้อนกลับขึ้นไปยังสมการบนๆ'
      },
      {
        question: 'จากรูป REF $\\left[\\begin{array}{cc|c} 1 & 2 & 7 \\\\ 0 & 1 & 3 \\end{array}\\right]$ คำตอบ $(x, y)$ คือข้อใด?',
        options: ['$x = 7, y = 3$', '$x = 1, y = 3$', '$x = 3, y = 1$', '$x = 4, y = 3$'],
        correctIndex: 1,
        whyWrong: [
          'อ่านค่า $x$ จากคอลัมน์ขวาสุดของแถวแรกโดยตรง แต่แถวแรกคือ $x + 2y = 7$ ต้องแทน $y = 3$ ก่อน',
          null,
          'สลับค่า $x$ กับ $y$ — แถวล่างสุดให้ค่า $y$ ก่อนเสมอ',
          'แทนค่าแล้วลืมคูณสัมประสิทธิ์ $2$: ต้องเป็น $7 - 2(3) = 1$ ไม่ใช่ $7 - 3 = 4$'
        ],
        explanation: 'แถวที่ 2 ให้ $y = 3$ แทนย้อนกลับในแถวที่ 1: $x + 2(3) = 7 \\implies x = 1$'
      },
      {
        question: 'จาก $\\left[\\begin{array}{cc|c} 1 & 1 & 6 \\\\ 2 & -1 & 3 \\end{array}\\right]$ ERO ใดทำให้สมาชิกใต้ตัวนำ 1 ในคอลัมน์แรกกลายเป็น $0$?',
        options: ['$R_2 \\rightarrow R_2 + 2R_1$', '$R_2 \\rightarrow R_2 - R_1$', '$R_2 \\rightarrow R_2 - 2R_1$', '$R_1 \\rightarrow R_1 - 2R_2$'],
        correctIndex: 2,
        whyWrong: [
          'บวกแทนการลบ: $2 + 2(1) = 4$ ไม่เป็น $0$',
          'ตัวคูณไม่พอ: $2 - 1 = 1$ ยังไม่เป็น $0$ — ตัวคูณต้องเท่ากับสมาชิกที่ต้องการกำจัด ($2$)',
          null,
          'ไปแก้แถวตัวนำ (แถวที่ 1) แทน — ต้องแก้แถวที่อยู่ใต้ตัวนำ คือแถวที่ 2'
        ],
        explanation: 'ต้องการให้ $2$ ในแถวที่ 2 เป็น $0$ จึงลบด้วย 2 เท่าของแถวที่ 1: $2 - 2(1) = 0$ ได้แถวใหม่ $[0 \\quad -3 \\mid -9]$'
      }
    ]
  },
  {
    id: 9,
    title: 'บทที่ 9: เปรียบเทียบทั้ง 3 วิธี',
    subtitle: 'เปรียบเทียบข้อดี ข้อเสีย และความเหมาะสมของ A⁻¹B, Cramer และ Gauss',
    category: 'advanced',
    prerequisites: [5, 6, 8],
    estimatedMinutes: 15,
    description: 'ทำความเข้าใจเมื่อใดควรใช้วิธีใด เช่น Cramer สำหรับ 2x2 หรือ Gauss สำหรับระบบขนาดใหญ่หรือคอมพิวเตอร์',
    content: [
      {
        sectionTitle: '1. ตารางเปรียบเทียบคุณลักษณะของทั้ง 3 วิธี',
        explanationText: '1) **Inverse Matrix ($X = A^{-1}B$):**\n- *ข้อดี:* มีประโยชน์มากเมื่อ $A$ คงที่ แต่ $B$ เปลี่ยนหลายชุด\n- *ข้อเสีย:* คำนวณ $A^{-1}$ ช้ามากเมื่อขนาดมิติใหญ่เกิน $3 \\times 3$\n\n2) **Cramer\'s Rule:**\n- *ข้อดี:* หาค่าเฉพาะตัวแปรบางตัวได้โดยไม่ต้องคำนวณตัวแปรอื่น\n- *ข้อเสีย:* ต้องคำนวณ Determinant หลายชุด ($N+1$ ชุด)\n\n3) **Gaussian Elimination:**\n- *ข้อดี:* มีประสิทธิภาพสูงสุด ใช้การคำนวณน้อยที่สุด รองรับมิติขนาดใหญ่ $N \\times N$ และใช้ได้แม้ $\\det(A) = 0$',
        exampleSystem: {
          dimension: '2x2',
          A: [[1, 2], [3, 4]],
          B: [5, 11],
          variables: ['x', 'y']
        },
        keyTakeaway: 'ไม่มีวิธีใดดีที่สุดทุกกรณี ต้องเลือกใช้ตามบริบทของโจทย์'
      },
      {
        sectionTitle: '2. ความซับซ้อนเชิงคำนวณ (Computational Complexity)',
        explanationText: 'เมื่อขนาดของมิติ $N$ เพิ่มขึ้น:\n- **Cramer และ Inverse (Adjugate):** มีความซับซ้อนระดับ $O(N!)$ หรือ $O(N^4)$ ซึ่งช้ามากในคอมพิวเตอร์\n- **Gaussian Elimination:** มีความซับซ้อนเพียง $O(N^3)$ ทำให้เป็นวิธีมาตรฐานที่ใช้ในซอฟต์แวร์วิศวกรรมระดับโลก (เช่น MATLAB, NumPy, SciPy)',
        keyTakeaway: 'Gaussian Elimination คืออัลกอริทึมหลักของซอฟต์แวร์คอมพิวเตอร์'
      },
      {
        sectionTitle: '3. คำแนะนำในการเลือกวิธีสำหรับผู้เรียน',
        explanationText: '- **โจทย์ 2x2 ในห้องเรียน:** ใช้ **Cramer\'s Rule** หรือ **$A^{-1}B$** รวดเร็วที่สุด\n- **โจทย์ 3x3 ทั่วไป:** ใช้ **Gaussian Elimination** เพื่อลดโอกาสคิดเลขผิดเรื่องเครื่องหมาย\n- **ระบบสมการขนาดใหญ่ หรือโปรแกรมมิ่ง:** ใช้ **Gaussian Elimination / Gauss-Jordan** เสมอ',
        keyTakeaway: 'ประเมินขนาดมิติและเป้าหมายของโจทย์ก่อนเลือกใช้วิธีคำนวณ'
      }
    ],
    checkQuestions: [
      {
        question: 'หากต้องแก้ระบบสมการขนาดใหญ่ เช่น $10 \\times 10$ วิธีใดมีประสิทธิภาพและใช้การคำนวณน้อยที่สุด?',
        options: ['Gaussian Elimination', 'กฎของคราเมอร์ (Cramer\'s Rule)', 'การหา Inverse Matrix ด้วย Adjugate', 'การลองสุ่มแทนค่า'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คราเมอร์ต้องหาดีเทอร์มิแนนต์ขนาด $10 \\times 10$ ถึง 11 ชุด ใช้การคำนวณมหาศาล',
          'การหา Adjugate ต้องคำนวณ Cofactor ทุกตำแหน่ง (100 ตัว) ช้ามากสำหรับมิติใหญ่',
          'การสุ่มแทนค่าไม่มีหลักประกันว่าจะเจอคำตอบ และไม่ใช่วิธีทางคณิตศาสตร์'
        ],
        explanation: 'Gaussian Elimination มีความซับซ้อนเพียง $O(N^3)$ ในขณะที่วิธีอื่นใช้การคำนวณมหาศาล $O(N!)$'
      },
      {
        question: 'หากมีโครงสร้างระบบ $A$ คงเดิม แต่ต้องการแก้คำตอบสำหรับ $B_1, B_2, B_3, B_4$ หลายๆ ชุด วิธีใดเหมาะสมที่สุด?',
        options: ['หา Inverse Matrix $A^{-1}$ ครั้งเดียว แล้วนำไปคูณกับ $B$ แต่ละชุด ($A^{-1}B$)', 'ใช้ Cramer\'s Rule ใหม่ทั้งหมด 4 รอบ', 'สุ่มแทนค่าทีละตัวแปร', 'วาดกราฟ 4 ครั้ง'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ได้คำตอบเหมือนกันแต่ต้องหาดีเทอร์มิแนนต์ใหม่ทุกรอบ ทั้งที่ $A$ ไม่เปลี่ยน — เสียเวลามากกว่า',
          'การสุ่มแทนค่าไม่มีหลักประกันว่าจะได้คำตอบที่ถูกต้อง',
          'กราฟใช้ได้ดีแค่ 2 ตัวแปรและได้ค่าเพียงโดยประมาณ ไม่เหมาะกับการแก้หลายชุด'
        ],
        explanation: 'การคำนวณ $A^{-1}$ ไว้ครั้งเดียว แล้วนำไปคูณ $B_1, B_2, B_3, B_4$ ช่วยประหยัดเวลาคำนวณได้อย่างมาก'
      },
      {
        question: 'ข้อจำกัดร่วมกันของวิธี Inverse Matrix ($A^{-1}B$) และ Cramer\'s Rule คือข้อใด?',
        options: ['ใช้ได้เฉพาะเมื่อเมทริกซ์ $A$ เป็นเมทริกซ์จัตุรัสและ $\\det(A) \\neq 0$ เท่านั้น', 'ใช้ได้เฉพาะระบบสมการ 2 ตัวแปรเท่านั้น', 'ไม่สามารถใช้คำนวณด้วยมือได้', 'ต้องเปลี่ยนทุกตัวเลขเป็นทศนิยม'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ทั้งสองวิธีใช้กับ 3x3 ได้ในบทเรียนนี้ ข้อจำกัดที่แท้จริงอยู่ที่ $\\det(A)$',
          'ทั้งสองวิธีคำนวณด้วยมือได้ในระบบขนาดเล็ก ซึ่งทำมาแล้วในบทที่ 5-6',
          'ใช้เศษส่วนได้ตามปกติ — ข้อจำกัดอยู่ที่การหารด้วย $\\det(A)$'
        ],
        explanation: 'ทั้งสองวิธีต้องหารด้วย $\\det(A)$ จึงใช้ได้เฉพาะเมื่อ $A$ เป็นเมทริกซ์จัตุรัสและ $\\det(A) \\neq 0$'
      },
      {
        question: 'ตามคำแนะนำในบทเรียน สำหรับโจทย์ 3x3 ทั่วไปที่ทำด้วยมือ วิธีใดช่วยลดโอกาสคิดเลขผิดเรื่องเครื่องหมายได้มากที่สุด?',
        options: ['Cramer\'s Rule', 'Inverse Matrix ด้วย Adjugate', 'ทุกวิธีมีโอกาสผิดเท่ากันทุกประการ', 'Gaussian Elimination'],
        correctIndex: 3,
        whyWrong: [
          'ใช้ได้และได้คำตอบเดียวกัน แต่ต้องหาดีเทอร์มิแนนต์ 3x3 ถึง 4 ชุด ซึ่งมีเครื่องหมายบวกลบให้พลาดได้หลายจุด',
          'ใช้ได้เช่นกัน แต่ต้องหา Cofactor ถึง 9 ตัวพร้อมเครื่องหมาย $(-1)^{i+j}$ จึงเสี่ยงผิดเครื่องหมายมาก',
          'ทุกวิธีให้คำตอบเดียวกันก็จริง แต่จำนวนขั้นตอนที่ต้องจัดการเครื่องหมายต่างกัน บทเรียนจึงแนะนำให้เลือกตามขนาดโจทย์',
          null
        ],
        explanation: 'บทเรียนแนะนำ Gaussian Elimination สำหรับ 3x3 ทั่วไป เพราะทำทีละขั้นด้วย ERO และตรวจสอบได้ทุกขั้น ต่างจากการหาดีเทอร์มิแนนต์ 3x3 หลายชุด (ทุกวิธีให้คำตอบเดียวกันเมื่อคำนวณถูก)'
      },
      {
        question: 'ถ้า $\\det(A) = 0$ และต้องการรู้ว่าระบบไม่มีคำตอบหรือมีคำตอบนับไม่ถ้วน ควรใช้วิธีใด?',
        options: ['Gaussian Elimination แล้วดูแถวสุดท้ายของ $[A \\mid B]$', 'Inverse Matrix $X = A^{-1}B$', 'Cramer\'s Rule', 'สรุปได้ทันทีว่าไม่มีคำตอบ'],
        correctIndex: 0,
        whyWrong: [
          null,
          'เมื่อ $\\det(A) = 0$ ไม่มี $A^{-1}$ วิธีนี้จึงใช้ไม่ได้',
          'คราเมอร์ต้องหารด้วย $\\det(A) = 0$ จึงใช้ไม่ได้',
          '$\\det(A) = 0$ บอกแค่ว่าไม่มีคำตอบเดียว — ระบบยังอาจมีคำตอบนับไม่ถ้วนก็ได้ ต้องตรวจเพิ่ม'
        ],
        explanation: 'Gaussian Elimination ใช้ได้แม้ $\\det(A) = 0$ แถวสุดท้ายบอกประเภทคำตอบ: แถว $0 = k$ ($k \\neq 0$) คือไม่มีคำตอบ ส่วนแถว $0 = 0$ คือมีคำตอบนับไม่ถ้วน'
      }
    ]
  },
  {
    id: 10,
    title: 'บทที่ 10: แบบฝึกหัดสรุป (Mastery Challenge)',
    subtitle: 'ทดสอบความเข้าใจครอบคลุมทุกบทเรียน เพื่อรับตราประทับ Matrix Master',
    category: 'advanced',
    prerequisites: [9],
    estimatedMinutes: 20,
    description: 'รวบรวมโจทย์ประยุกต์และคำถามการตัดสินใจเชิงมิติ เพื่อพิสูจน์ความเชี่ยวชาญเมทริกซ์ระดับสมบูรณ์แบบ',
    content: [
      {
        sectionTitle: '1. สรุปผังมโนทัศน์ (Mindmap) การแก้ระบบสมการเชิงเส้น',
        explanationText: 'การเรียนรู้ระบบสมการเชิงเส้นแบ่งเป็น 4 เสาหลัก:\n1) **การแปลงรูป:** $AX = B$ และ $[A \\mid B]$\n2) **การวิเคราะห์สภาวะ:** ตรวจสอบ $\\det(A)$ เพื่อดูว่ามีคำตอบเดียวหรือไม่\n3) **เครื่องมือคำนวณ:** Inverse Matrix, Cramer\'s Rule, ERO/Gauss\n4) **การตีความคำตอบ:** Unique, No Solution, Infinite Solutions',
        exampleSystem: {
          dimension: '3x3',
          A: [[2, 3, 1], [1, -1, 1], [3, 2, 2]],
          B: [11, 2, 13],
          variables: ['x', 'y', 'z']
        },
        keyTakeaway: 'การเข้าใจโครงสร้างมโนทัศน์ช่วยให้เลือกวิเคราะห์โจทย์ได้อย่างถูกต้องแม่นยำ'
      },
      {
        sectionTitle: '2. การวิเคราะห์ประเภทคำตอบในกรณีพิเศษ',
        explanationText: 'เมื่อใช้ Gaussian Elimination กับ $[A \\mid B]$:\n- **กรณีคำตอบเดียว:** ได้รูปสามเหลี่ยมบนสมบูรณ์ สมาชิกในเส้นทแยงมุมหลักเป็นตัวนำ 1 ทั้งหมด\n- **กรณีไม่มีคำตอบ (Inconsistent System):** เกิดแถวขัดแย้ง เช่น $[0 \\quad 0 \\quad 0 \\mid k]$ เมื่อ $k \\neq 0$ ($0 = k$ เป็นเท็จ)\n- **กรณีคำตอบนับไม่ถ้วน (Dependent System):** เกิดแถว $[0 \\quad 0 \\quad 0 \\mid 0]$ ทำให้มี **Free Variable** (ตัวแปรอิสระ)',
        keyTakeaway: 'สังเกตลักษณะแถวสุดท้ายของ Augmented Matrix เพื่อระบุประเภทคำตอบ'
      },
      {
        sectionTitle: '3. สรุปแนวทางสู่การเป็น Matrix Master',
        explanationText: 'ขอแสดงความยินดี! คุณได้เรียนรู้ครบถ้วนทั้ง 10 บทเรียน ตั้งแต่พื้นฐานไปจนถึงอัลกอริทึมระดับสูง นำความรู้นี้ไปประยุกต์ใช้ในการแก้โจทย์คณิตศาสตร์ วิศวกรรมศาสตร์ วิทยาศาสตร์ข้อมูล และปัญญาประดิษฐ์ต่อไป!',
        keyTakeaway: 'ทดสอบความรู้ในคำถามท้ายบทเพื่อปลดล็อกตราประทับ Matrix Master'
      }
    ],
    checkQuestions: [
      {
        question: 'ถ้าระบบสมการ $AX = B$ มี $\\det(A) = 0$ และเมื่อนำ $[A \\mid B]$ มาทำ Gauss พบว่าแถวสุดท้ายเป็น $\\left[\\begin{array}{ccc|c} 0 & 0 & 0 & 8 \\end{array}\\right]$ สรุปผลได้อย่างไร?',
        options: ['ระบบสมการไม่มีคำตอบ (No Solution)', 'ระบบสมการมีคำตอบเดียวคือ $z = 8$', 'ระบบสมการมีคำตอบนับไม่ถ้วน (Infinite Solutions)', 'คำนวณผิดพลาด'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ถ้าจะได้ $z = 8$ แถวต้องเป็น $[0 \\quad 0 \\quad 1 \\mid 8]$ แต่สัมประสิทธิ์ของ $z$ ที่นี่เป็น $0$',
          'คำตอบนับไม่ถ้วนเกิดจากแถว $0 = 0$ แต่แถวนี้คือ $0 = 8$ ซึ่งเป็นเท็จ',
          'แถวขัดแย้งเกิดขึ้นได้จริงในระบบที่ไม่มีคำตอบ ไม่ใช่สัญญาณว่าคำนวณผิด'
        ],
        explanation: 'แถวสุดท้ายแสดงถึง $0x + 0y + 0z = 8$ ซึ่งก็คือ $0 = 8$ เป็นความขัดแย้งทางคณิตศาสตร์ จึงไม่มีคำตอบ'
      },
      {
        question: 'ถ้าระบบสมการ 3 ตัวแปร มีแถวสุดท้ายเป็น $\\left[\\begin{array}{ccc|c} 0 & 0 & 0 & 0 \\end{array}\\right]$ โดยไม่มีแถวขัดแย้งใดๆ ระบบสมการนี้จะมีลักษณะคำตอบแบบใด?',
        options: ['มีคำตอบนับไม่ถ้วน (Infinite Solutions) โดยมีตัวแปรอิสระ', 'มีคำตอบเดียว', 'ไม่มีคำตอบ', 'มี 3 คำตอบ'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คำตอบเดียวต้องมีตัวนำ 1 ครบทุกคอลัมน์ แต่แถวหนึ่งหายไป จึงมีตัวแปรอิสระ',
          'ไม่มีคำตอบต้องมีแถวขัดแย้ง $0 = k$ ($k \\neq 0$) แต่ที่นี่ไม่มีแถวขัดแย้งเลย',
          'ระบบเชิงเส้นมีคำตอบได้แค่ 0 ชุด 1 ชุด หรือนับไม่ถ้วน — ไม่มีกรณี 3 ชุดพอดี'
        ],
        explanation: 'แถว $0 = 0$ สื่อว่าสมการหนึ่งลดรูปหายไป ทำให้เหลือจำนวนสมการน้อยกว่าจำนวนตัวแปร จึงมีคำตอบนับไม่ถ้วน'
      },
      {
        question: 'ตัวแปรอิสระ (Free Variable) ในระบบสมการที่มีคำตอบนับไม่ถ้วนหมายถึงอะไร?',
        options: ['ตัวแปรที่เราสามารถกำหนดให้เป็นค่าคงที่ $t \\in \\mathbb{R}$ ใดๆ ก็ได้ แล้วหาค่าตัวแปรอื่นในรูปของ $t$', 'ตัวแปรที่มีค่าเท่ากับ 0 เสมอ', 'ตัวแปรที่ไม่ต้องคำนวณ', 'ตัวแปรที่ไม่มีอยู่จริง'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ตัวแปรอิสระมีค่าได้ทุกค่า ($t \\in \\mathbb{R}$) ไม่ได้ถูกบังคับให้เป็น $0$',
          'ยังต้องใช้ตัวแปรอิสระ $t$ ในการเขียนคำตอบของตัวแปรอื่น',
          'ตัวแปรอิสระมีอยู่จริงในระบบ เพียงแต่ไม่ถูกกำหนดค่าตายตัว'
        ],
        explanation: 'Free Variable คือตัวแปรที่เราสมมติให้เป็นพารามิเตอร์ $t$ แล้วแสดงคำตอบของตัวแปรอื่นในเทอมของ $t$'
      },
      {
        question: 'ตามผังมโนทัศน์ 4 เสาหลัก เมื่อได้โจทย์ระบบสมการใหม่ ควรทำขั้นตอนใดก่อนเลือกเครื่องมือคำนวณ?',
        options: ['ตีความประเภทคำตอบทันที', 'แปลงเป็นรูป $AX = B$ แล้วตรวจสอบ $\\det(A)$', 'เลือกกฎของคราเมอร์เสมอเพราะเร็วที่สุด', 'คำนวณ $A^{-1}$ ก่อนตรวจ $\\det(A)$'],
        correctIndex: 1,
        whyWrong: [
          'การตีความคำตอบเป็นขั้นสุดท้าย ต้องแปลงรูปและคำนวณก่อนจึงรู้ว่าเป็นคำตอบแบบใด',
          null,
          'ไม่มีวิธีใดดีที่สุดทุกกรณี — และถ้า $\\det(A) = 0$ คราเมอร์ใช้ไม่ได้เลย',
          'ถ้า $\\det(A) = 0$ จะหา $A^{-1}$ ไม่ได้ ควรตรวจ $\\det(A)$ ก่อนเพื่อไม่เสียเวลา'
        ],
        explanation: 'ลำดับของผังมโนทัศน์คือ แปลงรูป ($AX = B$ หรือ $[A \\mid B]$) แล้ววิเคราะห์สภาวะด้วย $\\det(A)$ จากนั้นเลือกเครื่องมือคำนวณ และตีความคำตอบเป็นขั้นสุดท้าย'
      },
      {
        question: 'ระบบ $x + y = 3$ และ $2x + 2y = 6$ มีคำตอบนับไม่ถ้วน ถ้ากำหนดตัวแปรอิสระ $y = t$ คำตอบทั่วไปคือข้อใด?',
        options: ['$x = t, \\; y = t$', '$x = 3, \\; y = 0$', '$x = 3 - t, \\; y = t$', '$x = 3 + t, \\; y = t$'],
        correctIndex: 2,
        whyWrong: [
          'ต้องหา $x$ จากสมการ $x + y = 3$ ไม่ใช่กำหนดให้เท่ากับ $t$ ด้วย (ตรวจ: $t + t = 3$ ไม่จริงทุกค่า $t$)',
          'นี่เป็นคำตอบเพียงชุดเดียว (กรณี $t = 0$) แต่ระบบมีคำตอบนับไม่ถ้วน ต้องเขียนในรูปทั่วไป',
          null,
          'ย้ายข้างผิดเครื่องหมาย: $x = 3 - y = 3 - t$'
        ],
        explanation: 'สมการที่สองคือสมการแรกคูณ 2 จึงเหลือสมการเดียว $x + y = 3$ ให้ $y = t$ จะได้ $x = 3 - t$ สำหรับทุก $t \\in \\mathbb{R}$'
      }
    ]
  },
  {
    id: 11,
    title: 'บทที่ 11: เมทริกซ์ในงานวิศวกรรมและไอซีที',
    subtitle: 'จากสถานการณ์จริงสู่ระบบสมการเชิงเส้น (Mathematical Modeling)',
    category: 'advanced',
    prerequisites: [9],
    estimatedMinutes: 25,
    description: 'ฝึกแปลงสถานการณ์ปลายเปิดทางวิศวกรรม (วงจรไฟฟ้า โครงสร้าง) และไอซีที (การเข้ารหัส กราฟิก เครือข่าย) ให้เป็นระบบสมการ AX = B',
    content: [
      {
        sectionTitle: '1. วิศวกรรมไฟฟ้า: กฎของเคอร์ชอฟฟ์ (Kirchhoff\'s Laws)',
        explanationText: 'ในการวิเคราะห์วงจรไฟฟ้าแบบหลายลูป วิศวกรใช้ **กฎแรงดันของเคอร์ชอฟฟ์ (KVL)**: ผลรวมแรงดันตกคร่อมรอบลูปปิดใดๆ เท่ากับศูนย์ เมื่อเขียนสมการรอบแต่ละลูปโดยให้ตัวแปรคือ "กระแสเมช" ($I_1, I_2, \\dots$) จะได้ระบบสมการเชิงเส้นที่มีเมทริกซ์สัมประสิทธิ์เป็นแบบพิเศษ (สมมาตร มีสมาชิกนอกแนวทแยงเป็นค่าตัวต้านทานร่วมติดลบ) ยิ่งวงจรมีหลายลูป ระบบสมการก็ยิ่งมีมิติสูงขึ้น',
        exampleSystem: {
          dimension: '2x2',
          A: [[6, -2], [-2, 8]],
          B: [10, 4],
          variables: ['I_1', 'I_2']
        },
        keyTakeaway: 'เมทริกซ์สัมประสิทธิ์ของวงจรไฟฟ้าหลายลูปมักมีลักษณะสมมาตร เพราะตัวต้านทานที่ใช้ร่วมกันระหว่างสองลูปมีค่าเท่ากันทั้งสองทิศทาง'
      },
      {
        sectionTitle: '2. วิศวกรรมโครงสร้าง: สมดุลแรงที่จุดต่อ (Static Equilibrium)',
        explanationText: 'ที่จุดต่อของโครงถัก (truss) แรงทุกแรงต้องสมดุลกันทั้งในแนวราบและแนวดิ่ง: $\\sum F_x = 0$ และ $\\sum F_y = 0$ เมื่อแตกแรงดึง/แรงอัดในแต่ละเส้นออกเป็นองค์ประกอบ x, y จะได้ระบบสมการเชิงเส้นที่ตัวแปรคือขนาดของแรงในแต่ละเส้น หากโครงถักมีจุดต่อและเส้นสมาชิกมากขึ้น ระบบสมการก็จะขยายเป็น 3x3 หรือใหญ่กว่า',
        keyTakeaway: 'ทุกสมการสมดุลแรงในสองมิติคือสมการเชิงเส้นหนึ่งสมการ จุดต่อยิ่งซับซ้อน ระบบสมการยิ่งมีมิติสูงขึ้น'
      },
      {
        sectionTitle: '3. ไอซีที: การเข้ารหัสและคอมพิวเตอร์กราฟิก',
        explanationText: 'วงการความมั่นคงปลอดภัยไซเบอร์ใช้แนวคิด **Hill Cipher**: เข้ารหัสด้วยการคูณเวกเตอร์ต้นฉบับด้วยเมทริกซ์กุญแจ $K$ ($C = KP$) การถอดรหัสจึงต้องหา $P = K^{-1}C$ นั่นคือ "กุญแจถอดรหัส" ก็คือเมทริกซ์ผกผันนั่นเอง ในทำนองเดียวกัน โปรแกรมกราฟิกใช้เมทริกซ์การแปลง (Transformation Matrix) หมุน/ย่อ-ขยายภาพ และใช้เมทริกซ์ผกผันเพื่อคำนวณฟังก์ชัน "Undo" ย้อนกลับการแปลง',
        keyTakeaway: 'ทุกครั้งที่ต้อง "ย้อนกลับ" ผลลัพธ์ของการแปลงเชิงเส้น ไม่ว่าจะถอดรหัสหรือ Undo ภาพ หัวใจคือการหาเมทริกซ์ผกผัน'
      }
    ],
    checkQuestions: [
      {
        question: 'ในระบบเข้ารหัสแบบ Hill Cipher ถ้าเมทริกซ์กุญแจ $K$ มี $\\det(K) = 0$ จะเกิดผลอย่างไร?',
        options: ['ไม่สามารถถอดรหัสกลับได้ เพราะหา $K^{-1}$ ไม่ได้', 'เข้ารหัสไม่ได้ตั้งแต่แรก', 'ข้อความจะสั้นลง', 'ไม่มีผลใดๆ'],
        correctIndex: 0,
        whyWrong: [
          null,
          'การเข้ารหัส $C = KP$ ใช้แค่การคูณจึงทำได้เสมอ — ปัญหาอยู่ที่การถอดรหัสซึ่งต้องใช้ $K^{-1}$',
          'การคูณเมทริกซ์ไม่เปลี่ยนความยาวข้อความ ขนาดเวกเตอร์ยังเท่าเดิม',
          'มีผลมาก — ไม่มี $K^{-1}$ จึงย้อนกลับไปหาข้อความต้นฉบับไม่ได้'
        ],
        explanation: 'การถอดรหัสต้องใช้ $K^{-1}$ ซึ่งหาไม่ได้เมื่อ $\\det(K)=0$ ผู้ออกแบบระบบเข้ารหัสจึงต้องเลือกกุญแจที่ดีเทอร์มิแนนต์ไม่เป็นศูนย์เสมอ',
      },
      {
        question: 'เมื่อวิเคราะห์วงจรไฟฟ้าด้วยกฎของเคอร์ชอฟฟ์แล้วได้ค่ากระแสเมชเป็นค่าลบ ควรตีความอย่างไร?',
        options: ['กระแสจริงไหลสวนทิศทางที่สมมติไว้ตอนตั้งสมการ', 'คำนวณผิดพลาดแน่นอน', 'วงจรลัดวงจร', 'ต้องตั้งสมการใหม่ทั้งหมด'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ค่าลบเป็นคำตอบที่ถูกต้องได้ มันบอกทิศทางของกระแส ไม่ได้บอกว่าคำนวณผิด',
          'การลัดวงจรไม่ได้ดูจากเครื่องหมายของกระแสเมช',
          'ไม่ต้องตั้งสมการใหม่ แค่ตีความว่ากระแสไหลสวนทิศที่สมมติไว้'
        ],
        explanation: 'เครื่องหมายลบในผลลัพธ์ทางวิศวกรรมมักสื่อถึงทิศทาง ไม่ใช่ข้อผิดพลาด นักเรียนควรฝึกตีความคำตอบกลับสู่บริบทจริงเสมอ (Polya ขั้นที่ 4)'
      },
      {
        question: 'ข้อใดคือขั้นตอนแรกที่ถูกต้องที่สุดเมื่อเจอโจทย์ประยุกต์ปลายเปิดทางวิศวกรรม/ไอซีที?',
        options: ['ระบุตัวแปรที่ต้องการหา และแปลงเงื่อนไขที่โจทย์กำหนดให้เป็นสมการเชิงเส้นทีละสมการ', 'เดาคำตอบจากประสบการณ์', 'คำนวณ det(A) ทันทีโดยยังไม่ตั้งสมการ', 'ข้ามไปดูเฉลยก่อน'],
        correctIndex: 0,
        whyWrong: [
          null,
          'การเดาไม่มีหลักประกัน ต้องสร้างแบบจำลองทางคณิตศาสตร์ก่อน',
          'ยังไม่ได้ตั้งสมการ จึงยังไม่มีเมทริกซ์ $A$ ให้หาดีเทอร์มิแนนต์',
          'การดูเฉลยข้ามขั้นตอนทำความเข้าใจปัญหา (Polya ขั้นที่ 1) ซึ่งเป็นทักษะที่ต้องฝึก'
        ],
        explanation: 'ตามกระบวนการของโพลยาขั้นที่ 1 (ทำความเข้าใจปัญหา) ต้องระบุตัวแปรและแปลงสถานการณ์จริงเป็นสมการก่อนเสมอ ก่อนจะเลือกวิธีคำนวณในขั้นที่ 2'
      },
      {
        question: 'ที่จุดต่อหนึ่งจุดของโครงถักในระนาบ 2 มิติ เขียนสมการสมดุลแรงได้กี่สมการ?',
        options: ['1 สมการ: $\\sum F = 0$ รวมทุกทิศทาง', '3 สมการเสมอ ตามจำนวนตัวแปร', 'ไม่มีสมการ เพราะแรงเป็นเวกเตอร์', '2 สมการ: $\\sum F_x = 0$ และ $\\sum F_y = 0$'],
        correctIndex: 3,
        whyWrong: [
          'แรงเป็นเวกเตอร์ ต้องสมดุลแยกทีละแนว จะรวมเป็นสมการเดียวไม่ได้',
          'จำนวนสมการที่จุดต่อมาจากจำนวนมิติ (2 แนว) ไม่ได้ขึ้นกับจำนวนตัวแปร',
          'ความเป็นเวกเตอร์คือเหตุผลที่ต้องแตกองค์ประกอบแนว $x, y$ ซึ่งให้สมการเชิงเส้น 2 สมการ',
          null
        ],
        explanation: 'แรงในระนาบแตกเป็นองค์ประกอบแนวราบและแนวดิ่ง จึงได้ $\\sum F_x = 0$ และ $\\sum F_y = 0$ จุดละ 2 สมการ ยิ่งมีจุดต่อมาก ระบบสมการยิ่งใหญ่ขึ้น'
      },
      {
        question: 'โปรแกรมกราฟิกแปลงภาพด้วยเมทริกซ์ $T$ (จุดใหม่ $= T \\cdot$ จุดเดิม) ถ้าผู้ใช้กด Undo โปรแกรมควรคูณจุดใหม่ด้วยเมทริกซ์ใด?',
        options: ['$T^{-1}$', '$T$ อีกครั้ง', '$-T$', '$T^T$ (Transpose)'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คูณ $T$ ซ้ำจะแปลงภาพซ้ำอีกรอบ (เช่น หมุนเพิ่ม) ไม่ใช่ย้อนกลับ',
          'การกลับเครื่องหมายไม่ได้ย้อนการแปลง — ต้องใช้เมทริกซ์ที่คูณกับ $T$ แล้วได้ $I$',
          'Transpose เท่ากับเมทริกซ์ผกผันเฉพาะการหมุนล้วนๆ ถ้ามีการย่อ/ขยายด้วยจะไม่เท่ากัน — วิธีที่ถูกเสมอคือ $T^{-1}$'
        ],
        explanation: 'จาก จุดใหม่ $= T \\cdot$ จุดเดิม คูณ $T^{-1}$ ทางซ้ายทั้งสองข้าง ได้ จุดเดิม $= T^{-1} \\cdot$ จุดใหม่ — Undo จึงคือการใช้เมทริกซ์ผกผัน แบบเดียวกับการถอดรหัส Hill Cipher'
      }
    ]
  },
  {
    id: 12,
    title: 'บทที่ 12: ระบบสมการขั้นสูง (มากกว่า 3 ตัวแปร)',
    subtitle: 'เมื่อ Cramer และ Inverse ไม่เพียงพอ: การขยายสู่เมทริกซ์แต่งเติมขนาด 4x4 ด้วย Gaussian Elimination',
    category: 'advanced',
    prerequisites: [8, 9],
    estimatedMinutes: 20,
    description: 'เรียนรู้ว่าทำไมงานวิศวกรรมและไอซีทีจริงจึงมีตัวแปรมากกว่า 3 ตัว และเหตุใด Gaussian Elimination จึงเป็นเครื่องมือเดียวที่ขยายขนาดได้จริง',
    content: [
      {
        sectionTitle: '1. ทำไมงานจริงจึงมีตัวแปรมากกว่า 3 ตัว',
        explanationText: 'วงจรไฟฟ้าที่มี 4 ลูปขึ้นไป โครงสร้างที่มีจุดต่อหลายจุด หรือระบบเครือข่ายที่มีเซิร์ฟเวอร์หลายสิบเครื่อง ล้วนให้ระบบสมการที่มีตัวแปรมากกว่า 3 ตัวทั้งสิ้น ในสถานการณ์เหล่านี้ **กฎของคราเมอร์และวิธีเมทริกซ์ผกผันแบบ Adjugate ที่เรียนมา (ใช้ได้ถึง 3x3) จะไม่สะดวกอีกต่อไป** เพราะต้องคำนวณดีเทอร์มิแนนต์ของเมทริกซ์ย่อยจำนวนมหาศาล',
        keyTakeaway: 'ยิ่งจำนวนตัวแปรเพิ่มขึ้น การหา det และ adjugate แบบขยาย cofactor ยิ่งซับซ้อนแบบก้าวกระโดด (O(N!))'
      },
      {
        sectionTitle: '2. Gaussian Elimination ขยายขนาดได้โดยไม่เปลี่ยนกฎ',
        explanationText: 'ข่าวดีคือ **กฎ ERO ทั้ง 3 ข้อ และขั้นตอนการทำเมทริกซ์แต่งเติมให้เป็นรูปขั้นบันได ใช้หลักการเดียวกันทุกประการไม่ว่าเมทริกซ์จะมีขนาด 2x2, 3x3, 4x4 หรือใหญ่กว่านั้น** เพียงแค่มีจำนวนแถวและคอลัมน์เพิ่มขึ้น การกำจัดตัวแปรทีละคอลัมน์ (pivot) ยังคงทำงานแบบเดิม นี่คือเหตุผลที่ซอฟต์แวร์วิศวกรรมทุกตัว (MATLAB, NumPy, SciPy) เลือกใช้ Gaussian Elimination เป็นแกนหลัก',
        exampleSystem: {
          dimension: '3x3',
          A: [[1, 1, 1], [2, -1, 1], [3, 1, -1]],
          B: [6, 3, 2],
          variables: ['x', 'y', 'z']
        },
        keyTakeaway: 'ไปทดลองแก้ระบบสมการ 4 ตัวแปรจริงได้ที่ "ห้องปฏิบัติการระบบสมการขั้นสูง (Higher-Order Lab)"'
      },
      {
        sectionTitle: '3. กลยุทธ์การเลือกวิธีเมื่อขนาดระบบเปลี่ยนไป (Polya ขั้นที่ 2)',
        explanationText: 'สรุปแนวทางเลือกวิธีตามขนาดของระบบสมการ:\n- **2x2 - 3x3:** เลือกได้ทั้ง Inverse, Cramer หรือ Gauss ตามความถนัด\n- **4x4 ขึ้นไป:** ใช้ **Gaussian Elimination เท่านั้น** เพราะ Cramer/Inverse (Adjugate) ไม่ได้สอนในระดับนี้และไม่คุ้มค่ากับการคำนวณด้วยมือ\n- **ระบบขนาดใหญ่มากในงานจริง (สิบ-ร้อยตัวแปร):** ใช้ซอฟต์แวร์คอมพิวเตอร์ (Python/NumPy, MATLAB) ซึ่งใช้ Gaussian Elimination เป็นอัลกอริทึมพื้นฐานอยู่ดี',
        keyTakeaway: 'การรู้ "ขีดจำกัดของแต่ละวิธี" เป็นทักษะการตัดสินใจเชิงวิศวกรรมที่สำคัญไม่แพ้การคำนวณให้ถูก'
      }
    ],
    checkQuestions: [
      {
        question: 'เพราะเหตุใดกฎของคราเมอร์จึงไม่เหมาะกับการแก้ระบบสมการ 4x4 ด้วยมือ?',
        options: ['ต้องคำนวณดีเทอร์มิแนนต์ของเมทริกซ์ 4x4 หลายชุด ซึ่งซับซ้อนมาก', 'กฎของคราเมอร์ใช้ไม่ได้กับจำนวนเต็ม', 'คราเมอร์ใช้ได้เฉพาะเมทริกซ์ที่ det(A) = 0 เท่านั้น', 'คราเมอร์ต้องใช้คอมพิวเตอร์เท่านั้น'],
        correctIndex: 0,
        whyWrong: [
          null,
          'คราเมอร์ใช้กับจำนวนเต็มได้ตามปกติ ปัญหาอยู่ที่ปริมาณการคำนวณ',
          'กลับกัน — คราเมอร์ใช้ไม่ได้เมื่อ $\\det(A) = 0$',
          'คำนวณด้วยมือได้ในทางทฤษฎี แต่ช้าและเสี่ยงผิดมาก จึง "ไม่เหมาะ" ไม่ใช่ "ใช้ไม่ได้"'
        ],
        explanation: 'กฎของคราเมอร์สำหรับระบบ N ตัวแปร ต้องคำนวณดีเทอร์มิแนนต์ N+1 ชุด แต่ละชุดขนาด NxN ทำให้ปริมาณการคำนวณเพิ่มขึ้นอย่างรวดเร็วเมื่อ N โต'
      },
      {
        question: 'ขั้นตอน ERO (Elementary Row Operations) เปลี่ยนแปลงไปหรือไม่เมื่อขยายจากระบบ 3x3 ไปเป็น 4x4?',
        options: ['ไม่เปลี่ยน ใช้กฎ 3 ข้อเดิมทุกประการ เพียงมีแถว/คอลัมน์เพิ่มขึ้น', 'ต้องเปลี่ยนกฎใหม่ทั้งหมด', 'ใช้ไม่ได้กับระบบ 4x4', 'ต้องใช้ Cramer แทน'],
        correctIndex: 0,
        whyWrong: [
          null,
          'กฎ ERO 3 ข้อเดิมใช้ได้กับทุกขนาด นี่คือจุดแข็งของ Gaussian Elimination',
          'Gaussian Elimination ใช้กับ 4x4 ได้ตามปกติ — ลองได้ใน Higher-Order Lab',
          'คราเมอร์ไม่เหมาะกับ 4x4 เพราะต้องหาดีเทอร์มิแนนต์ 4x4 ถึง 5 ชุด'
        ],
        explanation: 'จุดเด่นของ Gaussian Elimination คือกฎ ERO เดิมใช้ได้กับเมทริกซ์ทุกขนาด ทำให้ขยายไปยังระบบมิติสูงได้โดยไม่ต้องเรียนวิธีใหม่'
      },
      {
        question: 'ระบบเครือข่ายที่มีเซิร์ฟเวอร์ 10 เครื่อง ให้ระบบสมการ 10 ตัวแปร ซอฟต์แวร์วิศวกรรมอย่าง NumPy มักใช้อัลกอริทึมพื้นฐานใดในการแก้ระบบนี้?',
        options: ['Gaussian Elimination (หรือรูปแบบที่พัฒนาต่อ เช่น LU Decomposition)', 'การเดาสุ่มแทนค่า', 'กฎของคราเมอร์', 'การวาดกราฟ 10 มิติ'],
        correctIndex: 0,
        whyWrong: [
          null,
          'ซอฟต์แวร์ต้องได้คำตอบแม่นยำและทำซ้ำได้ การเดาสุ่มไม่รับประกันผลลัพธ์',
          'คราเมอร์ต้องหาดีเทอร์มิแนนต์ $10 \\times 10$ ถึง 11 ชุด ช้าเกินไปแม้สำหรับคอมพิวเตอร์',
          'กราฟ 10 มิติวาดไม่ได้ในทางปฏิบัติ'
        ],
        explanation: 'ซอฟต์แวร์วิศวกรรมเกือบทั้งหมดใช้ Gaussian Elimination หรืออนุพันธ์ของมัน (เช่น LU Decomposition) เป็นแกนหลักในการแก้ระบบสมการเชิงเส้นขนาดใหญ่'
      },
      {
        question: 'ตามกลยุทธ์ในบทเรียน สำหรับระบบสมการ 4x4 ที่แก้ด้วยมือในห้องเรียน ควรเลือกวิธีใด?',
        options: ['Cramer\'s Rule', 'Gaussian Elimination', 'Inverse Matrix ด้วย Adjugate', 'เลือกได้ทั้ง 3 วิธีตามความถนัด เหมือนระบบ 2x2'],
        correctIndex: 1,
        whyWrong: [
          'ต้องหาดีเทอร์มิแนนต์ 4x4 ถึง 5 ชุด และแต่ละชุดยังต้องกระจายเป็นดีเทอร์มิแนนต์ 3x3 อีก 4 ชุด',
          null,
          'ต้องหา Cofactor ถึง 16 ตัว แต่ละตัวเป็นดีเทอร์มิแนนต์ 3x3 — ไม่คุ้มค่าเมื่อทำด้วยมือ',
          'การเลือกตามความถนัดใช้กับ 2x2 - 3x3 เท่านั้น เมื่อถึง 4x4 ขีดจำกัดของ Cramer/Inverse ทำให้เหลือ Gaussian Elimination'
        ],
        explanation: 'ระดับ 4x4 ขึ้นไปใช้ Gaussian Elimination เท่านั้น เพราะ Cramer/Inverse (Adjugate) ต้องหาดีเทอร์มิแนนต์ของเมทริกซ์ย่อยจำนวนมาก ไม่คุ้มค่ากับการคำนวณด้วยมือ'
      },
      {
        question: 'วงจรไฟฟ้าที่มี 5 ลูปอิสระ เมื่อวิเคราะห์ด้วยกระแสเมช จะได้ระบบสมการกี่ตัวแปร?',
        options: ['3 ตัวแปรเสมอ เพราะระบบสมการมีได้ไม่เกิน 3 ตัวแปร', '2 ตัวแปร เพราะวงจรวาดอยู่บนระนาบ', '5 ตัวแปร (กระแสเมชลูปละ 1 ตัว)', '10 ตัวแปร (ลูปละ 2 ตัว)'],
        correctIndex: 2,
        whyWrong: [
          'ระบบสมการมีตัวแปรได้ไม่จำกัด 3 ตัวแปรเป็นเพียงขนาดที่ฝึกด้วยมือในบทก่อนๆ',
          'การวาดวงจรบนระนาบไม่ได้จำกัดจำนวนตัวแปร — จำนวนตัวแปรมาจากจำนวนลูป',
          null,
          'กระแสเมชมีลูปละ 1 ตัว ($I_1$ ถึง $I_5$) ไม่ใช่ 2 ตัว'
        ],
        explanation: 'แต่ละลูปมีกระแสเมช 1 ตัวและให้สมการ KVL 1 สมการ วงจร 5 ลูปจึงได้ระบบ 5 สมการ 5 ตัวแปร — งานจริงจึงมักมีตัวแปรเกิน 3 ตัว'
      }
    ]
  }
];

const LOCAL_STORE_KEY = 'matrix_master_progress_v3';
const TEACHER_SETTINGS_KEY = 'matrix_master_teacher_settings_v3';

export const defaultStudentProgress: StudentProgress = {
  studentName: 'นักเรียนใหม่',
  xp: 0,
  completedLessons: [],
  lessonScores: {},
  preTestCompleted: false,
  preTestScore: 0,
  preTestAnswers: {},
  postTestCompleted: false,
  postTestScore: 0,
  postTestAnswers: {},
  topicMastery: {
    matrixNotation: 0,
    determinant: 0,
    inverseMethod: 0,
    cramerRule: 0,
    gaussianElimination: 0,
    solutionTypes: 0
  },
  errorLog: [],
  earnedBadges: [],
  checkQuestionXpAwarded: [],
  checkQuestionFirstTryMissed: [],
  matrixLabGaussCompleted: false,
  higherOrderLabCompleted: false,
  methodsUsed: [],
  activityDates: [],
  hasCompletedSurvey: false
};

export const defaultTeacherSettings: TeacherSettings = {
  masteryThreshold: 70,
  enableAiTutor: true,
  enableHints: true,
  enableXp: true,
  enableBadges: true
};

export function loadStudentProgress(): StudentProgress {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return defaultStudentProgress;
    return { ...defaultStudentProgress, ...JSON.parse(raw) };
  } catch {
    return defaultStudentProgress;
  }
}

export function saveStudentProgress(progress: StudentProgress, options: { skipClassroomSync?: boolean } = {}): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Failed to save student progress:', err);
  }
  // Best-effort push to the teacher's roster if this student joined a class (Phase 2).
  // No-ops silently when no class was joined, or when offline — see classroomSync.ts.
  // skipClassroomSync is for local-only changes where a sync would carry nothing new but its
  // timing could leak something — e.g. marking the anonymous survey done, where a roster
  // lastSyncedAt stamped at the moment of submission could be lined up with the response.
  if (!options.skipClassroomSync) void syncProgressToClassroom(progress);
}

export function loadTeacherSettings(): TeacherSettings {
  try {
    const raw = localStorage.getItem(TEACHER_SETTINGS_KEY);
    if (!raw) return defaultTeacherSettings;
    return { ...defaultTeacherSettings, ...JSON.parse(raw) };
  } catch {
    return defaultTeacherSettings;
  }
}

export function saveTeacherSettings(settings: TeacherSettings): void {
  try {
    localStorage.setItem(TEACHER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save teacher settings:', err);
  }
}
