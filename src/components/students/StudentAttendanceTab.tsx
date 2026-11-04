"use client";

import React from "react";
import { CalendarCheck } from "lucide-react";

interface StudentAttendanceTabProps {
  attendance?: any[];
}

export default function StudentAttendanceTab({ attendance }: StudentAttendanceTabProps) {
  return (
    <div className="animate-fade-in">
      <h3 style={{ fontSize: "13.5px", color: "#fff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
        <CalendarCheck size={16} color="#38bdf8" />
        <span>سجلات حضور المحاضرات والسكاشن:</span>
      </h3>

      {attendance && attendance.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {attendance.map((c: any) => (
            <div key={c.courseId} className="glass-card" style={{ padding: "12px", borderRadius: "12px" }}>
              {/* رأس المقرر بدون نسبة الحضور */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13.5px" }}>{c.courseName}</span>
                  {(c.instructorTitle || c.instructorName) && (
                    <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "normal" }}>
                      👨‍🏫 أستاذ المقرر: {c.instructorTitle || c.instructorName}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: "10.5px",
                  color: "#38bdf8",
                  background: "rgba(56, 189, 248, 0.12)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  border: "1px solid rgba(56, 189, 248, 0.25)"
                }}>
                  {c.courseType === 'sections' ? 'سكشن عملي' : 'محاضرة'}
                </span>
              </div>

              {/* بطاقتان فقط متساويتان: حضور ✅ وغياب ❌ (بدون نسبة) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                {/* بطاقة الحضور */}
                <div style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  borderRadius: "10px",
                  padding: "6px 4px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "bold", color: "#34d399", marginBottom: "1px" }}>
                    حضور ✅
                  </span>
                  <span style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", lineHeight: "1.1" }}>
                    {c.attended}
                  </span>
                  <span style={{ fontSize: "10px", color: "#a7f3d0", marginTop: "1px" }}>
                    {c.courseType === 'sections' ? 'سكشن' : 'محاضرة'}
                  </span>
                </div>

                {/* بطاقة الغياب */}
                <div style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "10px",
                  padding: "6px 4px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "11.5px", fontWeight: "bold", color: "#f87171", marginBottom: "1px" }}>
                    غياب ❌
                  </span>
                  <span style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", lineHeight: "1.1" }}>
                    {c.absent}
                  </span>
                  <span style={{ fontSize: "10px", color: "#fca5a5", marginTop: "1px" }}>
                    {c.excused > 0 ? `(${c.excused} عذر)` : (c.courseType === 'sections' ? 'سكشن' : 'محاضرة')}
                  </span>
                </div>
              </div>

              {/* جدول تواريخ الحضور بشكل تلقائي تحت كل مقرر بدون أزرار فتح/إغلاق */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "8px" }}>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px" }}>
                  📅 سجل التواريخ المفصلة:
                </div>
                {c.records && c.records.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {c.records.map((rec: any, rIdx: number) => {
                      const isPresent = rec.status === "حاضر";
                      const isExcused = rec.status === "إذن" || rec.status === "عذر";
                      return (
                        <div
                          key={rIdx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: isPresent ? "rgba(16, 185, 129, 0.08)" : isExcused ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.08)",
                            border: isPresent ? "1px solid rgba(16, 185, 129, 0.2)" : isExcused ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            fontSize: "11px"
                          }}
                        >
                          <span style={{ color: "#ffffff", fontWeight: "600", fontSize: "11px" }}>
                            📅 {rec.formattedDate || rec.date}
                          </span>
                          <span style={{
                            fontWeight: "bold",
                            fontSize: "10.5px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: isPresent ? "rgba(16, 185, 129, 0.25)" : isExcused ? "rgba(245, 158, 11, 0.25)" : "rgba(239, 68, 68, 0.25)",
                            color: isPresent ? "#34d399" : isExcused ? "#fbbf24" : "#f87171"
                          }}>
                            {isPresent ? "حاضر ✅" : isExcused ? "عذر 📝" : "غائب ❌"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "#64748b", fontSize: "10.5px", textAlign: "center", padding: "6px" }}>
                    لا توجد تواريخ تفصيلية مسجلة بعد.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
          لا توجد سجلات حضور مسجلة لك حتى الآن.
        </div>
      )}
    </div>
  );
}
