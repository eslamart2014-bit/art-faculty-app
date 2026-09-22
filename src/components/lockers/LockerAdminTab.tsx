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
  X,
  Plus,
  FileSpreadsheet,
  UploadCloud,
  ShieldCheck,
  Edit3,
  Link as LinkIcon,
  FileText,
  Eye
} from "lucide-react";
import { printLockerReceipt } from "@/lib/lockerReceipt";

export default function LockerAdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<"grid" | "sync" | "pending" | "search" | "tools">("grid");
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

  // نافذة تخصيص وإدارة الدولاب (الضغط المطول)
  const [adminModalLocker, setAdminModalLocker] = useState<any | null>(null);

  // نافذة التسكين اليدوي المباشر
  const [manualAssignLocker, setManualAssignLocker] = useState<any | null>(null);
  const [manualAssignCohort, setManualAssignCohort] = useState<string>("الفرقة الرابعة");
  const [manualAssignPhone, setManualAssignPhone] = useState<string>("");
  const [manualAssignNames, setManualAssignNames] = useState<string[]>(["", "", "", ""]);

  // إعداد وضبط أعداد ونطاقات الدواليب
  const [inventoryRanges, setInventoryRanges] = useState<{ [key: string]: number }>({ A: 40, B: 40, C: 40, D: 40 });
  const [savingRanges, setSavingRanges] = useState<boolean>(false);

  // استيراد بيانات التسكين من شيت جوجل
  const [importText, setImportText] = useState<string>("");
  const [importingData, setImportingData] = useState<boolean>(false);
  const [importReport, setImportReport] = useState<any | null>(null);

  // الجناح المتقدم لمزامنة واستيراد جوجل شيت (Google Sheets Sync Suite)
  const [syncTabMode, setSyncTabMode] = useState<"url" | "file" | "paste">("url");
  const [sheetUrlInput, setSheetUrlInput] = useState<string>("");
  const [syncStrategy, setSyncStrategy] = useState<"full" | "confirmed_only" | "custom">("full");
  const [customSheetTab, setCustomSheetTab] = useState<string>("Sheet1");
  const [cleanBeforeSync, setCleanBeforeSync] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncStatusResult, setSyncStatusResult] = useState<any | null>(null);
  const [reconcilingStudents, setReconcilingStudents] = useState<boolean>(false);

  // حالات رفع الملفات والمعاينة التفاعلية
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [commitLoading, setCommitLoading] = useState<boolean>(false);

  // Clear Cohort State
  const [cohortToClear, setCohortToClear] = useState<string>("الفرقة الرابعة");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // معالجات الضغط المطول الدقيقة
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);
  const pressStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
        if (json.ranges) {
          setInventoryRanges(json.ranges);
        }
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

  // تبديل إتاحة الدولاب (متاح / محجوب)
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
        if (adminModalLocker && adminModalLocker.locker_code === lockerCode) {
          setAdminModalLocker({ ...adminModalLocker, is_enabled: json.is_enabled });
        }
      }
    } catch (e) {
      showToast("خطأ في تحديث حالة الدولاب");
    }
  };

  // تخصيص الدولاب للإدارة أو إلغاء التخصيص (الميزة المطلوبة بالضغط المطول)
  const handleSetAdminReserved = async (lockerCode: string, reserved: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_admin_reserved', lockerCode, reserved })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
        if (adminModalLocker && adminModalLocker.locker_code === lockerCode) {
          setAdminModalLocker(json.locker || { ...adminModalLocker, is_admin_reserved: reserved, is_enabled: !reserved });
        }
        if (selectedLocker && selectedLocker.locker_code === lockerCode) {
          setSelectedLocker(json.locker || { ...selectedLocker, is_admin_reserved: reserved, is_enabled: !reserved });
        }
      } else {
        showToast(json.error || "فشل تحديث تخصيص الإدارة");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // حفظ نطاقات وأعداد الدواليب
  const handleSaveRanges = async () => {
    setSavingRanges(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_ranges', ranges: inventoryRanges })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        fetchData();
      } else {
        showToast(json.error || "فشل تحديث أعداد الدواليب");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setSavingRanges(false);
    }
  };

  // استيراد بيانات التسكين بالجملة من شيت جوجل
  const handleImportData = async () => {
    if (!importText.trim()) {
      alert("يرجى لصق بيانات جدول التسجيلات من شيت جوجل أولاً.");
      return;
    }
    setImportingData(true);
    setImportReport(null);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_data', rawData: importText })
      });
      const json = await res.json();
      setImportReport(json);
      if (json.success) {
        showToast(json.message);
        setImportText("");
        await fetchData();
        setActiveSubTab("grid");
      } else {
        showToast(json.message || "تعذر الاستيراد، يرجى مراجعة التنسيق");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setImportingData(false);
    }
  };

  // 1. المزامنة المباشرة الذكية عبر الرابط من جوجل شيت
  const handleSyncFromUrl = async () => {
    if (!sheetUrlInput || !sheetUrlInput.trim()) {
      showToast("يرجى إدخال رابط أو معرّف Google Sheet أولاً");
      return;
    }
    setSyncLoading(true);
    setSyncStatusResult(null);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_sheet_url',
          sheetUrl: sheetUrlInput.trim(),
          mode: syncStrategy,
          customTab: customSheetTab,
          cleanBeforeSync
        })
      });
      const json = await res.json();
      setSyncStatusResult(json);
      if (json.success) {
        showToast(json.message);
        await fetchData();
        setActiveSubTab("grid");
      } else {
        showToast(json.message || "فشلت المزامنة");
      }
    } catch (e) {
      showToast("خطأ في الاتصال بالخادم أثناء المزامنة");
    } finally {
      setSyncLoading(false);
    }
  };

  // 1. أ. مطابقة وربط الأسماء مع قاعدة بيانات الطلاب وتعبئة الأكواد
  const handleReconcileStudents = async () => {
    setReconcilingStudents(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_students'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        await fetchData();
      } else {
        showToast(json.message || "فشلت المطابقة مع قاعدة بيانات الطلاب");
      }
    } catch (e) {
      showToast("خطأ في الاتصال أثناء مطابقة بيانات الطلاب");
    } finally {
      setReconcilingStudents(false);
    }
  };

  // 1. ب. معاينة تفاعلية لكامل بيانات الرابط قبل الاعتماد
  const handlePreviewUrl = async () => {
    if (!sheetUrlInput || !sheetUrlInput.trim()) {
      showToast("يرجى إدخال رابط أو معرّف Google Sheet أولاً");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_sheet_url',
          sheetUrl: sheetUrlInput.trim(),
          mode: syncStrategy,
          customTab: customSheetTab
        })
      });
      const json = await res.json();
      if (json.success) {
        setPreviewData(json);
        const tabsScanned = json.scannedTabs && json.scannedTabs.length > 0 ? ` من ${json.scannedTabs.length} أوراق` : '';
        showToast(`تم استخراج ${json.total} صفوف بنجاح${tabsScanned}، راجع جدول المعاينة أدناه`);
      } else {
        showToast(json.errors?.[0] || "تعذر قراءة بيانات الشيت");
      }
    } catch (e) {
      showToast("خطأ في الاتصال بالخادم أثناء المعاينة");
    } finally {
      setPreviewLoading(false);
    }
  };

  // 2. تحليل ومعاينة البيانات تفاعلياً قبل الاعتماد
  const handlePreviewRawData = async (rawText: string) => {
    if (!rawText || !rawText.trim()) {
      showToast("لا توجد بيانات صالحة للمعاينة");
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_data',
          rawData: rawText
        })
      });
      const json = await res.json();
      if (json.success) {
        setPreviewData(json);
        showToast(`تم استخراج ${json.total} صفوف بنجاح، راجع جدول المعاينة أدناه`);
      } else {
        showToast(json.errors?.[0] || "تعذر قراءة البيانات بالشكل الصحيح");
      }
    } catch (e) {
      showToast("خطأ في الاتصال بالخادم");
    } finally {
      setPreviewLoading(false);
    }
  };

  // 3. معالجة قراءة ملف الـ CSV / TSV المرفوع
  const handleFileProcess = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handlePreviewRawData(content);
      }
    };
    reader.readAsText(file);
  };

  // 4. اعتماد وتسكين البيانات بعد المعاينة التفاعلية
  const handleCommitPreview = async () => {
    if (!previewData || !previewData.rows || previewData.rows.length === 0) {
      showToast("لا توجد بيانات لاعتمادها");
      return;
    }
    setCommitLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit_preview',
          rows: previewData.rows,
          cleanBeforeSync
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || `تم بنجاح تسكين ${json.importedCount || previewData.total} حجزاً وحفظها في السحابة!`);
        setPreviewData(null);
        setImportText("");
        setUploadedFileName(null);
        await fetchData();
        setActiveSubTab("grid");
      } else {
        showToast(json.message || "فشل اعتماد التسكين");
      }
    } catch (e) {
      showToast("خطأ بالاتصال أثناء الاعتماد");
    } finally {
      setCommitLoading(false);
    }
  };

  // فتح نافذة التسكين اليدوي لدولاب
  const openManualAssign = (locker: any) => {
    setManualAssignLocker(locker);
    setManualAssignCohort("الفرقة الرابعة");
    setManualAssignPhone("");
    const cap = locker.capacity || 4;
    setManualAssignNames(new Array(cap).fill(""));
  };

  // حفظ التسكين اليدوي
  const handleManualAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAssignLocker) return;
    const names = manualAssignNames.map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      alert("يرجى إدخال اسم طالب واحد على الأقل.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_assign',
          lockerCode: manualAssignLocker.locker_code,
          cohort: manualAssignCohort,
          phone: manualAssignPhone,
          studentNames: names
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        setManualAssignLocker(null);
        if (adminModalLocker) setAdminModalLocker(null);
        if (selectedLocker) setSelectedLocker(null);
        fetchData();
      } else {
        showToast(json.error || "فشل التسكين");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
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
        if (adminModalLocker && adminModalLocker.locker_code === lockerCode) {
          setAdminModalLocker({ ...adminModalLocker, capacity });
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

  // معالجات الضغط المطول (Long Press) الدقيقة
  const startLongPress = (locker: any, clientX: number, clientY: number) => {
    isLongPressActive.current = false;
    pressStartPos.current = { x: clientX, y: clientY };
    if (pressTimer.current) clearTimeout(pressTimer.current);

    pressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(50); } catch (e) {}
      }
      setAdminModalLocker(locker);
    }, 450);
  };

  const cancelLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    const dx = Math.abs(clientX - pressStartPos.current.x);
    const dy = Math.abs(clientY - pressStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelLongPress();
    }
  };

  const handleCardClick = (locker: any) => {
    if (isLongPressActive.current) {
      isLongPressActive.current = false;
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

        <div style={{ background: "#18202f", border: "1px solid #38bdf8", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#7dd3fc" }}>بانتظار الاعتماد</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#38bdf8", marginTop: "4px" }}>{stats?.pending || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #f59e0b", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#fcd34d" }}>مخصص للإدارة 🔒</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b", marginTop: "4px" }}>{stats?.adminReserved || 0}</div>
        </div>

        <div style={{ background: "#18202f", border: "1px solid #14b8a6", padding: "14px", borderRadius: "14px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#5eead4" }}>دواليب شاغرة</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#14b8a6", marginTop: "4px" }}>{stats?.empty || 0}</div>
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
          { id: "sync", label: "المزامنة الذكية مع شيت جوجل 📊" },
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
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }}></span>
              <span>ميزة خاصة: <strong>الضغط المطول</strong> (أو كليك يمين) يفتح نافذة تخصيص الدولاب للإدارة 🔒 وتعديل سعته فوراً</span>
            </div>
          </div>

          {/* شبكة الكروت */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>جاري تحميل شبكة الدواليب...</div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: "10px"
            }}>
              {lockers.map((locker) => {
                const isAdminReserved = locker.is_admin_reserved || (!locker.is_enabled && !locker.current_booking_id && (locker.notes || '').includes('إدارة'));
                const isConfirmed = locker.status === "confirmed";
                const isPending = locker.status === "pending";
                const isDisabled = !locker.is_enabled && !isAdminReserved;

                let border = "#334155";
                let bg = "#141b29";
                let color = "#e2e8f0";
                let statusLabel = `شاغر (${locker.capacity})`;

                if (isAdminReserved) {
                  border = "#f59e0b";
                  bg = "rgba(245, 158, 11, 0.14)";
                  color = "#fbbf24";
                  statusLabel = "مخصص للإدارة";
                } else if (isDisabled) {
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
                  border = "#38bdf8";
                  bg = "rgba(56, 189, 248, 0.12)";
                  color = "#7dd3fc";
                  statusLabel = "معلق";
                }

                return (
                  <div
                    key={locker.locker_code}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setAdminModalLocker(locker);
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0) startLongPress(locker, e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
                    onMouseUp={cancelLongPress}
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      startLongPress(locker, t.clientX, t.clientY);
                    }}
                    onTouchMove={(e) => {
                      const t = e.touches[0];
                      handlePointerMove(t.clientX, t.clientY);
                    }}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    onClick={() => handleCardClick(locker)}
                    style={{
                      background: bg,
                      border: `1.5px solid ${border}`,
                      borderRadius: "12px",
                      padding: "10px 8px",
                      textAlign: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      position: "relative",
                      transition: "transform 0.1s ease, border-color 0.2s ease",
                      boxShadow: isAdminReserved ? "0 0 10px rgba(245, 158, 11, 0.2)" : "none"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                    onMouseLeave={(e) => {
                      cancelLongPress();
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {isAdminReserved ? (
                      <div style={{ position: "absolute", top: "5px", left: "5px" }} title="مخصص للإدارة">
                        <Lock size={13} color="#f59e0b" />
                      </div>
                    ) : isDisabled ? (
                      <div style={{ position: "absolute", top: "5px", left: "5px" }} title="محجوب">
                        <Lock size={12} color="#94a3b8" />
                      </div>
                    ) : null}
                    <div style={{ fontSize: "16px", fontWeight: "900", color }}>
                      {locker.locker_code}
                    </div>
                    <div style={{
                      fontSize: "11px",
                      marginTop: "4px",
                      color: isDisabled ? "#64748b" : color,
                      opacity: 0.9,
                      fontWeight: isAdminReserved ? "bold" : "normal"
                    }}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* تبويب المزامنة الذكية مع جوجل شيت (Google Sheets Sync Suite) */}
      {activeSubTab === "sync" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* رأس القسم التعريفي */}
          <div style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(56, 189, 248, 0.1) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: "18px",
            padding: "24px",
            position: "relative"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid #10b981",
                borderRadius: "14px",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981"
              }}>
                <FileSpreadsheet size={26} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: "#fff" }}>
                  جناح المزامنة والاسترداد الذكي من Google Sheets 📊
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
                  استرداد وتسكين ومطابقة كشوف الدواليب والطلاب تلقائياً بدون أي أخطاء يدوية أو تكرار
                </p>
              </div>
            </div>
          </div>

          {/* محدد نمط الاستيراد (3 أوضاع متقدمة) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px",
            background: "#0f172a",
            padding: "8px",
            borderRadius: "14px",
            border: "1px solid #334155"
          }}>
            <button
              onClick={() => setSyncTabMode("url")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                background: syncTabMode === "url" ? "#10b981" : "transparent",
                color: syncTabMode === "url" ? "#fff" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <LinkIcon size={18} />
              <span>1. الرابط المباشر (Live URL)</span>
            </button>

            <button
              onClick={() => setSyncTabMode("file")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                background: syncTabMode === "file" ? "#0284c7" : "transparent",
                color: syncTabMode === "file" ? "#fff" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <UploadCloud size={18} />
              <span>2. رفع ملف CSV / TSV</span>
            </button>

            <button
              onClick={() => setSyncTabMode("paste")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                background: syncTabMode === "paste" ? "#6366f1" : "transparent",
                color: syncTabMode === "paste" ? "#fff" : "#94a3b8",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              <FileText size={18} />
              <span>3. اللصق الذكي مع المعاينة</span>
            </button>
          </div>

          {/* الوضع 1: المزامنة الحية عبر الرابط المباشر */}
          {syncTabMode === "url" && (
            <div style={{ background: "#18202f", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: "#f8fafc", marginBottom: "8px" }}>
                    🔗 رابط أو معرّف ملف Google Sheet:
                  </label>
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit أو معرف الشيت"
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #475569",
                      borderRadius: "12px",
                      color: "#fff",
                      padding: "14px 16px",
                      fontSize: "14px",
                      direction: "ltr",
                      outline: "none"
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", display: "block", lineHeight: "1.5" }}>
                    💡 يدعم الروابط المباشرة من المتصفح أو المعرّف المنفرد. تأكد من ضبط مشاركة الشيت على: <strong>أي شخص لديه الرابط يمكنه العرض (Anyone with the link can view)</strong>.
                  </span>
                </div>

                {/* خيارات ونطاق المزامنة */}
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "bold", color: "#f8fafc", marginBottom: "10px" }}>
                    ⚙️ استراتيجية المزامنة والتسكين:
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                    
                    <div
                      onClick={() => setSyncStrategy("full")}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: syncStrategy === "full" ? "2px solid #10b981" : "1px solid #334155",
                        background: syncStrategy === "full" ? "rgba(16, 185, 129, 0.12)" : "#0f172a",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: syncStrategy === "full" ? "#34d399" : "#cbd5e1", fontSize: "14px" }}>
                        ⚡ مزامنة شاملة ذكية (موصى به)
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.5" }}>
                        يقرأ شيتات A,B,C,D (أعداد المخزون وتخصيص الإدارة) + شيت التسجيلات المؤكدة + المؤقتة في عملية واحدة.
                      </div>
                    </div>

                    <div
                      onClick={() => setSyncStrategy("confirmed_only")}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: syncStrategy === "confirmed_only" ? "2px solid #38bdf8" : "1px solid #334155",
                        background: syncStrategy === "confirmed_only" ? "rgba(56, 189, 248, 0.12)" : "#0f172a",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: syncStrategy === "confirmed_only" ? "#38bdf8" : "#cbd5e1", fontSize: "14px" }}>
                        ✅ التسجيلات المؤكدة فقط
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.5" }}>
                        يستورد فقط الكشف النهائي المعتمد دون المساس بباقي الدواليب.
                      </div>
                    </div>

                    <div
                      onClick={() => setSyncStrategy("custom")}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: syncStrategy === "custom" ? "2px solid #a855f7" : "1px solid #334155",
                        background: syncStrategy === "custom" ? "rgba(168, 85, 247, 0.12)" : "#0f172a",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: "bold", color: syncStrategy === "custom" ? "#c084fc" : "#cbd5e1", fontSize: "14px" }}>
                        📄 ورقة مخصصة
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.5" }}>
                        استيراد كشف من اسم ورقة معينة تحددها أنت في الشيت.
                      </div>
                    </div>

                  </div>
                </div>

                {syncStrategy === "custom" && (
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#cbd5e1", marginBottom: "6px" }}>
                      اسم الورقة (Tab Name) في شيت جوجل:
                    </label>
                    <input
                      type="text"
                      value={customSheetTab}
                      onChange={(e) => setCustomSheetTab(e.target.value)}
                      placeholder="مثال: Sheet1 أو التسجيلات_المؤكدة"
                      style={{
                        width: "100%",
                        maxWidth: "350px",
                        background: "#0f172a",
                        border: "1px solid #475569",
                        borderRadius: "10px",
                        color: "#fff",
                        padding: "10px 14px",
                        fontSize: "14px",
                        outline: "none"
                      }}
                    />
                  </div>
                )}

                {/* خيار الاستبدال النظيف */}
                <div style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px"
                }}>
                  <input
                    type="checkbox"
                    id="cleanSync"
                    checked={cleanBeforeSync}
                    onChange={(e) => setCleanBeforeSync(e.target.checked)}
                    style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#10b981", cursor: "pointer" }}
                  />
                  <label htmlFor="cleanSync" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f8fafc" }}>
                      تفريغ الحجوزات السابقة قبل المزامنة (استبدال نظيف Clean Replace)
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                      عند التفعيل، سيتم إخلاء جميع الدواليب المسكنة غير المخصصة للإدارة وإعادة التسكين بالكامل طبقاً للشيت فقط لمنع أي تكرار.
                    </div>
                  </label>
                </div>

                {/* أزرار المعاينة والمزامنة المباشرة */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                  <button
                    onClick={handlePreviewUrl}
                    disabled={previewLoading || syncLoading}
                    style={{
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      fontWeight: "900",
                      fontSize: "15px",
                      cursor: (previewLoading || syncLoading) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      boxShadow: "0 4px 20px rgba(99, 102, 241, 0.25)"
                    }}
                  >
                    <Eye size={18} />
                    <span>{previewLoading ? "جاري فحص وقراءة الأوراق..." : "معاينة وتحليل كامل بيانات الرابط 👁️"}</span>
                  </button>

                  <button
                    onClick={handleSyncFromUrl}
                    disabled={syncLoading || previewLoading || reconcilingStudents}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      fontWeight: "900",
                      fontSize: "15px",
                      cursor: (syncLoading || previewLoading || reconcilingStudents) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      boxShadow: "0 4px 20px rgba(16, 185, 129, 0.25)"
                    }}
                  >
                    <RefreshCw size={18} className={syncLoading ? "animate-spin" : ""} />
                    <span>{syncLoading ? "جاري المزامنة الشاملة..." : "بدء المزامنة الفورية لكامل الشيت ⚡"}</span>
                  </button>

                  <button
                    onClick={handleReconcileStudents}
                    disabled={reconcilingStudents || syncLoading || previewLoading}
                    style={{
                      background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "14px 20px",
                      borderRadius: "12px",
                      fontWeight: "900",
                      fontSize: "15px",
                      cursor: (reconcilingStudents || syncLoading || previewLoading) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      boxShadow: "0 4px 20px rgba(139, 92, 246, 0.25)"
                    }}
                    title="مطابقة أسماء الحجوزات مع قاعدة بيانات الطلاب وتعبئة الأكواد لظهور الدواليب بحساباتهم فورياً"
                  >
                    <Users size={18} className={reconcilingStudents ? "animate-spin" : ""} />
                    <span>{reconcilingStudents ? "جاري مطابقة وربط الأكواد..." : "مطابقة الأكواد مع قاعدة بيانات الطلاب 🔄"}</span>
                  </button>
                </div>

                {/* تقرير المزامنة المباشرة */}
                {syncStatusResult && (
                  <div style={{
                    background: syncStatusResult.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    border: `1px solid ${syncStatusResult.success ? "#10b981" : "#ef4444"}`,
                    borderRadius: "12px",
                    padding: "16px",
                    color: syncStatusResult.success ? "#6ee7b7" : "#fca5a5",
                    fontSize: "14px"
                  }}>
                    <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "6px" }}>
                      {syncStatusResult.success ? "✅ تمت المزامنة بنجاح!" : "❌ تنبيه أثناء المزامنة:"}
                    </div>
                    <p style={{ margin: "0 0 10px 0", lineHeight: "1.6" }}>{syncStatusResult.message}</p>
                    {syncStatusResult.success && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "13px" }}>
                          <span style={{ background: "#064e3b", padding: "4px 10px", borderRadius: "6px", color: "#a7f3d0" }}>
                            حجوزات مؤكدة: <strong>{syncStatusResult.importedConfirmed}</strong>
                          </span>
                          <span style={{ background: "#1e3a8a", padding: "4px 10px", borderRadius: "6px", color: "#bfdbfe" }}>
                            حجوزات معلقة: <strong>{syncStatusResult.importedPending}</strong>
                          </span>
                          <span style={{ background: "#78350f", padding: "4px 10px", borderRadius: "6px", color: "#fde68a" }}>
                            مخصص للإدارة: <strong>{syncStatusResult.adminReservedCount}</strong>
                          </span>
                          <span style={{ background: "#312e81", padding: "4px 10px", borderRadius: "6px", color: "#c7d2fe" }}>
                            إجمالي الدواليب: <strong>{syncStatusResult.totalLockers}</strong>
                          </span>
                        </div>

                        {syncStatusResult.scannedTabs && syncStatusResult.scannedTabs.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", fontSize: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
                            <span style={{ color: "#94a3b8" }}>الأوراق التي تم سحبها:</span>
                            {syncStatusResult.scannedTabs.map((tab: string, ti: number) => (
                              <span key={ti} style={{ background: "#1e293b", border: "1px solid #475569", padding: "2px 8px", borderRadius: "6px", color: "#e2e8f0" }}>
                                📄 {tab}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* الوضع 2: رفع ملف محلي CSV / TSV */}
          {syncTabMode === "file" && (
            <div style={{ background: "#18202f", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", color: "#fff", fontSize: "16px" }}>
                    📁 رفع ملف كشف التسكين (CSV أو TSV)
                  </h4>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px", lineHeight: "1.6" }}>
                    إذا كان ملف جوجل شيت خاصاً أو بدون إنترنت، يمكنك تنزيله من جوجل شيت عبر 
                    <strong style={{ color: "#38bdf8" }}> (ملف ⬅️ تنزيل ⬅️ قيم مفصولة بفواصل .csv) </strong> 
                    ثم رفعه هنا مباشرة لمعاينته وتسكينه فوراً.
                  </p>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileProcess(e.dataTransfer.files[0]);
                    }
                  }}
                  style={{
                    border: dragOver ? "2px dashed #38bdf8" : "2px dashed #475569",
                    background: dragOver ? "rgba(56, 189, 248, 0.1)" : "#0f172a",
                    borderRadius: "16px",
                    padding: "36px 20px",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onClick={() => {
                    const input = document.getElementById("csvFileInput");
                    if (input) input.click();
                  }}
                >
                  <UploadCloud size={46} color={dragOver ? "#38bdf8" : "#94a3b8"} style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: "15px", fontWeight: "bold", color: "#fff", marginBottom: "6px" }}>
                    {uploadedFileName ? `الملف المختار: ${uploadedFileName}` : "انقر لاختيار ملف من جهازك أو اسحبه وأفلته هنا"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    يدعم ملفات CSV و TSV و TXT بترميز UTF-8
                  </div>
                  <input
                    id="csvFileInput"
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileProcess(e.target.files[0]);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* الوضع 3: اللصق الذكي المباشر */}
          {syncTabMode === "paste" && (
            <div style={{ background: "#18202f", border: "1px solid #334155", borderRadius: "16px", padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", color: "#fff", fontSize: "16px" }}>
                    📋 اللصق المباشر من الحافظة مع المعاينة الذكية
                  </h4>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px", lineHeight: "1.6" }}>
                    حدد الصفوف في جوجل شيت أو إكسيل واضغط (Ctrl+C)، ثم الصقها في الصندوق أدناه واضغط "معاينة وتحليل البيانات".
                  </p>
                </div>

                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="الصق الصفوف هنا... مثال:&#10;A1	الفرقة الرابعة	01012345678	أحمد محمد علي	محمود حسن سيد&#10;B5	الفرقة الثالثة	01122334455	سارة أحمد	منى علي"
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    padding: "14px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    direction: "ltr",
                    outline: "none",
                    resize: "vertical"
                  }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => handlePreviewRawData(importText)}
                    disabled={previewLoading || !importText.trim()}
                    style={{
                      background: "#6366f1",
                      color: "#fff",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "10px",
                      fontWeight: "bold",
                      fontSize: "14px",
                      cursor: (previewLoading || !importText.trim()) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Eye size={18} />
                    <span>{previewLoading ? "جاري التحليل والمعاينة..." : "معاينة وتحليل البيانات 👁️"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* جدول المعاينة التفاعلي المشترك (Interactive Table Preview) */}
          {previewData && previewData.rows && previewData.rows.length > 0 && (
            <div style={{
              background: "#18202f",
              border: "2px solid #6366f1",
              borderRadius: "18px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              boxShadow: "0 10px 30px rgba(99, 102, 241, 0.15)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#fff" }}>
                    👁️ جدول معاينة وتسكين البيانات قبل الاعتماد النهائي
                  </h4>
                  <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "4px" }}>
                    راجع البيانات المستخرجة بدقة أدناه، ثم اضغط زر التأكيد لتسكينها واعتمادها فوراً.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ background: "#1e293b", border: "1px solid #475569", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#fff", fontWeight: "bold" }}>
                    إجمالي: {previewData.total}
                  </span>
                  <span style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#34d399", fontWeight: "bold" }}>
                    مؤكد: {previewData.confirmedCount}
                  </span>
                  <span style={{ background: "rgba(56, 189, 248, 0.2)", border: "1px solid #38bdf8", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#38bdf8", fontWeight: "bold" }}>
                    معلق: {previewData.pendingCount}
                  </span>
                  <span style={{ background: "rgba(99, 102, 241, 0.2)", border: "1px solid #6366f1", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#818cf8", fontWeight: "bold" }}>
                    دواليب مميزة: {previewData.uniqueLockers}
                  </span>
                  {previewData.conflictCount > 0 && (
                    <span style={{ background: "rgba(245, 158, 11, 0.2)", border: "1px solid #f59e0b", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", color: "#fbbf24", fontWeight: "bold" }}>
                      تنبيهات: {previewData.conflictCount}
                    </span>
                  )}
                  <button
                    onClick={handleCommitPreview}
                    disabled={commitLoading}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: "12px",
                      fontWeight: "900",
                      fontSize: "13px",
                      cursor: commitLoading ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)"
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{commitLoading ? "جاري التسكين..." : `تأكيد وتسكين الكل (${previewData.total}) 🚀`}</span>
                  </button>
                </div>
              </div>

              {/* شريط الأوراق التي تم فحصها وسحبها */}
              {previewData.scannedTabs && previewData.scannedTabs.length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  fontSize: "12px",
                  background: "#0f172a",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #334155"
                }}>
                  <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
                    📁 الأوراق التي تم مسحها بنجاح ({previewData.scannedTabs.length}):
                  </span>
                  {previewData.scannedTabs.map((tab: string, ti: number) => (
                    <span key={ti} style={{ background: "#1e293b", border: "1px solid #475569", padding: "2px 8px", borderRadius: "6px", color: "#f8fafc" }}>
                      📄 {tab}
                    </span>
                  ))}
                </div>
              )}

              {/* خيار الاستبدال النظيف للمعاينات */}
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                padding: "12px 16px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                <input
                  type="checkbox"
                  id="cleanPreviewCommit"
                  checked={cleanBeforeSync}
                  onChange={(e) => setCleanBeforeSync(e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#6366f1", cursor: "pointer" }}
                />
                <label htmlFor="cleanPreviewCommit" style={{ cursor: "pointer", fontSize: "13px", color: "#cbd5e1" }}>
                  تفريغ الحجوزات السابقة قبل اعتماد هذه البيانات (استبدال نظيف Clean Replace)
                </label>
              </div>

              {/* الجدول */}
              <div style={{ overflowX: "auto", maxHeight: "380px", borderRadius: "12px", border: "1px solid #334155" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                      <th style={{ padding: "12px 14px", width: "40px" }}>#</th>
                      <th style={{ padding: "12px 14px" }}>رمز الدولاب</th>
                      <th style={{ padding: "12px 14px" }}>الفرقة</th>
                      <th style={{ padding: "12px 14px" }}>هاتف التواصل</th>
                      <th style={{ padding: "12px 14px" }}>أسماء الطلاب</th>
                      <th style={{ padding: "12px 14px" }}>نوع الحجز</th>
                      <th style={{ padding: "12px 14px" }}>حالة الدولاب / تنبيهات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row: any, idx: number) => (
                      <tr
                        key={row.id || idx}
                        style={{
                          borderBottom: "1px solid #1e293b",
                          background: idx % 2 === 0 ? "rgba(15, 23, 42, 0.6)" : "transparent"
                        }}
                      >
                        <td style={{ padding: "10px 14px", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            background: "#1e293b",
                            border: "1px solid #38bdf8",
                            color: "#38bdf8",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            fontFamily: "monospace"
                          }}>
                            {row.locker_code}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>{row.cohort}</td>
                        <td style={{ padding: "10px 14px", color: "#94a3b8", direction: "ltr", textAlign: "right" }}>
                          {row.phone || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#fff" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {row.student_names && row.student_names.length > 0 ? (
                              row.student_names.map((n: string, ni: number) => (
                                <span key={ni} style={{ background: "#1e293b", border: "1px solid #334155", padding: "2px 8px", borderRadius: "4px", fontSize: "12px" }}>
                                  {n}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "#ef4444" }}>لا توجد أسماء</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{
                            background: row.status === "confirmed" ? "rgba(16, 185, 129, 0.15)" : "rgba(56, 189, 248, 0.15)",
                            color: row.status === "confirmed" ? "#34d399" : "#38bdf8",
                            border: `1px solid ${row.status === "confirmed" ? "#10b981" : "#38bdf8"}`,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "bold"
                          }}>
                            {row.status === "confirmed" ? "معتمد" : "معلق"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {row.conflict_warning ? (
                            <span style={{ color: "#fbbf24", fontSize: "12px", fontWeight: "bold" }}>
                              ⚠️ {row.conflict_warning}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                              {row.is_existing ? "متاح للتسكين" : "دولاب جديد سيُضاف"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* أزرار الاعتماد والإلغاء */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={handleCommitPreview}
                  disabled={commitLoading}
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "12px 28px",
                    borderRadius: "12px",
                    fontWeight: "900",
                    fontSize: "15px",
                    cursor: commitLoading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)"
                  }}
                >
                  <CheckCircle2 size={18} />
                  <span>{commitLoading ? "جاري التسكين والاعتماد..." : `تأكيد وتسكين البيانات في النظام (${previewData.total} حجز) 🚀`}</span>
                </button>

                <button
                  onClick={() => { setPreviewData(null); setUploadedFileName(null); }}
                  disabled={commitLoading}
                  style={{
                    background: "transparent",
                    color: "#94a3b8",
                    border: "1px solid #475569",
                    padding: "12px 20px",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  إلغاء المعاينة
                </button>
              </div>

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
          
          {/* أداة ضبط أعداد ونطاقات دواليب الأقسام */}
          <div style={{ background: "#18202f", border: "1px solid #38bdf8", borderRadius: "16px", padding: "22px" }}>
            <h4 style={{ color: "#38bdf8", margin: "0 0 8px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={18} />
              <span>إعداد وضبط أعداد ونطاقات دواليب الأقسام (A, B, C, D)</span>
            </h4>
            <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              حدد العدد الفعلي للدواليب المتوفرة في كليتك لكل قسم. سيتم تحديث شبكة الدواليب فوراً دون التأثير على أي حجوزات أو تخصيصات قائمة.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {["A", "B", "C", "D"].map((letter) => (
                <div key={letter} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#38bdf8", marginBottom: "6px" }}>
                    قسم ({letter})
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>من 1 إلى</span>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={inventoryRanges[letter] || 40}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setInventoryRanges({ ...inventoryRanges, [letter]: val });
                      }}
                      style={{
                        width: "65px",
                        background: "#1e293b",
                        border: "1px solid #475569",
                        color: "#fff",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontWeight: "bold",
                        fontSize: "15px",
                        outline: "none"
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveRanges}
              disabled={savingRanges}
              style={{
                background: "#0284c7",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Check size={16} />
              <span>{savingRanges ? "جاري الحفظ..." : "حفظ وتحديث شبكة الدواليب 💾"}</span>
            </button>
          </div>

          {/* أداة المزامنة الذكية مع شيت جوجل */}
          <div style={{ background: "#18202f", border: "1px solid #10b981", borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "600px" }}>
                <h4 style={{ color: "#10b981", margin: "0 0 6px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FileSpreadsheet size={20} />
                  <span>جناح المزامنة والاسترداد الذكي من جوجل شيت 📊</span>
                </h4>
                <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                  يتيح لك استيراد ومزامنة كامل الدواليب والتسكين مباشرة بالرابط الحي، أو رفع ملف CSV، أو اللصق مع معاينة جدولية تفاعلية قبل التسكين.
                </p>
              </div>
              <button
                onClick={() => setActiveSubTab("sync")}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(16, 185, 129, 0.25)"
                }}
              >
                <span>فتح جناح المزامنة الذكي 🚀</span>
              </button>
            </div>
          </div>

          {/* أداة تفريغ دفعة كاملة */}
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
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} />
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
                <p style={{ margin: "0 0 14px 0", color: selectedLocker.is_admin_reserved ? "#fbbf24" : "#94a3b8" }}>
                  {selectedLocker.is_admin_reserved ? "🔒 هذا الدولاب مخصص للإدارة حالياً ومحجوب عن الطلاب." : "هذا الدولاب شاغر حالياً وغير مسكن عليه أي طالب."}
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      const lk = selectedLocker;
                      setSelectedLocker(null);
                      openManualAssign(lk);
                    }}
                    style={{
                      background: "#0284c7",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Plus size={15} />
                    <span>تسكين طلاب يدوياً في هذا الدولاب</span>
                  </button>
                  <button
                    onClick={() => {
                      const code = selectedLocker.locker_code;
                      const isRes = selectedLocker.is_admin_reserved;
                      handleSetAdminReserved(code, !isRes);
                    }}
                    style={{
                      background: selectedLocker.is_admin_reserved ? "#10b981" : "#d97706",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Lock size={15} />
                    <span>{selectedLocker.is_admin_reserved ? "إلغاء التخصيص وإتاحته للطلاب" : "تخصيص للإدارة 🔒"}</span>
                  </button>
                </div>
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

      {/* نافذة تخصيص وإدارة الدولاب (تفتح بالضغط المطول أو كليك يمين) */}
      {adminModalLocker && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10002,
          padding: "16px"
        }}>
          <div style={{
            background: "#18202f",
            border: "1.5px solid #f59e0b",
            borderRadius: "22px",
            width: "100%",
            maxWidth: "460px",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
          }}>
            {/* الرأس */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  background: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid #f59e0b",
                  color: "#fbbf24",
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "900",
                  fontSize: "18px"
                }}>
                  {adminModalLocker.locker_code}
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff" }}>
                    إدارة وتخصيص الدولاب
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                    الحالة: {adminModalLocker.is_admin_reserved ? "مخصص للإدارة 🔒" : adminModalLocker.status === "confirmed" ? "معتمد 👥" : adminModalLocker.status === "pending" ? "معلق ⏳" : "شاغر 🟢"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAdminModalLocker(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {/* قائمة الخيارات السريعة */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              
              {/* 1. تخصيص للإدارة / إلغاء التخصيص */}
              <button
                onClick={() => handleSetAdminReserved(adminModalLocker.locker_code, !adminModalLocker.is_admin_reserved)}
                disabled={actionLoading}
                style={{
                  background: adminModalLocker.is_admin_reserved ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  border: `1.5px solid ${adminModalLocker.is_admin_reserved ? "#10b981" : "#f59e0b"}`,
                  borderRadius: "14px",
                  padding: "14px 16px",
                  color: adminModalLocker.is_admin_reserved ? "#34d399" : "#fbbf24",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "right"
                }}
              >
                <div style={{
                  background: adminModalLocker.is_admin_reserved ? "#10b981" : "#f59e0b",
                  color: "#000",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {adminModalLocker.is_admin_reserved ? <Unlock size={20} /> : <Lock size={20} />}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    {adminModalLocker.is_admin_reserved ? "إلغاء تخصيص الإدارة وإتاحته للطلاب 🟢" : "تخصيص الدولاب للإدارة 🔒"}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                    {adminModalLocker.is_admin_reserved ? "إعادة فتح الدولاب ليصبح متاحاً للتسكين الطلابي" : "حجب الدولاب عن حجز الطلاب وتخصيصه للأساتذة والإدارة"}
                  </div>
                </div>
              </button>

              {/* 2. تعديل السعة */}
              <div style={{
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "14px",
                padding: "12px 16px"
              }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px" }}>
                  تحديد سعة الدولاب:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[2, 4].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => handleUpdateCapacity(adminModalLocker.locker_code, cap)}
                      style={{
                        background: adminModalLocker.capacity === cap ? "#2563eb" : "#1e293b",
                        border: adminModalLocker.capacity === cap ? "1px solid #38bdf8" : "1px solid #334155",
                        color: "#fff",
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
                      <Users size={16} />
                      <span>{cap === 2 ? "سعة شخصين (2)" : "سعة 4 طلاب"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. تسكين طلاب يدوياً في هذا الدولاب */}
              <button
                onClick={() => {
                  const lk = adminModalLocker;
                  setAdminModalLocker(null);
                  openManualAssign(lk);
                }}
                style={{
                  background: "#0f172a",
                  border: "1px solid #38bdf8",
                  borderRadius: "14px",
                  padding: "12px 16px",
                  color: "#38bdf8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "right"
                }}
              >
                <div style={{
                  background: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Plus size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    تسكين طلاب يدوياً في هذا الدولاب ✍️
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                    تسجيل واعتماد أسماء الطلاب مباشرة من هنا
                  </div>
                </div>
              </button>

              {/* 4. تفريغ وإخلاء الدولاب (إذا كان مسكناً) */}
              {adminModalLocker.status !== "empty" && (
                <button
                  onClick={() => {
                    const code = adminModalLocker.locker_code;
                    setAdminModalLocker(null);
                    handleVacateLocker(code);
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid #ef4444",
                    borderRadius: "14px",
                    padding: "12px 16px",
                    color: "#fca5a5",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "right"
                  }}
                >
                  <div style={{
                    background: "#dc2626",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                      إخلاء وتفريغ الدولاب فوراً 🗑️
                    </div>
                    <div style={{ fontSize: "12px", color: "#fca5a5", opacity: 0.85, marginTop: "2px" }}>
                      حذف التسكين الحالي وإعادة الدولاب شاغراً
                    </div>
                  </div>
                </button>
              )}

            </div>

            <button
              onClick={() => setAdminModalLocker(null)}
              style={{
                width: "100%",
                background: "#334155",
                color: "#cbd5e1",
                border: "none",
                padding: "10px",
                borderRadius: "10px",
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* نافذة التسكين اليدوي المباشر */}
      {manualAssignLocker && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10003,
          padding: "16px"
        }}>
          <div style={{
            background: "#18202f",
            border: "1.5px solid #0284c7",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "480px",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#38bdf8" }}>
                تسكين طلاب في دولاب ({manualAssignLocker.locker_code})
              </div>
              <button
                onClick={() => setManualAssignLocker(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleManualAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>الفرقة الدراسية:</label>
                <select
                  value={manualAssignCohort}
                  onChange={(e) => setManualAssignCohort(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#fff",
                    outline: "none"
                  }}
                >
                  <option value="الفرقة الرابعة">الفرقة الرابعة</option>
                  <option value="الفرقة الثالثة">الفرقة الثالثة</option>
                  <option value="الفرقة الثانية">الفرقة الثانية</option>
                  <option value="الفرقة الأولى">الفرقة الأولى</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>رقم هاتف ممثل الدولاب:</label>
                <input
                  type="text"
                  placeholder="01xxxxxxxxx"
                  value={manualAssignPhone}
                  onChange={(e) => setManualAssignPhone(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#fff",
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>أسماء الطلاب المسكنين (سعة {manualAssignLocker.capacity || 4} طلاب):</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {manualAssignNames.map((name, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`اسم الطالب (${idx + 1})`}
                      value={name}
                      onChange={(e) => {
                        const updated = [...manualAssignNames];
                        updated[idx] = e.target.value;
                        setManualAssignNames(updated);
                      }}
                      style={{
                        width: "100%",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        outline: "none",
                        fontSize: "13px"
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  تأكيد التسكين فوراً ✅
                </button>
                <button
                  type="button"
                  onClick={() => setManualAssignLocker(null)}
                  style={{
                    background: "#334155",
                    color: "#cbd5e1",
                    border: "none",
                    padding: "12px 18px",
                    borderRadius: "10px",
                    cursor: "pointer"
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
