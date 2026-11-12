"use client";

import { useState, useEffect, useMemo } from "react";
import { staffFetch } from "@/lib/auth/staffAuthFetch";
import {
  Ban,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap
} from "lucide-react";

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
    <div style={{ background: "var(--bg-deep)", borderRadius: "16px", padding: "18px", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
      {/* رأس متابعة طلاب بوت تليجرام */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Bot size={18} strokeWidth={1.5} />
            <span>متابعة طلاب بوت تليجرام وسجل النشاط</span>
          </h2>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>
            متابعة الطلاب المسجلين على البوت الرسمي (@NEZAMFANYAbot) وآخر نشاط لهم مع إمكانية تعليق أو حذف أي حساب
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "rgba(56, 189, 248, 0.14)",
            border: "1px solid var(--primary)",
            color: "var(--accent-ink)",
            padding: "7px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? "spin" : ""} />
          <span>{loading ? "جارٍ التحديث..." : "تحديث البيانات"}</span>
        </button>
      </div>

      {/* رسالة تأكيد العمليات */}
      {feedbackMsg && (
        <div
          style={{
            background: feedbackMsg.type === "success" ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
            border: `1px solid ${feedbackMsg.type === "success" ? "var(--success)" : "var(--error)"}`,
            color: feedbackMsg.type === "success" ? "var(--success-ink)" : "var(--error-ink)",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "12.5px",
            fontWeight: 500,
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", display: "flex", alignItems: "center" }}
            aria-label="إغلاق"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* التابات الفرعية الثلاثة */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "16px" }}>
        {/* تاب 1: المسجلون في البوت */}
        <button
          onClick={() => setSubTab("bot")}
          style={{
            background: subTab === "bot" ? "rgba(16, 185, 129, 0.14)" : "var(--surface)",
            border: subTab === "bot" ? "1.5px solid var(--success)" : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "background-color 0.2s, border-color 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "bot" ? "var(--success-ink)" : "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Bot size={14} strokeWidth={1.5} />
              <span>الطلاب المسجلون بالبوت</span>
            </span>
            <span className="tabular-nums" style={{ background: "rgba(16, 185, 129, 0.18)", color: "var(--success-ink)", fontSize: "11.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px" }}>
              {data.stats.bot_registered_count}
            </span>
          </div>
          <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
            من إجمالي {data.stats.total_students} طالب مقيد بالمنظومة
          </div>
        </button>

        {/* تاب 2: آخر نشاط بالبوت */}
        <button
          onClick={() => setSubTab("activity")}
          style={{
            background: subTab === "activity" ? "rgba(56, 189, 248, 0.14)" : "var(--surface)",
            border: subTab === "activity" ? "1.5px solid var(--accent-ink)" : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "background-color 0.2s, border-color 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "activity" ? "var(--accent-ink)" : "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Zap size={14} strokeWidth={1.5} />
              <span>آخر نشاط للطلاب بالبوت</span>
            </span>
            <span className="tabular-nums" style={{ background: "rgba(56, 189, 248, 0.18)", color: "var(--accent-ink)", fontSize: "11.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px" }}>
              {data.stats.active_recent_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
            آخر دخول وتفاعل لكل طالب داخل البوت
          </div>
        </button>

        {/* تاب 3: الحسابات المعلقة */}
        <button
          onClick={() => setSubTab("suspended")}
          style={{
            background: subTab === "suspended" ? "rgba(239, 68, 68, 0.14)" : "var(--surface)",
            border: subTab === "suspended" ? "1.5px solid var(--error)" : "1px solid var(--border)",
            borderRadius: "12px",
            padding: "12px 14px",
            textAlign: "right",
            cursor: "pointer",
            transition: "background-color 0.2s, border-color 0.2s",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12.5px", color: subTab === "suspended" ? "var(--error-ink)" : "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Ban size={14} strokeWidth={1.5} />
              <span>الحسابات المعلقة</span>
            </span>
            <span className="tabular-nums" style={{ background: "rgba(239, 68, 68, 0.18)", color: "var(--error-ink)", fontSize: "11.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px" }}>
              {data.stats.suspended_count}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
            حسابات تم إيقاف دخولها مؤقتاً من الإدارة
          </div>
        </button>
      </div>

      {/* شريط البحث وفلترة الفرقة */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={15} strokeWidth={1.5} color="var(--text-dim)" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بكود الطالب أو الاسم أو معرف تليجرام..."
            style={{
              width: "100%",
              padding: "10px 36px 10px 34px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text-primary)",
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
                color: "var(--text-dim)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="مسح البحث"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            padding: "9px 14px",
            borderRadius: "8px",
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
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-dim)", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <Clock size={15} strokeWidth={1.5} />
          <span>جارٍ تحميل سجل طلاب البوت...</span>
        </div>
      ) : currentList.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-dim)",
            fontSize: "13px",
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px dashed var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {searchQuery ? (
            <span>لا توجد نتائج مطابقة لبحثك</span>
          ) : subTab === "suspended" ? (
            <>
              <CheckCircle2 size={16} strokeWidth={1.5} color="var(--success-ink)" />
              <span>لا توجد أي حسابات معلقة حالياً</span>
            </>
          ) : (
            <span>لا توجد حسابات مسجلة في هذا القسم حالياً</span>
          )}
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
                    ? "rgba(239, 68, 68, 0.08)"
                    : "var(--surface)",
                  border: isSuspended
                    ? "1px solid rgba(239, 68, 68, 0.4)"
                    : "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "13px 14px",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                {/* أعلى الكارت: الاسم والكود والحالة */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      {st.full_name}
                    </div>
                    <span
                      className="tabular-nums"
                      style={{
                        background: "rgba(56, 189, 248, 0.14)",
                        color: "var(--accent-ink)",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.student_code}
                    </span>
                  </div>

                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                    <span>
                      {st.academic_year || "غير محدد"}
                      {st.section ? ` • سكشن ${st.section}` : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: "6px",
                        background: isSuspended ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.14)",
                        color: isSuspended ? "var(--error-ink)" : "var(--success-ink)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {isSuspended ? <Ban size={11} strokeWidth={1.5} /> : <CheckCircle2 size={11} strokeWidth={1.5} />}
                      <span>{isSuspended ? "معلق" : "نشط بالبوت"}</span>
                    </span>
                  </div>
                </div>

                {/* معلومات تليجرام وآخر نشاط */}
                <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "7px 10px", borderRadius: "8px", fontSize: "11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>معرف تليجرام:</span>
                    <span className="tabular-nums" style={{ fontFamily: "monospace", color: "var(--accent-ink)", fontWeight: 600, direction: "ltr" }}>
                      {st.telegram_username ? `@${st.telegram_username} (${st.telegram_id})` : (st.telegram_id || "غير مربوط")}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {st.last_action || "مسجل ببوت تليجرام"}
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--success-ink)", fontSize: "10.5px" }}>
                      {formatRelativeArabic(st.last_seen)}
                    </span>
                  </div>
                </div>

                {/* أزرار التحكم المباشرة: تعليق / حذف / معاينة */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "8px",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => handleToggleSuspend(st, e)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      background: isSuspended ? "rgba(16, 185, 129, 0.16)" : "rgba(245, 158, 11, 0.14)",
                      border: `1px solid ${isSuspended ? "var(--success)" : "var(--warning)"}`,
                      color: isSuspended ? "var(--success-ink)" : "var(--warning-ink)",
                      borderRadius: "8px",
                      padding: "6px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: isBusy ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    {isSuspended ? <Play size={12} strokeWidth={1.5} /> : <Pause size={12} strokeWidth={1.5} />}
                    <span>{isSuspended ? "تفعيل الحساب" : "تعليق الحساب"}</span>
                  </button>

                  <button
                    onClick={(e) => handleDeleteAccount(st, e)}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      background: "rgba(239, 68, 68, 0.14)",
                      border: "1px solid var(--error)",
                      color: "var(--error-ink)",
                      borderRadius: "8px",
                      padding: "6px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: isBusy ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                    <span>حذف الحساب</span>
                  </button>

                  <button
                    onClick={() => window.open(`/system?impersonate=${st.student_code}`, "_blank")}
                    title="معاينة بوابة الطالب كأدمن"
                    style={{
                      background: "rgba(56, 189, 248, 0.14)",
                      border: "1px solid var(--primary)",
                      color: "var(--accent-ink)",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Eye size={14} strokeWidth={1.5} />
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
            background: "rgba(0, 0, 0, 0.8)",
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
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "440px",
              padding: "24px",
              color: "var(--text-primary)",
              position: "relative",
            }}
          >
            <button
              onClick={() => setSelectedStudent(null)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="إغلاق"
            >
              <X size={16} strokeWidth={1.5} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", color: "var(--accent-ink)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <Bot size={13} strokeWidth={1.5} />
                <span>بوت تليجرام الرسمي للطلاب • @NEZAMFANYAbot</span>
              </div>
              <h3 style={{ margin: "6px 0 4px 0", fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>
                {selectedStudent.full_name}
              </h3>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {selectedStudent.academic_year || "طالب مقيد"}{" "}
                {selectedStudent.section ? `• سكشن ${selectedStudent.section}` : ""}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
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
                <span style={{ color: "var(--text-muted)" }}>الكود الجامعي:</span>
                <span className="tabular-nums" style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--accent-ink)", fontSize: "15px" }}>
                  {selectedStudent.student_code}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>معرف تليجرام (ID):</span>
                <span className="tabular-nums" style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)", direction: "ltr" }}>
                  {selectedStudent.telegram_id || "غير مربوط"}
                </span>
              </div>
              {selectedStudent.telegram_username && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>حساب تليجرام:</span>
                  <span style={{ fontFamily: "monospace", color: "var(--accent-ink)", direction: "ltr" }}>
                    @{selectedStudent.telegram_username}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--text-muted)" }}>حالة الحساب:</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: selectedStudent.status === "suspended" ? "var(--error-ink)" : "var(--success-ink)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  {selectedStudent.status === "suspended" ? <Ban size={13} strokeWidth={1.5} /> : <CheckCircle2 size={13} strokeWidth={1.5} />}
                  <span>{selectedStudent.status === "suspended" ? "معلق من الإدارة" : "نشط ومفعل"}</span>
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>آخر نشاط:</span>
                <span className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {selectedStudent.last_action || "—"} ({formatRelativeArabic(selectedStudent.last_seen)})
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => window.open(`/system?impersonate=${selectedStudent.student_code}`, "_blank")}
                style={{
                  background: "var(--primary)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "11px 16px",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Eye size={15} strokeWidth={1.5} />
                <span>فتح ومعاينة حساب الطالب (وضع الإدارة)</span>
              </button>

              <button
                onClick={() => handleToggleSuspend(selectedStudent)}
                disabled={actionLoadingCode === selectedStudent.student_code}
                style={{
                  background: selectedStudent.status === "suspended" ? "rgba(16, 185, 129, 0.16)" : "rgba(245, 158, 11, 0.16)",
                  border: `1px solid ${selectedStudent.status === "suspended" ? "var(--success)" : "var(--warning)"}`,
                  borderRadius: "8px",
                  padding: "11px 16px",
                  color: selectedStudent.status === "suspended" ? "var(--success-ink)" : "var(--warning-ink)",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                {selectedStudent.status === "suspended" ? <Play size={14} strokeWidth={1.5} /> : <Pause size={14} strokeWidth={1.5} />}
                <span>
                  {selectedStudent.status === "suspended"
                    ? "إعادة تفعيل الحساب على البوت"
                    : "تعليق الحساب وإيقاف دخوله للبوت"}
                </span>
              </button>

              <button
                onClick={() => handleDeleteAccount(selectedStudent)}
                disabled={actionLoadingCode === selectedStudent.student_code}
                style={{
                  background: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid var(--error)",
                  borderRadius: "8px",
                  padding: "11px 16px",
                  color: "var(--error-ink)",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Trash2 size={14} strokeWidth={1.5} />
                <span>حذف الحساب وفك ربط تليجرام نهائياً</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
