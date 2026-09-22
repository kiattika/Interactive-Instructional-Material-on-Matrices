import { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Eye,
  HelpCircle,
  ListFilter,
  Radio,
  Loader2,
  CircleStop,
  Trophy
} from 'lucide-react';
import { toDataURL } from 'qrcode';
import { LinearSystem, SystemDimension, SolutionType } from '../types';
import {
  solveLinearSystem,
  getCramerSteps,
  getInverseSteps,
  getGaussSteps,
  computeRREF
} from '../lib/matrixEngine';
import {
  SystemDisplay,
  MatrixEquationDisplay,
  AugmentedMatrixDisplay,
  MatrixDisplay,
  DeterminantDisplay,
  VectorDisplay,
  MathView,
  RenderTextWithMath,
  formatLatexFraction
} from '../components/math/MathComponents';
import { getTeacherClassCode } from '../lib/classroomSync';
import {
  createLivePoll,
  fetchPollResults,
  closeLivePoll,
  LivePollPublicView,
  PollCloseSummaryClient
} from '../lib/livePollClient';

function getClassroomQuestion(method: 'inverse' | 'cramer' | 'gauss', step: number) {
  if (method === 'gauss') {
    switch (step) {
      case 1:
        return {
          question: "จากระบบสมการเชิงเส้นนี้ ขั้นตอนแรกในการแก้สมการด้วยวิธี Gaussian Elimination คืออะไร?",
          options: [
            "A. นำสัมประสิทธิ์และค่าคงที่มาเขียนเป็นเมทริกซ์แต่งเติม [A | B]",
            "B. หาค่า det(A)",
            "C. หา A⁻¹",
            "D. สลับตำแหน่งสมการทั้งหมด"
          ],
          correctAnswer: "A. นำสัมประสิทธิ์และค่าคงที่มาเขียนเป็นเมทริกซ์แต่งเติม [A | B]",
          explanation: "วิธี Gaussian Elimination เริ่มต้นโดยนำระบบสมการเปลี่ยนเป็นรูปเมทริกซ์แต่งเติม [A | B] ทันที โดยใช้เส้นตั้งคั่นระหว่าง A และ B"
        };
      case 2:
        return {
          question: "จากระบบสมการนี้ เราจะนำข้อมูลใดมาเขียนเป็นเมทริกซ์แต่งเติม?",
          options: [
            "A. นำสัมประสิทธิ์ A ด้านซ้าย และค่าคงที่ B ด้านขวามาเขียนคั่นด้วยเส้นตั้ง",
            "B. นำเฉพาะค่าคงที่ B มาเขียน",
            "C. นำเฉพาะตัวแปร x, y มาเขียน",
            "D. นำ A และ B มาคูณกันก่อน"
          ],
          correctAnswer: "A. นำสัมประสิทธิ์ A ด้านซ้าย และค่าคงที่ B ด้านขวามาเขียนคั่นด้วยเส้นตั้ง",
          explanation: "เมทริกซ์แต่งเติม [A | B] เกิดจากการนำสัมประสิทธิ์ A ด้านซ้าย และเวกเตอร์คงที่ B ด้านขวามาเขียนรวมกัน"
        };
      case 3:
        return {
          question: "เราควรกำจัดสมาชิกใดก่อน และควรใช้การดำเนินการกับแถว (ERO) อย่างไร?",
          options: [
            "A. กำจัดสมาชิกในคอลัมน์แรกใต้ Pivot ให้เป็น 0 โดยใช้การลบ/บวกทวีคูณของแถวแรก",
            "B. คูณทุกแถวด้วย 0",
            "C. สลับคอลัมน์ A และ B",
            "D. บวกเลข 10 เข้าไปทุกตำแหน่ง"
          ],
          correctAnswer: "A. กำจัดสมาชิกในคอลัมน์แรกใต้ Pivot ให้เป็น 0 โดยใช้การลบ/บวกทวีคูณของแถวแรก",
          explanation: "การทำ ERO มุ่งเป้ากำจัดสมาชิกใต้ Pivot ให้กลายเป็น 0 เพื่อปรับให้อยู่ในรูป Row Echelon Form หรือ RREF"
        };
      case 4:
        return {
          question: "เมทริกซ์แต่งเติมที่ผ่านการดำเนินการกับแถวจนเป็น RREF แล้ว มีลักษณะอย่างไร?",
          options: [
            "A. ฝั่งซ้ายเป็นเมทริกซ์เอกลักษณ์ (หรือมีแถว 0) และฝั่งขวาเป็นค่าคงคำตอบ",
            "B. ทุกตำแหน่งเป็นเลข 0 ทั้งหมด",
            "C. ทุกตำแหน่งเป็นเลข 1 ทั้งหมด",
            "D. สลับตำแหน่งแถวไปมาไม่มีทิศทาง"
          ],
          correctAnswer: "A. ฝั่งซ้ายเป็นเมทริกซ์เอกลักษณ์ (หรือมีแถว 0) และฝั่งขวาเป็นค่าคงคำตอบ",
          explanation: "รูป RREF ทำให้สามารถอ่านค่าของตัวแปรแต่ละตัวได้อย่างชัดเจน"
        };
      case 5:
        return {
          question: "จากแถวที่ได้ในเมทริกซ์แต่งเติมหลังดำเนินการ นักเรียนสามารถเขียนกลับเป็นสมการได้อย่างไร?",
          options: [
            "A. อ่านสัมประสิทธิ์ของแถวคูณตัวแปรเท่ากับฝั่งขวา (เช่น 0x + 0y = 1)",
            "B. นำตัวเลขในแถวมารวมกัน",
            "C. ถอดรากที่สองของทุกตำแหน่ง",
            "D. ตอบเป็น 0 เสมอ"
          ],
          correctAnswer: "A. อ่านสัมประสิทธิ์ของแถวคูณตัวแปรเท่ากับฝั่งขวา (เช่น 0x + 0y = 1)",
          explanation: "แต่ละแถว [a, b | c] แปลความหมายกลับเป็นสมการเชิงเส้น ax + by = c เพื่อวิเคราะห์คำตอบ"
        };
      default:
        return {
          question: "การตรวจสอบว่าคำตอบที่ได้ถูกต้องหรือไม่ ควรทำอย่างไร?",
          options: [
            "A. แทนค่าตัวแปรที่ได้กลับลงในระบบสมการดั้งเดิมทุกสมการ",
            "B. หา det(A) อีกรอบ",
            "C. สลับตำแหน่ง x และ y",
            "D. ไม่ต้องตรวจสอบ"
          ],
          correctAnswer: "A. แทนค่าตัวแปรที่ได้กลับลงในระบบสมการดั้งเดิมทุกสมการ",
          explanation: "การแทนค่าตัวแปรกลับลงในทุกสมการเดิม หากทำให้สมการเป็นจริงทุกข้อ แสดงว่าคำตอบถูกต้อง"
        };
    }
  } else if (method === 'inverse') {
    switch (step) {
      case 1:
        return {
          question: "ในระบบสมการ AX = B เมทริกซ์ A และเวกเตอร์ B มีความหมายอย่างไร?",
          options: [
            "A. A คือเมทริกซ์สัมประสิทธิ์ และ B คือเวกเตอร์ค่าคงที่",
            "B. A คือเวกเตอร์ตัวแปร B คือสัมประสิทธิ์",
            "C. ทั้ง A และ B เป็นเมทริกซ์เอกลักษณ์",
            "D. A คือคำตอบของสมการ"
          ],
          correctAnswer: "A. A คือเมทริกซ์สัมประสิทธิ์ และ B คือเวกเตอร์ค่าคงที่",
          explanation: "A เก็บสัมประสิทธิ์ของตัวแปรหน้า x, y, z ส่วน B เก็บค่าคงที่ฝั่งขวาของสมการ"
        };
      case 2:
        return {
          question: "เมื่อเขียนระบบสมการในรูป AX = B เวกเตอร์ X หมายถึงอะไร?",
          options: [
            "A. เวกเตอร์ของตัวแปรที่ไม่ทราบค่า เช่น [x, y]ᵀ",
            "B. ค่าคงที่ฝั่งขวา",
            "C. เมทริกซ์สัมประสิทธิ์",
            "D. เมทริกซ์ผกผัน"
          ],
          correctAnswer: "A. เวกเตอร์ของตัวแปรที่ไม่ทราบค่า เช่น [x, y]ᵀ",
          explanation: "X คือหลักของตัวแปรที่ต้องการหาค่า"
        };
      case 3:
        return {
          question: "เหตุใดเราจึงต้องคำนวณ det(A) ก่อนหา A⁻¹?",
          options: [
            "A. เพราะถ้า det(A) = 0 เมทริกซ์ A จะไม่มีตัวผกผัน (A⁻¹ ไม่ดำรงอยู่)",
            "B. เพราะ det(A) คือคำตอบของสมการทันที",
            "C. เพื่อเปลี่ยนตัวแปร x เป็น y",
            "D. ไม่จำเป็นต้องคำนวณ"
          ],
          correctAnswer: "A. เพราะถ้า det(A) = 0 เมทริกซ์ A จะไม่มีตัวผกผัน (A⁻¹ ไม่ดำรงอยู่)",
          explanation: "สูตร A⁻¹ มีตัวหารเป็น det(A) ดังนั้นหาก det(A) = 0 จะหา A⁻¹ไม่ได้"
        };
      case 4:
        return {
          question: "เมทริกซ์ผูกพัน Adjugate Matrix adj(A) สำหรับเมทริกซ์ 2x2 มีลักษณะอย่างไร?",
          options: [
            "A. สลับตำแหน่งเส้นทแยงมุมหลัก และเปลี่ยนเครื่องหมายเส้นทแยงมุมรอง",
            "B. เปลี่ยนทุกตำแหน่งเป็นบวก",
            "C. สลับแถวเป็นหลักทั้งหมด",
            "D. เท่ากับ A เสมอ"
          ],
          correctAnswer: "A. สลับตำแหน่งเส้นทแยงมุมหลัก และเปลี่ยนเครื่องหมายเส้นทแยงมุมรอง",
          explanation: "สำหรับ 2x2: [[a,b],[c,d]] ➔ adj(A) = [[d,-b],[-c,a]]"
        };
      case 5:
        return {
          question: "สูตรในการคำนวณหา A⁻¹ จาก det(A) และ adj(A) คือข้อใด?",
          options: [
            "A. A⁻¹ = (1 / det(A)) × adj(A)",
            "B. A⁻¹ = det(A) × A",
            "C. A⁻¹ = A + B",
            "D. A⁻¹ = 1 / A"
          ],
          correctAnswer: "A. A⁻¹ = (1 / det(A)) × adj(A)",
          explanation: "A⁻¹ คำนวณได้จาก 1 หารด้วย det(A) แล้วคูณด้วย Adjugate Matrix ของ A"
        };
      case 6:
        return {
          question: "การคำนวณหาเวกเตอร์คำตอบ X จากสมการ AX = B ทำได้อย่างไร?",
          options: [
            "A. คูณ A⁻¹ ทางซ้ายทั้งสองข้าง จะได้ X = A⁻¹B",
            "B. นำ B หารด้วย A",
            "C. คูณ A ด้วย B",
            "D. ลบ A ออกจาก B"
          ],
          correctAnswer: "A. คูณ A⁻¹ ทางซ้ายทั้งสองข้าง จะได้ X = A⁻¹B",
          explanation: "จาก AX = B ➔ A⁻¹(AX) = A⁻¹B ➔ IX = A⁻¹B ➔ X = A⁻¹B"
        };
      default:
        return {
          question: "หากคำนวณได้ det(A) = 0 แสดงว่าระบบสมการนี้เป็นอย่างไร?",
          options: [
            "A. ไม่มีคำตอบเดียว (อาจไม่มีคำตอบ หรือมีคำตอบนับไม่ถ้วน)",
            "B. มีคำตอบเป็น 0 เสมอ",
            "C. คำนวณผิดแน่นอน",
            "D. มีคำตอบเดียวเสมอ"
          ],
          correctAnswer: "A. ไม่มีคำตอบเดียว (อาจไม่มีคำตอบ หรือมีคำตอบนับไม่ถ้วน)",
          explanation: "เมื่อ det(A) = 0 ระบบสมการจะเป็นระบบที่ไม่เสถียร คือไม่มีคำตอบเลย หรือมีคำตอบนับไม่ถ้วน"
        };
    }
  } else {
    // Cramer
    switch (step) {
      case 1:
        return {
          question: "กฎของคราเมอร์ (Cramer's Rule) เหมาะสำหรับระบบสมการที่มีลักษณะใด?",
          options: [
            "A. ระบบสมการที่มี det(A) ≠ 0 และจำนวนสมการเท่ากับจำนวนตัวแปร",
            "B. ระบบสมการที่มี det(A) = 0",
            "C. เมทริกซ์ที่มีขนาดไม่เป็นสี่เหลี่ยมจัตุรัส",
            "D. ระบบสมการที่ไม่มีตัวแปร"
          ],
          correctAnswer: "A. ระบบสมการที่มี det(A) ≠ 0 และจำนวนสมการเท่ากับจำนวนตัวแปร",
          explanation: "กฎของคราเมอร์ใช้ Determinant เป็นตัวหาร ดังนั้น det(A) ต้องไม่เท่ากับ 0"
        };
      case 2:
        return {
          question: "ในกฎของคราเมอร์ ตัวแปร D หมายถึงอะไร?",
          options: [
            "A. Determinant ของเมทริกซ์สัมประสิทธิ์ A",
            "B. เวกเตอร์ค่าคงที่ B",
            "C. ตัวแปร x + y",
            "D. เมทริกซ์ผกผัน"
          ],
          correctAnswer: "A. Determinant ของเมทริกซ์สัมประสิทธิ์ A",
          explanation: "D คือ det(A) ซึ่งเป็นตัวหารหลักในการหาค่าตัวแปรทุกตัว"
        };
      case 3:
        return {
          question: "เมทริกซ์ Dx ในกฎของคราเมอร์สร้างขึ้นอย่างไร?",
          options: [
            "A. นำคอลัมน์ B ไปแทนที่คอลัมน์แรก (คอลัมน์ของ x) ในเมทริกซ์ A",
            "B. นำ B ไปแทนที่คอลัมน์ที่สอง",
            "C. บวก B เข้าไปในคอลัมน์แรก",
            "D. ลบคอลัมน์แรกออก"
          ],
          correctAnswer: "A. นำคอลัมน์ B ไปแทนที่คอลัมน์แรก (คอลัมน์ของ x) ในเมทริกซ์ A",
          explanation: "Dx เกิดจากการนำเวกเตอร์ค่าคงที่ B ไปแทนที่คอลัมน์สัมประสิทธิ์ของตัวแปร x"
        };
      case 4:
        return {
          question: "เมทริกซ์ Dy ในกฎของคราเมอร์สร้างขึ้นอย่างไร?",
          options: [
            "A. นำคอลัมน์ B ไปแทนที่คอลัมน์ที่สอง (คอลัมน์ของ y) ในเมทริกซ์ A",
            "B. นำ B ไปแทนที่คอลัมน์แรก",
            "C. สลับตำแหน่ง A และ B",
            "D. นำ B มาคูณกับ A"
          ],
          correctAnswer: "A. นำคอลัมน์ B ไปแทนที่คอลัมน์ที่สอง (คอลัมน์ของ y) ในเมทริกซ์ A",
          explanation: "Dy เกิดจากการนำเวกเตอร์ค่าคงที่ B ไปแทนที่คอลัมน์สัมประสิทธิ์ของตัวแปร y"
        };
      case 5:
        return {
          question: "สูตรในการหาค่าตัวแปร x ด้วยกฎของคราเมอร์คือข้อใด?",
          options: [
            "A. x = det(Dx) / det(A)",
            "B. x = det(A) / det(Dx)",
            "C. x = det(Dx) × det(A)",
            "D. x = det(Dy) / det(A)"
          ],
          correctAnswer: "A. x = det(Dx) / det(A)",
          explanation: "ค่าของตัวแปร x หาได้จาก det(Dx) หารด้วย D (ซึ่งก็คือ det(A))"
        };
      default:
        return {
          question: "หากคำนวณได้ D = 0 และ Dx ≠ 0 จะสรุปผลเกี่ยวกับระบบสมการอย่างไร?",
          options: [
            "A. ระบบสมการไม่มีคำตอบ (No Solution)",
            "B. ระบบสมการมีคำตอบนับไม่ถ้วน",
            "C. มีคำตอบเดียวคือ x = 0",
            "D. กฎของคราเมอร์คำนวณผิด"
          ],
          correctAnswer: "A. ระบบสมการไม่มีคำตอบ (No Solution)",
          explanation: "เมื่อตัวหาร D = 0 แต่ตัวเศษ Dx ≠ 0 จะเกิดสภาวะหารด้วยศูนย์ (ขัดแย้ง) สรุปว่าไม่มีคำตอบ"
        };
    }
  }
}

export default function TeacherPresentation() {
  const [method, setMethod] = useState<'inverse' | 'cramer' | 'gauss'>('inverse');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showClassQuestion, setShowClassQuestion] = useState<boolean>(false);
  const [questionRevealed, setQuestionRevealed] = useState<boolean>(false);

  // Live poll state — wraps the existing "Ask the Class" question with a real, phone-answerable
  // quiz. classCode comes from this browser's last-created class (same source TeacherAnalytics
  // and TeacherSettingsPage already use); no live poll can start without one.
  const [teacherClassCode] = useState<string | null>(getTeacherClassCode);
  const [livePollId, setLivePollId] = useState<string | null>(null);
  const [pollStarting, setPollStarting] = useState(false);
  const [pollClosing, setPollClosing] = useState(false);
  const [pollResults, setPollResults] = useState<LivePollPublicView | null>(null);
  const [pollCloseSummary, setPollCloseSummary] = useState<PollCloseSummaryClient | null>(null);
  const [pollQrDataUrl, setPollQrDataUrl] = useState<string | null>(null);

  // A poll belongs to one specific Ask-the-Class question — moving to a different step/method,
  // or hiding the panel, must not leave a stale poll's results lingering on screen.
  useEffect(() => {
    setLivePollId(null);
    setPollResults(null);
    setPollCloseSummary(null);
  }, [currentStep, method, showClassQuestion]);

  useEffect(() => {
    if (!livePollId) return;
    let cancelled = false;
    async function poll() {
      const results = await fetchPollResults(livePollId!);
      if (!cancelled && results) setPollResults(results);
    }
    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [livePollId]);

  useEffect(() => {
    if (!livePollId) {
      setPollQrDataUrl(null);
      return;
    }
    let cancelled = false;
    toDataURL(`${window.location.origin}/poll/${livePollId}`, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setPollQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPollQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [livePollId]);

  async function handleStartLivePoll(qObj: { question: string; options: string[]; correctAnswer: string }) {
    if (!teacherClassCode || pollStarting) return;
    setPollStarting(true);
    setPollCloseSummary(null);
    const result = await createLivePoll(teacherClassCode, qObj.question, qObj.options, qObj.correctAnswer);
    setPollStarting(false);
    if (result) setLivePollId(result.pollId);
  }

  async function handleCloseLivePoll() {
    if (!livePollId || pollClosing) return;
    setPollClosing(true);
    const summary = await closeLivePoll(livePollId);
    setPollClosing(false);
    setLivePollId(null);
    if (summary) setPollCloseSummary(summary);
  }

  // System State
  const [dimension, setDimension] = useState<SystemDimension>('2x2');
  const [system, setSystem] = useState<LinearSystem>({
    dimension: '2x2',
    A: [
      [2, 1],
      [1, -1]
    ],
    B: [5, 1],
    variables: ['x', 'y']
  });

  // Generator Options State
  const [genDifficulty, setGenDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [genSolutionType, setGenSolutionType] = useState<SolutionType>('unique');

  // Math Calculations via Matrix Engine
  const solution = solveLinearSystem(system);
  const cramer = getCramerSteps(system);
  const inverse = getInverseSteps(system);
  const gauss = getGaussSteps(system);

  const augMatrix = system.A.map((row, i) => [...row, system.B[i]]);
  const rrefMatrix = computeRREF(augMatrix);

  const rowOps = gauss.slice(1);
  const gaussNumOperations = rowOps.length;
  const totalSteps =
    method === 'inverse'
      ? 7
      : method === 'cramer'
      ? 6
      : gaussNumOperations === 0
      ? 4
      : 4 + 3 * gaussNumOperations;

  // Generate verified classroom system
  const handleGenerateSystem = (dim: SystemDimension, solType: SolutionType, diff: 'Easy' | 'Medium' | 'Hard') => {
    let newA: number[][];
    let newB: number[];

    if (dim === '2x2') {
      if (solType === 'no_solution') {
        newA = [[1, 2], [2, 4]];
        newB = [3, 7];
      } else if (solType === 'infinite_solutions') {
        newA = [[1, 2], [2, 4]];
        newB = [3, 6];
      } else {
        // Unique
        if (diff === 'Easy') {
          newA = [[2, 1], [1, -1]];
          newB = [5, 1];
        } else if (diff === 'Medium') {
          newA = [[3, 2], [1, -1]];
          newB = [12, 1];
        } else {
          newA = [[4, 3], [2, -5]];
          newB = [11, 3];
        }
      }
      setSystem({
        dimension: '2x2',
        A: newA,
        B: newB,
        variables: ['x', 'y']
      });
    } else {
      // 3x3
      if (solType === 'no_solution') {
        newA = [
          [1, 1, 1],
          [2, 2, 2],
          [1, 0, 1]
        ];
        newB = [3, 7, 2];
      } else if (solType === 'infinite_solutions') {
        newA = [
          [1, 1, 1],
          [2, 2, 2],
          [1, 0, 1]
        ];
        newB = [3, 6, 2];
      } else {
        newA = [
          [1, 1, 1],
          [2, -1, 1],
          [3, 1, -1]
        ];
        newB = [6, 3, 2];
      }
      setSystem({
        dimension: '3x3',
        A: newA,
        B: newB,
        variables: ['x', 'y', 'z']
      });
    }

    setDimension(dim);
    setCurrentStep(1);
    setShowClassQuestion(false);
    setQuestionRevealed(false);
  };

  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setShowClassQuestion(false);
      setQuestionRevealed(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setShowClassQuestion(false);
      setQuestionRevealed(false);
    }
  };

  const handleShowAll = () => {
    setCurrentStep(totalSteps);
  };

  const handleRestart = () => {
    setCurrentStep(1);
    setShowClassQuestion(false);
    setQuestionRevealed(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Presentation Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-600/30">
            PROJ
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              โหมดการสอนในชั้นเรียน (Presentation Mode)
              <span className="text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                Projector View
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              จัดทำโดย ครูเกียรติศักดิ์ แก้วหล้า ครูโรงเรียนอุตรดิตถ์ วิทยฐานะ ครูชำนาญการพิเศษ
            </p>
          </div>
        </div>

        {/* Method Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
          {[
            { key: 'inverse', label: '1. Inverse (A⁻¹B)' },
            { key: 'cramer', label: '2. Cramer\'s Rule' },
            { key: 'gauss', label: '3. Gauss Elimination' }
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setMethod(m.key as any);
                setCurrentStep(1);
                setShowClassQuestion(false);
                setQuestionRevealed(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                method === m.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {/* Generator Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 my-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-400 flex items-center gap-1">
            <ListFilter className="w-4 h-4 text-indigo-400" /> มิติ:
          </span>
          <div className="flex bg-slate-800 p-1 rounded-lg">
            {(['2x2', '3x3'] as SystemDimension[]).map((d) => (
              <button
                key={d}
                onClick={() => handleGenerateSystem(d, genSolutionType, genDifficulty)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  dimension === d ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <span className="text-slate-400 ml-2">ลักษณะคำตอบ:</span>
          <select
            value={genSolutionType}
            onChange={(e) => {
              const newSol = e.target.value as SolutionType;
              setGenSolutionType(newSol);
              handleGenerateSystem(dimension, newSol, genDifficulty);
            }}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-1 rounded-lg focus:outline-none"
          >
            <option value="unique">คำตอบเดียว (Unique)</option>
            <option value="no_solution">ไม่มีคำตอบ (No Solution)</option>
            <option value="infinite_solutions">คำตอบนับไม่ถ้วน (Infinite)</option>
          </select>
        </div>
      </div>

      {/* Main Projection Screen Canvas */}
      <main className="flex-grow my-4 bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col justify-between relative overflow-hidden min-h-[480px]">
        {/* Background Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          {/* Step Counter Indicator */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
              {method === 'inverse' && 'วิธีที่ 1: การใช้ Inverse Matrix (A⁻¹B)'}
              {method === 'cramer' && 'วิธีที่ 2: กฎของคราเมอร์ (Cramer\'s Rule)'}
              {method === 'gauss' && 'วิธีที่ 3: Gaussian Elimination & ERO'}
            </span>
            <span className="text-sm font-black bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-full">
              ขั้นตอน {currentStep} / {totalSteps}
            </span>
          </div>

          {/* STEP 1: Always Present System */}
          <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">1</span>
              STEP 1: ระบบสมการเชิงเส้น
            </h2>
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 inline-block shadow-inner">
              <SystemDisplay A={system.A} B={system.B} variables={system.variables} className="text-2xl sm:text-3xl font-black text-amber-300" />
            </div>
          </div>

          {/* STEP 2: Method Specific */}
          {currentStep >= 2 && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              {method === 'inverse' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">2</span>
                    STEP 2: เขียนระบบสมการในรูป AX = B
                  </h3>
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 inline-block">
                    <MatrixEquationDisplay A={system.A} B={system.B} variables={system.variables} className="text-xl sm:text-2xl font-bold" />
                  </div>
                </>
              )}

              {method === 'cramer' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">2</span>
                    STEP 2: แยกเมทริกซ์สัมประสิทธิ์ A และเวกเตอร์ B
                  </h3>
                  <div className="flex flex-wrap items-center gap-8 py-2">
                    <MatrixDisplay matrix={system.A} label="A" className="text-xl font-bold" />
                    <VectorDisplay values={system.B} label="B" className="text-xl font-bold" />
                  </div>
                </>
              )}

              {method === 'gauss' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">2</span>
                    STEP 2: สร้างเมทริกซ์แต่งเติม (Augmented Matrix) [A | B]
                  </h3>
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 inline-block">
                    <AugmentedMatrixDisplay A={system.A} B={system.B} className="text-2xl font-bold text-amber-300" />
                  </div>
                  <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    "นำสัมประสิทธิ์ของตัวแปร A ด้านซ้าย และค่าคงที่ B ด้านขวามาเขียนรวมกันโดยใช้เส้นตั้งคั่น"
                  </p>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Method Specific */}
          {currentStep >= 3 && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              {method === 'inverse' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">3</span>
                    STEP 3: คำนวณค่า Determinant det(A)
                  </h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 inline-block text-xl">
                      <DeterminantDisplay matrix={system.A} label="\det(A)" className="text-emerald-400 font-bold" />
                    </div>
                    <div className="text-base font-mono font-bold text-slate-200">
                      {dimension === '2x2' ? (
                        <MathView latex={`\\det(A) = (${system.A[0][0]})(${system.A[1][1]}) - (${system.A[0][1]})(${system.A[1][0]}) = ${system.A[0][0]*system.A[1][1]} - ${system.A[0][1]*system.A[1][0]} = ${solution.determinant}`} />
                      ) : (
                        <MathView latex={`\\det(A) = ${solution.determinant}`} />
                      )}
                    </div>
                    <div className="text-sm font-sans">
                      {solution.determinant === 0 ? (
                        <span className="text-rose-400 font-bold">det(A) = 0 ➔ เมทริกซ์ A ไม่มีตัวผกผัน (A⁻¹ ไม่ดำรงอยู่) ไม่สามารถใช้วิธี Inverse Matrix ได้</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">det(A) ≠ 0 ➔ เมทริกซ์ A มีตัวผกผัน A⁻¹ และระบบสมการมีคำตอบเพียงชุดเดียว</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {method === 'cramer' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">3</span>
                    STEP 3: หาค่า D = det(A)
                  </h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 inline-block text-xl">
                      <DeterminantDisplay matrix={system.A} label="D = \det(A)" className="text-emerald-400 font-bold" />
                    </div>
                    <div className="text-base font-mono font-bold text-slate-200">
                      <MathView latex={`D = ${cramer.detD}`} />
                    </div>
                    <div className="text-sm font-sans">
                      {cramer.detD === 0 ? (
                        <span className="text-rose-400 font-bold">D = 0 ➔ ไม่สามารถใช้วิธี Cramer หาคำตอบได้โดยตรง</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">D ≠ 0 ➔ สามารถใช้กฎของคราเมอร์หาคำตอบได้</span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {method === 'gauss' && (
                <div className="space-y-6 animate-fade-in">
                  {/* All Row Operations that have been started (currentStep >= 3 + 3*k) */}
                  {rowOps.map((opStep, k) => {
                    const stepStart = 3 + 3 * k;
                    if (currentStep < stepStart) return null;

                    const isOpRevealed = currentStep >= stepStart + 1;
                    const isAfterRevealed = currentStep >= stepStart + 2;

                    const beforeMat = opStep.beforeMatrix || gauss[k].augmentedMatrix;
                    const afterMat = opStep.augmentedMatrix;
                    const numCols = system.A[0].length;

                    return (
                      <div key={k} className="p-5 bg-slate-950/80 rounded-2xl border border-indigo-900/60 space-y-4 shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                              {3 + k}
                            </span>
                            ขั้นตอนที่ {3 + k}: การดำเนินการกับแถวที่ {k + 1} (Row Operation #{k + 1})
                          </h3>
                          <span className="text-xs text-slate-400 font-sans"><RenderTextWithMath text={opStep.explanation} /></span>
                        </div>

                        {/* ONE HORIZONTAL ROW FOR BEFORE -> OPERATION -> AFTER */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 overflow-x-auto py-2">
                          {/* 1. BEFORE MATRIX (Always visible once step starts) */}
                          <div className="flex-1 w-full p-4 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col items-center justify-center min-h-[120px]">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              1. เมทริกซ์ก่อนดำเนินการ (BEFORE)
                            </p>
                            <AugmentedMatrixDisplay
                              A={beforeMat.map(r => r.slice(0, numCols))}
                              B={beforeMat.map(r => r[numCols])}
                              className="text-xl font-bold text-slate-200"
                              highlightRows={opStep.highlightRows}
                            />
                          </div>

                          {/* ARROW 1 */}
                          <div className="text-indigo-400 font-bold text-2xl px-1 hidden md:block">→</div>

                          {/* 2. ROW OPERATION (Hidden until State B) */}
                          <div className={`flex-1 w-full p-4 rounded-xl border flex flex-col items-center justify-center min-h-[120px] transition-all ${
                            isOpRevealed 
                              ? 'bg-indigo-950/70 border-indigo-600/80 text-amber-300 shadow-md shadow-indigo-950/50' 
                              : 'bg-slate-900/40 border-slate-800/80 text-slate-600'
                          }`}>
                            <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-2">
                              2. คำสั่ง ERO (ROW OPERATION)
                            </p>
                            {isOpRevealed ? (
                              <div className="text-2xl font-mono font-black text-amber-300">
                                <MathView latex={`\\mathbf{${opStep.operationPerformed}}`} />
                              </div>
                            ) : (
                              <div className="text-xs font-mono italic text-slate-500 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                                🔒 กด "แสดงขั้นตอนถัดไป" เพื่อเปิดเผย ERO
                              </div>
                            )}
                          </div>

                          {/* ARROW 2 */}
                          <div className="text-indigo-400 font-bold text-2xl px-1 hidden md:block">→</div>

                          {/* 3. AFTER MATRIX (Hidden until State C) */}
                          <div className={`flex-1 w-full p-4 rounded-xl border flex flex-col items-center justify-center min-h-[120px] transition-all ${
                            isAfterRevealed 
                              ? 'bg-slate-900/90 border-emerald-500/70 text-emerald-400 shadow-md shadow-emerald-950/30' 
                              : 'bg-slate-900/40 border-slate-800/80 text-slate-600'
                          }`}>
                            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">
                              3. เมทริกซ์หลังดำเนินการ (AFTER)
                            </p>
                            {isAfterRevealed ? (
                              <AugmentedMatrixDisplay
                                A={afterMat.map(r => r.slice(0, numCols))}
                                B={afterMat.map(r => r[numCols])}
                                className="text-xl font-bold text-emerald-400"
                              />
                            ) : (
                              <div className="text-xs font-mono italic text-slate-500 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                                🔒 กด "แสดงขั้นตอนถัดไป" เพื่อเปิดเผยผลลัพธ์
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* RREF Analysis Step */}
                  {currentStep >= (gaussNumOperations === 0 ? 3 : 3 + 3 * gaussNumOperations) && (
                    <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                          {gaussNumOperations === 0 ? 3 : 3 + gaussNumOperations}
                        </span>
                        วิเคราะห์ผลลัพธ์จากเมทริกซ์ RREF
                      </h3>
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 inline-block mb-3">
                        <AugmentedMatrixDisplay
                          A={rrefMatrix.map(r => r.slice(0, system.A.length))}
                          B={rrefMatrix.map(r => r[system.A.length])}
                          className="text-2xl font-bold text-emerald-400"
                        />
                      </div>
                      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 font-mono text-base font-bold text-white">
                        {solution.type === 'no_solution' && (
                          <div className="space-y-2">
                            <p className="text-amber-300">
                              แถวสุดท้ายแปลความหมายเป็นสมการ: <MathView latex={`0x + 0y ${dimension === '3x3' ? '+ 0z' : ''} = ${formatLatexFraction(rrefMatrix[rrefMatrix.length - 1][system.A.length])}`} />
                            </p>
                            <p className="text-rose-400 font-sans text-sm font-normal">
                              "สมการนี้เป็นไปไม่ได้ เพราะ 0 ไม่สามารถเท่ากับ {formatLatexFraction(rrefMatrix[rrefMatrix.length - 1][system.A.length])}"
                            </p>
                            <div className="mt-2 text-xl text-rose-400">
                              <MathView latex={`\\boxed{\\text{ไม่มีคำตอบ (No Solution)}}`} />
                            </div>
                          </div>
                        )}

                        {solution.type === 'infinite_solutions' && (
                          <div className="space-y-2">
                            <p className="text-amber-300">
                              แถวสุดท้ายแปลความหมายเป็นสมการ: <MathView latex={`0x + 0y ${dimension === '3x3' ? '+ 0z' : ''} = 0`} />
                            </p>
                            <p className="text-emerald-400 font-sans text-sm font-normal">
                              "ข้อความ 0 = 0 เป็นจริงเสมอ สมการมีความสัมพันธ์ซ้ำซ้อนกัน"
                            </p>
                            <div className="mt-2 text-xl text-emerald-400">
                              <MathView latex={`\\boxed{\\text{มีคำตอบนับไม่ถ้วน (Infinitely Many Solutions)}}`} />
                            </div>
                          </div>
                        )}

                        {solution.type === 'unique' && solution.solution && (
                          <div className="space-y-2">
                            <p className="text-slate-300 font-sans text-xs mb-2">แปลผลจากเมทริกซ์เอกลักษณ์ RREF:</p>
                            <p><MathView latex={`1x = ${formatLatexFraction(solution.solution[0])} \\implies x = ${formatLatexFraction(solution.solution[0])}`} /></p>
                            <p><MathView latex={`1y = ${formatLatexFraction(solution.solution[1])} \\implies y = ${formatLatexFraction(solution.solution[1])}`} /></p>
                            {dimension === '3x3' && solution.solution[2] !== undefined && (
                              <p><MathView latex={`1z = ${formatLatexFraction(solution.solution[2])} \\implies z = ${formatLatexFraction(solution.solution[2])}`} /></p>
                            )}
                            <div className="mt-2 text-xl text-emerald-400">
                              <MathView latex={`\\boxed{\\text{มีคำตอบเพียงชุดเดียว (Unique Solution)}}`} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gauss Verification Step */}
                  {currentStep >= (gaussNumOperations === 0 ? 4 : 4 + 3 * gaussNumOperations) && (
                    <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                          {gaussNumOperations === 0 ? 4 : 4 + gaussNumOperations}
                        </span>
                        สรุปและตรวจคำตอบระบบสมการ
                      </h3>
                      {solution.type === 'unique' && solution.solution && (
                        <div className="p-6 bg-gradient-to-r from-emerald-950/80 to-slate-950 border-2 border-emerald-500 rounded-2xl shadow-2xl space-y-3">
                          <span className="text-xs font-black uppercase text-emerald-400 tracking-widest">
                            คำตอบของระบบสมการ (VERIFIED SOLUTION)
                          </span>
                          <div className="text-2xl font-mono font-black text-white">
                            <MathView latex={`X = \\begin{bmatrix} ${solution.solution.map(s => formatLatexFraction(s)).join(' \\\\[0.5em] ')} \\end{bmatrix}`} />
                          </div>
                          {solution.verifications && (
                            <div className="pt-3 border-t border-emerald-900/50 space-y-1 text-xs text-emerald-200/80 font-mono">
                              <p className="font-sans font-bold text-emerald-400 mb-1">การแทนค่าตรวจคำตอบในสมการ:</p>
                              {solution.verifications.map((v, idx) => (
                                <p key={idx}>
                                  สมการ {idx + 1}: {v.substitutedText} {v.isValid ? '✓ (ถูกต้อง)' : '✕'}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Method Specific */}
          {currentStep >= 4 && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              {method === 'inverse' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">4</span>
                    STEP 4: หา Adjugate Matrix adj(A)
                  </h3>
                  {inverse.hasInverse && inverse.adjugateA ? (
                    <div className="space-y-3">
                      {dimension === '2x2' ? (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
                          <MathView latex={`\\text{สูตรสำหรับ 2x2: } A = \\begin{bmatrix} a & b \\\\[0.5em] c & d \\end{bmatrix} \\implies \\operatorname{adj}(A) = \\begin{bmatrix} d & -b \\\\[0.5em] -c & a \\end{bmatrix}`} />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">หาจากการสลับเปลี่ยนของเมทริกซ์โคแฟกเตอร์ (Transpose of Cofactors)</p>
                      )}
                      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 inline-block">
                        <MatrixDisplay matrix={inverse.adjugateA} symbol="\operatorname{adj}(A)" className="text-xl font-bold text-emerald-400" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-rose-400 text-sm p-3 bg-rose-950/40 rounded-xl border border-rose-800">
                      ไม่สามารถหา adj(A) เพื่อใช้คำนวณ A⁻¹ ได้เนื่องจาก det(A) = 0
                    </p>
                  )}
                </>
              )}

              {method === 'cramer' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">4</span>
                    STEP 4: สร้าง Dₓ, Dᵧ {dimension === '3x3' ? ', D_z' : ''} และคำนวณ Determinant
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-base font-bold">
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <p className="text-xs text-slate-400 font-sans">แทนที่คอลัมน์ที่ 1 ด้วย B:</p>
                      <DeterminantDisplay matrix={cramer.matrixDx} label="D_x = \det(D_x)" className="text-lg" />
                      <div className="pt-2 border-t border-slate-800 text-emerald-400 text-sm">
                        <MathView latex={`\\det(D_x) = ${cramer.detDx}`} />
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <p className="text-xs text-slate-400 font-sans">แทนที่คอลัมน์ที่ 2 ด้วย B:</p>
                      <DeterminantDisplay matrix={cramer.matrixDy} label="D_y = \det(D_y)" className="text-lg" />
                      <div className="pt-2 border-t border-slate-800 text-emerald-400 text-sm">
                        <MathView latex={`\\det(D_y) = ${cramer.detDy}`} />
                      </div>
                    </div>
                    {dimension === '3x3' && cramer.matrixDz && (
                      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                        <p className="text-xs text-slate-400 font-sans">แทนที่คอลัมน์ที่ 3 ด้วย B:</p>
                        <DeterminantDisplay matrix={cramer.matrixDz} label="D_z = \det(D_z)" className="text-lg" />
                        <div className="pt-2 border-t border-slate-800 text-emerald-400 text-sm">
                          <MathView latex={`\\det(D_z) = ${cramer.detDz}`} />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 5: Method Specific */}
          {currentStep >= 5 && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              {method === 'inverse' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">5</span>
                    STEP 5: คำนวณ A⁻¹ (Inverse Matrix)
                  </h3>
                  {inverse.hasInverse && inverse.inverseA && inverse.adjugateA ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-sm font-mono text-indigo-300">
                        <MathView latex={`A^{-1} = \\frac{1}{\\det(A)} \\cdot \\operatorname{adj}(A) = \\frac{1}{${solution.determinant}} \\begin{bmatrix} ${inverse.adjugateA.map(r => r.join(' & ')).join(' \\\\[0.5em] ')} \\end{bmatrix}`} />
                      </div>
                      <p className="text-xs text-slate-400">แทนค่าในรูปเศษส่วนอย่างต่ำ (Exact Fractions):</p>
                      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 inline-block">
                        <MatrixDisplay matrix={inverse.inverseA} symbol="A^{-1}" className="text-xl font-bold text-emerald-400" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-rose-400 text-sm p-3 bg-rose-950/40 rounded-xl border border-rose-800">
                      ไม่สามารถคำนวณ A⁻¹ ได้เนื่องจาก det(A) = 0
                    </p>
                  )}
                </>
              )}

              {method === 'cramer' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">5</span>
                    STEP 5: คำนวณหาค่าตัวแปร
                  </h3>
                  {cramer.detD !== 0 ? (
                    <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 font-mono text-lg font-bold text-indigo-300 space-y-3 inline-block">
                      <p><MathView latex={`x = \\frac{D_x}{D} = \\frac{${cramer.detDx}}{${cramer.detD}} = ${formatLatexFraction(cramer.detDx / cramer.detD)}`} /></p>
                      <p><MathView latex={`y = \\frac{D_y}{D} = \\frac{${cramer.detDy}}{${cramer.detD}} = ${formatLatexFraction(cramer.detDy / cramer.detD)}`} /></p>
                      {dimension === '3x3' && cramer.detDz !== undefined && (
                        <p><MathView latex={`z = \\frac{D_z}{D} = \\frac{${cramer.detDz}}{${cramer.detD}} = ${formatLatexFraction(cramer.detDz / cramer.detD)}`} /></p>
                      )}
                    </div>
                  ) : (
                    <p className="text-rose-400 text-sm">ไม่สามารถคำนวณได้เนื่องจาก D = 0 (ตัวหารเป็นศูนย์)</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 6: Method Specific */}
          {currentStep >= 6 && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              {method === 'inverse' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">6</span>
                    STEP 6: คำนวณ X = A⁻¹B
                  </h3>
                  {inverse.hasInverse && solution.solution && inverse.inverseA ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-lg font-mono font-bold text-indigo-300 space-y-3 inline-block">
                        <MathView
                          latex={`X = A^{-1}B = \\begin{bmatrix} ${inverse.inverseA.map(r => r.map(v => formatLatexFraction(v)).join(' & ')).join(' \\\\[0.5em] ')} \\end{bmatrix} \\begin{bmatrix} ${system.B.map(b => formatLatexFraction(b)).join(' \\\\[0.5em] ')} \\end{bmatrix}`}
                        />
                      </div>
                      <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 text-xl font-mono font-extrabold text-emerald-400 inline-block ml-4">
                        <MathView
                          latex={`\\boxed{X = \\begin{bmatrix} ${solution.solution.map(s => formatLatexFraction(s)).join(' \\\\[0.5em] ')} \\end{bmatrix}}`}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-rose-400 text-sm">ไม่สามารถคำนวณ X = A⁻¹B ได้เนื่องจากไม่มี A⁻¹</p>
                  )}
                </>
              )}

              {method === 'cramer' && (
                <>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">6</span>
                    STEP 6: สรุปและตรวจคำตอบระบบสมการ
                  </h3>

                  {solution.type === 'unique' && solution.solution && (
                    <div className="p-6 bg-gradient-to-r from-emerald-950/80 to-slate-950 border-2 border-emerald-500 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-black uppercase text-emerald-400 tracking-widest">
                          คำตอบของระบบสมการ (VERIFIED SOLUTION)
                        </span>
                        <div className="text-2xl sm:text-3xl font-mono font-black text-white mt-1">
                          x = {formatLatexFraction(solution.solution[0])},{' '}
                          y = {formatLatexFraction(solution.solution[1])}
                          {dimension === '3x3' && `, z = ${formatLatexFraction(solution.solution[2])}`}
                        </div>
                        {solution.verifications && (
                          <div className="mt-3 pt-3 border-t border-emerald-900/50 space-y-1 text-xs text-emerald-200/80 font-mono">
                            <p className="font-sans font-bold text-emerald-400 mb-1">การแทนค่าตรวจคำตอบในสมการ:</p>
                            {solution.verifications.map((v, idx) => (
                              <p key={idx}>
                                สมการ {idx + 1}: {v.substitutedText} {v.isValid ? '✓ (ถูกต้อง)' : '✕'}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg">
                        ✓
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 7: Inverse Summary & Verification */}
          {currentStep >= 7 && method === 'inverse' && (
            <div className="p-6 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">7</span>
                STEP 7: สรุปและตรวจคำตอบระบบสมการ
              </h3>

              {solution.type === 'unique' && solution.solution && (
                <div className="p-6 bg-gradient-to-r from-emerald-950/80 to-slate-950 border-2 border-emerald-500 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-widest">
                      คำตอบของระบบสมการ (VERIFIED SOLUTION)
                    </span>
                    <div className="text-2xl sm:text-3xl font-mono font-black text-white mt-1">
                      x = {formatLatexFraction(solution.solution[0])},{' '}
                      y = {formatLatexFraction(solution.solution[1])}
                      {dimension === '3x3' && `, z = ${formatLatexFraction(solution.solution[2])}`}
                    </div>
                    {solution.verifications && (
                      <div className="mt-3 pt-3 border-t border-emerald-900/50 space-y-1 text-xs text-emerald-200/80 font-mono">
                        <p className="font-sans font-bold text-emerald-400 mb-1">การแทนค่าตรวจคำตอบในสมการ:</p>
                        {solution.verifications.map((v, idx) => (
                          <p key={idx}>
                            สมการ {idx + 1}: {v.substitutedText} {v.isValid ? '✓ (ถูกต้อง)' : '✕'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg">
                    ✓
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive "Ask the Class" Overlay Bar */}
        {showClassQuestion && (() => {
          const qObj = getClassroomQuestion(method, currentStep);
          return (
            <div className="mt-8 p-6 bg-indigo-950/90 border-2 border-indigo-500 rounded-2xl relative z-20 space-y-4 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400" /> ถามชั้นเรียน (Ask the Class) — ขั้นตอนที่ {currentStep}
                </span>
                <div className="flex items-center gap-2">
                  {!livePollId && (
                    <button
                      onClick={() => handleStartLivePoll(qObj)}
                      disabled={pollStarting || !teacherClassCode}
                      title={teacherClassCode ? undefined : 'ต้องสร้างรหัสห้องเรียนที่หน้าตั้งค่าก่อน'}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {pollStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                      {pollCloseSummary ? 'ถามใหม่อีกครั้ง (Poll Again)' : 'เริ่มรับคำตอบสด (Start Live Poll)'}
                    </button>
                  )}
                  <button
                    onClick={() => setQuestionRevealed(!questionRevealed)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                  >
                    {questionRevealed ? 'ซ่อนเฉลย' : 'เฉลยคำตอบนักเรียน'}
                  </button>
                </div>
              </div>

              <p className="text-lg font-bold text-white">
                "{qObj.question}"
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                {qObj.options.map((opt, oIdx) => (
                  <div key={oIdx} className="p-3 bg-slate-900 rounded-xl border border-slate-700 text-slate-200">
                    {opt}
                  </div>
                ))}
              </div>

              {questionRevealed && (
                <div className="p-4 bg-emerald-950/80 border border-emerald-500 rounded-xl text-xs text-emerald-200 animate-fade-in">
                  <p className="font-extrabold text-sm text-emerald-400">✓ คำตอบที่ถูกต้อง: {qObj.correctAnswer}</p>
                  <p className="mt-1">
                    คำอธิบาย: {qObj.explanation}
                  </p>
                </div>
              )}

              {/* Live poll: QR + live vote bars while open, final breakdown once closed. Vote
                  bars are plain width-scaled divs — just 2-4 options, no charting library
                  needed, matching the visual style already used for progress bars elsewhere. */}
              {livePollId && (
                <div className="p-4 bg-rose-950/60 border border-rose-500/60 rounded-xl space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {pollQrDataUrl && (
                      <div className="bg-white p-2 rounded-xl flex-shrink-0">
                        <img src={pollQrDataUrl} alt="QR สำหรับตอบคำถามสด" className="w-32 h-32" />
                      </div>
                    )}
                    <div className="flex-grow w-full space-y-2">
                      <p className="text-xs font-black text-rose-300 uppercase tracking-widest">
                        กำลังรับคำตอบสด — {pollResults?.totalAnswers ?? 0} คนตอบแล้ว
                      </p>
                      {pollResults?.options.map((opt) => {
                        const count = pollResults.voteCounts[opt] || 0;
                        const counts: number[] = Object.values(pollResults.voteCounts);
                        const maxCount = Math.max(1, ...counts);
                        const pct = Math.round((count / maxCount) * 100);
                        return (
                          <div key={opt} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-200">
                              <span className="truncate pr-2">{opt}</span>
                              <span>{count}</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleCloseLivePoll}
                    disabled={pollClosing}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {pollClosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CircleStop className="w-3.5 h-3.5" />}
                    ปิดรับคำตอบ (Close Poll)
                  </button>
                </div>
              )}

              {pollCloseSummary && (
                <div className="p-4 bg-emerald-950/60 border border-emerald-500/60 rounded-xl space-y-2 animate-fade-in">
                  <p className="text-xs font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" /> ผลคำตอบสด ({pollCloseSummary.totalAnswers} คนตอบ)
                  </p>
                  <div className="space-y-1">
                    {Object.entries(pollCloseSummary.voteCounts).map(([opt, count]) => (
                      <p key={opt} className="text-[11px] font-bold text-slate-200">
                        {opt === pollCloseSummary.correctAnswer ? '✓ ' : ''}
                        {opt}: {count} คน
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-emerald-200 pt-1">
                    {pollCloseSummary.correctDisplayNames.length > 0
                      ? `ตอบถูก: ${pollCloseSummary.correctDisplayNames.join(', ')}`
                      : 'ยังไม่มีใครตอบถูกในรอบนี้'}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* Teacher Bottom Control Panel */}
      <footer className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 1}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> ขั้นตอนก่อนหน้า
          </button>
          <button
            onClick={handleNextStep}
            disabled={currentStep >= totalSteps}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-colors"
          >
            แสดงขั้นตอนถัดไป <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowClassQuestion(!showClassQuestion)}
            className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <HelpCircle className="w-4 h-4" /> ถามชั้นเรียน (Ask Class)
          </button>
          <button
            onClick={handleShowAll}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Eye className="w-4 h-4" /> เฉลยคำตอบทั้งหมด
          </button>
          <button
            onClick={handleRestart}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> เริ่มใหม่
          </button>
        </div>
      </footer>
    </div>
  );
}
