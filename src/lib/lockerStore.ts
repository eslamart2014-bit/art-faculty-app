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

// تحليل البيانات الخام إلى حجوزات معيارية
export function parseRawDataToBookings(rawData: string, defaultStatus: 'confirmed' | 'pending' = 'confirmed'): Array<{
  locker_code: string;
  letter: string;
  number: number;
  cohort: string;
  phone: string;
  student_names: string[];
  status: 'confirmed' | 'pending';
}> {
  if (!rawData || !rawData.trim()) return [];
  const table = parseCSV(rawData);
  if (!table || table.length === 0) return [];

  const firstRow = table[0].map(c => (c || '').trim());
  const isDataRow = firstRow.some(cell => 
    /^[A-Da-d]\s*\d+$/.test(cell) || 
    /^(01[0125]\d{8}|\+?201[0125]\d{8})$/.test(cell.replace(/\s+/g, ''))
  );

  const hasHeader = !isDataRow && firstRow.some(c => {
    const lower = c.toLowerCase();
    return lower === 'id' || lower === 'الدولاب' || lower === 'رمز الدولاب' || lower === 'كود الدولاب' || lower === 'locker' ||
           lower === 'الحرف' || lower === 'الرقم' || lower === 'ممثل الهاتف' || lower === 'اسم1' || lower === 'اسم' || lower === 'name';
  });

  const headerIndices = {
    lockerCode: -1,
    letter: -1,
    number: -1,
    cohort: -1,
    phone: -1,
    status: -1,
    nameCols: [] as number[]
  };

  let startIndex = 0;
  if (hasHeader) {
    startIndex = 1;
    table[0].forEach((col, idx) => {
      const lower = col.trim().toLowerCase();
      if (lower === 'الدولاب' || lower === 'رمز الدولاب' || lower === 'كود الدولاب' || lower === 'locker' || lower === 'code') {
        headerIndices.lockerCode = idx;
      } else if (lower === 'الحرف' || lower === 'letter') {
        headerIndices.letter = idx;
      } else if (lower === 'الرقم' || lower === 'number') {
        headerIndices.number = idx;
      } else if (lower.includes('فرقة') || lower === 'cohort') {
        headerIndices.cohort = idx;
      } else if (lower.includes('هاتف') || lower.includes('موبايل') || lower === 'phone') {
        headerIndices.phone = idx;
      } else if (lower.includes('حالة') || lower === 'status') {
        headerIndices.status = idx;
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
    status: 'confirmed' | 'pending';
  }> = [];

  for (let i = startIndex; i < table.length; i++) {
    const row = table[i];
    if (!row || row.length === 0) continue;

    let lockerCode = '';
    let letter = '';
    let number = 0;
    let cohort = '';
    let phone = '';
    let status: 'confirmed' | 'pending' = defaultStatus;
    const names: string[] = [];

    if (hasHeader && (headerIndices.lockerCode !== -1 || (headerIndices.letter !== -1 && headerIndices.number !== -1))) {
      if (headerIndices.lockerCode !== -1 && row[headerIndices.lockerCode]) {
        lockerCode = row[headerIndices.lockerCode].toUpperCase().replace(/\s+/g, '');
      } else if (headerIndices.letter !== -1 && headerIndices.number !== -1) {
        lockerCode = `${row[headerIndices.letter].toUpperCase()}${row[headerIndices.number]}`.replace(/\s+/g, '');
      }

      if (headerIndices.cohort !== -1 && row[headerIndices.cohort]) {
        cohort = row[headerIndices.cohort];
      }
      if (headerIndices.phone !== -1 && row[headerIndices.phone]) {
        phone = row[headerIndices.phone].replace(/\s+/g, '');
      }
      if (headerIndices.status !== -1 && row[headerIndices.status]) {
        const st = row[headerIndices.status];
        if (st.includes('مؤكد') || st.includes('تأكيد')) status = 'confirmed';
        else if (st.includes('مؤقت') || st.includes('تسجيل') || st.includes('معلق')) status = 'pending';
      }
      headerIndices.nameCols.forEach(idx => {
        const val = (row[idx] || '').trim();
        if (val && val.length > 2) names.push(val);
      });
    }

    if (!lockerCode) {
      for (const p of row) {
        const m = p.match(/^([A-Da-d])\s*(\d+)$/);
        if (m) {
          letter = m[1].toUpperCase();
          number = parseInt(m[2], 10);
          lockerCode = `${letter}${number}`;
          break;
        }
      }
      if (!lockerCode) {
        const lIndex = row.findIndex(p => /^[A-Da-d]$/.test(p));
        if (lIndex >= 0) {
          letter = row[lIndex].toUpperCase();
          const nIndex = row.findIndex((p, idx) => idx !== lIndex && /^\d+$/.test(p) && parseInt(p, 10) < 500);
          if (nIndex >= 0) {
            number = parseInt(row[nIndex], 10);
            lockerCode = `${letter}${number}`;
          }
        }
      }
    }

    if (!lockerCode) continue;

    if (!letter || !number) {
      const match = lockerCode.match(/^([A-Za-z])(\d+)$/);
      if (match) {
        letter = match[1].toUpperCase();
        number = parseInt(match[2], 10);
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

    if (names.length === 0) {
      for (const p of row) {
        if (!p || p === lockerCode || p === phone || p === cohort || p === letter || String(number) === p) continue;
        if (/^(R\d+|\d{10,}|\d{4}-\d{2}-\d{2}|http|تم التأكيد|قيد التسجيل)/.test(p)) continue;
        if (/[\u0600-\u06FF]{3,}/.test(p) && !p.includes('فرقة') && !p.includes('تأكيد') && !p.includes('تسجيل')) {
          const splitNames = p.split(/[\n|\-–,،]/).map(n => n.trim()).filter(n => n.length > 2);
          if (splitNames.length > 1) {
            splitNames.forEach(n => names.push(n));
          } else {
            names.push(p);
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
      status
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

    const db = readLocalDB();
    const rows: ParsedPreviewRow[] = [];
    const lockerSet = new Set<string>();

    for (let i = 0; i < parsed.length; i++) {
      const b = parsed[i];
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

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const code = (r.locker_code || '').trim().toUpperCase();
      if (!code) continue;

      let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);
      if (!locker) {
        const match = code.match(/^([A-Za-z])(\d+)$/);
        const letter = match ? match[1].toUpperCase() : code.charAt(0).toUpperCase();
        const number = match ? parseInt(match[2], 10) : 1;
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
        notes: 'مستورد عبر أداة مزامنة شيت جوجل'
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

  // 22. المزامنة المباشرة الذكية مع رابط أو معرف Google Sheets
  async syncFromGoogleSheetUrl(params: {
    sheetUrl: string;
    mode?: 'full' | 'confirmed_only' | 'custom';
    customTab?: string;
    cleanBeforeSync?: boolean;
  }): Promise<SheetSyncResult> {
    const { sheetUrl, mode = 'full', customTab, cleanBeforeSync } = params;
    const sheetId = extractSpreadsheetId(sheetUrl);

    if (!sheetId) {
      return {
        success: false,
        importedConfirmed: 0,
        importedPending: 0,
        adminReservedCount: 0,
        totalLockers: 0,
        message: 'رابط جوجل شيت غير صالح. يرجى لصق الرابط كاملاً من المتصفح أو إدخال معرف الشيت (ID).'
      };
    }

    const fetchGVizCSV = async (tabName: string): Promise<string | null> => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.includes('accounts.google.com') || text.includes('<html') || text.includes('<!DOCTYPE')) {
          throw new Error('AUTH_REQUIRED');
        }
        return text;
      } catch (e: any) {
        if (e.message === 'AUTH_REQUIRED') throw e;
        return null;
      }
    };

    try {
      const db = readLocalDB();
      let adminReservedCount = 0;
      const detectedRanges: { [key: string]: number } = {};

      if (mode === 'full') {
        // 1. قراءة أوراق الأحرف A, B, C, D لتحديد أعداد المخزون والتخصيص الإداري
        const letters = ['A', 'B', 'C', 'D'];
        for (const letter of letters) {
          const letterCSV = await fetchGVizCSV(letter);
          if (letterCSV) {
            const table = parseCSV(letterCSV);
            let maxNum = 0;
            for (const row of table) {
              const num = parseInt(row[0], 10);
              if (!isNaN(num) && num > 0) {
                if (num > maxNum) maxNum = num;
                const note = (row[1] || '').trim();
                const code = `${letter}${num}`;

                let locker = db.lockers.find(l => l.locker_code.toUpperCase() === code);
                if (!locker) {
                  locker = {
                    id: `L_${code}`,
                    locker_code: code,
                    letter,
                    number: num,
                    capacity: 4,
                    is_enabled: true,
                    is_admin_reserved: false,
                    status: 'empty',
                    current_booking_id: null
                  };
                  db.lockers.push(locker);
                }

                if (note.includes('إدارة')) {
                  locker.is_admin_reserved = true;
                  locker.is_enabled = false;
                  locker.notes = 'مخصص للإدارة (مستورد من شيت ' + letter + ')';
                  adminReservedCount++;
                }
                if (note.includes('شخصين') || note.includes('2')) {
                  locker.capacity = 2;
                } else if (note.includes('4')) {
                  locker.capacity = 4;
                }
              }
            }
            if (maxNum > 0) {
              detectedRanges[letter] = maxNum;
            }
          }
        }
        writeLocalDB(db);

        // 2. قراءة ورقة التسجيلات_المؤكدة
        const confirmedText = await fetchGVizCSV('التسجيلات_المؤكدة');
        let confirmedBookings: any[] = [];
        if (confirmedText) {
          confirmedBookings = parseRawDataToBookings(confirmedText, 'confirmed');
        }

        // 3. قراءة ورقة التسجيلات_المؤقتة
        const pendingText = await fetchGVizCSV('التسجيلات_المؤقتة');
        let pendingBookings: any[] = [];
        if (pendingText) {
          pendingBookings = parseRawDataToBookings(pendingText, 'pending');
        }

        // إذا لم يتم العثور على أوراق بأسمائها العربية، نحاول التنزيل العام الافتراضي
        if (confirmedBookings.length === 0 && pendingBookings.length === 0) {
          try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            const exportRes = await fetch(exportUrl, { redirect: 'follow' });
            if (exportRes.ok) {
              const exportText = await exportRes.text();
              if (!exportText.includes('accounts.google.com') && !exportText.includes('<html')) {
                confirmedBookings = parseRawDataToBookings(exportText, 'confirmed');
              }
            }
          } catch (e) {}
        }

        const allToCommit = [...confirmedBookings, ...pendingBookings];
        const commitRes = this.commitParsedBookings(allToCommit, { cleanBeforeSync });

        // حفظ رابط الشيت في الإعدادات
        const currentDb = readLocalDB();
        currentDb.settings.google_sheet_url = sheetUrl;
        writeLocalDB(currentDb);

        return {
          success: true,
          importedConfirmed: confirmedBookings.length,
          importedPending: pendingBookings.length,
          adminReservedCount,
          totalLockers: currentDb.lockers.length,
          ranges: detectedRanges,
          message: `تمت المزامنة بنجاح! تم استيراد ${confirmedBookings.length} حجوزات معتمدة، و${pendingBookings.length} حجوزات معلقة، وتأكيد ${adminReservedCount} دواليب مخصصة للإدارة.`
        };
      } else if (mode === 'confirmed_only') {
        let text = await fetchGVizCSV('التسجيلات_المؤكدة');
        if (!text) {
          const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
          const exportRes = await fetch(exportUrl, { redirect: 'follow' });
          if (exportRes.ok) text = await exportRes.text();
        }
        if (!text) {
          return {
            success: false,
            importedConfirmed: 0,
            importedPending: 0,
            adminReservedCount: 0,
            totalLockers: 0,
            message: 'تعذر العثور على ورقة التسجيلات_المؤكدة في هذا الشيت'
          };
        }
        const bookings = parseRawDataToBookings(text, 'confirmed');
        const commitRes = this.commitParsedBookings(bookings, { cleanBeforeSync });
        return {
          success: true,
          importedConfirmed: bookings.length,
          importedPending: 0,
          adminReservedCount: 0,
          totalLockers: readLocalDB().lockers.length,
          message: `تم استيراد ${bookings.length} حجوزات معتمدة بنجاح!`
        };
      } else {
        // mode === 'custom'
        const tab = customTab || 'Sheet1';
        const text = await fetchGVizCSV(tab);
        if (!text) {
          return {
            success: false,
            importedConfirmed: 0,
            importedPending: 0,
            adminReservedCount: 0,
            totalLockers: 0,
            message: `تعذر قراءة الورقة "${tab}" من ملف جوجل شيت`
          };
        }
        const bookings = parseRawDataToBookings(text, 'confirmed');
        const commitRes = this.commitParsedBookings(bookings, { cleanBeforeSync });
        return {
          success: true,
          importedConfirmed: bookings.length,
          importedPending: 0,
          adminReservedCount: 0,
          totalLockers: readLocalDB().lockers.length,
          message: `تم استيراد ${bookings.length} حجوزات من الورقة "${tab}" بنجاح!`
        };
      }
    } catch (err: any) {
      if (err.message === 'AUTH_REQUIRED') {
        return {
          success: false,
          importedConfirmed: 0,
          importedPending: 0,
          adminReservedCount: 0,
          totalLockers: 0,
          message: 'الشيت يتطلب تسجيل دخول Google أو غير متاح للعامة. يرجى ضبط صلاحية المشاركة على "أي مستخدم لديه الرابط يمكنه العرض" (Anyone with the link can view)، أو تنزيل الشيت كملف CSV ورفعه في تبويب "رفع ملف CSV".'
        };
      }
      return {
        success: false,
        importedConfirmed: 0,
        importedPending: 0,
        adminReservedCount: 0,
        totalLockers: 0,
        message: 'خطأ أثناء الاتصال بجوجل شيت: ' + (err.message || 'خطأ غير معروف')
      };
    }
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
