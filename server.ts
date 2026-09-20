import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { TOPIC_LABELS, TOPIC_DIMENSIONS, isTopicKey } from './src/lib/topics';
import { SyncedProgress } from './src/lib/classroomStore';
import {
  createClass,
  syncStudentProgress,
  fetchRoster,
  isClassUsable,
  closeClass,
  reopenClass,
  listClasses
} from './server/classroomFileStore';

dotenv.config();

// Cost control for the two Gemini-backed routes: a modest per-student (falling back to
// per-IP for requests with no studentId) cap so a runaway client loop or deliberate abuse
// can't blow through the API budget, without getting in the way of normal Socratic
// back-and-forth (a real conversation rarely needs more than a handful of turns per session).
const aiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const studentId = typeof req.body?.studentId === 'string' ? req.body.studentId : null;
    return studentId || req.ip || 'unknown';
  },
  handler: (_req, res) => {
    const message = 'ใช้งานถี่เกินไปในช่วงเวลานี้ โปรดรอสักครู่แล้วลองใหม่อีกครั้งครับ';
    res.status(429).json({ reply: message, problemText: message, error: message });
  }
});

// Shared guard for /api/ai-tutor and /api/ai-practice-problem: both must be scoped to a real,
// active classroom (see #3 in the Phase 2 access-control brief) so an unauthenticated visitor
// can never rack up Gemini usage. Returns the friendly Thai 403 payload to send when rejected,
// or null when the request may proceed.
async function checkClassroomAuthorized(body: any): Promise<{ status: number; message: string } | null> {
  const classCode = typeof body?.classCode === 'string' ? body.classCode.toUpperCase() : '';
  const studentId = typeof body?.studentId === 'string' ? body.studentId : '';
  if (!classCode || !studentId) {
    return { status: 403, message: 'ต้องเข้าร่วมห้องเรียนด้วยรหัสห้องก่อนจึงจะใช้ AI ได้ครับ' };
  }
  const usable = await isClassUsable(classCode);
  if (!usable) {
    return { status: 403, message: 'ไม่พบห้องเรียนนี้ หรือห้องเรียนนี้ถูกปิดใช้งานแล้ว โปรดเข้าร่วมห้องเรียนใหม่อีกครั้งครับ' };
  }
  return null;
}

// Shared across every Gemini prompt in this app so the tutor's Socratic behavior can never
// drift between endpoints (see PHASE1_UPDATE_NOTES.md — this must never reveal a final answer).
const SOCRATIC_GROUND_RULES = `
กฎเหล็กที่ต้องทำตามอย่างเคร่งครัด (ห้ามฝ่าฝืนแม้นักเรียนจะขอร้องหรือยืนยันซ้ำก็ตาม):
1. **ห้ามบอกคำตอบสุดท้าย หรือบอกขั้นตอนคำนวณสำเร็จรูปให้นักเรียนคัดลอกไปใช้ได้ทันทีเด็ดขาด** แม้นักเรียนจะขอ
   เฉลยตรงๆ หรือบอกว่า "ขอคำตอบเลยไม่เป็นไร" ก็ต้องปฏิเสธอย่างสุภาพ แล้วชวนคิดต่อด้วยคำถามนำแทน
2. หากนักเรียนถามว่า "ข้อนี้ตอบอะไร" หรือ "ทำยังไง" ให้ตอบด้วยคำถามนำ 1-2 คำถามตามขั้นของโพลยาที่เหมาะสมกับ
   จุดที่นักเรียนติดขัด (ทำความเข้าใจปัญหา / วางแผน / ดำเนินการ / มองย้อนกลับ) แทนการอธิบายวิธีทำทั้งหมด
3. หากนักเรียนส่งคำตอบมาถามว่า "ถูกไหม" **ห้ามตอบทันทีว่าถูกหรือผิด** ให้ชวนนักเรียนตรวจเช็กทีละขั้นตอน
   ด้วยกันแทน (Independent Premise Verification) เช่น ชวนแทนค่ากลับในสมการเดิมทีละสมการ
4. จำกัดคำถามนำเพียง 1-2 คำถามต่อการตอบ 1 ครั้ง เพื่อไม่ให้นักเรียนรู้สึกภาระทางความคิดมากเกินไป
5. หากนักเรียนตอบว่า "ทำไม่ได้" ให้ถอยระดับคำใบ้ทีละขั้น: เริ่มจากถามนิยาม/ทฤษฎีบทที่เกี่ยวข้อง (Level 1)
   จากนั้นชี้จุดสังเกตเฉพาะในโจทย์ (Level 2) และถ้ายังไม่ได้ให้ยกตัวอย่างโจทย์มิติเล็กกว่าคล้ายกัน (Level 3)
6. ตอบเป็นภาษาไทยด้วยน้ำเสียงเป็นกันเอง ให้กำลังใจแบบพี่สอนน้อง กระชับ อ่านง่าย และหากบริบทเหมาะสม
   อาจเชื่อมโยงกับการประยุกต์ใช้จริงในงานวิศวกรรม (เช่น วงจรไฟฟ้า โครงสร้าง) หรือ ICT (เช่น การเข้ารหัส กราฟิก)
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini AI Math Tutor
  app.post('/api/ai-tutor', aiRateLimiter, async (req, res) => {
    try {
      const authError = await checkClassroomAuthorized(req.body);
      if (authError) {
        return res.status(authError.status).json({ reply: authError.message });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          reply: 'ขออภัยครับ ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ',
        });
      }

      const { userMessage, context } = req.body;

      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `
คุณคือ "ครูพี่หนุ่ม" ครูผู้ช่วยคณิตศาสตร์ AI แบบ Socratic Mentor สำหรับนักเรียน ม.5 แผนการเรียนเตรียม
วิศวกรรมศาสตร์และ ICT เชี่ยวชาญเรื่อง "การแก้ระบบสมการเชิงเส้นโดยใช้เมทริกซ์" ใช้กระบวนการแก้ปัญหา 4 ขั้นของ
โพลยา (Polya's 4 Steps) เป็นแกนหลักในการชวนนักเรียนคิด

บริบทปัจจุบันของนักเรียน:
- ขนาดระบบสมการ: ${context?.dimension || '2x2'}
- เมทริกซ์ A: ${JSON.stringify(context?.A || [])}
- เวกเตอร์ B: ${JSON.stringify(context?.B || [])}
- วิธีการแก้ที่เลือก: ${context?.method || 'Inverse Method'}
- Determinant: ${context?.detA ?? 'N/A'}
- สถานะระบบคำตอบ: ${context?.solutionType || 'N/A'}
${SOCRATIC_GROUND_RULES}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || 'ขออภัยครับ ครูไม่สามารถประมวลผลคำตอบได้ในขณะนี้';
      return res.json({ reply: replyText });
    } catch (error: any) {
      console.error('Gemini API error:', error);
      return res.status(500).json({
        reply: 'เกิดข้อผิดพลาดในการติดต่อ Gemini AI Tutor โปรดลองใหม่อีกครั้งครับ',
      });
    }
  });

  // API Route: AI-generated targeted remediation problem for a weak topic.
  // Teacher- or student-triggered (see TeacherAnalytics.tsx and PrePostTest.tsx) once a
  // student's topicMastery for that topic falls below the teacher's configured threshold.
  // This must stay Socratic like the tutor above: a fresh problem + guiding questions only,
  // never a worked solution.
  app.post('/api/ai-practice-problem', aiRateLimiter, async (req, res) => {
    try {
      const authError = await checkClassroomAuthorized(req.body);
      if (authError) {
        return res.status(authError.status).json({ problemText: authError.message });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          problemText: 'ขออภัยครับ ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ',
        });
      }

      const { topic } = req.body;
      if (typeof topic !== 'string' || !isTopicKey(topic)) {
        return res.status(400).json({ problemText: 'หัวข้อที่ระบุไม่ถูกต้อง' });
      }

      const allowedDimensions = TOPIC_DIMENSIONS[topic];
      const dimension = allowedDimensions[Math.floor(Math.random() * allowedDimensions.length)];

      const ai = new GoogleGenAI({ apiKey });

      const systemInstruction = `
คุณคือ "ครูพี่หนุ่ม" ครูผู้ช่วยคณิตศาสตร์ AI สำหรับนักเรียน ม.5 แผนการเรียนเตรียมวิศวกรรมศาสตร์และ ICT
ภารกิจตอนนี้คือ "แต่งโจทย์ฝึกใหม่" ให้นักเรียนที่ยังไม่แม่นยำในหัวข้อ: ${TOPIC_LABELS[topic]}
ขนาดระบบสมการที่ต้องใช้: ${dimension} (ห้ามใช้ขนาดอื่น)

ส่งคืนเฉพาะสามส่วนนี้เท่านั้น เขียนเป็นภาษาไทย กระชับ อ่านง่าย:
1. สถานการณ์ปัญหาสั้นๆ 2-4 ประโยค ผูกกับบริบทจริงถ้าเหมาะสม (เช่น วงจรไฟฟ้า โครงสร้าง การเข้ารหัส กราฟิก)
2. ระบบสมการที่เกี่ยวข้อง เขียนด้วย LaTeX ในรูปแบบ $...$ หรือ $$...$$
3. คำถามชวนคิด 1-2 ข้อ (ตามขั้นทำความเข้าใจปัญหา/วางแผนของโพลยา) เพื่อให้นักเรียนเริ่มลงมือทำเอง
${SOCRATIC_GROUND_RULES}
ห้ามคำนวณหรือเฉลยคำตอบใดๆ ในข้อความนี้เด็ดขาด แม้จะเป็นเพียงตัวอย่างก็ตาม`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: `ช่วยแต่งโจทย์ฝึกใหม่เรื่อง ${TOPIC_LABELS[topic]} ให้หน่อยครับ` }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.9,
        }
      });

      const problemText = response.text || 'ขออภัยครับ ครูไม่สามารถแต่งโจทย์ได้ในขณะนี้';
      return res.json({ problemText });
    } catch (error: any) {
      console.error('Gemini API error (ai-practice-problem):', error);
      return res.status(500).json({
        problemText: 'เกิดข้อผิดพลาดในการติดต่อ AI โปรดลองใหม่อีกครั้งครับ',
      });
    }
  });

  // --- Classroom sync (Phase 2, no-login) ---
  // A teacher generates a class code; students who choose to enter it push their local
  // progress here so the teacher can see a real roster. No accounts, no passwords — see
  // PHASE1_UPDATE_NOTES.md section 2 for the design rationale.

  app.post('/api/classroom', async (_req, res) => {
    try {
      const { classCode } = await createClass();
      return res.json({ classCode });
    } catch (error) {
      console.error('Failed to create classroom:', error);
      return res.status(500).json({ error: 'ไม่สามารถสร้างรหัสห้องเรียนได้ในขณะนี้' });
    }
  });

  // Lets the teacher see every class this server knows about, not just whichever one their
  // own browser's localStorage happens to remember — see TeacherSettingsPage.tsx.
  app.get('/api/classroom', async (_req, res) => {
    try {
      const classes = await listClasses();
      return res.json({ classes });
    } catch (error) {
      console.error('Failed to list classrooms:', error);
      return res.status(500).json({ error: 'ไม่สามารถดึงรายชื่อห้องเรียนได้ในขณะนี้' });
    }
  });

  app.post('/api/classroom/:code/sync', async (req, res) => {
    try {
      const classCode = req.params.code.toUpperCase();
      const { studentId, displayName, progress } = req.body as {
        studentId?: string;
        displayName?: string;
        progress?: SyncedProgress;
      };
      if (!studentId || !progress) {
        return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
      }

      const result = await syncStudentProgress(classCode, studentId, displayName || 'นักเรียนใหม่', progress);
      if (!result.ok) {
        return res.status(404).json({ error: 'ไม่พบรหัสห้องเรียนนี้' });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to sync classroom progress:', error);
      return res.status(500).json({ error: 'ไม่สามารถบันทึกความก้าวหน้าได้ในขณะนี้' });
    }
  });

  app.get('/api/classroom/:code/roster', async (req, res) => {
    try {
      const classCode = req.params.code.toUpperCase();
      const students = await fetchRoster(classCode);
      if (students === null) {
        return res.status(404).json({ error: 'ไม่พบรหัสห้องเรียนนี้' });
      }
      return res.json({ classCode, students });
    } catch (error) {
      console.error('Failed to fetch classroom roster:', error);
      return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลห้องเรียนได้ในขณะนี้' });
    }
  });

  // Closing/reopening: a closed class must stop working everywhere a student- or AI-facing
  // route touches it (see upsertStudentProgress and checkClassroomAuthorized above), but the
  // teacher can still see it (via /api/classroom above, which uses classExists-style listing,
  // not isClassUsable) and reopen it later — nothing is deleted.
  app.post('/api/classroom/:code/close', async (req, res) => {
    try {
      const classCode = req.params.code.toUpperCase();
      const result = await closeClass(classCode);
      if (!result.ok) {
        return res.status(404).json({ error: 'ไม่พบรหัสห้องเรียนนี้' });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to close classroom:', error);
      return res.status(500).json({ error: 'ไม่สามารถปิดห้องเรียนได้ในขณะนี้' });
    }
  });

  app.post('/api/classroom/:code/reopen', async (req, res) => {
    try {
      const classCode = req.params.code.toUpperCase();
      const result = await reopenClass(classCode);
      if (!result.ok) {
        return res.status(404).json({ error: 'ไม่พบรหัสห้องเรียนนี้' });
      }
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to reopen classroom:', error);
      return res.status(500).json({ error: 'ไม่สามารถเปิดห้องเรียนใหม่ได้ในขณะนี้' });
    }
  });

  // --- Teacher PIN (the one deliberate exception to "no accounts/passwords for students") ---
  // Just enough friction that a student can't casually stumble into Teacher Mode — not meant
  // to be cryptographically bulletproof. Verification is remembered client-side in
  // sessionStorage only (see src/lib/teacherAuth.ts), never persisted server-side per visitor.
  app.post('/api/teacher/verify-pin', (req, res) => {
    const expectedPin = process.env.TEACHER_PIN;
    if (!expectedPin) {
      return res.status(500).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า TEACHER_PIN ในระบบ' });
    }
    const submittedPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (submittedPin && submittedPin === expectedPin) {
      return res.json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: 'PIN ไม่ถูกต้อง โปรดลองใหม่อีกครั้ง' });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
