import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TelegramSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [botData, setBotData] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Privacy & Feature flags for students
  const [showProjectScores, setShowProjectScores] = useState<boolean>(true);
  const [showStudentAttendance, setShowStudentAttendance] = useState<boolean>(true);
  const [savingPermissions, setSavingPermissions] = useState<boolean>(false);

  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'get_token' })
      });
      const result = await res.json();
      if (result.success && result.data) {
        setBotData(result.data);
        if (result.data.show_project_scores_to_students !== undefined) {
          setShowProjectScores(result.data.show_project_scores_to_students);
        }
        if (result.data.show_attendance_to_students !== undefined) {
          setShowStudentAttendance(result.data.show_attendance_to_students);
        }
      }
    } catch (err) {
      console.error('Failed to fetch bot settings:', err);
    }
    setLoading(false);
  };

  const handleLinkBot = async () => {
    if (!tokenInput.trim()) {
      setError('يرجى إدخال التوكن أولاً.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ action: 'save_token', botToken: tokenInput.trim() })
      });
      
      const result = await res.json();
      if (result.success) {
        alert('تم ربط البوت وتفعيل الويب هوك بنجاح! ✅');
        fetchToken();
      } else {
        setError(result.error || 'حدث خطأ أثناء الربط.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال.');
    }
    setLoading(false);
  };

  const handleSavePermissions = async (scoresFlag: boolean, attendanceFlag: boolean) => {
    setSavingPermissions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          action: 'save_student_permissions',
          showProjectScores: scoresFlag,
          showStudentAttendance: attendanceFlag
        })
      });
      const result = await res.json();
      if (result.success) {
        setShowProjectScores(scoresFlag);
        setShowStudentAttendance(attendanceFlag);
      } else {
        alert('حدث خطأ أثناء حفظ الإعدادات.');
      }
    } catch (err) {
      console.error('Save permissions error:', err);
      alert('تعذر حفظ الإعدادات.');
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading && !botData && !tokenInput) {
    return <div style={{ color: "#aaa", textAlign: "center", padding: "20px" }}>جاري التحميل...</div>;
  }

  return (
    <div style={{ direction: 'rtl' }}>
      <h2 style={{ color: "#fff", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span>🤖</span> إعدادات البوت والتحكم في صلاحيات الطلاب
      </h2>

      {error && (
        <div style={{ background: "#f44336", color: "#fff", padding: "10px", borderRadius: "5px", marginBottom: "15px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* STUDENT VISIBILITY & PERMISSIONS SECTION */}
      <div style={{ background: "#1a1a1a", padding: "20px", borderRadius: "12px", border: "1px solid #333", marginBottom: "25px" }}>
        <h3 style={{ margin: "0 0 15px 0", color: "#FF9800", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🔒</span> تحكم المدير في البيانات الظاهرة للطلاب عبر البوت:
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Toggle 1: Show Project Scores */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#222", padding: "14px 18px", borderRadius: "10px", border: "1px solid #444" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                ⭐️ إظهار درجات المشاريع للطلاب في معرض الأعمال
              </div>
              <div style={{ color: "#888", fontSize: "12px" }}>
                {showProjectScores 
                  ? "✅ مفعّل: يرى الطالب درجة تقييمه الرقمية (مثلاً: 28/30)."
                  : "❌ معطّل: يرى الطالب فقط (تم التقييم بنجاح) دون كشف الدرجة."}
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: "50px", height: "26px", flexShrink: 0 }}>
              <input 
                type="checkbox" 
                checked={showProjectScores} 
                onChange={(e) => handleSavePermissions(e.target.checked, showStudentAttendance)}
                disabled={savingPermissions}
                style={{ opacity: 0, width: 0, height: 0 }} 
              />
              <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: showProjectScores ? "#4CAF50" : "#555", borderRadius: "26px", transition: "0.3s" }}>
                <span style={{ position: "absolute", content: '""', height: "20px", width: "20px", left: "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s", transform: showProjectScores ? "translateX(24px)" : "none" }}></span>
              </span>
            </label>
          </div>

          {/* Toggle 2: Show Attendance Stats */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#222", padding: "14px 18px", borderRadius: "10px", border: "1px solid #444" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                📅 إتاحة استعلام الطالب عن سجل الحضور والغياب
              </div>
              <div style={{ color: "#888", fontSize: "12px" }}>
                {showStudentAttendance 
                  ? "✅ مفعّل: يمكن للطلاب الاستعلام عن عدد مرات حضورهم وغيابهم في كل مقرر."
                  : "❌ معطّل: خاصية الاستعلام محجوبة عن جميع الطلاب."}
              </div>
            </div>
            <label style={{ position: "relative", display: "inline-block", width: "50px", height: "26px", flexShrink: 0 }}>
              <input 
                type="checkbox" 
                checked={showStudentAttendance} 
                onChange={(e) => handleSavePermissions(showProjectScores, e.target.checked)}
                disabled={savingPermissions}
                style={{ opacity: 0, width: 0, height: 0 }} 
              />
              <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: showStudentAttendance ? "#4CAF50" : "#555", borderRadius: "26px", transition: "0.3s" }}>
                <span style={{ position: "absolute", content: '""', height: "20px", width: "20px", left: "3px", bottom: "3px", backgroundColor: "white", borderRadius: "50%", transition: "0.3s", transform: showStudentAttendance ? "translateX(24px)" : "none" }}></span>
              </span>
            </label>
          </div>

        </div>
      </div>

      {/* BOT LINKING DETAILS */}
      {botData ? (
        <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #4CAF50" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
            <div style={{ width: "60px", height: "60px", background: "#4CAF50", borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "30px" }}>
              ✅
            </div>
            <div>
              <h3 style={{ margin: "0 0 5px 0", color: "#fff" }}>تم الربط بنجاح!</h3>
              <div style={{ color: "#aaa", fontSize: "14px" }}>{botData.botInfo.first_name} (@{botData.botInfo.username})</div>
            </div>
          </div>

          <div style={{ background: "#111", padding: "15px", borderRadius: "8px", border: "1px dashed #555", marginBottom: "20px" }}>
            <strong style={{ color: "#2196F3", display: "block", marginBottom: "10px" }}>🔗 روابط الدخول السريعة:</strong>
            
            <div style={{ marginBottom: "15px" }}>
              <div style={{ fontSize: "13px", color: "#888", marginBottom: "5px" }}>رابط دخول الزملاء (المعلمين):</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input 
                  type="text" 
                  readOnly 
                  value={`https://t.me/${botData.botInfo.username}?start=staff`} 
                  style={{ flex: 1, padding: "8px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: "5px", direction: "ltr" }}
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(`https://t.me/${botData.botInfo.username}?start=staff`)}
                  style={{ background: "#2196F3", color: "#fff", border: "none", padding: "0 15px", borderRadius: "5px", cursor: "pointer" }}
                >نسخ</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: "13px", color: "#888", marginBottom: "5px" }}>رابط دخول الطلاب (البوابة):</div>
              <div style={{ display: "flex", gap: "10px" }}>
                <input 
                  type="text" 
                  readOnly 
                  value={`https://t.me/${botData.botInfo.username}?start=student`} 
                  style={{ flex: 1, padding: "8px", background: "#222", color: "#fff", border: "1px solid #444", borderRadius: "5px", direction: "ltr" }}
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(`https://t.me/${botData.botInfo.username}?start=student`)}
                  style={{ background: "#2196F3", color: "#fff", border: "none", padding: "0 15px", borderRadius: "5px", cursor: "pointer" }}
                >نسخ</button>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              if (confirm("هل أنت متأكد من مسح بيانات الربط؟ سيتوقف البوت عن العمل.")) {
                setBotData(null);
                setTokenInput('');
              }
            }}
            style={{ width: "100%", padding: "10px", background: "transparent", color: "#f44336", border: "1px solid #f44336", borderRadius: "5px", cursor: "pointer" }}
          >
            إلغاء الربط وإدخال توكن جديد
          </button>
        </div>
      ) : (
        <div style={{ background: "#222", padding: "20px", borderRadius: "10px", border: "1px solid #444" }}>
          <p style={{ color: "#aaa", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
            قم بإنشاء بوت جديد عبر <strong>@BotFather</strong> في تليجرام، ثم انسخ المفتاح السري (Token) الخاص بالبوت وضعه هنا لربط النظام بتليجرام أوتوماتيكياً.
          </p>
          
          <label style={{ display: "block", color: "#fff", marginBottom: "10px", fontWeight: "bold" }}>🔑 المفتاح السري (Bot Token):</label>
          <input 
            type="text" 
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVWxyz"
            style={{ width: "100%", padding: "12px", background: "#111", border: "1px solid #555", color: "#fff", borderRadius: "8px", marginBottom: "20px", direction: "ltr", fontFamily: "monospace" }}
            dir="ltr"
          />

          <button 
            onClick={handleLinkBot}
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: "#2196F3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "جاري الاتصال والربط..." : "ربط البوت وتفعيل النظام 🔗"}
          </button>
        </div>
      )}
    </div>
  );
}
