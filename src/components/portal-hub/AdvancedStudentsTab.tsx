"use client";

import { useState, useEffect, useMemo } from "react";
import { staffFetch } from "@/lib/auth/staffAuthFetch";

interface BotStudentItem {
  student_code: string;
  full_name: string;
  academic_year?: string;
  section?: string;
  telegram_id?: string;
  telegram_username?: string;
  telegram_first_name?: string;
  linked_at?: string;
  last_seen?: string;
  last_action?: string;
  status?: "active" | "suspended" | string;
}

export default function AdvancedStudentsTab() {
  const [subTab, setSubTab] = useState<"bot" | "activity" | "suspended">("bot");
  const [loading, setLoading] = useState(false);
  const [actionLoadingCode, setActionLoadingCode] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [data, setData] = useState<{
    stats: {
      total_students: number;
      bot_registered_count: number;
      active_recent_count: number;
      suspended_count: number;
    };
    bot_students: BotStudentItem[];
    activity_students: BotStudentItem[];
    suspended_students: BotStudentItem[];
  }>({
    stats: {
      total_students: 0,
      bot_registered_count: 0,
      active_recent_count: 0,
      suspended_count: 0,
    },
    bot_students: [],
    activity_students: [],
    suspended_students: [],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<BotStudentItem | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await staffFetch("/api/admin/portal/advanced-students?_t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData({
            stats: json.stats || {
              total_students: 0,
              bot_registered_count: 0,
              active_recent_count: 0,
              suspended_count: 0,
            },
            bot_students: json.bot_students || [],
            activity_students: json.activity_students || [],
            suspended_students: json.suspended_students || [],
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

  const currentList = useMemo(() => {
    let list: BotStudentItem[] = [];
    if (subTab === "bot") list = data.bot_students;
    else if (subTab === "activity") list = data.activity_students;
    else if (subTab === "suspended") list = data.suspended_students;

    return list.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.student_code.toLowerCase().includes(q) ||
        (s.full_name && s.full_name.toLowerCase().includes(q)) ||
        (s.telegram_id && s.telegram_id.toLowerCase().includes(q)) ||
        (s.telegram_username && s.telegram_username.toLowerCase().includes(q));

      const matchYear =
        yearFilter === "all" ||
        (s.academic_year && s.academic_year.includes(yearFilter));

      return matchSearch && matchYear;
    });
  }, [subTab, data, searchQuery, yearFilter]);

  const formatRelativeArabic = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "غير محدد";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return "الآن (نشط)";
      if (mins < 60) return `منذ ${mins} دقيقة`;
      if (hours < 24) return `منذ ${hours} ساعة`;
      if (days < 7) return `منذ ${days} يوم`;
      return d.toLocaleDateString("ar-EG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const handleToggleSuspend = async (student: BotStudentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlySuspended = student.status === "suspended";
    const targetStatus = isCurrentlySuspended ? "active" : "suspended";
    const confirmText = isCurrentlySuspended
      ? `هل تريد إعادة تفعيل حساب الطالب (${student.full_name} - كود ${student.student_code}) على بوت تليجرام؟`
      : `هل أنت متأكد من تعليق حساب الطالب (${student.full_name} - كود ${student.student_code})؟\nلن يتمكن من فتح البوابة عبر البوت حتى تقوم بإلغاء التعليق.`;

    if (!confirm(confirmText)) return;

    setActionLoadingCode(student.student_code);
    setFeedbackMsg(null);
    try {
      const res = await staffFetch("/api/admin/portal/advanced-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_suspend",
          student_code: student.student_code,
          status: targetStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ type: "success", text: json.message });
        if (selectedStudent?.student_code === student.student_code) {
          setSelectedStudent({ ...selectedStudent, status: json.status });
        }
        await fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "تعذر تنفيذ الإجراء" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "حدث خطأ في الاتصال بالخادم" });
    } finally {
      setActionLoadingCode(null);
      setTimeout(() => setFeedbackMsg(null), 4500);
    }
  };

  const handleDeleteAccount = async (student: BotStudentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmText = `⚠️ تأكيد حذف الحساب وفك ربط تليجرام:\nهل أنت متأكد من حذف حساب الطالب (${student.full_name} - كود ${student.student_code})؟\nسيتم مسح معرف تليجرام المربوط به وإلغاء تسجيله من البوت فوراً.`;
    if (!confirm(confirmText)) return;

    setActionLoadingCode(student.student_code);
    setFeedbackMsg(null);
    try {
      const res = await staffFetch("/api/admin/portal/advanced-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_account",
          student_code: student.student_code,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ type: "success", text: json.message });
        if (selectedStudent?.student_code === student.student_code) {
          setSelectedStudent(null);
        }
        await fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "تعذر حذف الحساب" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "حدث خطأ في الاتصال بالخادم" });
    } finally {
      setActionLoadingCode(null);
      setTimeout(() => setFeedbackMsg(null), 4500);
    }
  };

  return (
    <div style={{ background: "#0b101b", borderRadius: "16px", padding: "18px", color: "#f8fafc" }}>
      {/* رأس متابعة طلاب بوت تليجرام */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "bold", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🤖</span> متابعة طلاب بوت تليجرام وسجل النشاط
          </h2>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
            متابعة الطلاب المسجلين على البوت الرسمي (@NEZAMFANYAbot) وآخر نشاط لهم مع إمكانية تعليق أو حذف أي حساب
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "rgba(56, 189, 248, 0.15)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color: "#38bdf8",
            padding: "7px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>🔄</span> {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      {/* رسالة تأكيد العمليات */}
      {feedbackMsg && (
        <div
          style={{
            background: feedbackMsg.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${feedbackMsg.type === "success" ? "#10b981" : "#ef4444"}`,
            color: feedbackMsg.type === "success" ? "#a7f3d0" : "#fecaca",
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "12.5px",
            fontWeight: "bold",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontSize: "14px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* التابات الفرعية الثلاثة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "16px" }}>
        {/* تاب 1: المسجلون في البوت */}
        <button
          onClick={() => setSubTab("bot")}
          style={{
            background: subTab === "bot" ? "linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "bot" ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "bot" ? "#a7f3d0" : "#94a3b8", fontWeight: "bold" }}>
              🤖 الطلاب المسجلون بالبوت
            </span>
            <span style={{ background: "#10b98133", color: "#10b981", fontSize: "11.5px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.bot_registered_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
            من إجمالي {data.stats.total_students} طالب مقيد بالمنظومة
          </div>
        </button>

        {/* تاب 2: آخر نشاط بالبوت */}
        <button
          onClick={() => setSubTab("activity")}
          style={{
            background: subTab === "activity" ? "linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "activity" ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "activity" ? "#bae6fd" : "#94a3b8", fontWeight: "bold" }}>
              ⚡ آخر نشاط للطلاب بالبوت
            </span>
            <span style={{ background: "#38bdf833", color: "#38bdf8", fontSize: "11.5px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.active_recent_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
            آخر دخول وتفاعل لكل طالب داخل البوت
          </div>
        </button>

        {/* تاب 3: الحسابات المعلقة */}
        <button
          onClick={() => setSubTab("suspended")}
          style={{
            background: subTab === "suspended" ? "linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))" : "rgba(255, 255, 255, 0.03)",
            border: subTab === "suspended" ? "1.5px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "suspended" ? "#fecaca" : "#94a3b8", fontWeight: "bold" }}>
              ⛔ الحسابات المعلقة
            </span>
            <span style={{ background: "#ef444433", color: "#ef4444", fontSize: "11.5px", fontWeight: "bold", padding: "2px 8px", borderRadius: "10px" }}>
              {data.stats.suspended_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
            حسابات تم إيقاف دخولها مؤقتاً من الإدارة
          </div>
        </button>
      </div>

      {/* شريط البحث وفلترة الفرقة */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ابحث بكود الطالب أو الاسم أو معرف تليجرام..."
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#131b2a",
              border: "1px solid #1e293b",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "13px",
              boxSizing: "border-box",
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
                fontSize: "14px",
              }}
            >
              ✕
            </button>
          )}
        </div>

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
            cursor: "pointer",
          }}
        >
          <option value="all">جميع الفرق الدراسية</option>
          <option value="الأولى">الفرقة الأولى</option>
          <option value="الثانية">الفرقة الثانية</option>
          <option value="الثالثة">الفرقة الثالثة</option>
          <option value="الرابعة">الفرقة الرابعة</option>
        </select>
      </div>

      {/* قائمة الطلاب */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontSize: "13px" }}>
          ⏳ جارٍ تحميل سجل طلاب البوت...
        </div>
      ) : currentList.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "#64748b",
            fontSize: "13px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "12px",
            border: "1px dashed rgba(255,255,255,0.08)",
          }}
        >
          {searchQuery
            ? "لا توجد نتائج مطابقة لبحثك"
            : subTab === "suspended"
              ? "لا توجد أي حسابات معلقة حالياً ✅"
              : "لا توجد حسابات مسجلة في هذا القسم حالياً"}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "10px",
            maxHeight: "480px",
            overflowY: "auto",
            paddingLeft: "4px",
          }}
        >
          {currentList.map((st) => {
            const isSuspended = st.status === "suspended";
            const isBusy = actionLoadingCode === st.student_code;

            return (
              <div
                key={st.student_code}
                onClick={() => setSelectedStudent(st)}
                style={{
                  background: isSuspended
                    ? "linear-gradient(135deg, #1b1116, #18121b)"
                    : "#131b2a",
                  border: isSuspended
                    ? "1px solid rgba(239, 68, 68, 0.35)"
                    : "1px solid #1e293b",
                  borderRadius: "12px",
                  padding: "13px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                {/* أعلى الكارت: الاسم والكود والحالة */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px", color: "#fff", lineHeight: 1.4 }}>
                      {st.full_name}
                    </div>
                    <span
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38bdf8",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.student_code}
                    </span>
                  </div>

                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                    <span>
                      {st.academic_year || "غير محدد"}
                      {st.section ? ` • سكشن ${st.section}` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: "bold",
                        padding: "2px 7px",
                        borderRadius: "6px",
                        background: isSuspended ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.15)",
                        color: isSuspended ? "#fca5a5" : "#6ee7b7",
                      }}
                    >
                      {isSuspended ? "⛔ معلق" : "✅ نشط بالبوت"}
                    </span>
                  </div>
                </div>

                {/* معلومات تليجرام وآخر نشاط */}
                <div style={{ background: "rgba(0,0,0,0.28)", padding: "7px 10px", borderRadius: "8px", fontSize: "11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>معرف تليجرام:</span>
                    <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: "bold", direction: "ltr" }}>
                      {st.telegram_username ? `@${st.telegram_username} (${st.telegram_id})` : (st.telegram_id || "غير مربوط")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#cbd5e1", fontWeight: "bold" }}>
                      {st.last_action || "مسجل ببوت تليجرام"}
                    </span>
                    <span style={{ color: "#6ee7b7", fontSize: "10.5px" }}>
                      {formatRelativeArabic(st.last_seen)}
                    </span>
                  </div>
                </div>

                {/* أزرار التحكم المباشرة: تعليق / حذف / معاينة */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    paddingTop: "8px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => handleToggleSuspend(st, e)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      background: isSuspended ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.16)",
                      border: `1px solid ${isSuspended ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)"}`,
                      color: isSuspended ? "#6ee7b7" : "#fde68a",
                      borderRadius: "7px",
                      padding: "6px 8px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: isBusy ? "wait" : "pointer",
                    }}
                  >
                    {isSuspended ? "▶️ تفعيل الحساب" : "⏸️ تعليق الحساب"}
                  </button>

                  <button
                    onClick={(e) => handleDeleteAccount(st, e)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.35)",
                      color: "#fca5a5",
                      borderRadius: "7px",
                      padding: "6px 8px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: isBusy ? "wait" : "pointer",
                    }}
                  >
                    🗑️ حذف الحساب
                  </button>

                  <button
                    onClick={() => window.open(`/system?impersonate=${st.student_code}`, "_blank")}
                    title="معاينة بوابة الطالب كأدمن"
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      color: "#38bdf8",
                      borderRadius: "7px",
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    👑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة تفاصيل الطالب والتحكم الكامل */}
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
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, #121a29, #0c121e)",
              border: "1.5px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "20px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              color: "#fff",
              position: "relative",
            }}
          >
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
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold" }}>
                بوت تليجرام الرسمي للطلاب • @NEZAMFANYAbot 🤖
              </div>
              <h3 style={{ margin: "6px 0 4px 0", fontSize: "18px", fontWeight: "bold", color: "#fff" }}>
                {selectedStudent.full_name}
              </h3>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                {selectedStudent.academic_year || "طالب مقيد"}{" "}
                {selectedStudent.section ? `• سكشن ${selectedStudent.section}` : ""}
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "12.5px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>الكود الجامعي:</span>
                <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#38bdf8", fontSize: "15px" }}>
                  {selectedStudent.student_code}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>معرف تليجرام (ID):</span>
                <span style={{ fontFamily: "monospace", fontWeight: "bold", color: "#e2e8f0", direction: "ltr" }}>
                  {selectedStudent.telegram_id || "غير مربوط"}
                </span>
              </div>
              {selectedStudent.telegram_username && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>حساب تليجرام:</span>
                  <span style={{ fontFamily: "monospace", color: "#38bdf8", direction: "ltr" }}>
                    @{selectedStudent.telegram_username}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>حالة الحساب:</span>
                <span
                  style={{
                    fontWeight: "bold",
                    color: selectedStudent.status === "suspended" ? "#ef4444" : "#10b981",
                  }}
                >
                  {selectedStudent.status === "suspended" ? "⛔ معلق من الإدارة" : "✅ نشط ومفعل"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>آخر نشاط:</span>
                <span style={{ color: "#cbd5e1", fontWeight: "bold" }}>
                  {selectedStudent.last_action || "—"} ({formatRelativeArabic(selectedStudent.last_seen)})
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => window.open(`/system?impersonate=${selectedStudent.student_code}`, "_blank")}
                style={{
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "11px 16px",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                👑 فتح ومعاينة حساب الطالب (وضع الإدارة)
              </button>

              <button
                onClick={() => handleToggleSuspend(selectedStudent)}
                disabled={actionLoadingCode === selectedStudent.student_code}
                style={{
                  background: selectedStudent.status === "suspended" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  border: `1px solid ${selectedStudent.status === "suspended" ? "#10b981" : "#f59e0b"}`,
                  borderRadius: "10px",
                  padding: "11px 16px",
                  color: selectedStudent.status === "suspended" ? "#6ee7b7" : "#fde68a",
                  fontWeight: "bold",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {selectedStudent.status === "suspended"
                  ? "▶️ إعادة تفعيل الحساب على البوت"
                  : "⏸️ تعليق الحساب وإيقاف دخوله للبوت"}
              </button>

              <button
                onClick={() => handleDeleteAccount(selectedStudent)}
                disabled={actionLoadingCode === selectedStudent.student_code}
                style={{
                  background: "rgba(239, 68, 68, 0.18)",
                  border: "1px solid #ef4444",
                  borderRadius: "10px",
                  padding: "11px 16px",
                  color: "#fca5a5",
                  fontWeight: "bold",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                🗑️ حذف الحساب وفك ربط تليجرام نهائياً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
