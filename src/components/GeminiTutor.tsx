import { useState } from 'react';
import { Sparkles, Send, Lightbulb, RefreshCw } from 'lucide-react';
import { LinearSystem } from '../types';
import { RenderTextWithMath } from './math/MathComponents';
import { getClassroomLink, getStudentId } from '../lib/classroomSync';

interface GeminiTutorProps {
  system: LinearSystem;
  activeMethod: string;
  detA?: number;
  solutionType?: string;
}

export function GeminiTutor({ system, activeMethod, detA, solutionType }: GeminiTutorProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: 'สวัสดีครับ ครูพี่หนุ่มเองนะครับ! สงสัยขั้นตอนการแก้สมการด้วยเมทริกซ์ตรงไหน ลองเล่าโจทย์หรือความคิดของน้องมาได้เลย พี่จะช่วยตั้งคำถามให้คิดต่อทีละขั้นครับ 😊',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    'ทำไมต้องหา det(A)?',
    'ช่วยใบ้วิธีคิดข้อนี้หน่อย',
    'Cramer\'s Rule ใช้ตอนไหนดีที่สุด?',
    'ข้อแตกต่างระหว่าง Inverse กับ Gauss',
  ];

  async function handleSendMessage(textToSend?: string) {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const newMsgs = [...messages, { sender: 'user' as const, text: query }];
    setMessages(newMsgs);
    if (!textToSend) setInput('');
    setLoading(true);

    const classroomLink = getClassroomLink();
    if (!classroomLink) {
      // Should not happen in practice — joining a classroom is mandatory before any of the
      // app is reachable (see AppLayout.tsx) — but fail with a clear message rather than a
      // silent 403 if this component is ever reached without one.
      setMessages([
        ...newMsgs,
        { sender: 'ai', text: 'ต้องเข้าร่วมห้องเรียนด้วยรหัสห้องก่อนจึงจะใช้ครูพี่หนุ่ม AI ได้ครับ ลองรีเฟรชหน้านี้' },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: query,
          classCode: classroomLink.classCode,
          studentId: getStudentId(),
          context: {
            dimension: system.dimension,
            A: system.A,
            B: system.B,
            method: activeMethod,
            detA,
            solutionType,
          },
        }),
      });

      const data = await res.json();
      setMessages([...newMsgs, { sender: 'ai', text: data.reply || 'ขออภัยครับ ครูไม่สามารถตอบได้ในขณะนี้' }]);
    } catch (err) {
      setMessages([
        ...newMsgs,
        {
          sender: 'ai',
          text: 'เกิดข้อผิดพลาดในการส่งข้อความ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตครับ',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl shadow-lg p-5 flex flex-col relative overflow-hidden h-full border border-indigo-500/20">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-sm shadow-inner">
            <Sparkles className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide">ครูพี่หนุ่ม AI</h3>
            <p className="text-[10px] text-indigo-300 font-medium">Socratic Mentor • ขับเคลื่อนด้วย Gemini</p>
          </div>
        </div>
        <button
          onClick={() =>
            setMessages([
              {
                sender: 'ai',
                text: 'เริ่มการสนทนาใหม่แล้วครับ! มีข้อสงสัยจุดไหนเกี่ยวกับเมทริกซ์ ลองเล่าให้พี่หนุ่มฟังได้เลยครับ',
              },
            ])
          }
          className="text-white/40 hover:text-white text-xs p-1 rounded transition-colors"
          title="ล้างแชท"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Message Chat History */}
      <div className="relative z-10 flex-grow overflow-y-auto space-y-3 pr-1 text-xs mb-3 scrollbar-thin">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border leading-relaxed ${
              m.sender === 'ai'
                ? 'bg-white/10 backdrop-blur-md text-white/95 border-white/10 rounded-tl-none shadow-sm'
                : 'bg-indigo-600/80 text-white border-indigo-400/30 rounded-tr-none ml-auto max-w-[85%]'
            }`}
          >
            {m.sender === 'ai' && (
              <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-amber-300" /> Tutor Advice
              </p>
            )}
            <div className="whitespace-pre-line">
              {/* Both bubble variants are dark surfaces (translucent white-on-dark for the AI,
                  indigo-600/80 for the user) — theme="light"'s near-black bold text would be
                  invisible on either, so both use the dark-surface accent color. */}
              <RenderTextWithMath text={m.text} theme="dark" />
            </div>
          </div>
        ))}
        {loading && (
          <div className="p-3 bg-white/10 backdrop-blur-md text-white/70 rounded-xl border border-white/10 flex items-center gap-2">
            <span className="animate-spin text-indigo-300">⏳</span>
            <span>กำลังคิดคำตอบสำหรับคุณ...</span>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="relative z-10 space-y-1.5 mb-3">
        <p className="text-[10px] text-indigo-300/70 uppercase font-semibold px-1">คำถามแนะนำ:</p>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/90 text-[11px] rounded-lg font-medium transition-all border border-white/10 text-left truncate max-w-full"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div className="relative z-10 mt-auto pt-2 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามคณิตศาสตร์..."
            className="flex-grow bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-indigo-400 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
    </aside>
  );
}
