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

interface LocalLockersDB {
  lockers: LockerItem[];
  bookings: LockerBooking[];
  waitlist: LockerWaitlistEntry[];
  settings: LockerSettings;
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

  // 20. استيراد بيانات التسكين بالجملة من شيت جوجل أو إكسيل (Bulk Import)
  importBookings(rawData: string): { success: boolean; importedCount: number; updatedLockersCount: number; errors: string[] } {
    if (!rawData || !rawData.trim()) {
      return { success: false, importedCount: 0, updatedLockersCount: 0, errors: ['لا توجد بيانات صالحة للاستيراد'] };
    }

    const db = readLocalDB();
    const lines = rawData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let importedCount = 0;
    let updatedLockersCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // تخطي العناوين الرئيسية
      if (line.includes('ID') && line.includes('الفرقة') && line.includes('الدولاب')) continue;
      if (line.startsWith('الدولاب') || line.startsWith('رمز الدولاب')) continue;

      const delimiter = line.includes('\t') ? '\t' : (line.includes(',') ? ',' : (line.includes(';') ? ';' : '\t'));
      const parts = line.split(delimiter).map(p => p.trim());

      // البحث عن رمز الدولاب (A1, B12, C34, D5 ...)
      let lockerCode = '';
      let letterFound = '';
      let numberFound = 0;

      for (const p of parts) {
        const m = p.match(/^([A-Da-d])\s*(\d+)$/);
        if (m) {
          letterFound = m[1].toUpperCase();
          numberFound = parseInt(m[2], 10);
          lockerCode = `${letterFound}${numberFound}`;
          break;
        }
      }

      // إذا لم يكن في خانة واحدة، نبحث عن خانة بها الحرف وخانة بها الرقم
      if (!lockerCode) {
        const lIndex = parts.findIndex(p => /^[A-Da-d]$/.test(p));
        if (lIndex >= 0) {
          letterFound = parts[lIndex].toUpperCase();
          const nIndex = parts.findIndex((p, idx) => idx !== lIndex && /^\d+$/.test(p) && parseInt(p, 10) < 500);
          if (nIndex >= 0) {
            numberFound = parseInt(parts[nIndex], 10);
            lockerCode = `${letterFound}${numberFound}`;
          }
        }
      }

      if (!lockerCode) {
        // لا يوجد كود دولاب في هذا السطر
        continue;
      }

      // استخراج الهاتف
      let phone = '';
      const phonePart = parts.find(p => /^(01[0125]\d{8}|\+?201[0125]\d{8})$/.test(p.replace(/\s+/g, '')));
      if (phonePart) {
        phone = phonePart.replace(/\s+/g, '');
      }

      // استخراج الفرقة
      let cohort = 'الفرقة الرابعة';
      const cohortPart = parts.find(p => p.includes('فرقة') || p.includes('أولى') || p.includes('ثانية') || p.includes('ثالثة') || p.includes('رابعة'));
      if (cohortPart) {
        cohort = cohortPart;
      }

      // استخراج الأسماء
      const names: string[] = [];
      for (const p of parts) {
        if (!p || p === lockerCode || p === phone || p === cohort || p === letterFound || String(numberFound) === p) continue;
        if (/^(R\d+|\d{10,}|\d{4}-\d{2}-\d{2}|http|تم التأكيد|قيد التسجيل)/.test(p)) continue;
        // هل النص يحمل اسم شخص باللغة العربية؟
        if (/[\u0600-\u06FF]{3,}/.test(p) && !p.includes('فرقة') && !p.includes('تأكيد') && !p.includes('تسجيل')) {
          // قد يحتوي الحقل على عدة أسماء مفصولة بشرطة أو سطر جديد
          const splitNames = p.split(/[\n|\-–,،]/).map(n => n.trim()).filter(n => n.length > 3);
          if (splitNames.length > 1) {
            splitNames.forEach(n => names.push(n));
          } else {
            names.push(p);
          }
        }
      }

      // التأكد من وجود الدولاب في المخزون
      let locker = db.lockers.find(l => l.locker_code.toUpperCase() === lockerCode);
      if (!locker) {
        locker = {
          id: `L_${lockerCode}`,
          locker_code: lockerCode,
          letter: letterFound || lockerCode.charAt(0),
          number: numberFound || parseInt(lockerCode.substring(1), 10) || 1,
          capacity: names.length > 2 ? 4 : 2,
          is_enabled: true,
          is_admin_reserved: false,
          status: 'empty',
          current_booking_id: null,
          updated_at: new Date().toISOString()
        };
        db.lockers.push(locker);
        updatedLockersCount++;
      }

      // إنشاء حجز مؤكد
      const bookingId = `B_IMP_${Date.now()}_${i}`;
      const booking: LockerBooking = {
        id: bookingId,
        locker_code: lockerCode,
        cohort,
        representative_phone: phone || '01000000000',
        student_names: names.slice(0, 4),
        student_codes: [],
        status: 'confirmed',
        created_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
        confirmed_by: 'استيراد جوجل شيت',
        responsible: 'SHEET_IMPORT',
        notes: 'مستورد من كشوف التسكين المعتمدة'
      };

      // ربط الحجز بالدولاب
      locker.status = 'confirmed';
      locker.current_booking_id = bookingId;
      locker.is_admin_reserved = false;
      locker.is_enabled = true;
      if (names.length > 0 && names.length <= 2) {
        locker.capacity = 2;
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
      errors
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
