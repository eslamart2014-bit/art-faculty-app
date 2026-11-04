"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import QRCode from "react-qr-code";
import { Search, Download, CheckCircle2, RotateCcw } from "lucide-react";
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
        background: "radial-gradient(ellipse at top, #0d1527 0%, #060a12 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
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
            gap: "8px",
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            padding: "6px 14px",
            borderRadius: "999px",
            fontSize: "12.5px",
            color: "#38bdf8",
            fontWeight: "bold",
            marginBottom: "8px"
          }}>
            <span>🎓</span>
            <span>جامعة قنا • كلية التربية النوعية</span>
          </div>
          <h1 style={{
            fontSize: "20px",
            fontWeight: "900",
            color: "#ffffff",
            margin: "0 0 4px 0"
          }}>
            قسم التربية الفنية
          </h1>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
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
              paddingBottom: "10px",
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
                      background: active ? "#38bdf8" : "rgba(255, 255, 255, 0.05)",
                      color: active ? "#070b14" : "#94a3b8",
                      border: active ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "20px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: active ? "bold" : "normal",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
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
                placeholder="🔍 اكتب اسمك للبحث عن بطاقتك..."
                style={{
                  width: "100%",
                  background: "#0e1626",
                  border: "2px solid #1e293b",
                  borderRadius: "14px",
                  padding: "14px 44px 14px 16px",
                  fontSize: "14px",
                  color: "#ffffff",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.2s ease"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#38bdf8")}
                onBlur={(e) => (e.target.style.borderColor = "#1e293b")}
                autoFocus
              />
              <Search
                size={18}
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                  pointerEvents: "none"
                }}
              />
            </div>

            {/* Results or Helper Guide */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#38bdf8" }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  border: "3px solid rgba(56, 189, 248, 0.2)",
                  borderTopColor: "#38bdf8",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 10px"
                }} />
                <div style={{ fontSize: "13px" }}>جاري البحث في قاعدة البيانات...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : results.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>
                  اضغط على اسمك لعرض بطاقتك الجامعية:
                </div>
                {results.map((st) => (
                  <div
                    key={st.student_code}
                    onClick={() => setSelectedStudent(st)}
                    style={{
                      background: "rgba(15, 23, 42, 0.85)",
                      border: "1px solid rgba(56, 189, 248, 0.2)",
                      borderRadius: "12px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f8fafc" }}>
                        {st.full_name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                        {st.academic_year} {st.section ? `• سكشن ${st.section}` : ""}
                      </div>
                    </div>
                    <div style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38bdf8",
                      fontSize: "12px",
                      fontWeight: "bold",
                      padding: "4px 10px",
                      borderRadius: "8px"
                    }}>
                      عرض الكارت 🪪
                    </div>
                  </div>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <div style={{
                textAlign: "center",
                padding: "36px 16px",
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: "16px",
                border: "1px dashed rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔍</div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#e2e8f0" }}>
                  لم يتم العثور على طالب بهذا الاسم
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  تأكد من كتابة الاسم صحيحاً كما هو مسجل في كشوف الكلية
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "36px 16px",
                background: "rgba(15, 23, 42, 0.5)",
                borderRadius: "16px",
                border: "1px dashed rgba(255, 255, 255, 0.1)"
              }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🪪</div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#e2e8f0" }}>
                  شاشة استخراج بطاقة الحضور الرسمية
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", lineHeight: 1.5 }}>
                  اكتب اسمك في حقل البحث أعلاه لاستخراج رمز الـ QR الخاص بك بدقة فائقة وحفظه مباشرة على هاتفك.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* QR Card Display View */
          <div>
            <div style={{
              background: "linear-gradient(135deg, #0e1626, #152238)",
              border: "2px solid #3b82f6",
              borderRadius: "20px",
              padding: "20px 16px",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
              marginBottom: "16px"
            }}>
              <div style={{ fontSize: "13px", color: "#93c5fd", fontWeight: "bold", marginBottom: "2px" }}>
                جامعة قنا • كلية التربية النوعية
              </div>
              <div style={{ fontSize: "12px", color: "#38bdf8", marginBottom: "14px" }}>
                قسم التربية الفنية
              </div>

              {/* White Container for High Contrast QR */}
              <div style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "18px",
                display: "inline-block",
                marginBottom: "16px",
                boxShadow: "0 8px 25px rgba(0, 0, 0, 0.45)"
              }}>
                <QRCode
                  id="student-tg-qr-svg"
                  value={`كود الطالب: ${formatStudentCode(selectedStudent.student_code)}\nاسم الطالب: ${selectedStudent.full_name}`}
                  size={220}
                  level="H"
                />
              </div>

              {/* Student Info */}
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "#ffffff", marginBottom: "4px" }}>
                {selectedStudent.full_name}
              </div>
              <div style={{ fontSize: "13px", color: "#60a5fa", marginBottom: "8px" }}>
                {selectedStudent.academic_year || "طالب بالكلية"} {selectedStudent.section ? `• سكشن ${selectedStudent.section}` : ""}
              </div>
              <div style={{
                display: "inline-block",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                padding: "4px 14px",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#fbbf24",
                fontWeight: "bold",
                fontFamily: "monospace"
              }}>
                الكود: {formatStudentCode(selectedStudent.student_code)}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={downloadCardAsImage}
                disabled={downloading}
                style={{
                  width: "100%",
                  background: downloadSuccess ? "#10b981" : "linear-gradient(135deg, #0284c7, #2563eb)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "14px",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: downloading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 15px rgba(37, 99, 235, 0.35)",
                  transition: "all 0.2s ease"
                }}
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>تم حفظ البطاقة بنجاح! 🎉</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>{downloading ? "جاري تحضير البطاقة..." : "تحميل البطاقة كصورة على الهاتف 📥"}</span>
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
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "14px",
                  padding: "12px",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                <RotateCcw size={16} />
                <span>بحث عن طالب آخر 🔍</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
