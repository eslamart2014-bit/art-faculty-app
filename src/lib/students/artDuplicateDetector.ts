/**
 * محرك كشف تطابق اللوحات الفنية المتقدم — Art Vision Engine
 * ============================================================
 * يستخدم مطابقة النقاط المميزة (ORB) مع التحقق الهندسي (RANSAC Homography)
 * لكشف نفس اللوحة حتى لو صُوّرت بزوايا مختلفة أو إضاءة متغيرة أو مقاسات مختلفة.
 * يحتفظ بدعم البصمة القديمة (dHash) للتسليمات التي لا تحتوي على art_sig.
 */

import { compareDHashes } from '@/lib/students/imageCompressor';
import {
  unpackArtSignature,
  matchArtSignatures,
  retrieveCandidatePairs,
  type ArtSignature,
} from '@/lib/art-vision/engine';

export interface ArtworkImage {
  url: string;
  dhash?: string;
  art_sig?: string;
  width?: number;
  height?: number;
  orientation?: string;
}

export interface StudentSubmissionItem {
  id: string;
  student_code: string;
  student_name: string;
  course_id: string;
  course_name: string;
  project_name: string;
  images: ArtworkImage[];
  status: string;
  score?: number | null;
  created_at: string;
}

export interface PlagiarismMatch {
  id: string;
  studentA: {
    student_code: string;
    student_name: string;
    course_name: string;
    project_name: string;
    image_url: string;
    submitted_at: string;
  };
  studentB: {
    student_code: string;
    student_name: string;
    course_name: string;
    project_name: string;
    image_url: string;
    submitted_at: string;
  };
  similarityPercent: number;
  confidenceTier: 'confirmed' | 'high_suspicion' | 'possible';
  tierLabel: string;
  matchReason: string;
}

/** يقارن كل تسليمات الطلاب ويعيد حالات التطابق المشبوهة */
export function auditArtworkDuplicates(
  submissions: StudentSubmissionItem[],
  minThreshold: number = 80
): any[] {
  const matches: any[] = [];
  const processedPairs = new Set<string>();

  // -------- تجهيز البصمات --------
  interface SigEntry {
    subIdx: number;
    imgIdx: number;
    sig: ArtSignature | null;
    dhash: string;
    url: string;
  }

  // لكل تسليم نأخذ أفضل صورة (أعلى جودة بصمة)
  const entries: SigEntry[] = [];
  for (let si = 0; si < submissions.length; si++) {
    const sub = submissions[si];
    if (!sub.images || sub.images.length === 0) continue;
    for (let ii = 0; ii < sub.images.length; ii++) {
      const img = sub.images[ii];
      const sigStr = (img.art_sig || '').trim();
      const dhash = (img.dhash || '').replace(/^hash:/i, '').trim();
      const sig = sigStr ? unpackArtSignature(sigStr) : null;
      entries.push({
        subIdx: si,
        imgIdx: ii,
        sig,
        dhash,
        url: img.url || '',
      });
    }
  }

  // -------- استخراج البصمات المتقدمة لاستخدام الاسترجاع السريع --------
  const sigs: (ArtSignature | null)[] = entries.map((e) => e.sig);

  // -------- تحديد الأزواج المرشحة --------
  const allowPair = (i: number, j: number) => {
    const a = submissions[entries[i].subIdx];
    const b = submissions[entries[j].subIdx];
    return a.student_code !== b.student_code;
  };

  let candidatePairs: Array<[number, number]>;
  const hasAnySig = sigs.some((s) => s !== null);
  if (hasAnySig) {
    // استخدام فهرس الكلمات البصرية للبحث السريع
    const raw = retrieveCandidatePairs(sigs, { topK: 12, allowPair });
    candidatePairs = raw.map(([a, b]) => [a, b] as [number, number]);
    // أيضاً إضافة أزواج dHash القديمة التي لم تُغطَّ
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].sig) continue; // مُغطّى بالفعل
      for (let j = i + 1; j < entries.length; j++) {
        if (!allowPair(i, j)) continue;
        if (entries[i].dhash && entries[j].dhash) {
          candidatePairs.push([i, j]);
        }
      }
    }
  } else {
    // كل التسليمات قديمة — مقارنة dHash فقط (السلوك القديم)
    candidatePairs = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (!allowPair(i, j)) continue;
        candidatePairs.push([i, j]);
      }
    }
  }

  // -------- المقارنة الفعلية --------
  for (const [ei, ej] of candidatePairs) {
    const eA = entries[ei];
    const eB = entries[ej];
    const subA = submissions[eA.subIdx];
    const subB = submissions[eB.subIdx];
    const pairKey = [subA.id || eA.subIdx, subB.id || eB.subIdx, eA.imgIdx, eB.imgIdx].sort().join('_');
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    let highestSimilarity = 0;
    let reason = '';
    let method = '';

    // 1) مطابقة Art Vision الهندسية (إن وُجدت البصمات)
    if (eA.sig && eB.sig) {
      const result = matchArtSignatures(eA.sig, eB.sig);
      if (result.similarity > highestSimilarity) {
        highestSimilarity = result.similarity;
        const viewLabel =
          result.viewChange === 'strong'
            ? '(زاوية حادة)'
            : result.viewChange === 'mild'
            ? '(زاوية خفيفة)'
            : '';
        const rotLabel = result.rotated ? ' + دوران' : '';
        method = 'Art Vision';
        reason = `تطابق هندسي متقدم (ORB+RANSAC) بنسبة ${result.similarity}% — ` +
          `${result.inliers} نقطة تطابق من ${result.tentative} مرشحة، ` +
          `تغطية ${Math.round(result.coverage * 100)}% ${viewLabel}${rotLabel}`;
      }
    }

    // 2) مطابقة dHash الاحتياطية
    if (eA.dhash && eB.dhash) {
      const { similarityPercent } = compareDHashes(eA.dhash, eB.dhash);
      if (similarityPercent > highestSimilarity) {
        highestSimilarity = similarityPercent;
        method = 'dHash';
        reason = `تطابق بصمة بصرية (dHash) بنسبة ${similarityPercent}%`;
      }
    }

    // 3) تطابق تام في الرابط
    if (eA.url && eB.url && eA.url === eB.url) {
      highestSimilarity = 100;
      method = 'URL';
      reason = 'تطابق تام في رابط وملف الصورة المرفوعة (نفس الملف)';
    }

    if (highestSimilarity < minThreshold) continue;

    let confidenceTier: 'confirmed' | 'high_suspicion' | 'possible' = 'high_suspicion';
    let tierLabel = `⚠️ اشتباه مرتفع (${Math.max(minThreshold, 80)}% - 89%)`;

    if (highestSimilarity >= 90) {
      confidenceTier = 'confirmed';
      tierLabel = '🚨 تطابق مؤكد (90% - 100%)';
    } else if (highestSimilarity < 80) {
      confidenceTier = 'possible';
      tierLabel = `🔍 تشابه نسبي (${highestSimilarity}%)`;
    }

    const hammingDist = method === 'dHash'
      ? Math.round(64 * (1 - highestSimilarity / 100))
      : 0;

    const matchedImgA = eA.url;
    const matchedImgB = eB.url;

    matches.push({
      id: 'match_' + (subA.id || ei) + '_' + (subB.id || ej),
      similarity: highestSimilarity,
      similarityPercent: highestSimilarity,
      hammingDistance: hammingDist,
      project_name: subA.project_name || subB.project_name || 'مشروع فني',
      reason,
      method,
      confidenceTier,
      tierLabel,
      category: 'vision',
      image1Url: matchedImgA,
      image2Url: matchedImgB,
      student1Name: subA.student_name,
      student1Code: subA.student_code,
      student2Name: subB.student_name,
      student2Code: subB.student_code,
      course1Name: subA.course_name,
      course2Name: subB.course_name,
      project1Name: subA.project_name,
      project2Name: subB.project_name,
      submitted1At: subA.created_at,
      submitted2At: subB.created_at,
      student_a: {
        name: subA.student_name,
        code: subA.student_code,
        courseName: subA.course_name,
        imageUrl: matchedImgA,
      },
      student_b: {
        name: subB.student_name,
        code: subB.student_code,
        courseName: subB.course_name,
        imageUrl: matchedImgB,
      },
      studentA: {
        student_code: subA.student_code,
        student_name: subA.student_name,
        course_name: subA.course_name,
        project_name: subA.project_name,
        image_url: matchedImgA,
        submitted_at: subA.created_at,
      },
      studentB: {
        student_code: subB.student_code,
        student_name: subB.student_name,
        course_name: subB.course_name,
        project_name: subB.project_name,
        image_url: matchedImgB,
        submitted_at: subB.created_at,
      },
    });
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}
