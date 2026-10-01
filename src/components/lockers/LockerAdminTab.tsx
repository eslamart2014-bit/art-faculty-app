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
  Edit3,
  ExternalLink,
  ShieldAlert
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

  // نافذة تخصيص وإدارة الدولاب (الضغط المطول)
  const [adminModalLocker, setAdminModalLocker] = useState<any | null>(null);

  // نافذة التسكين اليدوي المباشر
  const [manualAssignLocker, setManualAssignLocker] = useState<any | null>(null);
  const [manualAssignCohort, setManualAssignCohort] = useState<string>("الفرقة الرابعة");
  const [manualAssignPhone, setManualAssignPhone] = useState<string>("");
  const [manualAssignNames, setManualAssignNames] = useState<string[]>(["", "", "", ""]);
  const [manualAssignCodes, setManualAssignCodes] = useState<string[]>(["", "", "", ""]);
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [studentSuggestions, setStudentSuggestions] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState<boolean>(false);

  // نافذة تعديل بيانات الحجز كأدمن
  const [editingBooking, setEditingBooking] = useState<any | null>(null);
  const [editLockerCode, setEditLockerCode] = useState<string>("");
  const [editCohort, setEditCohort] = useState<string>("الفرقة الرابعة");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editNames, setEditNames] = useState<string[]>(["", "", "", ""]);
  const [editCodes, setEditCodes] = useState<string[]>(["", "", "", ""]);
  const [editStatus, setEditStatus] = useState<"pending" | "confirmed">("confirmed");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editActiveSearchIdx, setEditActiveSearchIdx] = useState<number | null>(null);
  const [editStudentSuggestions, setEditStudentSuggestions] = useState<any[]>([]);
  const [isSearchingEditStudents, setIsSearchingEditStudents] = useState<boolean>(false);

  // إعداد وضبط أعداد ونطاقات الدواليب
  const [inventoryRanges, setInventoryRanges] = useState<{ [key: string]: number }>({ A: 40, B: 40, C: 40, D: 40 });
  const [savingRanges, setSavingRanges] = useState<boolean>(false);

  // مطابقة وربط الأكواد مع قاعدة بيانات الطلاب سحابياً
  const [reconcilingStudents, setReconcilingStudents] = useState<boolean>(false);

  // فحص وتصفية الطلاب المكررين
  const [duplicateStudents, setDuplicateStudents] = useState<any[] | null>(null);
  const [isScanningDuplicates, setIsScanningDuplicates] = useState<boolean>(false);
  const [isResolvingDuplicates, setIsResolvingDuplicates] = useState<boolean>(false);

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

  // فحص الطلاب المكررين في الدواليب
  const handleScanDuplicates = async () => {
    setIsScanningDuplicates(true);
    try {
      const res = await fetch('/api/admin/lockers?action=duplicates');
      const json = await res.json();
      if (json.success) {
        setDuplicateStudents(json.duplicates || []);
        if ((json.duplicates || []).length === 0) {
          showToast("✅ ممتاز! لا يوجد أي طالب مكرر في الدواليب");
        } else {
          showToast(`⚠️ تم العثور على ${json.duplicates.length} طالب مكرر`);
        }
      } else {
        showToast(json.message || "فشل فحص الطلاب المكررين");
      }
    } catch (e) {
      showToast("خطأ في الاتصال أثناء فحص التكرارات");
    } finally {
      setIsScanningDuplicates(false);
    }
  };

  // تصفية وحل تكرارات الطلاب تلقائياً
  const handleResolveDuplicates = async () => {
    if (!confirm("هل أنت متأكد من تصفية وحذف التكرارات تلقائياً؟ سيتم الإبقاء على الحجز المؤكد أو الأسبق وإزالة الحجز المكرر فوراً.")) return;
    setIsResolvingDuplicates(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_duplicates' })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || "تمت تصفية التكرارات بنجاح");
        await handleScanDuplicates();
        await fetchData();
      } else {
        showToast(json.message || "فشلت عملية تصفية التكرارات");
      }
    } catch (e) {
      showToast("خطأ في الاتصال أثناء تصفية التكرارات");
    } finally {
      setIsResolvingDuplicates(false);
    }
  };

  // فتح نافذة التسكين اليدوي لدولاب
  const openManualAssign = (locker: any) => {
    setManualAssignLocker(locker);
    setManualAssignCohort("الفرقة الرابعة");
    setManualAssignPhone("");
    const cap = locker.capacity || 4;
    setManualAssignNames(new Array(cap).fill(""));
    setManualAssignCodes(new Array(cap).fill(""));
    setActiveSearchIdx(null);
    setStudentSuggestions([]);
  };

  // البحث الذكي أثناء كتابة اسم الطالب في التسكين اليدوي
  const handleStudentSearchInput = async (idx: number, query: string) => {
    const updatedNames = [...manualAssignNames];
    updatedNames[idx] = query;
    setManualAssignNames(updatedNames);

    const updatedCodes = [...manualAssignCodes];
    updatedCodes[idx] = "";
    setManualAssignCodes(updatedCodes);

    if (!query || query.trim().length < 2) {
      setStudentSuggestions([]);
      setActiveSearchIdx(null);
      return;
    }

    setActiveSearchIdx(idx);
    setIsSearchingStudents(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}&level=${encodeURIComponent(manualAssignCohort)}`);
      const json = await res.json();
      if (json.students && json.students.length > 0) {
        setStudentSuggestions(json.students);
      } else {
        setStudentSuggestions([]);
      }
    } catch {
      setStudentSuggestions([]);
    } finally {
      setIsSearchingStudents(false);
    }
  };

  // اختيار طالب من قائمة البحث الذكي
  const handleSelectStudent = (idx: number, student: any) => {
    const updatedNames = [...manualAssignNames];
    updatedNames[idx] = student.full_name;
    setManualAssignNames(updatedNames);

    const updatedCodes = [...manualAssignCodes];
    updatedCodes[idx] = student.student_code;
    setManualAssignCodes(updatedCodes);

    setActiveSearchIdx(null);
    setStudentSuggestions([]);
  };

  // حفظ التسكين اليدوي مع ربط الأكواد وحفظها سحابياً
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
          studentNames: names,
          studentCodes: manualAssignCodes.slice(0, names.length)
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

  // فتح نافذة تعديل بيانات الحجز
  const openEditBooking = (bk: any) => {
    setEditingBooking(bk);
    setEditLockerCode(bk.locker_code || "");
    setEditCohort(bk.cohort || "الفرقة الرابعة");
    setEditPhone(bk.representative_phone || "");
    
    const names = [...(bk.student_names || [])];
    const codes = [...(bk.student_codes || [])];
    while (names.length < 4) names.push("");
    while (codes.length < 4) codes.push("");
    setEditNames(names.slice(0, 4));
    setEditCodes(codes.slice(0, 4));
    
    setEditStatus(bk.status === "confirmed" ? "confirmed" : "pending");
    setEditNotes(bk.notes || "");
    setEditActiveSearchIdx(null);
    setEditStudentSuggestions([]);
  };

  // البحث الذكي أثناء تعديل أسماء الطلاب في الحجز
  const handleEditStudentSearchInput = async (idx: number, query: string) => {
    const updatedNames = [...editNames];
    updatedNames[idx] = query;
    setEditNames(updatedNames);

    const updatedCodes = [...editCodes];
    updatedCodes[idx] = "";
    setEditCodes(updatedCodes);

    if (!query || query.trim().length < 2) {
      setEditStudentSuggestions([]);
      setEditActiveSearchIdx(null);
      return;
    }

    setEditActiveSearchIdx(idx);
    setIsSearchingEditStudents(true);
    try {
      const res = await fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}&level=${encodeURIComponent(editCohort)}`);
      const json = await res.json();
      if (json.students && json.students.length > 0) {
        setEditStudentSuggestions(json.students);
      } else {
        setEditStudentSuggestions([]);
      }
    } catch {
      setEditStudentSuggestions([]);
    } finally {
      setIsSearchingEditStudents(false);
    }
  };

  const handleSelectEditStudent = (idx: number, student: any) => {
    const updatedNames = [...editNames];
    updatedNames[idx] = student.full_name;
    setEditNames(updatedNames);

    const updatedCodes = [...editCodes];
    updatedCodes[idx] = student.student_code;
    setEditCodes(updatedCodes);

    setEditActiveSearchIdx(null);
    setEditStudentSuggestions([]);
  };

  // حفظ التعديلات على الحجز
  const handleUpdateBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    const names = editNames.map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      alert("يرجى إدخال اسم طالب واحد على الأقل.");
      return;
    }
    if (!editLockerCode.trim()) {
      alert("يرجى تحديد كود الدولاب.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_booking',
          bookingId: editingBooking.id,
          lockerCode: editLockerCode.trim(),
          cohort: editCohort,
          phone: editPhone.trim(),
          studentNames: names,
          studentCodes: editCodes.slice(0, names.length),
          status: editStatus,
          notes: editNotes.trim()
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message);
        setEditingBooking(null);
        if (selectedLocker) setSelectedLocker(null);
        fetchData();
      } else {
        showToast(json.error || "فشل حفظ التعديلات");
      }
    } catch (e) {
      showToast("خطأ بالاتصال");
    } finally {
      setActionLoading(false);
    }
  };

  // دخول كأدمن لحساب الطالب مباشرة
  const handleImpersonateStudent = (studentCode: string) => {
    if (!studentCode) {
      alert("لا يوجد كود مسجل لهذا الطالب");
      return;
    }
    window.open(`/system?impersonate=${encodeURIComponent(studentCode)}`, '_blank');
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

      {/* 2. تبويب طلبات الاعتماد وقائمة الانتظار */}
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
                      {bk.student_names.map((name: string, i: number) => {
                        const code = bk.student_codes?.[i];
                        return (
                          <div key={i} style={{ fontSize: "13px", color: "#f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                            <span>{i + 1}. {name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {code && <span style={{ color: "#64748b", direction: "ltr", fontSize: "11px" }}>#{code}</span>}
                              {code && (
                                <button
                                  type="button"
                                  onClick={() => handleImpersonateStudent(code)}
                                  style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid #0284c7", color: "#38bdf8", padding: "2px 6px", borderRadius: "5px", fontSize: "10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "2px" }}
                                  title={`دخول كطالب (${name})`}
                                >
                                  <span>👑</span>
                                  <span>دخول</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleConfirmBooking(bk.id)}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          background: "#10b981",
                          color: "#fff",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px"
                        }}
                      >
                        <Check size={15} />
                        <span>اعتماد</span>
                      </button>

                      <button
                        onClick={() => openEditBooking(bk)}
                        style={{
                          background: "#0284c7",
                          color: "#fff",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="تعديل الحجز"
                      >
                        <Edit3 size={15} />
                        <span>تعديل</span>
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
                          padding: "8px 10px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        title="طباعة الاستمارة"
                      >
                        <Printer size={15} />
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
                      onClick={() => openEditBooking(b)}
                      style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: "bold" }}
                      title="تعديل الحجز"
                    >
                      <Edit3 size={15} />
                      <span>تعديل</span>
                    </button>
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

          {/* أداة مطابقة وتحديث أكواد الطلاب سحابياً */}
          <div style={{ background: "#18202f", border: "1px solid #8b5cf6", borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "600px" }}>
                <h4 style={{ color: "#a78bfa", margin: "0 0 6px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <RefreshCw size={20} />
                  <span>مطابقة وربط أسماء الدواليب مع قاعدة بيانات الطلاب 🔄</span>
                </h4>
                <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                  يقوم النظام بمطابقة أسماء الطلاب المسكنين في كشوف الدواليب ذكياً مع جدول الطلاب بالكلية وتعبئة أكوادهم الرسمية ليظهر الدولاب في حساب الطالب فوراً.
                </p>
              </div>
              <button
                onClick={handleReconcileStudents}
                disabled={reconcilingStudents}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: reconcilingStudents ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(139, 92, 246, 0.25)"
                }}
              >
                <RefreshCw size={18} className={reconcilingStudents ? "animate-spin" : ""} />
                <span>{reconcilingStudents ? "جاري المطابقة والربط..." : "بدء مطابقة وتحديث الأكواد 🔄"}</span>
              </button>
            </div>
          </div>

          {/* أداة فحص وتصفية الطلاب المكررين في الدواليب */}
          <div style={{ background: "#18202f", border: "1px solid #f59e0b", borderRadius: "16px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "600px" }}>
                <h4 style={{ color: "#fbbf24", margin: "0 0 6px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldAlert size={20} />
                  <span>فحص ومنع تكرار الطلاب في الدواليب 🔍🛡️</span>
                </h4>
                <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                  فحص شامل لجميع كشوف وحجوزات الدواليب لضمان عدم تكرار اسم أو كود أي طالب في أكثر من دولاب، مع إمكانية التصفية التلقائية بضغطة زر.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={handleScanDuplicates}
                  disabled={isScanningDuplicates || isResolvingDuplicates}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: (isScanningDuplicates || isResolvingDuplicates) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 15px rgba(245, 158, 11, 0.25)"
                  }}
                >
                  <Search size={18} className={isScanningDuplicates ? "animate-spin" : ""} />
                  <span>{isScanningDuplicates ? "جاري الفحص..." : "فحص التكرارات الآن 🔎"}</span>
                </button>

                {duplicateStudents && duplicateStudents.length > 0 && (
                  <button
                    onClick={handleResolveDuplicates}
                    disabled={isResolvingDuplicates}
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      padding: "12px 20px",
                      borderRadius: "12px",
                      fontWeight: "bold",
                      fontSize: "14px",
                      cursor: isResolvingDuplicates ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 4px 15px rgba(16, 185, 129, 0.25)"
                    }}
                  >
                    <CheckCircle2 size={18} className={isResolvingDuplicates ? "animate-spin" : ""} />
                    <span>{isResolvingDuplicates ? "جاري التصفية..." : "تصفية وحذف التكرارات تلقائياً 🧹"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* عرض نتائج فحص التكرارات */}
            {duplicateStudents !== null && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #334155" }}>
                {duplicateStudents.length === 0 ? (
                  <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "10px", padding: "12px 16px", color: "#34d399", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={18} />
                    <span>ممتاز! لم يتم العثور على أي تكرار، جميع الطلاب مسكنين في دواليب فريدة 100%.</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ color: "#f87171", fontWeight: "bold", fontSize: "14px" }}>
                        ⚠️ تم رصد {duplicateStudents.length} طلاب مسجلين بأكثر من دولاب:
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                      {duplicateStudents.map((dup, idx) => (
                        <div key={idx} style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: "bold", color: "#fff", fontSize: "14px" }}>{dup.studentName || dup.student_name}</span>
                              {(dup.studentCode || dup.student_code) && (
                                <span style={{ background: "#1e293b", color: "#38bdf8", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", direction: "ltr" }}>
                                  #{dup.studentCode || dup.student_code}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                              مسجل في الدواليب:{" "}
                              {(dup.occurrences || dup.bookings || []).map((b: any, bIdx: number) => (
                                <span key={b.bookingId || b.booking_id || bIdx} style={{ background: b.status === "confirmed" ? "#065f46" : "#78350f", color: "#fff", padding: "2px 6px", borderRadius: "4px", margin: "0 4px", fontSize: "11px" }}>
                                  دولاب {b.lockerCode || b.locker_code} ({b.status === "confirmed" ? "مؤكد" : "معلق"})
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                  {selectedBooking.student_names.map((name: string, i: number) => {
                    const code = selectedBooking.student_codes?.[i];
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", padding: "8px 10px", borderRadius: "8px", fontSize: "13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#f1f5f9" }}>{i + 1}. {name}</span>
                          {code && <span style={{ color: "#64748b", direction: "ltr", fontSize: "11px" }}>#{code}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {code && (
                            <button
                              type="button"
                              onClick={() => handleImpersonateStudent(code)}
                              style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid #0284c7", color: "#38bdf8", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                              title={`دخول كطالب (${name})`}
                            >
                              <span>👑</span>
                              <span>دخول للحساب</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveStudent(selectedBooking.id, name)}
                            style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                            title="إقصاء هذا الطالب فقط"
                          >
                            <UserMinus size={14} />
                            <span>إقصاء</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                    onClick={() => openEditBooking(selectedBooking)}
                    style={{ background: "#0284c7", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", fontSize: "13px" }}
                    title="تعديل بيانات الحجز"
                  >
                    <Edit3 size={16} />
                    <span>تعديل</span>
                  </button>
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
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                  أسماء الطلاب المسكنين (سعة {manualAssignLocker.capacity || 4} طلاب) - بالبحث الذكي:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {manualAssignNames.map((name, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder={`اسم الطالب (${idx + 1}) - اكتب للبحث بالاسم أو الكود...`}
                          value={name}
                          onChange={(e) => handleStudentSearchInput(idx, e.target.value)}
                          onFocus={() => {
                            if (name && name.length >= 2) {
                              handleStudentSearchInput(idx, name);
                            }
                          }}
                          style={{
                            flex: 1,
                            background: "#0f172a",
                            border: manualAssignCodes[idx] ? "1.5px solid #10b981" : "1px solid #334155",
                            borderRadius: "8px",
                            padding: "9px 12px",
                            color: "#fff",
                            outline: "none",
                            fontSize: "13px"
                          }}
                        />
                        {manualAssignCodes[idx] && (
                          <span 
                            style={{
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              borderRadius: "6px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              whiteSpace: "nowrap"
                            }}
                            title="تم ربط كود الطالب بنجاح وسيظهر الدولاب في حسابه فورياً"
                          >
                            ✓ #{manualAssignCodes[idx]}
                          </span>
                        )}
                      </div>

                      {/* القائمة الذكية المنسدلة للبحث */}
                      {activeSearchIdx === idx && (
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 10010,
                          background: "#1e293b",
                          border: "1px solid #38bdf8",
                          borderRadius: "10px",
                          marginTop: "4px",
                          maxHeight: "180px",
                          overflowY: "auto",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.7)"
                        }}>
                          {isSearchingStudents ? (
                            <div style={{ padding: "10px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                              جاري البحث في قاعدة بيانات الطلاب...
                            </div>
                          ) : studentSuggestions.length > 0 ? (
                            studentSuggestions.map((st: any) => (
                              <div
                                key={st.id || st.student_code}
                                onClick={() => handleSelectStudent(idx, st)}
                                style={{
                                  padding: "9px 14px",
                                  cursor: "pointer",
                                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div>
                                  <div style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>{st.full_name}</div>
                                  <div style={{ color: "#94a3b8", fontSize: "11px" }}>{st.academic_year || manualAssignCohort} {st.section ? `• ${st.section}` : ''}</div>
                                </div>
                                <span style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "bold", background: "rgba(56, 189, 248, 0.15)", padding: "2px 7px", borderRadius: "4px" }}>
                                  #{st.student_code}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "10px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                              لا توجد نتائج مطابقة، يمكنك ترك الاسم كما كتبته
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

      {/* نافذة تعديل بيانات الحجز كأدمن */}
      {editingBooking && (
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
          zIndex: 10004,
          padding: "16px"
        }}>
          <div style={{
            background: "#18202f",
            border: "1.5px solid #38bdf8",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "520px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #334155", paddingBottom: "12px" }}>
              <div style={{ fontSize: "18px", fontWeight: "900", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
                <Edit3 size={20} />
                <span>تعديل بيانات الحجز (دولاب {editingBooking.locker_code})</span>
              </div>
              <button
                onClick={() => setEditingBooking(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                title="إغلاق"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateBookingSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>رمز الدولاب:</label>
                  <input
                    type="text"
                    required
                    value={editLockerCode}
                    onChange={(e) => setEditLockerCode(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "#38bdf8",
                      fontWeight: "bold",
                      outline: "none",
                      textAlign: "center",
                      fontSize: "15px"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>حالة الحجز:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      padding: "10px",
                      color: editStatus === "confirmed" ? "#34d399" : "#f59e0b",
                      fontWeight: "bold",
                      outline: "none"
                    }}
                  >
                    <option value="confirmed">معتمد ومؤكد ✅</option>
                    <option value="pending">معلق بانتظار الاعتماد ⏳</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>الفرقة الدراسية:</label>
                  <select
                    value={editCohort}
                    onChange={(e) => setEditCohort(e.target.value)}
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
                  <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>هاتف ممثل الدولاب:</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    style={{
                      width: "100%",
                      background: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "#fff",
                      outline: "none",
                      textAlign: "right"
                    }}
                  />
                </div>
              </div>

              {/* أسماء وأكواد الطلاب */}
              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "6px" }}>
                  الطلاب المسكنون (حتى 4 طلاب) - اكتب للاقتراح الذكي:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {editNames.map((name, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#64748b", width: "16px" }}>{idx + 1}.</span>
                        <input
                          type="text"
                          placeholder={`اسم الطالب (${idx + 1})`}
                          value={name}
                          onChange={(e) => handleEditStudentSearchInput(idx, e.target.value)}
                          style={{
                            flex: 2,
                            background: "#0f172a",
                            border: editCodes[idx] ? "1.5px solid #10b981" : "1px solid #334155",
                            borderRadius: "8px",
                            padding: "8px 10px",
                            color: "#fff",
                            outline: "none",
                            fontSize: "13px"
                          }}
                        />
                        <input
                          type="text"
                          placeholder="الكود"
                          value={editCodes[idx] || ""}
                          onChange={(e) => {
                            const newCodes = [...editCodes];
                            newCodes[idx] = e.target.value.trim();
                            setEditCodes(newCodes);
                          }}
                          style={{
                            width: "85px",
                            background: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            padding: "8px 6px",
                            color: "#38bdf8",
                            fontSize: "12px",
                            textAlign: "center",
                            outline: "none",
                            fontFamily: "monospace"
                          }}
                        />
                        {editCodes[idx] && (
                          <button
                            type="button"
                            onClick={() => handleImpersonateStudent(editCodes[idx])}
                            style={{
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid #0284c7",
                              color: "#38bdf8",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px"
                            }}
                            title={`دخول كطالب (${name})`}
                          >
                            <span>👑</span>
                          </button>
                        )}
                      </div>

                      {/* قائمة الاقتراحات الذكية */}
                      {editActiveSearchIdx === idx && (
                        <div style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 10020,
                          background: "#1e293b",
                          border: "1px solid #38bdf8",
                          borderRadius: "10px",
                          marginTop: "4px",
                          maxHeight: "180px",
                          overflowY: "auto",
                          boxShadow: "0 10px 25px rgba(0,0,0,0.7)"
                        }}>
                          {isSearchingEditStudents ? (
                            <div style={{ padding: "10px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                              جاري البحث...
                            </div>
                          ) : editStudentSuggestions.length > 0 ? (
                            editStudentSuggestions.map((st: any) => (
                              <div
                                key={st.id || st.student_code}
                                onClick={() => handleSelectEditStudent(idx, st)}
                                style={{
                                  padding: "9px 12px",
                                  cursor: "pointer",
                                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#334155")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div>
                                  <div style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>{st.full_name}</div>
                                  <div style={{ color: "#94a3b8", fontSize: "11px" }}>{st.academic_year || editCohort}</div>
                                </div>
                                <span style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "bold" }}>
                                  #{st.student_code}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "8px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>
                              لا توجد نتائج مطابقة
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>ملاحظات الإدارة:</label>
                <input
                  type="text"
                  placeholder="ملاحظات اختيارية..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#fff",
                    outline: "none",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Check size={18} />
                  <span>حفظ التعديلات سحابياً 💾</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
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
