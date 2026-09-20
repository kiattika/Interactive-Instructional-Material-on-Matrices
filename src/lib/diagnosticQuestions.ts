import { TopicKey } from './topics';

export interface Question {
  id: string;
  topic: TopicKey;
  topicLabel: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// Deterministic, curriculum-grounded advice per topic — shown alongside (not instead of)
// the on-demand AI-generated practice problem on the results view.
export const TOPIC_ADVICE: Record<TopicKey, string> = {
  matrixNotation: 'แนะนำให้ทบทวนบทเรียนที่ 2 เรื่องการแปลงระบบสมการให้อยู่ในรูป AX = B',
  determinant: 'แนะนำให้ทบทวนบทเรียนที่ 3 เรื่องการหาค่า det(A) และกฎเครื่องหมาย',
  inverseMethod: 'แนะนำให้ทบทวนบทเรียนที่ 5 เรื่องการแก้ระบบสมการด้วย A⁻¹B',
  cramerRule: 'ควรระวังการสลับตำแหน่งคอลัมน์ค่าคงที่ B ลงในเมทริกซ์ Ax หรือ Ay',
  gaussianElimination: 'แนะนำให้ฝึกปฏิบัติใน Matrix Lab หัวข้อ Row Operations (ERO)',
  solutionTypes: 'แนะนำให้ทบทวนบทเรียนที่ 10 เรื่องการจำแนกประเภทคำตอบ'
};

// Pre-Test and Post-Test are separate, parallel 10-question forms — NOT the same bank shown
// twice. Reusing one bank let a student memorize Pre-Test answers and repeat them verbatim on
// the Post-Test, which defeated the point of measuring real learning gain. Each Post-Test
// question tests the SAME skill as its Pre-Test counterpart at an equivalent difficulty, with
// different numbers/scenario — see the paired comments below. Both forms use the same
// per-topic weighting: inverseMethod/cramerRule/gaussianElimination (the three solution
// methods compared in Lesson 9) get 2 questions each; matrixNotation and solutionTypes, each a
// single foundational concept, get 1.
export const PRE_TEST_QUESTIONS: Question[] = [
  {
    id: 'pre1',
    topic: 'matrixNotation',
    topicLabel: 'การเขียนรูป AX = B',
    text: 'ระบบสมการ 2x + 3y = 7 และ x - 4y = 2 สามารถเขียนในรูปเมทริกซ์ $AX = B$ ได้อย่างไร?',
    options: [
      '$A = \\begin{bmatrix} 2 & 3 \\\\[0.5em] 1 & -4 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 7 & 2 \\\\[0.5em] 2 & 3 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 1 \\\\[0.5em] -4 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 2 & 1 \\\\[0.5em] 3 & -4 \\end{bmatrix}, \\quad X = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}, \\quad B = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 3 & 2 \\\\[0.5em] -4 & 1 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 7 \\\\[0.5em] 2 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'เมทริกซ์ A เก็บสัมประสิทธิ์ [2, 3] และ [1, -4], X เก็บ [x, y] และ B เก็บ [7, 2]'
  },
  {
    id: 'pre2',
    topic: 'determinant',
    topicLabel: 'Determinant',
    text: 'ค่าดีเทอร์มิแนนต์ของเมทริกซ์ $A = \\begin{bmatrix} 3 & 1 \\\\ 2 & 4 \\end{bmatrix}$ มีค่าเท่าใด?',
    options: ['10', '14', '12', '8'],
    correctIndex: 0,
    explanation: 'det(A) = (3 × 4) - (1 × 2) = 12 - 2 = 10'
  },
  {
    id: 'pre3',
    topic: 'determinant',
    topicLabel: 'Determinant',
    text: 'ค่าดีเทอร์มิแนนต์ของเมทริกซ์ $A = \\begin{bmatrix} 5 & 2 \\\\ 3 & 4 \\end{bmatrix}$ มีค่าเท่าใด?',
    options: ['14', '20', '6', '26'],
    correctIndex: 0,
    explanation: 'det(A) = (5 × 4) - (2 × 3) = 20 - 6 = 14'
  },
  {
    id: 'pre4',
    topic: 'solutionTypes',
    topicLabel: 'ประเภทคำตอบของระบบสมการ',
    text: 'ถ้าระบบสมการมี $\\det(A) = 0$ และเมื่อคูณขยายพบสมการขัดแย้ง $0 = 5$ จะได้คำตอบประเภทใด?',
    options: ['มีคำตอบเดียว', 'ไม่มีคำตอบ (No Solution)', 'มีคำตอบนับไม่ถ้วน (Infinite Solutions)', 'คำนวณไม่ได้'],
    correctIndex: 1,
    explanation: 'ข้อความ 0 = 5 เป็นเท็จ แสดงว่าเส้นตรงขนานกัน ไม่มีจุดตัด จึงไม่มีคำตอบ'
  },
  {
    id: 'pre5',
    topic: 'inverseMethod',
    topicLabel: 'Inverse Matrix',
    text: 'ถ้า $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & -1 \\end{bmatrix}$ จะได้ $\\det(A) = -3$ ข้อใดคือเมทริกซ์ $A^{-1}$?',
    options: [
      '$-\\frac{1}{3} \\begin{bmatrix} -1 & -1 \\\\[0.5em] -1 & 2 \\end{bmatrix}$',
      '$-\\frac{1}{3} \\begin{bmatrix} 1 & -1 \\\\[0.5em] -1 & 2 \\end{bmatrix}$',
      '$\\frac{1}{3} \\begin{bmatrix} 2 & 1 \\\\[0.5em] 1 & -1 \\end{bmatrix}$',
      '$\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'A⁻¹ = 1/det(A) × [[d, -b], [-c, a]] = -1/3 × [[-1, -1], [-1, 2]]'
  },
  {
    id: 'pre6',
    topic: 'inverseMethod',
    topicLabel: 'Inverse Matrix',
    text: 'เมทริกซ์ $A$ จะมีเมทริกซ์ผกผัน ($A^{-1}$) ได้ก็ต่อเมื่อเงื่อนไขใดเป็นจริง?',
    options: [
      '$\\det(A) \\neq 0$',
      '$\\det(A) = 0$',
      'A ต้องเป็นเมทริกซ์เอกลักษณ์เท่านั้น',
      'A ต้องมีสมาชิกเป็นจำนวนเต็มบวกทั้งหมด'
    ],
    correctIndex: 0,
    explanation: 'สูตร A⁻¹ = (1/det(A)) × adj(A) หารด้วย det(A) ไม่ได้ถ้า det(A) = 0 ดังนั้นต้อง det(A) ≠ 0 เมทริกซ์จึงจะมีอินเวอร์ส'
  },
  {
    id: 'pre7',
    topic: 'cramerRule',
    topicLabel: 'กฎของคราเมอร์',
    text: 'ในการหาค่า $x$ ของระบบสมการด้วยกฎของคราเมอร์ เมทริกซ์ $A_x$ คือข้อใด?',
    options: [
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 1',
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 2',
      'เมทริกซ์ A คูณด้วย B',
      'เมทริกซ์ผกผันของ A'
    ],
    correctIndex: 0,
    explanation: 'Ax สื่อถึงการนำคอลัมน์ค่าคงที่ B ไปแทนที่คอลัมน์สัมประสิทธิ์ตัวแปร x (คอลัมน์ที่ 1)'
  },
  {
    id: 'pre8',
    topic: 'cramerRule',
    topicLabel: 'กฎของคราเมอร์',
    text: 'ถ้า $D = \\det(A) = 5$ และ $D_x = \\det(A_x) = 15$ ค่า $x$ จากกฎของคราเมอร์เท่ากับเท่าใด?',
    options: ['3', '10', '20', '75'],
    correctIndex: 0,
    explanation: 'สูตรคราเมอร์: $x = D_x / D = 15 / 5 = 3$'
  },
  {
    id: 'pre9',
    topic: 'gaussianElimination',
    topicLabel: 'Gaussian Elimination',
    text: 'เป้าหมายหลักของการทำ Elementary Row Operations ใน Gaussian Elimination คืออะไร?',
    options: [
      'ทำให้เมทริกซ์ A กลายเป็นเมทริกซ์สามเหลี่ยมบน (Row Echelon Form)',
      'ทำให้ค่า $\\det(A)$ เพิ่มขึ้นเป็นสองเท่า',
      'สลับค่าคงที่ B ทั้งหมดให้กลายเป็น 0',
      'หาค่าเฉลี่ยของทุกแถว'
    ],
    correctIndex: 0,
    explanation: 'การแปลงเป็นสามเหลี่ยมบนช่วยให้สามารถแก้หาตัวแปรย้อนกลับ (Back-substitution) ได้รวดเร็ว'
  },
  {
    id: 'pre10',
    topic: 'gaussianElimination',
    topicLabel: 'Gaussian Elimination',
    text: 'ข้อใดคือการดำเนินการตามแถว (Elementary Row Operation) ที่ "ไม่ได้รับอนุญาต" ในการทำ Gaussian Elimination?',
    options: [
      'คูณแถวใดแถวหนึ่งด้วย 0',
      'สลับตำแหน่งสองแถวใดๆ',
      'คูณแถวใดแถวหนึ่งด้วยจำนวนจริงที่ไม่เป็นศูนย์',
      'นำผลคูณของแถวหนึ่งไปบวกกับอีกแถวหนึ่ง'
    ],
    correctIndex: 0,
    explanation: 'การคูณแถวด้วย 0 ทำลายข้อมูลของแถวนั้นอย่างถาวรและไม่ใช่การดำเนินการที่ผันกลับได้ (invertible) จึงไม่ใช่ ERO ที่อนุญาต'
  }
];

export const POST_TEST_QUESTIONS: Question[] = [
  {
    id: 'post1',
    topic: 'matrixNotation',
    topicLabel: 'การเขียนรูป AX = B',
    // Mirrors pre1's skill (reading coefficients/constants off a 2-equation system into A, X, B)
    // with a different system so the answer can't be memorized from the Pre-Test.
    text: 'ระบบสมการ 3x + 2y = 12 และ x - 5y = 4 สามารถเขียนในรูปเมทริกซ์ $AX = B$ ได้อย่างไร?',
    options: [
      '$A = \\begin{bmatrix} 3 & 2 \\\\[0.5em] 1 & -5 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 12 \\\\[0.5em] 4 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 12 & 4 \\\\[0.5em] 2 & -5 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 3 \\\\[0.5em] 1 \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 3 & 1 \\\\[0.5em] 2 & -5 \\end{bmatrix}, \\quad X = \\begin{bmatrix} 12 \\\\[0.5em] 4 \\end{bmatrix}, \\quad B = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}$',
      '$A = \\begin{bmatrix} 2 & 3 \\\\[0.5em] -5 & 1 \\end{bmatrix}, \\quad X = \\begin{bmatrix} x \\\\[0.5em] y \\end{bmatrix}, \\quad B = \\begin{bmatrix} 12 \\\\[0.5em] 4 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'เมทริกซ์ A เก็บสัมประสิทธิ์ [3, 2] และ [1, -5], X เก็บ [x, y] และ B เก็บ [12, 4]'
  },
  {
    id: 'post2',
    topic: 'determinant',
    topicLabel: 'Determinant',
    // Mirrors pre2 (a single straightforward 2x2 determinant computation).
    text: 'ค่าดีเทอร์มิแนนต์ของเมทริกซ์ $A = \\begin{bmatrix} 6 & 1 \\\\ 2 & 3 \\end{bmatrix}$ มีค่าเท่าใด?',
    options: ['16', '18', '20', '14'],
    correctIndex: 0,
    explanation: 'det(A) = (6 × 3) - (1 × 2) = 18 - 2 = 16'
  },
  {
    id: 'post3',
    topic: 'determinant',
    topicLabel: 'Determinant',
    // Mirrors pre3 at comparable complexity (two-digit coefficients, same computation pattern).
    text: 'ค่าดีเทอร์มิแนนต์ของเมทริกซ์ $A = \\begin{bmatrix} 7 & 3 \\\\ 2 & 5 \\end{bmatrix}$ มีค่าเท่าใด?',
    options: ['29', '35', '6', '41'],
    correctIndex: 0,
    explanation: 'det(A) = (7 × 5) - (3 × 2) = 35 - 6 = 29'
  },
  {
    id: 'post4',
    topic: 'solutionTypes',
    topicLabel: 'ประเภทคำตอบของระบบสมการ',
    // Mirrors pre4's exact skill: recognizing "det(A) = 0 + false numeric statement ⇒ no solution".
    text: 'ถ้าระบบสมการมี $\\det(A) = 0$ และเมื่อคูณขยายพบสมการขัดแย้ง $0 = 9$ จะได้คำตอบประเภทใด?',
    options: ['มีคำตอบเดียว', 'ไม่มีคำตอบ (No Solution)', 'มีคำตอบนับไม่ถ้วน (Infinite Solutions)', 'คำนวณไม่ได้'],
    correctIndex: 1,
    explanation: 'ข้อความ 0 = 9 เป็นเท็จ แสดงว่าเส้นตรงขนานกัน ไม่มีจุดตัด จึงไม่มีคำตอบ'
  },
  {
    id: 'post5',
    topic: 'inverseMethod',
    topicLabel: 'Inverse Matrix',
    // Mirrors pre5 (compute A⁻¹ for a 2x2 with a clean, small determinant).
    text: 'ถ้า $A = \\begin{bmatrix} 3 & 2 \\\\ 1 & 1 \\end{bmatrix}$ จะได้ $\\det(A) = 1$ ข้อใดคือเมทริกซ์ $A^{-1}$?',
    options: [
      '$\\begin{bmatrix} 1 & -2 \\\\[0.5em] -1 & 3 \\end{bmatrix}$',
      '$\\begin{bmatrix} 1 & 2 \\\\[0.5em] 1 & 3 \\end{bmatrix}$',
      '$\\begin{bmatrix} 3 & 2 \\\\[0.5em] 1 & 1 \\end{bmatrix}$',
      '$\\begin{bmatrix} -1 & 2 \\\\[0.5em] 1 & -3 \\end{bmatrix}$'
    ],
    correctIndex: 0,
    explanation: 'A⁻¹ = 1/det(A) × [[d, -b], [-c, a]] = 1/1 × [[1, -2], [-1, 3]]'
  },
  {
    id: 'post6',
    topic: 'inverseMethod',
    topicLabel: 'Inverse Matrix',
    // Mirrors pre6's exact conceptual fact, asked from the converse direction.
    text: 'ถ้า $\\det(A) = 0$ จะเกิดผลอย่างไรต่อการหาเมทริกซ์ผกผัน $A^{-1}$?',
    options: [
      'ไม่สามารถหา $A^{-1}$ ได้ เพราะสูตรมีการหารด้วย $\\det(A)$',
      'หา $A^{-1}$ ได้ตามปกติ',
      '$A^{-1}$ จะเท่ากับเมทริกซ์เอกลักษณ์เสมอ',
      '$A^{-1}$ จะเท่ากับ $A$ เสมอ'
    ],
    correctIndex: 0,
    explanation: 'สูตร A⁻¹ = (1/det(A)) × adj(A) หารด้วย 0 ไม่ได้ ดังนั้นเมื่อ det(A) = 0 เมทริกซ์ A จะไม่มีอินเวอร์ส'
  },
  {
    id: 'post7',
    topic: 'cramerRule',
    topicLabel: 'กฎของคราเมอร์',
    // Mirrors pre7's exact skill (identifying which column gets replaced), asked for y instead of x.
    text: 'ในการหาค่า $y$ ของระบบสมการด้วยกฎของคราเมอร์ เมทริกซ์ $A_y$ คือข้อใด?',
    options: [
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 2',
      'เมทริกซ์ A ที่เอาคอลัมน์ B แทนที่คอลัมน์ที่ 1',
      'เมทริกซ์ A คูณด้วย B',
      'เมทริกซ์ผกผันของ A'
    ],
    correctIndex: 0,
    explanation: 'Ay สื่อถึงการนำคอลัมน์ค่าคงที่ B ไปแทนที่คอลัมน์สัมประสิทธิ์ตัวแปร y (คอลัมน์ที่ 2)'
  },
  {
    id: 'post8',
    topic: 'cramerRule',
    topicLabel: 'กฎของคราเมอร์',
    // Mirrors pre8's exact numeric-substitution skill with different numbers.
    text: 'ถ้า $D = \\det(A) = 4$ และ $D_y = \\det(A_y) = 12$ ค่า $y$ จากกฎของคราเมอร์เท่ากับเท่าใด?',
    options: ['3', '8', '16', '48'],
    correctIndex: 0,
    explanation: 'สูตรคราเมอร์: $y = D_y / D = 12 / 4 = 3$'
  },
  {
    id: 'post9',
    topic: 'gaussianElimination',
    topicLabel: 'Gaussian Elimination',
    // Mirrors pre9's exact concept (purpose of ERO / target form), reworded.
    text: 'เมื่อทำ Elementary Row Operations กับเมทริกซ์แต่งเติมจนเสร็จสมบูรณ์ตามเป้าหมายของ Gaussian Elimination แล้ว เมทริกซ์ควรมีลักษณะอย่างไร?',
    options: [
      'ฝั่งเมทริกซ์สัมประสิทธิ์กลายเป็นรูปสามเหลี่ยมบน (Row Echelon Form)',
      'ทุกตำแหน่งในเมทริกซ์กลายเป็นเลข 0',
      'ค่าคงที่ B ทั้งหมดถูกคูณด้วย det(A)',
      'แถวทั้งหมดถูกเรียงสลับแบบสุ่ม'
    ],
    correctIndex: 0,
    explanation: 'รูปสามเหลี่ยมบน (Row Echelon Form) ช่วยให้แก้หาตัวแปรย้อนกลับ (Back-substitution) ได้ทีละตัว'
  },
  {
    id: 'post10',
    topic: 'gaussianElimination',
    topicLabel: 'Gaussian Elimination',
    // Mirrors pre10's exact concept (which ERO is invalid), reworded/reordered options.
    text: 'ข้อใดไม่ใช่การดำเนินการตามแถว (Elementary Row Operation) ที่ถูกต้องในการทำ Gaussian Elimination?',
    options: [
      'คูณสมาชิกในแถวหนึ่งด้วย 0 ทั้งแถว',
      'นำผลคูณของแถวหนึ่งไปลบออกจากอีกแถวหนึ่ง',
      'สลับตำแหน่งสองแถวใดๆ ในเมทริกซ์',
      'คูณแถวหนึ่งด้วยจำนวนจริงที่ไม่เป็นศูนย์'
    ],
    correctIndex: 0,
    explanation: 'การคูณแถวด้วย 0 ทำลายข้อมูลของแถวนั้นอย่างถาวรและไม่สามารถผันกลับได้ (invertible) จึงไม่ใช่ ERO ที่ถูกต้อง'
  }
];
