import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function parseDeviceName(userAgent: string): string {
  if (!userAgent) return 'جهاز غير معروف';
  const ua = userAgent.toLowerCase();

  if (ua.includes('iphone')) {
    if (ua.includes('iphone os 17') || ua.includes('iphone os 18')) return 'Apple iPhone (حديث)';
    return 'Apple iPhone';
  }
  if (ua.includes('ipad')) return 'Apple iPad';
  if (ua.includes('samsung') || ua.includes('sm-')) return 'Samsung Galaxy';
  if (ua.includes('redmi') || ua.includes('xiaomi')) return 'Xiaomi / Redmi';
  if (ua.includes('oppo')) return 'Oppo Mobile';
  if (ua.includes('vivo')) return 'Vivo Mobile';
  if (ua.includes('realme')) return 'Realme Mobile';
  if (ua.includes('huawei') || ua.includes('honor')) return 'Huawei / Honor';
  if (ua.includes('android')) return 'هاتف أندرويد (Android Phone)';
  if (ua.includes('windows')) return 'كمبيوتر مكتبي (Windows PC)';
  if (ua.includes('macintosh')) return 'كمبيوتر مكتبي (Apple Mac)';

  return 'متصفح / هاتف ذكي';
}

export async function GET() {
  try {
    // 1. جلب الطلاب المسجلين وحساباتهم
    const { data: students, error: stErr } = await supabaseAdmin
      .from('students')
      .select('id, full_name, student_code, academic_year, section, telegram_browser_id')
      .not('telegram_browser_id', 'is', null);

    if (stErr) {
      return NextResponse.json({ error: stErr.message }, { status: 500 });
    }

    // تجميع الحسابات حسب معرّف الجهاز (deviceId)
    const deviceMap = new Map<string, {
      deviceId: string;
      phoneModel: string;
      userAgent: string;
      screen: string;
      accounts: Array<{
        student_id: string;
        student_code: string;
        full_name: string;
        academic_year: string;
        mobile?: string;
        status: string;
        is_pin_used: boolean;
        firstSeen: string;
        lastSeen: string;
      }>;
    }>();

    (students || []).forEach((st: any) => {
      let acc: any = null;
      try {
        if (st.telegram_browser_id) acc = JSON.parse(st.telegram_browser_id);
      } catch (e) {}

      if (!acc) return;

      const devices = Array.isArray(acc.devices) && acc.devices.length > 0
        ? acc.devices
        : [{
            deviceId: 'dev_' + (st.student_code || st.id),
            userAgent: 'unknown',
            firstSeen: acc.last_login_at || st.created_at,
            lastSeen: acc.last_login_at || st.created_at
          }];

      devices.forEach((dev: any) => {
        const dId = dev.deviceId || 'unknown_device';
        if (dId === 'unknown') return;

        if (!deviceMap.has(dId)) {
          deviceMap.set(dId, {
            deviceId: dId,
            phoneModel: parseDeviceName(dev.userAgent || ''),
            userAgent: dev.userAgent || '',
            screen: dev.screen || 'غير محدد',
            accounts: []
          });
        }

        const entry = deviceMap.get(dId)!;
        if (!entry.accounts.some(a => a.student_code === st.student_code)) {
          entry.accounts.push({
            student_id: st.id,
            student_code: st.student_code,
            full_name: st.full_name,
            academic_year: st.academic_year,
            mobile: acc.mobile,
            status: acc.status || 'active',
            is_pin_used: !!acc.is_pin_used,
            firstSeen: dev.firstSeen || acc.last_login_at,
            lastSeen: dev.lastSeen || acc.last_login_at,
          });
        }
      });
    });

    // فلترة الأجهزة المشتركة بضوابط الشك الذكية:
    // الجهاز يُعتبر مشبوهاً إذا:
    //   - سُجّل عليه 5 حسابات طلاب أو أكثر (في أي وقت)، أو
    //   - سُجّل عليه 3 حسابات أو أكثر ضمن نافذة 72 ساعة
    const SUSPICIOUS_MIN_TOTAL = 5;
    const SUSPICIOUS_MIN_WINDOW = 3;
    const SUSPICIOUS_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 ساعة

    const fraudDevices: any[] = [];
    const cleanDevices: any[] = [];

    deviceMap.forEach((val) => {
      // ترتيب الحسابات تصاعدياً حسب أول تاريخ ظهور / تسجيل على الجهاز
      val.accounts.sort((a, b) => new Date(a.firstSeen || 0).getTime() - new Date(b.firstSeen || 0).getTime());

      // تمييز الحساب الأول زمنيّاً كصاحب الجهاز الأصلي
      if (val.accounts.length > 0) {
        (val.accounts[0] as any).isPrimaryOwner = true;
        for (let i = 1; i < val.accounts.length; i++) {
          (val.accounts[i] as any).isPrimaryOwner = false;
        }
      }

      const count = val.accounts.length;

      // ✅ تطبيق ضوابط الشك الذكية
      let isSuspicious = false;
      let suspicionReason = '';

      // الحالة 1: 5 حسابات أو أكثر في أي وقت
      if (count >= SUSPICIOUS_MIN_TOTAL) {
        isSuspicious = true;
        suspicionReason = `${count} حسابات مسجلة على نفس الجهاز`;
      }

      // الحالة 2: 3 حسابات أو أكثر خلال 72 ساعة
      if (!isSuspicious && count >= SUSPICIOUS_MIN_WINDOW) {
        for (let i = 0; i <= val.accounts.length - SUSPICIOUS_MIN_WINDOW; i++) {
          const windowStart = new Date(val.accounts[i].firstSeen || 0).getTime();
          const windowEnd = windowStart + SUSPICIOUS_WINDOW_MS;
          let countInWindow = 0;
          for (const acc of val.accounts) {
            const t = new Date(acc.firstSeen || 0).getTime();
            if (t >= windowStart && t <= windowEnd) countInWindow++;
          }
          if (countInWindow >= SUSPICIOUS_MIN_WINDOW) {
            isSuspicious = true;
            suspicionReason = `${countInWindow} حسابات خلال 72 ساعة`;
            break;
          }
        }
      }

      if (isSuspicious) {
        fraudDevices.push({
          ...val,
          suspicionReason,
          primaryAccount: val.accounts[0],
          secondaryAccounts: val.accounts.slice(1)
        });
      } else {
        cleanDevices.push(val);
      }
    });

    // فرز تنازلي حسب عدد الحسابات المشتركة
    fraudDevices.sort((a, b) => b.accounts.length - a.accounts.length);

    return NextResponse.json({
      success: true,
      totalRegisteredDevices: deviceMap.size,
      fraudIncidentsCount: fraudDevices.length,
      fraudDevices,
    });
  } catch (err: any) {
    console.error('Fraud detection error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
