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
import { printLockerReceipt } from "@/lib/lockerReceipt";

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
  const [preferredLetter, setPreferredLetter] = useState("ALL");
  const [partners, setPartners] = useState<{ name: string; code: string }[]>([]);
  
  // Search Peer State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [successBooking, setSuccessBooking] = useState<any>(null);

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
      const res = await fetch('/api/students/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search_peers',
          cohort: student.academic_year,
          query: q.trim(),
          excludeCodes
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
    setPartners([...partners, { name: peer.full_name, code: peer.student_code }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removePartner = (code: string) => {
    setPartners(partners.filter(p => p.code !== code));
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 9) {
      setModalError("يرجى إدخال رقم هاتف صحيح للتواصل");
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
          student_codes: allCodes,
          preferred_letter: preferredLetter !== 'ALL' ? preferredLetter : undefined
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

  const handlePrint = (booking: any) => {
    if (!booking) return;
    printLockerReceipt({
      bookingId: booking.id,
      lockerCode: booking.locker_code,
      cohort: booking.cohort,
      phone: booking.representative_phone,
      studentNames: booking.student_names,
      studentCodes: booking.student_codes,
      supervisorName: 'م/ إسلام عبداللطيف'
    });
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
        background: "linear-gradient(135deg, #1e293b, #0f172a)", 
        padding: "18px 20px", 
        borderRadius: "16px", 
        border: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "rgba(56, 189, 248, 0.15)", padding: "10px", borderRadius: "12px" }}>
            <Archive size={26} color="#38bdf8" />
          </div>
          <div>
            <h3 style={{ margin: 0, color: "#fff", fontSize: "17px", fontWeight: "bold" }}>
              منظومة دواليب الطلاب
            </h3>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
              قسم التربية الفنية - كلية التربية النوعية - جامعة قنا
            </p>
          </div>
        </div>

        <div style={{ fontSize: "12px", background: "rgba(255,255,255,0.05)", padding: "6px 14px", borderRadius: "20px", color: "#cbd5e1" }}>
          منسق الدواليب: <span style={{ color: "#38bdf8", fontWeight: "bold" }}>م/ إسلام عبداللطيف</span>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#fca5a5", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* الحالة 1: حجز معتمد ومؤكد رسمياً */}
      {status === 'confirmed' && booking && (
        <div style={{
          background: "#16222f",
          border: "2px solid #10b981",
          borderRadius: "16px",
          padding: "24px 20px",
          boxShadow: "0 10px 25px rgba(16, 185, 129, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(16, 185, 129, 0.2)", 
              color: "#34d399", 
              padding: "6px 14px", 
              borderRadius: "20px", 
              fontSize: "13px", 
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <CheckCircle2 size={16} />
              <span>تم التسكين والتأكيد رسمياً</span>
            </span>

            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              تاريخ الاعتماد: {new Date(booking.confirmed_at || booking.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "6px" }}>رقم الدولاب المخصص لك</div>
            <div style={{ 
              fontSize: "46px", 
              fontWeight: "900", 
              color: "#38bdf8", 
              letterSpacing: "2px",
              display: "inline-block",
              background: "rgba(56, 189, 248, 0.1)",
              border: "2px dashed #38bdf8",
              padding: "6px 36px",
              borderRadius: "16px"
            }}>
              {booking.locker_code}
            </div>
            <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "8px" }}>
              الفرقة الدراسية: <strong>{booking.cohort}</strong>
            </div>
          </div>

          <div style={{ background: "#0f172a", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} color="#38bdf8" />
              <span>الزملاء المشتركون في الدولاب:</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {booking.student_names.map((name: string, i: number) => (
                <div key={i} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  background: "#1e293b", 
                  padding: "10px 14px", 
                  borderRadius: "8px",
                  fontSize: "14px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f1f5f9" }}>
                    <span style={{ background: "#334155", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#94a3b8" }}>
                      {i + 1}
                    </span>
                    <span>{name}</span>
                    {name === student.full_name && (
                      <span style={{ fontSize: "11px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px" }}>
                        (أنت)
                      </span>
                    )}
                  </div>
                  {booking.student_codes && booking.student_codes[i] && (
                    <span style={{ fontSize: "12px", color: "#94a3b8", direction: "ltr" }}>
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
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                padding: "14px 28px",
                borderRadius: "12px",
                fontWeight: "bold",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)"
              }}
            >
              <Printer size={20} />
              <span>طباعة الاستمارة الرسمية (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* الحالة 2: حجز معلق - بانتظار الاستلام */}
      {status === 'pending' && booking && (
        <div style={{
          background: "#1c1d24",
          border: "2px solid #f59e0b",
          borderRadius: "16px",
          padding: "24px 20px",
          boxShadow: "0 10px 25px rgba(245, 158, 11, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(245, 158, 11, 0.2)", 
              color: "#fbbf24", 
              padding: "6px 14px", 
              borderRadius: "20px", 
              fontSize: "13px", 
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Clock size={16} />
              <span>الحجز قيد المراجعة والاستلام</span>
            </span>

            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              تاريخ التسجيل: {new Date(booking.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "4px" }}>رقم الدولاب المحجوز مبدئياً</div>
            <div style={{ 
              fontSize: "42px", 
              fontWeight: "900", 
              color: "#fbbf24", 
              letterSpacing: "2px",
              display: "inline-block",
              background: "rgba(245, 158, 11, 0.1)",
              border: "2px dashed #f59e0b",
              padding: "4px 30px",
              borderRadius: "14px"
            }}>
              {booking.locker_code}
            </div>
          </div>

          {/* التنبيه المطلوب نصاً بالخطة */}
          <div style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px",
            lineHeight: "1.7"
          }}>
            <div style={{ color: "#fbbf24", fontWeight: "bold", fontSize: "15px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} />
              <span>تنبيه هام ومطلوب لتأكيد الحجز والاستلام:</span>
            </div>
            <p style={{ margin: 0, color: "#fef3c7", fontSize: "14px", fontWeight: "600" }}>
              يجب طباعة الاستمارة أولاً، ويشترط تواجد جميع الطلاب المشتركين في الدولاب معاً لدى منسق الدواليب <span style={{ color: "#fbbf24", textDecoration: "underline" }}>م/ إسلام</span> لتأكيد الحجز النهائي واستلام الدولاب.
            </p>
          </div>

          <div style={{ background: "#0f172a", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Users size={16} color="#fbbf24" />
              <span>الطلاب المسجلون في هذا الطلب:</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {booking.student_names.map((name: string, i: number) => (
                <div key={i} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  background: "#1e293b", 
                  padding: "10px 14px", 
                  borderRadius: "8px",
                  fontSize: "14px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f1f5f9" }}>
                    <span style={{ background: "#334155", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#94a3b8" }}>
                      {i + 1}
                    </span>
                    <span>{name}</span>
                    {name === student.full_name && (
                      <span style={{ fontSize: "11px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "2px 6px", borderRadius: "4px" }}>
                        (أنت)
                      </span>
                    )}
                  </div>
                  {booking.student_codes && booking.student_codes[i] && (
                    <span style={{ fontSize: "12px", color: "#94a3b8", direction: "ltr" }}>
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
                background: "linear-gradient(135deg, #d97706, #b45309)",
                color: "#fff",
                border: "none",
                padding: "14px 28px",
                borderRadius: "12px",
                fontWeight: "bold",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(217, 119, 6, 0.35)"
              }}
            >
              <Printer size={20} />
              <span>طباعة استمارة الحجز للتوجه للمنسق</span>
            </button>
          </div>
        </div>
      )}

      {/* الحالة 3: قائمة الانتظار */}
      {status === 'waitlist' && waitlist && (
        <div style={{
          background: "#161e2e",
          border: "2px solid #3b82f6",
          borderRadius: "16px",
          padding: "24px 20px",
          boxShadow: "0 10px 25px rgba(59, 130, 246, 0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <span style={{ 
              background: "rgba(59, 130, 246, 0.2)", 
              color: "#60a5fa", 
              padding: "6px 14px", 
              borderRadius: "20px", 
              fontSize: "13px", 
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <Clock size={16} />
              <span>طلبكم مدرج في قائمة الانتظار</span>
            </span>

            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
              تاريخ الطلب: {new Date(waitlist.created_at).toLocaleDateString('ar-EG')}
            </span>
          </div>

          <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid #3b82f6", borderRadius: "12px", padding: "16px", marginBottom: "20px" }}>
            <h4 style={{ color: "#93c5fd", margin: "0 0 6px 0", fontSize: "15px" }}>
              لا توجد دواليب شاغرة حالياً
            </h4>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: "14px", lineHeight: "1.6" }}>
              نظراً لاكتمال حجز كافة الدواليب، تم حفظ طلبكم وتحديد أولوية الحجز لكم تلقائياً فور قيام الإدارة بإخلاء أي دولاب أو إضافة دواليب جديدة.
            </p>
          </div>

          <div style={{ background: "#0f172a", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "8px" }}>
              الطلاب في طلب الانتظار:
            </div>
            <div style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: "1.8" }}>
              {waitlist.student_names.join(' • ')}
            </div>
          </div>
        </div>
      )}

      {/* الحالة 4: غير مسكن في أي دولاب */}
      {status === 'none' && (
        <div style={{
          background: "#181e2b",
          border: "1px dashed #334155",
          borderRadius: "16px",
          padding: "36px 20px",
          textAlign: "center"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(56, 189, 248, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto"
          }}>
            <Archive size={32} color="#38bdf8" />
          </div>

          <h3 style={{ color: "#fff", fontSize: "18px", margin: "0 0 8px 0" }}>
            أنت غير مسكن في أي دولاب حالياً
          </h3>
          <p style={{ color: "#94a3b8", fontSize: "14px", maxWidth: "460px", margin: "0 auto 24px auto", lineHeight: "1.6" }}>
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
              background: "linear-gradient(135deg, #0284c7, #0369a1)",
              color: "#fff",
              border: "none",
              padding: "14px 28px",
              borderRadius: "14px",
              fontWeight: "bold",
              fontSize: "15px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(2, 132, 199, 0.4)"
            }}
          >
            <Plus size={20} />
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
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#18202f",
            border: "1px solid #334155",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "540px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
          }}>
            
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "rgba(56, 189, 248, 0.2)", padding: "8px", borderRadius: "10px" }}>
                  <Archive size={22} color="#38bdf8" />
                </div>
                <h3 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: "bold" }}>
                  طلب تسكين دولاب جديد
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {/* تم الحجز بنجاح من داخل المودال */}
            {successBooking ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                  <CheckCircle2 size={36} color="#10b981" />
                </div>
                <h3 style={{ color: "#fff", margin: "0 0 8px 0" }}>
                  {successBooking.isWaitlist ? "تم تسجيلكم في قائمة الانتظار!" : "تم تسجيل طلب الحجز بنجاح!"}
                </h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                  {successBooking.message}
                </p>

                {!successBooking.isWaitlist && successBooking.booking && (
                  <div style={{ margin: "20px 0" }}>
                    <div style={{ fontSize: "13px", color: "#94a3b8" }}>كود الدولاب المحجوز:</div>
                    <div style={{ fontSize: "36px", fontWeight: "900", color: "#38bdf8", marginTop: "4px" }}>
                      {successBooking.booking.locker_code}
                    </div>

                    <div style={{ marginTop: "20px" }}>
                      <button
                        onClick={() => handlePrint(successBooking.booking)}
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          padding: "12px 24px",
                          borderRadius: "10px",
                          fontWeight: "bold",
                          fontSize: "14px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer"
                        }}
                      >
                        <Printer size={18} />
                        <span>طباعة الاستمارة فوراً</span>
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    marginTop: "16px",
                    background: "#334155",
                    color: "#cbd5e1",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "10px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitBooking} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* تنبيه الفرقة */}
                <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "10px", padding: "12px", fontSize: "13px", color: "#93c5fd", display: "flex", gap: "8px" }}>
                  <Info size={18} style={{ flexShrink: 0 }} />
                  <span>
                    الفرقة الدراسية المحددة: <strong>{student.academic_year}</strong>. يشترط أن يكون جميع الزملاء من نفس الفرقة وغير مسكنين في دواليب أخرى.
                  </span>
                </div>

                {modalError && (
                  <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px 14px", borderRadius: "10px", fontSize: "13px" }}>
                    {modalError}
                  </div>
                )}

                {/* الطالب الأول (أنت) */}
                <div>
                  <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px", fontWeight: "bold" }}>
                    طالب 1 (مقدم الطلب):
                  </label>
                  <div style={{ background: "#0f172a", border: "1px solid #334155", padding: "10px 14px", borderRadius: "10px", color: "#94a3b8", fontSize: "14px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#fff", fontWeight: "bold" }}>{student.full_name}</span>
                    <span style={{ direction: "ltr" }}>#{student.student_code}</span>
                  </div>
                </div>

                {/* قائمة الزملاء المضافين */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ color: "#cbd5e1", fontSize: "13px", fontWeight: "bold" }}>
                      الزملاء المشتركون ({partners.length + 1} من 4):
                    </label>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      سعة الدولاب: 4 طلاب (أو شخصين حسب التوفر)
                    </span>
                  </div>

                  {partners.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                      {partners.map((p, idx) => (
                        <div key={p.code} style={{ background: "#0f172a", border: "1px solid #334155", padding: "8px 12px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ background: "#2563eb", width: "18px", height: "18px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#fff" }}>
                              {idx + 2}
                            </span>
                            <span style={{ color: "#f1f5f9" }}>{p.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePartner(p.code)}
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center" }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* البحث الذكي عن زميل لإضافته */}
                  {partners.length < 3 && (
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "2px 10px" }}>
                        <Search size={16} color="#94a3b8" />
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
                            color: "#fff",
                            fontSize: "13px",
                            outline: "none"
                          }}
                        />
                        {isSearching && (
                          <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid #334155", borderTopColor: "#38bdf8", borderRadius: "50%" }}></div>
                        )}
                      </div>

                      {/* نتائج البحث المباشرة */}
                      {searchResults.length > 0 && (
                        <div style={{
                          position: "absolute",
                          top: "105%",
                          left: 0,
                          right: 0,
                          background: "#0f172a",
                          border: "1px solid #3b82f6",
                          borderRadius: "10px",
                          zIndex: 100,
                          maxHeight: "180px",
                          overflowY: "auto",
                          boxShadow: "0 10px 20px rgba(0,0,0,0.5)"
                        }}>
                          {searchResults.map((peer) => (
                            <div
                              key={peer.student_code}
                              onClick={() => addPartner(peer)}
                              style={{
                                padding: "10px 14px",
                                borderBottom: "1px solid #1e293b",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                cursor: "pointer",
                                fontSize: "13px"
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ color: "#fff" }}>{peer.full_name}</span>
                              <span style={{ color: "#38bdf8", fontSize: "12px", direction: "ltr" }}>#{peer.student_code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* رقم هاتف ممثل الدولاب */}
                <div>
                  <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px", fontWeight: "bold" }}>
                    رقم موبايل ممثل الدولاب للتواصل:
                  </label>
                  <div style={{ display: "flex", alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "2px 10px" }}>
                    <Phone size={16} color="#94a3b8" />
                    <input
                      type="tel"
                      required
                      placeholder="مثال: 01012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: "8px 10px",
                        color: "#fff",
                        fontSize: "14px",
                        outline: "none",
                        direction: "ltr",
                        textAlign: "right"
                      }}
                    />
                  </div>
                </div>

                {/* اختيار الحرف المفضل (اختياري) */}
                <div>
                  <label style={{ display: "block", color: "#cbd5e1", fontSize: "13px", marginBottom: "6px" }}>
                    الحرف المفضل للدولاب (اختياري):
                  </label>
                  <select
                    value={preferredLetter}
                    onChange={(e) => setPreferredLetter(e.target.value)}
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "10px",
                      padding: "10px",
                      color: "#fff",
                      fontSize: "14px",
                      outline: "none"
                    }}
                  >
                    <option value="ALL">تسكين تلقائي (أي دولاب متاح فوراً)</option>
                    <option value="A">دواليب قسم A</option>
                    <option value="B">دواليب قسم B</option>
                    <option value="C">دواليب قسم C</option>
                    <option value="D">دواليب قسم D</option>
                  </select>
                </div>

                {/* زر الإرسال */}
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 1,
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff",
                      border: "none",
                      padding: "14px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "15px",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    {submitting ? (
                      <span>جاري إتمام الحجز...</span>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>تأكيد طلب التسكين</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      background: "#334155",
                      color: "#cbd5e1",
                      border: "none",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    إلغاء
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
