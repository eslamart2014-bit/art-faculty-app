import { supabase } from "@/lib/supabase";

export const addToQueue = (type: string, payload: any) => {
  if (typeof window === 'undefined') return;
  const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
  queue.push({ id: Date.now().toString(), type, payload, timestamp: new Date().toISOString() });
  localStorage.setItem('offline_queue', JSON.stringify(queue));
  window.dispatchEvent(new Event('offlineQueueUpdated'));
};

export const getQueue = () => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('offline_queue') || '[]');
};

export const clearQueue = () => {
  localStorage.removeItem('offline_queue');
  window.dispatchEvent(new Event('offlineQueueUpdated'));
};

export const processQueue = async () => {
  if (typeof window === 'undefined' || !navigator.onLine) return { success: false, count: 0 };
  
  const queue = getQueue();
  if (queue.length === 0) return { success: true, count: 0 };

  let processedCount = 0;
  const newQueue = [...queue];

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    let success = false;
    
    try {
      if (action.type === 'BULK_ATTENDANCE') {
        const { course_id, date, presentIds, absentIds, teacher_id } = action.payload;
        if (absentIds.length > 0) {
          const { data: records } = await supabase.from("attendance").select("id, student_id").in("student_id", absentIds).eq("date", date).eq("course_id", course_id);
          if (records && records.length > 0) {
            for (const r of records) {
              await supabase.from("attendance").delete().eq("id", r.id);
            }
          }
        }
        if (presentIds.length > 0) {
          const { data: existingPresents } = await supabase.from("attendance").select("id, student_id, status").in("student_id", presentIds).eq("date", date).eq("course_id", course_id);
          for (const pid of presentIds) {
            const ex = existingPresents?.find(x => x.student_id === pid);
            if (ex) {
               if (ex.status !== 'حاضر') {
                 await supabase.from("attendance").update({ status: 'حاضر', created_at: action.timestamp }).eq("id", ex.id);
               }
            } else {
               await supabase.from("attendance").insert({ course_id, student_id: pid, date, status: 'حاضر', teacher_id, created_at: action.timestamp });
            }
          }
        }
        success = true;
      }
      else if (action.type === 'CAMERA_ATTENDANCE') {
        const { course_id, date, students, teacher_id } = action.payload;
        for (const s of students) {
          const { data: ex } = await supabase.from("attendance").select("id, status").eq("course_id", course_id).eq("student_id", s.id).eq("date", date).maybeSingle();
          if (ex) {
            if (ex.status !== 'حاضر') {
              await supabase.from("attendance").update({ status: 'حاضر', created_at: action.timestamp }).eq("id", ex.id);
            }
          } else {
            await supabase.from("attendance").insert({ course_id, student_id: s.id, date, status: 'حاضر', teacher_id, created_at: action.timestamp });
          }
        }
        success = true;
      }
      else if (action.type === 'MANUAL_EVALUATION') {
        const { course_id, student_id, project_name, score, max_score, teacher_id } = action.payload;
        const { data: ex } = await supabase.from("evaluations").select("id, score").eq("course_id", course_id).eq("student_id", student_id).eq("project_name", project_name).maybeSingle();
        if (ex) {
          if (ex.score !== score) {
            await supabase.from("evaluations").update({ score, created_at: action.timestamp }).eq("id", ex.id);
          }
        } else {
          await supabase.from("evaluations").insert({ course_id, student_id, project_name, score, max_score, teacher_id, created_at: action.timestamp });
        }
        success = true;
      }
      else if (action.type === 'CAMERA_EVALUATION') {
        const { course_id, project_name, max_score, teacher_id, students, markAttendance, date } = action.payload;
        for (const s of students) {
          const { data: ex } = await supabase.from("evaluations").select("id, score").eq("course_id", course_id).eq("student_id", s.id).eq("project_name", project_name).maybeSingle();
          if (ex) {
            if (ex.score !== s.score) await supabase.from("evaluations").update({ score: s.score, created_at: action.timestamp }).eq("id", ex.id);
          } else {
            await supabase.from("evaluations").insert({ course_id, student_id: s.id, project_name, score: s.score, max_score, teacher_id, created_at: action.timestamp });
          }
          if (markAttendance) {
            const { data: attEx } = await supabase.from("attendance").select("id, status").eq("course_id", course_id).eq("student_id", s.id).eq("date", date).maybeSingle();
            if (attEx) {
              if (attEx.status !== 'حاضر') await supabase.from("attendance").update({ status: 'حاضر', created_at: action.timestamp }).eq("id", attEx.id);
            } else {
              await supabase.from("attendance").insert({ course_id, student_id: s.id, date, status: 'حاضر', teacher_id, created_at: action.timestamp });
            }
          }
        }
        success = true;
      }
    } catch (err) {
      console.error("Sync Error:", err);
    }
    
    if (success) {
      action.done = true;
      processedCount++;
    }
  }

  const pendingQueue = newQueue.filter(a => !a.done);
  localStorage.setItem('offline_queue', JSON.stringify(pendingQueue));
  window.dispatchEvent(new Event('offlineQueueUpdated'));
  
  return { success: true, count: processedCount };
};
