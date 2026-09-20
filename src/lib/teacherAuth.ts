// Client-side glue for the Teacher PIN gate — the one deliberate exception to this app's
// "no accounts/passwords for students" principle, scoped only to unlocking Teacher Mode.
// Verification is remembered in sessionStorage (not localStorage) so it never silently
// persists forever on a shared classroom computer — it clears the moment the tab closes.

const TEACHER_PIN_VERIFIED_KEY = 'matrix_master_teacher_pin_verified_v1';

export function hasVerifiedTeacherPin(): boolean {
  try {
    return sessionStorage.getItem(TEACHER_PIN_VERIFIED_KEY) === '1';
  } catch {
    return false; // fail closed: never grant teacher access if storage is unavailable
  }
}

function markTeacherPinVerified(): void {
  try {
    sessionStorage.setItem(TEACHER_PIN_VERIFIED_KEY, '1');
  } catch {
    // ignore — verification will just be asked for again this tab, which is safe
  }
}

export async function verifyTeacherPin(pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/teacher/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      markTeacherPinVerified();
      return { ok: true };
    }
    return { ok: false, error: data.error || 'PIN ไม่ถูกต้อง โปรดลองใหม่อีกครั้ง' };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ลองใหม่อีกครั้ง' };
  }
}
