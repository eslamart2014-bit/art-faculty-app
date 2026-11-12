"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import QRCode from "react-qr-code";
import { Search, Download, CheckCircle2, RotateCcw, GraduationCap, QrCode } from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";

const LEVELS = [
  "الكل",
  "الفرقة الأولى",
  "الفرقة الثانية",
  "الفرقة الثالثة",
  "الفرقة الرابعة"
];

interface StudentResult {
  full_name: string;
  student_code: string;
  academic_year: string;
  section: string;
}

export default function TelegramQrLookupPage() {
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("الكل");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Telegram WebApp if available
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      try {
        const tg = (window as any).Telegram.WebApp;
        tg.ready();
        tg.expand();
      } catch (e) {}
    }
  }, []);

  // Real-time search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const clean = query.trim();
    if (clean.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("q", clean);
        if (selectedLevel !== "الكل") params.set("level", selectedLevel);

        const res = await fetch(`/api/students/search?${params.toString()}`);
        const data = await res.json();
        setResults(data.students || []);
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, selectedLevel]);

  // Download QR ID card as high-resolution PNG
  const downloadCardAsImage = () => {
    if (!selectedStudent || downloading) return;
    setDownloading(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1400;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // 1. خلفية داكنة فخمة متدرجة
      const bgGrad = ctx.createLinearGradient(0, 0, 1000, 1400);
      bgGrad.addColorStop(0, "#070b14");
      bgGrad.addColorStop(0.5, "#0d1526");
      bgGrad.addColorStop(1, "#080c16");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1400);

      // 2. شريط علوي ملون متدرج
      const topBar = ctx.createLinearGradient(0, 0, 1000, 0);
      topBar.addColorStop(0, "#3b82f6");
      topBar.addColorStop(0.5, "#06b6d4");
      topBar.addColorStop(1, "#10b981");
      ctx.fillStyle = topBar;
      ctx.fillRect(0, 0, 1000, 24);

      // 3. إطار البطاقة الأنيق
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 45, 940, 1315);

      // 4. الترويسة الأكاديمية الرسمية
      ctx.textAlign = "center";
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 30px Cairo, sans-serif";
      ctx.fillText("جامعة قنا • كلية التربية النوعية", 500, 85);
      ctx.font = "bold 24px Cairo, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("قسم التربية الفنية • المنظومة الذكية", 500, 122);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 145);
      ctx.lineTo(900, 145);
      ctx.stroke();

      // 5. عنوان البطاقة
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 36px Cairo, sans-serif";
      ctx.fillText("بطاقة الهوية الرقمية للطالب", 500, 190);

      // 6. حاوية الـ QR البيضاء (كبيرة جداً وسريعة المسح)
      const qrBoxSize = 720;
      const qrBoxX = (1000 - qrBoxSize) / 2;
      const qrBoxY = 215;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fill();

      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 4;
      ctx.stroke();

      // 7. استخراج رمز الـ QR ورسمه في الحاوية
      const svgElement = document.getElementById("student-tg-qr-svg");
      if (svgElement) {
        const svgXml = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
        const blobUrl = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
          const qrPadding = 36;
          ctx.drawImage(
            img,
            qrBoxX + qrPadding,
            qrBoxY + qrPadding,
            qrBoxSize - qrPadding * 2,
            qrBoxSize - qrPadding * 2
          );
          URL.revokeObjectURL(blobUrl);

          // 8. رسم بيانات الطالب بالأسفل
          ctx.fillStyle = "#ffffff";
          ctx.font = "900 36px Cairo, sans-serif";
          ctx.fillText(selectedStudent.full_name, 500, 1000);

          ctx.fillStyle = "#60a5fa";
          ctx.font = "bold 28px Cairo, sans-serif";
          const secText = selectedStudent.section ? ` • سكشن ${selectedStudent.section}` : "";
          ctx.fillText(`${selectedStudent.academic_year || "طالب بالكلية"}${secText}`, 500, 1050);

          // 9. مربع الكود المميز
          const codeStr = `الكود الأكاديمي: ${formatStudentCode(selectedStudent.student_code)}`;
          ctx.font = "bold 32px monospace";
          const textMetrics = ctx.measureText(codeStr);
          const badgeWidth = textMetrics.width + 70;
          const badgeX = (1000 - badgeWidth) / 2;

          ctx.fillStyle = "#1e293b";
          ctx.beginPath();
          ctx.roundRect(badgeX, 1100, badgeWidth, 68, 18);
          ctx.fill();
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.fillStyle = "#fbbf24";
          ctx.fillText(codeStr, 500, 1145);

          // 10. تذييل البطاقة
          ctx.fillStyle = "#64748b";
          ctx.font = "20px Cairo, sans-serif";
          ctx.fillText("المنظومة الرقمية الذكية لإدارة الحضور والتقييمات الأكاديمية", 500, 1285);

          // 11. تصدير وتحميل الصورة
          const dataUrl = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          const safeName = selectedStudent.full_name.replace(/\s+/g, "_");
          link.download = `كارت_حضور_${safeName}_${formatStudentCode(selectedStudent.student_code)}.png`;
          link.href = dataUrl;
          link.click();

          setDownloading(false);
          setDownloadSuccess(true);
          setTimeout(() => setDownloadSuccess(false), 3000);
        };

        img.onerror = () => {
          setDownloading(false);
          alert("حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى.");
        };
        img.src = blobUrl;
      } else {
        setDownloading(false);
      }
    } catch (e) {
      setDownloading(false);
      alert("تعذر حفظ البطاقة، يرجى إعادة المحاولة.");
    }
  };

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div
        dir="rtl"
        style={{
          minHeight: "100vh",
          background: "var(--background)",
          color: "var(--text)",
          fontFamily: "inherit",
          padding: "16px",
          boxSizing: "border-box"
        }}
      >
        <div style={{ maxWidth: "460px", margin: "0 auto" }}>
          {/* Academic Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--surface)",
              border: "1px solid var(--border-light)",
              padding: "4px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              color: "var(--accent-ink)",
              fontWeight: 500,
              marginBottom: "8px"
            }}>
              <GraduationCap size={14} strokeWidth={1.5} />
              <span>جامعة قنا • كلية التربية النوعية</span>
            </div>
            <h1 style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "var(--text)",
              margin: "0 0 4px 0"
            }}>
              قسم التربية الفنية
            </h1>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: 0 }}>
              المنظومة الرقمية الذكية • استخراج بطاقة الحضور (QR)
            </p>
          </div>

          {!selectedStudent ? (
            /* Search & Filter View */
            <div>
              {/* Level Filter Pills */}
              <div style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "8px",
                marginBottom: "12px",
                scrollbarWidth: "none"
              }}>
                {LEVELS.map((lvl) => {
                  const active = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setSelectedLevel(lvl)}
                      style={{
                        background: active ? "var(--primary)" : "var(--surface)",
                        color: active ? "#ffffff" : "var(--text-secondary)",
                        border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: active ? 500 : 400,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        transition: "background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out)"
                      }}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>

              {/* Search Input Box */}
              <div style={{ position: "relative", marginBottom: "16px" }}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="اكتب اسمك للبحث عن بطاقتك..."
                  style={{
                    width: "100%",
                    background: "var(--bg-deep)",
                    border: "1.5px solid var(--border-light)",
                    borderRadius: "10px",
                    padding: "12px 42px 12px 14px",
                    fontSize: "14px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border-color 0.2s var(--ease-out)"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-ink)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")}
                  autoFocus
                />
                <Search
                  size={16}
                  strokeWidth={1.5}
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none"
                  }}
                />
              </div>

              {/* Results or Helper Guide */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--accent-ink)" }}>
                  <div style={{
                    width: "26px",
                    height: "26px",
                    border: "2.5px solid var(--border-light)",
                    borderTopColor: "var(--accent-ink)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 10px"
                  }} />
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>جاري البحث في قاعدة البيانات...</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : results.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    اضغط على اسمك لعرض بطاقتك الجامعية:
                  </div>
                  {results.map((st) => (
                    <div
                      key={st.student_code}
                      onClick={() => setSelectedStudent(st)}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        transition: "border-color 0.2s var(--ease-out), background-color 0.2s var(--ease-out)"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                          {st.full_name}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "3px" }}>
                          {st.academic_year} {st.section ? `• سكشن ${st.section}` : ""}
                        </div>
                      </div>
                      <div style={{
                        background: "rgba(56, 189, 248, 0.12)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        color: "var(--accent-ink)",
                        fontSize: "12px",
                        fontWeight: 500,
                        padding: "5px 10px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0
                      }}>
                        <QrCode size={14} strokeWidth={1.5} />
                        <span>عرض الكارت</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.trim().length >= 2 ? (
                <div style={{
                  textAlign: "center",
                  padding: "32px 16px",
                  background: "var(--surface)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-light)"
                }}>
                  <Search size={28} strokeWidth={1.5} color="var(--text-muted)" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                    لم يتم العثور على طالب بهذا الاسم
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    تأكد من كتابة الاسم صحيحاً كما هو مسجل في كشوف الكلية
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "32px 16px",
                  background: "var(--surface)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-light)"
                }}>
                  <QrCode size={32} strokeWidth={1.5} color="var(--accent-ink)" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
                    شاشة استخراج بطاقة الحضور الرسمية
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: 1.55 }}>
                    اكتب اسمك في حقل البحث أعلاه لاستخراج رمز الـ QR الخاص بك بدقة فائقة وحفظه مباشرة على هاتفك.
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* QR Card Display View */
            <div>
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border-light)",
                borderRadius: "16px",
                padding: "20px 16px",
                textAlign: "center",
                marginBottom: "16px"
              }}>
                <div style={{ fontSize: "13px", color: "var(--accent-ink)", fontWeight: 600, marginBottom: "2px" }}>
                  جامعة قنا • كلية التربية النوعية
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  قسم التربية الفنية
                </div>

                {/* White Container for High Contrast QR */}
                <div style={{
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "12px",
                  display: "inline-block",
                  marginBottom: "16px",
                  border: "1px solid var(--border)"
                }}>
                  <QRCode
                    id="student-tg-qr-svg"
                    value={`كود الطالب: ${formatStudentCode(selectedStudent.student_code)}\nاسم الطالب: ${selectedStudent.full_name}`}
                    size={220}
                    level="H"
                  />
                </div>

                {/* Student Info */}
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                  {selectedStudent.full_name}
                </div>
                <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--accent-ink)", marginBottom: "10px" }}>
                  {selectedStudent.academic_year || "طالب بالكلية"} {selectedStudent.section ? `• سكشن ${selectedStudent.section}` : ""}
                </div>
                <div className="tabular-nums" style={{
                  display: "inline-block",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  padding: "4px 12px",
                  borderRadius: "6px",
                  fontSize: "13.5px",
                  color: "var(--warning-ink)",
                  fontWeight: 600
                }}>
                  الكود: {formatStudentCode(selectedStudent.student_code)}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={downloadCardAsImage}
                  disabled={downloading}
                  style={{
                    width: "100%",
                    background: downloadSuccess ? "var(--success)" : "var(--primary)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: downloading ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s var(--ease-out)"
                  }}
                >
                  {downloadSuccess ? (
                    <>
                      <CheckCircle2 size={18} strokeWidth={1.5} />
                      <span>تم حفظ البطاقة بنجاح</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} strokeWidth={1.5} />
                      <span>{downloading ? "جاري تحضير البطاقة..." : "تحميل البطاقة كصورة على الهاتف"}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setQuery("");
                  }}
                  style={{
                    width: "100%",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "13.5px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: "pointer"
                  }}
                >
                  <RotateCcw size={16} strokeWidth={1.5} />
                  <span>بحث عن طالب آخر</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
