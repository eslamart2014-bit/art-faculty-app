"use client";

import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface StudentWarningsTabProps {
  warnings?: any[];
}

export default function StudentWarningsTab({ warnings }: StudentWarningsTabProps) {
  return (
    <div className="animate-fade-in">
      <h3 style={{ fontSize: "15px", color: "#f87171", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <AlertTriangle size={18} />
        <span>إنذارات الغياب وتجاوز النسبة المقررة:</span>
      </h3>

      {warnings && warnings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {warnings.map((w: any) => (
            <div
              key={w.courseId}
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "14px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#fca5a5", fontWeight: "bold", fontSize: "15px" }}>
                  ⚠️ إنذار غياب رسمي: {w.courseName}
                  {(w.instructorTitle || w.instructorName) && (
                    <span style={{ fontSize: "11px", color: "#fecaca", fontWeight: "normal", marginRight: "6px" }}>
                      ({w.instructorTitle || w.instructorName})
                    </span>
                  )}
                </div>
                <span style={{ background: "#ef4444", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "6px" }}>
                  مستوى الخطر 🚨
                </span>
              </div>

              <div style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.5" }}>
                لقد تجاوزت الحد الأقصى للغياب في هذا المقرر، حيث سُجل لك <b>{w.absent}</b> مرات غياب (الحد المسموح به: {w.warningLimit || 3} مرات).
              </div>

              {w.absentDates && w.absentDates.length > 0 && (
                <div style={{ background: "rgba(0,0,0,0.25)", padding: "8px 12px", borderRadius: "8px", fontSize: "11px", color: "#fca5a5" }}>
                  📌 تواريخ الغياب المسجلة: {w.absentDates.join(" ، ")}
                </div>
              )}

              <div style={{ color: "#f87171", fontSize: "11px", fontWeight: "600", borderTop: "1px solid rgba(239, 68, 68, 0.2)", paddingTop: "8px" }}>
                يرجى مراجعة أستاذ المقرر وإدارة الكلية فوراً تجنباً لتطبيق عقوبة الحرمان من دخول الامتحان النهائي.
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: "34px 20px", textAlign: "center", color: "#34d399", borderRadius: "14px" }}>
          <CheckCircle2 size={42} color="#10b981" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>سجلك الأكاديمي ممتاز!</div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "6px" }}>
            لا توجد أي إنذارات غياب مسجلة بحقك، ونسبة حضورك ضمن المعدل النظامي المسموح به.
          </div>
        </div>
      )}
    </div>
  );
}
