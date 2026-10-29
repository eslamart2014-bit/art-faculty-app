"use client";

import React, { useState, useEffect } from "react";
import { isInstalledPWA } from "@/lib/deviceFingerprint";
import { 
  Smartphone, 
  Download, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Apple, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  HelpCircle,
  RefreshCw,
  ExternalLink
} from "lucide-react";

export type MigrationStudentInfo = {
  student_code: string;
  full_name: string;
  pin_code: string;
  academic_year?: string;
  section?: string;
  status?: string;
};

interface StudentMigrationNoticeProps {
  student?: MigrationStudentInfo | null;
  apkDownloadUrl?: string;
  apkVersion?: string;
  isTestMode?: boolean;
  onContinueToWeb: () => void;
  onSwitchStudentCode?: (newCode: string) => void;
}

export default function StudentMigrationNotice({
  student,
  apkDownloadUrl = "https://github.com/eslamart2014-bit/art-faculty-app/releases/download/student-app-v1.0.6/ArtEdu-Student-Portal-Release.apk",
  apkVersion = "1.0.6",
  isTestMode = false,
  onContinueToWeb,
  onSwitchStudentCode
}: StudentMigrationNoticeProps) {
  const [showPin, setShowPin] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customTestCode, setCustomTestCode] = useState("");
  const [isPwa, setIsPwa] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsPwa(isInstalledPWA());
    try {
      const p = localStorage.getItem("cached_profile");
      if (p) {
        const parsed = JSON.parse(p);
        if (["مدير", "مدير مساعد", "admin", "أدمن"].includes(parsed?.role)) {
          setIsAdmin(true);
        }
      }
    } catch (e) {}
  }, []);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2500);
    } catch (e) {
      console.warn("Failed to copy:", e);
    }
  };

  const copyAllCredentials = () => {
    if (!student) return;
    const text = `بيانات تسجيل الدخول لتطبيق بوابة الطلاب:
👤 الاسم: ${student.full_name}
🔢 كود الطالب: ${student.student_code}
🔑 كلمة المرور (الباسورد): ${student.pin_code}`;
    copyToClipboard(text, "all");
  };

  return (
    <div 
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #131b2e 0%, #070a12 100%)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "24px 16px 40px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box"
      }}
    >
      {/* Test Mode Banner (Only visible in explicit preview/test mode for admin) */}
      {isTestMode && isAdmin && (
        <div style={{
          width: "100%",
          maxWidth: "480px",
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          borderRadius: "12px",
          padding: "10px 14px",
          marginBottom: "16px",
          fontSize: "13px",
          color: "#fbbf24",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
              🧪 وضع التجربة والمعاينة (غير منشور للطلاب بعد)
            </span>
            <span style={{ fontSize: "11px", background: "#f59e0b", color: "#000", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
              معاينة مسؤول
            </span>
          </div>
          <div style={{ fontSize: "11.5px", color: "rgba(251, 191, 36, 0.9)" }}>
            هذا الشريط يظهر لك فقط للاختبار. الطلاب العاديين لا يرون خيار تبديل الأكواد نهائياً حمايةً لخصوصية بياناتهم.
          </div>
          {onSwitchStudentCode && (
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              <input
                type="text"
                placeholder="أدخل كود طالب لتجربته (مثال: 0687)..."
                value={customTestCode}
                onChange={(e) => setCustomTestCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customTestCode.trim()) {
                    onSwitchStudentCode(customTestCode.trim());
                  }
                }}
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  color: "#fff",
                  fontSize: "12px"
                }}
              />
              <button
                onClick={() => {
                  if (customTestCode.trim()) onSwitchStudentCode(customTestCode.trim());
                }}
                style={{
                  background: "#f59e0b",
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                تجربة
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Container Card */}
      <div 
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "rgba(18, 25, 41, 0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          borderRadius: "24px",
          padding: "24px 20px",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px -10px rgba(14, 165, 233, 0.15)",
          boxSizing: "border-box"
        }}
      >
        {/* Header Badge & Title */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "68px",
            height: "68px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            marginBottom: "14px",
            boxShadow: "0 8px 24px -4px rgba(14, 165, 233, 0.3)"
          }}>
            <Smartphone size={36} color="#38bdf8" />
          </div>

          <div style={{
            display: "inline-block",
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#38bdf8",
            fontSize: "12px",
            fontWeight: "bold",
            padding: "4px 12px",
            borderRadius: "20px",
            marginBottom: "10px"
          }}>
            🚀 ترقية رسمية هامة للتطبيق
          </div>

          <h1 style={{
            fontSize: "22px",
            fontWeight: "800",
            color: "#ffffff",
            margin: "0 0 6px 0",
            lineHeight: 1.3
          }}>
            تم إطلاق تطبيق الهاتف الجديد
          </h1>

          <p style={{
            fontSize: "14px",
            color: "#94a3b8",
            margin: 0,
            lineHeight: 1.5
          }}>
            {student ? (
              <>
                أهلاً بك يا <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{student.full_name}</span> 👋<br />
                تم تحديث المنظومة لتطبيق أندرويد مستقل بنظام إشعارات فوري بدون متصفح.
              </>
            ) : (
              <>
                أهلاً بك في بوابة طلاب كلية التربية الفنية 👋<br />
                تم ترقية النظام وإطلاق التطبيق الرسمي للأندرويد بنظام الإشعارات الفورية.
              </>
            )}
          </p>

          {/* PWA Legacy Alert */}
          {isPwa && (
            <div style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: "14px",
              padding: "10px 14px",
              marginTop: "16px",
              fontSize: "12.5px",
              color: "#fde68a",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              lineHeight: 1.5,
              textAlign: "right"
            }}>
              <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <b style={{ color: "#fbbf24" }}>تنبيه لمستخدمي النسخة المثبتة سابقاً (PWA):</b><br />
                لقد تم إيقاف الاعتماد على هذه النسخة القديمة من الشاشة الرئيسية، ويجب عليك الآن تثبيت التطبيق الرسمي الجديد (APK) بالأسفل لضمان استلام إشعارات التقييمات والحضور.
              </div>
            </div>
          )}
        </div>

        {/* CASE 1: Student is recognized on this device (show credentials) */}
        {student ? (
          <div style={{
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "18px",
            padding: "18px 16px",
            marginBottom: "22px",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldCheck size={16} /> بيانات حسابك للدخول بالتطبيق الجديد
              </span>
              {student.section && (
                <span style={{ fontSize: "11px", color: "#94a3b8", background: "rgba(255, 255, 255, 0.05)", padding: "2px 8px", borderRadius: "6px" }}>
                  الفرقة {student.academic_year || ""} • سكشن {student.section}
                </span>
              )}
            </div>

            {/* Student Name */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>اسم الطالب</div>
              <div style={{ fontSize: "15px", fontWeight: "bold", color: "#f1f5f9" }}>{student.full_name}</div>
            </div>

            {/* Student Code Field */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>كود الطالب (اسم المستخدم)</div>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#090d16",
                border: "1px solid #1e293b",
                borderRadius: "10px",
                padding: "8px 12px"
              }}>
                <span style={{ fontFamily: "monospace", fontSize: "17px", fontWeight: "bold", color: "#38bdf8", letterSpacing: "1px" }}>
                  {student.student_code}
                </span>
                <button
                  onClick={() => copyToClipboard(student.student_code, "code")}
                  style={{
                    background: copiedField === "code" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    color: copiedField === "code" ? "#34d399" : "#94a3b8",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {copiedField === "code" ? <><Check size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ</>}
                </button>
              </div>
            </div>

            {/* Password (PIN) Field */}
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>كلمة المرور (الباسورد)</div>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#090d16",
                border: "1px solid #1e293b",
                borderRadius: "10px",
                padding: "8px 12px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontFamily: "monospace",
                    fontSize: "17px",
                    fontWeight: "bold",
                    color: "#f8fafc",
                    letterSpacing: showPin ? "2px" : "3px"
                  }}>
                    {showPin ? student.pin_code : "••••••"}
                  </span>
                  <button
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex"
                    }}
                    title={showPin ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  onClick={() => copyToClipboard(student.pin_code, "pin")}
                  style={{
                    background: copiedField === "pin" ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    color: copiedField === "pin" ? "#34d399" : "#94a3b8",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {copiedField === "pin" ? <><Check size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ</>}
                </button>
              </div>
            </div>

            {/* Copy All Button */}
            <button
              onClick={copyAllCredentials}
              style={{
                width: "100%",
                background: copiedField === "all" ? "rgba(16, 185, 129, 0.2)" : "rgba(56, 189, 248, 0.12)",
                border: `1px solid ${copiedField === "all" ? "#10b981" : "rgba(56, 189, 248, 0.3)"}`,
                color: copiedField === "all" ? "#34d399" : "#38bdf8",
                padding: "8px 12px",
                borderRadius: "10px",
                fontSize: "12.5px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                marginBottom: "10px"
              }}
            >
              {copiedField === "all" ? (
                <><Check size={16} /> تم نسخ كافة البيانات بنجاح</>
              ) : (
                <><Copy size={16} /> نسخ الاسم والكود وكلمة المرور معاً</>
              )}
            </button>

            {/* Hint Notice */}
            <div style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "10px",
              padding: "8px 12px",
              fontSize: "11px",
              color: "#fca5a5",
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: "6px"
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>
                <b>تعليمات هامة:</b> احفظ الكود وكلمة المرور أو التقط صورة للشاشة (Screenshot) الآن، ستقوم بإدخالهما لمرة واحدة داخل التطبيق الجديد.
              </span>
            </div>
          </div>
        ) : (
          /* CASE 2: New / First-time Student or Unregistered (Clear instructions, NO code input) */
          <div style={{
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "18px",
            padding: "18px 16px",
            marginBottom: "22px",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <Sparkles size={18} color="#38bdf8" />
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8" }}>
                تعليمات الدخول والتسجيل لأول مرة
              </span>
            </div>

            <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.7", margin: "0 0 14px 0" }}>
              تم إطلاق تطبيق الأندرويد الرسمي الجديد لبوابة الطلاب، والذي يدعم نظام الإشعارات الفورية للدرجات والحضور والمشاريع حتى والتطبيق مغلق.
            </p>

            <div style={{
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: "12px",
              padding: "10px 12px",
              marginBottom: "10px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px"
            }}>
              <span style={{ fontSize: "16px" }}>📱</span>
              <div style={{ fontSize: "12px", color: "#a7f3d0", lineHeight: "1.5" }}>
                <strong>لمستخدمي هواتف الأندرويد:</strong> حمّل التطبيق من الزر الأخضر بالأسفل، وعند فتحه ستجد شاشة تسجيل طالب جديد لتقوم بالخطوات المعتادة عبر المنسق.
              </div>
            </div>

            <div style={{
              background: "rgba(56, 189, 248, 0.08)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "12px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px"
            }}>
              <span style={{ fontSize: "16px" }}>🌐</span>
              <div style={{ fontSize: "12px", color: "#bae6fd", lineHeight: "1.5" }}>
                <strong>لهواتف الآيفون والهواوي:</strong> اضغط على زر "المتابعة عبر المتصفح" بالأسفل لفتح بوابة تسجيل الدخول والتسجيل المعتادة مباشرة من متصفحك.
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons (Visible in both cases) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* 1. Android APK Download Button (Primary) */}
          <a
            href={apkDownloadUrl}
            onClick={() => {
              try {
                if (student?.student_code) {
                  fetch('/api/students/track-install', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      student_code: student.student_code,
                      action: 'download',
                      version: apkVersion
                    })
                  }).catch(() => {});
                }
              } catch (e) {}
            }}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              padding: "14px 18px",
              borderRadius: "14px",
              textDecoration: "none",
              fontWeight: "bold",
              boxShadow: "0 8px 20px -4px rgba(16, 185, 129, 0.4)",
              transition: "transform 0.15s, box-shadow 0.15s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                background: "rgba(0, 0, 0, 0.2)",
                padding: "8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center"
              }}>
                <Download size={22} color="#fff" />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "15px", fontWeight: "bold" }}>تثبيت تطبيق الأندرويد (APK) 🤖</div>
                <div style={{ fontSize: "11px", opacity: 0.9, marginTop: "2px" }}>
                  نسخة رسمية v{apkVersion} • بالإشعارات الفورية الحقيقية
                </div>
              </div>
            </div>
            <ExternalLink size={18} opacity={0.8} />
          </a>

          {/* 2. iPhone / Web Continue Button (Secondary) */}
          <button
            onClick={onContinueToWeb}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              padding: "13px 18px",
              borderRadius: "14px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "background 0.2s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                background: "rgba(255, 255, 255, 0.1)",
                padding: "8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center"
              }}>
                <Apple size={22} color="#fff" />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>المتابعة عبر المتصفح (لهواتف الآيفون والهواوي) 🌐</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                  {student ? "فتح لوحة التحكم على حسابك المحفوظ" : "الدخول أو التسجيل كطالب جديد عبر المتصفح"}
                </div>
              </div>
            </div>
            <span style={{ fontSize: "12px", color: "#38bdf8" }}>دخول 🡰</span>
          </button>
        </div>

        {/* Footer Note */}
        <div style={{
          marginTop: "20px",
          textAlign: "center",
          fontSize: "11px",
          color: "#64748b",
          lineHeight: 1.6
        }}>
          منظومة كلية التربية الفنية — جامعة جنوب الوادي<br />
          إذا واجهت أي صعوبة، يرجى مراجعة منسق الفرقة الدراسية المعتمد.
        </div>
      </div>
    </div>
  );
}
