import { supabase } from "@/lib/supabase";

export async function getSystemTerms() {
  const { data } = await supabase
    .from("system_settings")
    .select("term1_start, term2_start, term1_end, term2_end")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

const parseDateOnly = (dStr: string | null) => {
  if (!dStr) return null;
  const parts = dStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0);
};

export async function getTermAndWeekInfo(targetDateInput?: string | Date) {
  const data = await getSystemTerms();
  if (!data) return "";

  const now = targetDateInput ? new Date(targetDateInput) : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const t1s = parseDateOnly(data.term1_start);
  const t1e = parseDateOnly(data.term1_end);
  const t2s = parseDateOnly(data.term2_start);
  const t2e = parseDateOnly(data.term2_end);

  // MED-5 FIX: Extended to 30 weeks to cover any realistic semester length
  const arabicNumbers = [
    "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن",
    "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر",
    "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون",
    "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون",
    "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون",
    "التاسع والعشرون", "الثلاثون"
  ];

  if (t2s && today >= t2s) {
    if (t2e && today > t2e) return "انتهى الترم الثاني";
    const diffDays = Math.floor((today.getTime() - t2s.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return `الأسبوع ${arabicNumbers[weekNumber - 1] || weekNumber} من الترم الثاني`;
  } else if (t1e && today > t1e) {
    return "لم يبدأ الترم الثاني بعد";
  } else if (t1s) {
    if (today < t1s) return "لم يبدأ الترم الأول بعد";
    const diffDays = Math.floor((today.getTime() - t1s.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return `الأسبوع ${arabicNumbers[weekNumber - 1] || weekNumber} من الترم الأول`;
  }

  return "";
}
