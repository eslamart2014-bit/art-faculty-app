"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Search, 
  UserX, 
  UserCheck, 
  Smartphone, 
  AlertTriangle, 
  Eye, 
  RotateCcw, 
  History, 
  CheckCircle2, 
  ChevronLeft, 
  Image as ImageIcon,
  Sparkles,
  Lock,
  Unlock,
  Layers,
  Fingerprint
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";

export default function AdminPortalPage() {
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [studentData, setStudentData] = useState<any>(null);

  // Modal / Sub-view State
  const [activeTab, setActiveTab] = useState<"info" | "audit" | "security" | "plagiarism" | "actions">("info");
  const [impersonateModal, setImpersonateModal] = useState(false);

  const handleSearch = async (codeOverride?: string) => {
    const code = codeOverride || searchCode;
    if (!code.trim()) return;

    setLoading(true);
    setErrorMsg("");
    setStudentData(null);

    try {
      const res = await fetch(`/api/admin/portal?action=inspect&code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "تعذر العثور على الطالب");
      } else {
        setStudentData(data);
      }
    } catch (e: any) {
      setErrorMsg("حدث خطأ في الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (actionType: string, extra?: any) => {
    if (!studentData?.student?.student_code) return;
    const cleanCode = studentData.student.student_code;

    if (actionType === "reset_submissions") {
      const ok = confirm("تحذير: هل أنت متأكد من رغبتك في حذف وتصفير جميع أعمال ومشاريع هذا الطالب لإتاحة إعادة التصوير والرفع له؟");
      if (!ok) return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          student_code: cleanCode,
          extra,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        handleSearch(cleanCode);
      } else {
        alert(data.error || "فشلت العملية");
      }
    } catch (e: any) {
      alert("خطأ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", padding: "18px", maxWidth: "650px", margin: "0 auto" }}>
      
      {/* هيدر الصفحة */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
          <ChevronLeft size={16} />
          <span>الرئيسية</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8", fontWeight: "bold", fontSize: "13px" }}>
          <ShieldCheck size={18} />
          <span>بوابة الطلاب المتقدمة (لوحة الإدارة والتحكم)</span>
        </div>
      </div>

      {/* بوكس البحث عن الطالب */}
      <div className="glass-card" style={{ padding: "20px", marginBottom: "20px" }}>
        <label style={{ display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
          البحث بكود الطالب للتحكم الكامل والفحص الأمني والفني:
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input 
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="أدخل كود الطالب (مثل: 0001)..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{ fontWeight: "bold" }}
          />
          <button 
            onClick={() => handleSearch()}
            disabled={loading}
            className="btn-primary"
            style={{ width: "90px" }}
          >
            <Search size={18} />
            <span>فحص</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ marginTop: "12px", color: "#f87171", fontSize: "13px", textAlign: "center" }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* عرض نتائج الفحص الشامل */}
      {studentData && (
        <div className="animate-fade-in">
          
          {/* كارت ملخص الطالب والحالة */}
          <div className="glass-card" style={{ padding: "18px", marginBottom: "16px", borderRight: studentData.isRegistered ? (studentData.account?.status === 'suspended' ? '5px solid #ef4444' : '5px solid #10b981') : '5px solid #64748b' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#fff", marginBottom: "3px" }}>
                  {studentData.student?.full_name}
                </h2>
                <div style={{ color: "#38bdf8", fontSize: "12px" }}>
                  كود: {formatStudentCode(studentData.student?.student_code)} • {studentData.student?.academic_year} (سكشن {studentData.student?.section || 'عام'})
                </div>
              </div>

              {/* شارة حالة التسجيل */}
              <div>
                {!studentData.isRegistered ? (
                  <span style={{ fontSize: "12px", background: "rgba(255,255,255,0.1)", color: "#94a3b8", padding: "4px 10px", borderRadius: "10px", fontWeight: "bold" }}>
                    غير مسجل بالبوابة
                  </span>
                ) : (
                  <span style={{ 
                    fontSize: "12px", 
                    padding: "4px 10px", 
                    borderRadius: "10px", 
                    fontWeight: "bold",
                    background: studentData.account?.status === 'suspended' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    color: studentData.account?.status === 'suspended' ? '#f87171' : '#34d399'
                  }}>
                    {studentData.account?.status === 'suspended' ? 'حساب معلق' : 'حساب نشط ومفعل'}
                  </span>
                )}
              </div>
            </div>

            {/* أزرار سريعة للأدمن: تصفح كطالب وتغيير الحالة */}
            {studentData.isRegistered && (
              <div style={{ display: "flex", gap: "8px", marginTop: "14px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                <button 
                  onClick={() => setImpersonateModal(true)}
                  className="btn-secondary"
                  style={{ flex: 1, fontSize: "12px", padding: "8px" }}
                >
                  <Eye size={15} color="#38bdf8" />
                  <span>تصفح الحساب كطالب</span>
                </button>

                {studentData.account?.status === 'suspended' ? (
                  <button 
                    onClick={() => handleAdminAction('toggle_status', { status: 'active' })}
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: "12px", padding: "8px", color: "#34d399", borderColor: "#059669" }}
                  >
                    <Unlock size={15} />
                    <span>إلغاء تعليق الحساب</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleAdminAction('toggle_status', { status: 'suspended' })}
                    className="btn-secondary"
                    style={{ flex: 1, fontSize: "12px", padding: "8px", color: "#f87171", borderColor: "#dc2626" }}
                  >
                    <Lock size={15} />
                    <span>تعليق وقفل الحساب</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* تبويبات التحكم الخمسة */}
          {studentData.isRegistered && (
            <div>
              <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "10px", marginBottom: "14px" }}>
                
                <button 
                  onClick={() => setActiveTab("info")}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: activeTab === "info" ? "#2563eb" : "#141b29", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  بيانات الحساب والبطاقة
                </button>

                <button 
                  onClick={() => setActiveTab("security")}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: activeTab === "security" ? "#2563eb" : "#141b29", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  التحقق الأمني والأجهزة
                </button>

                <button 
                  onClick={() => setActiveTab("plagiarism")}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: activeTab === "plagiarism" ? "#2563eb" : "#141b29", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  كشف تشابه اللوحات (AI)
                </button>

                <button 
                  onClick={() => setActiveTab("audit")}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: activeTab === "audit" ? "#2563eb" : "#141b29", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  سجل النشاط (Audit)
                </button>

                <button 
                  onClick={() => setActiveTab("actions")}
                  style={{ padding: "8px 14px", borderRadius: "10px", border: "none", background: activeTab === "actions" ? "#2563eb" : "#141b29", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  العمليات الإدارية
                </button>

              </div>

              {/* 1. تبويب البيانات والبطاقة */}
              {activeTab === "info" && (
                <div className="glass-card animate-fade-in" style={{ padding: "18px" }}>
                  <h3 style={{ color: "#fff", fontSize: "15px", marginBottom: "14px" }}>بيانات تسجيل الطالب:</h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px", background: "#0d131f", padding: "14px", borderRadius: "12px" }}>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>رقم الموبايل:</div>
                      <div style={{ color: "#fff", fontWeight: "bold", direction: "ltr", textAlign: "right" }}>{studentData.account?.mobile || "غير مسجل"}</div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>الرقم السري (PIN):</div>
                      <div style={{ color: "#f59e0b", fontFamily: "monospace", fontWeight: "bold", fontSize: "16px" }}>{studentData.account?.pin_code}</div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>المنسق الذي صرف الباسورد:</div>
                      <div style={{ color: "#34d399", fontWeight: "bold" }}>{studentData.account?.pin_issued_by || "لم يتم الصرف"}</div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>تاريخ الصرف:</div>
                      <div style={{ color: "#cbd5e1" }}>{studentData.account?.pin_issued_at ? new Date(studentData.account.pin_issued_at).toLocaleDateString("ar-EG") : "غير محدد"}</div>
                    </div>
                  </div>

                  {/* صورة بطاقة الهوية */}
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                      صورة بطاقة الهوية المعتمدة:
                    </label>
                    {studentData.account?.id_card_url ? (
                      <div style={{ borderRadius: "12px", overflow: "hidden", border: "2px solid #334155", maxHeight: "240px", background: "#000" }}>
                        <img src={studentData.account.id_card_url} alt="بطاقة الطالب" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                    ) : (
                      <div style={{ padding: "14px", textAlign: "center", color: "#64748b", background: "#0d131f", borderRadius: "10px" }}>
                        لا توجد صورة بطاقة مرفوعة
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. تبويب التحقق الأمني وكشف مشاركة الهواتف */}
              {activeTab === "security" && (
                <div className="glass-card animate-fade-in" style={{ padding: "18px" }}>
                  <h3 style={{ color: "#fff", fontSize: "15px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Fingerprint size={18} color="#38bdf8" />
                    <span>تقرير التحقق الأمني للبصمة الرقمية والأجهزة:</span>
                  </h3>

                  {/* كشف مشاركة الهواتف */}
                  {studentData.deviceSecurity?.sharedPhonesWithStudents?.length > 0 ? (
                    <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "12px", padding: "14px", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontWeight: "bold", fontSize: "14px", marginBottom: "6px" }}>
                        <AlertTriangle size={18} />
                        <span>تحذير: تم رصد مشاركة الهاتف مع زملاء آخرين!</span>
                      </div>
                      <p style={{ color: "#fca5a5", fontSize: "12px", margin: "0 0 10px 0" }}>
                        هذا الحساب تم فتحه من نفس الهاتف الذي استخدمه الطلاب التاليين:
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {studentData.deviceSecurity.sharedPhonesWithStudents.map((s: any, idx: number) => (
                          <span key={idx} style={{ background: "#7f1d1d", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                            {s.full_name} (كود {s.student_code})
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "12px", padding: "14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <CheckCircle2 size={24} color="#10b981" />
                      <div>
                        <div style={{ color: "#34d399", fontWeight: "bold", fontSize: "13px" }}>الهاتف آمن وغير مشترك</div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>لم يتم رصد استخدام نفس الموبايل مع أي طالب آخر.</div>
                      </div>
                    </div>
                  )}

                  {/* كشف تعدد الأجهزة للمستخدم */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "6px" }}>
                      عدد الأجهزة المسجلة للطالب: <b style={{ color: studentData.deviceSecurity?.totalDevices > 1 ? "#f59e0b" : "#fff" }}>{studentData.deviceSecurity?.totalDevices}</b>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {studentData.deviceSecurity?.devices?.map((d: any, idx: number) => (
                        <div key={idx} style={{ background: "#0d131f", padding: "10px 14px", borderRadius: "8px", border: "1px solid #1e293b", fontSize: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", color: "#38bdf8", fontWeight: "bold", marginBottom: "2px" }}>
                            <span>جهاز #{idx + 1}</span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>آخر ظهور: {new Date(d.lastSeen).toLocaleString("ar-EG")}</span>
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>{d.userAgent}</div>
                          <div style={{ color: "#64748b", fontSize: "10px" }}>الشاشة: {d.screen} • المعرف: {d.deviceId}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. تبويب فحص تشابه اللوحات الفنية (AI Art Plagiarism) */}
              {activeTab === "plagiarism" && (
                <div className="glass-card animate-fade-in" style={{ padding: "18px" }}>
                  <h3 style={{ color: "#fff", fontSize: "15px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={18} color="#f59e0b" />
                    <span>محرك الذكاء الاصطناعي لفحص السرقات الفنية وتطابق اللوحات:</span>
                  </h3>

                  {studentData.plagiarismMatches?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {studentData.plagiarismMatches.map((m: any, idx: number) => (
                        <div key={idx} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: "12px", padding: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <span style={{ color: "#ef4444", fontWeight: "bold", fontSize: "14px" }}>
                              تطابق مشبوه بنسبة {m.similarityPercent}%!
                            </span>
                            <span style={{ fontSize: "11px", background: "#ef4444", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                              مسافة هامد: {m.hammingDistance}
                            </span>
                          </div>

                          {/* مقارنة اللوحتين جنباً إلى جنب */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "center" }}>
                            <div>
                              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>لوحة هذا الطالب ({m.myProject})</div>
                              <div style={{ height: "120px", borderRadius: "8px", overflow: "hidden", border: "2px solid #ef4444" }}>
                                <img src={m.myImageUrl} alt="عمل الطالب" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>لوحة الطالب: {m.matchedStudentName}</div>
                              <div style={{ height: "120px", borderRadius: "8px", overflow: "hidden", border: "2px solid #ef4444" }}>
                                <img src={m.matchedImageUrl} alt="عمل زميله" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: "10px", fontSize: "11px", color: "#fca5a5" }}>
                            كود الطالب الآخر: <b>{m.matchedStudentCode}</b> • المشروع: <b>{m.matchedProject}</b>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "12px", padding: "24px", textAlign: "center" }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ margin: "0 auto 10px auto" }} />
                      <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
                        الأعمال الفنية أصلية 100%
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: "12px" }}>
                        لم يعثر محرك الذكاء الاصطناعي على أي تطابق أو تشابه في بصمات اللوحات مع أي طالب آخر في المنظومة.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. تبويب سجل التدقيق والنشاط (Audit Log) */}
              {activeTab === "audit" && (
                <div className="glass-card animate-fade-in" style={{ padding: "18px" }}>
                  <h3 style={{ color: "#fff", fontSize: "15px", marginBottom: "14px" }}>سجل النشاط والتدقيق الأمني:</h3>
                  
                  {studentData.auditLogs?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {studentData.auditLogs.map((log: any) => (
                        <div key={log.id} style={{ background: "#0d131f", padding: "10px 14px", borderRadius: "8px", border: "1px solid #1e293b", fontSize: "12px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                            <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{log.action}</span>
                            <span style={{ color: "#64748b", fontSize: "11px" }}>{new Date(log.created_at).toLocaleString("ar-EG")}</span>
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "11px" }}>
                            الجهاز: {log.device_id || "غير معروف"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#64748b", padding: "14px" }}>
                      لا يوجد نشاط مسجل بعد
                    </div>
                  )}
                </div>
              )}

              {/* 5. تبويب العمليات الإدارية */}
              {activeTab === "actions" && (
                <div className="glass-card animate-fade-in" style={{ padding: "18px" }}>
                  <h3 style={{ color: "#fff", fontSize: "15px", marginBottom: "14px" }}>عمليات الإدارة على الحساب:</h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* إعادة تعيين الـ PIN */}
                    <div style={{ background: "#0d131f", padding: "14px", borderRadius: "10px", border: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>إعادة توليد رقم سري جديد</div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>في حال نسيان الطالب للرقم أو الشك في تسريبه</div>
                      </div>
                      <button 
                        onClick={() => handleAdminAction('reset_pin')}
                        className="btn-secondary"
                        style={{ fontSize: "12px", padding: "8px 14px" }}
                      >
                        <RotateCcw size={14} />
                        <span>توليد جديد</span>
                      </button>
                    </div>

                    {/* تصفير مشاريع الطالب */}
                    <div style={{ background: "#0d131f", padding: "14px", borderRadius: "10px", border: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#ef4444", fontWeight: "bold", fontSize: "13px" }}>فورمات وحذف المشاريع المرفوعة</div>
                        <div style={{ color: "#94a3b8", fontSize: "11px" }}>يتيح للطالب إعادة تصوير أعماله ورفعها مجدداً من الصفر</div>
                      </div>
                      <button 
                        onClick={() => handleAdminAction('reset_submissions')}
                        className="btn-secondary"
                        style={{ fontSize: "12px", padding: "8px 14px", color: "#f87171", borderColor: "#ef4444" }}
                      >
                        تصفير الأعمال
                      </button>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* نافذة المحاكاة: تصفح الحساب كطالب (Impersonate) */}
      {impersonateModal && studentData && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: "460px", maxHeight: "90vh", overflowY: "auto", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a374f", paddingBottom: "12px", marginBottom: "14px" }}>
              <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "14px" }}>
                محاكاة واجهة الطالب: {studentData.student?.full_name}
              </div>
              <button onClick={() => setImpersonateModal(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px" }}>✕</button>
            </div>

            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "16px" }}>{studentData.student?.full_name}</div>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "16px" }}>كود: {studentData.student?.student_code} • {studentData.student?.academic_year}</div>

              <div style={{ textAlign: "right", background: "#0d131f", padding: "14px", borderRadius: "10px", marginBottom: "12px" }}>
                <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "13px", marginBottom: "8px" }}>المشاريع المرفوعة للتقييم:</div>
                {studentData.submissions?.length > 0 ? (
                  studentData.submissions.map((sub: any) => (
                    <div key={sub.id} style={{ borderBottom: "1px solid #1a2336", padding: "6px 0" }}>
                      <div style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{sub.project_name} ({sub.course_name})</div>
                      <div style={{ color: "#f59e0b", fontSize: "11px" }}>الحالة: {sub.score !== null ? `الدرجة: ${sub.score}` : "في انتظار التقييم"}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#64748b", fontSize: "12px" }}>لم يرفع أي أعمال بعد.</div>
                )}
              </div>

              <button onClick={() => setImpersonateModal(false)} className="btn-secondary" style={{ width: "100%" }}>
                إغلاق المحاكاة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
