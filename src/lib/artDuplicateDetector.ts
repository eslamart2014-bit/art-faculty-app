import { compareDHashes } from './imageCompressor';

export interface ArtworkImage {
  url: string;
  dhash?: string;
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

export function auditArtworkDuplicates(submissions: StudentSubmissionItem[]): any[] {
  const matches: any[] = [];
  const processedPairs = new Set<string>();

  // تصنيف التسليمات إلى فئتين:
  // فئة 1: أعمال ذات صورة واحدة (لوحات ثنائية الأبعاد)
  // فئة 2: أعمال ذات صور متعددة (2 إلى 3 صور للمجسمات ثلاثية الأبعاد)
  const singleImageSubs = submissions.filter(s => (s.images || []).length <= 1);
  const multiImageSubs = submissions.filter(s => (s.images || []).length > 1);

  const compareGroup = (group: StudentSubmissionItem[], groupCategory: 'single' | 'multi') => {
    for (let i = 0; i < group.length; i++) {
      const subA = group[i];
      if (!subA.images || subA.images.length === 0) continue;

      for (let j = i + 1; j < group.length; j++) {
        const subB = group[j];
        if (!subB.images || subB.images.length === 0) continue;

        if (subA.student_code === subB.student_code) continue;

        const pairKey = [subA.id || subA.student_code, subB.id || subB.student_code].sort().join('_');
        if (processedPairs.has(pairKey)) continue;

        let highestSimilarity = 0;
        let matchedImgA = subA.images[0]?.url || '';
        let matchedImgB = subB.images[0]?.url || '';
        let reason = '';

        for (const imgA of subA.images) {
          for (const imgB of subB.images) {
            if (imgA.dhash && imgB.dhash) {
              const { similarityPercent } = compareDHashes(imgA.dhash, imgB.dhash);
              if (similarityPercent > highestSimilarity) {
                highestSimilarity = similarityPercent;
                matchedImgA = imgA.url;
                matchedImgB = imgB.url;
                reason = `تطابق بصمة بصرية (dHash) بنسبة ${similarityPercent}% [فئة: ${groupCategory === 'single' ? 'صورة واحدة' : 'مجسم متعدد اللقطات'}]`;
              }
            }

            if (imgA.url && imgB.url && imgA.url === imgB.url) {
              highestSimilarity = 100;
              matchedImgA = imgA.url;
              matchedImgB = imgB.url;
              reason = 'تطابق تام في رابط وملف الصورة المرفوعة';
              break;
            }
          }
          if (highestSimilarity === 100) break;
        }

        if (highestSimilarity >= 55) {
          let confidenceTier: 'confirmed' | 'high_suspicion' | 'possible' = 'possible';
          let tierLabel = '🔍 تشابه محتمل (55% - 69%)';

          if (highestSimilarity >= 85) {
            confidenceTier = 'confirmed';
            tierLabel = '🚨 تطابق مؤكد (85% - 100%)';
          } else if (highestSimilarity >= 70) {
            confidenceTier = 'high_suspicion';
            tierLabel = '⚠️ اشتباه مرتفع (70% - 84%)';
          }

          matches.push({
            id: 'match_' + (subA.id || i) + '_' + (subB.id || j),
            similarity: highestSimilarity,
            similarityPercent: highestSimilarity,
            project_name: subA.project_name || subB.project_name || 'مشروع فني',
            reason,
            confidenceTier,
            tierLabel,
            category: groupCategory,
            // تنسيق يدعم StudentPortalHubModal
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
            // وأيضاً التنسيق الأصلي studentA و studentB
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

          processedPairs.add(pairKey);
        }
      }
    }
  };

  // مقارنة فئة الأعمال ذات الصورة الواحدة مع بعضها
  compareGroup(singleImageSubs, 'single');

  // مقارنة فئة الأعمال ذات الصور المتعددة (2 و 3 صور) مع بعضها
  compareGroup(multiImageSubs, 'multi');

  return matches.sort((a, b) => b.similarity - a.similarity);
}
