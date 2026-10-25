import { normalizeAcademicYear } from './codeHelper';

function normalizeArabic(str: string = ''): string {
  return str
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isStudentEnrolledInCourse(course: any, student: any): boolean {
  if (!course || !student) return false;

  if (Array.isArray(course.excluded_students) && course.excluded_students.includes(student.id)) {
    return false;
  }

  if (
    Array.isArray(course.makeup_students) &&
    (course.makeup_students.includes(student.id) || course.makeup_students.includes(student.student_code))
  ) {
    return true;
  }

  const courseYear = normalizeAcademicYear(String(course.academic_year || ''));
  const studentYear = normalizeAcademicYear(String(student.academic_year || ''));
  if (courseYear && studentYear && courseYear !== studentYear) {
    const rawCourse = normalizeArabic(String(course.academic_year || ''));
    const rawStudent = normalizeArabic(String(student.academic_year || ''));
    if (!(rawCourse.includes(rawStudent) || rawStudent.includes(rawCourse))) return false;
  }

  if (Array.isArray(course.sections) && course.sections.length > 0) {
    const override = course.student_section_overrides?.[student.id];
    const effective = normalizeArabic(String(override || student.section || ''));
    const allowed = course.sections.some((sec: string) => {
      const norm = normalizeArabic(String(sec));
      return norm === 'عام' || norm === 'الكل' || norm === 'جميع السكاشن' || norm === effective;
    });
    if (!allowed) return false;
  }

  return true;
}
