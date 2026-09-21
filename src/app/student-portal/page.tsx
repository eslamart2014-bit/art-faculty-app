"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { 
  Search, 
  Download, 
  Sparkles, 
  ArrowRight, 
  Camera, 
  CheckCircle2, 
  GraduationCap, 
  Layers, 
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";

const LEVELS = [
  "الكل",
  "الفرقة الأولى",
  "الفرقة الثانية",
  "الفرقة الثالثة",
  "الفرقة الرابعة"
];

export default function HomePage() {
  const [level, setLevel] = useState("الكل");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // البحث التلقائي المؤخر (Debounced) - فقط عند إدخال حرفين على الأقل
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchStudents();
      } else {
        setStudents([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, level]);

  const searchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(query)}&level=${encodeURIComponent(level)}`);
      const data = await res.json();
      if (data.students) {
        setStudents(data.students);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // توليد نص الـ QR المتطابق 100% مع ماسح النظام الرئيسي
  const getQRValue = (st: any) => {
    return `اسم الطالب: ${st.full_name}\nكود الطالب: ${st.student_code}\nالفرقة: ${st.academic_year}\nالسكشن: ${st.section || 'عام'}`;
  };

  // تحميل البطاقة كصورة PNG عالية الدقة بضغطة زر
  const downloadCardAsImage = async () => {
    if (!selectedStudent) return;
    setDownloading(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 1000;
      canvas.height = 1400;

      // خلفية متدرجة فخمة
      const gradient = ctx.createLinearGradient(0, 0, 1000, 1400);
      gradient.addColorStop(0, "#0e1626");
      gradient.addColorStop(0.5, "#152238");
      gradient.addColorStop(1, "#0a0f1d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1000, 1400);

      // برواز علوي ملون
      const topBar = ctx.createLinearGradient(0, 0, 1000, 0);
      topBar.addColorStop(0, "#3b82f6");
      topBar.addColorStop(0.5, "#06b6d4");
      topBar.addColorStop(1, "#10b981");
      ctx.fillStyle = topBar;
      ctx.fillRect(0, 0, 1000, 24);

      // إطار البطاقة الأنيق
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 45, 940, 1315);

      // الترويسة الأكاديمية
      ctx.textAlign = "center";
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 32px Cairo, sans-serif";
      ctx.fillText("جامعة قنا • كلية التربية النوعية", 500, 100);
      ctx.font = "bold 26px 'Cairo', sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("قسم التربية الفنية • المنظومة الذكية", 500, 145);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 175);
      ctx.lineTo(900, 175);
      ctx.stroke();

      // عنوان البطاقة
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 44px Cairo, sans-serif";
      ctx.fillText("بطاقة الهوية الرقمية للطالب", 500, 245);

      // رسم حاوية الـ QR البيضاء
      const qrBoxSize = 520;
      const qrBoxX = (1000 - qrBoxSize) / 2;
      const qrBoxY = 290;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fill();

      // استخراج صورة الـ QR من العنصر
      const svgElement = document.getElementById("student-qr-svg");
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);

        const qrImg = new Image();
        await new Promise((resolve) => {
          qrImg.onload = () => {
            ctx.drawImage(qrImg, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60);
            resolve(true);
          };
          qrImg.src = blobURL;
        });
      }

      // بيانات الطالب تحت الـ QR
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 44px Cairo, sans-serif";
      ctx.fillText(selectedStudent.full_name, 500, 890);

      // شارة الفرقة والسكشن
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.roundRect(250, 930, 500, 65, 30);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 30px Cairo, sans-serif";
      ctx.fillText(`${selectedStudent.academic_year} • سكشن ${selectedStudent.section || 'عام'}`, 500, 974);

      // كود الطالب البارز
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 28px Cairo, sans-serif";
      ctx.fillText("الكود الجامعي المعتمد", 500, 1050);

      ctx.fillStyle = "#f59e0b";
      ctx.font = "900 64px monospace, Cairo";
      ctx.fillText(formatStudentCode(selectedStudent.student_code), 500, 1120);

      // تعليمات التنبيه
      ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
      ctx.beginPath();
      ctx.roundRect(100, 1170, 800, 80, 16);
      ctx.fill();

      ctx.fillStyle = "#34d399";
      ctx.font = "bold 24px Cairo, sans-serif";
      ctx.fillText("📸 احتفظ بهذه البطاقة في معرض الصور لتسجيل حضورك وتقييمك يومياً", 500, 1220);

      // ذيل البطاقة
      ctx.fillStyle = "#64748b";
      ctx.font = "20px Cairo, sans-serif";
      ctx.fillText("نظام التربية الفنية الجديد • مطور المنظومة: د/ إسلام عبد اللطيف حسن", 500, 1320);

      // التنزيل المباشر
      const link = document.createElement("a");
      link.download = `بطاقة_طالب_${selectedStudent.student_code}_${selectedStudent.full_name.split(" ")[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
      alert("تعذر تنزيل الصورة، يرجى أخذ لقطة شاشة (Screenshot)");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", maxWidth: "480px", margin: "0 auto" }}>
      
      {/* الرأس والترويسة */}
      <div>
        <header style={{ textAlign: "center", paddingTop: "15px", marginBottom: "20px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "64px", height: "64px", borderRadius: "18px", overflow: "hidden", marginBottom: "12px", boxShadow: "0 8px 25px rgba(37, 99, 235, 0.4)" }}>
            <img src="/icon-192.png" alt="بوابة فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px", marginBottom: "4px" }}>
            بوابة فنية
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            المنظومة الرقمية الذكية لطلاب جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
          </p>
        </header>

        {/* عرض البطاقة المستخرجة إن وُجدت */}
        {selectedStudent ? (
          <div className="animate-fade-in" style={{ marginBottom: "24px" }}>
            <div className="student-id-card" ref={cardRef} style={{ padding: "26px 20px", textAlign: "center" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "4px" }}>
                <span style={{ fontSize: "11px", color: "#c7d2fe", fontWeight: "bold" }}>جامعة قنا</span>
                <span style={{ fontSize: "11px", color: "#93c5fd", fontWeight: "bold" }}>كلية التربية النوعية</span>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: "bold" }}>قسم التربية الفنية</span>
              </div>

              {/* حاوية الـ QR */}
              <div style={{ background: "#ffffff", padding: "16px", borderRadius: "20px", display: "inline-block", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", margin: "8px 0 16px 0" }}>
                <QRCode 
                  id="student-qr-svg"
                  value={getQRValue(selectedStudent)} 
                  size={200}
                  level="H"
                />
              </div>

              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#ffffff", marginBottom: "6px" }}>
                {selectedStudent.full_name}
              </h2>

              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", padding: "5px 14px", borderRadius: "20px", fontSize: "13px", fontWeight: "bold", marginBottom: "10px" }}>
                <Layers size={14} />
                <span>{selectedStudent.academic_year} • سكشن {selectedStudent.section || 'عام'}</span>
              </div>

              <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "16px" }}>
                الكود الجامعي: <span style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "900", fontSize: "20px", letterSpacing: "1px" }}>{formatStudentCode(selectedStudent.student_code)}</span>
              </div>

              {/* تنبيه لقطة الشاشة والحفظ */}
              <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px dashed rgba(245, 158, 11, 0.4)", padding: "12px", borderRadius: "12px", textAlign: "right", marginBottom: "18px" }}>
                <p style={{ color: "#fbbf24", fontSize: "12px", lineHeight: "1.6", margin: 0 }}>
                  📸 <b>هام جداً:</b> اضغط زر التحميل أدناه لحفظ البطاقة في هاتفك أو التقط لقطة شاشة (Screenshot). ستحتاجها يومياً لتسجيل حضورك وتقييمك في المحاضرات والسكاشن.
                </p>
              </div>

              {/* أزرار العمليات على البطاقة */}
              <div>
                <button 
                  onClick={downloadCardAsImage}
                  disabled={downloading}
                  className="btn-primary"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", width: "100%", padding: "14px", fontSize: "14px" }}
                >
                  <Download size={18} />
                  <span>{downloading ? "جاري تجهيز الصورة..." : "تحميل البطاقة كصورة (PNG)"}</span>
                </button>

                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "13px", textDecoration: "underline" }}
                  >
                    استخراج بطاقة لطالب آخر
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px", marginTop: "16px", color: "#64748b", fontSize: "10px" }}>
                مطور النظام: د/ إسلام عبد اللطيف حسن
              </div>
            </div>
          </div>
        ) : (
          /* صندوق البحث واختيار الفرقة */
          <div className="glass-card" style={{ padding: "22px 18px", marginBottom: "20px" }}>
            
            {/* 1. اختيار الفرقة */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                اختر الفرقة الدراسية:
              </label>
              <div style={{ position: "relative" }}>
                <select 
                  value={level} 
                  onChange={(e) => setLevel(e.target.value)}
                  style={{ appearance: "none", cursor: "pointer", fontWeight: "600" }}
                >
                  {LEVELS.map(lvl => (
                    <option key={lvl} value={lvl} style={{ background: "#141b29", color: "#fff" }}>
                      {lvl}
                    </option>
                  ))}
                </select>
                <div style={{ position: "absolute", left: "14px", top: "16px", pointerEvents: "none", color: "#94a3b8" }}>
                  ▼
                </div>
              </div>
            </div>

            {/* 2. مربع البحث الذكي */}
            <div style={{ marginBottom: "12px", position: "relative" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                ابحث باسمك أو بكودك الجامعي:
              </label>
              <div style={{ position: "relative" }}>
                <input 
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="اكتب اسمك أو كودك (مثل: 0001)..."
                  style={{ paddingRight: "42px" }}
                />
                <div style={{ position: "absolute", right: "14px", top: "14px", color: "#38bdf8" }}>
                  <Search size={18} />
                </div>
                {loading && (
                  <div style={{ position: "absolute", left: "14px", top: "14px", fontSize: "12px", color: "#38bdf8" }}>
                    جاري البحث...
                  </div>
                )}
              </div>
            </div>

            {/* نتائج البحث */}
            {students.length > 0 && (
              <div className="animate-fade-in" style={{ marginTop: "14px", maxHeight: "280px", overflowY: "auto", border: "1px solid #2a374f", borderRadius: "12px", background: "#0d131f" }}>
                <div style={{ padding: "8px 14px", fontSize: "11px", color: "#94a3b8", borderBottom: "1px solid #1a2336", background: "#111a2c" }}>
                  اضغط على اسمك لاستخراج بطاقة الـ QR الرسمية:
                </div>
                {students.map((st) => (
                  <div 
                    key={st.id}
                    onClick={() => setSelectedStudent(st)}
                    style={{ padding: "14px", borderBottom: "1px solid #1a2336", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.15s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#18243b"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", marginBottom: "3px" }}>
                        {st.full_name}
                      </div>
                      <div style={{ color: "#38bdf8", fontSize: "11px", display: "flex", gap: "8px" }}>
                        <span>{st.academic_year}</span>
                        <span>•</span>
                        <span>سكشن {st.section || 'عام'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "13px" }}>
                        {formatStudentCode(st.student_code)}
                      </div>
                      <span style={{ fontSize: "11px", color: "#10b981", fontWeight: "600" }}>استخراج ←</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query.trim().length >= 1 && students.length === 0 && !loading && (
              <div style={{ marginTop: "14px", padding: "16px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", textAlign: "center", color: "#f87171", fontSize: "13px" }}>
                لم يتم العثور على أي طالب بهذا الاسم أو الكود في الفرقة المحددة!
              </div>
            )}

            {!query && (
              <div style={{ textAlign: "center", padding: "18px 0 6px 0", color: "#64748b", fontSize: "12px" }}>
                💡 ابدأ بكتابة حروف من اسمك أو أرقام كودك لتظهر بطاقتك فوراً
              </div>
            )}

          </div>
        )}
      </div>

      {/* الزر الرئيسي الكبير في أسفل الصفحة: الانتقال إلى نظام فنية */}
      <footer style={{ marginTop: "20px", marginBottom: "15px" }}>
        <Link href="/system?mode=register" style={{ textDecoration: "none" }}>
          <div 
            className="animate-glow"
            style={{ 
              background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", 
              border: "2px solid #60a5fa",
              borderRadius: "16px", 
              padding: "16px 20px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between",
              boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)",
              cursor: "pointer",
              transition: "transform 0.15s"
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "46px", height: "46px", borderRadius: "12px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", flexShrink: 0 }}>
                <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#ffffff", fontWeight: "900", fontSize: "16px", letterSpacing: "-0.2px" }}>
                  الانتقال إلى نظام "فنية"
                </div>
                <div style={{ color: "#bfdbfe", fontSize: "12px" }}>
                  تسجيل الدخول، سجل الحضور، ورفع المشاريع للتقييم
                </div>
              </div>
            </div>

            <div style={{ background: "#ffffff", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", fontWeight: "bold" }}>
              ←
            </div>
          </div>
        </Link>
      </footer>

    </main>
  );
}
