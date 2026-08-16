import { supabase } from "@/lib/supabase";

export async function getTermAndWeekInfo(targetDateStr: string = new Date().toISOString()) {
  const targetDate = new Date(targetDateStr);
  
  const { data } = await supabase.from("system_settings").select("term1_start, term2_start").eq("id", 1).maybeSingle();
  
  if (!data) return "";

  const term1 = data.term1_start ? new Date(data.term1_start) : null;
  const term2 = data.term2_start ? new Date(data.term2_start) : null;

  let activeTermStart = null;
  let termName = "";

  // Determine which term we are in
  if (term2 && targetDate >= term2) {
    activeTermStart = term2;
    termName = "الترم الثاني";
  } else if (term1 && targetDate >= term1) {
    activeTermStart = term1;
    termName = "الترم الأول";
  } else {
    return ""; // Before term 1
  }

  // Calculate week number
  const diffTime = Math.abs(targetDate.getTime() - activeTermStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.ceil((diffDays + 1) / 7);

  return `(${termName} - الأسبوع ${weekNumber})`;
}
