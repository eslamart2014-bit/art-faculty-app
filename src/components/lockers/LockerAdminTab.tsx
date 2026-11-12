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
  ShieldAlert,
  Target,
  PieChart,
  Globe,
  Lightbulb,
  Save,
  Settings,
  UserCog
} from "lucide-react";
import { printLockerReceipt } from "@/lib/lockers/lockerReceipt";

export default function LockerAdminTab() {
  const [activeSubTab, setActiveSubTab] = useState<"grid" | "pending" | "allocation" | "search" | "tools">("grid");
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

  // إعدادات وتخصيص كوتا الفرق
  const [allocationsData, setAllocationsData] = useState<any | null>(null);
  const [cohortQuotasInput, setCohortQuotasInput] = useState<{ [key: string]: number }>({ '1': 0, '2': 0, '3': 0, '4': 0 });
  const [savingQuotas, setSavingQuotas] = useState<boolean>(false);

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
        if (json.allocations) {
          setAllocationsData(json.allocations);
          const initialQuotas: { [key: string]: number } = {};
          (json.allocations.allocations || []).forEach((a: any) => {
            initialQuotas[a.cohortKey] = a.quota || 0;
          });
          setCohortQuotasInput(initialQuotas);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("خطأ في جلب بيانات الدواليب");
    } finally {
      setLoading(false);
    }
  };

  // حفظ وتحديث كوتا تخصيص الدواليب للفرق
  const handleSaveQuotas = async () => {
    setSavingQuotas(true);
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_quotas', quotas: cohortQuotasInput })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || "تم حفظ وتحديث تخصيص الكوتا بنجاح");
        if (json.allocations) {
          setAllocationsData(json.allocations);
        }
        fetchData();
      } else {
        showToast(json.error || "تعذر حفظ التخصيص");
      }
    } catch (e) {
      showToast("خطأ أثناء حفظ التخصيص");
    } finally {
      setSavingQuotas(false);
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
          showToast("ممتاز! لا يوجد أي طالب مكرر في الدواليب");
        } else {
          showToast(`تم العثور على ${json.duplicates.length} طالب مكرر`);
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
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface-hover)",
          border: "1px solid var(--accent-ink)",
          color: "var(--text-primary)",
          padding: "10px 18px",
          borderRadius: "8px",
          zIndex: 10000,
          fontSize: "14px",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <CheckCircle2 size={18} strokeWidth={1.5} color="var(--accent-ink)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* شريط الإحصائيات الرئيسي */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: "12px"
      }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>إجمالي الدواليب</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "var(--text-primary)", marginTop: "4px" }}>{stats?.total || 0}</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(16, 185, 129, 0.4)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--success)" }}>مسكن ومؤكد</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "var(--success)", marginTop: "4px" }}>{stats?.confirmed || 0}</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(56, 189, 248, 0.4)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--accent-ink)" }}>بانتظار الاعتماد</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "var(--accent-ink)", marginTop: "4px" }}>{stats?.pending || 0}</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(245, 158, 11, 0.4)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--warning)" }}>مخصص للإدارة</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "var(--warning)", marginTop: "4px" }}>{stats?.adminReserved || 0}</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(20, 184, 166, 0.4)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "#5eead4" }}>دواليب شاغرة</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "#14b8a6", marginTop: "4px" }}>{stats?.empty || 0}</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid rgba(37, 99, 235, 0.45)", padding: "14px", borderRadius: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>قائمة الانتظار</div>
          <div className="tabular-nums" style={{ fontSize: "24px", fontWeight: "600", color: "var(--accent-ink)", marginTop: "4px" }}>{stats?.waitlistCount || 0}</div>
        </div>
      </div>

      {/* أزرار التبويبات الفرعية */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "12px", flexWrap: "wrap" }}>
        {[
          { id: "grid", label: "شبكة الدواليب التفاعلية", Icon: Archive },
          { id: "pending", label: `طلبات الاعتماد والانتظار (${pendingList.length})`, Icon: Clock },
          { id: "allocation", label: "تخصيص الكوتا للفرق", Icon: Target },
          { id: "search", label: "البحث الشامل", Icon: Search },
          { id: "tools", label: "أدوات الإدارة والفرقة", Icon: Settings },
        ].map((tab) => {
          const Icon = tab.Icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                padding: "9px 14px",
                borderRadius: "8px",
                border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                background: isActive ? "rgba(37, 99, 235, 0.14)" : "var(--surface)",
                color: isActive ? "var(--accent-ink)" : "var(--text-muted)",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          onClick={fetchData}
          style={{
            marginRight: "auto",
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            padding: "8px 14px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500"
          }}
        >
          <RefreshCw size={15} strokeWidth={1.5} />
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
                    border: letterFilter === l ? "1px solid var(--accent-ink)" : "1px solid var(--border)",
                    background: letterFilter === l ? "rgba(56, 189, 248, 0.14)" : "var(--surface)",
                    color: letterFilter === l ? "var(--accent-ink)" : "var(--text-muted)",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  {l === "ALL" ? "كافة الأقسام" : `قسم ${l}`}
                </button>
              ))}
            </div>

            <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: "var(--warning)" }}></span>
              <span>ميزة خاصة: <strong style={{ fontWeight: 600 }}>الضغط المطول</strong> (أو كليك يمين) يفتح نافذة تخصيص الدولاب للإدارة وتعديل سعته فوراً</span>
            </div>
          </div>

          {/* شبكة الكروت */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>جاري تحميل شبكة الدواليب...</div>
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

                let border = "var(--border)";
                let bg = "var(--surface)";
                let color = "var(--text-primary)";
                let statusLabel = `شاغر (${locker.capacity})`;

                if (isAdminReserved) {
                  border = "var(--warning)";
                  bg = "rgba(245, 158, 11, 0.14)";
                  color = "var(--warning)";
                  statusLabel = "مخصص للإدارة";
                } else if (isDisabled) {
                  border = "#475569";
                  bg = "var(--bg-deep)";
                  color = "var(--text-muted)";
                  statusLabel = "محجوب";
                } else if (isConfirmed) {
                  border = "var(--success)";
                  bg = "rgba(16, 185, 129, 0.12)";
                  color = "var(--success)";
                  statusLabel = "معتمد";
                } else if (isPending) {
                  border = "var(--accent-ink)";
                  bg = "rgba(56, 189, 248, 0.12)";
                  color = "var(--accent-ink)";
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
                      border: `1px solid ${border}`,
                      borderRadius: "12px",
                      padding: "10px 8px",
                      textAlign: "center",
                      cursor: "pointer",
                      userSelect: "none",
                      position: "relative",
                      transition: "border-color 0.2s ease"
                    }}
                    onMouseLeave={cancelLongPress}
                  >
                    {isAdminReserved ? (
                      <div style={{ position: "absolute", top: "5px", left: "5px" }} title="مخصص للإدارة">
                        <Lock size={13} strokeWidth={1.5} color="var(--warning)" />
                      </div>
                    ) : isDisabled ? (
                      <div style={{ position: "absolute", top: "5px", left: "5px" }} title="محجوب">
                        <Lock size={12} strokeWidth={1.5} color="var(--text-muted)" />
                      </div>
                    ) : null}
                    <div className="tabular-nums" style={{ fontSize: "15px", fontWeight: "600", color }}>
                      {locker.locker_code}
                    </div>
                    <div style={{
                      fontSize: "11px",
                      marginTop: "4px",
                      color: isDisabled ? "var(--text-muted)" : color,
                      opacity: 0.9,
                      fontWeight: isAdminReserved ? "600" : "400"
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
            <h4 style={{ color: "var(--warning)", margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} strokeWidth={1.5} />
              <span>طلبات الحجز بانتظار الاعتماد النهائي والاستلام (<span className="tabular-nums">{pendingList.length}</span>):</span>
            </h4>

            {pendingList.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "12px", padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                لا توجد طلبات معلقة حالياً، جميع الحجوزات معتمدة!
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                {pendingList.map((bk) => (
                  <div key={bk.id} style={{ background: "var(--surface)", border: "1px solid var(--warning)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: "600", color: "var(--warning)" }}>
                        دولاب: {bk.locker_code}
                      </span>
                      <span style={{ fontSize: "12px", background: "rgba(245, 158, 11, 0.16)", color: "var(--warning)", padding: "3px 8px", borderRadius: "6px", fontWeight: "600" }}>
                        {bk.cohort}
                      </span>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Phone size={14} strokeWidth={1.5} color="var(--text-muted)" />
                      <span dir="ltr" className="tabular-nums">{bk.representative_phone}</span>
                    </div>

                    <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "10px", marginBottom: "14px" }}>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>الطلاب المسجلون:</div>
                      {bk.student_names.map((name: string, i: number) => {
                        const code = bk.student_codes?.[i];
                        return (
                          <div key={i} style={{ fontSize: "13px", color: "var(--text-primary)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                            <span><span className="tabular-nums">{i + 1}.</span> {name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {code && <span className="tabular-nums" style={{ color: "var(--text-muted)", direction: "ltr", fontSize: "11px" }}>#{code}</span>}
                              {code && (
                                <button
                                  type="button"
                                  onClick={() => handleImpersonateStudent(code)}
                                  style={{ background: "rgba(56, 189, 248, 0.12)", border: "1px solid var(--primary)", color: "var(--accent-ink)", padding: "2px 6px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                                  title={`دخول كطالب (${name})`}
                                >
                                  <UserCog size={12} strokeWidth={1.5} />
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
                          background: "var(--success)",
                          color: "#fff",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px"
                        }}
                      >
                        <Check size={15} strokeWidth={1.5} />
                        <span>اعتماد</span>
                      </button>

                      <button
                        onClick={() => openEditBooking(bk)}
                        style={{
                          background: "var(--surface-hover)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          fontSize: "12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="تعديل الحجز"
                      >
                        <Edit3 size={15} strokeWidth={1.5} />
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
                          background: "var(--primary)",
                          color: "#fff",
                          border: "none",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        title="طباعة الاستمارة"
                      >
                        <Printer size={15} strokeWidth={1.5} />
                      </button>

                      <button
                        onClick={() => handleRejectBooking(bk.id)}
                        disabled={actionLoading}
                        style={{
                          background: "var(--error)",
                          color: "#fff",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          cursor: "pointer"
                        }}
                        title="إلغاء ورفض"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* قسم قائمة الانتظار */}
          <div>
            <h4 style={{ color: "var(--accent-ink)", margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Layers size={18} strokeWidth={1.5} />
              <span>قائمة الانتظار التلقائية (<span className="tabular-nums">{waitlist.length}</span>):</span>
            </h4>

            {waitlist.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "12px", padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                قائمة الانتظار فارغة حالياً
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px" }}>
                {waitlist.map((w, idx) => (
                  <div key={w.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span className="tabular-nums" style={{ fontWeight: "600", color: "var(--accent-ink)" }}>أسبقية #{idx + 1}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{w.cohort}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      الهاتف: <span dir="ltr" className="tabular-nums">{w.representative_phone}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {w.student_names.join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 2.5. تبويب تخصيص كوتا الدواليب للفرق الدراسية (تخصيص الكوتا والأولوية) */}
      {activeSubTab === "allocation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* رأس التبويب والبطاقة التعريفية */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "720px" }}>
                <h3 style={{ color: "var(--accent-ink)", margin: "0 0 8px 0", fontSize: "17px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Target size={20} strokeWidth={1.5} />
                  <span>تخصيص وحجز حصص الدواليب للفرق الدراسية (الكوتا والأولوية الحصرية)</span>
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7", margin: 0 }}>
                  حدد عدد الدواليب المستهدفة لكل فرقة (مثلاً: الفرقة الرابعة 50 دولاب). يقوم النظام بحساب المسجلين الحاليين تلقائياً (مثلاً 40 دولاب)، ويحجز الفارق (10 دواليب) حصرياً كأولوية لطلاب هذه الفرقة عند تقديمهم من حساباتهم. وعند اكتمال الحصة يتوقف الحجز التلقائي للفرقة مع وضعهم في قائمة الانتظار بأولوية، بينما تستمر الفرق الأخرى في الحجز بشكل طبيعي.
                </p>
              </div>

              <button
                onClick={handleSaveQuotas}
                disabled={savingQuotas}
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: savingQuotas ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0
                }}
              >
                <Save size={16} strokeWidth={1.5} />
                <span>{savingQuotas ? "جاري حفظ التخصيص..." : "حفظ التخصيص سحابياً"}</span>
              </button>
            </div>

            {/* شريط المؤشرات والإحصائيات السريعة للتخصيص */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "20px" }}>
              <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>إجمالي الدواليب الشاغرة</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: "600", color: "var(--accent-ink)", marginTop: "4px" }}>
                  {allocationsData?.totalEmpty || stats?.empty || 0}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>دواليب متاحة بالكلية</div>
              </div>

              <div style={{ background: "var(--bg-deep)", border: "1px solid rgba(37, 99, 235, 0.45)", borderRadius: "12px", padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>حصص محجوزة حصرياً للفرق</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: "600", color: "var(--accent-ink)", marginTop: "4px" }}>
                  {allocationsData?.totalReservedExclusive || 0}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>محجوزة بأولوية للفرق ذات الكوتا</div>
              </div>

              <div style={{ background: "var(--bg-deep)", border: "1px solid rgba(16, 185, 129, 0.45)", borderRadius: "12px", padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "var(--success)" }}>شواغر حرة للعامة</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: "600", color: "var(--success)", marginTop: "4px" }}>
                  {allocationsData?.availableGeneralEmpty || 0}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>متاحة لكافة الطلاب والفرق</div>
              </div>

              <div style={{ background: "var(--bg-deep)", border: "1px solid rgba(245, 158, 11, 0.45)", borderRadius: "12px", padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", color: "var(--warning)" }}>إجمالي الكوتا المخصصة</div>
                <div className="tabular-nums" style={{ fontSize: "22px", fontWeight: "600", color: "var(--warning)", marginTop: "4px" }}>
                  {allocationsData?.totalQuotas || 0}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>مجموع حصص الفرق المستهدفة</div>
              </div>
            </div>
          </div>

          {/* شبكة بطاقات الفرق الدراسية الأربعة */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {(allocationsData?.allocations || [
              { cohortKey: '1', cohortName: 'الفرقة الأولى', quota: 0, bookedLockers: 0, remainingQuota: 0, isQuotaFull: false },
              { cohortKey: '2', cohortName: 'الفرقة الثانية', quota: 0, bookedLockers: 0, remainingQuota: 0, isQuotaFull: false },
              { cohortKey: '3', cohortName: 'الفرقة الثالثة', quota: 0, bookedLockers: 0, remainingQuota: 0, isQuotaFull: false },
              { cohortKey: '4', cohortName: 'الفرقة الرابعة', quota: 0, bookedLockers: 0, remainingQuota: 0, isQuotaFull: false },
            ]).map((alloc: any) => {
              const currentInputQuota = cohortQuotasInput[alloc.cohortKey] !== undefined ? cohortQuotasInput[alloc.cohortKey] : (alloc.quota || 0);
              const booked = alloc.bookedLockers || 0;
              const remaining = currentInputQuota > 0 ? Math.max(0, currentInputQuota - booked) : 0;
              const isFull = currentInputQuota > 0 && booked >= currentInputQuota;
              const percent = currentInputQuota > 0 ? Math.min(100, Math.round((booked / currentInputQuota) * 100)) : 0;

              return (
                <div
                  key={alloc.cohortKey}
                  style={{
                    background: "var(--surface)",
                    border: isFull ? "1px solid var(--error)" : (currentInputQuota > 0 ? "1px solid var(--primary)" : "1px solid var(--border)"),
                    borderRadius: "12px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px"
                  }}
                >
                  {/* رأس بطاقة الفرقة */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)" }}>
                        {alloc.cohortName}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                        دواليب محجوزة: <strong style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{booked} دولاب</strong> ({booked * 4} طالباً)
                      </div>
                    </div>

                    <div>
                      {alloc.cohortKey === '1' && booked === 0 ? (
                        <span style={{ background: "rgba(148, 163, 184, 0.14)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                          لا توجد حجوزات (0 طلاب)
                        </span>
                      ) : currentInputQuota === 0 ? (
                        <span style={{ background: "rgba(148, 163, 184, 0.14)", color: "var(--text-secondary)", border: "1px solid var(--border)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                          مفتوح بدون كوتا
                        </span>
                      ) : isFull ? (
                        <span style={{ background: "rgba(239, 68, 68, 0.16)", color: "var(--error)", border: "1px solid rgba(239, 68, 68, 0.45)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                          اكتملت الكوتا (انتظار)
                        </span>
                      ) : (
                        <span style={{ background: "rgba(16, 185, 129, 0.16)", color: "var(--success)", border: "1px solid rgba(16, 185, 129, 0.45)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                          حصة نشطة ومحجوزة
                        </span>
                      )}
                    </div>
                  </div>

                  {/* حقل إدخال الكوتا المستهدفة */}
                  <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px" }}>
                    <label style={{ display: "block", color: "var(--accent-ink)", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                      الكوتا المستهدفة للفرقة (عدد الدواليب):
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        placeholder="0 = مفتوح بدون حد"
                        value={currentInputQuota}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setCohortQuotasInput({ ...cohortQuotasInput, [alloc.cohortKey]: val });
                        }}
                        className="tabular-nums"
                        style={{
                          flex: 1,
                          background: "var(--surface-hover)",
                          border: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          fontSize: "15px",
                          fontWeight: "600",
                          textAlign: "center",
                          outline: "none"
                        }}
                      />
                      <span className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-muted)" }}>دولاب ({currentInputQuota * 4} طالب)</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                      ضع (0) لفتح الحجز التلقائي للفرقة بدون سقف محدد. كل دولاب = 4 طلاب.
                    </div>
                  </div>

                  {/* إحصائيات الحصة المحجوزة ونسبة الإشغال */}
                  {currentInputQuota > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--text-muted)" }}>الدواليب المحجوزة حالياً:</span>
                        <span className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: "600" }}>{booked} دولاب ({booked * 4} طالب) من {currentInputQuota}</span>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--success)", fontWeight: "600" }}>الحصة المتبقية المحجوزة للفرقة:</span>
                        <span className="tabular-nums" style={{ color: "var(--success)", fontWeight: "600", fontSize: "14px" }}>
                          {remaining} دولاب
                        </span>
                      </div>

                      {/* شريط التقدم */}
                      <div style={{ width: "100%", height: "8px", background: "var(--bg-deep)", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: "100%",
                            background: isFull ? "var(--error)" : "var(--primary)",
                            borderRadius: "4px",
                            transition: "width 0.3s ease"
                          }}
                        />
                      </div>
                      <div className="tabular-nums" style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "left", direction: "ltr" }}>
                        {percent}% إشغال
                      </div>
                    </div>
                  )}

                  {/* رسالة توضيحية لحالة الطالب في هذه الفرقة */}
                  <div style={{ background: "var(--bg-deep)", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", lineHeight: "1.5", color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
                    {currentInputQuota === 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "flex-start", gap: "6px" }}>
                        <Globe size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px", color: "var(--accent-ink)" }} />
                        <span>أي طالب من هذه الفرقة يحجز مباشرة من الدواليب العامة الشاغرة ما دامت متوفرة.</span>
                      </span>
                    ) : remaining > 0 ? (
                      <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "flex-start", gap: "6px" }}>
                        <CheckCircle2 size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>متبقي ({remaining}) دواليب محجوزة كأولوية لـ {alloc.cohortName}. أي طالب يتقدم من حسابه سيحصل فوراً على دولاب من هذه الحصة!</span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--error)", display: "inline-flex", alignItems: "flex-start", gap: "6px" }}>
                        <Lock size={14} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                        <span>تم الوصول للحد الأقصى ({currentInputQuota} دولاب). أي طلب جديد لـ {alloc.cohortName} سيتم حفظه في قائمة الانتظار بأولوية فورية، مع استمرار باقي الفرق في الحجز بشكل طبيعي.</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* بطاقة سيناريو عملي توضيحي */}
          <div style={{ background: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "12px", padding: "18px" }}>
            <h4 style={{ color: "var(--accent-ink)", margin: "0 0 10px 0", fontSize: "15px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Lightbulb size={17} strokeWidth={1.5} />
              <span>مثال توضيحي على آلية عمل التخصيص والأولوية التلقائية:</span>
            </h4>
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.8" }}>
              • إذا خصصت للفرقة الرابعة <strong style={{ fontWeight: 600 }}>50 دولاب</strong>، وكان عدد المتسجلين من الرابعة حالياً <strong style={{ fontWeight: 600 }}>40 دولاب</strong>:<br />
              • يقوم النظام فوراً بحجز <strong style={{ fontWeight: 600 }}>10 دواليب حصرياً</strong> لصالح الفرقة الرابعة.<br />
              • عندما يفتح أي طالب من الرابعة حسابه الشخصي ويقدم على دولاب، يأخذ فوراً من الـ 10 المحجوزين لفرقته.<br />
              • لا يمكن لأي طالب من فرقة أخرى الاستيلاء على هذه الـ 10 دواليب إذا كانت هي الشواغر المتبقية.<br />
              • وبمجرد اكتمال الـ 50 دولاب للرابعة، يتم إيقاف الحجز التلقائي لهم وتحويلهم لقائمة الانتظار بأولوية، بينما تظل باقي الفرق تحجز وتعمل بشكل طبيعي تماماً!
            </div>
          </div>

        </div>
      )}

      {/* 3. تبويب البحث الشامل */}
      {activeSubTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "4px 12px" }}>
            <Search size={18} strokeWidth={1.5} color="var(--text-muted)" />
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
                color: "var(--text-primary)",
                fontSize: "14px",
                outline: "none"
              }}
            />
          </div>

          {searchResults && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="tabular-nums" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                نتائج الحجوزات المطابقة: {searchResults.bookings?.length || 0}
              </div>

              {searchResults.bookings?.map((b: any) => (
                <div key={b.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div className="tabular-nums" style={{ fontSize: "17px", fontWeight: "600", color: "var(--accent-ink)" }}>دولاب {b.locker_code} ({b.status === "confirmed" ? "معتمد" : "معلق"})</div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      {b.student_names.join(" - ")}
                    </div>
                    <div className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      الفرقة: {b.cohort} | هاتف: {b.representative_phone}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => openEditBooking(b)}
                      style={{ background: "var(--surface-hover)", color: "var(--text-primary)", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: "600" }}
                      title="تعديل الحجز"
                    >
                      <Edit3 size={15} strokeWidth={1.5} />
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
                      style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" }}
                    >
                      <Printer size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleVacateLocker(b.locker_code)}
                      style={{ background: "var(--error)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
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
          
          {/* بطاقة الوصول السريع لتخصيص كوتا الفرق */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h4 style={{ color: "var(--accent-ink)", margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Target size={19} strokeWidth={1.5} />
                <span>تخصيص كوتا الدواليب للفرق الدراسية والأولوية الحصرية</span>
              </h4>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, lineHeight: "1.6" }}>
                خصص أعداد دواليب محددة لكل فرقة (مثلاً: رابعة 50 دولاب) ليقوم النظام بحجز الشواغر أوتوماتيكياً كأولوية لطلاب الفرقة وإيقاف الحجز عند اكتمال الحصة.
              </p>
            </div>
            <button
              onClick={() => setActiveSubTab("allocation")}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Target size={16} strokeWidth={1.5} />
              <span>فتح شاشة التخصيص والكوتا</span>
            </button>
          </div>

          {/* أداة ضبط أعداد ونطاقات دواليب الأقسام */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <h4 style={{ color: "var(--accent-ink)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={18} strokeWidth={1.5} />
              <span>إعداد وضبط أعداد ونطاقات دواليب الأقسام (A, B, C, D)</span>
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              حدد العدد الفعلي للدواليب المتوفرة في كليتك لكل قسم. سيتم تحديث شبكة الدواليب فوراً دون التأثير على أي حجوزات أو تخصيصات قائمة.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {["A", "B", "C", "D"].map((letter) => (
                <div key={letter} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--accent-ink)", marginBottom: "6px" }}>
                    قسم ({letter})
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>من 1 إلى</span>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={inventoryRanges[letter] || 40}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 1;
                        setInventoryRanges({ ...inventoryRanges, [letter]: val });
                      }}
                      className="tabular-nums"
                      style={{
                        width: "65px",
                        background: "var(--surface-hover)",
                        border: "1px solid var(--border)",
                        color: "var(--text-primary)",
                        padding: "6px 8px",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontWeight: "600",
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
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Save size={16} strokeWidth={1.5} />
              <span>{savingRanges ? "جاري الحفظ..." : "حفظ وتحديث شبكة الدواليب"}</span>
            </button>
          </div>

          {/* أداة مطابقة وتحديث أكواد الطلاب سحابياً */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "600px" }}>
                <h4 style={{ color: "var(--accent-ink)", margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                  <RefreshCw size={18} strokeWidth={1.5} />
                  <span>مطابقة وربط أسماء الدواليب مع قاعدة بيانات الطلاب</span>
                </h4>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                  يقوم النظام بمطابقة أسماء الطلاب المسكنين في كشوف الدواليب ذكياً مع جدول الطلاب بالكلية وتعبئة أكوادهم الرسمية ليظهر الدولاب في حساب الطالب فوراً.
                </p>
              </div>
              <button
                onClick={handleReconcileStudents}
                disabled={reconcilingStudents}
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: reconcilingStudents ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <RefreshCw size={17} strokeWidth={1.5} className={reconcilingStudents ? "animate-spin" : ""} />
                <span>{reconcilingStudents ? "جاري المطابقة والربط..." : "بدء مطابقة وتحديث الأكواد"}</span>
              </button>
            </div>
          </div>

          {/* أداة فحص وتصفية الطلاب المكررين في الدواليب */}
          <div style={{ background: "var(--surface)", border: "1px solid rgba(245, 158, 11, 0.45)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ maxWidth: "600px" }}>
                <h4 style={{ color: "var(--warning)", margin: "0 0 6px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldAlert size={19} strokeWidth={1.5} />
                  <span>فحص ومنع تكرار الطلاب في الدواليب</span>
                </h4>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
                  فحص شامل لجميع كشوف وحجوزات الدواليب لضمان عدم تكرار اسم أو كود أي طالب في أكثر من دولاب، مع إمكانية التصفية التلقائية بضغطة زر.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={handleScanDuplicates}
                  disabled={isScanningDuplicates || isResolvingDuplicates}
                  style={{
                    background: "#b45309",
                    color: "#fff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: (isScanningDuplicates || isResolvingDuplicates) ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <Search size={17} strokeWidth={1.5} className={isScanningDuplicates ? "animate-spin" : ""} />
                  <span>{isScanningDuplicates ? "جاري الفحص..." : "فحص التكرارات الآن"}</span>
                </button>

                {duplicateStudents && duplicateStudents.length > 0 && (
                  <button
                    onClick={handleResolveDuplicates}
                    disabled={isResolvingDuplicates}
                    style={{
                      background: "var(--success)",
                      color: "#fff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: isResolvingDuplicates ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <CheckCircle2 size={17} strokeWidth={1.5} className={isResolvingDuplicates ? "animate-spin" : ""} />
                    <span>{isResolvingDuplicates ? "جاري التصفية..." : "تصفية وحذف التكرارات تلقائياً"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* عرض نتائج فحص التكرارات */}
            {duplicateStudents !== null && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                {duplicateStudents.length === 0 ? (
                  <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--success)", borderRadius: "8px", padding: "12px 16px", color: "var(--success)", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={18} strokeWidth={1.5} />
                    <span>ممتاز! لم يتم العثور على أي تكرار، جميع الطلاب مسكنين في دواليب فريدة 100%.</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span className="tabular-nums" style={{ color: "var(--error)", fontWeight: "600", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <AlertCircle size={16} strokeWidth={1.5} />
                        <span>تم رصد {duplicateStudents.length} طلاب مسجلين بأكثر من دولاب:</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                      {duplicateStudents.map((dup, idx) => (
                        <div key={idx} style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: "600", color: "var(--text-primary)", fontSize: "14px" }}>{dup.studentName || dup.student_name}</span>
                              {(dup.studentCode || dup.student_code) && (
                                <span className="tabular-nums" style={{ background: "var(--surface-hover)", color: "var(--accent-ink)", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", direction: "ltr" }}>
                                  #{dup.studentCode || dup.student_code}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                              مسجل في الدواليب:{" "}
                              {(dup.occurrences || dup.bookings || []).map((b: any, bIdx: number) => (
                                <span key={b.bookingId || b.booking_id || bIdx} className="tabular-nums" style={{ background: b.status === "confirmed" ? "#065f46" : "#78350f", color: "#fff", padding: "2px 6px", borderRadius: "6px", margin: "0 4px", fontSize: "11px" }}>
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
          <div style={{ background: "var(--surface)", border: "1px solid rgba(239, 68, 68, 0.45)", borderRadius: "12px", padding: "20px" }}>
            <h4 style={{ color: "var(--error)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={18} strokeWidth={1.5} />
              <span>تفريغ دواليب دفعة كاملة (عند التخرج أو نهاية العام)</span>
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", margin: "0 0 16px 0" }}>
              يقوم هذا الأمر بإلغاء حجوزات وإخلاء كافة الدواليب المخصصة لفرقة دراسية محددة مرة واحدة لتكون جاهزة للطلاب الجدد.
            </p>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={cohortToClear}
                onChange={(e) => setCohortToClear(e.target.value)}
                style={{
                  background: "var(--bg-deep)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  padding: "10px 14px",
                  borderRadius: "8px",
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
                  background: "var(--error)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                بدء تفريغ الدفعة الآن
              </button>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <h4 style={{ color: "var(--text-primary)", margin: "0 0 8px 0", fontSize: "16px", fontWeight: "600" }}>
              خطة الاستقلالية الذاتية (3 سنوات)
            </h4>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10001,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "500px",
            padding: "24px",
            maxHeight: "90vh",
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div className="tabular-nums" style={{ fontSize: "20px", fontWeight: "600", color: "var(--accent-ink)" }}>
                دولاب {selectedLocker.locker_code}
              </div>
              <button
                onClick={() => setSelectedLocker(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* تفاصيل السعة والإتاحة */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button
                onClick={() => handleToggleEnabled(selectedLocker.locker_code)}
                style={{
                  flex: 1,
                  background: selectedLocker.is_enabled ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)",
                  border: `1px solid ${selectedLocker.is_enabled ? "var(--success)" : "var(--error)"}`,
                  color: selectedLocker.is_enabled ? "var(--success)" : "var(--error)",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px"
                }}
              >
                {selectedLocker.is_enabled ? <Unlock size={16} strokeWidth={1.5} /> : <Lock size={16} strokeWidth={1.5} />}
                <span>{selectedLocker.is_enabled ? "متاح للطلاب" : "محجوب إدارياً"}</span>
              </button>

              <div style={{ display: "flex", gap: "4px" }}>
                {[2, 4].map((cap) => (
                  <button
                    key={cap}
                    onClick={() => handleUpdateCapacity(selectedLocker.locker_code, cap)}
                    className="tabular-nums"
                    style={{
                      background: selectedLocker.capacity === cap ? "var(--primary)" : "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "600",
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
              <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "var(--accent-ink)", fontWeight: "600" }}>الفرقة: {selectedBooking.cohort}</span>
                  <span style={{ color: selectedBooking.status === "confirmed" ? "var(--success)" : "var(--warning)", fontSize: "12px", fontWeight: "600" }}>
                    {selectedBooking.status === "confirmed" ? "معتمد" : "معلق"}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  هاتف التواصل: <span dir="ltr" className="tabular-nums">{selectedBooking.representative_phone}</span>
                </div>

                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px" }}>
                  الطلاب المسكنون:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedBooking.student_names.map((name: string, i: number) => {
                    const code = selectedBooking.student_codes?.[i];
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "8px 10px", borderRadius: "8px", fontSize: "13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "var(--text-primary)" }}><span className="tabular-nums">{i + 1}.</span> {name}</span>
                          {code && <span className="tabular-nums" style={{ color: "var(--text-muted)", direction: "ltr", fontSize: "11px" }}>#{code}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {code && (
                            <button
                              type="button"
                              onClick={() => handleImpersonateStudent(code)}
                              style={{ background: "rgba(56, 189, 248, 0.12)", border: "1px solid var(--primary)", color: "var(--accent-ink)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                              title={`دخول كطالب (${name})`}
                            >
                              <UserCog size={12} strokeWidth={1.5} />
                              <span>دخول للحساب</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveStudent(selectedBooking.id, name)}
                            style={{ background: "transparent", border: "none", color: "var(--error)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "500" }}
                            title="إقصاء هذا الطالب فقط"
                          >
                            <UserMinus size={14} strokeWidth={1.5} />
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
                      style={{ flex: 1, background: "var(--success)", color: "#fff", border: "none", padding: "10px", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
                    >
                      اعتماد الحجز
                    </button>
                  )}
                  <button
                    onClick={() => openEditBooking(selectedBooking)}
                    style={{ background: "var(--surface-hover)", color: "var(--text-primary)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", fontSize: "13px" }}
                    title="تعديل بيانات الحجز"
                  >
                    <Edit3 size={16} strokeWidth={1.5} />
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
                    style={{ background: "var(--primary)", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer" }}
                  >
                    <Printer size={18} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => handleVacateLocker(selectedLocker.locker_code)}
                    style={{ background: "var(--error)", color: "#fff", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer" }}
                    title="إخلاء الدولاب بالكامل"
                  >
                    <Trash2 size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", textAlign: "center", color: "var(--text-muted)", marginBottom: "16px" }}>
                <p style={{ margin: "0 0 14px 0", color: selectedLocker.is_admin_reserved ? "var(--warning)" : "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {selectedLocker.is_admin_reserved ? (
                    <>
                      <Lock size={15} strokeWidth={1.5} />
                      <span>هذا الدولاب مخصص للإدارة حالياً ومحجوب عن الطلاب.</span>
                    </>
                  ) : (
                    <span>هذا الدولاب شاغر حالياً وغير مسكن عليه أي طالب.</span>
                  )}
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      const lk = selectedLocker;
                      setSelectedLocker(null);
                      openManualAssign(lk);
                    }}
                    style={{
                      background: "var(--primary)",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Plus size={15} strokeWidth={1.5} />
                    <span>تسكين طلاب يدوياً في هذا الدولاب</span>
                  </button>
                  <button
                    onClick={() => {
                      const code = selectedLocker.locker_code;
                      const isRes = selectedLocker.is_admin_reserved;
                      handleSetAdminReserved(code, !isRes);
                    }}
                    style={{
                      background: selectedLocker.is_admin_reserved ? "var(--success)" : "#b45309",
                      color: "#fff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Lock size={15} strokeWidth={1.5} />
                    <span>{selectedLocker.is_admin_reserved ? "إلغاء التخصيص وإتاحته للطلاب" : "تخصيص للإدارة"}</span>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedLocker(null)}
              style={{ width: "100%", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)", padding: "10px", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" }}
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10002,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--warning)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "460px",
            padding: "24px"
          }}>
            {/* الرأس */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="tabular-nums" style={{
                  background: "rgba(245, 158, 11, 0.16)",
                  border: "1px solid var(--warning)",
                  color: "var(--warning)",
                  width: "42px",
                  height: "42px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                  fontSize: "17px"
                }}>
                  {adminModalLocker.locker_code}
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-primary)" }}>
                    إدارة وتخصيص الدولاب
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    الحالة: {adminModalLocker.is_admin_reserved ? "مخصص للإدارة" : adminModalLocker.status === "confirmed" ? "معتمد" : adminModalLocker.status === "pending" ? "معلق" : "شاغر"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAdminModalLocker(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* قائمة الخيارات السريعة */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              
              {/* 1. تخصيص للإدارة / إلغاء التخصيص */}
              <button
                onClick={() => handleSetAdminReserved(adminModalLocker.locker_code, !adminModalLocker.is_admin_reserved)}
                disabled={actionLoading}
                style={{
                  background: adminModalLocker.is_admin_reserved ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)",
                  border: `1px solid ${adminModalLocker.is_admin_reserved ? "var(--success)" : "var(--warning)"}`,
                  borderRadius: "12px",
                  padding: "14px 16px",
                  color: adminModalLocker.is_admin_reserved ? "var(--success-ink)" : "var(--warning-ink)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "right"
                }}
              >
                <div style={{
                  background: adminModalLocker.is_admin_reserved ? "var(--success)" : "var(--warning)",
                  color: "#000",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  {adminModalLocker.is_admin_reserved ? <Unlock size={18} strokeWidth={1.5} /> : <Lock size={18} strokeWidth={1.5} />}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    {adminModalLocker.is_admin_reserved ? "إلغاء تخصيص الإدارة وإتاحته للطلاب" : "تخصيص الدولاب للإدارة"}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                    {adminModalLocker.is_admin_reserved ? "إعادة فتح الدولاب ليصبح متاحاً للتسكين الطلابي" : "حجب الدولاب عن حجز الطلاب وتخصيصه للأساتذة والإدارة"}
                  </div>
                </div>
              </button>

              {/* 2. تعديل السعة */}
              <div style={{
                background: "var(--bg-deep)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "12px 16px"
              }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                  تحديد سعة الدولاب:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[2, 4].map((cap) => (
                    <button
                      key={cap}
                      onClick={() => handleUpdateCapacity(adminModalLocker.locker_code, cap)}
                      className="tabular-nums"
                      style={{
                        background: adminModalLocker.capacity === cap ? "var(--primary)" : "var(--surface)",
                        border: adminModalLocker.capacity === cap ? "1px solid var(--accent-ink)" : "1px solid var(--border)",
                        color: "#fff",
                        padding: "10px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <Users size={15} strokeWidth={1.5} />
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
                  background: "var(--bg-deep)",
                  border: "1px solid var(--accent-ink)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  color: "var(--accent-ink)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "right"
                }}
              >
                <div style={{
                  background: "rgba(56, 189, 248, 0.14)",
                  color: "var(--accent-ink)",
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Plus size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    تسكين طلاب يدوياً في هذا الدولاب
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
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
                    border: "1px solid var(--error)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    color: "var(--error-ink)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textAlign: "right"
                  }}
                >
                  <div style={{
                    background: "var(--error)",
                    color: "#fff",
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Trash2 size={17} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>
                      إخلاء وتفريغ الدولاب فوراً
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--error-ink)", opacity: 0.85, marginTop: "2px" }}>
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
                background: "var(--surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                padding: "10px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
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
          background: "rgba(2, 6, 23, 0.86)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10003,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--primary)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "480px",
            padding: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div className="tabular-nums" style={{ fontSize: "18px", fontWeight: 600, color: "var(--accent-ink)" }}>
                تسكين طلاب في دولاب ({manualAssignLocker.locker_code})
              </div>
              <button
                onClick={() => setManualAssignLocker(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleManualAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>الفرقة الدراسية:</label>
                <select
                  value={manualAssignCohort}
                  onChange={(e) => setManualAssignCohort(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "var(--text-primary)",
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
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>رقم هاتف ممثل الدولاب:</label>
                <input
                  type="text"
                  className="tabular-nums"
                  placeholder="01xxxxxxxxx"
                  value={manualAssignPhone}
                  onChange={(e) => setManualAssignPhone(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
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
                            background: "var(--bg-deep)",
                            border: manualAssignCodes[idx] ? "1px solid var(--success)" : "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "9px 12px",
                            color: "var(--text-primary)",
                            outline: "none",
                            fontSize: "13px"
                          }}
                        />
                        {manualAssignCodes[idx] && (
                          <span 
                            className="tabular-nums"
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "var(--success-ink)",
                              border: "1px solid rgba(16, 185, 129, 0.35)",
                              borderRadius: "6px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                            title="تم ربط كود الطالب بنجاح وسيظهر الدولاب في حسابه فورياً"
                          >
                            <Check size={12} strokeWidth={1.5} />
                            <span>#{manualAssignCodes[idx]}</span>
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
                          background: "var(--surface)",
                          border: "1px solid var(--accent-ink)",
                          borderRadius: "8px",
                          marginTop: "4px",
                          maxHeight: "180px",
                          overflowY: "auto"
                        }}>
                          {isSearchingStudents ? (
                            <div style={{ padding: "10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
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
                                  borderBottom: "1px solid var(--border)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div>
                                  <div style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600 }}>{st.full_name}</div>
                                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{st.academic_year || manualAssignCohort} {st.section ? `• ${st.section}` : ''}</div>
                                </div>
                                <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "11px", fontWeight: 600, background: "rgba(56, 189, 248, 0.14)", padding: "2px 7px", borderRadius: "6px" }}>
                                  #{st.student_code}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
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
                    background: "var(--success)",
                    color: "#fff",
                    border: "none",
                    padding: "11px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <CheckCircle2 size={16} strokeWidth={1.5} />
                  <span>تأكيد التسكين فوراً</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualAssignLocker(null)}
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    padding: "11px 18px",
                    borderRadius: "8px",
                    fontWeight: 500,
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
          background: "rgba(2, 6, 23, 0.86)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10004,
          padding: "16px"
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--accent-ink)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "520px",
            maxHeight: "90vh",
            overflowY: "auto",
            padding: "24px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
              <div className="tabular-nums" style={{ fontSize: "17px", fontWeight: 600, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Edit3 size={18} strokeWidth={1.5} />
                <span>تعديل بيانات الحجز (دولاب {editingBooking.locker_code})</span>
              </div>
              <button
                onClick={() => setEditingBooking(null)}
                className="modal-close-btn"
                title="إغلاق"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleUpdateBookingSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>رمز الدولاب:</label>
                  <input
                    type="text"
                    className="tabular-nums"
                    required
                    value={editLockerCode}
                    onChange={(e) => setEditLockerCode(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "var(--accent-ink)",
                      fontWeight: 600,
                      outline: "none",
                      textAlign: "center",
                      fontSize: "15px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>حالة الحجز:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    style={{
                      width: "100%",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: editStatus === "confirmed" ? "var(--success-ink)" : "var(--warning-ink)",
                      fontWeight: 600,
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="confirmed">معتمد ومؤكد</option>
                    <option value="pending">معلق بانتظار الاعتماد</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>الفرقة الدراسية:</label>
                  <select
                    value={editCohort}
                    onChange={(e) => setEditCohort(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "var(--text-primary)",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="الفرقة الرابعة">الفرقة الرابعة</option>
                    <option value="الفرقة الثالثة">الفرقة الثالثة</option>
                    <option value="الفرقة الثانية">الفرقة الثانية</option>
                    <option value="الفرقة الأولى">الفرقة الأولى</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>هاتف ممثل الدولاب:</label>
                  <input
                    type="text"
                    className="tabular-nums"
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    style={{
                      width: "100%",
                      background: "var(--bg-deep)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px",
                      color: "var(--text-primary)",
                      outline: "none",
                      textAlign: "right",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {/* أسماء وأكواد الطلاب */}
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>
                  الطلاب المسكنون (حتى 4 طلاب) - اكتب للاقتراح الذكي:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {editNames.map((name, idx) => (
                    <div key={idx} style={{ position: "relative" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span className="tabular-nums" style={{ fontSize: "12px", color: "var(--text-dim)", width: "16px" }}>{idx + 1}.</span>
                        <input
                          type="text"
                          placeholder={`اسم الطالب (${idx + 1})`}
                          value={name}
                          onChange={(e) => handleEditStudentSearchInput(idx, e.target.value)}
                          style={{
                            flex: 2,
                            background: "var(--bg-deep)",
                            border: editCodes[idx] ? "1px solid var(--success)" : "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "8px 10px",
                            color: "var(--text-primary)",
                            outline: "none",
                            fontSize: "13px"
                          }}
                        />
                        <input
                          type="text"
                          className="tabular-nums"
                          placeholder="الكود"
                          value={editCodes[idx] || ""}
                          onChange={(e) => {
                            const newCodes = [...editCodes];
                            newCodes[idx] = e.target.value.trim();
                            setEditCodes(newCodes);
                          }}
                          style={{
                            width: "85px",
                            background: "var(--bg-deep)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "8px 6px",
                            color: "var(--accent-ink)",
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
                              background: "rgba(56, 189, 248, 0.14)",
                              border: "1px solid var(--primary)",
                              color: "var(--accent-ink)",
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
                            <UserCog size={13} strokeWidth={1.5} />
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
                          background: "var(--surface)",
                          border: "1px solid var(--accent-ink)",
                          borderRadius: "8px",
                          marginTop: "4px",
                          maxHeight: "180px",
                          overflowY: "auto"
                        }}>
                          {isSearchingEditStudents ? (
                            <div style={{ padding: "10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
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
                                  borderBottom: "1px solid var(--border)",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              >
                                <div>
                                  <div style={{ color: "var(--text-primary)", fontSize: "13px", fontWeight: 600 }}>{st.full_name}</div>
                                  <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{st.academic_year || editCohort}</div>
                                </div>
                                <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "11px", fontWeight: 600 }}>
                                  #{st.student_code}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "8px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
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
                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>ملاحظات الإدارة:</label>
                <input
                  type="text"
                  placeholder="ملاحظات اختيارية..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg-deep)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "var(--text-primary)",
                    outline: "none",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    padding: "11px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Save size={16} strokeWidth={1.5} />
                  <span>حفظ التعديلات سحابياً</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    padding: "11px 18px",
                    borderRadius: "8px",
                    fontWeight: 500,
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
