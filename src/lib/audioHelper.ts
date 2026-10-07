/**
 * المساعد الصوتي الموحد للماسح الضوئي (Web Audio API)
 * يوفر صوت "تكة" ناعمة واحترافية بدون الحاجة لتحميل ملفات صوتية خارجية
 * ويعمل بكفاءة 100% دون اتصال بالإنترنت (Offline / PWA) وعلى كافة المتصفحات
 */

let audioCtx: AudioContext | null = null;

// تهيئة أو استئناف سياق الصوت بناءً على تفاعل المستخدم (User Gesture)
export function initScannerAudio(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {
    // تجاهل الأخطاء إن وجدت
  }
}

/**
 * تشغيل صوت "رنة/جرس" عند نجاح مسح الكود
 * (Pleasant bell sound)
 */
export function playScanClickSound(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    // صوت جرس باستخدام مذبذبين بترددات متناغمة (Bell sound)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";
    
    // ترددات رنة جميلة (مثلاً 880 هرتز والتوافق الخامس 1320 هرتز)
    osc1.frequency.setValueAtTime(880, now);
    osc2.frequency.setValueAtTime(1320, now);

    // غلاف الصوت: يبدأ فوراً ويتلاشى بنعومة ليعطي إحساس الجرس
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch {
    // تجاهل أي قيود أمان للمتصفح
  }
}

/**
 * تشغيل صوت خطأ (بوق مزدوج منخفض) عند مسح كود خاطئ أو التخلفات
 */
export function playScanErrorSound(): void {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const ctx = audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(120, now + 0.15); // هبوط التردد

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.setValueAtTime(0.3, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // تجاهل الأخطاء
  }
}
