"use client";

import React from "react";
import { Calendar, CalendarCheck, CheckCircle2, FileText, User, XCircle } from "lucide-react";

interface StudentAttendanceTabProps {
  attendance?: any[];
}

export default function StudentAttendanceTab({ attendance }: StudentAttendanceTabProps) {
  return (
    <div className="animate-fade-in">
      <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
        <CalendarCheck size={16} strokeWidth={1.5} color="var(--accent-ink)" />
        <span>سجلات حضور المحاضرات والسكاشن:</span>
      </h3>

      {attendance && attendance.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {attendance.map((c: any) => (
            <div key={c.courseId} className="glass-card" style={{ padding: "16px", borderRadius: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px" }}>{c.courseName}</span>
                  {(c.instructorTitle || c.instructorName) && (
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 400, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <User size={12} strokeWidth={1.5} />
                      <span>أستاذ المقرر: {c.instructorTitle || c.instructorName}</span>
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--accent-ink)",
                  background: "rgba(56, 189, 248, 0.1)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  flexShrink: 0
                }}>
                  {c.courseType === 'sections' ? 'سكشن عملي' : 'محاضرة'}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                <div style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.28)",
                  borderRadius: "8px",
                  padding: "8px 6px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--success-ink)", marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={13} strokeWidth={1.5} />
                    <span>حضور</span>
                  </span>
                  <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", lineHeight: 1.1 }}>
                    {c.attended}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {c.courseType === 'sections' ? 'سكشن' : 'محاضرة'}
                  </span>
                </div>

                <div style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.28)",
                  borderRadius: "8px",
                  padding: "8px 6px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--error-ink)", marginBottom: "2px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <XCircle size={13} strokeWidth={1.5} />
                    <span>غياب</span>
                  </span>
                  <span className="tabular-nums" style={{ fontSize: "20px", fontWeight: 600, color: "var(--text)", lineHeight: 1.1 }}>
                    {c.absent}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                    {c.excused > 0 ? `(${c.excused} عذر)` : (c.courseType === 'sections' ? 'سكشن' : 'محاضرة')}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={13} strokeWidth={1.5} />
                  <span>سجل التواريخ المفصلة:</span>
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
                            padding: "6px 10px",
                            borderRadius: "6px",
                            fontSize: "12px"
                          }}
                        >
                          <span className="tabular-nums" style={{ color: "var(--text)", fontWeight: 500, fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                            <Calendar size={12} strokeWidth={1.5} color="var(--text-secondary)" />
                            <span>{rec.formattedDate || rec.date}</span>
                          </span>
                          <span style={{
                            fontWeight: 500,
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: isPresent ? "rgba(16, 185, 129, 0.2)" : isExcused ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: isPresent ? "var(--success-ink)" : isExcused ? "var(--warning-ink)" : "var(--error-ink)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            {isPresent ? <CheckCircle2 size={12} strokeWidth={1.5} /> : isExcused ? <FileText size={12} strokeWidth={1.5} /> : <XCircle size={12} strokeWidth={1.5} />}
                            <span>{isPresent ? "حاضر" : isExcused ? "عذر" : "غائب"}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "12px", textAlign: "center", padding: "8px" }}>
                    لا توجد تواريخ تفصيلية مسجلة بعد.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card" style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px" }}>
          لا توجد سجلات حضور مسجلة لك حتى الآن.
        </div>
      )}
    </div>
  );
}
