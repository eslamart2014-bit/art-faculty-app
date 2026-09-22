import { NextResponse } from 'next/server';
import { lockerStore } from '@/lib/lockerStore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'grid';
  const letter = searchParams.get('letter') || 'ALL';
  const query = (searchParams.get('query') || '').trim().toLowerCase();

  try {
    await lockerStore.ensureLoaded();

    if (action === 'grid') {
      const lockers = lockerStore.getLockers(letter);
      const stats = lockerStore.getStats();
      const waitlist = lockerStore.getWaitlist();
      const bookings = lockerStore.getBookings();
      const ranges = lockerStore.getInventoryRanges();

      return NextResponse.json({
        success: true,
        lockers,
        stats,
        waitlist,
        bookings,
        ranges
      });
    }

    if (action === 'pending') {
      const pending = lockerStore.getBookings('pending');
      const waitlist = lockerStore.getWaitlist();
      return NextResponse.json({
        success: true,
        pending,
        waitlist
      });
    }

    if (action === 'confirmed') {
      const confirmed = lockerStore.getBookings('confirmed');
      return NextResponse.json({
        success: true,
        confirmed
      });
    }

    if (action === 'stats') {
      const stats = lockerStore.getStats();
      return NextResponse.json({
        success: true,
        stats
      });
    }

    if (action === 'search') {
      const allLockers = lockerStore.getLockers();
      const allBookings = lockerStore.getBookings();
      const waitlist = lockerStore.getWaitlist();

      const matchedBookings = allBookings.filter(b => 
        b.locker_code.toLowerCase().includes(query) ||
        b.representative_phone.includes(query) ||
        b.student_names.some(n => n.toLowerCase().includes(query)) ||
        b.student_codes.some(c => c.toLowerCase().includes(query))
      );

      const matchedLockers = allLockers.filter(l => 
        l.locker_code.toLowerCase().includes(query)
      );

      const matchedWaitlist = waitlist.filter(w => 
        w.representative_phone.includes(query) ||
        w.student_names.some(n => n.toLowerCase().includes(query)) ||
        w.student_codes.some(c => c.toLowerCase().includes(query))
      );

      return NextResponse.json({
        success: true,
        results: {
          bookings: matchedBookings,
          lockers: matchedLockers,
          waitlist: matchedWaitlist
        }
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في جلب بيانات الدواليب' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await lockerStore.ensureLoaded();
    const body = await request.json();
    const action = body.action;
    console.log('[Lockers POST]:', action, JSON.stringify(body).slice(0, 300));

    // 1. تأكيد حجز
    if (action === 'confirm') {
      const { bookingId, confirmedBy } = body;
      const ok = await lockerStore.confirmBooking(bookingId, confirmedBy || 'م/ إسلام عبداللطيف');
      if (!ok) return NextResponse.json({ error: 'تعذر العثور على الحجز' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'تم تأكيد الحجز بنجاح' });
    }

    // 2. رفض حجز
    if (action === 'reject') {
      const { bookingId, reason } = body;
      const ok = await lockerStore.rejectBooking(bookingId, reason);
      if (!ok) return NextResponse.json({ error: 'تعذر العثور على الحجز' }, { status: 404 });
      return NextResponse.json({ success: true, message: 'تم إلغاء الحجز وإخلاء الدولاب' });
    }

    // 3. إخلاء دولاب بالكامل
    if (action === 'vacate') {
      const { lockerCode } = body;
      const ok = await lockerStore.vacateLocker(lockerCode);
      if (!ok) return NextResponse.json({ error: 'تعذر العثور على الدولاب' }, { status: 404 });
      return NextResponse.json({ success: true, message: `تم إخلاء الدولاب ${lockerCode} بنجاح` });
    }

    // 4. إقصاء طالب محدد
    if (action === 'remove_student') {
      const { bookingId, studentCodeOrName } = body;
      const result = await lockerStore.removeStudentFromLocker(bookingId, studentCodeOrName);
      if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 });
      return NextResponse.json({ success: true, message: result.message, remaining: result.remaining });
    }

    // 5. تبديل متاح / معطل (الضغط المطول)
    if (action === 'toggle_enabled') {
      const { lockerCode } = body;
      const isEnabled = await lockerStore.toggleLockerEnabled(lockerCode);
      return NextResponse.json({ 
        success: true, 
        is_enabled: isEnabled,
        message: isEnabled ? `تم إتاحة الدولاب ${lockerCode} للحجز التلقائي` : `تم حجب الدولاب ${lockerCode} إدارياً`
      });
    }

    // 6. تعديل سعة الدولاب
    if (action === 'update_capacity') {
      const { lockerCode, capacity } = body;
      const ok = await lockerStore.updateLockerCapacity(lockerCode, parseInt(capacity, 10));
      if (!ok) return NextResponse.json({ error: 'تعذر العثور على الدولاب' }, { status: 404 });
      return NextResponse.json({ success: true, message: `تم تحديث سعة الدولاب ${lockerCode} إلى ${capacity} طلاب` });
    }

    // 7. تفريغ دفعة بالكامل
    if (action === 'clear_cohort') {
      const { cohort } = body;
      if (!cohort) return NextResponse.json({ error: 'يرجى تحديد الفرقة الدراسية' }, { status: 400 });
      const { clearedCount } = await lockerStore.clearCohort(cohort);
      return NextResponse.json({ success: true, message: `تم تفريغ عدد ${clearedCount} دواليب للفرقة ${cohort} بنجاح` });
    }

    // 8. تخصيص الدولاب للإدارة أو إلغاء التخصيص (الضغط المطول)
    if (action === 'set_admin_reserved') {
      const { lockerCode, reserved, notes } = body;
      if (!lockerCode) return NextResponse.json({ error: 'يرجى تحديد رمز الدولاب' }, { status: 400 });
      const res = await lockerStore.setAdminReserved(lockerCode, reserved !== false, notes);
      if (!res.success) return NextResponse.json({ error: res.message }, { status: 404 });
      return NextResponse.json({
        success: true,
        is_admin_reserved: res.is_admin_reserved,
        locker: res.locker,
        message: res.message
      });
    }

    // 9. تعديل نطاقات وأعداد دواليب الأقسام
    if (action === 'update_ranges') {
      const { ranges } = body;
      if (!ranges || typeof ranges !== 'object') {
        return NextResponse.json({ error: 'يرجى إرسال بيانات النطاقات بشكل صحيح' }, { status: 400 });
      }
      const res = await lockerStore.updateInventoryRanges(ranges);
      return NextResponse.json(res);
    }

    // 10. استيراد كشوفات التسكين بالجملة من جوجل شيت
    if (action === 'import_data') {
      const { rawData } = body;
      if (!rawData || typeof rawData !== 'string') {
        return NextResponse.json({ error: 'يرجى إدخال البيانات المنسوخة من الشيت' }, { status: 400 });
      }
      const res = await lockerStore.importBookings(rawData);
      return NextResponse.json({
        ...res,
        message: res.success
          ? `تم استيراد وتسكين ${res.importedCount} حجزاً بنجاح وحفظها سحابياً!`
          : (res.errors?.[0] || 'تعذر استيراد البيانات، تأكد من صحة التنسيق')
      });
    }

    // 11. تسكين طلاب يدوياً في دولاب محدد
    if (action === 'manual_assign') {
      const { lockerCode, cohort, phone, studentNames, studentCodes, notes, status } = body;
      if (!lockerCode || !studentNames || !Array.isArray(studentNames) || studentNames.filter(Boolean).length === 0) {
        return NextResponse.json({ error: 'يرجى إدخال كود الدولاب واسم طالب واحد على الأقل' }, { status: 400 });
      }
      const res = await lockerStore.manualAssignBooking({
        lockerCode,
        cohort: cohort || 'الفرقة الرابعة',
        phone: phone || '',
        studentNames: studentNames.filter(Boolean),
        studentCodes: studentCodes || [],
        notes,
        status: status || 'confirmed'
      });
      return NextResponse.json(res);
    }

    // 12. معاينة تفاعلية لبيانات الشيت قبل التسكين
    if (action === 'preview_data') {
      const { rawData } = body;
      if (!rawData || typeof rawData !== 'string') {
        return NextResponse.json({ error: 'يرجى إرسال البيانات للمعاينة' }, { status: 400 });
      }
      const res = lockerStore.parseRawDataToPreview(rawData);
      return NextResponse.json(res);
    }

    // 13. اعتماد وتسكين البيانات بعد المعاينة
    if (action === 'commit_preview') {
      const { rows, cleanBeforeSync } = body;
      if (!rows || !Array.isArray(rows)) {
        return NextResponse.json({ error: 'بيانات التسكين غير صالحة' }, { status: 400 });
      }
      const res = await lockerStore.commitParsedBookings(rows, { cleanBeforeSync: cleanBeforeSync === true });
      return NextResponse.json(res);
    }

    // 14. معاينة تفاعلية لكامل بيانات رابط جوجل شيت
    if (action === 'preview_sheet_url') {
      const { sheetUrl, mode, customTab } = body;
      if (!sheetUrl || typeof sheetUrl !== 'string') {
        return NextResponse.json({ error: 'يرجى إدخال رابط أو معرف Google Sheets' }, { status: 400 });
      }
      const res = await lockerStore.previewGoogleSheetUrl({
        sheetUrl,
        mode: mode || 'full',
        customTab
      });
      return NextResponse.json(res);
    }

    // 15. المزامنة المباشرة الذكية عبر رابط جوجل شيت
    if (action === 'sync_sheet_url') {
      const { sheetUrl, mode, customTab, cleanBeforeSync } = body;
      if (!sheetUrl || typeof sheetUrl !== 'string') {
        return NextResponse.json({ error: 'يرجى إدخال رابط أو معرف Google Sheets' }, { status: 400 });
      }
      const res = await lockerStore.syncFromGoogleSheetUrl({
        sheetUrl,
        mode: mode || 'full',
        customTab,
        cleanBeforeSync: cleanBeforeSync === true
      });
      return NextResponse.json(res);
    }

    // 16. مطابقة وربط الأكواد مع قاعدة بيانات الطلاب
    if (action === 'reconcile_students') {
      const res = await lockerStore.reconcileWithStudentsDB();
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'إجراء غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ في معالجة طلب الدواليب' }, { status: 500 });
  }
}
