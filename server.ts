import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { TOPIC_LABELS, TOPIC_DIMENSIONS, isTopicKey } from './src/lib/topics';
import { SyncedProgress } from './src/lib/classroomStore';
import { createClass, syncStudentProgress, fetchRoster } from './server/classroomFileStore';

dotenv.config();

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
  app.post('/api/ai-tutor', async (req, res) => {
    try {
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
  // Teacher- or student-triggered (see TeacherDashboard.tsx and PrePostTest.tsx) once a
  // student's topicMastery for that topic falls below the teacher's configured threshold.
  // This must stay Socratic like the tutor above: a fresh problem + guiding questions only,
  // never a worked solution.
  app.post('/api/ai-practice-problem', async (req, res) => {
    try {
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
