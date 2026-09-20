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
    explanation: string;
  }[];
}

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
  checkQuestionXpAwarded: string[];
}

// A check-question is a much smaller unit of effort than finishing a whole lesson (+50 XP,
// LessonView.tsx) or a live in-class poll question (LIVE_POLL_CORRECT_XP = 10,
// livePollStore.ts) — it's just confirming understanding of one fact while reading. Kept
// smaller than both so the XP scale still reflects relative effort/stakes.
export const CHECK_QUESTION_CORRECT_XP = 5;

// Completing a full Pre-Test or Post-Test (10 questions, requires actually knowing/recalling
// material across the whole course) is a bigger one-time effort than a single check-question
// but smaller than the accumulated XP from studying and completing several lessons — so it
// sits between the two on the same scale.
export const DIAGNOSTIC_TEST_XP = 25;

export interface TeacherSettings {
  masteryThreshold: number; // default 70
  exerciseDifficulty: 'Easy' | 'Medium' | 'Hard';
  questionsPerSet: number; // 5, 10, 20
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
        explanation: 'เมื่อแทนค่า $x = 2, y = 1$ ในสมการ $2(2) + 1 = 5$ (ถูกต้อง) และ $2 - 1 = 1$ (ถูกต้อง)'
      },
      {
        question: 'หากกราฟของระบบสมการเป็นเส้นตรงสองเส้นที่ขนานกันและไม่ตัดกันเลย ระบบสมการนี้จะมีคำตอบอย่างไร?',
        options: ['มี 1 คำตอบเดียว', 'ไม่มีคำตอบ (No Solution)', 'มีคำตอบนับไม่ถ้วน', 'มี 2 คำตอบ'],
        correctIndex: 1,
        explanation: 'เส้นตรงขนานกันไม่มีจุดตัดร่วมกันเลย จึงไม่มีค่า $(x, y)$ ใดที่สอดคล้องกับทั้งสองสมการพร้อมกัน'
      },
      {
        question: 'ในสมการเชิงเส้น ตัวแปรแต่ละตัวจะมีกำลังสูงสุดเท่ากับเท่าใด?',
        options: ['กำลัง 0', 'กำลัง 1', 'กำลัง 2', 'ขึ้นอยู่กับจำนวนสมการ'],
        correctIndex: 1,
        explanation: 'สมการเชิงเส้น (Linear) ตัวแปรทุกตัวต้องมีเลขชี้กำลังเป็น 1 เสมอ'
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
        explanation: 'เมทริกซ์ $A$ เก็บเฉพาะสัมปสิทธิ์หน้า $x$ และ $y$ คือ แถวที่ 1 $[3, 2]$ และ แถวที่ 2 $[1, -1]$'
      },
      {
        question: 'เมทริกซ์ $B$ ในรูปแบบ $AX = B$ สื่อถึงสิ่งใดในระบบสมการเชิงเส้น?',
        options: ['สัมปสิทธิ์หน้าตัวแปร', 'ค่าตัวแปรที่ต้องการหาคำตอบ', 'ตัวเลขค่าคงที่ทางขวามือของสมการ', 'ผลคูณของตัวแปร'],
        correctIndex: 2,
        explanation: 'เมทริกซ์ $B$ คือ Vector หลักที่บรรจุตัวเลขค่าคงที่ทางขวาของเครื่องหมายเท่ากับ'
      },
      {
        question: 'หากระบบสมการมี 3 ตัวแปร $(x, y, z)$ เมทริกซ์ตัวแปร $X$ จะมีมิติเป็นเท่าใด?',
        options: ['$1 \\times 3$', '$3 \\times 1$', '$3 \\times 3$', '$2 \\times 3$'],
        correctIndex: 1,
        explanation: 'เมทริกซ์ $X$ จะเป็น Column Matrix ขนาด $3 \\times 1$ ประกอบด้วยตัวแปร $x, y, z$ ตามลำดับแนวตั้ง'
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
        explanation: '$\\det(A) = (4 \\times 3) - (2 \\times 1) = 12 - 2 = 10$'
      },
      {
        question: 'หากคำนวณพบว่า $\\det(A) = 0$ ข้อสรุปใดเกี่ยวกับเมทริกซ์ $A$ ที่ถูกต้องที่สุด?',
        options: ['เมทริกซ์ $A$ หา Inverse Matrix $A^{-1}$ ไม่ได้', 'ระบบสมการมีคำตอบเดียวแน่นอน', '$A$ เป็น Identity Matrix', '$\\det(A^{-1}) = 1$'],
        correctIndex: 0,
        explanation: 'เมื่อ $\\det(A) = 0$ จะทำให้ตัวหารในสูตร $A^{-1} = \\frac{1}{\\det(A)} \\operatorname{adj}(A)$ เป็น 0 จึงหา $A^{-1}$ ไม่ได้'
      },
      {
        question: 'ค่า $\\det(A)$ ของ $A = \\begin{bmatrix} 1 & 0 & 2 \\\\ 0 & 3 & 0 \\\\ 4 & 0 & 5 \\end{bmatrix}$ มีค่าเท่าใด?',
        options: ['-9', '15', '3', '-3'],
        correctIndex: 0,
        explanation: 'กระจายโคแฟกเตอร์ตามแถวที่ 2: $3 \\times \\det\\begin{bmatrix} 1 & 2 \\\\ 4 & 5 \\end{bmatrix} = 3 \\times (5 - 8) = 3 \\times (-3) = -9$'
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
        explanation: 'สลับ $a=2, d=-1$ ได้ $[-1, 2]$ และเปลี่ยนเครื่องหมาย $b=1, c=1$ ได้ $[-1, -1]$ รวมเป็น $\\begin{bmatrix} -1 & -1 \\\\ -1 & 2 \\end{bmatrix}$'
      },
      {
        question: 'เมทริกซ์ผกผัน $A^{-1}$ สามารถคำนวณได้เมื่อเงื่อนไขใดเป็นจริง?',
        options: ['$\\det(A) = 0$', '$\\det(A) \\neq 0$', '$A$ เป็นเมทริกซ์แนวเฉียงเท่านั้น', '$A$ มีขนาด $2 \\times 3$'],
        correctIndex: 1,
        explanation: '$A^{-1}$ หาได้เฉพาะเมื่อ $\\det(A) \\neq 0$ เท่านั้น เพื่อให้ $1/\\det(A)$ มีค่าทางคณิตศาสตร์'
      },
      {
        question: 'ถ้า $A = \\begin{bmatrix} 3 & 0 \\\\ 0 & 2 \\end{bmatrix}$ ข้อใดคือเมทริกซ์ผกผัน $A^{-1}$?',
        options: ['$\\begin{bmatrix} 1/3 & 0 \\\\ 0 & 1/2 \\end{bmatrix}$', '$\\begin{bmatrix} 2 & 0 \\\\ 0 & 3 \\end{bmatrix}$', '$\\begin{bmatrix} -3 & 0 \\\\ 0 & -2 \\end{bmatrix}$', '$\\begin{bmatrix} 1/2 & 0 \\\\ 0 & 1/3 \\end{bmatrix}$'],
        correctIndex: 0,
        explanation: '$\\det(A) = 6$ และ $\\operatorname{adj}(A) = \\begin{bmatrix} 2 & 0 \\\\ 0 & 3 \\end{bmatrix}$ นำ $1/6$ คูณจะได้ $\\begin{bmatrix} 2/6 & 0 \\\\ 0 & 3/6 \\end{bmatrix} = \\begin{bmatrix} 1/3 & 0 \\\\ 0 & 1/2 \\end{bmatrix}$'
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
        explanation: 'ต้องคูณ $A^{-1}$ ทางซ้ายของสมการเสมอ เพื่อให้ $A^{-1}A = I$ ได้ $X = A^{-1}B$'
      },
      {
        question: 'ถ้า $A^{-1} = \\begin{bmatrix} 1/3 & 1/3 \\\\ 1/3 & -2/3 \\end{bmatrix}$ และ $B = \\begin{bmatrix} 5 \\\\ 1 \\end{bmatrix}$ ค่าของ $X = A^{-1}B$ เท่ากับเท่าใด?',
        options: ['$\\begin{bmatrix} 2 \\\\ 1 \\end{bmatrix}$', '$\\begin{bmatrix} 1 \\\\ 2 \\end{bmatrix}$', '$\\begin{bmatrix} 3 \\\\ 0 \\end{bmatrix}$', '$\\begin{bmatrix} 5 \\\\ 1 \\end{bmatrix}$'],
        correctIndex: 0,
        explanation: '$x = (1/3)(5) + (1/3)(1) = 6/3 = 2$ และ $y = (1/3)(5) + (-2/3)(1) = 3/3 = 1$'
      },
      {
        question: 'วิธีแก้ระบบสมการด้วย $X = A^{-1}B$ จะล้มเหลวไม่สามารถหาคำตอบได้ในกรณีใด?',
        options: ['เมื่อ $\\det(A) = 0$', 'เมื่อเมทริกซ์ $B$ มีสมาชิกเป็นลบ', 'เมื่อ $A$ มีขนาด $3 \\times 3$', 'เมื่อตัวแปรมีค่าเป็นเศษส่วน'],
        correctIndex: 0,
        explanation: 'เมื่อ $\\det(A) = 0$ เมทริกซ์ $A$ ไม่มี Inverse Matrix ($A^{-1}$) จึงใช้วิธีนี้ไม่ได้'
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
        explanation: '$A_x$ เกิดจากการนำ Column Vector $B$ ไปแทนที่คอลัมน์แรก (คอลัมน์ของ $x$) ในเมทริกซ์ $A$'
      },
      {
        question: 'ถ้าระบบสมการมี $\\det(A) = -3$ และเมื่อสร้าง $A_y$ ได้ $\\det(A_y) = -3$ ค่าของ $y$ คือเท่าใด?',
        options: ['$y = 1$', '$y = -1$', '$y = 9$', '$y = 0$'],
        correctIndex: 0,
        explanation: '$y = \\frac{\\det(A_y)}{\\det(A)} = \\frac{-3}{-3} = 1$'
      },
      {
        question: 'ข้อดีที่โดดเด่นที่สุดของกฎของคราเมอร์เมื่อเทียบกับวิธี $X = A^{-1}B$ คือข้อใด?',
        options: ['สามารถหาค่าตัวแปรเฉพาะตัวที่ต้องการได้โดยไม่ต้องหาตัวแปรอื่น', 'ไม่ต้องหา Determinant เลย', 'ใช้ได้กับระบบสมการที่ det(A) = 0', 'ใช้ได้กับเมทริกซ์ทุกมิติไม่จำเป็นต้องเป็นจัตุรัส'],
        correctIndex: 0,
        explanation: 'คราเมอร์ช่วยให้เราหาเฉพาะค่า $x$ หรือ $y$ ได้โดยตรงจาก $\\det(A_x)/\\det(A)$'
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
        explanation: 'มี 2 แถว (สมการ) และ 4 คอลัมน์ (คอลัมน์สัมปสิทธิ์ 3 ตัวแปร + คอลัมน์ค่าคงที่ B 1 คอลัมน์ = 4)'
      },
      {
        question: 'หากในกระบวนการคำนวณพบแถวหนึ่งเป็น $\\left[\\begin{array}{cc|c} 0 & 0 & 0 \\end{array}\\right]$ แสดงว่าอย่างไร?',
        options: ['สมการแถวนั้นกลายเป็น $0 = 0$ ซึ่งเป็นจริงเสมอ', 'ระบบสมการไม่มีคำตอบ', 'คำนวณผิดพลาด', 'ตัวแปรทุกตัวมีค่าเท่ากับ 0'],
        correctIndex: 0,
        explanation: 'แถว $[0 \\quad 0 \\mid 0]$ หมายถึง $0x + 0y = 0$ ซึ่งเป็นจริงเสมอ บ่งบอกถึงการมีตัวแปรอิสระ (Infinite Solutions)'
      },
      {
        question: 'หากแถวสุดท้ายของเมทริกซ์แต่งเติมกลายเป็น $\\left[\\begin{array}{cc|c} 0 & 0 & 5 \\end{array}\\right]$ แสดงว่าอย่างไร?',
        options: ['ระบบสมการไม่มีคำตอบ (No Solution)', 'ระบบสมการมีคำตอบเดียวคือ $y = 5$', 'ระบบสมการมีคำตอบนับไม่ถ้วน', 'ต้องสลับแถวใหม่'],
        correctIndex: 0,
        explanation: 'แถว $[0 \\quad 0 \\mid 5]$ หมายถึง $0x + 0y = 5$ ซึ่งเป็นเท็จ ขัดแย้งทางคณิตศาสตร์ จึงไม่มีคำตอบ'
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
        explanation: 'ห้ามคูณแถวด้วย 0 เด็ดขาด เพราะจะทำให้ข้อมูลสมการถูกทำลายกลายเป็น $0=0$'
      },
      {
        question: 'คุณลักษณะสำคัญของเมทริกซ์ในรูป Row Echelon Form (REF) คือข้อใด?',
        options: ['สมาชิกที่อยู่ใต้ตัวนำ 1 ในทุกคอลัมน์ต้องเป็น 0 ทั้งหมด', 'สมาชิกทุกตัวนอกเส้นทแยงมุมหลักเป็น 0', 'เป็นเมทริกซ์เอกลักษณ์ $I$', 'จำนวนแถวต้องมากกว่าจำนวนคอลัมน์'],
        correctIndex: 0,
        explanation: 'รูป REF กำหนดให้สมาชิกใต้ตัวนำ 1 (Leading 1) ในคอลัมน์เดียวกันต้องกลายเป็น 0 ทั้งหมด'
      },
      {
        question: 'กระบวนการหาค่าตัวแปรหลังจากแปลงเมทริกซ์แต่งเติมให้อยู่ในรูปสามเหลี่ยมบนเรียกว่าอะไร?',
        options: ['การแทนค่าย้อนกลับ (Back-Substitution)', 'การหา Adjugate', 'การกระจายโคแฟกเตอร์', 'การสลับคอลัมน์'],
        correctIndex: 0,
        explanation: 'เมื่อได้รูปสามเหลี่ยมบน เราจะทราบค่าตัวแปรสุดท้าย แล้วแทนค่าย้อนกลับขึ้นไปยังสมการบนๆ'
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
        explanation: 'Gaussian Elimination มีความซับซ้อนเพียง $O(N^3)$ ในขณะที่วิธีอื่นใช้การคำนวณมหาศาล $O(N!)$'
      },
      {
        question: 'หากมีโครงสร้างระบบ $A$ คงเดิม แต่ต้องการแก้คำตอบสำหรับ $B_1, B_2, B_3, B_4$ หลายๆ ชุด วิธีใดเหมาะสมที่สุด?',
        options: ['หา Inverse Matrix $A^{-1}$ ครั้งเดียว แล้วนำไปคูณกับ $B$ แต่ละชุด ($A^{-1}B$)', 'ใช้ Cramer\'s Rule ใหม่ทั้งหมด 4 รอบ', 'สุ่มแทนค่าทีละตัวแปร', 'วาดกราฟ 4 ครั้ง'],
        correctIndex: 0,
        explanation: 'การคำนวณ $A^{-1}$ ไว้ครั้งเดียว แล้วนำไปคูณ $B_1, B_2, B_3, B_4$ ช่วยประหยัดเวลาคำนวณได้อย่างมาก'
      },
      {
        question: 'ข้อจำกัดร่วมกันของวิธี Inverse Matrix ($A^{-1}B$) และ Cramer\'s Rule คือข้อใด?',
        options: ['ใช้ได้เฉพาะเมื่อเมทริกซ์ $A$ เป็นเมทริกซ์จัตุรัสและ $\\det(A) \\neq 0$ เท่านั้น', 'ใช้ได้เฉพาะระบบสมการ 2 ตัวแปรเท่านั้น', 'ไม่สามารถใช้คำนวณด้วยมือได้', 'ต้องเปลี่ยนทุกตัวเลขเป็นทศนิยม'],
        correctIndex: 0,
        explanation: 'ทั้งสองวิธีต้องหารด้วย $\\det(A)$ จึงใช้ได้เฉพาะเมื่อ $A$ เป็นเมทริกซ์จัตุรัสและ $\\det(A) \\neq 0$'
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
        explanation: 'แถวสุดท้ายแสดงถึง $0x + 0y + 0z = 8$ ซึ่งก็คือ $0 = 8$ เป็นความขัดแย้งทางคณิตศาสตร์ จึงไม่มีคำตอบ'
      },
      {
        question: 'ถ้าระบบสมการ 3 ตัวแปร มีแถวสุดท้ายเป็น $\\left[\\begin{array}{ccc|c} 0 & 0 & 0 & 0 \\end{array}\\right]$ โดยไม่มีแถวขัดแย้งใดๆ ระบบสมการนี้จะมีลักษณะคำตอบแบบใด?',
        options: ['มีคำตอบนับไม่ถ้วน (Infinite Solutions) โดยมีตัวแปรอิสระ', 'มีคำตอบเดียว', 'ไม่มีคำตอบ', 'มี 3 คำตอบ'],
        correctIndex: 0,
        explanation: 'แถว $0 = 0$ สื่อว่าสมการหนึ่งลดรูปหายไป ทำให้เหลือจำนวนสมการน้อยกว่าจำนวนตัวแปร จึงมีคำตอบนับไม่ถ้วน'
      },
      {
        question: 'ตัวแปรอิสระ (Free Variable) ในระบบสมการที่มีคำตอบนับไม่ถ้วนหมายถึงอะไร?',
        options: ['ตัวแปรที่เราสามารถกำหนดให้เป็นค่าคงที่ $t \\in \\mathbb{R}$ ใดๆ ก็ได้ แล้วหาค่าตัวแปรอื่นในรูปของ $t$', 'ตัวแปรที่มีค่าเท่ากับ 0 เสมอ', 'ตัวแปรที่ไม่ต้องคำนวณ', 'ตัวแปรที่ไม่มีอยู่จริง'],
        correctIndex: 0,
        explanation: 'Free Variable คือตัวแปรที่เราสมมติให้เป็นพารามิเตอร์ $t$ แล้วแสดงคำตอบของตัวแปรอื่นในเทอมของ $t$'
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
        explanation: 'การถอดรหัสต้องใช้ $K^{-1}$ ซึ่งหาไม่ได้เมื่อ $\\det(K)=0$ ผู้ออกแบบระบบเข้ารหัสจึงต้องเลือกกุญแจที่ดีเทอร์มิแนนต์ไม่เป็นศูนย์เสมอ',
      },
      {
        question: 'เมื่อวิเคราะห์วงจรไฟฟ้าด้วยกฎของเคอร์ชอฟฟ์แล้วได้ค่ากระแสเมชเป็นค่าลบ ควรตีความอย่างไร?',
        options: ['กระแสจริงไหลสวนทิศทางที่สมมติไว้ตอนตั้งสมการ', 'คำนวณผิดพลาดแน่นอน', 'วงจรลัดวงจร', 'ต้องตั้งสมการใหม่ทั้งหมด'],
        correctIndex: 0,
        explanation: 'เครื่องหมายลบในผลลัพธ์ทางวิศวกรรมมักสื่อถึงทิศทาง ไม่ใช่ข้อผิดพลาด นักเรียนควรฝึกตีความคำตอบกลับสู่บริบทจริงเสมอ (Polya ขั้นที่ 4)'
      },
      {
        question: 'ข้อใดคือขั้นตอนแรกที่ถูกต้องที่สุดเมื่อเจอโจทย์ประยุกต์ปลายเปิดทางวิศวกรรม/ไอซีที?',
        options: ['ระบุตัวแปรที่ต้องการหา และแปลงเงื่อนไขที่โจทย์กำหนดให้เป็นสมการเชิงเส้นทีละสมการ', 'เดาคำตอบจากประสบการณ์', 'คำนวณ det(A) ทันทีโดยยังไม่ตั้งสมการ', 'ข้ามไปดูเฉลยก่อน'],
        correctIndex: 0,
        explanation: 'ตามกระบวนการของโพลยาขั้นที่ 1 (ทำความเข้าใจปัญหา) ต้องระบุตัวแปรและแปลงสถานการณ์จริงเป็นสมการก่อนเสมอ ก่อนจะเลือกวิธีคำนวณในขั้นที่ 2'
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
        explanation: 'กฎของคราเมอร์สำหรับระบบ N ตัวแปร ต้องคำนวณดีเทอร์มิแนนต์ N+1 ชุด แต่ละชุดขนาด NxN ทำให้ปริมาณการคำนวณเพิ่มขึ้นอย่างรวดเร็วเมื่อ N โต'
      },
      {
        question: 'ขั้นตอน ERO (Elementary Row Operations) เปลี่ยนแปลงไปหรือไม่เมื่อขยายจากระบบ 3x3 ไปเป็น 4x4?',
        options: ['ไม่เปลี่ยน ใช้กฎ 3 ข้อเดิมทุกประการ เพียงมีแถว/คอลัมน์เพิ่มขึ้น', 'ต้องเปลี่ยนกฎใหม่ทั้งหมด', 'ใช้ไม่ได้กับระบบ 4x4', 'ต้องใช้ Cramer แทน'],
        correctIndex: 0,
        explanation: 'จุดเด่นของ Gaussian Elimination คือกฎ ERO เดิมใช้ได้กับเมทริกซ์ทุกขนาด ทำให้ขยายไปยังระบบมิติสูงได้โดยไม่ต้องเรียนวิธีใหม่'
      },
      {
        question: 'ระบบเครือข่ายที่มีเซิร์ฟเวอร์ 10 เครื่อง ให้ระบบสมการ 10 ตัวแปร ซอฟต์แวร์วิศวกรรมอย่าง NumPy มักใช้อัลกอริทึมพื้นฐานใดในการแก้ระบบนี้?',
        options: ['Gaussian Elimination (หรือรูปแบบที่พัฒนาต่อ เช่น LU Decomposition)', 'การเดาสุ่มแทนค่า', 'กฎของคราเมอร์', 'การวาดกราฟ 10 มิติ'],
        correctIndex: 0,
        explanation: 'ซอฟต์แวร์วิศวกรรมเกือบทั้งหมดใช้ Gaussian Elimination หรืออนุพันธ์ของมัน (เช่น LU Decomposition) เป็นแกนหลักในการแก้ระบบสมการเชิงเส้นขนาดใหญ่'
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
  checkQuestionXpAwarded: []
};

export const defaultTeacherSettings: TeacherSettings = {
  masteryThreshold: 70,
  exerciseDifficulty: 'Medium',
  questionsPerSet: 10,
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

export function saveStudentProgress(progress: StudentProgress): void {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Failed to save student progress:', err);
  }
  // Best-effort push to the teacher's roster if this student joined a class (Phase 2).
  // No-ops silently when no class was joined, or when offline — see classroomSync.ts.
  void syncProgressToClassroom(progress);
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
