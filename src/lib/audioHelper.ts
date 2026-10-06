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
 * تشغيل صوت "تكة" فيزيائية ناعمة وسريعة عند نجاح مسح الكود
 * (Subtle tactile click sound: ~35ms)
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

    // تكة سريعة وناعمة (تدرج ترددي سريع من 1300Hz إلى 350Hz في 35 مللي ثانية)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1300, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.035);

    // غلاف الصوت: يبدأ مباشرة ثم يتلاشى بسلاسة تامة لتجنب أي فرقعة صوتية (Clipping)
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch {
    // تجاهل أي قيود أمان للمتصفح
  }
}
