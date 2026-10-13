/**
 * مساعد إدارة علامات وتصنيفات الطلاب
 * (طالب متميز ⭐ / طالب غير ملتزم ⚠️ / تخلفات 🔄)
 * تدعم التخزين المحلي الفوري (LocalStorage) والمزامنة مع قاعدة البيانات Supabase
 */

import { supabase } from "@/lib/supabase";

export type StudentTagType = "distinguished" | "uncommitted" | null;

export interface StudentTagInfo {
  tag: StudentTagType;
  note?: string;
  updated_at?: string;
}

// قراءة التصنيف للطالب (محلياً أو من بيانات الطالب)
export function getStudentTag(student: any, teacherId?: string): StudentTagType {
  if (!student) return null;
  const sId = student.id || student.student_code;

  // 1. فحص التخزين المحلي الفوري
  if (typeof window !== "undefined") {
    try {
      const localTags = JSON.parse(localStorage.getItem("fania_student_tags") || "{}");
      if (localTags[sId]) {
        return localTags[sId].tag || null;
      }
    } catch (e) {}
  }

  // 2. فحص بيانات الطالب من قاعدة البيانات (telegram_browser_id أو student_tags)
  if (student.telegram_browser_id) {
    try {
      const meta = typeof student.telegram_browser_id === "string" 
        ? JSON.parse(student.telegram_browser_id) 
        : student.telegram_browser_id;
      if (meta?.student_tag?.tag) {
        return meta.student_tag.tag;
      }
      if (teacherId && meta?.teacher_tags?.[teacherId]?.tag) {
        return meta.teacher_tags[teacherId].tag;
      }
    } catch (e) {}
  }

  return null;
}

// حفظ التصنيف للطالب وتحديث السيرفر والتخزين المحلي
export async function setStudentTag(student: any, tag: StudentTagType, teacherId?: string): Promise<boolean> {
  if (!student) return false;
  const sId = student.id || student.student_code;

  // 1. تحديث التخزين المحلي فوراً (0ms)
  if (typeof window !== "undefined") {
    try {
      const localTags = JSON.parse(localStorage.getItem("fania_student_tags") || "{}");
      if (tag) {
        localTags[sId] = { tag, updated_at: new Date().toISOString() };
      } else {
        delete localTags[sId];
      }
      localStorage.setItem("fania_student_tags", JSON.stringify(localTags));
      window.dispatchEvent(new CustomEvent("student_tags_updated", { detail: { studentId: sId, tag } }));
    } catch (e) {}
  }

  // 2. مزامنة التحديث مع Supabase في حقل telegram_browser_id كـ metadata آمن
  try {
    let currentMeta: any = {};
    if (student.telegram_browser_id) {
      try {
        currentMeta = typeof student.telegram_browser_id === "string" 
          ? JSON.parse(student.telegram_browser_id) 
          : student.telegram_browser_id;
      } catch (e) {}
    }

    currentMeta.student_tag = tag ? { tag, updated_at: new Date().toISOString() } : null;
    if (teacherId) {
      if (!currentMeta.teacher_tags) currentMeta.teacher_tags = {};
      if (tag) {
        currentMeta.teacher_tags[teacherId] = { tag, updated_at: new Date().toISOString() };
      } else {
        delete currentMeta.teacher_tags[teacherId];
      }
    }

    const { error } = await supabase
      .from("students")
      .update({ telegram_browser_id: JSON.stringify(currentMeta) })
      .eq("id", student.id);

    return !error;
  } catch (err) {
    console.warn("Failed to sync student tag to server:", err);
    return true; // يعتبر ناجحاً محلياً
  }
}
