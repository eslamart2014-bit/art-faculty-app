import { supabaseAdmin } from '@/lib/supabase';

/**
 * تحديث آمن لجدول student_accounts يتحمل غياب بعض الأعمدة في قاعدة البيانات.
 * Supabase لا يرمي استثناء عند وجود عمود غير معروف (PGRST204) بل يعيد error،
 * لذلك نحذف العمود المفقود ونعيد المحاولة حتى ينجح التحديث بالأعمدة المتاحة فقط.
 */
export async function safeUpdateStudentAccounts(
  applyFilter: (q: any) => any,
  payload: Record<string, any>
): Promise<{ data: any[] | null; error: any }> {
  const p: Record<string, any> = { ...payload };
  for (let i = 0; i < 15; i++) {
    if (Object.keys(p).length === 0) return { data: null, error: null };
    const res = await applyFilter(supabaseAdmin.from('student_accounts').update(p)).select('*');
    if (!res.error) return { data: res.data, error: null };
    const m = /Could not find the '([^']+)' column/i.exec(res.error.message || '');
    if (m && m[1] in p) {
      delete p[m[1]];
      continue;
    }
    return { data: null, error: res.error };
  }
  return { data: null, error: { message: 'too many retries' } };
}

/** هل الحساب معتمد من أي مصدر (student_accounts أو telegram_browser_id) */
export function isAccountActivated(...sources: any[]): boolean {
  return sources.some(
    (a) => a && (a.status === 'active' || a.is_pin_used === true || !!a.activated_by || !!a.activated_at)
  );
}

export function parseTelegramBrowserId(raw: any): any {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}
