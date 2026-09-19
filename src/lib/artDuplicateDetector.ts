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

export function auditArtworkDuplicates(submissions: StudentSubmissionItem[]): PlagiarismMatch[] {
  const matches: PlagiarismMatch[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < submissions.length; i++) {
    const subA = submissions[i];
    if (!subA.images || subA.images.length === 0) continue;

    for (let j = i + 1; j < submissions.length; j++) {
      const subB = submissions[j];
      if (!subB.images || subB.images.length === 0) continue;

      if (subA.student_code === subB.student_code) continue;

      const pairKey = [subA.id, subB.id].sort().join('_');
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
              reason = 'تطابق في بصمة العمل الفني (dHash) بنسبة ' + similarityPercent + '%';
            }
          }

          if (imgA.url && imgB.url && imgA.url === imgB.url) {
            highestSimilarity = 100;
            matchedImgA = imgA.url;
            matchedImgB = imgB.url;
            reason = 'تطابق تام في رابط وملف الصورة';
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
          id: 'match_' + subA.id + '_' + subB.id,
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
          similarityPercent: highestSimilarity,
          confidenceTier,
          tierLabel,
          matchReason: reason,
        });

        processedPairs.add(pairKey);
      }
    }
  }

  return matches.sort((a, b) => b.similarityPercent - a.similarityPercent);
}
