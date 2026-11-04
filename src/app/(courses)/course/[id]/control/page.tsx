"use client";

import { useRouter } from "next/navigation";
import { use } from "react";

export default function ControlPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);

  return (
    <div style={{ padding: "0", maxWidth: "800px", margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", background: "#121212" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#1e1e1e", borderBottom: "1px solid #333", direction: "rtl" }}>
        <button className="hide-on-mobile" onClick={() => router.push(`/course/${resolvedParams.id}`)} style={{ background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>
          🡲
        </button>
        <h2 style={{ margin: 0, color: "#F44336", fontSize: "18px" }}>بوابة الكنترول (قيد الإنشاء)</h2>
        <div style={{ width: "24px" }}></div>
      </div>

      <div style={{ padding: "40px 20px", textAlign: "center", direction: "rtl", color: "#fff" }}>
        <div style={{ fontSize: "60px", marginBottom: "20px" }}>🛡️</div>
        <h2 style={{ color: "#F44336" }}>بوابة الكنترول قيد الإعداد</h2>
        <p style={{ color: "#aaa", lineHeight: 1.6 }}>
          يجري العمل على برمجة بوابة الكنترول المغلقة بكلمة مرور.
        </p>
      </div>

    </div>
  );
}
