"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { ArrowRight, Shield } from "lucide-react";

export default function ControlPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--background)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", direction: "rtl" }}>
        <button
          type="button"
          className="hide-on-mobile btn-compact"
          onClick={() => router.push(`/course/${resolvedParams.id}`)}
          style={{
            background: "var(--surface-hover)",
            border: "1px solid var(--border-light)",
            color: "var(--text)",
            padding: "6px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 500,
            margin: 0
          }}
        >
          <ArrowRight size={15} strokeWidth={1.5} />
          <span>عودة</span>
        </button>
        <h2 style={{ margin: 0, color: "var(--error-ink)", fontSize: "16px", fontWeight: 600 }}>بوابة الكنترول (قيد الإنشاء)</h2>
        <div style={{ width: "60px" }}></div>
      </div>

      <div style={{ padding: "48px 20px", textAlign: "center", direction: "rtl", color: "var(--text)" }}>
        <div style={{
          width: "64px",
          height: "64px",
          borderRadius: "16px",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--error-ink)",
          marginBottom: "16px"
        }}>
          <Shield size={32} strokeWidth={1.5} />
        </div>
        <h2 style={{ color: "var(--text)", fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0" }}>بوابة الكنترول قيد الإعداد</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
          يجري العمل على برمجة بوابة الكنترول المغلقة بكلمة مرور.
        </p>
      </div>

    </div>
  );
}
