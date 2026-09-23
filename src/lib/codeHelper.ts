/**
 * دوال مساعدة موحدة لأكواد الطلاب وتوليد الأرقام السرية وتنسيق البيانات
 */

// استخراج كود الطالب من النص الممسوح ضوئياً من الـ QR
export function extractStudentCode(decodedText: string): string {
  if (!decodedText) return "";

  let code = decodedText.trim();
  const match = decodedText.match(/(?:كود الطالب|الكود|كود|Code):\s*([^\n\r]+)/i);
  if (match && match[1]) {
    code = match[1].trim();
  } else {
    const lines = decodedText.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^\d{1,6}$/.test(trimmed)) {
        code = trimmed;
        break;
      }
    }
  }

  // تنسيق الكود إلى 4 خانات إذا كان أرقاماً قصيرة (0001)
  if (/^\d+$/.test(code) && code.length < 4) {
    code = code.padStart(4, '0');
  }

  return code;
}

// تنسيق الكود الجامعي ليكون دائماً بصيغة 4 خانات على الأقل
export function formatStudentCode(code: string): string {
  if (!code) return "";
  const trimmed = code.trim();
  if (/^\d+$/.test(trimmed) && trimmed.length < 4) {
    return trimmed.padStart(4, '0');
  }
  return trimmed;
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

// توحيد مسمى الفرقة الدراسية
export function normalizeAcademicYear(year: string): string {
  if (!year) return "";
  const y = year.trim();
  if (y.includes('أول') || y.includes('اول')) return 'الفرقة الأولى';
  if (y.includes('ثاني') || y.includes('تاني')) return 'الفرقة الثانية';
  if (y.includes('ثالث') || y.includes('تالت')) return 'الفرقة الثالثة';
  if (y.includes('رابع')) return 'الفرقة الرابعة';
  return y;
}
