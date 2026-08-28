import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TelegramSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [botData, setBotData] = useState<any>(null);
  const [error, setError] = useState('');

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
        fetchToken(); // reload data
      } else {
        setError(result.error || 'حدث خطأ أثناء الربط.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال.');
    }
    setLoading(false);
  };

  if (loading && !botData && !tokenInput) {
    return <div style={{ color: "#aaa", textAlign: "center", padding: "20px" }}>جاري التحميل...</div>;
  }

  return (
    <div>
      <h2 style={{ color: "#fff", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span>🤖</span> إعدادات البوابة (تليجرام)
      </h2>

      {error && (
        <div style={{ background: "#f44336", color: "#fff", padding: "10px", borderRadius: "5px", marginBottom: "15px", fontSize: "14px" }}>
          {error}
        </div>
      )}

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
