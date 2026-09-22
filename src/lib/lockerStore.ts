import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from './supabase';

const DB_PATH = path.join(process.cwd(), '.lockers_db.json');

export interface LockerItem {
  id: string;
  locker_code: string;
  letter: 'A' | 'B' | 'C' | 'D' | string;
  number: number;
  capacity: number;
  is_enabled: boolean;
  is_admin_reserved?: boolean;
  status: 'empty' | 'pending' | 'confirmed';
  current_booking_id: string | null;
  notes?: string;
  updated_at?: string;
}

export interface LockerBooking {
  id: string;
  locker_code: string;
  cohort: string;
  representative_phone: string;
  student_names: string[];
  student_codes: string[];
  status: 'pending' | 'confirmed' | 'rejected';
  created_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  responsible?: string;
  notes?: string;
}

export interface LockerWaitlistEntry {
  id: string;
  cohort: string;
  representative_phone: string;
  student_names: string[];
  student_codes: string[];
  created_at: string;
  status: 'waiting' | 'fulfilled' | 'cancelled';
  priority?: number;
}

export interface LockerSettings {
  google_sheet_url: string;
  supervisor_name: string;
  default_capacity: number;
  auto_waitlist: boolean;
}

export interface ParsedPreviewRow {
  id: string;
  locker_code: string;
  letter: string;
  number: number;
  cohort: string;
  phone: string;
  student_names: string[];
  status: 'confirmed' | 'pending';
  is_existing: boolean;
  current_status?: string;
  current_students?: string[];
  conflict_warning?: string;
}

export interface PreviewDataResult {
  success: boolean;
  rows: ParsedPreviewRow[];
  total: number;
  confirmedCount: number;
  pendingCount: number;
  uniqueLockers: number;
  conflictCount: number;
  errors: string[];
  scannedTabs?: string[];
  discoveredTabs?: string[];
}

export interface SheetSyncResult {
  success: boolean;
  importedConfirmed: number;
  importedPending: number;
  adminReservedCount: number;
  totalLockers: number;
  ranges?: { [key: string]: number };
  message: string;
  errors?: string[];
  scannedTabs?: string[];
  discoveredTabs?: string[];
}

interface LocalLockersDB {
  lockers: LockerItem[];
  bookings: LockerBooking[];
  waitlist: LockerWaitlistEntry[];
  settings: LockerSettings;
}

// دالة تحليل ومعالجة ملفات وجداول CSV و TSV باحترافية وتدعم علامات التنصيص والفواصل المختلفة
export function parseCSV(text: string): string[][] {
  const p: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === ',' || c === '\t' || c === ';') && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      row.push(cur.trim());
      cur = '';
      if (row.some(x => x.length > 0)) {
        p.push(row);
      }
      row = [];
    } else {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some(x => x.length > 0)) {
      p.push(row);
    }
  }
  return p;
}

// استخراج معرّف ملف جوجل شيت من الرابط كاملاً أو المعرف المنفرد
export function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// استخراج معرف الورقة (gid) من الرابط إذا وجد
export function extractGid(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[?&#]gid=([0-9]+)/);
  return match ? match[1] : null;
}

// توحيد وتنسيق كود الدولاب ودعم الحروف العربية والبادئات والترتيب العكسي
export function normalizeLockerCode(raw: string): { code: string; letter: string; number: number } | null {
  if (!raw) return null;
  let s = String(raw).trim();
  s = s.replace(/^(دولاب|Locker|رقم|كود|دولاب رقم|كود الدولاب)\s*[:#-]?\s*/i, '').trim();

  // النمط 1: الحرف ثم الرقم (مثال: A12, أ-12, A 12, B_5)
  const prefixMatch = s.match(/^([A-Da-dأإآابجدهـ])\s*[-_./]?\s*(\d+)$/i);
  if (prefixMatch) {
    let char = prefixMatch[1].toUpperCase();
    if (/[أإآا]/.test(char)) char = 'A';
    else if (char === 'ب') char = 'B';
    else if (char === 'ج') char = 'C';
    else if (char === 'د') char = 'D';
    else if (char === 'ه' || char === 'هـ') char = 'E';
    const number = parseInt(prefixMatch[2], 10);
    return { code: `${char}${number}`, letter: char, number };
  }

  // النمط 2: الرقم ثم الحرف (مثال: 15A, 15-ج, 15 ج)
  const suffixMatch = s.match(/^(\d+)\s*[-_./]?\s*([A-Da-dأإآابجدهـ])$/i);
  if (suffixMatch) {
    let char = suffixMatch[2].toUpperCase();
    if (/[أإآا]/.test(char)) char = 'A';
    else if (char === 'ب') char = 'B';
    else if (char === 'ج') char = 'C';
    else if (char === 'د') char = 'D';
    else if (char === 'ه' || char === 'هـ') char = 'E';
    const number = parseInt(suffixMatch[1], 10);
    return { code: `${char}${number}`, letter: char, number };
  }

  return null;
}

// استكشاف كافة تبويبات وأوراق العمل الموجودة في ملف جوجل شيت تلقائياً
export async function discoverAllSheetTabs(sheetId: string): Promise<string[]> {
  const tabs = new Set<string>();
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (res.ok) {
      const html = await res.text();
      
      // النمط 1: فحص أسماء التبويبات الظاهرة في شريط أوراق العمل
      const regex1 = /class="[^"]*docs-sheet-tab-caption[^"]*">([^<]+)<\/div>/g;
      let m: RegExpExecArray | null;
      while ((m = regex1.exec(html)) !== null) {
        const name = m[1].trim();
        if (name) tabs.add(name);
      }

      // النمط 2: فحص مصفوفات البيانات العامة [gid, null, "SheetName"]
      const regex2 = /\[\d+,\d+,"([^"]+)",\d+\]/g;
      while ((m = regex2.exec(html)) !== null) {
        const name = m[1].trim();
        if (name && !name.startsWith('http') && name.length < 60) {
          tabs.add(name);
        }
      }

      // النمط 3: كائنات JSON المضمنة باسم الورقة
      const regex3 = /"name"\s*:\s*"([^"\\]+)"/g;
      while ((m = regex3.exec(html)) !== null) {
        const name = m[1].trim();
        if (name && !name.startsWith('http') && !name.startsWith('user') && name.length < 60 && !name.includes('googleapis') && !name.includes('{')) {
          tabs.add(name);
        }
      }
    }
  } catch (err: any) {
    console.warn('[LockerStore] فشل الاستكشاف التلقائي لأسماء الأوراق:', err.message);
  }

  return Array.from(tabs);
}

// دمج الحجوزات المتعددة لنفس الدولاب لمنع حذف الطلاب
export function mergeBookings(rawBookings: Array<{
  locker_code: string;
  letter: string;
  number: number;
  cohort: string;
  phone: string;
  student_names: string[];
  student_codes?: string[];
  status: 'confirmed' | 'pending';
  notes?: string;
}>): Array<{
  locker_code: string;
  letter: string;
  number: number;
  cohort: string;
  phone: string;
  student_names: string[];
  student_codes?: string[];
  status: 'confirmed' | 'pending';
  notes?: string;
}> {
  const map = new Map<string, any>();

  for (const b of rawBookings) {
    const norm = normalizeLockerCode(b.locker_code);
    const code = norm ? norm.code : (b.locker_code || '').toUpperCase().trim();
    if (!code) continue;

    const letter = norm ? norm.letter : b.letter;
    const number = norm ? norm.number : b.number;

    if (!map.has(code)) {
      map.set(code, {
        locker_code: code,
        letter,
        number,
        cohort: b.cohort || 'الفرقة الرابعة',
        phone: b.phone || '',
        student_names: [...(b.student_names || [])].map(n => String(n || '').trim()).filter(Boolean),
        student_codes: [...(b.student_codes || [])].map(c => String(c || '').trim()).filter(Boolean),
        status: b.status || 'confirmed',
        notes: b.notes || ''
      });
    } else {
      const existing = map.get(code)!;
      // دمج أسماء الطلاب دون تكرار
      for (const name of (b.student_names || [])) {
        const trimmed = String(name || '').trim();
        if (trimmed && !existing.student_names.includes(trimmed)) {
          existing.student_names.push(trimmed);
        }
      }
      // دمج أكواد الطلاب
      for (const c of (b.student_codes || [])) {
        const trimmed = String(c || '').trim();
        if (trimmed && !existing.student_codes.includes(trimmed)) {
          existing.student_codes.push(trimmed);
        }
      }
      // إذا كان أي سطر مؤكداً، تصبح حالة الحجز مؤكدة
      if (b.status === 'confirmed') existing.status = 'confirmed';
      if (!existing.phone && b.phone) existing.phone = b.phone;
      if ((!existing.cohort || existing.cohort === 'الفرقة الرابعة') && b.cohort) existing.cohort = b.cohort;
      if (b.notes && (!existing.notes || existing.notes.length < b.notes.length)) existing.notes = b.notes;
    }
  }

  const result: any[] = [];
  for (const [, item] of map) {
    item.student_names = item.student_names.slice(0, 4);
    result.push(item);
  }
  return result;
}

// تحليل البيانات الخام إلى حجوزات معيارية
export function parseRawDataToBookings(
  rawData: string,
  defaultStatus: 'confirmed' | 'pending' = 'confirmed',
  tabLetterHint?: string
): Array<{
  locker_code: string;
  letter: string;
  number: number;
  cohort: string;
  phone: string;
  student_names: string[];
  student_codes?: string[];
  status: 'confirmed' | 'pending';
  notes?: string;
}> {
  if (!rawData || !rawData.trim()) return [];
  const table = parseCSV(rawData);
  if (!table || table.length === 0) return [];

  const firstRow = table[0].map(c => (c || '').trim());
  const isDataRow = firstRow.some(cell => 
    /^[A-Da-d]\s*\d+$/.test(cell) || 
    /^(01[0125]\d{8}|\+?201[0125]\d{8})$/.test(cell.replace(/\s+/g, '')) ||
    normalizeLockerCode(cell) !== null
  );

  const hasHeader = !isDataRow && firstRow.some(c => {
    const lower = c.toLowerCase();
    return lower === 'id' || lower === 'الدولاب' || lower === 'رمز الدولاب' || lower === 'كود الدولاب' || lower === 'locker' ||
           lower === 'الحرف' || lower === 'الرقم' || lower === 'ممثل الهاتف' || lower === 'اسم1' || lower === 'اسم' || lower === 'name' ||
           lower.includes('طالب') || lower.includes('دولاب') || lower.includes('كود');
  });

  const headerIndices = {
    lockerCode: -1,
    letter: -1,
    number: -1,
    cohort: -1,
    phone: -1,
    status: -1,
    notes: -1,
    nameCols: [] as number[]
  };

  let startIndex = 0;
  if (hasHeader) {
    startIndex = 1;
    table[0].forEach((col, idx) => {
      const lower = col.trim().toLowerCase();
      if (lower === 'الدولاب' || lower === 'رمز الدولاب' || lower === 'كود الدولاب' || lower === 'locker' || lower === 'code' || lower.includes('رقم الدولاب')) {
        headerIndices.lockerCode = idx;
      } else if (lower === 'الحرف' || lower === 'letter' || lower === 'السكشن') {
        headerIndices.letter = idx;
      } else if (lower === 'الرقم' || lower === 'number' || lower === 'رقم') {
        headerIndices.number = idx;
      } else if (lower.includes('فرقة') || lower === 'cohort') {
        headerIndices.cohort = idx;
      } else if (lower.includes('هاتف') || lower.includes('موبايل') || lower === 'phone') {
        headerIndices.phone = idx;
      } else if (lower.includes('حالة') || lower === 'status') {
        headerIndices.status = idx;
      } else if (lower.includes('ملاحظ') || lower.includes('إدارة') || lower.includes('note')) {
        headerIndices.notes = idx;
      } else if (lower.includes('اسم') || lower.includes('طالب') || lower.includes('name')) {
        headerIndices.nameCols.push(idx);
      }
    });
  }

  const results: Array<{
    locker_code: string;
    letter: string;
    number: number;
    cohort: string;
    phone: string;
    student_names: string[];
    student_codes?: string[];
    status: 'confirmed' | 'pending';
    notes?: string;
  }> = [];

  for (let i = startIndex; i < table.length; i++) {
    const row = table[i];
    if (!row || row.length === 0) continue;

    let lockerCode = '';
    let letter = '';
    let number = 0;
    let cohort = '';
    let phone = '';
    let rowNotes = '';
    let status: 'confirmed' | 'pending' = defaultStatus;
    const names: string[] = [];

    if (hasHeader && (headerIndices.lockerCode !== -1 || (headerIndices.letter !== -1 && headerIndices.number !== -1))) {
      if (headerIndices.lockerCode !== -1 && row[headerIndices.lockerCode]) {
        const rawCode = row[headerIndices.lockerCode];
        const norm = normalizeLockerCode(rawCode);
        if (norm) {
          lockerCode = norm.code;
          letter = norm.letter;
          number = norm.number;
        } else {
          lockerCode = rawCode.toUpperCase().replace(/\s+/g, '');
        }
      } else if (headerIndices.letter !== -1 && headerIndices.number !== -1) {
        const lRaw = row[headerIndices.letter] || '';
        const nRaw = row[headerIndices.number] || '';
        const norm = normalizeLockerCode(`${lRaw}${nRaw}`);
        if (norm) {
          lockerCode = norm.code;
          letter = norm.letter;
          number = norm.number;
        } else {
          lockerCode = `${lRaw.toUpperCase()}${nRaw}`.replace(/\s+/g, '');
        }
      }

      if (headerIndices.cohort !== -1 && row[headerIndices.cohort]) {
        cohort = row[headerIndices.cohort];
      }
      if (headerIndices.phone !== -1 && row[headerIndices.phone]) {
        phone = row[headerIndices.phone].replace(/\s+/g, '');
      }
      if (headerIndices.notes !== -1 && row[headerIndices.notes]) {
        rowNotes = row[headerIndices.notes].trim();
      }
      if (headerIndices.status !== -1 && row[headerIndices.status]) {
        const st = row[headerIndices.status];
        if (st.includes('مؤكد') || st.includes('تأكيد')) status = 'confirmed';
        else if (st.includes('مؤقت') || st.includes('تسجيل') || st.includes('معلق')) status = 'pending';
      }
      headerIndices.nameCols.forEach(idx => {
        const val = (row[idx] || '').trim();
        if (val && val.length > 2 && !val.includes('إدارة') && !val.includes('حجز إداري')) {
          names.push(val);
        }
      });
    }

    if (!lockerCode) {
      for (const p of row) {
        const norm = normalizeLockerCode(p);
        if (norm) {
          lockerCode = norm.code;
          letter = norm.letter;
          number = norm.number;
          break;
        }
      }
      if (!lockerCode) {
        const lIndex = row.findIndex(p => /^[A-Da-dأإآابجدهـ]$/.test(p.trim()));
        if (lIndex >= 0) {
          const lNorm = normalizeLockerCode(`${row[lIndex]}1`);
          letter = lNorm ? lNorm.letter : row[lIndex].toUpperCase();
          const nIndex = row.findIndex((p, idx) => idx !== lIndex && /^\d+$/.test(p.trim()) && parseInt(p, 10) < 500);
          if (nIndex >= 0) {
            number = parseInt(row[nIndex].trim(), 10);
            lockerCode = `${letter}${number}`;
          }
        }
      }

      // إذا لم يتوفر رمز الدولاب ولكن تم تمرير تلميح الحرف (مثل أوراق A, B, C, D)
      if (!lockerCode && tabLetterHint) {
        const normHint = normalizeLockerCode(`${tabLetterHint}1`);
        const hintLetter = normHint ? normHint.letter : tabLetterHint.toUpperCase();
        for (const p of row) {
          const trimmedP = p.trim();
          if (/^\d+$/.test(trimmedP)) {
            const num = parseInt(trimmedP, 10);
            if (num > 0 && num <= 500) {
              number = num;
              letter = hintLetter;
              lockerCode = `${letter}${number}`;
              break;
            }
          }
        }
      }
    }

    if (!lockerCode) continue;

    if (!letter || !number) {
      const norm = normalizeLockerCode(lockerCode);
      if (norm) {
        letter = norm.letter;
        number = norm.number;
      }
    }

    if (!phone) {
      const phonePart = row.find(p => /^(01[0125]\d{8}|\+?201[0125]\d{8})$/.test(p.replace(/\s+/g, '')));
      if (phonePart) phone = phonePart.replace(/\s+/g, '');
    }

    if (!cohort) {
      const cohortPart = row.find(p => p.includes('فرقة') || p.includes('أولى') || p.includes('ثانية') || p.includes('ثالثة') || p.includes('رابعة'));
      cohort = cohortPart || 'الفرقة الرابعة';
    }

    // فحص الملاحظات إذا لم يتم استخراجها من الترويسة
    if (!rowNotes) {
      for (const p of row) {
        if (p.includes('إدارة') || p.includes('محجوز للإدارة') || p.includes('تخصيص')) {
          rowNotes = 'مخصص للإدارة';
          break;
        }
      }
    }

    if (names.length === 0) {
      for (const p of row) {
        if (!p || p === lockerCode || p === phone || p === cohort || p === letter || String(number) === p) continue;
        if (/^(R\d+|\d{10,}|\d{4}-\d{2}-\d{2}|http|تم التأكيد|قيد التسجيل|سعة|مخصص للإدارة)/.test(p)) continue;
        if (/[\u0600-\u06FF]{3,}/.test(p) && !p.includes('فرقة') && !p.includes('تأكيد') && !p.includes('تسجيل') && !p.includes('إدارة')) {
          const splitNames = p.split(/[\n|\-–,،]/).map(n => n.trim()).filter(n => n.length > 2);
          if (splitNames.length > 1) {
            splitNames.forEach(n => names.push(n));
          } else {
            names.push(p.trim());
          }
        }
      }
    }

    results.push({
      locker_code: lockerCode,
      letter,
      number,
      cohort,
      phone,
      student_names: names.slice(0, 4),
      status,
      notes: rowNotes || undefined
    });
  }

  return results;
}

// إنشاء الدواليب الافتراضية لأول مرة
function generateInitialLockers(): LockerItem[] {
  const letters = ['A', 'B', 'C', 'D'];
  const lockers: LockerItem[] = [];

  for (const letter of letters) {
    for (let i = 1; i <= 40; i++) {
      const code = `${letter}${i}`;
      // دواليب سعة 2 افتراضياً لبعض الأرقام، والباقي سعة 4
      const isTwoPerson = (letter === 'A' && i <= 5) || (letter === 'D' && i > 35);
      lockers.push({
        id: `L_${code}`,
        locker_code: code,
        letter,
        number: i,
        capacity: isTwoPerson ? 2 : 4,
        is_enabled: true,
        status: 'empty',
        current_booking_id: null,
      });
    }
  }

  return lockers;
}

function readLocalDB(): LocalLockersDB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.lockers && parsed.bookings) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading lockers db file:', e);
  }

  const initial: LocalLockersDB = {
    lockers: generateInitialLockers(),
    bookings: [],
    waitlist: [],
    settings: {
      google_sheet_url: 'https://script.google.com/macros/s/AKfycbwSM7et9hEz5T9Lff1VGYWhpJ3XBYitTQE82g6IiEunFU3R8LQi8gQOkU2P3gypX7fL/exec',
      supervisor_name: 'م/ إسلام عبداللطيف',
      default_capacity: 4,
      auto_waitlist: true
    }
  };

  writeLocalDB(initial);
  return initial;
}

function writeLocalDB(data: LocalLockersDB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing lockers db file:', e);
  }
}

export const lockerStore = {
  // 1. جلب كافة الدواليب أو حسب الحرف
  getLockers(letter?: string): LockerItem[] {
    const db = readLocalDB();
    if (!letter || letter === 'ALL') {
      return db.lockers;
    }
    return db.lockers.filter(l => l.letter.toUpperCase() === letter.toUpperCase());
  },

  // 2. جلب دولاب محدد
  getLocker(code: string): LockerItem | null {
    const db = readLocalDB();
    return db.lockers.find(l => l.locker_code.toUpperCase() === code.toUpperCase()) || null;
  },

  // 3. جلب كافة الحجوزات
  getBookings(status?: string): LockerBooking[] {
    const db = readLocalDB();
    if (!status || status === 'ALL') {
      return db.bookings;
    }
    return db.bookings.filter(b => b.status === status);
  },

  // 4. جلب حجز بواسطة المعرف
  getBooking(bookingId: string): LockerBooking | null {
    const db = readLocalDB();
    return db.bookings.find(b => b.id === bookingId) || null;
  },

  // 5. جلب قائمة الانتظار
  getWaitlist(): LockerWaitlistEntry[] {
    const db = readLocalDB();
    return db.waitlist.filter(w => w.status === 'waiting');
  },

  // 6. التحقق من حالة الطالب (هل هو مسكن أو في الانتظار؟)
  getStudentLockerStatus(studentCodeOrName: string): {
    status: 'confirmed' | 'pending' | 'waitlist' | 'none';
    booking: LockerBooking | null;
    waitlist: LockerWaitlistEntry | null;
    locker: LockerItem | null;
  } {
    const db = readLocalDB();
    const query = studentCodeOrName.trim().toLowerCase();

    // البحث في الحجوزات المؤكدة والمعلقة
    const activeBooking = db.bookings.find(b => 
      (b.status === 'confirmed' || b.status === 'pending') &&
      (
        b.student_codes.some(c => c.toLowerCase() === query || c.replace(/^0+/, '') === query.replace(/^0+/, '')) ||
        b.student_names.some(n => n.toLowerCase().includes(query) || query.includes(n.toLowerCase()))
      )
    );

    if (activeBooking) {
      const locker = db.lockers.find(l => l.locker_code === activeBooking.locker_code) || null;
      return {
        status: activeBooking.status as 'confirmed' | 'pending',
        booking: activeBooking,
        waitlist: null,
        locker
      };
    }

    // البحث في قائمة الانتظار
    const waitEntry = db.waitlist.find(w => 
      w.status === 'waiting' &&
      (
        w.student_codes.some(c => c.toLowerCase() === query || c.replace(/^0+/, '') === query.replace(/^0+/, '')) ||
        w.student_names.some(n => n.toLowerCase().includes(query) || query.includes(n.toLowerCase()))
      )
    );

    if (waitEntry) {
      return {
        status: 'waitlist',
        booking: null,
        waitlist: waitEntry,
        locker: null
      };
    }

    return {
      status: 'none',
      booking: null,
      waitlist: null,
      locker: null
    };
  },

  // 7. حجز دولاب جديد للطلاب
  bookLocker(params: {
    cohort: string;
    representative_phone: string;
    student_names: string[];
    student_codes: string[];
    preferred_letter?: string;
  }): {
    success: boolean;
    isWaitlist: boolean;
    booking?: LockerBooking;
    waitlist?: LockerWaitlistEntry;
    locker?: LockerItem;
    message: string;
  } {
    const db = readLocalDB();

    // التحقق من أن أياً من الطلاب ليس مسجلاً بالفعل
    for (const code of params.student_codes) {
      const check = this.getStudentLockerStatus(code);
      if (check.status !== 'none') {
        const studentIndex = params.student_codes.indexOf(code);
        const studentName = params.student_names[studentIndex] || code;
        return {
          success: false,
          isWaitlist: false,
          message: `الطالب (${studentName}) مسجل بالفعل مسبقاً في النظام!`
        };
      }
    }

    // البحث عن دولاب شاغر ومتاح (مفعل)
    let availableLocker: LockerItem | undefined;

    // إذا طلب حرفاً مفضلاً
    if (params.preferred_letter) {
      availableLocker = db.lockers.find(l => 
        l.letter.toUpperCase() === params.preferred_letter?.toUpperCase() &&
        l.status === 'empty' &&
        l.is_enabled === true &&
        !l.is_admin_reserved
      );
    }

    // إذا لم يجد أو لم يحدد حرفاً، خذ أول دولاب شاغر متاح
    if (!availableLocker) {
      availableLocker = db.lockers.find(l => l.status === 'empty' && l.is_enabled === true && !l.is_admin_reserved);
    }

    // إذا لم تتوفر دواليب شاغرة -> تحويل تلقائي لقائمة الانتظار!
    if (!availableLocker) {
      const waitEntry: LockerWaitlistEntry = {
        id: `W_${Date.now()}`,
        cohort: params.cohort,
        representative_phone: params.representative_phone,
        student_names: params.student_names,
        student_codes: params.student_codes,
        created_at: new Date().toISOString(),
        status: 'waiting',
        priority: db.waitlist.filter(w => w.status === 'waiting').length + 1
      };

      db.waitlist.push(waitEntry);
      writeLocalDB(db);

      return {
        success: true,
        isWaitlist: true,
        waitlist: waitEntry,
        message: 'عذراً، جميع الدواليب مشغولة حالياً بالكامل! تم حفظ طلبكم في قائمة الانتظار بأولوية فورية عند إخلاء أي دولاب.'
      };
    }

    // إذا توفر دولاب -> إنشاء حجز جديد في انتظار الاعتماد (pending)
    const bookingId = `B_${Date.now()}`;
    const newBooking: LockerBooking = {
      id: bookingId,
      locker_code: availableLocker.locker_code,
      cohort: params.cohort,
      representative_phone: params.representative_phone,
      student_names: params.student_names,
      student_codes: params.student_codes,
      status: 'pending',
      created_at: new Date().toISOString(),
      responsible: 'ONLINE'
    };

    // تحديث حالة الدولاب
    availableLocker.status = 'pending';
    availableLocker.current_booking_id = bookingId;
    availableLocker.updated_at = new Date().toISOString();

    db.bookings.push(newBooking);
    writeLocalDB(db);

    return {
      success: true,
      isWaitlist: false,
      booking: newBooking,
      locker: availableLocker,
      message: 'تم تسجيل حجز الدولاب بنجاح! يرجى طباعة الاستمارة وتواجد جميع الطلاب لدى المشرف للاستلام.'
    };
  },

  // 8. تأكيد واعتماد حجز (من قبل المشرف)
  confirmBooking(bookingId: string, confirmedBy: string = 'م/ إسلام عبداللطيف'): boolean {
    const db = readLocalDB();
    const booking = db.bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    booking.status = 'confirmed';
    booking.confirmed_at = new Date().toISOString();
    booking.confirmed_by = confirmedBy;

    const locker = db.lockers.find(l => l.locker_code === booking.locker_code);
    if (locker) {
      locker.status = 'confirmed';
      locker.updated_at = new Date().toISOString();
    }

    writeLocalDB(db);
    return true;
  },

  // 9. رفض أو إلغاء حجز
  rejectBooking(bookingId: string, reason?: string): boolean {
    const db = readLocalDB();
    const booking = db.bookings.find(b => b.id === bookingId);
    if (!booking) return false;

    booking.status = 'rejected';
    booking.notes = reason || 'تم الإلغاء';

    const locker = db.lockers.find(l => l.locker_code === booking.locker_code);
    if (locker) {
      locker.status = 'empty';
      locker.current_booking_id = null;
      locker.updated_at = new Date().toISOString();
      
      // فحص قائمة الانتظار لإشغال الدولاب الشاغر تلقائياً
      this.checkAndFulfillWaitlist(locker.locker_code, db);
    }

    writeLocalDB(db);
    return true;
  },

  // 10. إخلاء دولاب بالكامل (Admin Vacate)
  vacateLocker(lockerCode: string): boolean {
    const db = readLocalDB();
    const locker = db.lockers.find(l => l.locker_code.toUpperCase() === lockerCode.toUpperCase());
    if (!locker) return false;

    if (locker.current_booking_id) {
      const booking = db.bookings.find(b => b.id === locker.current_booking_id);
      if (booking) {
        booking.status = 'rejected';
        booking.notes = 'تم إخلاء الدولاب يدوياً من لوحة التحكم';
      }
    }

    locker.status = 'empty';
    locker.current_booking_id = null;
    locker.updated_at = new Date().toISOString();

    // فحص قائمة الانتظار
    this.checkAndFulfillWaitlist(locker.locker_code, db);

    writeLocalDB(db);
    return true;
  },

  // 11. إقصاء طالب محدد من الدولاب دون إخلاء باقي زملائه
  removeStudentFromLocker(bookingId: string, studentCodeOrName: string): { success: boolean; message: string; remaining: number } {
    const db = readLocalDB();
    const booking = db.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'الحجز غير موجود', remaining: 0 };

    const target = studentCodeOrName.trim().toLowerCase();
    const idx = booking.student_codes.findIndex(c => c.toLowerCase() === target || c.replace(/^0+/, '') === target.replace(/^0+/, '')) >= 0
      ? booking.student_codes.findIndex(c => c.toLowerCase() === target || c.replace(/^0+/, '') === target.replace(/^0+/, ''))
      : booking.student_names.findIndex(n => n.toLowerCase().includes(target));

    if (idx < 0) {
      return { success: false, message: 'لم يتم العثور على الطالب بالدولاب', remaining: booking.student_names.length };
    }

    // إزالة الطالب
    booking.student_names.splice(idx, 1);
    if (booking.student_codes.length > idx) {
      booking.student_codes.splice(idx, 1);
    }

    // إذا لم يتبق أي طالب، نخلي الدولاب بالكامل
    if (booking.student_names.length === 0) {
      booking.status = 'rejected';
      const locker = db.lockers.find(l => l.locker_code === booking.locker_code);
      if (locker) {
        locker.status = 'empty';
        locker.current_booking_id = null;
      }
      writeLocalDB(db);
      return { success: true, message: 'تم إقصاء الطالب، وتم تفريغ الدولاب لعدم وجود طلاب آخرين', remaining: 0 };
    }

    writeLocalDB(db);
    return { success: true, message: 'تم إقصاء الطالب بنجاح وبقاء زملائه', remaining: booking.student_names.length };
  },

  // 12. تبديل حالة الدولاب (تفعيل / تعطيل بالحجز) - للضغط المطول
  toggleLockerEnabled(lockerCode: string): boolean {
    const db = readLocalDB();
    const locker = db.lockers.find(l => l.locker_code.toUpperCase() === lockerCode.toUpperCase());
    if (!locker) return false;

    locker.is_enabled = !locker.is_enabled;
    locker.updated_at = new Date().toISOString();
    writeLocalDB(db);
    return locker.is_enabled;
  },

  // 13. تعديل سعة الدولاب (2 أو 4 أو مخصص)
  updateLockerCapacity(lockerCode: string, capacity: number): boolean {
    const db = readLocalDB();
    const locker = db.lockers.find(l => l.locker_code.toUpperCase() === lockerCode.toUpperCase());
    if (!locker) return false;

    locker.capacity = Math.max(1, capacity);
    locker.updated_at = new Date().toISOString();
    writeLocalDB(db);
    return true;
  },

  // 14. تفريغ دفعة بالكامل (مثلاً الفرقة الرابعة بعد التخرج)
  clearCohort(cohort: string): { clearedCount: number } {
    const db = readLocalDB();
    let count = 0;

    for (const booking of db.bookings) {
      if ((booking.status === 'confirmed' || booking.status === 'pending') && booking.cohort === cohort) {
        booking.status = 'rejected';
        booking.notes = `تم تفريغ الدفعة بالكامل (${cohort})`;

        const locker = db.lockers.find(l => l.locker_code === booking.locker_code);
        if (locker) {
          locker.status = 'empty';
          locker.current_booking_id = null;
          locker.updated_at = new Date().toISOString();
        }
        count++;
      }
    }

    writeLocalDB(db);
    return { clearedCount: count };
  },

  // 15. فحص وتسكين رأس قائمة الانتظار تلقائياً عند فراغ دولاب
  checkAndFulfillWaitlist(lockerCode: string, db: LocalLockersDB) {
    const waitingIndex = db.waitlist.findIndex(w => w.status === 'waiting');
    if (waitingIndex >= 0) {
      const nextInLine = db.waitlist[waitingIndex];
      nextInLine.status = 'fulfilled';

      const bookingId = `B_${Date.now()}`;
      const newBooking: LockerBooking = {
        id: bookingId,
        locker_code: lockerCode,
        cohort: nextInLine.cohort,
        representative_phone: nextInLine.representative_phone,
        student_names: nextInLine.student_names,
        student_codes: nextInLine.student_codes,
        status: 'pending',
        created_at: new Date().toISOString(),
        responsible: 'WAITLIST_AUTO_PROMOTED'
      };

      db.bookings.push(newBooking);

      const locker = db.lockers.find(l => l.locker_code === lockerCode);
      if (locker) {
        locker.status = 'pending';
        locker.current_booking_id = bookingId;
        locker.updated_at = new Date().toISOString();
      }
    }
  },

  // 16. تخصيص الدولاب للإدارة أو إلغاء التخصيص
  setAdminReserved(lockerCode: string, reserved: boolean, notes?: string): { success: boolean; is_admin_reserved: boolean; locker?: LockerItem; message: string } {
    const db = readLocalDB();
    const code = lockerCode.trim().toUpperCase();
    const locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);
    if (!locker) return { success: false, is_admin_reserved: false, message: 'تعذر العثور على الدولاب' };

    locker.is_admin_reserved = reserved;
    locker.is_enabled = !reserved;
    locker.notes = reserved ? (notes || 'مخصص للإدارة') : '';

    if (reserved) {
      // إخلاء أي حجز مسكن في هذا الدولاب
      if (locker.current_booking_id) {
        const b = db.bookings.find(bk => bk.id === locker.current_booking_id);
        if (b) {
          b.status = 'rejected';
          b.notes = 'تم إخلاء الدولاب وتخصيصه للإدارة';
        }
        locker.current_booking_id = null;
      }
      locker.status = 'empty';
    } else {
      locker.status = 'empty';
      locker.current_booking_id = null;
    }

    locker.updated_at = new Date().toISOString();
    writeLocalDB(db);
    return {
      success: true,
      is_admin_reserved: reserved,
      locker,
      message: reserved ? `تم تخصيص الدولاب ${code} للإدارة بنجاح وحجبه عن الطلاب 🔒` : `تم إلغاء تخصيص الإدارة وإتاحة الدولاب ${code} للطلاب 🟢`
    };
  },

  // 17. جلب نطاقات وأعداد الدواليب لكل حرف
  getInventoryRanges(): { [letter: string]: number } {
    const db = readLocalDB();
    const ranges: { [letter: string]: number } = { A: 0, B: 0, C: 0, D: 0 };
    for (const l of db.lockers) {
      const letter = l.letter.toUpperCase();
      if (ranges[letter] !== undefined) {
        ranges[letter] = Math.max(ranges[letter], l.number);
      } else {
        ranges[letter] = l.number;
      }
    }
    return ranges;
  },

  // 18. تحديث وضبط أعداد ونطاقات دواليب الأقسام
  updateInventoryRanges(ranges: { [letter: string]: number }): { success: boolean; total: number; ranges: { [letter: string]: number }; message: string } {
    const db = readLocalDB();
    const letters = ['A', 'B', 'C', 'D'];

    for (const letter of letters) {
      const rawTarget = ranges[letter] !== undefined ? ranges[letter] : ranges[letter.toUpperCase()];
      if (rawTarget === undefined || rawTarget === null) continue;
      const targetMax = Math.max(1, parseInt(String(rawTarget), 10) || 0);

      const currentLockers = db.lockers.filter(l => l.letter.toUpperCase() === letter);
      const currentMax = currentLockers.reduce((max, l) => Math.max(max, l.number), 0);

      if (targetMax > currentMax) {
        // إضافة دواليب جديدة
        for (let num = currentMax + 1; num <= targetMax; num++) {
          const code = `${letter}${num}`;
          if (!db.lockers.some(l => l.locker_code.toUpperCase() === code)) {
            db.lockers.push({
              id: `L_${code}`,
              locker_code: code,
              letter,
              number: num,
              capacity: 4,
              is_enabled: true,
              is_admin_reserved: false,
              status: 'empty',
              current_booking_id: null,
              updated_at: new Date().toISOString()
            });
          }
        }
      } else if (targetMax < currentMax) {
        // تقليص الدواليب الشاغرة فقط التي تزيد عن الحد الأقصى الجديد مع الحفاظ على المسكن
        db.lockers = db.lockers.filter(l => {
          if (l.letter.toUpperCase() !== letter) return true;
          if (l.number <= targetMax) return true;
          // الإبقاء على الدولاب إذا كان مسكناً أو به حجز أو مخصصاً للإدارة
          if (l.status !== 'empty' || l.current_booking_id || l.is_admin_reserved) return true;
          return false;
        });
      }
    }

    // ترتيب منطقي: الحرف ثم الرقم
    db.lockers.sort((a, b) => {
      if (a.letter !== b.letter) return a.letter.localeCompare(b.letter);
      return a.number - b.number;
    });

    writeLocalDB(db);
    const newRanges = this.getInventoryRanges();
    return {
      success: true,
      total: db.lockers.length,
      ranges: newRanges,
      message: `تم تحديث شبكة الدواليب بنجاح. إجمالي الدواليب: ${db.lockers.length}`
    };
  },

  // 19. تسكين طلاب يدوياً في دولاب
  manualAssignBooking(params: {
    lockerCode: string;
    cohort: string;
    phone: string;
    studentNames: string[];
    studentCodes?: string[];
    notes?: string;
    status?: 'confirmed' | 'pending';
  }): { success: boolean; message: string; booking?: LockerBooking; locker?: LockerItem } {
    const db = readLocalDB();
    const code = params.lockerCode.trim().toUpperCase();
    let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);

    // إذا لم يكن الدولاب موجوداً، ننشئه تلقائياً
    if (!locker) {
      const match = code.match(/^([A-Za-z])\s*(\d+)$/);
      const letter = match ? match[1].toUpperCase() : 'A';
      const number = match ? parseInt(match[2], 10) : 1;
      locker = {
        id: `L_${code}`,
        locker_code: code,
        letter,
        number,
        capacity: params.studentNames.length > 2 ? 4 : 2,
        is_enabled: true,
        is_admin_reserved: false,
        status: 'empty',
        current_booking_id: null
      };
      db.lockers.push(locker);
    }

    // إخلاء أي حجز سابق مرتبط
    if (locker.current_booking_id) {
      const prevB = db.bookings.find(b => b.id === locker!.current_booking_id);
      if (prevB) {
        prevB.status = 'rejected';
        prevB.notes = 'تم استبدال الحجز يدوياً';
      }
    }

    const bookingStatus = params.status || 'confirmed';
    const bookingId = `B_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const validNames = (params.studentNames || []).map(n => String(n || '').trim()).filter(Boolean);

    const newBooking: LockerBooking = {
      id: bookingId,
      locker_code: code,
      cohort: params.cohort || 'الفرقة الرابعة',
      representative_phone: params.phone || '',
      student_names: validNames,
      student_codes: params.studentCodes || [],
      status: bookingStatus,
      created_at: new Date().toISOString(),
      confirmed_at: bookingStatus === 'confirmed' ? new Date().toISOString() : undefined,
      confirmed_by: bookingStatus === 'confirmed' ? 'إدارة الكلية' : undefined,
      responsible: 'ADMIN_MANUAL',
      notes: params.notes || 'تسكين يدوي من لوحة الإدارة'
    };

    locker.status = bookingStatus;
    locker.current_booking_id = bookingId;
    locker.is_admin_reserved = false;
    locker.is_enabled = true;
    if (validNames.length > 0 && validNames.length <= 2) {
      locker.capacity = 2;
    }
    locker.updated_at = new Date().toISOString();

    db.bookings.push(newBooking);
    writeLocalDB(db);

    return {
      success: true,
      message: `تم تسكين الدولاب ${code} بنجاح (${bookingStatus === 'confirmed' ? 'معتمد' : 'معلق'})`,
      booking: newBooking,
      locker
    };
  },

  // 20. معاينة تفاعلية لبيانات الشيت المنسوخة أو المرفوعة قبل التسكين الفعلي
  parseRawDataToPreview(rawData: string): PreviewDataResult {
    if (!rawData || !rawData.trim()) {
      return {
        success: false,
        rows: [],
        total: 0,
        confirmedCount: 0,
        pendingCount: 0,
        uniqueLockers: 0,
        conflictCount: 0,
        errors: ['لا توجد بيانات صالحة للمعاينة']
      };
    }

    const parsed = parseRawDataToBookings(rawData);
    if (parsed.length === 0) {
      return {
        success: false,
        rows: [],
        total: 0,
        confirmedCount: 0,
        pendingCount: 0,
        uniqueLockers: 0,
        conflictCount: 0,
        errors: ['تعذر استخراج بيانات الدواليب، يرجى التأكد من احتواء النص على رمز الدولاب وأسماء الطلاب']
      };
    }

    // دمج الصفوف المتعددة لنفس الدولاب لضمان عدم إسقاط الطلاب
    const merged = mergeBookings(parsed);
    const db = readLocalDB();
    const rows: ParsedPreviewRow[] = [];
    const lockerSet = new Set<string>();

    for (let i = 0; i < merged.length; i++) {
      const b = merged[i];
      lockerSet.add(b.locker_code);
      const existingLocker = db.lockers.find(l => l.locker_code.toUpperCase() === b.locker_code.toUpperCase());

      let conflictWarning: string | undefined = undefined;
      let existingStudents: string[] | undefined = undefined;

      if (existingLocker) {
        if (existingLocker.is_admin_reserved) {
          conflictWarning = 'الدولاب مخصص للإدارة حالياً';
        } else if (existingLocker.status === 'confirmed' && existingLocker.current_booking_id) {
          const exBk = db.bookings.find(bk => bk.id === existingLocker.current_booking_id);
          if (exBk && exBk.student_names && exBk.student_names.length > 0) {
            existingStudents = exBk.student_names;
            const hasOverlap = b.student_names.some(n => exBk.student_names.includes(n));
            if (!hasOverlap) {
              conflictWarning = `مسكن بالفعل لـ: ${exBk.student_names.slice(0, 2).join('، ')}`;
            }
          }
        }
      }

      rows.push({
        id: `prev_${Date.now()}_${i}`,
        locker_code: b.locker_code,
        letter: b.letter,
        number: b.number,
        cohort: b.cohort,
        phone: b.phone,
        student_names: b.student_names,
        status: b.status,
        is_existing: !!existingLocker,
        current_status: existingLocker ? existingLocker.status : 'new',
        current_students: existingStudents,
        conflict_warning: conflictWarning
      });
    }

    return {
      success: true,
      rows,
      total: rows.length,
      confirmedCount: rows.filter(r => r.status === 'confirmed').length,
      pendingCount: rows.filter(r => r.status === 'pending').length,
      uniqueLockers: lockerSet.size,
      conflictCount: rows.filter(r => !!r.conflict_warning).length,
      errors: []
    };
  },

  // 21. اعتماد وتسكين البيانات بعد المعاينة أو من ملف
  commitParsedBookings(rows: any[], options?: { cleanBeforeSync?: boolean }): {
    success: boolean;
    importedCount: number;
    updatedLockersCount: number;
    message: string;
  } {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return { success: false, importedCount: 0, updatedLockersCount: 0, message: 'لا توجد بيانات لاعتمادها' };
    }

    // دمج الصفوف المتكررة لنفس الدولاب لمنع مسح أي طالب مسجل بسطر منفصل
    const mergedRows = mergeBookings(rows);
    const db = readLocalDB();
    const clean = options?.cleanBeforeSync === true;
    let importedCount = 0;
    let updatedLockersCount = 0;

    if (clean) {
      // إخلاء جميع الحجوزات السابقة غير الإدارية
      db.bookings = [];
      db.lockers.forEach(l => {
        l.current_booking_id = null;
        if (!l.is_admin_reserved) {
          l.status = 'empty';
        }
      });
    }

    for (let i = 0; i < mergedRows.length; i++) {
      const r = mergedRows[i];
      const norm = normalizeLockerCode(r.locker_code);
      const code = norm ? norm.code : (r.locker_code || '').trim().toUpperCase();
      if (!code) continue;

      let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);
      if (!locker) {
        const letter = norm ? norm.letter : code.charAt(0).toUpperCase();
        const number = norm ? norm.number : (parseInt(code.slice(1), 10) || 1);
        locker = {
          id: `L_${code}`,
          locker_code: code,
          letter,
          number,
          capacity: (r.student_names && r.student_names.length > 2) ? 4 : 2,
          is_enabled: true,
          is_admin_reserved: false,
          status: 'empty',
          current_booking_id: null,
          updated_at: new Date().toISOString()
        };
        db.lockers.push(locker);
        updatedLockersCount++;
      }

      // في حالة عدم التنظيف المسبق، نتأكد من إخلاء الحجز السابق لهذا الدولاب
      if (!clean && locker.current_booking_id) {
        const prevB = db.bookings.find(b => b.id === locker!.current_booking_id);
        if (prevB) {
          prevB.status = 'rejected';
          prevB.notes = 'تم استبداله باستيراد جديد';
        }
      }

      const bookingStatus: 'confirmed' | 'pending' = r.status === 'pending' ? 'pending' : 'confirmed';
      const bookingId = `B_IMP_${Date.now()}_${i}`;
      const validNames = (r.student_names || []).map((n: any) => String(n || '').trim()).filter(Boolean);

      const booking: LockerBooking = {
        id: bookingId,
        locker_code: code,
        cohort: r.cohort || 'الفرقة الرابعة',
        representative_phone: r.phone || '',
        student_names: validNames.slice(0, 4),
        student_codes: r.student_codes || [],
        status: bookingStatus,
        created_at: new Date().toISOString(),
        confirmed_at: bookingStatus === 'confirmed' ? new Date().toISOString() : undefined,
        confirmed_by: bookingStatus === 'confirmed' ? 'استيراد جوجل شيت' : undefined,
        responsible: 'SHEET_SYNC',
        notes: r.notes || 'مستورد عبر أداة مزامنة شيت جوجل'
      };

      locker.status = bookingStatus;
      locker.current_booking_id = bookingId;
      locker.is_admin_reserved = false;
      locker.is_enabled = true;
      if (validNames.length > 0 && validNames.length <= 2) {
        locker.capacity = 2;
      } else if (validNames.length > 2) {
        locker.capacity = 4;
      }
      locker.updated_at = new Date().toISOString();

      db.bookings.push(booking);
      importedCount++;
    }

    // إعادة ترتيب الدواليب
    db.lockers.sort((a, b) => {
      if (a.letter !== b.letter) return a.letter.localeCompare(b.letter);
      return a.number - b.number;
    });

    writeLocalDB(db);

    return {
      success: importedCount > 0,
      importedCount,
      updatedLockersCount,
      message: `تم تسكين واعتماد ${importedCount} حجزاً بنجاح في النظام!`
    };
  },

  // 22. محرك استكشاف وجلب كافة أوراق وبيانات ملف Google Sheets
  async harvestGoogleSheet(params: {
    sheetUrl: string;
    mode?: 'full' | 'confirmed_only' | 'custom';
    customTab?: string;
  }): Promise<{
    success: boolean;
    sheetId: string;
    discoveredTabs: string[];
    scannedTabs: string[];
    mergedBookings: any[];
    detectedRanges: { [key: string]: number };
    adminReservedCodes: string[];
    capacityUpdates: { [code: string]: number };
    authRequired?: boolean;
    error?: string;
  }> {
    const { sheetUrl, mode = 'full', customTab } = params;
    const sheetId = extractSpreadsheetId(sheetUrl);

    if (!sheetId) {
      return {
        success: false,
        sheetId: '',
        discoveredTabs: [],
        scannedTabs: [],
        mergedBookings: [],
        detectedRanges: {},
        adminReservedCodes: [],
        capacityUpdates: {},
        error: 'رابط جوجل شيت غير صالح. يرجى لصق الرابط كاملاً من المتصفح أو إدخال معرف الشيت (ID).'
      };
    }

    const urlGid = extractGid(sheetUrl);

    // دالة مساعدة لجلب محتوى أي ورقة باسمها عبر GViz
    const fetchGVizCSV = async (tabName: string): Promise<string | null> => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.includes('accounts.google.com') || (text.includes('<html') && text.includes('Sign in'))) {
          throw new Error('AUTH_REQUIRED');
        }
        return text;
      } catch (e: any) {
        if (e.message === 'AUTH_REQUIRED') throw e;
        return null;
      }
    };

    // دالة مساعدة لجلب محتوى الورقة عبر gid مباشرة
    const fetchGidCSV = async (gid: string): Promise<string | null> => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`;
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.includes('accounts.google.com') || (text.includes('<html') && text.includes('Sign in'))) {
          throw new Error('AUTH_REQUIRED');
        }
        return text;
      } catch (e: any) {
        if (e.message === 'AUTH_REQUIRED') throw e;
        return null;
      }
    };

    // دالة مساعدة لتنزيل الكشف الافتراضي العام
    const fetchExportCSV = async (): Promise<string | null> => {
      try {
        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        const res = await fetch(exportUrl, { redirect: 'follow' });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.includes('accounts.google.com') || (text.includes('<html') && text.includes('Sign in'))) {
          throw new Error('AUTH_REQUIRED');
        }
        return text;
      } catch (e: any) {
        if (e.message === 'AUTH_REQUIRED') throw e;
        return null;
      }
    };

    try {
      // 1. استكشاف كافة التبويبات الحقيقية الموجودة في المستند تلقائياً
      const discoveredTabs = await discoverAllSheetTabs(sheetId);

      // التبويبات الشائعة المرشحة
      const standardCandidates = [
        'A', 'B', 'C', 'D',
        'أ', 'ب', 'ج', 'د',
        'التسجيلات_المؤكدة', 'التسجيلات المؤكدة',
        'التسجيلات_المؤقتة', 'التسجيلات المؤقتة',
        'المؤكدة', 'المؤقتة', 'الحجوزات', 'الحجوزات المؤكدة', 'كشف الدواليب', 'الدواليب',
        'الفرقة الرابعة', 'الفرقة الثالثة', 'الفرقة الثانية', 'الفرقة الأولى',
        'فرقة رابعة', 'فرقة ثالثة', 'فرقة ثانية', 'فرقة أولى',
        'بيانات الطلاب', 'تسكين الدواليب', 'تسكين',
        'Sheet1', 'Sheet2', 'Sheet3', 'Sheet4', 'ورقة1', 'ورقة2', 'ورقة3', 'ورقة4'
      ];

      let tabsToScan: string[] = [];
      if (mode === 'custom' && customTab) {
        tabsToScan = [customTab.trim()];
      } else if (mode === 'confirmed_only') {
        const confirmedDiscovered = discoveredTabs.filter(t => t.includes('مؤكد') || t.includes('تأكيد'));
        if (confirmedDiscovered.length > 0) {
          tabsToScan = confirmedDiscovered;
        } else {
          tabsToScan = ['التسجيلات المؤكدة', 'التسجيلات_المؤكدة', 'المؤكدة', 'الحجوزات المؤكدة'];
        }
      } else {
        // نمط المسح الشامل الكامل
        if (discoveredTabs.length > 0) {
          // نبدأ بالتبويبات المكتشفة فعلياً من هيكل المستند
          tabsToScan = [...discoveredTabs];
          // نضيف التبويبات القياسية التي لم تكتشف بعد
          for (const cand of standardCandidates) {
            if (!tabsToScan.includes(cand)) tabsToScan.push(cand);
          }
        } else {
          tabsToScan = standardCandidates;
        }
      }

      const scannedTabs: string[] = [];
      const rawBookings: any[] = [];
      const detectedRanges: { [key: string]: number } = {};
      const adminReservedCodes: string[] = [];
      const capacityUpdates: { [code: string]: number } = {};
      const seenContentSignatures = new Set<string>();

      // 2. إذا وجد معرف ورقة محدد في الرابط (?gid=...) نفحصه أولاً
      if (urlGid) {
        const gidCSV = await fetchGidCSV(urlGid);
        if (gidCSV && gidCSV.trim().length > 10) {
          const sig = `${gidCSV.length}_${gidCSV.slice(0, 80)}`;
          seenContentSignatures.add(sig);
          scannedTabs.push(`الورقة المحددة في الرابط (gid: ${urlGid})`);

          const parsedGid = parseRawDataToBookings(gidCSV, 'confirmed');
          rawBookings.push(...parsedGid);

          // فحص الملاحظات والنطاقات في ورقة الـ gid
          const table = parseCSV(gidCSV);
          for (const row of table) {
            const rowText = row.join(' ');
            const codeNorm = normalizeLockerCode(row[0]);
            if (codeNorm) {
              if (codeNorm.number > (detectedRanges[codeNorm.letter] || 0)) {
                detectedRanges[codeNorm.letter] = codeNorm.number;
              }
              if (rowText.includes('إدارة') || rowText.includes('مخصص للإدارة') || rowText.includes('حجز إداري')) {
                if (!adminReservedCodes.includes(codeNorm.code)) adminReservedCodes.push(codeNorm.code);
              }
            }
          }
        }
      }

      // 3. مسح التبويبات المحددة واحداً تلو الآخر
      for (const tabName of tabsToScan) {
        const csvText = await fetchGVizCSV(tabName);
        if (!csvText || csvText.trim().length < 5) continue;

        // التحقق من أن المحتوى حقيقي وليس تكراراً للورقة الافتراضية
        const sig = `${csvText.length}_${csvText.slice(0, 80)}`;
        if (seenContentSignatures.has(sig) && !discoveredTabs.includes(tabName)) {
          // هذا التبويب غير حقيقي وأرجع جوجل الورقة الافتراضية كبديل
          continue;
        }
        seenContentSignatures.add(sig);
        scannedTabs.push(tabName);

        // تحديد تلميح السكشن (A, B, C, D)
        const tabNorm = normalizeLockerCode(`${tabName}1`);
        const letterHint = tabNorm ? tabNorm.letter : (['A', 'B', 'C', 'D'].includes(tabName.toUpperCase()) ? tabName.toUpperCase() : undefined);

        // تحديد الحالة الافتراضية للورقة
        const defaultStatus: 'confirmed' | 'pending' = (tabName.includes('مؤقت') || tabName.includes('معلق') || tabName.includes('تسجيلات_مؤقتة')) ? 'pending' : 'confirmed';

        // استخراج أعداد المخزون والتخصيص الإداري والسعة
        const table = parseCSV(csvText);
        for (const row of table) {
          const rowText = row.join(' ');
          let codeNorm = normalizeLockerCode(row[0]);
          if (!codeNorm && letterHint && /^\d+$/.test(row[0]?.trim() || '')) {
            codeNorm = normalizeLockerCode(`${letterHint}${row[0].trim()}`);
          }

          if (codeNorm) {
            if (codeNorm.number > (detectedRanges[codeNorm.letter] || 0)) {
              detectedRanges[codeNorm.letter] = codeNorm.number;
            }
            if (rowText.includes('إدارة') || rowText.includes('مخصص للإدارة') || rowText.includes('حجز إداري')) {
              if (!adminReservedCodes.includes(codeNorm.code)) {
                adminReservedCodes.push(codeNorm.code);
              }
            }
            if (rowText.includes('شخصين') || rowText.includes('سعة 2') || rowText.includes('2 طالب') || rowText.includes('طالبين')) {
              capacityUpdates[codeNorm.code] = 2;
            } else if (rowText.includes('أربعة') || rowText.includes('سعة 4') || rowText.includes('4 طلاب')) {
              capacityUpdates[codeNorm.code] = 4;
            }
          }
        }

        // استخراج حجوزات الطلاب من هذه الورقة
        const bookingsFromTab = parseRawDataToBookings(csvText, defaultStatus, letterHint);
        rawBookings.push(...bookingsFromTab);
      }

      // 4. إذا لم يتم استخراج أي حجوزات من التبويبات الفردية، نحاول التنزيل العام الافتراضي
      if (rawBookings.length === 0) {
        const exportText = await fetchExportCSV();
        if (exportText && exportText.trim().length > 10) {
          scannedTabs.push('الكشف الافتراضي العام (Default Export)');
          const exportBookings = parseRawDataToBookings(exportText, 'confirmed');
          rawBookings.push(...exportBookings);
        }
      }

      // 5. دمج كافة الحجوزات المستخرجة عبر جميع الأوراق لدمج الطلاب المسكنين في نفس الدواليب
      const mergedBookings = mergeBookings(rawBookings);

      return {
        success: true,
        sheetId,
        discoveredTabs,
        scannedTabs,
        mergedBookings,
        detectedRanges,
        adminReservedCodes,
        capacityUpdates
      };
    } catch (err: any) {
      if (err.message === 'AUTH_REQUIRED') {
        return {
          success: false,
          sheetId,
          discoveredTabs: [],
          scannedTabs: [],
          mergedBookings: [],
          detectedRanges: {},
          adminReservedCodes: [],
          capacityUpdates: {},
          authRequired: true,
          error: 'الشيت يتطلب تسجيل دخول Google أو غير متاح للعامة. يرجى ضبط مشاركة الشيت على "أي شخص لديه الرابط يمكنه العرض" (Anyone with the link can view)، أو تنزيل الشيت كملف CSV ورفعه في تبويب "رفع ملف CSV".'
        };
      }
      return {
        success: false,
        sheetId,
        discoveredTabs: [],
        scannedTabs: [],
        mergedBookings: [],
        detectedRanges: {},
        adminReservedCodes: [],
        capacityUpdates: {},
        error: 'خطأ أثناء الاتصال بجوجل شيت: ' + (err.message || 'خطأ غير معروف')
      };
    }
  },

  // 23. معاينة تفاعلية لكامل بيانات رابط شيت جوجل قبل التسكين الفعلي
  async previewGoogleSheetUrl(params: {
    sheetUrl: string;
    mode?: 'full' | 'confirmed_only' | 'custom';
    customTab?: string;
  }): Promise<PreviewDataResult> {
    const harvest = await this.harvestGoogleSheet(params);

    if (!harvest.success) {
      return {
        success: false,
        rows: [],
        total: 0,
        confirmedCount: 0,
        pendingCount: 0,
        uniqueLockers: 0,
        conflictCount: 0,
        discoveredTabs: harvest.discoveredTabs,
        scannedTabs: harvest.scannedTabs,
        errors: [harvest.error || 'تعذر استخراج بيانات الشيت']
      };
    }

    const db = readLocalDB();
    const rows: ParsedPreviewRow[] = [];
    const lockerSet = new Set<string>();

    for (let i = 0; i < harvest.mergedBookings.length; i++) {
      const b = harvest.mergedBookings[i];
      lockerSet.add(b.locker_code);
      const existingLocker = db.lockers.find(l => l.locker_code.toUpperCase() === b.locker_code.toUpperCase());

      let conflictWarning: string | undefined = undefined;
      let existingStudents: string[] | undefined = undefined;

      if (existingLocker) {
        if (existingLocker.is_admin_reserved || harvest.adminReservedCodes.includes(b.locker_code)) {
          conflictWarning = 'الدولاب مخصص للإدارة حالياً';
        } else if (existingLocker.status === 'confirmed' && existingLocker.current_booking_id) {
          const exBk = db.bookings.find(bk => bk.id === existingLocker.current_booking_id);
          if (exBk && exBk.student_names && exBk.student_names.length > 0) {
            existingStudents = exBk.student_names;
            const hasOverlap = b.student_names.some((n: string) => exBk.student_names.includes(n));
            if (!hasOverlap) {
              conflictWarning = `مسكن بالفعل لـ: ${exBk.student_names.slice(0, 2).join('، ')}`;
            }
          }
        }
      }

      rows.push({
        id: `prev_url_${Date.now()}_${i}`,
        locker_code: b.locker_code,
        letter: b.letter,
        number: b.number,
        cohort: b.cohort,
        phone: b.phone,
        student_names: b.student_names,
        status: b.status,
        is_existing: !!existingLocker,
        current_status: existingLocker ? existingLocker.status : 'new',
        current_students: existingStudents,
        conflict_warning: conflictWarning
      });
    }

    return {
      success: true,
      rows,
      total: rows.length,
      confirmedCount: rows.filter(r => r.status === 'confirmed').length,
      pendingCount: rows.filter(r => r.status === 'pending').length,
      uniqueLockers: lockerSet.size,
      conflictCount: rows.filter(r => !!r.conflict_warning).length,
      discoveredTabs: harvest.discoveredTabs,
      scannedTabs: harvest.scannedTabs,
      errors: rows.length === 0 ? ['تم مسح الأوراق بنجاح لكن لم يتم العثور على أسطر تسكين صالحة'] : []
    };
  },

  // 24. المزامنة المباشرة الشاملة والذكية مع رابط Google Sheets
  async syncFromGoogleSheetUrl(params: {
    sheetUrl: string;
    mode?: 'full' | 'confirmed_only' | 'custom';
    customTab?: string;
    cleanBeforeSync?: boolean;
  }): Promise<SheetSyncResult> {
    const { sheetUrl, cleanBeforeSync } = params;
    const harvest = await this.harvestGoogleSheet(params);

    if (!harvest.success) {
      return {
        success: false,
        importedConfirmed: 0,
        importedPending: 0,
        adminReservedCount: 0,
        totalLockers: 0,
        discoveredTabs: harvest.discoveredTabs,
        scannedTabs: harvest.scannedTabs,
        message: harvest.error || 'فشلت المزامنة مع خوادم جوجل'
      };
    }

    const db = readLocalDB();

    // 1. تحديث أعداد المخزون من النطاقات المكتشفة في الأوراق
    for (const [letter, maxNum] of Object.entries(harvest.detectedRanges)) {
      if (maxNum > 0) {
        for (let i = 1; i <= maxNum; i++) {
          const code = `${letter.toUpperCase()}${i}`;
          let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);
          if (!locker) {
            locker = {
              id: `L_${code}`,
              locker_code: code,
              letter: letter.toUpperCase(),
              number: i,
              capacity: 4,
              is_enabled: true,
              is_admin_reserved: false,
              status: 'empty',
              current_booking_id: null,
              updated_at: new Date().toISOString()
            };
            db.lockers.push(locker);
          }
        }
      }
    }

    // 2. تطبيق التخصيص الإداري المكتشف
    let adminReservedCount = 0;
    for (const code of harvest.adminReservedCodes) {
      let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code.toUpperCase());
      if (locker) {
        locker.is_admin_reserved = true;
        locker.is_enabled = false;
        locker.notes = 'مخصص للإدارة (مستورد من شيت جوجل)';
        adminReservedCount++;
      }
    }

    // 3. تطبيق تحديثات السعة المكتشفة (شخصين أو 4)
    for (const [code, cap] of Object.entries(harvest.capacityUpdates)) {
      let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code.toUpperCase());
      if (locker) {
        locker.capacity = cap;
      }
    }

    writeLocalDB(db);

    // 4. اعتماد وتسكين كافة الحجوزات المدمجة
    const commitRes = this.commitParsedBookings(harvest.mergedBookings, { cleanBeforeSync });

    // 5. حفظ رابط الشيت في الإعدادات
    const currentDb = readLocalDB();
    currentDb.settings.google_sheet_url = sheetUrl;
    writeLocalDB(currentDb);

    const confirmedCount = harvest.mergedBookings.filter(b => b.status === 'confirmed').length;
    const pendingCount = harvest.mergedBookings.filter(b => b.status === 'pending').length;

    const scannedSummary = harvest.scannedTabs.length > 0
      ? `تم مسح ${harvest.scannedTabs.length} أوراق عمل: [${harvest.scannedTabs.join(', ')}].`
      : '';

    return {
      success: true,
      importedConfirmed: confirmedCount,
      importedPending: pendingCount,
      adminReservedCount,
      totalLockers: currentDb.lockers.length,
      ranges: harvest.detectedRanges,
      scannedTabs: harvest.scannedTabs,
      discoveredTabs: harvest.discoveredTabs,
      message: `تمت المزامنة الشاملة بنجاح! ${scannedSummary} تم استيراد وتسكين ${harvest.mergedBookings.length} حجوزات (${confirmedCount} مؤكد، ${pendingCount} معلق) وتأكيد ${adminReservedCount} دواليب مخصصة للإدارة.`
    };
  },

  // 23. استيراد فوري سريع (للتوافق مع الواجهات السابقة)
  importBookings(rawData: string): { success: boolean; importedCount: number; updatedLockersCount: number; errors: string[] } {
    if (!rawData || !rawData.trim()) {
      return { success: false, importedCount: 0, updatedLockersCount: 0, errors: ['لا توجد بيانات صالحة للاستيراد'] };
    }
    const parsed = parseRawDataToBookings(rawData);
    if (parsed.length === 0) {
      return { success: false, importedCount: 0, updatedLockersCount: 0, errors: ['تعذر استخراج بيانات الدواليب والطلاب'] };
    }
    const res = this.commitParsedBookings(parsed, { cleanBeforeSync: false });
    return {
      success: res.success,
      importedCount: res.importedCount,
      updatedLockersCount: res.updatedLockersCount,
      errors: []
    };
  },

  // 21. إحصائيات عامة محدثة بدقة
  getStats() {
    const db = readLocalDB();
    const total = db.lockers.length;
    const confirmed = db.lockers.filter(l => l.status === 'confirmed').length;
    const pending = db.lockers.filter(l => l.status === 'pending').length;
    const adminReserved = db.lockers.filter(l => l.is_admin_reserved || (!l.is_enabled && !l.current_booking_id && (l.notes || '').includes('إدارة'))).length;
    const empty = db.lockers.filter(l => l.status === 'empty' && l.is_enabled && !l.is_admin_reserved).length;
    const disabled = db.lockers.filter(l => !l.is_enabled && !l.is_admin_reserved && !(l.notes || '').includes('إدارة')).length;
    const waitlistCount = db.waitlist.filter(w => w.status === 'waiting').length;

    return {
      total,
      confirmed,
      pending,
      adminReserved,
      empty,
      disabled,
      waitlistCount,
      occupancyRate: total > 0 ? Math.round(((confirmed + pending) / total) * 100) : 0
    };
  }
};
