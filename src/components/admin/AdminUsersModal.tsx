import { useState, useEffect } from "react";
import { supabase } from "@/lib/core/supabase";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageCircle,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Save,
  Shield,
  Star,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  X,
  XCircle,
  Zap
} from "lucide-react";
import { normalizeAcademicDegree } from "@/lib/courses/academicHelper";

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
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editDegree, setEditDegree] = useState<string>('م');
  const [editFullName, setEditFullName] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

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
          degree: normalizeAcademicDegree(inviteDegree)
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

  const handleDeleteInvitation = async (invId: string, email: string) => {
    if (!confirm(`هل أنت متأكد من حذف هذه الدعوة المعلقة نهائياً؟\nالبريد: ${email}`)) return;
    const { error } = await supabase.from("invitations").delete().eq("id", invId);
    if (error) {
      alert("خطأ أثناء الحذف: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleSelectPendingInvitation = (email: string) => {
    setInviteEmail(email);
    const nameInput = document.getElementById("invite-colleague-name");
    if (nameInput) {
      nameInput.focus();
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

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setEditDegree(user.degree ? normalizeAcademicDegree(user.degree) : "د");
    setEditFullName(user.full_name || "");
    setActiveMenuId(null);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    if (!editFullName.trim()) {
      alert("يرجى كتابة الاسم بالكامل");
      return;
    }
    setSavingEdit(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          action: "update_user_degree", 
          userId: editingUser.id, 
          adminId: adminUser.id,
          degree: normalizeAcademicDegree(editDegree),
          fullName: editFullName.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("تم تحديث الدرجة العلمية والاسم بنجاح ✅");
        setEditingUser(null);
        fetchData();
      } else {
        alert("خطأ: " + (data.error || "فشل التحديث"));
      }
    } catch (err: any) {
      alert("حدث خطأ في الاتصال: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      background: "var(--background)", zIndex: 1000,
      display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "12px 18px", 
        background: "var(--bg-deep)", 
        borderBottom: "1px solid var(--border)", 
        direction: "rtl",
        minHeight: "56px"
      }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={18} strokeWidth={1.5} color="var(--accent-ink)" />
            <span>إدارة المستخدمين والزملاء</span>
          </h3>
          <div style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "2px" }}>
            جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="modal-close-btn"
          title="إغلاق"
          aria-label="إغلاق"
        >
          <X size={18} strokeWidth={1.5} />
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
            background: "rgba(0, 0, 0, 0.8)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            direction: "rtl"
          }}>
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--success)",
              borderRadius: "16px",
              maxWidth: "480px",
              width: "100%",
              padding: "24px",
              color: "var(--text-primary)",
              animation: "fadeIn 0.2s ease-out"
            }}>
              <div style={{ textAlign: "center", marginBottom: "18px" }}>
                <div style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.14)",
                  color: "var(--success-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px auto",
                  border: "1px solid rgba(16, 185, 129, 0.35)"
                }}>
                  <CheckCircle2 size={28} strokeWidth={1.5} />
                </div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {createdCard.isExisting ? "تم تحديث وتجهيز حساب الزميل بنجاح" : "تم إنشاء وتفعيل حساب الزميل بنجاح"}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                  الحساب جاهز للدخول المباشر فوراً دون الحاجة لأي خطوات تفعيل.
                </p>
              </div>

              {/* Card Details Box */}
              <div style={{
                background: "var(--bg-deep)",
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid var(--border)",
                marginBottom: "20px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>عضو هيئة التدريس:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent-ink)" }}>
                    {createdCard.degree} / {createdCard.fullName}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>البريد الإلكتروني:</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", direction: "ltr", fontFamily: "monospace" }}>
                    {createdCard.email}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>كلمة المرور المولدة:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="tabular-nums" style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--success-ink)",
                      fontFamily: "monospace",
                      letterSpacing: "1px",
                      background: "rgba(16, 185, 129, 0.1)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(16, 185, 129, 0.3)"
                    }}>
                      {showCreatedPassword ? createdCard.password : "••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                      title={showCreatedPassword ? "إخفاء" : "إظهار"}
                    >
                      {showCreatedPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
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
                    background: copySuccess ? "var(--success)" : "var(--primary)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  {copySuccess ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                  <span>{copySuccess ? "تم نسخ الرسالة بنجاح" : "نسخ رسالة الترحيب وبيانات الدخول"}</span>
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
                    background: "var(--success)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  <MessageCircle size={16} strokeWidth={1.5} />
                  <span>إرسال عبر واتساب مباشرة</span>
                </button>

                {/* Close card */}
                <button
                  type="button"
                  onClick={() => setCreatedCard(null)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
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
        <div style={{ background: "var(--surface)", padding: "18px", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "25px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "15px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <UserPlus size={18} strokeWidth={1.5} color="var(--accent-ink)" />
              <span>إضافة عضو هيئة تدريس جديد</span>
            </h3>
            <span style={{ fontSize: "11px", color: "var(--success-ink)", background: "rgba(16, 185, 129, 0.14)", padding: "3px 8px", borderRadius: "6px", fontWeight: 600 }}>
              تفعيل وتوليد حساب فوري
            </span>
          </div>

          <p style={{ margin: "0 0 14px 0", color: "var(--text-muted)", fontSize: "12px", lineHeight: "1.5" }}>
            أدخل بيانات الزميل وسيتم إنشاء حسابه وكلمة المرور تلقائياً مع استخراج بطاقة بيانات جاهزة للإرسال عبر واتساب فوراً.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "block", marginBottom: "4px" }}>اسم الزميل (باللغة العربية):</label>
              <input 
                id="invite-colleague-name"
                type="text"
                value={inviteFullName}
                onChange={e => setInviteFullName(e.target.value)}
                placeholder="مثال: أحمد محمد علي"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "block", marginBottom: "4px" }}>الدرجة العلمية:</label>
              <select
                value={inviteDegree}
                onChange={e => setInviteDegree(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }}
              >
                <option value="د">مدرس / دكتور (د)</option>
                <option value="م">معيد (م)</option>
                <option value="م.د">مدرس مساعد (م.د)</option>
                <option value="أ.م.د">أستاذ مساعد (أ.م.د)</option>
                <option value="أ.د">أستاذ دكتور (أ.د)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, display: "block", marginBottom: "4px" }}>البريد الإلكتروني للزميل (Gmail):</label>
            <input 
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="example@gmail.com"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box", textAlign: "left", direction: "ltr" }}
            />
          </div>

          <button 
            onClick={handleInvite}
            disabled={inviting || !inviteEmail || !inviteFullName}
            style={{ 
              width: "100%",
              background: (inviting || !inviteEmail || !inviteFullName) ? "var(--surface-hover)" : "var(--success)", 
              color: (inviting || !inviteEmail || !inviteFullName) ? "var(--text-dim)" : "#fff", 
              border: "none", 
              padding: "12px", 
              borderRadius: "8px", 
              cursor: (inviting || !inviteEmail || !inviteFullName) ? "not-allowed" : "pointer", 
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
          >
            <UserPlus size={16} strokeWidth={1.5} />
            <span>{inviting ? "جاري إنشاء الحساب والتوليد..." : "إضافة الزميل وتوليد بيانات الدخول"}</span>
          </button>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div style={{ marginBottom: "25px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 className="tabular-nums" style={{ margin: 0, color: "var(--warning-ink)", fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} strokeWidth={1.5} />
                <span>دعوات في انتظار التسجيل ({invitations.length})</span>
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                اضغط &quot;إكمال&quot; لتوليد الحساب والكارت فوراً
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {invitations.map(inv => (
                <div 
                  key={inv.id} 
                  style={{ 
                    background: "rgba(245, 158, 11, 0.08)", 
                    border: "1px solid rgba(245, 158, 11, 0.25)", 
                    padding: "12px 14px", 
                    borderRadius: "12px", 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px"
                  }}
                >
                  <div>
                    <div style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: 600, direction: "ltr", textAlign: "right" }}>
                      {inv.email}
                    </div>
                    <div style={{ color: "var(--warning-ink)", fontSize: "11px", marginTop: "3px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} strokeWidth={1.5} />
                      <span>دعوة معلقة (بانتظار الاسم وتوليد الحساب)</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleSelectPendingInvitation(inv.email)}
                      style={{
                        background: "rgba(16, 185, 129, 0.14)",
                        color: "var(--success-ink)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                      title="استكمال بيانات الزميل وتوليد الحساب والكارت"
                    >
                      <Zap size={13} strokeWidth={1.5} />
                      <span>إكمال وتوليد الحساب</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteInvitation(inv.id, inv.email)}
                      style={{
                        background: "rgba(239, 68, 68, 0.14)",
                        color: "var(--error-ink)",
                        border: "1px solid rgba(239, 68, 68, 0.35)",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                      title="حذف هذه الدعوة المعلقة"
                    >
                      <Trash2 size={13} strokeWidth={1.5} />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Users */}
        <div>
          <h3 className="tabular-nums" style={{ margin: "0 0 15px 0", color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>الحسابات المسجلة ({users.length})</h3>
          
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>جاري التحميل...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {users.map(u => {
                const isLocked = u.locked_until && new Date(u.locked_until) > new Date();
                
                const getLastSeen = (dateStr: string | null) => {
                  if (!isAdmin || !dateStr) return null;
                  const diffMins = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
                  if (diffMins < 5) return (
                    <span style={{ fontSize: "11px", color: "var(--success-ink)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "6px", background: "var(--success-ink)" }} />
                      <span>نشط الآن</span>
                    </span>
                  );
                  if (diffMins < 60) return (
                    <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--warning-ink)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "6px", background: "var(--warning-ink)" }} />
                      <span>نشط منذ {Math.floor(diffMins)} دقيقة</span>
                    </span>
                  );
                  if (diffMins < 24 * 60) return (
                    <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "6px", background: "var(--text-muted)" }} />
                      <span>نشط منذ {Math.floor(diffMins / 60)} ساعة</span>
                    </span>
                  );
                  return (
                    <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "6px", background: "var(--text-dim)" }} />
                      <span>آخر ظهور: {new Date(dateStr).toLocaleDateString('ar-EG')}</span>
                    </span>
                  );
                };

                return (
                  <div key={u.id} style={{ position: "relative" }}>
                    <div 
                      onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                      style={{ 
                        background: u.is_suspended ? "rgba(239, 68, 68, 0.1)" : "var(--surface)", 
                        border: `1px solid ${u.is_suspended ? "var(--error)" : "var(--border)"}`, 
                        padding: "15px", 
                        borderRadius: "12px", 
                        cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", color: "var(--text-primary)", fontWeight: 600, marginBottom: "4px" }}>
                          {u.degree && <span style={{ color: "var(--success-ink)" }}>{u.degree}</span>}
                          <span>{u.full_name || "بدون اسم"}</span>
                          {u.role === 'مدير' && <span style={{ background: "var(--primary)", color: "#fff", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px" }}>مدير</span>}
                          {u.role === 'مدير مساعد' && <span style={{ background: "rgba(56, 189, 248, 0.16)", color: "var(--accent-ink)", border: "1px solid rgba(56, 189, 248, 0.35)", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px" }}>مدير مساعد</span>}
                          {u.can_verify_students && (
                            <span style={{ background: "rgba(37, 99, 235, 0.2)", color: "var(--accent-ink)", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <BadgeCheck size={11} strokeWidth={1.5} />
                              <span>منسق هويات</span>
                            </span>
                          )}
                          {isLocked && (
                            <span style={{ background: "var(--error)", color: "#fff", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Lock size={11} strokeWidth={1.5} />
                              <span>مقفول</span>
                            </span>
                          )}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                          <span>{u.email}</span>
                          {getLastSeen(u.last_seen)}
                        </div>
                      </div>
                      
                      <MoreVertical size={18} strokeWidth={1.5} color="var(--text-muted)" />
                    </div>

                    {/* Options Menu */}
                    {activeMenuId === u.id && (
                      <div style={{
                        background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "10px",
                        marginTop: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", animation: "slideDown 0.2s"
                      }}>
                        {isAssistant && u.role === 'مدير' ? (
                          <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", textAlign: "center", fontSize: "12px", padding: "10px", background: "var(--surface)", borderRadius: "8px", border: "1px dashed var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <Lock size={14} strokeWidth={1.5} />
                            <span>حساب المدير محمي ولا يمكن التعديل عليه</span>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => handleChangePassword(u)} style={{ background: "var(--surface-hover)", color: "var(--text-primary)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <KeyRound size={14} strokeWidth={1.5} />
                              <span>تغيير كلمة المرور</span>
                            </button>
                            
                            <button onClick={() => handleDeleteUser(u)} style={{ background: "transparent", color: "var(--error-ink)", border: "1px solid var(--error)", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <Trash2 size={14} strokeWidth={1.5} />
                              <span>{isAssistant ? 'حذف المستخدم' : 'حذف نهائي'}</span>
                            </button>
                          </>
                        )}

                        {isLocked && (
                          <button onClick={() => handleUnlock(u)} style={{ background: "var(--surface-hover)", color: "var(--success-ink)", border: "1px solid var(--success)", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <Unlock size={14} strokeWidth={1.5} />
                            <span>فك قفل الحساب وإعطاء محاولات جديدة</span>
                          </button>
                        )}

                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => handleOpenEditUser(u)} 
                              style={{ 
                                background: "rgba(37, 99, 235, 0.14)", 
                                color: "var(--accent-ink)", 
                                border: "1px solid var(--primary)", 
                                padding: "10px", 
                                borderRadius: "8px", 
                                cursor: "pointer", 
                                fontSize: "13px", 
                                fontWeight: 600,
                                gridColumn: "1 / -1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                              }}
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                              <span>تعديل الدرجة العلمية والاسم</span>
                            </button>

                            <button onClick={() => handleToggleSuspend(u)} style={{ background: "var(--surface-hover)", color: u.is_suspended ? "var(--success-ink)" : "var(--warning-ink)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              {u.is_suspended ? <Play size={14} strokeWidth={1.5} /> : <Pause size={14} strokeWidth={1.5} />}
                              <span>{u.is_suspended ? "تفعيل الحساب" : "إيقاف مؤقت"}</span>
                            </button>

                            <button onClick={() => handleImpersonate(u)} style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <UserCheck size={14} strokeWidth={1.5} />
                              <span>الدخول كـ {u.full_name}</span>
                            </button>
                            
                            {u.role !== 'مدير' && (
                              <button onClick={() => handleGrantAssistantRole(u)} style={{ background: u.role === 'مدير مساعد' ? "rgba(239, 68, 68, 0.12)" : "rgba(56, 189, 248, 0.14)", color: u.role === 'مدير مساعد' ? "var(--error-ink)" : "var(--accent-ink)", border: `1px solid ${u.role === 'مدير مساعد' ? "var(--error)" : "var(--primary)"}`, padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                {u.role === 'مدير مساعد' ? <XCircle size={14} strokeWidth={1.5} /> : <Star size={14} strokeWidth={1.5} />}
                                <span>{u.role === 'مدير مساعد' ? "إلغاء صلاحية مدير مساعد" : "منح صلاحية مدير مساعد"}</span>
                              </button>
                            )}

                              {isPrimaryAdmin && (
                                <button onClick={() => handleToggleVerifyPermission(u)} style={{ background: u.can_verify_students ? "rgba(37, 99, 235, 0.14)" : "var(--surface-hover)", color: u.can_verify_students ? "var(--accent-ink)" : "var(--text-muted)", border: `1px solid ${u.can_verify_students ? "var(--primary)" : "var(--border-light)"}`, padding: "10px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", gridColumn: "1 / -1", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                  {u.can_verify_students ? <CheckCircle2 size={14} strokeWidth={1.5} /> : <BadgeCheck size={14} strokeWidth={1.5} />}
                                  <span>{u.can_verify_students ? "سحب صلاحية تفعيل حسابات الطلاب" : "منح صلاحية تفعيل حسابات الطلاب"}</span>
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
          background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }} onClick={() => setGeneratedPasswordData(null)}>
          <div style={{ background: "var(--surface)", padding: "22px", borderRadius: "16px", width: "90%", maxWidth: "360px", textAlign: "center", border: "1px solid var(--success)" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "var(--success-ink)", marginTop: 0, fontSize: "16px", fontWeight: 600 }}>تم إنشاء كلمة مرور جديدة</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>للحساب: <br/><strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{generatedPasswordData.email}</strong></p>
            
            <div className="tabular-nums" style={{ background: "var(--bg-deep)", padding: "14px", borderRadius: "8px", border: "1px dashed var(--border-light)", margin: "18px 0", fontSize: "22px", letterSpacing: "2px", fontWeight: 600, userSelect: "all", color: "var(--text-primary)", fontFamily: "monospace" }}>
              {generatedPasswordData.pass}
            </div>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(`البريد: ${generatedPasswordData.email}\nكلمة المرور: ${generatedPasswordData.pass}`);
                alert("تم النسخ بنجاح");
              }}
              style={{ width: "100%", padding: "12px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
            >
              <Copy size={15} strokeWidth={1.5} />
              <span>نسخ بيانات الدخول</span>
            </button>

            <button 
              onClick={() => setGeneratedPasswordData(null)}
              style={{ width: "100%", padding: "10px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: 500, cursor: "pointer" }}
            >إغلاق</button>
          </div>
        </div>
      )}

      {editingUser && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.8)", zIndex: 10000, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px"
        }} onClick={() => setEditingUser(null)}>
          <div style={{ background: "var(--surface)", padding: "22px", borderRadius: "16px", width: "90%", maxWidth: "380px", border: "1px solid var(--border)", direction: "rtl" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "var(--accent-ink)", marginTop: 0, marginBottom: "15px", fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
              <Pencil size={16} strokeWidth={1.5} />
              <span>تعديل الدرجة العلمية والاسم</span>
            </h3>
            
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>البريد الإلكتروني:</label>
              <input 
                type="text" 
                value={editingUser.email} 
                disabled 
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text-dim)", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>الدرجة العلمية:</label>
              <select
                value={editDegree}
                onChange={e => setEditDegree(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box", fontSize: "14px" }}
              >
                <option value="د">دكتور / مدرس (د)</option>
                <option value="م">معيد (م)</option>
                <option value="م.د">مدرس مساعد (م.د)</option>
                <option value="أ.م.د">أستاذ مساعد (أ.م.د)</option>
                <option value="أ.د">أستاذ دكتور (أ.د)</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>الاسم بالكامل:</label>
              <input 
                type="text" 
                value={editFullName} 
                onChange={e => setEditFullName(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--bg-deep)", border: "1px solid var(--border-light)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box", fontSize: "14px" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSaveUserEdit}
                disabled={savingEdit}
                style={{ flex: 1, padding: "12px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: savingEdit ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Save size={15} strokeWidth={1.5} />
                <span>{savingEdit ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
              </button>
              <button
                onClick={() => setEditingUser(null)}
                style={{ padding: "12px 18px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-light)", borderRadius: "8px", fontWeight: 500, cursor: "pointer" }}
              >
                إلغاء
              </button>
            </div>
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
