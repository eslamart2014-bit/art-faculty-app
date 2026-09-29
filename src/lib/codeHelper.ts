/**
 * دوال مساعدة موحدة لأكواد الطلاب وتوليد الأرقام السرية وتنسيق البيانات
 */

// تحويل الأرقام العربية المشرقية والفارسية (٠-٩) إلى أرقام لاتينية قياسية (0-9)
export function normalizeDigits(str: string): string {
  if (!str) return "";
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let res = str;
  for (let i = 0; i < 10; i++) {
    res = res.split(arabicNumerals[i]).join(i.toString());
    res = res.split(persianNumerals[i]).join(i.toString());
  }
  return res;
}

// تنظيف النصوص الممسوحة ضوئياً من الرموز الخفية لاتجاه النص في iOS (BiDi marks, zero-width, BOM)
export function sanitizeScannedString(str: string): string {
  if (!str) return "";
  return normalizeDigits(
    str
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00A0\uFFFD\u0000-\u001F]/g, "")
      .trim()
  );
}

// تنسيق الكود الجامعي ليكون دائماً بصيغة 4 خانات على الأقل إذا كان رقمياً
export function formatStudentCode(code: string): string {
  if (!code) return "";
  const clean = sanitizeScannedString(code);
  if (/^\d+$/.test(clean) && clean.length < 4) {
    return clean.padStart(4, '0');
  }
  return clean;
}

// استخراج جميع الاحتمالات الممكنة للكود (بالأصفار وبدونها) للبحث الدقيق في قاعدة البيانات
export function getStudentCodeVariants(code: string): string[] {
  if (!code) return [];
  const clean = sanitizeScannedString(code);
  if (!clean) return [];

  const variants = new Set<string>();
  variants.add(clean);

  if (/^\d+$/.test(clean)) {
    variants.add(parseInt(clean, 10).toString());
    variants.add(clean.padStart(4, '0'));
  }

  return Array.from(variants).filter(Boolean);
}

// بناء شرط PostgREST Supabase .or() لجميع صيغ الكود
export function buildStudentCodeFilter(variants: string[], columnName: string = 'student_code'): string {
  if (!variants || variants.length === 0) return `${columnName}.eq.`;
  return variants.map(v => `${columnName}.eq.${v}`).join(',');
}

// استخراج كود الطالب من النص الممسوح ضوئياً من الـ QR بكفاءة عالية على جميع الأجهزة وiOS
export function extractStudentCode(decodedText: string): string {
  if (!decodedText) return "";

  const raw = sanitizeScannedString(decodedText);
  if (!raw) return "";

  // 1. فحص كائن JSON إن وجد
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const p = JSON.parse(raw);
      const val = p.student_code || p.code || p.studentCode || p.id;
      if (val) return formatStudentCode(String(val));
    } catch (e) {}
  }

  // 2. فحص الرابط إن كان QR يحتوي على URL
  if (raw.includes('?') || raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const m = raw.match(/[?&](?:code|student_code|studentCode|id)=([^&#\s]+)/i);
      if (m && m[1]) return formatStudentCode(decodeURIComponent(m[1]));
      const mPath = raw.match(/\/(\d{1,8})(?:[/?#]|$)/);
      if (mPath && mPath[1]) return formatStudentCode(mPath[1]);
    } catch (e) {}
  }

  // 3. مطابقة البادئات النصية الرسمية مثل (كود الطالب: ، الكود: ، Code: ، ID:)
  const prefixMatch = raw.match(/(?:كود\s*الطالب|الكود|كود|Student\s*Code|Code|ID)\s*[:=]\s*([^\n\r]+)/i);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = sanitizeScannedString(prefixMatch[1]);
    const mTok = candidate.match(/^([A-Za-z0-9\-_]+)/);
    if (mTok) return formatStudentCode(mTok[1]);
    return formatStudentCode(candidate);
  }

  // 4. إذا كان النص كلمة واحدة بدون مسافات (كود مباشر مثل 0015 أو STD-99)
  if (/^[A-Za-z0-9\-_]+$/.test(raw)) {
    return formatStudentCode(raw);
  }

  // 5. فحص الأسطر سطراً بسطر
  const lines = raw.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = sanitizeScannedString(line);
    const lineMatch = trimmed.match(/(?:كود\s*الطالب|الكود|كود|Code|ID)\s*[:=]?\s*([A-Za-z0-9\-_]+)/i);
    if (lineMatch && lineMatch[1]) return formatStudentCode(lineMatch[1]);
    if (/^\d{1,8}$/.test(trimmed)) return formatStudentCode(trimmed);
  }

  // 6. استخراج أول رقم مستقل من 1 إلى 8 خانات كخيار أخير
  const anyDigitsMatch = raw.match(/\b\d{1,8}\b/);
  if (anyDigitsMatch && anyDigitsMatch[0]) return formatStudentCode(anyDigitsMatch[0]);

  return formatStudentCode(raw);
}

// توليد رقم سري عشوائي ومعقد مكون من 8 خانات (أرقام وحروف ورموز)
export function generatePinCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  let pin = '';
  // ضمان وجود حرف كبير، حرف صغير، رقم، ورمز
  pin += letters.charAt(Math.floor(Math.random() * letters.length));
  pin += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pin += symbols.charAt(Math.floor(Math.random() * symbols.length));

  const allChars = letters + numbers + symbols;
  for (let i = pin.length; i < 8; i++) {
    pin += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // خلط الحروف عشوائياً
  return pin.split('').sort(() => Math.random() - 0.5).join('');
}

// توحيد مسمى الفرقة الدراسية ليتطابق مع قاعدة البيانات والمقررات (الاولي، الثانية، الثالثة، الرابعة)
export function normalizeAcademicYear(year: string): string {
  if (!year) return "";
  const y = year.replace(/[\uFFFD\u0000-\u001F]/g, "").trim().replace(/^الفرقة\s+/, "");
  if (y.includes('أول') || y.includes('اول') || y === '1') return 'الاولي';
  if (y.includes('ثان') || y.includes('تان') || y === '2') return 'الثانية';
  if (y.includes('ثالث') || y.includes('تالت') || y === '3') return 'الثالثة';
  if (y.includes('رابع') || y === '4') return 'الرابعة';
  return y;
}

// عرض اسم الفرقة بالبادئة (الفرقة الرابعة، الفرقة الثالثة ...)
export function displayAcademicYear(year: string): string {
  if (!year) return "";
  const y = year.trim();
  if (y.startsWith("الفرقة")) return y;
  return `الفرقة ${y}`;
}
