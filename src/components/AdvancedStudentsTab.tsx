"use client";

import { useState, useEffect, useMemo } from "react";
import { staffFetch } from "@/lib/staffAuthFetch";

interface StudentItem {
  student_code: string;
  full_name: string;
  academic_year?: string;
  section?: string;
  pin_code?: string;
  phone?: string;
  installed_at?: string;
  last_seen?: string;
  last_action?: string;
  platform?: string;
  registered_at?: string;
  last_login_at?: string;
  devices_count?: number;
  devices?: any[];
  bound_device_id?: string;
  reason?: string;
  status?: string;
}

export default function AdvancedStudentsTab() {
  const [subTab, setSubTab] = useState<"installed" | "activity" | "lost_sessions" | "suspicious">("installed");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    stats: {
      installed_count: number;
      active_count: number;
      lost_session_count: number;
      suspicious_count: number;
    };
    installed_students: StudentItem[];
    activity_students: StudentItem[];
    lost_session_students: StudentItem[];
    suspicious_accounts: StudentItem[];
  }>({
    stats: { installed_count: 0, active_count: 0, lost_session_count: 0, suspicious_count: 0 },
    installed_students: [],
    activity_students: [],
    lost_session_students: [],
    suspicious_accounts: []
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  // Chic Modal State
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [resettingDevices, setResettingDevices] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await staffFetch("/api/admin/portal/advanced-students?_t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData({
            stats: json.stats || { installed_count: 0, active_count: 0, lost_session_count: 0, suspicious_count: 0 },
            installed_students: json.installed_students || [],
            activity_students: json.activity_students || [],
            lost_session_students: json.lost_session_students || [],
            suspicious_accounts: json.suspicious_accounts || []
          });
        }
      }
    } catch (err) {
      console.error("[AdvancedStudentsTab error]:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter current list
  const currentList = useMemo(() => {
    let list: StudentItem[] = [];
    if (subTab === "installed") list = data.installed_students;
    else if (subTab === "activity") list = data.activity_students;
    else if (subTab === "lost_sessions") list = data.lost_session_students;
    else if (subTab === "suspicious") list = data.suspicious_accounts;

    return list.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.student_code.toLowerCase().includes(q) ||
        (s.full_name && s.full_name.toLowerCase().includes(q));

      const matchYear =
        yearFilter === "all" ||
        (s.academic_year && s.academic_year.includes(yearFilter));

      return matchSearch && matchYear;
    });
  }, [subTab, data, searchQuery, yearFilter]);

  const handleCopy = (text: string, type: "code" | "pin") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const handleWhatsAppSend = (student: StudentItem) => {
    const code = student.student_code || "";
    const name = student.full_name || "الطالب";
    const pin = student.pin_code || "لم يُحدد بعد";

    const msg =
`*جامعة حلوان - كلية التربية الفنية 🎓*
مرحباً بك عزيزي الطالب/ة: *${name}*
إليك بيانات حسابك الرسمية في بوابة الطلاب والمنظومة:
🔢 *الكود الجامعي:* \`${code}\`
🔑 *كلمة المرور (PIN):* \`${pin}\`
📲 *رابط بوابة الطلاب وتحميل التطبيق:*
https://art-faculty-app.vercel.app/

يرجى الاحتفاظ بهذه البيانات وعدم مشاركتها مع أي شخص. بالتوفيق دائماً! ✨`;

    let cleanPhone = (student.phone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("01")) {
      cleanPhone = "2" + cleanPhone;
    } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }

    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, "_blank");
  };

  const handleResetDevices = async (studentCode: string) => {
    if (!confirm(`هل أنت متأكد من فك قيد وتصفير جميع الأجهزة للطالب (${studentCode})؟ سيتمكن من تسجيل الدخول من هاتفه بحرية فوراً.`)) {
      return;
    }

    setResettingDevices(true);
    setResetMessage(null);
    try {
      const res = await staffFetch("/api/admin/portal/advanced-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_devices", student_code: studentCode })
      });
      const json = await res.json();
      if (json.success) {
        setResetMessage(json.message || "تم فك قيد الأجهزة بنجاح ✅");
        fetchData();
        setTimeout(() => setResetMessage(null), 3500);
      } else {
        alert(json.error || "فشلت العملية");
      }
    } catch (e: any) {
      alert("حدث خطأ أثناء فك القيد");
    } finally {
      setResettingDevices(false);
    }
  };

  const formatRelativeArabic = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "غير محدد";
    try {
      const d = new Date(dateStr);
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return "الآن (متصل)";
      if (mins < 60) return `منذ ${mins} دقيقة`;
      if (hours < 24) return `منذ ${hours} ساعة`;
      if (days < 7) return `منذ ${days} يوم`;
      return d.toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ background: "#0b101b", borderRadius: "16px", padding: "18px", color: "#f8fafc" }}>
      {/* رأس إدارة الطلاب المتقدمة */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "bold", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🎓</span> إدارة الطلاب المتقدمة ورصد الحسابات
          </h2>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
            متابعة شاملة للمثبتين للتطبيق، سجل النشاط الفعلي، الجلسات المفقودة، والحسابات المشكوك بأمرها
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color: "#38bdf8",
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>🔄</span> {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      {/* التابات الفرعية الأربعة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "16px" }}>
        {/* تاب 1: مثبتو التطبيق */}
        <button
          onClick={() => setSubTab("installed")}
          style={{
            background: subTab === "installed" ? "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "installed" ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: subTab === "installed" ? "#a7f3d0" : "#94a3b8", fontWeight: "bold" }}>📱 مثبتو التطبيق</span>
            <span style={{ background: "#10b98133", color: "#10b981", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.installed_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>هواتف الأندرويد المسجلة بالإشعارات</div>
        </button>

        {/* تاب 2: سجل النشاط */}
        <button
          onClick={() => setSubTab("activity")}
          style={{
            background: subTab === "activity" ? "linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "activity" ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: subTab === "activity" ? "#bae6fd" : "#94a3b8", fontWeight: "bold" }}>⏱️ نشاط الطلاب (آخر ظهور)</span>
            <span style={{ background: "#38bdf833", color: "#38bdf8", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.active_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>آخر تفاعل وجهاز لكل طالب</div>
        </button>

        {/* تاب 3: فاقدو جلسات الكوكيز */}
        <button
          onClick={() => setSubTab("lost_sessions")}
          style={{
            background: subTab === "lost_sessions" ? "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "lost_sessions" ? "1.5px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: subTab === "lost_sessions" ? "#fde68a" : "#94a3b8", fontWeight: "bold" }}>🍪 فاقدو جلسات الكوكيز</span>
            <span style={{ background: "#f59e0b33", color: "#f59e0b", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.lost_session_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>مسجلون انتهت أو فُقدت جلستهم</div>
        </button>

        {/* تاب 4: الحسابات المشكوك بأمرها */}
        <button
          onClick={() => setSubTab("suspicious")}
          style={{
            background: subTab === "suspicious" ? "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "suspicious" ? "1.5px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: subTab === "suspicious" ? "#fecaca" : "#94a3b8", fontWeight: "bold" }}>🚨 حسابات مشكوك بأمرها</span>
            <span style={{ background: "#ef444433", color: "#ef4444", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.suspicious_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>فُتحت على أكثر من هاتف مختلف</div>
        </button>
      </div>

      {/* شريط البحث وفلترة الفرقة */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ابحث بكود الطالب أو اسمه..."
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#131b2a",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "13px",
              boxSizing: "border-box"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* فلترة الفرقة */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{
            background: "#131b2a",
            border: "1px solid #1e293b",
            color: "#94a3b8",
            padding: "9px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            cursor: "pointer"
          }}
        >
          <option value="all">جميع الفرق الدراسية</option>
          <option value="الأولى">الفرقة الأولى</option>
          <option value="الثانية">الفرقة الثانية</option>
          <option value="الثالثة">الفرقة الثالثة</option>
          <option value="الرابعة">الفرقة الرابعة</option>
        </select>
      </div>

      {/* تنبيهات توضيحية حسب التاب النشط */}
      {subTab === "lost_sessions" && (
        <div style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#fde68a", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>💡</span>
          <div>
            <strong>توضيح:</strong> هؤلاء الطلاب تم تفعيل حساباتهم بالبوابة، ولكن انقضت جلسة الكوكيز الخاصة بهم أو لم يفتحوا البوابة مؤخراً. انقر على أي طالب لاستعراض كلمة المرور وإرسالها له عبر واتساب فوراً ليتمكن من الدخول.
          </div>
        </div>
      )}

      {subTab === "suspicious" && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#fecaca", display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🚨</span>
          <div>
            <strong>رادار الحماية:</strong> الحسابات المدرجة هنا رُصد دخولها من أكثر من جهاز هاتف مختلف (بصمات أجهزة متعددة). يمكنك فك قيد الجهاز لإتاحة الدخول لهاتف جديد، أو مراجعة الطالب لمنع تسريب الحسابات.
          </div>
        </div>
      )}

      {/* قائمة الطلاب */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "13px" }}>
          ⏳ جارٍ تحميل البيانات الذكية للطلاب...
        </div>
      ) : currentList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "13px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.08)" }}>
          {searchQuery ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد سجلات في هذا التاب حالياً"}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px", maxHeight: "460px", overflowY: "auto", paddingLeft: "4px" }}>
          {currentList.map((st) => {
            const hasPhone = Boolean(st.phone && st.phone.trim().length > 5);

            return (
              <div
                key={st.student_code}
                onClick={() => {
                  setSelectedStudent(st);
                  setShowPin(false);
                  setResetMessage(null);
                }}
                style={{
                  background: subTab === "suspicious" ? "linear-gradient(135deg, #181119, #1a1520)" : "#131b2a",
                  border: subTab === "suspicious" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #1e293b",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "8px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = subTab === "suspicious" ? "#ef4444" : "#38bdf8";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = subTab === "suspicious" ? "rgba(239, 68, 68, 0.3)" : "#1e293b";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* أعلى الكارت: الاسم والكود */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px", color: "#fff", lineHeight: 1.4 }}>
                      {st.full_name}
                    </div>
                    <span style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap"
                    }}>
                      {st.student_code}
                    </span>
                  </div>

                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{st.academic_year || "غير محدد"}</span>
                    {st.section && <span>• {st.section}</span>}
                  </div>
                </div>

                {/* منتصف الكارت حسب التاب */}
                {subTab === "installed" && (
                  <div style={{ fontSize: "11px", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "4px 8px", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>✓ مثبت للتطبيق</span>
                    <span style={{ color: "#6ee7b7" }}>{formatRelativeArabic(st.installed_at)}</span>
                  </div>
                )}

                {subTab === "activity" && (
                  <div style={{ fontSize: "11px", color: "#94a3b8", background: "rgba(0,0,0,0.25)", padding: "5px 8px", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#38bdf8", fontWeight: "bold" }}>
                      <span>{st.last_action || "نشاط"}</span>
                      <span>{formatRelativeArabic(st.last_seen)}</span>
                    </div>
                    {st.platform && (
                      <div style={{ color: "#64748b", fontSize: "10px", marginTop: "2px" }}>
                        جهاز: {st.platform}
                      </div>
                    )}
                  </div>
                )}

                {subTab === "lost_sessions" && (
                  <div style={{ fontSize: "11px", color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)", padding: "4px 8px", borderRadius: "6px", display: "flex", justifyContent: "space-between" }}>
                    <span>⚠️ جلسة كوكيز مفقودة</span>
                    <span style={{ color: "#fde68a" }}>{st.last_login_at ? formatRelativeArabic(st.last_login_at) : "لم يسجل بعد"}</span>
                  </div>
                )}

                {subTab === "suspicious" && (
                  <div style={{ fontSize: "11px", color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "4px 8px", borderRadius: "6px" }}>
                    <div style={{ fontWeight: "bold" }}>🚨 تم الفتح على ({st.devices_count}) هواتف</div>
                    <div style={{ color: "#fca5a5", fontSize: "10px", marginTop: "2px" }}>
                      {st.devices?.map((d: any) => d.phoneModel).filter(Boolean).slice(0, 2).join(" + ") || "أجهزة متعددة"}
                    </div>
                  </div>
                )}

                {/* أسفل الكارت: إجراء سريع */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>انقر لعرض الباسورد 👁️</span>
                  <span style={{ fontSize: "12px", color: "#25D366", fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    واتساب 📲
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* النافذة الشيك (Chic Modal) لعرض الكود والباسورد والإرسال عبر واتساب */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <div
          onClick={() => setSelectedStudent(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, #121a29, #0c121e)",
              border: "1.5px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              color: "#fff",
              position: "relative",
              animation: "popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {/* زر الإغلاق */}
            <button
              onClick={() => setSelectedStudent(null)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                background: "rgba(255,255,255,0.08)",
                border: "none",
                color: "#94a3b8",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              ✕
            </button>

            {/* ترويسة البطاقة الشيك */}
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold", letterSpacing: "0.5px" }}>
                جامعة حلوان • كليّة التربية الفنية 🎓
              </div>
              <h3 style={{ margin: "6px 0 2px 0", fontSize: "18px", fontWeight: "bold", color: "#fff" }}>
                {selectedStudent.full_name}
              </h3>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {selectedStudent.academic_year || "طالب مسجل"} {selectedStudent.section ? `• ${selectedStudent.section}` : ""}
              </div>
            </div>

            {/* صندوق الكود الجامعي */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 16px", marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>الكود الجامعي للطالب</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "20px", fontWeight: "bold", fontFamily: "monospace", color: "#38bdf8" }}>
                  {selectedStudent.student_code}
                </span>
                <button
                  onClick={() => handleCopy(selectedStudent.student_code, "code")}
                  style={{
                    background: copiedCode ? "#10b98133" : "rgba(56, 189, 248, 0.15)",
                    border: copiedCode ? "1px solid #10b981" : "1px solid rgba(56, 189, 248, 0.35)",
                    color: copiedCode ? "#10b981" : "#38bdf8",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  {copiedCode ? "✓ تم النسخ" : "نسخ الكود"}
                </button>
              </div>
            </div>

            {/* صندوق كلمة المرور / الباسورد (PIN) */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                <span>كلمة المرور / الرقم السري (PIN)</span>
                {selectedStudent.pin_code && (
                  <button
                    onClick={() => setShowPin(!showPin)}
                    style={{ background: "transparent", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "11px", padding: 0 }}
                  >
                    {showPin ? "إخفاء 🙈" : "إظهار 👁️"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  fontSize: "19px",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  color: selectedStudent.pin_code ? "#f59e0b" : "#64748b",
                  letterSpacing: showPin ? "2px" : "4px"
                }}>
                  {selectedStudent.pin_code
                    ? (showPin ? selectedStudent.pin_code : "••••••")
                    : "لم يتم تعيين رقم سري بعد"}
                </span>
                {selectedStudent.pin_code && (
                  <button
                    onClick={() => handleCopy(selectedStudent.pin_code || "", "pin")}
                    style={{
                      background: copiedPin ? "#10b98133" : "rgba(245, 158, 11, 0.15)",
                      border: copiedPin ? "1px solid #10b981" : "1px solid rgba(245, 158, 11, 0.35)",
                      color: copiedPin ? "#10b981" : "#f59e0b",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    {copiedPin ? "✓ تم النسخ" : "نسخ الباسورد"}
                  </button>
                )}
              </div>
            </div>

            {/* رقم الهاتف إذا كان مسجلاً */}
            {selectedStudent.phone && (
              <div style={{ fontSize: "11.5px", color: "#94a3b8", marginBottom: "16px", textAlign: "center" }}>
                📱 رقم هاتف الطالب المسجل: <span style={{ color: "#fff", fontWeight: "bold" }}>{selectedStudent.phone}</span>
              </div>
            )}

            {/* رسالة تأكيد فك القيد إن وجدت */}
            {resetMessage && (
              <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", color: "#a7f3d0", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", textAlign: "center", marginBottom: "12px" }}>
                {resetMessage}
              </div>
            )}

            {/* أزرار الإجراءات */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* زر إرسال واتساب المباشر */}
              <button
                onClick={() => handleWhatsAppSend(selectedStudent)}
                style={{
                  background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                  border: "none",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(37, 211, 102, 0.35)"
                }}
              >
                <span style={{ fontSize: "18px" }}>📲</span> إرسال البيانات عبر واتساب للطالب
              </button>

              {/* زر فك قيد الأجهزة للحسابات المشكوك بأمرها أو المقيدة */}
              {(subTab === "suspicious" || (selectedStudent.devices && selectedStudent.devices.length > 1) || selectedStudent.bound_device_id) && (
                <button
                  onClick={() => handleResetDevices(selectedStudent.student_code)}
                  disabled={resettingDevices}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    borderRadius: "10px",
                    padding: "9px 14px",
                    color: "#fca5a5",
                    fontWeight: "bold",
                    fontSize: "12px",
                    cursor: resettingDevices ? "wait" : "pointer"
                  }}
                >
                  {resettingDevices ? "جارٍ فك القيد..." : "🔓 فك قيد الأجهزة وتصفيرها (للسماح بالدخول من هاتف جديد)"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
