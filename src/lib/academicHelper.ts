/**
 * مساعد معالجة وتنسيق الرتب والدرجات العلمية الأكاديمية الرسمية
 */

export function getDegreePrefix(degree: string = '', role: string = ''): string {
  const d = (degree || '').trim();
  const cleanD = d.replace(/[.\s_\-\/]/g, '').toLowerCase();

  // 1. أستاذ دكتور (أ.د) - Professor
  if (
    cleanD === 'أد' || cleanD === 'اد' ||
    d.includes('أستاذ دكتور') || d.includes('استاذ دكتور') ||
    d.includes('أ.د') || d.includes('ا.د')
  ) {
    return 'أ.د/ ';
  }

  // 2. أستاذ مساعد دكتور (أ.م.د) - Associate Professor
  if (
    cleanD === 'أمد' || cleanD === 'آمد' || cleanD === 'امد' ||
    d.includes('أستاذ مساعد') || d.includes('استاذ مساعد') ||
    d.includes('أ.م.د') || d.includes('ا.م.د')
  ) {
    return 'أ.م.د/ ';
  }

  // 3. مدرس دكتور / دكتور (دكتوراه) - Lecturer / PhD Doctor
  // "م.د" في الجامعات المصرية اختصار لـ "مدرس دكتور" ويُلقب رسمياً بـ "د/"
  if (
    cleanD === 'مد' || cleanD === 'د' ||
    d === 'م.د' || d === 'م. د' || d === 'م.د.' ||
    d.includes('دكتور') || d === 'د' || d === 'د.' ||
    d.includes('مدرس دكتور') || (d.includes('مدرس') && !d.includes('مساعد'))
  ) {
    return 'د/ ';
  }

  // 4. مدرس مساعد (ماجستير) - Assistant Lecturer
  if (
    cleanD === 'مم' ||
    d === 'م.م' || d === 'م. م' || d === 'م.م.' ||
    d.includes('مدرس مساعد')
  ) {
    return 'م.م/ ';
  }

  // 5. معيد (بكالوريوس) - Teaching Assistant
  if (
    cleanD === 'م' ||
    d === 'م' || d === 'م.' ||
    d.includes('معيد') || d.includes('مهندس')
  ) {
    return 'م/ ';
  }

  // 6. أستاذ
  if (d.includes('أستاذ') || d.includes('استاذ')) {
    return 'أ/ ';
  }

  if (d) {
    return `${d}/ `;
  }

  return 'أ/ ';
}

export function formatInstructorTitle(profile: any): string {
  if (!profile) return 'أستاذ المقرر';
  const name = (profile.full_name || '').trim();
  const degree = (profile.degree || '').trim();
  const role = (profile.role || '').trim();

  // If already starts with title prefix
  if (/^(د\/|د\.|أ\.د\/|أ\.د\.|م\/|م\.|م\.م\/|م\.م\.|أ\.م\.د\/|أ\.م\.د\.|أ\/)/.test(name)) {
    return name;
  }

  const prefix = getDegreePrefix(degree, role);
  return `${prefix}${name}`.trim();
}

/**
 * تحويل وتوحيد أي صيغة للدرجة العلمية إلى القيم المعتمدة في قاعدة البيانات
 * Postgres academic_degree enum: 'د' | 'م' | 'م.د' | 'أ.م.د' | 'أ.د'
 */
export function normalizeAcademicDegree(deg?: string | null): 'د' | 'م' | 'م.د' | 'أ.م.د' | 'أ.د' {
  if (!deg) return 'د';
  const d = deg.trim();
  const cleanD = d.replace(/[.\s_\-\/()]/g, '').toLowerCase();

  // 1. أستاذ دكتور (أ.د)
  if (
    cleanD === 'أد' || cleanD === 'اد' ||
    d.includes('أستاذ دكتور') || d.includes('استاذ دكتور') ||
    d.includes('أ.د') || d.includes('ا.د') ||
    cleanD === 'أ' || d === 'أستاذ'
  ) {
    return 'أ.د';
  }

  // 2. أستاذ مساعد (أ.م.د)
  if (
    cleanD === 'أمد' || cleanD === 'آمد' || cleanD === 'امد' ||
    d.includes('أستاذ مساعد') || d.includes('استاذ مساعد') ||
    d.includes('أ.م.د') || d.includes('ا.م.د')
  ) {
    return 'أ.م.د';
  }

  // 3. مدرس مساعد (م.د أو م.م)
  if (
    cleanD === 'مم' || d.includes('مساعد') || d === 'م.م' || d === 'م.د'
  ) {
    return 'م.د';
  }

  // 4. مدرس دكتور / دكتور (د)
  if (
    cleanD === 'د' || cleanD === 'دكتور' || cleanD === 'مدرس' ||
    d.includes('دكتور') || d === 'د' || d === 'د.' ||
    d.includes('مدرس')
  ) {
    return 'د';
  }

  // 5. معيد (م)
  if (
    cleanD === 'م' || d === 'م' || d === 'م.' ||
    d.includes('معيد') || d.includes('مهندس')
  ) {
    return 'م';
  }

  // Exact match
  if (d === 'د' || d === 'م' || d === 'م.د' || d === 'أ.م.د' || d === 'أ.د') {
    return d as any;
  }

  return 'د';
}
