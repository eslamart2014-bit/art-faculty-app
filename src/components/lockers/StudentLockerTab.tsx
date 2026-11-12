"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Printer, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Users, 
  X, 
  Plus, 
  Phone, 
  Info,
  Archive,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { printLockerReceipt, downloadLockerReceiptPdf } from "@/lib/lockers/lockerReceipt";

interface StudentLockerTabProps {
  student: {
    student_code: string;
    full_name: string;
    academic_year: string;
    mobile_number?: string;
  };
}

export default function StudentLockerTab({ student }: StudentLockerTabProps) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState(student.mobile_number || "");
  const [partners, setPartners] = useState<{ name: string; code: string }[]>([]);
  
  // Search Peer State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successBooking, setSuccessBooking] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfStatusMsg, setPdfStatusMsg] = useState("");

  const fetchLockerStatus = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/students/lockers?code=${encodeURIComponent(student.student_code)}&name=${encodeURIComponent(student.full_name)}`);
      const json = await res.json();
      if (json.success) {
        setStatusData(json.data);
      } else {
        setErrorMsg(json.error || "تعذر جلب بيانات الدواليب");
      }
    } catch (err: any) {
      setErrorMsg("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (student?.student_code) {
      fetchLockerStatus();
    }
  }, [student?.student_code]);

  const handleSearchPeers = async (q: string) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const excludeCodes = [student.student_code, ...partners.map(p => p.code)];
      const excludeNames = [student.full_name, ...partners.map(p => p.name)];
      const res = await fetch('/api/students/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_peers',
          cohort: student.academic_year,
          query: q.trim(),
          excludeCodes,
          excludeNames
        })
      });
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.peers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const addPartner = (peer: any) => {
    if (partners.length >= 3) {
      alert("الحد الأقصى للزملاء هو 3 طلاب (المجموع 4 طلاب مع مقدم الطلب)");
      return;
    }
    // منع إضافة الطالب لنفسه
    if (peer.student_code === student.student_code || peer.full_name === student.full_name) {
      alert("لا يمكنك إضافة نفسك كزميل، أنت مقدم الطلب بالفعل!");
      return;
    }
    // منع تكرار نفس الزميل
    if (partners.some(p => p.code === peer.student_code || p.name === peer.full_name)) {
      alert("هذا الزميل مضاف بالفعل في قائمة هذا الطلب!");
      return;
    }
    setPartners([...partners, { name: peer.full_name, code: peer.student_code }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removePartner = (code: string) => {
    setPartners(partners.filter(p => p.code !== code));
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (partners.length !== 3) {
      setModalError("يشترط إضافة 3 زملاء بالتمام والكمال ليكتمل عدد المجموعة (4 طلاب للدولاب الواحد)");
      return;
    }
    const cleanPh = phone.trim().replace(/\D/g, '');
    if (!cleanPh || cleanPh.length < 10) {
      setModalError("يرجى إدخال رقم هاتف صحيح للتواصل (11 رقماً)");
      return;
    }

    setSubmitting(true);
    setModalError("");

    try {
      const allNames = [student.full_name, ...partners.map(p => p.name)];
      const allCodes = [student.student_code, ...partners.map(p => p.code)];

      const res = await fetch('/api/students/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'book',
          cohort: student.academic_year,
          representative_phone: phone.trim(),
          student_names: allNames,
          student_codes: allCodes
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setModalError(json.error || "تعذر إتمام الحجز");
        return;
      }

      setSuccessBooking(json);
      fetchLockerStatus();
    } catch (err: any) {
      setModalError("خطأ في الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async (booking: any) => {
    if (!booking || downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfStatusMsg("جاري تجهيز الاستمارة...");
    try {
      await downloadLockerReceiptPdf({
        bookingId: booking.id,
        lockerCode: booking.locker_code,
        cohort: booking.cohort,
        phone: booking.representative_phone,
        studentNames: booking.student_names,
        studentCodes: booking.student_codes,
        studentCode: student.student_code,
        supervisorName: 'م/ إسلام عبداللطيف'
      }, (status) => setPdfStatusMsg(status));
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => {
        setDownloadingPdf(false);
        setPdfStatusMsg("");
      }, 2500);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}>
        <p>جاري فحص وتحديث بيانات الدواليب...</p>
      </div>
    );
  }

  const status = statusData?.status || 'none';
  const booking = statusData?.booking;
  const waitlist = statusData?.waitlist;

﻿  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      
      {/* رأس التبويب */}
      <div style={{ 
        background: "var(--surface)", 
        padding: "12px 16px", 
        borderRadius: "12px", 
        border: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: "rgba(56, 189, 248, 0.14)", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Archive size={20} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
          </div>
          <div>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "14px", fontWeight: 600 }}>
              منظومة دواليب الطلاب
            </h3>
            <p style={{ margin: "2px 0 0 0", color: "var(--text-muted)", fontSize: "11px" }}>
              قسم التربية الفنية - كلية التربية النوعية - جامعة قنا
            </p>
          </div>
        </div>

        <div style={{ fontSize: "11px", background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: "6px", color: "var(--text-muted)" }}>
          منسق الدواليب: <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>م/ إسلام عبداللطيف</span>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid var(--error)", color: "var(--error-ink)", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} strokeWidth={1.5} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* الحالة 1: حجز معتمد ومؤكد رسمياً */}
      {status === 'confirmed' && booking && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--success)",
          borderRadius: "12px",
          padding: "24px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(16, 185, 129, 0.14)", 
              color: "var(--success-ink)", 
              border: "1px solid rgba(16, 185, 129, 0.35)",
              padding: "5px 12px", 
              borderRadius: "6px", 
              fontSize: "13px", 
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <CheckCircle2 size={15} strokeWidth={1.5} />
              <span>تم التسكين والتأكيد رسمياً</span>
            </span>

            <span className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              تاريخ الاعتماد: {new Date(booking.confirmed_at || booking.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>رقم الدولاب المخصص لك</div>
            <div className="tabular-nums" style={{ 
              fontSize: "44px", 
              fontWeight: 600, 
              color: "var(--accent-ink)", 
              letterSpacing: "2px",
              display: "inline-block",
              background: "rgba(56, 189, 248, 0.1)",
              border: "1px dashed var(--accent-ink)",
              padding: "8px 36px",
              borderRadius: "12px"
            }}>
              {booking.locker_code}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-primary)", marginTop: "8px" }}>
              الفرقة الدراسية: <strong style={{ fontWeight: 600 }}>{booking.cohort}</strong>
            </div>
          </div>

          <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
              <span>الزملاء المشتركون في الدولاب:</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {booking.student_names.map((name: string, i: number) => (
                <div key={i} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  background: "var(--surface)", 
                  border: "1px solid var(--border)",
                  padding: "10px 14px", 
                  borderRadius: "8px",
                  fontSize: "14px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                    <span className="tabular-nums" style={{ background: "var(--surface-hover)", width: "22px", height: "22px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                      {i + 1}
                    </span>
                    <span>{name}</span>
                    {name === student.full_name && (
                      <span style={{ fontSize: "11px", background: "rgba(56, 189, 248, 0.16)", color: "var(--accent-ink)", padding: "2px 6px", borderRadius: "6px", fontWeight: 600 }}>
                        (أنت)
                      </span>
                    )}
                  </div>
                  {booking.student_codes && booking.student_codes[i] && (
                    <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", direction: "ltr" }}>
                      #{booking.student_codes[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => handlePrint(booking)}
              disabled={downloadingPdf}
              style={{
                background: downloadingPdf ? "var(--surface-hover)" : "var(--primary)",
                color: "#fff",
                border: downloadingPdf ? "1px solid var(--accent-ink)" : "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: downloadingPdf ? "wait" : "pointer"
              }}
            >
              <Printer size={16} strokeWidth={1.5} />
              <span>{downloadingPdf ? (pdfStatusMsg || "جاري تنزيل ملف الـ PDF...") : "تحميل الاستمارة الرسمية (PDF)"}</span>
            </button>
          </div>
        </div>
      )}

      {/* الحالة 2: حجز معلق - بانتظار الاستلام */}
      {status === 'pending' && booking && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--warning)",
          borderRadius: "12px",
          padding: "24px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(245, 158, 11, 0.15)", 
              color: "var(--warning-ink)", 
              border: "1px solid rgba(245, 158, 11, 0.35)",
              padding: "5px 12px", 
              borderRadius: "6px", 
              fontSize: "13px", 
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Clock size={15} strokeWidth={1.5} />
              <span>الحجز قيد المراجعة والاستلام</span>
            </span>

            <span className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              تاريخ التسجيل: {new Date(booking.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>رقم الدولاب المحجوز مبدئياً</div>
            <div className="tabular-nums" style={{ 
              fontSize: "40px", 
              fontWeight: 600, 
              color: "var(--warning-ink)", 
              letterSpacing: "2px",
              display: "inline-block",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px dashed var(--warning)",
              padding: "6px 30px",
              borderRadius: "12px"
            }}>
              {booking.locker_code}
            </div>
          </div>

          {/* التنبيه المطلوب نصاً بالخطة */}
          <div style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px",
            lineHeight: "1.7"
          }}>
            <div style={{ color: "var(--warning-ink)", fontWeight: 600, fontSize: "15px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} strokeWidth={1.5} />
              <span>تنبيه هام ومطلوب لتأكيد الحجز والاستلام:</span>
            </div>
            <p style={{ margin: 0, color: "#fef3c7", fontSize: "14px", fontWeight: 500 }}>
              يجب طباعة الاستمارة أولاً، ويشترط تواجد جميع الطلاب المشتركين في الدولاب معاً لدى منسق الدواليب <span style={{ color: "var(--warning-ink)", textDecoration: "underline", fontWeight: 600 }}>م/ إسلام</span> لتأكيد الحجز النهائي واستلام الدولاب.
            </p>
          </div>

          <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} strokeWidth={1.5} style={{ color: "var(--warning-ink)" }} />
              <span>الطلاب المسجلون في هذا الطلب:</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {booking.student_names.map((name: string, i: number) => (
                <div key={i} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  background: "var(--surface)", 
                  border: "1px solid var(--border)",
                  padding: "10px 14px", 
                  borderRadius: "8px",
                  fontSize: "14px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-primary)" }}>
                    <span className="tabular-nums" style={{ background: "var(--surface-hover)", width: "22px", height: "22px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                      {i + 1}
                    </span>
                    <span>{name}</span>
                    {name === student.full_name && (
                      <span style={{ fontSize: "11px", background: "rgba(245, 158, 11, 0.16)", color: "var(--warning-ink)", padding: "2px 6px", borderRadius: "6px", fontWeight: 600 }}>
                        (أنت)
                      </span>
                    )}
                  </div>
                  {booking.student_codes && booking.student_codes[i] && (
                    <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", direction: "ltr" }}>
                      #{booking.student_codes[i]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => handlePrint(booking)}
              style={{
                background: "#b45309",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer"
              }}
            >
              <Printer size={17} strokeWidth={1.5} />
              <span>طباعة استمارة الحجز للتوجه للمنسق</span>
            </button>
          </div>
        </div>
      )}

      {/* الحالة 3: قائمة الانتظار */}
      {status === 'waitlist' && waitlist && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--primary)",
          borderRadius: "12px",
          padding: "24px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(37, 99, 235, 0.16)", 
              color: "var(--accent-ink)", 
              border: "1px solid rgba(56, 189, 248, 0.3)",
              padding: "5px 12px", 
              borderRadius: "6px", 
              fontSize: "13px", 
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Clock size={15} strokeWidth={1.5} />
              <span>طلبكم مدرج في قائمة الانتظار</span>
            </span>

            <span className="tabular-nums" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              تاريخ الطلب: {new Date(waitlist.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ background: "rgba(37, 99, 235, 0.1)", border: "1px solid var(--primary)", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <h4 style={{ color: "var(--accent-ink)", margin: "0 0 6px 0", fontSize: "15px", fontWeight: 600 }}>
              لا توجد دواليب شاغرة حالياً
            </h4>
            <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6" }}>
              نظراً لاكتمال حجز كافة الدواليب، تم حفظ طلبكم وتحديد أولوية الحجز لكم تلقائياً فور قيام الإدارة بإخلاء أي دولاب أو إضافة دواليب جديدة.
            </p>
          </div>

          <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
              الطلاب في طلب الانتظار:
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.8" }}>
              {waitlist.student_names.join(' • ')}
            </div>
          </div>
        </div>
      )}

      {/* الحالة 4: غير مسكن في أي دولاب */}
      {status === 'none' && (
        <div style={{
          background: "var(--surface)",
          border: "1px dashed var(--border-light)",
          borderRadius: "12px",
          padding: "36px 20px",
          textAlign: "center"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto"
          }}>
            <Archive size={28} strokeWidth={1.5} style={{ color: "var(--accent-ink)" }} />
          </div>

          <h3 style={{ color: "var(--text-primary)", fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0" }}>
            أنت غير مسكن في أي دولاب حالياً
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "460px", margin: "0 auto 24px auto", lineHeight: "1.6" }}>
            يمكنك التقدم بطلب حجز دولاب جديد مع زملائك من نفس الفرقة الدراسية ({student.academic_year}).
          </p>

          <button
            onClick={() => {
              setShowModal(true);
              setSuccessBooking(null);
              setModalError("");
              setPartners([]);
            }}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              padding: "12px 24px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer"
            }}
          >
            <Plus size={18} strokeWidth={1.5} />
            <span>طلب التسكين في دولاب</span>
          </button>
        </div>
      )}

﻿
      {/* النافذة العائمة (Modal) لطلب الحجز مع البحث الذكي */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "540px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px"
          }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "rgba(56, 189, 248, 0.12)", padding: "8px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Archive size={20} strokeWidth={1.5} color="var(--accent-ink)" />
                </div>
                <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "17px", fontWeight: "600" }}>
                  طلب تسكين دولاب جديد
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* تم الحجز بنجاح من داخل المودال */}
            {successBooking ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.14)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                  <CheckCircle2 size={32} strokeWidth={1.5} color="var(--success)" />
                </div>
                <h3 style={{ color: "var(--text-primary)", margin: "0 0 8px 0", fontWeight: "600" }}>
                  {successBooking.isWaitlist ? "تم تسجيلكم في قائمة الانتظار!" : "تم تسجيل طلب الحجز بنجاح!"}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                  {successBooking.message}
                </p>

                {!successBooking.isWaitlist && successBooking.booking && (
                  <div style={{ margin: "20px 0" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>كود الدولاب المحجوز:</div>
                    <div className="tabular-nums" style={{ fontSize: "34px", fontWeight: "600", color: "var(--accent-ink)", marginTop: "4px" }}>
                      {successBooking.booking.locker_code}
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <button
                        onClick={() => handlePrint(successBooking.booking)}
                        disabled={downloadingPdf}
                        style={{
                          background: downloadingPdf ? "var(--surface-hover)" : "var(--primary)",
                          color: "#fff",
                          border: downloadingPdf ? "1px solid var(--accent-ink)" : "1px solid transparent",
                          padding: "10px 20px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: downloadingPdf ? "wait" : "pointer"
                        }}
                      >
                        <Printer size={18} strokeWidth={1.5} />
                        <span>{downloadingPdf ? (pdfStatusMsg || "جاري التنزيل...") : "تحميل الاستمارة فوراً (PDF)"}</span>
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    marginTop: "16px",
                    background: "var(--surface-hover)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer"
                  }}
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBooking} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* تنبيه الفرقة */}
                <div style={{ background: "rgba(37, 99, 235, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "var(--accent-ink)", display: "flex", gap: "8px" }}>
                  <Info size={17} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>
                    الفرقة الدراسية المحددة: <strong style={{ fontWeight: 600 }}>{student.academic_year}</strong>. يشترط أن يكون جميع الزملاء من نفس الفرقة وغير مسكنين في دواليب أخرى.
                  </span>
                </div>

                {modalError && (
                  <div style={{ background: "rgba(239, 68, 68, 0.14)", border: "1px solid var(--error)", color: "var(--error-ink)", padding: "10px 14px", borderRadius: "8px", fontSize: "13px" }}>
                    {modalError}
                  </div>
                )}

                {/* الطالب الأول (أنت) */}
                <div>
                  <label style={{ display: "block", color: "var(--text-primary)", fontSize: "13px", marginBottom: "6px", fontWeight: 500 }}>
                    طالب 1 (مقدم الطلب):
                  </label>
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "8px", color: "var(--text-muted)", fontSize: "14px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{student.full_name}</span>
                    <span className="tabular-nums" style={{ direction: "ltr" }}>#{student.student_code}</span>
                  </div>
                </div>

                {/* قائمة الزملاء المضافين */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label className="tabular-nums" style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 500 }}>
                      الزملاء المشتركون ({partners.length + 1} من 4 طلاب):
                    </label>
                    <span className="tabular-nums" style={{ fontSize: "12px", color: partners.length === 3 ? "var(--success-ink)" : "var(--warning-ink)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {partners.length === 3 ? (
                        <>
                          <CheckCircle2 size={13} strokeWidth={1.5} />
                          <span>العدد مكتمل (4 طلاب)</span>
                        </>
                      ) : `متبقي ${3 - partners.length} زملاء`}
                    </span>
                  </div>

                  {partners.length < 3 && (
                    <div className="tabular-nums" style={{ background: "rgba(245, 158, 11, 0.12)", border: "1px solid var(--warning)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "var(--warning-ink)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertCircle size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                      <span>يشترط حجز الدولاب لـ <strong style={{ fontWeight: 600 }}>4 طلاب</strong> بالتمام والكمال. يرجى إضافة <strong style={{ fontWeight: 600 }}>{3 - partners.length}</strong> زملاء بالبحث أدناه لتفعيل زر التسكين.</span>
                    </div>
                  )}

                  {partners.length === 3 && (
                    <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid var(--success)", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "var(--success-ink)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle2 size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                      <span>اكتمل عدد المجموعة بالكامل (4 طلاب). أدخل رقم الهاتف للتأكيد.</span>
                    </div>
                  )}

                  {partners.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                      {partners.map((p, idx) => (
                        <div key={p.code} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="tabular-nums" style={{ background: "var(--primary)", width: "20px", height: "20px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#fff", fontWeight: 600 }}>
                              {idx + 2}
                            </span>
                            <span style={{ color: "var(--text-primary)" }}>{p.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePartner(p.code)}
                            style={{ background: "transparent", border: "none", color: "var(--error-ink)", cursor: "pointer", display: "flex", alignItems: "center" }}
                          >
                            <X size={16} strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* البحث الذكي عن زميل لإضافته */}
                  {partners.length < 3 && (
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", background: "var(--bg-deep)", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "2px 10px" }}>
                        <Search size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          placeholder="ابحث باسم الزميل أو كوده لإضافته..."
                          value={searchQuery}
                          onChange={(e) => handleSearchPeers(e.target.value)}
                          style={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            padding: "8px 10px",
                            color: "var(--text-primary)",
                            fontSize: "13px",
                            outline: "none"
                          }}
                        />
                        {isSearching && (
                          <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid var(--border-light)", borderTopColor: "var(--accent-ink)", borderRadius: "50%" }}></div>
                        )}
                      </div>

                      {/* نتائج البحث المباشرة */}
                      {searchResults.length > 0 && (
                        <div style={{
                          position: "absolute",
                          top: "105%",
                          left: 0,
                          right: 0,
                          background: "var(--bg-deep)",
                          border: "1px solid var(--primary)",
                          borderRadius: "8px",
                          zIndex: 100,
                          maxHeight: "180px",
                          overflowY: "auto"
                        }}>
                          {searchResults.map((peer) => (
                            <div
                              key={peer.student_code}
                              onClick={() => addPartner(peer)}
                              style={{
                                padding: "10px 14px",
                                borderBottom: "1px solid var(--border)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                fontSize: "13px"
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ color: "var(--text-primary)" }}>{peer.full_name}</span>
                              <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "12px", direction: "ltr" }}>#{peer.student_code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* رقم هاتف ممثل الدولاب */}
                <div>
                  <label style={{ display: "block", color: "var(--text-primary)", fontSize: "13px", marginBottom: "6px", fontWeight: 500 }}>
                    رقم موبايل ممثل الدولاب للتواصل (إجباري):
                  </label>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-deep)", border: `1px solid ${phone.length > 0 && phone.trim().replace(/\D/g, '').length < 10 ? 'var(--error)' : 'var(--border-light)'}`, borderRadius: "8px", padding: "2px 10px" }}>
                    <Phone size={16} strokeWidth={1.5} style={{ color: phone.trim().replace(/\D/g, '').length >= 10 ? "var(--success-ink)" : "var(--text-muted)" }} />
                    <input
                      type="tel"
                      className="tabular-nums"
                      required
                      placeholder="مثال: 01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: "8px 10px",
                        color: "var(--text-primary)",
                        fontSize: "14px",
                        outline: "none",
                        direction: "ltr",
                        textAlign: "right"
                      }}
                    />
                  </div>
                  {phone.length > 0 && phone.trim().replace(/\D/g, '').length < 10 && (
                    <span style={{ fontSize: "11px", color: "var(--error-ink)", marginTop: "4px", display: "block" }}>
                      * يرجى إدخال رقم هاتف صحيح (11 رقماً) للتواصل والتنسيق
                    </span>
                  )}
                </div>

                {/* زر الإرسال */}
                {(() => {
                  const cleanPhone = phone.trim().replace(/\D/g, '');
                  const isPhoneValid = cleanPhone.length >= 10;
                  const isPartnersComplete = partners.length === 3;
                  const isFormComplete = isPartnersComplete && isPhoneValid;

                  let buttonText = "تأكيد طلب التسكين (4 طلاب مكتملين)";
                  if (!isPartnersComplete) {
                    buttonText = `يلزم 4 طلاب للدولاب (متبقي ${3 - partners.length} زملاء)`;
                  } else if (!isPhoneValid) {
                    buttonText = "يرجى إدخال رقم هاتف للتواصل";
                  }

                  return (
                    <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                      <button
                        type="submit"
                        disabled={submitting || !isFormComplete}
                        style={{
                          flex: 1,
                          background: isFormComplete ? "var(--success)" : "var(--bg-deep)",
                          color: isFormComplete ? "#fff" : "var(--text-dim)",
                          border: isFormComplete ? "none" : "1px dashed var(--border-light)",
                          padding: "12px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          fontSize: "14px",
                          cursor: (submitting || !isFormComplete) ? "not-allowed" : "pointer",
                          opacity: (submitting || !isFormComplete) ? 0.75 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          transition: "background-color 0.15s ease, opacity 0.15s ease"
                        }}
                      >
                        {submitting ? (
                          <span>جاري إتمام الحجز...</span>
                        ) : (
                          <>
                            <CheckCircle2 size={17} strokeWidth={1.5} style={{ color: isFormComplete ? "#fff" : "var(--text-dim)" }} />
                            <span>{buttonText}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        style={{
                          background: "var(--surface-hover)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          padding: "12px 20px",
                          borderRadius: "8px",
                          fontWeight: 500,
                          fontSize: "14px",
                          cursor: "pointer"
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  );
                })()}

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
