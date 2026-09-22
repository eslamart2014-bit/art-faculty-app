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
        l.is_enabled === true
      );
    }

    // إذا لم يجد أو لم يحدد حرفاً، خذ أول دولاب شاغر متاح
    if (!availableLocker) {
      availableLocker = db.lockers.find(l => l.status === 'empty' && l.is_enabled === true);
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

  // 16. إحصائيات عامة
  getStats() {
    const db = readLocalDB();
    const total = db.lockers.length;
    const confirmed = db.lockers.filter(l => l.status === 'confirmed').length;
    const pending = db.lockers.filter(l => l.status === 'pending').length;
    const empty = db.lockers.filter(l => l.status === 'empty' && l.is_enabled).length;
    const disabled = db.lockers.filter(l => !l.is_enabled).length;
    const waitlistCount = db.waitlist.filter(w => w.status === 'waiting').length;

    return {
      total,
      confirmed,
      pending,
      empty,
      disabled,
      waitlistCount,
      occupancyRate: total > 0 ? Math.round(((confirmed + pending) / total) * 100) : 0
    };
  }
};
