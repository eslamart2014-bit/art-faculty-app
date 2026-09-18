"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface StudentPortalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onOpenIdentityModal?: () => void;
}

export default function StudentPortalHubModal({
  isOpen,
  onClose,
  user,
  onOpenIdentityModal
}: StudentPortalHubModalProps) {
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: true }, "");
    }
  }, [isOpen]);

  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    registeredAccounts: 0,
    verifiedCards: 0,
    submissionsCount: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPortalStats();
    }
  }, [isOpen]);

  const fetchPortalStats = async () => {
    setLoadingStats(true);
    try {
      const [stRes, accRes, subRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("student_accounts").select("id, id_card_verified", { count: "exact" }),
        supabase.from("student_submissions").select("id", { count: "exact", head: true })
      ]);

      const totalSt = stRes.count || 0;
      const accList = (accRes as any)?.data || [];
      const totalAcc = (accRes as any)?.count || accList.length || 0;
      const verified = accList.filter((a: any) => a.id_card_verified).length || 0;
      const totalSubs = (subRes as any)?.count || 0;

      setStats({
        totalStudents: totalSt,
        registeredAccounts: totalAcc,
        verifiedCards: verified,
        submissionsCount: totalSubs
      });
    } catch (e) {
      console.error("Error fetching portal stats:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  if (!isOpen) return null;

  const getPortalUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/student-portal`;
    }
    return "/student-portal";
  };

  const handleCopyPortalLink = () => {
    const url = getPortalUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const isAdmin = user && ["مدير", "مدير مساعد"].includes(user.role);
  const canVerify = isAdmin || !!user?.can_verify_students;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.85)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        direction: "rtl"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 20px",
          background: "#1e1e1e",
          borderBottom: "1px solid #333"
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#2196F3", fontSize: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>🎓</span> بوابة الطلاب والخدمات الأكاديمية
          </h2>
          <div style={{ color: "#888", fontSize: "12px", marginTop: "3px" }}>
            اللوحة الموحدة للتحكم بكافة خدمات بوابات الطلاب والمعيدين وتأكيد الهويات
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#aaa", fontSize: "26px", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", maxWidth: "800px", width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        
        {/* Quick Stats Banner */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "20px"
          }}
        >
          <div style={{ background: "#1a2430", border: "1px solid #1e3a5f", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#90CAF9" }}>إجمالي الطلاب</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
              {stats.totalStudents || "--"}
            </div>
          </div>
          <div style={{ background: "#1a2a1a", border: "1px solid #2e4a2e", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#81C784" }}>حسابات مسجلة بالبوابة</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
              {stats.registeredAccounts || "0"}
            </div>
          </div>
          <div style={{ background: "#2a1f14", border: "1px solid #5a3d1e", padding: "12px", borderRadius: "12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#FFB74D" }}>أعمال ومشاريع مرفوعة</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", marginTop: "4px" }}>
              {stats.submissionsCount || "0"}
            </div>
          </div>
        </div>

        {/* Section 1: Main Public Student Portal */}
        <div
          style={{
            background: "#222",
            border: "1px solid #333",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <div style={{ background: "rgba(33, 150, 243, 0.2)", color: "#2196F3", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
              🎓
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>بوابة الطلاب العامة (الرابط المباشر)</div>
              <div style={{ color: "#888", fontSize: "12px" }}>البوابة المخصصة للطلبة لاستخراج كارت الـ QR، ومتابعة الحضور، ورفع الأعمال الفنية.</div>
            </div>
          </div>

          <div style={{ background: "#151515", border: "1px dashed #444", padding: "10px 14px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
            <span style={{ color: "#64B5F6", fontSize: "13px", direction: "ltr", wordBreak: "break-all" }}>
              {getPortalUrl()}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleCopyPortalLink}
                style={{
                  background: copiedLink ? "#4CAF50" : "#333",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                {copiedLink ? "✓ تم النسخ" : "📋 نسخ الرابط"}
              </button>
              <button
                onClick={() => window.open("/student-portal", "_blank")}
                style={{
                  background: "#2196F3",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                🌐 فتح البوابة
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Instructor Gallery & Submissions */}
        <div
          style={{
            background: "#222",
            border: "1px solid #333",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "16px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "rgba(76, 175, 80, 0.2)", color: "#4CAF50", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                🖼️
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>معرض وفحص أعمال ومشاريع الطلاب</div>
                <div style={{ color: "#888", fontSize: "12px" }}>خاص بالسادة المعيدين والمدرسين لفحص الأعمال، فك قفل الصور، والتقييم وتحميل تقرير الـ PDF.</div>
              </div>
            </div>

            <button
              onClick={() => { onClose(); window.open("/instructor", "_blank"); }}
              style={{
                background: "#4CAF50",
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              🎨 الانتقال للمعرض
            </button>
          </div>
        </div>

        {/* Section 3: Admin Portal Control & Audit Logs (Primary Admin Only) */}
        {user?.role === "مدير" && (
          <div
            style={{
              background: "#222",
              border: "1px solid #333",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "16px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "rgba(156, 39, 176, 0.2)", color: "#AB47BC", width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                  🛡️
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px" }}>لوحة إدارة حسابات الطلاب المركزية (Admin Portal)</div>
                  <div style={{ color: "#888", fontSize: "12px" }}>متابعة سجلات التدقيق (Audit Logs)، فك ارتباط الأجهزة المقفولة، وإلغاء أو إعادة تعيين الحسابات.</div>
                </div>
              </div>

              <button
                onClick={() => { onClose(); window.open("/admin-portal", "_blank"); }}
                style={{
                  background: "#7B1FA2",
                  color: "#fff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                ⚙️ فتح لوحة التحكم
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
