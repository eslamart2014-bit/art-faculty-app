import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser: any;
  onImpersonate: (user: any) => void;
}

export default function AdminUsersModal({ isOpen, onClose, adminUser, onImpersonate }: AdminUsersModalProps) {
  useEffect(() => {
    window.history.pushState({ modal: true }, "");
  }, []);

  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDegree, setInviteDegree] = useState("د");
  const [inviting, setInviting] = useState(false);
  
  const [createdCard, setCreatedCard] = useState<{
    fullName: string;
    email: string;
    degree: string;
    password: string;
    isExisting?: boolean;
  } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [generatedPasswordData, setGeneratedPasswordData] = useState<{pass: string, email: string} | null>(null);

  const isPrimaryAdmin = adminUser?.role === 'مدير';
  const isAssistant = adminUser?.role === 'مدير مساعد';
  const isAdmin = isPrimaryAdmin;

  useEffect(() => {
    if (isOpen && adminUser) {
      fetchData();
    }
  }, [isOpen, adminUser]);

  const fetchData = async () => {
    setLoading(true);
    const { data: profilesData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    
    // جلب قائمة منسقي الهويات المعتمدين من إعدادات النظام لدعم الصلاحية حتى في حال عدم وجود العمود بقاعدة البيانات
    let verifiedCoords: string[] = [];
    try {
      const { data: settingsData } = await supabase.from("system_settings").select("telegram_config").eq("id", 1).maybeSingle();
      if (settingsData?.telegram_config?.verified_coordinators) {
        verifiedCoords = settingsData.telegram_config.verified_coordinators;
      }
    } catch (e) {}

    if (profilesData) {
      const isAssistant = adminUser?.role === 'مدير مساعد';
      const mergedUsers = profilesData
        .filter(u => !(isAssistant && u.full_name?.startsWith('[محذوف]')))
        .map(u => ({
          ...u,
          can_verify_students: u.can_verify_students !== undefined && u.can_verify_students !== null
            ? !!u.can_verify_students
            : verifiedCoords.includes(u.id)
        }));
      setUsers(mergedUsers);
    }

    // Fetch pending invitations
    const { data: invData } = await supabase.from("invitations").select("*").eq("status", "pending").order("created_at", { ascending: false });
    if (invData) setInvitations(invData);
    
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteFullName.trim()) {
      alert("يرجى إدخال اسم الزميل بالكامل");
      return;
    }
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      alert("يرجى إدخال بريد إلكتروني صحيح للزميل (Gmail)");
      return;
    }

    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'create_faculty_user',
          adminId: adminUser.id,
          email: inviteEmail.trim().toLowerCase(),
          fullName: inviteFullName.trim(),
          degree: inviteDegree
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert("خطأ: " + (data.error || "فشل إضافة الزميل"));
        setInviting(false);
        return;
      }

      // Success! Show credentials card
      setCreatedCard({
        fullName: data.fullName,
        email: data.email,
        degree: data.degree,
        password: data.password,
        isExisting: data.isExisting
      });

      setInviteFullName("");
      setInviteEmail("");
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالخادم: " + (err.message || ''));
    } finally {
      setInviting(false);
    }
  };

  const handleToggleSuspend = async (user: any) => {
    const newStatus = !user.is_suspended;
    await supabase.from("profiles").update({ is_suspended: newStatus }).eq("id", user.id);
    fetchData();
    setActiveMenuId(null);
  };

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`هل أنت متأكد من حذف الحساب نهائياً؟\nالاسم: ${user.full_name}`)) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'delete_user', userId: user.id, adminId: adminUser.id })
      });
      const data = await res.json();
      if (data.success) {
        alert("تم الحذف بنجاح");
        fetchData();
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleGrantAssistantRole = async (user: any) => {
    if (!isAdmin) return;
    const newRole = user.role === 'مدير مساعد' ? 'عضو هيئة تدريس' : 'مدير مساعد';
    const actionText = newRole === 'مدير مساعد' ? 'منح' : 'إلغاء';
    if (!confirm(`هل أنت متأكد من ${actionText} صلاحية (مدير مساعد) لهذا الحساب؟\nالاسم: ${user.full_name}`)) return;

    await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
    
    // Optional: Notify the user if they have Telegram connected
    if (newRole === 'مدير مساعد' && user.telegram_id) {
      const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || ''; 
      try {
        await fetch("/api/bot/notify_warning", { 
        });
      } catch(e) {}
    }

    try {
      await fetch('/api/admin/notify_role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, newRole })
      });
    } catch (e) {}

    alert(`تم ${actionText} الصلاحية بنجاح.`);
    fetchData();
    setActiveMenuId(null);
  };

  const handleToggleVerifyPermission = async (user: any) => {
    if (!isAdmin) return;
    const actionText = user.can_verify_students ? 'سحب' : 'منح';
    if (!confirm(`هل أنت متأكد من ${actionText} صلاحية (تفعيل حسابات الطلاب) لهذا المستخدم؟\nالاسم: ${user.full_name}`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'toggle_verify_permission', userId: user.id, adminId: adminUser.id })
      });

      const data = await res.json();
      if (data.success) {
        alert(`تم ${actionText} صلاحية تفعيل حسابات الطلاب بنجاح.`);
        fetchData();
      } else {
        alert("خطأ: " + (data.error || "فشلت العملية"));
      }
    } catch (e) {
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleChangePassword = async (user: any) => {
    if (!confirm(`هل أنت متأكد من إعادة تعيين كلمة المرور للمستخدم:\n${user.full_name || user.email}؟`)) return;

    // Auto-generate a secure 10-char password
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let newPass = "";
    for (let i = 0; i < 10; i++) newPass += chars.charAt(Math.floor(Math.random() * chars.length));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'change_password', userId: user.id, newPassword: newPass, adminId: adminUser.id })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedPasswordData({ pass: newPass, email: user.email });
        fetchData();
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleUnlock = async (user: any) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock', userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        alert("تم فك القفل عن الحساب بنجاح!");
        fetchData();
      } else {
        alert("خطأ: " + data.error);
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال");
    }
    setActiveMenuId(null);
  };

  const handleImpersonate = (user: any) => {
    if (user.role === 'مدير') {
      alert("لا يمكن تصفح حساب مدير آخر!");
      return;
    }
    onImpersonate(user);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "rgba(0,0,0,0.85)", zIndex: 1000,
      display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "12px 18px", 
        background: "#181f2c", 
        borderBottom: "1px solid #2a374f", 
        direction: "rtl",
        minHeight: "56px"
      }}>
        <div>
          <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🛡️</span> إدارة المستخدمين والزملاء
          </h3>
          <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="modal-close-btn"
          title="إغلاق"
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "20px", flexGrow: 1, overflowY: "auto", direction: "rtl" }}>
        
        {/* Modal: Created Faculty Credential Card */}
        {createdCard && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            direction: "rtl"
          }}>
            <div style={{
              background: "#1e293b",
              border: "2px solid #22c55e",
              borderRadius: "20px",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              color: "#fff",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              animation: "fadeIn 0.2s ease-out"
            }}>
              <div style={{ textAlign: "center", marginBottom: "18px" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "30px",
                  margin: "0 auto 12px auto",
                  border: "2px solid rgba(34, 197, 94, 0.4)"
                }}>
                  ✓
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#f8fafc" }}>
                  {createdCard.isExisting ? "تم تحديث وتجهيز حساب الزميل بنجاح" : "تم إنشاء وتفعيل حساب الزميل بنجاح!"}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                  الحساب جاهز للدخول المباشر فوراً دون الحاجة لأي خطوات تفعيل.
                </p>
              </div>

              {/* Card Details Box */}
              <div style={{
                background: "#0f172a",
                borderRadius: "14px",
                padding: "16px",
                border: "1px solid #334155",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>عضو هيئة التدريس:</span>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8" }}>
                    {createdCard.degree} / {createdCard.fullName}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>البريد الإلكتروني:</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#f1f5f9", direction: "ltr", fontFamily: "monospace" }}>
                    {createdCard.email}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>كلمة المرور المولدة:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontSize: "15px",
                      fontWeight: "bold",
                      color: "#22c55e",
                      fontFamily: "monospace",
                      letterSpacing: "1px",
                      background: "rgba(34, 197, 94, 0.1)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(34, 197, 94, 0.3)"
                    }}>
                      {showCreatedPassword ? createdCard.password : "••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "2px" }}
                      title={showCreatedPassword ? "إخفاء" : "إظهار"}
                    >
                      {showCreatedPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Copy message button */}
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const message = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بحضرتك ${createdCard.degree} / ${createdCard.fullName}\nتم تفعيل حسابكم بنجاح في المنظومة الرقمية لقسم التربية الفنية - جامعة جنوب الوادي.\n\nبيانات تسجيل الدخول:\n📧 البريد الإلكتروني: ${createdCard.email}\n🔑 كلمة المرور: ${createdCard.password}\n\n🌐 رابط المنظومة المباشر:\n${origin}\n\nنتمنى لحضرتك فصلاً دراسياً موفقاً بإذن الله.`;
                    navigator.clipboard.writeText(message);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 3000);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: copySuccess ? "#16a34a" : "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {copySuccess ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copySuccess ? "تم نسخ الرسالة بنجاح!" : "📋 نسخ رسالة الترحيب وبيانات الدخول"}</span>
                </button>

                {/* WhatsApp button */}
                <button
                  type="button"
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const message = `السلام عليكم ورحمة الله وبركاته،\nأهلاً بحضرتك ${createdCard.degree} / ${createdCard.fullName}\nتم تفعيل حسابكم بنجاح في المنظومة الرقمية لقسم التربية الفنية - جامعة جنوب الوادي.\n\nبيانات تسجيل الدخول:\n📧 البريد الإلكتروني: ${createdCard.email}\n🔑 كلمة المرور: ${createdCard.password}\n\n🌐 رابط المنظومة المباشر:\n${origin}\n\nنتمنى لحضرتك فصلاً دراسياً موفقاً بإذن الله.`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#25D366",
                    color: "#000",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  <span>💬 إرسال عبر واتساب مباشرة</span>
                </button>

                {/* Close card */}
                <button
                  type="button"
                  onClick={() => setCreatedCard(null)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    color: "#94a3b8",
                    border: "1px solid #334155",
                    borderRadius: "10px",
                    fontSize: "13px",
                    cursor: "pointer",
                    marginTop: "4px"
                  }}
                >
                  إغلاق البطاقة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Colleague */}
        <div style={{ background: "#222", padding: "18px", borderRadius: "14px", border: "1px solid #333", marginBottom: "25px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>👨‍🏫</span> إضافة عضو هيئة تدريس جديد
            </h3>
            <span style={{ fontSize: "11px", color: "#4CAF50", background: "rgba(76, 175, 80, 0.15)", padding: "3px 8px", borderRadius: "6px", fontWeight: "bold" }}>
              تفعيل وتوليد حساب فوري
            </span>
          </div>

          <p style={{ margin: "0 0 14px 0", color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" }}>
            أدخل بيانات الزميل وسيتم إنشاء حسابه وكلمة المرور تلقائياً مع استخراج بطاقة بيانات جاهزة للإرسال عبر واتساب فوراً.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#ccc", display: "block", marginBottom: "4px" }}>اسم الزميل (باللغة العربية):</label>
              <input 
                type="text"
                value={inviteFullName}
                onChange={e => setInviteFullName(e.target.value)}
                placeholder="مثال: أحمد محمد علي"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#111", border: "1px solid #444", color: "#fff", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#ccc", display: "block", marginBottom: "4px" }}>الدرجة العلمية:</label>
              <select
                value={inviteDegree}
                onChange={e => setInviteDegree(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#111", border: "1px solid #444", color: "#fff", outline: "none", boxSizing: "border-box" }}
              >
                <option value="معيد (م)">معيد (م)</option>
                <option value="مدرس مساعد (م.د)">مدرس مساعد (م.د)</option>
                <option value="مدرس (د)">مدرس (د)</option>
                <option value="أستاذ مساعد (أ.م.د)">أستاذ مساعد (أ.م.د)</option>
                <option value="أستاذ (أ.د)">أستاذ (أ.د)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", color: "#ccc", display: "block", marginBottom: "4px" }}>البريد الإلكتروني للزميل (Gmail):</label>
            <input 
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="example@gmail.com"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#111", border: "1px solid #444", color: "#fff", outline: "none", boxSizing: "border-box", textAlign: "left", direction: "ltr" }}
            />
          </div>

          <button 
            onClick={handleInvite}
            disabled={inviting || !inviteEmail || !inviteFullName}
            style={{ 
              width: "100%",
              background: (inviting || !inviteEmail || !inviteFullName) ? "#444" : "linear-gradient(135deg, #22c55e, #16a34a)", 
              color: "#fff", 
              border: "none", 
              padding: "12px", 
              borderRadius: "10px", 
              cursor: (inviting || !inviteEmail || !inviteFullName) ? "not-allowed" : "pointer", 
              fontWeight: "bold",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(34, 197, 94, 0.25)"
            }}
          >
            {inviting ? "جاري إنشاء الحساب والتوليد..." : "✨ إضافة الزميل وتوليد بيانات الدخول"}
          </button>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div style={{ marginBottom: "25px" }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#aaa", fontSize: "14px" }}>دعوات في انتظار التسجيل ({invitations.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ background: "rgba(255, 152, 0, 0.1)", border: "1px solid rgba(255, 152, 0, 0.3)", padding: "12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#fff", fontSize: "14px" }}>{inv.email}</span>
                  <span style={{ color: "#FF9800", fontSize: "12px", fontWeight: "bold" }}>⏳ قيد الانتظار</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Users */}
        <div>
          <h3 style={{ margin: "0 0 15px 0", color: "#aaa", fontSize: "14px" }}>الحسابات المسجلة ({users.length})</h3>
          
          {loading ? (
            <div style={{ textAlign: "center", color: "#888", padding: "20px" }}>جاري التحميل...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {users.map(u => {
                const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                
                const getLastSeen = (dateStr: string | null) => {
                  if (!isAdmin || !dateStr) return null;
                  const diffMins = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
                  if (diffMins < 5) return <span style={{ fontSize: "11px", color: "#4CAF50" }}>🟢 نشط الآن</span>;
                  if (diffMins < 60) return <span style={{ fontSize: "11px", color: "#FF9800" }}>🟠 نشط منذ {Math.floor(diffMins)} دقيقة</span>;
                  if (diffMins < 24 * 60) return <span style={{ fontSize: "11px", color: "#9e9e9e" }}>⚪ نشط منذ {Math.floor(diffMins / 60)} ساعة</span>;
                  return <span style={{ fontSize: "11px", color: "#757575" }}>⚪ أخر ظهور: {new Date(dateStr).toLocaleDateString('ar-EG')}</span>;
                };

                return (
                  <div key={u.id} style={{ position: "relative" }}>
                    <div 
                      onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                      style={{ 
                        background: u.is_suspended ? "#3a2020" : "#222", 
                        border: `1px solid ${u.is_suspended ? "#f44336" : "#333"}`, 
                        padding: "15px", 
                        borderRadius: "10px", 
                        cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontWeight: "bold", marginBottom: "4px" }}>
                          {u.degree && <span style={{ color: "#4CAF50" }}>{u.degree}</span>}
                          {u.full_name || "بدون اسم"}
                          {u.role === 'مدير' && <span style={{ background: "#2196F3", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>مدير</span>}
                          {u.role === 'مدير مساعد' && <span style={{ background: "#9C27B0", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>مدير مساعد</span>}
                          {u.can_verify_students && <span style={{ background: "#0288D1", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>🪪 منسق هويات</span>}
                          {isLocked && <span style={{ background: "#f44336", fontSize: "10px", padding: "2px 5px", borderRadius: "4px" }}>🔒 مقفول</span>}
                        </div>
                        <div style={{ color: "#888", fontSize: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                          <span>{u.email}</span>
                          {getLastSeen(u.last_seen)}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: "20px", color: "#888" }}>⋮</div>
                    </div>

                    {/* Options Menu */}
                    {activeMenuId === u.id && (
                      <div style={{
                        background: "#1a1a1a", border: "1px solid #444", borderRadius: "8px", padding: "10px",
                        marginTop: "5px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", animation: "slideDown 0.2s"
                      }}>
                        {isAssistant && u.role === 'مدير' ? (
                          <div style={{ gridColumn: "1 / -1", color: "#888", textAlign: "center", fontSize: "12px", padding: "10px", background: "#222", borderRadius: "6px", border: "1px dashed #444" }}>
                            🔒 حساب المدير محمي ولا يمكن التعديل عليه
                          </div>
                        ) : (
                          <>
                            <button onClick={() => handleChangePassword(u)} style={{ background: "#333", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                              🔑 تغيير كلمة المرور
                            </button>
                            
                            <button onClick={() => handleDeleteUser(u)} style={{ background: "transparent", color: "#f44336", border: "1px solid #f44336", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                              {isAssistant ? '🗑️ حذف المستخدم' : '🗑️ حذف نهائي'}
                            </button>
                          </>
                        )}

                        {isLocked && (
                          <button onClick={() => handleUnlock(u)} style={{ background: "#333", color: "#4CAF50", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1" }}>
                            🔓 فك قفل الحساب وإعطاء محاولات جديدة
                          </button>
                        )}

                        {isAdmin && (
                          <>
                            <button onClick={() => handleToggleSuspend(u)} style={{ background: "#333", color: u.is_suspended ? "#4CAF50" : "#FF9800", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                              {u.is_suspended ? "▶️ تفعيل الحساب" : "⏸️ إيقاف مؤقت"}
                            </button>

                            <button onClick={() => handleImpersonate(u)} style={{ background: "#2196F3", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>
                              🎭 الدخول كـ {u.full_name}
                            </button>
                            
                            {u.role !== 'مدير' && (
                              <button onClick={() => handleGrantAssistantRole(u)} style={{ background: "#9C27B0", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1", fontWeight: "bold" }}>
                                {u.role === 'مدير مساعد' ? "❌ إلغاء صلاحية مدير مساعد" : "⭐ منح صلاحية مدير مساعد"}
                              </button>
                            )}

                              {isPrimaryAdmin && (
                                <button onClick={() => handleToggleVerifyPermission(u)} style={{ background: u.can_verify_students ? "rgba(33, 150, 243, 0.2)" : "#333", color: u.can_verify_students ? "#64B5F6" : "#aaa", border: `1px solid ${u.can_verify_students ? "#2196F3" : "#555"}`, padding: "10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1", fontWeight: "bold" }}>
                                  {u.can_verify_students ? "✅ سحب صلاحية تفعيل حسابات الطلاب" : "🪪 منح صلاحية تفعيل حسابات الطلاب"}
                                </button>
                              )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {generatedPasswordData && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center"
        }} onClick={() => setGeneratedPasswordData(null)}>
          <div style={{ background: "#222", padding: "20px", borderRadius: "10px", width: "90%", maxWidth: "350px", textAlign: "center", border: "1px solid #4CAF50" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#4CAF50", marginTop: 0 }}>تم إنشاء كلمة مرور جديدة</h3>
            <p style={{ color: "#aaa", fontSize: "13px" }}>للحساب: <br/><strong>{generatedPasswordData.email}</strong></p>
            
            <div style={{ background: "#111", padding: "15px", borderRadius: "8px", border: "1px dashed #555", margin: "20px 0", fontSize: "24px", letterSpacing: "2px", fontWeight: "bold", userSelect: "all" }}>
              {generatedPasswordData.pass}
            </div>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(`البريد: ${generatedPasswordData.email}\nكلمة المرور: ${generatedPasswordData.pass}`);
                alert("تم النسخ بنجاح!");
              }}
              style={{ width: "100%", padding: "12px", background: "#2196F3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", marginBottom: "10px" }}
            >📋 نسخ بيانات الدخول</button>

            <button 
              onClick={() => setGeneratedPasswordData(null)}
              style={{ width: "100%", padding: "10px", background: "transparent", color: "#aaa", border: "1px solid #555", borderRadius: "8px", cursor: "pointer" }}
            >إغلاق</button>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
