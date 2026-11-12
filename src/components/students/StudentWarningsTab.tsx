"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Pin } from "lucide-react";

interface StudentWarningsTabProps {
  warnings?: any[];
}

export default function StudentWarningsTab({ warnings }: StudentWarningsTabProps) {
  return (
    <div className="animate-fade-in">
      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--error-ink)", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
        <AlertTriangle size={16} strokeWidth={1.5} />
        <span>إنذارات الغياب وتجاوز النسبة المقررة:</span>
      </h3>

      {warnings && warnings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {warnings.map((w: any) => (
            <div
              key={w.courseId}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div style={{ color: "var(--error-ink)", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <AlertTriangle size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span>إنذار غياب رسمي: {w.courseName}</span>
                  {(w.instructorTitle || w.instructorName) && (
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 400 }}>
                      ({w.instructorTitle || w.instructorName})
                    </span>
                  )}
                </div>
                <span style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "var(--error-ink)", fontSize: "11px", fontWeight: 600, padding: "4px 8px", borderRadius: "6px", flexShrink: 0 }}>
                  مستوى الخطر
                </span>
              </div>

              <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: 1.55 }}>
                لقد تجاوزت الحد الأقصى للغياب في هذا المقرر، حيث سُجل لك <strong style={{ fontWeight: 600, color: "var(--text)" }}>{w.absent}</strong> مرات غياب (الحد المسموح به: {w.warningLimit || 3} مرات).
              </div>

              {w.absentDates && w.absentDates.length > 0 && (
                <div className="tabular-nums" style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "var(--error-ink)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <Pin size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  <span>تواريخ الغياب المسجلة: {w.absentDates.join(" ، ")}</span>
                </div>
              )}

              <div style={{ color: "var(--error-ink)", fontSize: "12px", fontWeight: 500, borderTop: "1px solid rgba(239, 68, 68, 0.2)", paddingTop: "8px" }}>
                يرجى مراجعة أستاذ المقرر وإدارة الكلية فوراً تجنباً لتطبيق عقوبة الحرمان من دخول الامتحان النهائي.
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: "32px 20px", textAlign: "center", color: "var(--success-ink)", borderRadius: "12px" }}>
          <CheckCircle2 size={36} strokeWidth={1.5} color="var(--success)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 600, fontSize: "15px" }}>سجلك الأكاديمي ممتاز</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "6px" }}>
            لا توجد أي إنذارات غياب مسجلة بحقك، ونسبة حضورك ضمن المعدل النظامي المسموح به.
          </div>
        </div>
      )}
    </div>
  );
}
