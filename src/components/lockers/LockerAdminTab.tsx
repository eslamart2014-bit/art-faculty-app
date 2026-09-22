"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Archive, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Users, 
  Printer, 
  Trash2, 
  UserMinus, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Layers, 
  Filter, 
  Phone, 
  Sliders,
  Check,
  X
} from "lucide-react";
import { printLockerReceipt } from "@/lib/lockerReceipt";

export default function LockerAdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<"grid" | "pending" | "search" | "tools">("grid");
  const [letterFilter, setLetterFilter] = useState<string>("ALL");
  const [lockers, setLockers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected Locker Drawer / Modal
  const [selectedLocker, setSelectedLocker] = useState<any | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  // Clear Cohort State
  const [cohortToClear, setCohortToClear] = useState<string>("الفرقة الرابعة");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Long press handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lockers?action=grid&letter=${letterFilter}`);
      const json = await res.json();
      if (json.success) {
        setLockers(json.lockers || []);
        setStats(json.stats || null);
        setWaitlist(json.waitlist || []);
        setBookings(json.bookings || []);
        setPendingList((json.bookings || []).filter((b: any) => b.status === "pending"));
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ في جلب بيانات الدواليب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [letterFilter]);

  // تأكيد حجز معلق
  const handleConfirmBooking = async (bookingId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', bookingId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker) setSelectedLocker(null);
      } else {
        showToast(json.error || "فشل التأكيد");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // رفض أو إلغاء حجز
  const handleRejectBooking = async (bookingId: string) => {
    if (!confirm("هل أنت متأكد من إلغاء هذا الحجز وإخلاء الدولاب؟")) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', bookingId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker) setSelectedLocker(null);
      } else {
        showToast(json.error || "فشل الإلغاء");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // إخلاء دولاب بالكامل
  const handleVacateLocker = async (lockerCode: string) => {
    if (!confirm(`هل أنت متأكد من تفريغ وإخلاء الدولاب ${lockerCode} بالكامل؟`)) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vacate', lockerCode })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker) setSelectedLocker(null);
      } else {
        showToast(json.error || "فشل الإخلاء");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // إقصاء طالب محدد
  const handleRemoveStudent = async (bookingId: string, studentNameOrCode: string) => {
    if (!confirm(`هل أنت متأكد من إقصاء الطالب (${studentNameOrCode}) من الدولاب؟`)) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_student', bookingId, studentCodeOrName: studentNameOrCode })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker) setSelectedLocker(null);
      } else {
        showToast(json.error || "فشل الإقصاء");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // تبديل إتاحة الدولاب (متاح / محجوب إدارياً) - للضغط المطول أو الزر
  const handleToggleEnabled = async (lockerCode: string) => {
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_enabled', lockerCode })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker && selectedLocker.locker_code === lockerCode) {
          setSelectedLocker({ ...selectedLocker, is_enabled: json.is_enabled });
        }
      }
    } catch (e) {
      showToast("خطأ في تحديث حالة الدولاب");
    }
  };

  // تعديل سعة الدولاب
  const handleUpdateCapacity = async (lockerCode: string, capacity: number) => {
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_capacity', lockerCode, capacity })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (selectedLocker && selectedLocker.locker_code === lockerCode) {
          setSelectedLocker({ ...selectedLocker, capacity });
        }
      }
    } catch (e) {
      showToast("خطأ في تحديث السعة");
    }
  };

  // تفريغ دفعة بالكامل
  const handleClearCohort = async () => {
    if (!confirm(`تحذير شديد! هل أنت متأكد من تفريغ جميع دواليب (${cohortToClear})؟ هذا الإجراء سيخلي كافة الدواليب المسكنة لطلاب هذه الفرقة.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_cohort', cohort: cohortToClear })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
      } else {
        showToast(json.error || "فشل تفريغ الدفعة");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // البحث الشامل في الدواليب والطلاب
  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/lockers?action=search&query=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.results);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // معالجات الضغط المطول (Long Press) على الدولاب
  const handleTouchStart = (code: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      handleToggleEnabled(code);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleLockerClick = (locker: any) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    setSelectedLocker(locker);
    if (locker.current_booking_id) {
      const b = bookings.find((bk: any) => bk.id === locker.current_booking_id);
      setSelectedBooking(b || null);
    } else {
      setSelectedBooking(null);
    }
  };

﻿  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1e293b",
          border: "1px solid #38bdf8",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: "30px",
          zIndex: 10000,
          boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
          fontSize: "14px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <CheckCircle2 size={18} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* شريط الإحصائيات الرئيسي */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "12px"
      }}>
        <div style={{ background: "#18202f", border: "1px solid #334155", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>إجمالي الدواليب</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginTop: "4px" }}>{stats?.total || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #10b981", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#6ee7b7" }}>مسكن ومؤكد</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#10b981", marginTop: "4px" }}>{stats?.confirmed || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #f59e0b", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#fcd34d" }}>بانتظار الاعتماد</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b", marginTop: "4px" }}>{stats?.pending || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #38bdf8", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#7dd3fc" }}>دواليب شاغرة</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#38bdf8", marginTop: "4px" }}>{stats?.empty || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #64748b", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#cbd5e1" }}>محجوب إدارياً</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#94a3b8", marginTop: "4px" }}>{stats?.disabled || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #818cf8", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#c7d2fe" }}>قائمة الانتظار</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#818cf8", marginTop: "4px" }}>{stats?.waitlistCount || 0}</div>
        </div>
      </div>

      {/* أزرار التبويبات الفرعية */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #334155", paddingBottom: "12px", flexWrap: "wrap" }}>
        {[
          { id: "grid", label: "شبكة الدواليب التفاعلية 🗄️" },
          { id: "pending", label: `طلبات الاعتماد والانتظار (${pendingList.length}) ⏳` },
          { id: "search", label: "البحث الشامل 🔍" },
          { id: "tools", label: "أدوات الإدارة والفرقة ⚙️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: activeSubTab === tab.id ? "1px solid #6366f1" : "1px solid #334155",
              background: activeSubTab === tab.id ? "rgba(99, 102, 241, 0.2)" : "#18202f",
              color: activeSubTab === tab.id ? "#818cf8" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            {tab.label}
          </button>
        ))}

        <button
          onClick={fetchData}
          style={{
            marginRight: "auto",
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#cbd5e1",
            padding: "8px 14px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            fontSize: "13px"
          }}
        >
          <RefreshCw size={15} />
          <span>تحديث</span>
        </button>
      </div>

﻿      {/* 1. شبكة الدواليب التفاعلية */}
      {activeSubTab === "grid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* فلتر الأحرف + توضيح الضغط المطول */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {["ALL", "A", "B", "C", "D"].map((l) => (
                <button
                  key={l}
                  onClick={() => setLetterFilter(l)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: letterFilter === l ? "1px solid #38bdf8" : "1px solid #334155",
                    background: letterFilter === l ? "rgba(56, 189, 248, 0.2)" : "#18202f",
                    color: letterFilter === l ? "#38bdf8" : "#94a3b8",
                    fontWeight: "bold",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  {l === "ALL" ? "كافة الأقسام" : `قسم ${l}`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1" }}></span>
              <span>ميزة خاصة: <strong>الضغط المطول</strong> على أي دولاب يحجبه/يتيحه للطلاب فوراً</span>
            </div>
          </div>

          {/* شبكة الكروت */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>جاري تحميل شبكة الدواليب...</div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
              gap: "10px"
            }}>
              {lockers.map((locker) => {
                const isConfirmed = locker.status === "confirmed";
                const isPending = locker.status === "pending";
                const isDisabled = !locker.is_enabled;

                let border = "#334155";
                let bg = "#141b29";
                let color = "#e2e8f0";
                let statusLabel = `شاغر (${locker.capacity})`;

                if (isDisabled) {
                  border = "#475569";
                  bg = "#0f172a";
                  color = "#64748b";
                  statusLabel = "محجوب";
                } else if (isConfirmed) {
                  border = "#10b981";
                  bg = "rgba(16, 185, 129, 0.12)";
                  color = "#34d399";
                  statusLabel = "معتمد";
                } else if (isPending) {
                  border = "#f59e0b";
                  bg = "rgba(245, 158, 11, 0.12)";
                  color = "#fbbf24";
                  statusLabel = "معلق";
                }

                return (
                  <div
                    key={locker.locker_code}
                    onClick={() => handleLockerClick(locker)}
                    onMouseDown={() => handleTouchStart(locker.locker_code)}
                    onMouseUp={handleTouchEnd}
                    onTouchStart={() => handleTouchStart(locker.locker_code)}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      background: bg,
                      border: `1.5px solid ${border}`,
                      borderRadius: "12px",
                      padding: "10px 8px",
                      textAlign: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      position: "relative",
                      transition: "transform 0.1s ease, border-color 0.2s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {isDisabled && (
                      <div style={{ position: "absolute", top: "5px", left: "5px" }}>
                        <Lock size={12} color="#94a3b8" />
                      </div>
                    )}
                    <div style={{ fontSize: "16px", fontWeight: "900", color }}>
                      {locker.locker_code}
                    </div>
                    <div style={{ fontSize: "11px", marginTop: "4px", color: isDisabled ? "#64748b" : color, opacity: 0.85 }}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

﻿      {/* 2. تبويب طلبات الاعتماد وقائمة الانتظار */}
      {activeSubTab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* قسم الطلبات المعلقة */}
          <div>
            <h4 style={{ color: "#fbbf24", margin: "0 0 12px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} />
              <span>طلبات الحجز بانتظار الاعتماد النهائي والاستلام ({pendingList.length}):</span>
            </h4>

            {pendingList.length === 0 ? (
              <div style={{ background: "#18202f", border: "1px dashed #334155", borderRadius: "12px", padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                لا توجد طلبات معلقة حالياً، جميع الحجوزات معتمدة!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                {pendingList.map((bk) => (
                  <div key={bk.id} style={{ background: "#18202f", border: "1px solid #f59e0b", borderRadius: "14px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "20px", fontWeight: "900", color: "#fbbf24" }}>
                        دولاب: {bk.locker_code}
                      </span>
                      <span style={{ fontSize: "12px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "3px 8px", borderRadius: "6px" }}>
                        {bk.cohort}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Phone size={14} color="#94a3b8" />
                      <span dir="ltr">{bk.representative_phone}</span>
                    </div>

                    <div style={{ background: "#0f172a", borderRadius: "8px", padding: "10px", marginBottom: "14px" }}>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>الطلاب المسجلون:</div>
                      {bk.student_names.map((name: string, i: number) => (
                        <div key={i} style={{ fontSize: "13px", color: "#f1f5f9", display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span>{i + 1}. {name}</span>
                          {bk.student_codes && bk.student_codes[i] && (
                            <span style={{ color: "#64748b", direction: "ltr" }}>#{bk.student_codes[i]}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleConfirmBooking(bk.id)}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          fontSize: "13px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}
                      >
                        <Check size={16} />
                        <span>اعتماد الحجز</span>
                      </button>

                      <button
                        onClick={() => printLockerReceipt({
                          bookingId: bk.id,
                          lockerCode: bk.locker_code,
                          cohort: bk.cohort,
                          phone: bk.representative_phone,
                          studentNames: bk.student_names,
                          studentCodes: bk.student_codes
                        })}
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        title="طباعة الاستمارة"
                      >
                        <Printer size={16} />
                      </button>

                      <button
                        onClick={() => handleRejectBooking(bk.id)}
                        disabled={actionLoading}
                        style={{
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        title="إلغاء ورفض"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* قسم قائمة الانتظار */}
          <div>
            <h4 style={{ color: "#818cf8", margin: "0 0 12px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} />
              <span>قائمة الانتظار التلقائية ({waitlist.length}):</span>
            </h4>

            {waitlist.length === 0 ? (
              <div style={{ background: "#18202f", border: "1px dashed #334155", borderRadius: "12px", padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                قائمة الانتظار فارغة حالياً
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px" }}>
                {waitlist.map((w, idx) => (
                  <div key={w.id} style={{ background: "#18202f", border: "1px solid #334155", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontWeight: "bold", color: "#818cf8" }}>أسبقية #{idx + 1}</span>
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{w.cohort}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "6px" }}>
                      الهاتف: <span dir="ltr">{w.representative_phone}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {w.student_names.join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 3. تبويب البحث الشامل */}
      {activeSubTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", background: "#18202f", border: "1px solid #334155", borderRadius: "12px", padding: "4px 14px" }}>
            <Search size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="ابحث باسم الطالب، كوده، رقم الهاتف، أو رمز الدولاب..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "10px",
                color: "#fff",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          {searchResults && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "13px", color: "#94a3b8" }}>
                نتائج الحجوزات المطابقة: {searchResults.bookings?.length || 0}
              </div>

              {searchResults.bookings?.map((b: any) => (
                <div key={b.id} style={{ background: "#18202f", border: "1px solid #334155", padding: "16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: "bold", color: "#38bdf8" }}>دولاب {b.locker_code} ({b.status === "confirmed" ? "معتمد" : "معلق"})</div>
                    <div style={{ fontSize: "13px", color: "#cbd5e1", marginTop: "4px" }}>
                      {b.student_names.join(" - ")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                      الفرقة: {b.cohort} | هاتف: {b.representative_phone}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => printLockerReceipt({
                        bookingId: b.id,
                        lockerCode: b.locker_code,
                        cohort: b.cohort,
                        phone: b.representative_phone,
                        studentNames: b.student_names,
                        studentCodes: b.student_codes
                      })}
                      style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      onClick={() => handleVacateLocker(b.locker_code)}
                      style={{ background: "#ef4444", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}
                    >
                      إخلاء
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. تبويب أدوات الإدارة وتفريغ الدفعة */}
      {activeSubTab === "tools" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ background: "#18202f", border: "1px solid #ef4444", borderRadius: "16px", padding: "20px" }}>
            <h4 style={{ color: "#ef4444", margin: "0 0 8px 0", fontSize: "16px" }}>
              ⚠️ تفريغ دواليب دفعة كاملة (عند التخرج أو نهاية العام)
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              يقوم هذا الأمر بإلغاء حجوزات وإخلاء كافة الدواليب المخصصة لفرقة دراسية محددة مرة واحدة لتكون جاهزة للطلاب الجدد.
            </p>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={cohortToClear}
                onChange={(e) => setCohortToClear(e.target.value)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  outline: "none"
                }}
              >
                <option value="الفرقة الرابعة">الفرقة الرابعة (تخرج)</option>
                <option value="الفرقة الثالثة">الفرقة الثالثة</option>
                <option value="الفرقة الثانية">الفرقة الثانية</option>
                <option value="الفرقة الأولى">الفرقة الأولى</option>
              </select>

              <button
                onClick={handleClearCohort}
                disabled={actionLoading}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                بدء تفريغ الدفعة الآن
              </button>
            </div>
          </div>

          <div style={{ background: "#18202f", border: "1px solid #334155", borderRadius: "16px", padding: "20px" }}>
            <h4 style={{ color: "#fff", margin: "0 0 8px 0", fontSize: "16px" }}>
              خطة الاستقلالية الذاتية (3 سنوات)
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
              يتم تخزين كافة بيانات الدواليب والحجوزات وقوائم الانتظار محلياً وسحابياً بشكل دائم، مما يتيح التخلي التام والتدريجي عن جوجل شيت والاعتماد بنسبة 100% على بوابة التربية الفنية الموحدة.
            </p>
          </div>

        </div>
      )}

      {/* النافذة المنبثقة لتفاصيل الدولاب المحدد */}
      {selectedLocker && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10001,
          padding: "16px"
        }}>
          <div style={{
            background: "#18202f",
            border: "1px solid #334155",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "500px",
            padding: "24px",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#38bdf8" }}>
                دولاب {selectedLocker.locker_code}
              </div>
              <button
                onClick={() => setSelectedLocker(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* تفاصيل السعة والإتاحة */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button
                onClick={() => handleToggleEnabled(selectedLocker.locker_code)}
                style={{
                  flex: 1,
                  background: selectedLocker.is_enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: `1px solid ${selectedLocker.is_enabled ? "#10b981" : "#ef4444"}`,
                  color: selectedLocker.is_enabled ? "#34d399" : "#fca5a5",
                  padding: "10px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {selectedLocker.is_enabled ? <Unlock size={16} /> : <Lock size={16} />}
                <span>{selectedLocker.is_enabled ? "متاح للطلاب" : "محجوب إدارياً"}</span>
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                {[2, 4].map((cap) => (
                  <button
                    key={cap}
                    onClick={() => handleUpdateCapacity(selectedLocker.locker_code, cap)}
                    style={{
                      background: selectedLocker.capacity === cap ? "#2563eb" : "#0f172a",
                      border: "1px solid #334155",
                      color: "#fff",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    سعة {cap}
                  </button>
                ))}
              </div>
            </div>

            {/* إذا كان الدولاب محجوزاً */}
            {selectedBooking ? (
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#38bdf8", fontWeight: "bold" }}>الفرقة: {selectedBooking.cohort}</span>
                  <span style={{ color: selectedBooking.status === "confirmed" ? "#10b981" : "#fbbf24", fontSize: "12px", fontWeight: "bold" }}>
                    {selectedBooking.status === "confirmed" ? "معتمد" : "معلق"}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "12px" }}>
                  هاتف التواصل: <span dir="ltr">{selectedBooking.representative_phone}</span>
                </div>

                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#fff", marginBottom: "8px" }}>
                  الطلاب المسكنون:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedBooking.student_names.map((name: string, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 10px", borderRadius: "8px", fontSize: "13px" }}>
                      <span style={{ color: "#f1f5f9" }}>{i + 1}. {name}</span>
                      <button
                        onClick={() => handleRemoveStudent(selectedBooking.id, name)}
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                        title="إقصاء هذا الطالب فقط"
                      >
                        <UserMinus size={14} />
                        <span>إقصاء</span>
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  {selectedBooking.status === "pending" && (
                    <button
                      onClick={() => handleConfirmBooking(selectedBooking.id)}
                      style={{ flex: 1, background: "#10b981", color: "#fff", border: "none", padding: "10px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}
                    >
                      اعتماد الحجز
                    </button>
                  )}
                  <button
                    onClick={() => printLockerReceipt({
                      bookingId: selectedBooking.id,
                      lockerCode: selectedBooking.locker_code,
                      cohort: selectedBooking.cohort,
                      phone: selectedBooking.representative_phone,
                      studentNames: selectedBooking.student_names,
                      studentCodes: selectedBooking.student_codes
                    })}
                    style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "10px", cursor: "pointer" }}
                  >
                    <Printer size={18} />
                  </button>
                  <button
                    onClick={() => handleVacateLocker(selectedLocker.locker_code)}
                    style={{ background: "#dc2626", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "10px", cursor: "pointer" }}
                    title="إخلاء الدولاب بالكامل"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", textAlign: "center", color: "#94a3b8", marginBottom: "16px" }}>
                هذا الدولاب شاغر حالياً وغير مسكن عليه أي طالب.
              </div>
            )}

            <button
              onClick={() => setSelectedLocker(null)}
              style={{ width: "100%", background: "#334155", color: "#cbd5e1", border: "none", padding: "10px", borderRadius: "10px", fontSize: "14px", cursor: "pointer" }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
