import { supabase } from "@/lib/supabase";

export async function getSystemTerms() {
  const { data } = await supabase.from("system_settings").select("term1_start, term2_start, term1_end, term2_end").eq("id", 1).maybeSingle();
  return data;
}

export async function getTermAndWeekInfo(targetDateStr: string = new Date().toISOString()) {
  const targetDate = new Date(targetDateStr);
  const data = await getSystemTerms();
  if (!data) return "";

  const term1 = data.term1_start ? new Date(data.term1_start) : null;
  const term1End = data.term1_end ? new Date(data.term1_end) : null;
  const term2 = data.term2_start ? new Date(data.term2_start) : null;
  const term2End = data.term2_end ? new Date(data.term2_end) : null;

  let activeTermStart = null;
  let termName = "";

  if (term2 && targetDate >= term2) {
    if (term2End && targetDate > term2End) return "انتهى الترم الثاني";
    activeTermStart = term2;
    termName = "الترم الثاني";
  } else if (term1 && targetDate >= term1) {
    if (term1End && targetDate > term1End) return "انتهى الترم الأول";
    activeTermStart = term1;
    termName = "الترم الأول";
  } else {
    return "لم يبدأ الترم بعد";
  }

  const diffTime = Math.abs(targetDate.getTime() - activeTermStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil((diffDays + 1) / 7);

  const arabicNumbers = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر"];
  
  return `الأسبوع ${arabicNumbers[weekNumber - 1] || weekNumber} من ${termName}`;
}
