"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { 
  UserCheck, 
  User,
  LogIn, 
  Camera, 
  RefreshCw, 
  LogOut, 
  CalendarCheck, 
  Award, 
  AlertTriangle, 
  MessageSquare, 
  CheckCircle2, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  UploadCloud, 
  ChevronLeft,
  ChevronDown,
  X,
  Smartphone,
  ImageIcon,
  FolderOpen,
  ArrowRight,
  Sun,
  RotateCw,
  QrCode,
  Download,
  ShieldCheck,
  Check,
  Archive,
  Eye,
  EyeOff,
  KeyRound
} from "lucide-react";
import { formatStudentCode } from "@/lib/codeHelper";
import { getOrCreateDeviceInfo, isAndroidAppClient, isInstalledPWA } from "@/lib/deviceFingerprint";
import { compressImageToWebP } from "@/lib/imageCompressor";
import StudentLockerTab from "@/components/lockers/StudentLockerTab";
import QRCode from "react-qr-code";
import StudentMigrationNotice from "@/components/StudentMigrationNotice";

function formatRemainingTime(deadlineStr?: string | null): { text: string; isExpired: boolean; isUrgent: boolean } {
  if (!deadlineStr) return { text: '', isExpired: false, isUrgent: false };
  const target = new Date(deadlineStr).getTime();
  if (isNaN(target)) return { text: '', isExpired: false, isUrgent: false };
  const diff = target - Date.now();
  if (diff <= 0) {
    return { text: '⛔ انتهى موعد الرفع', isExpired: true, isUrgent: false };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) {
    return { text: `⏳ متبقي: ${days} يوم و ${hours} س`, isExpired: false, isUrgent: days <= 1 };
  }
  if (hours > 0) {
    return { text: `⏳ متبقي: ${hours} س و ${minutes} د`, isExpired: false, isUrgent: true };
  }
  return { text: `⏳ متبقي: ${minutes} دقيقة فقط!`, isExpired: false, isUrgent: true };
}

export default function SystemPage() {
  // Navigation & Auth State
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("fania_student_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.student_code) return parsed;
      }
    } catch (e) {}
    return null;
  });
  const [accountStatus, setAccountStatus] = useState<"pending" | "active" | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem("fania_student_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.student_code) return parsed.status || "active";
      }
    } catch (e) {}
    return null;
  });
  const [isClientReady, setIsClientReady] = useState(false);
  const [projectSubTab, setProjectSubTab] = useState<"required" | "submitted">("required");
  const [activeUploadStage, setActiveUploadStage] = useState<"stage1" | "stage2">("stage1");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Coordinators list
  const [coordinators, setCoordinators] = useState<any[]>([]);

  // PWA & Android Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [pwaHintVisible, setPwaHintVisible] = useState(false);

  // Student registration lookup status (already active / pending / new)
  const [lookupStatus, setLookupStatus] = useState<{ isAlreadyActive?: boolean; isPending?: boolean; message?: string; student?: any } | null>(null);

  // Impersonation mode (Admin browsing as student)
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedStudentName, setImpersonatedStudentName] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  // Registration Form State & Auto Lookup
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [matchedStudent, setMatchedStudent] = useState<any>(null);
  const [isLookingUpCode, setIsLookingUpCode] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [idCardPhoto, setIdCardPhoto] = useState<string | null>(null);
  const [showIdCamera, setShowIdCamera] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [tempIdCardPreview, setTempIdCardPreview] = useState<string | null>(null);

  // PIN Verification State
  const [enteredPin, setEnteredPin] = useState("");
  const [showManualPinBox, setShowManualPinBox] = useState(false);

  // Active Tab in Student Dashboard
  const [activeTab, setActiveTab] = useState<"attendance" | "evaluation" | "warnings" | "lockers">("evaluation");
  const [dashboardData, setDashboardData] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedData = localStorage.getItem("fania_cached_dashboard_data");
      if (savedData) return JSON.parse(savedData);
    } catch (e) {}
    return null;
  });
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("fania_last_sync_time") || "";
  });

  // Course WhatsApp-Style Chat State
  const [selectedCourseForEval, setSelectedCourseForEval] = useState<any>(null);
  const [selectedProjectTab, setSelectedProjectTab] = useState<string>("all");
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Student Migration to App Notice State
  const [migrationStudentData, setMigrationStudentData] = useState<any>(null);
  const [showMigrationModal, setShowMigrationModal] = useState<boolean>(false);
  const [isTestMigrationMode, setIsTestMigrationMode] = useState<boolean>(false);
  const [apkInfo, setApkInfo] = useState<{ downloadUrl: string; version: string } | null>(null);

  const fetchMigrationInfo = async (code: string) => {
    try {
      const res = await fetch(`/api/students/migration-info?code=${encodeURIComponent(code)}&test_update=1`);
      const data = await res.json();
      if (data?.success && data?.student) {
        setMigrationStudentData(data.student);
        if (data.apk) setApkInfo({ downloadUrl: data.apk.downloadUrl, version: data.apk.version || '1.0.6' });
      }
    } catch (e) {}
  };

  // New Project Cards Grid & View State
  const [selectedProjectForView, setSelectedProjectForView] = useState<any | null>(null);
  const [projectCourseFilter, setProjectCourseFilter] = useState<string>("all");
  const [expandedAttendanceCourseId, setExpandedAttendanceCourseId] = useState<string | null>(null);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState<string>("");

  // Selfie Avatar Camera State
  const [showSelfieModal, setShowSelfieModal] = useState<boolean>(false);
  const [selfieStream, setSelfieStream] = useState<MediaStream | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isSavingSelfie, setIsSavingSelfie] = useState<boolean>(false);
  const [selfieMsg, setSelfieMsg] = useState<string>("");
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);

  const startSelfieCamera = async () => {
    try {
      setSelfiePhoto(null);
      setSelfieMsg("");
      setFaceDetected(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      setSelfieStream(stream);
      if (selfieVideoRef.current) {
        selfieVideoRef.current.srcObject = stream;
        selfieVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setSelfieMsg("تعذر فتح الكاميرا الأمامية: " + (err?.message || "يرجى منح صلاحية الكاميرا"));
    }
  };

  const stopSelfieCamera = () => {
    if (selfieStream) {
      selfieStream.getTracks().forEach(t => t.stop());
      setSelfieStream(null);
    }
    setFaceDetected(false);
  };

  const handleOpenSelfieModal = () => {
    setSelfiePhoto(null);
    setSelfieMsg("");
    setFaceDetected(false);
    setShowSelfieModal(true);
    setTimeout(() => {
      startSelfieCamera();
    }, 150);
  };

  useEffect(() => {
    if (showSelfieModal && selfieVideoRef.current && selfieStream) {
      selfieVideoRef.current.srcObject = selfieStream;
      selfieVideoRef.current.play().catch(() => {});
    }
  }, [showSelfieModal, selfieStream]);

  // محرك التعرف الذكي على الوجه (Native FaceDetector API + Fast Canvas Analysis)
  useEffect(() => {
    if (!showSelfieModal || !selfieStream || selfiePhoto) {
      setFaceDetected(false);
      return;
    }

    let isMounted = true;
    let timerId: any = null;

    const checkFaceInFrame = async () => {
      const video = selfieVideoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) {
        if (isMounted) timerId = setTimeout(checkFaceInFrame, 300);
        return;
      }

      try {
        // 1. فحص عبر FaceDetector API المدمجة بالمتصفح إن توفرت
        if (typeof (window as any).FaceDetector === "function") {
          const detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
          const faces = await detector.detect(video);
          if (isMounted) {
            setFaceDetected(Array.isArray(faces) && faces.length > 0);
          }
        } else {
          // 2. تحليل لوني دقيق وفائق السرعة لمحيط الوجه في منتصف الدائرة
          const canvas = document.createElement("canvas");
          canvas.width = 48;
          canvas.height = 48;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 640;
            const size = Math.min(vw, vh) * 0.55;
            const sx = (vw - size) / 2;
            const sy = (vh - size) / 2;
            ctx.drawImage(video, sx, sy, size, size, 0, 0, 48, 48);

            const imgData = ctx.getImageData(0, 0, 48, 48).data;
            let skinPixels = 0;
            const total = 48 * 48;

            for (let i = 0; i < imgData.length; i += 4) {
              const r = imgData[i];
              const g = imgData[i + 1];
              const b = imgData[i + 2];
              if (r > 60 && g > 40 && b > 20 && r > g && r > b && (r - g) > 12 && (r - b) > 14) {
                skinPixels++;
              }
            }

            const skinRatio = skinPixels / total;
            const hasFace = skinRatio >= 0.20 && skinRatio <= 0.88;
            if (isMounted) {
              setFaceDetected(hasFace);
            }
          }
        }
      } catch (e) {
        // تجاهل أي خطأ عابر في إطار الفيديو
      }

      if (isMounted) {
        timerId = setTimeout(checkFaceInFrame, 250);
      }
    };

    timerId = setTimeout(checkFaceInFrame, 350);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [showSelfieModal, selfieStream, selfiePhoto]);

  const captureSelfieFrame = () => {
    if (!selfieVideoRef.current) return null;
    const video = selfieVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Mirror horizontally so selfie looks like a true mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  };

  const handleSaveSelfie = async () => {
    if (!selfiePhoto || !currentStudent) return;
    setIsSavingSelfie(true);
    setSelfieMsg("جاري حفظ واعتماد صورتك الشخصية...");
    try {
      const res = await fetch("/api/students/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentStudent.student_code,
          image: selfiePhoto
        })
      });
      const data = await res.json();
      if (data?.success && data.avatar_url) {
        setCurrentStudent((prev: any) => ({ ...prev, avatar_url: data.avatar_url }));
        try {
          localStorage.setItem("fania_student_avatar", data.avatar_url);
        } catch (e) {}
        setSelfieMsg("تم حفظ صورتك الشخصية واعتمادها بنجاح! 🎉");
        setTimeout(() => {
          stopSelfieCamera();
          setShowSelfieModal(false);
          setSelfiePhoto(null);
          setSelfieMsg("");
        }, 1200);
      } else {
        setSelfieMsg(data?.error || "تعذر حفظ الصورة");
      }
    } catch (e: any) {
      setSelfieMsg("خطأ في الاتصال بالسيرفر");
    } finally {
      setIsSavingSelfie(false);
    }
  };

  // 1. تجميع وحساب كافة المشاريع المعينة لجميع المقررات (Memoized لمنع إعادة الحساب وتفادي اللاج)
  const allStudentProjects = useMemo(() => {
    const list: any[] = [];
    (dashboardData?.projects || []).forEach((course: any) => {
      (course.assignedProjects || []).forEach((proj: any) => {
        const sub = proj.submission || (course.submissions || []).find((s: any) => (s.project_name || '').trim() === (proj.title || '').trim());
        const ev = proj.evaluation;
        const isGraded = !!((ev && ev.score !== null && ev.score !== undefined && !isNaN(Number(ev.score)) && Number(ev.score) > 0) || (proj.score !== null && proj.score !== undefined && !isNaN(Number(proj.score)) && Number(proj.score) > 0 && proj.status === 'evaluated'));
        const score = isGraded ? (ev?.score ?? proj.score) : null;
        const isSubmitted = isGraded || proj.status === 'submitted' || proj.status === 'evaluated' || !!sub || !!(ev?.photo_url);
        const subImgList = Array.isArray(sub?.images) ? sub.images : [];
        const hasStage1Image = proj.hasStage1Image ?? (isSubmitted && (subImgList.some((i: any) => i.stage === 'stage1' || !i.stage) || !!ev?.photo_url));
        const hasStage2Image = proj.hasStage2Image ?? (isSubmitted && subImgList.some((i: any) => i.stage === 'stage2'));
        const isFullySubmitted = proj.multiStageEnabled ? (hasStage1Image && hasStage2Image) : isSubmitted;

        list.push({
          ...proj,
          courseId: course.courseId,
          courseName: course.courseName,
          academicYear: course.academicYear,
          instructorTitle: course.instructorTitle || "أستاذ المقرر",
          instructorName: course.instructorName,
          submission: sub,
          evaluation: ev,
          isGraded,
          isSubmitted,
          hasStage1Image,
          hasStage2Image,
          isFullySubmitted,
          score
        });
      });
    });
    return list;
  }, [dashboardData]);

  const courseFilteredProjects = useMemo(() => {
    return projectCourseFilter === "all"
      ? allStudentProjects
      : allStudentProjects.filter((p: any) => p.courseId === projectCourseFilter);
  }, [allStudentProjects, projectCourseFilter]);

  const { requiredProjects, submittedProjects } = useMemo(() => {
    const req = courseFilteredProjects.filter((p: any) => !p.isFullySubmitted);
    const sub = courseFilteredProjects.filter((p: any) => p.isSubmitted || p.isFullySubmitted || p.isGraded);
    return { requiredProjects: req, submittedProjects: sub };
  }, [courseFilteredProjects]);

  const displayedProjects = projectSubTab === "required" ? requiredProjects : submittedProjects;

  // -------------------------------------------------------------
  // محرك الإشعارات الذكي وحساب الشارات الحمراء للتبويبات الـ 5
  // -------------------------------------------------------------
  const [seenNotifications, setSeenNotifications] = useState<{
    seenProjects: Record<string, { seen: boolean; seenScore?: number | null }>;
    seenAttendanceRecords: string[];
    seenWarnings: string[];
    seenLockerKey: string | null;
    seenComplaintsReplies: string[];
  }>({
    seenProjects: {},
    seenAttendanceRecords: [],
    seenWarnings: [],
    seenLockerKey: null,
    seenComplaintsReplies: []
  });

  // استرجاع الإشعارات المقروءة الخاصة بالطالب الحالي من التخزين المحلي
  useEffect(() => {
    if (currentStudent?.student_code) {
      try {
        const stored = localStorage.getItem(`fania_seen_notifications_${currentStudent.student_code}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSeenNotifications({
            seenProjects: parsed.seenProjects || {},
            seenAttendanceRecords: Array.isArray(parsed.seenAttendanceRecords) ? parsed.seenAttendanceRecords : [],
            seenWarnings: Array.isArray(parsed.seenWarnings) ? parsed.seenWarnings : [],
            seenLockerKey: parsed.seenLockerKey ?? null,
            seenComplaintsReplies: Array.isArray(parsed.seenComplaintsReplies) ? parsed.seenComplaintsReplies : []
          });
        }
      } catch (e) {
        console.warn("Failed to load seen notifications", e);
      }
    }
  }, [currentStudent?.student_code]);

  // حفظ التحديثات في التخزين المحلي للطالب
  const saveSeenNotifications = (updater: (prev: typeof seenNotifications) => typeof seenNotifications) => {
    setSeenNotifications(prev => {
      const next = updater(prev);
      if (currentStudent?.student_code) {
        try {
          localStorage.setItem(`fania_seen_notifications_${currentStudent.student_code}`, JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  };

  // 1. تعليم مشروع معين كمقروء عند فتحه
  const markProjectAsSeen = (proj: any) => {
    if (!proj) return;
    const key = `${proj.courseId}_${proj.title || proj.id}`;
    saveSeenNotifications(prev => ({
      ...prev,
      seenProjects: {
        ...prev.seenProjects,
        [key]: {
          seen: true,
          seenScore: proj.isGraded ? proj.score : null
        }
      }
    }));
  };

  // 2. تعليم كافة سجلات الحضور الحالية كمقروءة عند فتح تبويب الحضور
  const markAttendanceAsSeen = () => {
    if (!dashboardData?.attendance) return;
    const allRecords: string[] = [];
    (dashboardData.attendance || []).forEach((c: any) => {
      (c.records || []).forEach((r: any) => {
        allRecords.push(`${c.courseId}_${r.date}_${r.status}`);
      });
    });
    saveSeenNotifications(prev => ({
      ...prev,
      seenAttendanceRecords: Array.from(new Set([...(prev.seenAttendanceRecords || []), ...allRecords]))
    }));
  };

  // 3. تعليم الإنذارات الحالية كمقروءة عند فتح تبويب الإنذارات
  const markWarningsAsSeen = () => {
    if (!dashboardData?.warnings) return;
    const allWarnKeys: string[] = [];
    (dashboardData.warnings || []).forEach((w: any) => {
      allWarnKeys.push(`${w.courseId}_absent_${w.absent}`);
    });
    saveSeenNotifications(prev => ({
      ...prev,
      seenWarnings: Array.from(new Set([...(prev.seenWarnings || []), ...allWarnKeys]))
    }));
  };

  // 4. تعليم حالة الدواليب كمقروءة عند فتح تبويب الدواليب
  const markLockerAsSeen = () => {
    const locker = dashboardData?.locker;
    const booking = locker?.booking || locker;
    const currentKey = `${booking?.id || ''}_${booking?.status || ''}_${booking?.locker_number || ''}`;
    saveSeenNotifications(prev => ({
      ...prev,
      seenLockerKey: currentKey
    }));
  };

  // 5. تعليم ردود الشكاوى كمقروءة عند فتح تبويب الشكاوى
  const markComplaintsAsSeen = () => {
    if (!dashboardData?.complaints) return;
    const repliedIds: string[] = [];
    (dashboardData.complaints || []).forEach((c: any) => {
      const hasReply = c.status === 'تم الرد' || Boolean(c.admin_reply) || Boolean(c.officialReply);
      if (hasReply && c.id) {
        repliedIds.push(String(c.id));
      }
    });
    saveSeenNotifications(prev => ({
      ...prev,
      seenComplaintsReplies: Array.from(new Set([...(prev.seenComplaintsReplies || []), ...repliedIds]))
    }));
  };

  // دالة موحدة لفتح كارت المشروع وتعليمه كمقروء
  const handleSelectProjectForView = (proj: any) => {
    setSelectedProjectForView(proj);
    markProjectAsSeen(proj);
  };

  // عند تحديث بيانات المشروع المفتوح حالياً إذا رُصدت له درجة
  useEffect(() => {
    if (selectedProjectForView) {
      markProjectAsSeen(selectedProjectForView);
    }
  }, [selectedProjectForView?.score, selectedProjectForView?.isGraded]);

  // حساب الأعداد الدقيقة للإشعارات غير المقروءة لكل تبويب
  const unreadProjectsCount = useMemo(() => {
    if (!dashboardData?.projects) return 0;
    let count = 0;
    const seenMap = seenNotifications.seenProjects || {};

    allStudentProjects.forEach((proj: any) => {
      const key = `${proj.courseId}_${proj.title || proj.id}`;
      const rec = seenMap[key];
      if (!rec) {
        // مشروع جديد بالكامل لم يفتحه الطالب
        count++;
      } else if (proj.isGraded) {
        // مشروع تم رصد درجة له: هل رآها الطالب؟
        const seenScore = rec.seenScore;
        if (seenScore === undefined || seenScore === null || Number(seenScore) !== Number(proj.score)) {
          count++;
        }
      }
    });

    return count;
  }, [dashboardData?.projects, allStudentProjects, seenNotifications.seenProjects]);

  const unreadRequiredCount = useMemo(() => {
    const seenMap = seenNotifications.seenProjects || {};
    return requiredProjects.filter((p: any) => {
      const k = `${p.courseId}_${p.title || p.id}`;
      return !seenMap[k];
    }).length;
  }, [requiredProjects, seenNotifications.seenProjects]);

  const unreadSubmittedCount = useMemo(() => {
    const seenMap = seenNotifications.seenProjects || {};
    return submittedProjects.filter((p: any) => {
      const k = `${p.courseId}_${p.title || p.id}`;
      const r = seenMap[k];
      if (!r) return true;
      if (p.isGraded) {
        const ss = r.seenScore;
        if (ss === undefined || ss === null || Number(ss) !== Number(p.score)) return true;
      }
      return false;
    }).length;
  }, [submittedProjects, seenNotifications.seenProjects]);

  const unreadAttendanceCount = useMemo(() => {
    if (!dashboardData?.attendance) return 0;
    const seenSet = new Set(seenNotifications.seenAttendanceRecords || []);
    let count = 0;
    (dashboardData.attendance || []).forEach((c: any) => {
      (c.records || []).forEach((r: any) => {
        const key = `${c.courseId}_${r.date}_${r.status}`;
        if (!seenSet.has(key)) {
          count++;
        }
      });
    });
    return count;
  }, [dashboardData?.attendance, seenNotifications.seenAttendanceRecords]);

  const unreadWarningsCount = useMemo(() => {
    if (!dashboardData?.warnings) return 0;
    const seenSet = new Set(seenNotifications.seenWarnings || []);
    let count = 0;
    (dashboardData.warnings || []).forEach((w: any) => {
      const key = `${w.courseId}_absent_${w.absent}`;
      if (!seenSet.has(key)) {
        count++;
      }
    });
    return count;
  }, [dashboardData?.warnings, seenNotifications.seenWarnings]);

  const unreadLockersCount = useMemo(() => {
    const locker = dashboardData?.locker;
    if (!locker) return 0;
    const booking = locker?.booking || locker;
    if (booking && (booking.status || booking.locker_number || booking.id)) {
      const currentKey = `${booking.id || ''}_${booking.status || ''}_${booking.locker_number || ''}`;
      if (seenNotifications.seenLockerKey !== currentKey) {
        return 1;
      }
    }
    return 0;
  }, [dashboardData?.locker, seenNotifications.seenLockerKey]);

  const unreadComplaintsCount = useMemo(() => {
    if (!dashboardData?.complaints) return 0;
    const seenSet = new Set(seenNotifications.seenComplaintsReplies || []);
    let count = 0;
    (dashboardData.complaints || []).forEach((c: any) => {
      const hasReply = c.status === 'تم الرد' || Boolean(c.admin_reply) || Boolean(c.officialReply);
      if (hasReply && c.id && !seenSet.has(String(c.id))) {
        count++;
      }
    });
    return count;
  }, [dashboardData?.complaints, seenNotifications.seenComplaintsReplies]);

  // مسح الإشعار تلقائياً إذا كان الطالب متواجداً بالفعل في التبويب ووردت بيانات جديدة
  useEffect(() => {
    if (activeTab === "attendance" && unreadAttendanceCount > 0) {
      markAttendanceAsSeen();
    } else if (activeTab === "warnings" && unreadWarningsCount > 0) {
      markWarningsAsSeen();
    } else if (activeTab === "lockers" && unreadLockersCount > 0) {
      markLockerAsSeen();
    }
  }, [activeTab, unreadAttendanceCount, unreadWarningsCount, unreadLockersCount, unreadComplaintsCount]);

  const activeCourseAssignedProjects = selectedCourseForEval?.assignedProjects || [];
  const activeCourseSubmissions = selectedCourseForEval?.submissions || [];

  const filteredSubmissions = useMemo(() => {
    return selectedProjectTab === "all"
      ? activeCourseSubmissions
      : activeCourseSubmissions.filter((s: any) => s.project_name === selectedProjectTab);
  }, [activeCourseSubmissions, selectedProjectTab]);

  // Smart Camera State (Strict Live Camera, 2D/3D Mode, Anti-flicker)
  const [showArtworkCamera, setShowArtworkCamera] = useState(false);
  const [activeProjectForUpload, setActiveProjectForUpload] = useState<any>(null);
  const [cameraMode, setCameraMode] = useState<"2d" | "3d">("2d");
  const [orientationFrame, setOrientationFrame] = useState<"portrait" | "landscape">("portrait");
  const [capturedPhotos, setCapturedPhotos] = useState<any[]>([]);
  const [currentPhotoStep, setCurrentPhotoStep] = useState(1);
  const [requiredPhotosCount, setRequiredPhotosCount] = useState(1);
  const [cameraFrameState, setCameraFrameState] = useState<{
    quality: "good" | "dark" | "shaky";
    orientationMatches: boolean;
    message: string;
    frameColor: string;
    isReady: boolean;
  }>({
    quality: "shaky",
    orientationMatches: true,
    message: "جاري تهيئة الكاميرا وفحص الزاوية والإضاءة...",
    frameColor: "#f59e0b",
    isReady: false
  });
  const [uploadingProject, setUploadingProject] = useState(false);
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Complaint Form
  const [complaintTarget, setComplaintTarget] = useState("أستاذ المقرر");
  const [complaintText, setComplaintText] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Video and Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gyroListenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const gyroActiveRef = useRef(false);
  const isGyroLevelRef = useRef(true);
  const gyroMessageRef = useRef("");
  const lastFrameStateRef = useRef<{
    quality: "good" | "dark" | "shaky";
    orientationMatches: boolean;
    message: string;
    frameColor: string;
    isReady: boolean;
  }>({
    quality: "shaky",
    orientationMatches: true,
    message: "جاري تهيئة الكاميرا وفحص الزاوية والإضاءة...",
    frameColor: "#f59e0b",
    isReady: false
  });
  const idFileInputRef = useRef<HTMLInputElement>(null);

  // Safe ref setter: NEVER reassign srcObject if it's already set to the stream to eliminate flickering!
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(e => console.log("video play err:", e));
    }
  };

  // Auto-detect screen rotation for camera frame aspect ratio
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setOrientationFrame(window.innerWidth > window.innerHeight ? "landscape" : "portrait");
      }
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Restore Session or Impersonate on Mount
  useEffect(() => {
    setIsClientReady(true);
    (async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("fania_last_portal", "/system");
        localStorage.setItem("fania_app_mode", "student");
        let mLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
        if (mLink) {
          mLink.href = "/manifest-student.json";
        } else {
          mLink = document.createElement("link");
          mLink.rel = "manifest";
          mLink.href = "/manifest-student.json";
          document.head.appendChild(mLink);
        }
      } catch (e) {
        console.error("Manifest/localStorage update error:", e);
      }

      const params = new URLSearchParams(window.location.search);
      const impCode = params.get("impersonate");
      if (impCode) {
        setIsImpersonating(true);
        fetch(`/api/students/lookup?code=${encodeURIComponent(impCode)}`)
          .then(r => r.json())
          .then(data => {
            if (data.student) {
              setCurrentStudent(data.student);
              setImpersonatedStudentName(data.student.full_name);
              setAccountStatus("active");
              loadDashboard(data.student.student_code, true);
            }
          })
          .catch(err => console.error(err));
        return;
      }

      const isTestUpdate = params.get("test_update") === "1" || params.get("preview_update") === "1" || params.get("preview") === "1";
      const isBypassed = localStorage.getItem("fania_bypass_update_notice") === "1";
      const hasWebParam = params.get("web") === "1" || params.get("bypass") === "1";
      const isNativeApp = isAndroidAppClient();
      const isPWA = isInstalledPWA();

      // استخراج كود الطالب المحفوظ إن وُجد
      let savedStudentCode = "";
      try {
        const s = localStorage.getItem("fania_student_session");
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed?.student_code) savedStudentCode = parsed.student_code;
        }
      } catch (e) {}
      if (!savedStudentCode) {
        savedStudentCode = localStorage.getItem("fania_student_code") || "";
      }

      // أ) وضع المعاينة التجريبي
      if (isTestUpdate) {
        setIsTestMigrationMode(true);
        const testCode = params.get("code") || savedStudentCode || "0687";
        fetchMigrationInfo(testCode);
        setShowMigrationModal(true);
        return;
      }

      // ب) إذا كان الطالب يفتح من اختصار PWA المثبت سابقاً على الهاتف (وليس تطبيق الأندرويد الأصلي):
      // التوجيه الحتمي والفوري لشاشة ترقية الأندرويد لكي يحصل على كوده والباسورد وزر تحميل الـ APK
      if (!isNativeApp && isPWA && !hasWebParam) {
        const targetUrl = `/student-portal/update-notice${savedStudentCode ? `?code=${encodeURIComponent(savedStudentCode)}` : ""}`;
        window.location.replace(targetUrl);
        return;
      }

      // ج) إذا كان في متصفح عادي ولم يقم بالتجاوز مسبقاً، نفحص إعداد الترقية قبل أي دخول تلقائي للوحة القديمة
      if (!isNativeApp && !isBypassed && !hasWebParam) {
        try {
          const settingsRes = await fetch("/api/public/settings", { cache: "no-store" });
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            if (settings?.student_migration_screen) {
              const targetUrl = `/student-portal/update-notice${savedStudentCode ? `?code=${encodeURIComponent(savedStudentCode)}` : ""}`;
              window.location.replace(targetUrl);
              return;
            }
          }
        } catch (e) {}
      }
    }

    // 1. استعادة الجلسة والدخول الفوري المباشر (Instant Auto-Login & Offline-First)
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("fania_student_session") : null;
      let savedSession: any = null;
      if (saved) {
        try {
          savedSession = JSON.parse(saved);
        } catch (e) {
          savedSession = null;
        }
        if (!savedSession?.student_code) savedSession = null;
        if (savedSession?.pin_code) delete savedSession.pin_code;
      }

      // إذا كانت هناك جلسة محفوظة للطالب: الدخول الفوري دون إظهار شاشة الدخول
      if (savedSession?.student_code) {
        setCurrentStudent(savedSession);
        setAccountStatus(savedSession.status || "active");

        // إذا كان الجهاز غير متصل بالإنترنت: اعرض البيانات المحفوظة محلياً فوراً
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setIsOffline(true);
          return;
        }

        // إذا كان متصلاً بالإنترنت: نتحقق من السيرفر في الخلفية
        try {
          const sessionRes = await fetch("/api/students/session", { cache: "no-store", credentials: "same-origin" });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData?.authenticated && sessionData.student_code) {
              if (typeof window !== "undefined" && window.location.search) {
                window.history.replaceState({}, '', window.location.pathname);
              }
              if (sessionData.token) localStorage.setItem("fania_student_token", sessionData.token);
              await loadDashboard(sessionData.student_code);
              fetchCoordinators(sessionData.student_code);
              return;
            }
          }
          // إذا انتهت الجلسة صراحة من الخادم (401/Unauthorized)
          if (sessionRes.status === 401) {
            localStorage.removeItem("fania_student_session");
    localStorage.removeItem("fania_student_code");
    localStorage.removeItem("fania_student_token");
            setCurrentStudent(null);
            setAccountStatus(null);
            setAuthMode("login");
            setRegCode(savedSession.student_code);
            setErrorMsg("انتهت الجلسة. يرجى إدخال الرقم السري لتسجيل الدخول.");
            return;
          }
        } catch (netErr) {
          // اتصال ضعيف أو تعذر الوصول للسيرفر: استمر في عرض البيانات المحلية كوضع أوفلاين
          setIsOffline(true);
          return;
        }
      } else {
        // لا يوجد حساب مسجل: فتح صفحة تسجيل الدخول تلقائياً
        setAuthMode("login");
      }
    } catch (e) {}

    // 2. إذا لم تكن هناك جلسة سابقة، نتحقق من رابط التسجيل أو كود الطالب الوارد
    const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const incomingCode = searchParams?.get("code") || (typeof window !== "undefined" ? localStorage.getItem("fania_pending_reg_code") : null);
    const incomingMode = searchParams?.get("mode");

    if (incomingMode === "register" || incomingCode) {
      if (incomingCode) {
        setRegCode(incomingCode);
        setAuthMode("register");
        try {
          const prefetched = sessionStorage.getItem("fania_prefetched_student");
          if (prefetched) {
            const parsed = JSON.parse(prefetched);
            if (parsed && formatStudentCode(parsed.student_code) === formatStudentCode(incomingCode)) {
              setMatchedStudent(parsed);
              setRegName(parsed.full_name);
            }
          }
        } catch (e) {}
        if (typeof window !== "undefined") {
          localStorage.removeItem("fania_pending_reg_code");
          sessionStorage.removeItem("fania_prefetched_student");
        }
      }
    }

    fetchCoordinators();

    // Check PWA mode or query param
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("mode") === "login") setAuthMode("login");
      if (p.get("mode") === "register") setAuthMode("register");
    }
      })();

    return () => {
      stopCamera();
    };
  }, []);

  // Native Android Back Button & Gesture Navigation Handler
  useEffect(() => {
    if (typeof window === "undefined") return;

    (window as any).handleAndroidBack = () => {
      // 1. Image preview modal
      if (previewModalImage) {
        setPreviewModalImage(null);
        return true;
      }
      // 2. Project view modal
      if (selectedProjectForView) {
        setSelectedProjectForView(null);
        return true;
      }
      // 3. Course chat/eval modal
      if (selectedCourseForEval) {
        setSelectedCourseForEval(null);
        return true;
      }
      // 4. QR modal
      if (showQRModal) {
        setShowQRModal(false);
        return true;
      }
      // 5. Manual PIN modal
      if (showManualPinBox) {
        setShowManualPinBox(false);
        return true;
      }
      // 6. ID Camera modal
      if (showIdCamera) {
        setShowIdCamera(false);
        return true;
      }
      // 7. If logged in and on secondary tab (attendance, lockers, complaints, warnings), return to main evaluation tab
      if (currentStudent && activeTab !== "evaluation") {
        setActiveTab("evaluation");
        return true;
      }
      // 8. If in login screen entering PIN, return to code screen
      if (!currentStudent && showLoginPin) {
        setShowLoginPin(false);
        return true;
      }
      // 9. If ID preview is open
      if (tempIdCardPreview) {
        setTempIdCardPreview(null);
        return true;
      }
      return false;
    };

    return () => {
      delete (window as any).handleAndroidBack;
    };
  }, [
    previewModalImage,
    selectedProjectForView,
    selectedCourseForEval,
    showQRModal,
    showManualPinBox,
    showIdCamera,
    currentStudent,
    activeTab,
    showLoginPin,
    authMode
  ]);

  // Sync session with Native Android App for Background Notifications
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const bridge = (window as any).ArtEduNativeBridge;
      if (bridge) {
        if (currentStudent?.student_code) {
          const token = localStorage.getItem("fania_student_token") || "";
          bridge.saveStudentSession(currentStudent.student_code, currentStudent.full_name || "", token);
          const registerPush = (tries: number) => {
            try {
              const pt = typeof bridge.getPushToken === "function" ? bridge.getPushToken() : "";
              if (pt) {
                localStorage.setItem("fania_push_token", pt);
                fetch("/api/students/push-token", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "x-student-token": token, "Authorization": "Bearer " + token } : {})
                  },
                  credentials: "same-origin",
                  body: JSON.stringify({ token: pt, student_code: currentStudent.student_code })
                }).catch(() => {});
              } else if (tries > 0) {
                setTimeout(() => registerPush(tries - 1), 3000);
              }
            } catch (e) {}
          };
          registerPush(8);
        } else {
          bridge.clearStudentSession();
        }
      }
    } catch (e) {}
  }, [currentStudent?.student_code]);

  // Telecom-style Realtime Online/Offline Network Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnline = () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online && currentStudent?.student_code) {
        loadDashboard(currentStudent.student_code);
      }
    };
    setIsOffline(!navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [currentStudent?.student_code]);

  // PWA Install Prompt Listener for Android & Mobile
  useEffect(() => {
    const isNativeApp = navigator.userAgent.includes("ArtEduStudentApp");
    const isStandalone = isNativeApp || window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const dismissed = sessionStorage.getItem("pwa_install_dismissed");

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) {
        setShowPwaPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const timer = setTimeout(() => {
      if (isMobile && !dismissed && !isStandalone) {
        setShowPwaPrompt(true);
      }
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  // VIEW 1 Auto-Polling:
  // Automatically detects when coordinator activates the account and switches to Dashboard!
  useEffect(() => {
    if (!currentStudent || accountStatus !== "pending") return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const devInfo = getOrCreateDeviceInfo();
        const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(currentStudent.student_code)}&deviceId=${encodeURIComponent(devInfo.deviceId)}&_t=${Date.now()}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.isAlreadyActive) {
          // تم اعتماد الحساب: لا دخول تلقائي — نطلب الرقم السري لإنشاء جلسة آمنة
          const approvedCode = currentStudent.student_code;
          localStorage.removeItem("fania_student_session");
          localStorage.removeItem("fania_student_code");
          setCurrentStudent(null);
          setAccountStatus(null);
          setRegCode(approvedCode);
          setEnteredPin("");
          setAuthMode("login");
          setSuccessMsg("🎉 تم اعتماد حسابك بنجاح! يرجى إدخال الرقم السري لتسجيل الدخول.");
          if (typeof window !== "undefined") {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } else if (data.isNew) {
          localStorage.removeItem("fania_student_session");
          setCurrentStudent(null);
          setAccountStatus(null);
          setAuthMode("register");
          setErrorMsg("⚠️ تم إعادة تعيين بيانات التسجيل من قبل المنسق. يرجى إعادة إدخال بياناتك بشكل صحيح.");
        }
      } catch (e) {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentStudent, accountStatus]);

  const fetchCoordinators = async (studentCode?: string) => {
    try {
      const code = studentCode || currentStudent?.student_code;
      const url = code ? `/api/coordinators?student_code=${encodeURIComponent(code)}` : "/api/coordinators";
      const res = await fetch(url);
      const data = await res.json();
      if (data.coordinators) setCoordinators(data.coordinators);
    } catch (e) {}
  };

  // Automated Code Lookup with debounce
  useEffect(() => {
    if (authMode !== "register" || !regCode.trim()) {
      setMatchedStudent(null);
      setLookupStatus(null);
      setLookupMessage(null);
      return;
    }

    const timer = setTimeout(async () => {
      const queryCode = regCode.trim();
      if (queryCode.length < 2) return;

      setIsLookingUpCode(true);
      setLookupMessage(null);

      try {
        const devInfo = getOrCreateDeviceInfo();
        const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(queryCode)}&deviceId=${encodeURIComponent(devInfo.deviceId)}`);
        const data = await res.json();

        if (res.ok && data.student) {
          setMatchedStudent(data.student);
          setRegName(data.student.full_name);
          setLookupStatus({
            isAlreadyActive: !!data.isAlreadyActive,
            isPending: !!data.isPending,
            message: data.message || undefined
          });
          setLookupMessage(null);
        } else {
          setMatchedStudent(null);
          setLookupStatus(null);
          setLookupMessage(data.message || "الكود غير مسجل في كشوف الكلية الرسمية.");
        }
      } catch (e) {
        setLookupMessage("تعذر التحقق من الكود حالياً.");
      } finally {
        setIsLookingUpCode(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [regCode, authMode]);

  // Load Dashboard Data (authentication relies solely on the HttpOnly student session cookie)
  const loadDashboard = async (code: string, isImpersonationMode?: boolean) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const dev = getOrCreateDeviceInfo();
      const impParam = isImpersonationMode || isImpersonating ? "&impersonate=true" : "";
      const res = await fetch(`/api/students/dashboard-data?code=${encodeURIComponent(code)}&deviceId=${encodeURIComponent(dev.deviceId)}${impParam}&_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "x-device-id": dev.deviceId
        }
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("fania_student_session");
          localStorage.removeItem("fania_student_code");
          setCurrentStudent(null);
          setAccountStatus(null);
          setDashboardData(null);
          setRegCode(code);
          setEnteredPin("");
          setAuthMode("login");
          setErrorMsg(data.error || "انتهت جلستك. يرجى إدخال الرقم السري لتسجيل الدخول.");
          if (data?.app_migrated) {
            setTimeout(() => {
              window.location.href = "/student-portal";
            }, 2500);
          }
        } else {
          setErrorMsg(data.error || "تعذر تحميل بيانات الطالب");
        }
      } else {
        setDashboardData(data);
        if (data?.hide_warnings_tab && activeTab === "warnings") {
          setActiveTab("evaluation");
        }
        // تزامن فوري لكائن المقرر المختار لتحديث الأعمال والمشاريع تلقائياً
        if (data.projects) {
          setSelectedCourseForEval((prevCourse: any) => {
            if (!prevCourse) return prevCourse;
            const fresh = data.projects.find((c: any) => c.courseId === prevCourse.courseId);
            return fresh || prevCourse;
          });
        }
        if (data.student) {
          const mergedStudent = { ...(currentStudent || {}), ...data.student };
          delete mergedStudent.pin_code;
          setCurrentStudent(mergedStudent);
          if (!isImpersonationMode && !isImpersonating) {
            localStorage.setItem("fania_student_session", JSON.stringify(mergedStudent));
          }
          setAccountStatus("active");
        }

        // حفظ البيانات محلياً وتحديث وقت آخر مزامنة
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("fania_cached_dashboard_data", JSON.stringify(data));
            const now = new Date();
            const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
            const dateStr = now.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
            const fullSync = `${timeStr} (${dateStr})`;
            localStorage.setItem("fania_last_sync_time", fullSync);
            setLastSyncTime(fullSync);
            setIsOffline(false);
          }
        } catch (e) {}
      }
    } catch (err: any) {
      if (typeof window !== "undefined" && localStorage.getItem("fania_cached_dashboard_data")) {
        setIsOffline(true);
        setErrorMsg("");
      } else {
        setErrorMsg(err?.message || "خطأ في الاتصال بالخادم");
      }
    } finally {
      setLoading(false);
    }
  };

  // تزامن فوري لكائن المشروع المفتوح عند تحديث بيانات لوحة الطالب
  useEffect(() => {
    if (selectedProjectForView && dashboardData?.projects) {
      for (const c of dashboardData.projects) {
        if (c.courseId === selectedProjectForView.courseId) {
          const found = (c.assignedProjects || []).find((p: any) => (p.title || '').trim() === (selectedProjectForView.title || '').trim());
          if (found) {
            const sub = found.submission || (c.submissions || []).find((s: any) => (s.project_name || '').trim() === (found.title || '').trim());
            const ev = found.evaluation;
            const isGraded = !!((ev && ev.score !== null && ev.score !== undefined && !isNaN(Number(ev.score)) && Number(ev.score) > 0) || (found.score !== null && found.score !== undefined && !isNaN(Number(found.score)) && Number(found.score) > 0 && found.status === 'evaluated'));
            const score = isGraded ? (ev?.score ?? found.score) : null;
            const isSubmitted = isGraded || found.status === 'submitted' || found.status === 'evaluated' || !!sub || !!(ev?.photo_url);

            setSelectedProjectForView({
              ...found,
              courseId: c.courseId,
              courseName: c.courseName,
              academicYear: c.academicYear,
              instructorTitle: c.instructorTitle || "أستاذ المقرر",
              instructorName: c.instructorName,
              submission: sub,
              evaluation: ev,
              isGraded,
              isSubmitted,
              score
            });
            break;
          }
        }
      }
    }
  }, [dashboardData]);

  // Real-time camera quality & anti-shake analyzer loop (Throttled, No 60fps flicker)
  const startQualityAnalysisLoop = (mode: "2d" | "3d") => {
    if (frameAnalysisIntervalRef.current) {
      clearInterval(frameAnalysisIntervalRef.current);
      frameAnalysisIntervalRef.current = null;
    }
    if (gyroListenerRef.current) {
      window.removeEventListener("deviceorientation", gyroListenerRef.current);
      gyroListenerRef.current = null;
    }

    gyroActiveRef.current = false;
    isGyroLevelRef.current = true;
    gyroMessageRef.current = "";

    // Gyro fallback timer: if no sensor data received after 1800ms, do not block student
    const gyroTimer = setTimeout(() => {
      if (!gyroActiveRef.current) {
        isGyroLevelRef.current = true;
      }
    }, 1800);

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const beta = event.beta;
      const gamma = event.gamma;
      if (beta === null || gamma === null) return;

      gyroActiveRef.current = true;
      clearTimeout(gyroTimer);

      if (mode === "3d") {
        // 3D Sculpture: phone upright in front of the sculpture (|beta| ~ 90)
        const isUpright = Math.abs(Math.abs(beta) - 90) < 35 && Math.abs(gamma) < 40;
        isGyroLevelRef.current = isUpright;
        gyroMessageRef.current = isUpright ? "" : "📱 وجّه الهاتف عمودياً وثابتاً أمام المجسم";
      } else {
        // 2D Flat work: phone flat over table (|beta| < 35 & |gamma| < 35)
        // OR upright in front of easel/wall (|beta| ~ 90)
        const isFlat = Math.abs(beta) < 35 && Math.abs(gamma) < 35;
        const isUpright = Math.abs(Math.abs(beta) - 90) < 35 && Math.abs(gamma) < 40;
        const isOk = isFlat || isUpright;
        isGyroLevelRef.current = isOk;
        gyroMessageRef.current = isOk ? "" : "📱 وازِ الهاتف مع العمل الفني (أفقياً فوقه أو عمودياً أمامه)";
      }
    };

    gyroListenerRef.current = handleDeviceOrientation;
    window.addEventListener("deviceorientation", handleDeviceOrientation);

    // Frame evaluation run at steady 350ms interval (completely prevents screen tremor and battery drain)
    const checkFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;

      canvas.width = 120;
      canvas.height = 90;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 120, 90);
      const imgData = ctx.getImageData(0, 0, 120, 90);
      const data = imgData.data;

      // 1. Average Brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }
      const avgBrightness = totalBrightness / (data.length / 4);

      // 2. Sharpness / Variance check
      let variance = 0;
      for (let i = 0; i < data.length - 8; i += 8) {
        variance += Math.abs(data[i] - data[i + 4]);
      }
      const avgVariance = variance / (data.length / 8);

      let quality: "good" | "dark" | "shaky" = "good";
      let message = "✅ الوضعية ممتازة وثابتة — اضغط زر الالتقاط 📸";
      let frameColor = "#10b981"; // Green
      let isReady = true;

      if (avgBrightness < 28) {
        quality = "dark";
        frameColor = "#ef4444";
        message = "🌙 الإضاءة ضعيفة — اقترب من مصدر إضاءة أو شغّل الفلاش 🔦";
        isReady = false;
      } else if (avgVariance < 3.2) {
        quality = "shaky";
        frameColor = "#f59e0b";
        message = "⚡ الصورة غير واضحة أو مهتزة — ثبّت يدك جيداً";
        isReady = false;
      } else if (gyroActiveRef.current && !isGyroLevelRef.current) {
        quality = "shaky";
        frameColor = "#f59e0b";
        message = gyroMessageRef.current || "يرجى وزن وضعية الهاتف أمام العمل الفني";
        isReady = false;
      }

      // ONLY trigger React re-render when state changes!
      if (
        lastFrameStateRef.current.isReady !== isReady ||
        lastFrameStateRef.current.quality !== quality ||
        lastFrameStateRef.current.frameColor !== frameColor ||
        lastFrameStateRef.current.message !== message
      ) {
        const nextState = { quality, orientationMatches: true, message, frameColor, isReady };
        lastFrameStateRef.current = nextState;
        setCameraFrameState(nextState);
      }
    };

    frameAnalysisIntervalRef.current = setInterval(checkFrame, 350);
  };

  // Start Camera Stream (Live Camera Only)
  const startCamera = async (type: "id" | "artwork", mode: "2d" | "3d" = "2d") => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (type === "id") {
        setShowIdCamera(true);
        setTempIdCardPreview(null);
      } else {
        setShowArtworkCamera(true);
        startQualityAnalysisLoop(mode);
      }

      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.log("video play err:", e));
      }
    } catch (err) {
      console.warn("Camera getUserMedia error:", err);
      if (type === "id") {
        idFileInputRef.current?.click();
      } else {
        alert("⚠️ تنبيه أمني: يشترط النظام التقاط الصورة مباشرة عبر كاميرا الهاتف لتوثيق أعمال الطلاب ومنع استخدام صور سابقة أو منتحلة. يرجى تفعيل إذن الكاميرا في متصفحك والمحاولة مرة أخرى.");
        setShowArtworkCamera(false);
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (frameAnalysisIntervalRef.current) {
      clearInterval(frameAnalysisIntervalRef.current);
      frameAnalysisIntervalRef.current = null;
    }
    if (gyroListenerRef.current) {
      window.removeEventListener("deviceorientation", gyroListenerRef.current);
      gyroListenerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities: any = track.getCapabilities?.() || {};
        if (capabilities.torch) {
          const nextState = !torchOn;
          await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
          setTorchOn(nextState);
        } else {
          alert("كشاف الفلاش غير مدعوم على هذه الكاميرا في هذا المتصفح.");
        }
      } catch (e) {
        console.warn("Torch error:", e);
      }
    }
  };

  // Capture Single Photo Frame from Video
  const captureVideoFrame = (): string | null => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  // Snap Artwork Photo (Multi-photo support, Live Only, Always responsive)
  const handleSnapArtworkPhoto = async () => {
    const rawData = captureVideoFrame();
    if (!rawData) {
      alert("تعذر التقاط الصورة من تدفق الكاميرا، يرجى المحاولة مرة أخرى.");
      return;
    }

    // Shutter haptics
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(80); } catch(e) {}
    }

    // Trigger visual shutter flash
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 120);

    try {
      const compressed = await compressImageToWebP(rawData, 1280, 0.85);
      const newPhoto = {
        url: compressed.dataUrl,
        dhash: compressed.dhash,
        width: compressed.width,
        height: compressed.height,
        orientation: orientationFrame,
        step: currentPhotoStep
      };

      const nextList = [...capturedPhotos, newPhoto];
      setCapturedPhotos(nextList);

      if (nextList.length < requiredPhotosCount) {
        setCurrentPhotoStep(nextList.length + 1);
      } else {
        // All required photos captured! Close camera & open review modal immediately!
        stopCamera();
        setShowArtworkCamera(false);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء معالجة وضغط الصورة");
    }
  };

  // Submit Artwork Photos to API (Connected with Telegram & Supabase Evaluations)
  const handleSubmitArtwork = async () => {
    if (!currentStudent || !activeProjectForUpload) return;
    const courseId = activeProjectForUpload.courseId || selectedCourseForEval?.courseId;
    const courseName = activeProjectForUpload.courseName || selectedCourseForEval?.courseName;
    if (!courseId) {
      alert("بيانات المقرر غير مكتملة");
      return;
    }
    if (capturedPhotos.length < requiredPhotosCount) {
      alert(`المشروع يتطلب التقاط ${requiredPhotosCount} صور لتوثيق العمل، قمت بالتقاط ${capturedPhotos.length} فقط!`);
      return;
    }

    setUploadingProject(true);
    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const projTitle = (activeProjectForUpload.title || activeProjectForUpload.name || '').trim();
      const isMulti = !!activeProjectForUpload.multiStageEnabled;
      const stageTitle = isMulti
        ? (activeUploadStage === 'stage2' ? activeProjectForUpload.stage2Title : activeProjectForUpload.stage1Title)
        : undefined;

      const res = await fetch("/api/students/submit-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          course_id: courseId,
          course_name: courseName,
          project_name: projTitle,
          images: capturedPhotos,
          device_info: deviceInfo,
          stage: isMulti ? activeUploadStage : undefined,
          stage_title: stageTitle
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "فشل رفع المشروع إلى السحابة");
      } else {
        // كائن التسليم الجديد للتحديث اللحظي المباشر في الواجهة
        const isStage2 = isMulti && activeUploadStage === 'stage2';
        const newSubObj = data.submission || {
          id: "sub_" + Date.now(),
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          course_id: courseId,
          course_name: courseName,
          project_name: projTitle,
          images: capturedPhotos.map((p: any) => ({ url: p.url || p.dataUrl || p, stage: activeUploadStage, stage_title: stageTitle })),
          status: "pending_evaluation",
          score: null,
          created_at: new Date().toISOString()
        };

        // 1. تحديث فوري لكائن المشروع المفتوح إن وجد
        setSelectedProjectForView((prev: any) => {
          if (!prev) return prev;
          if ((prev.title || '').trim() === projTitle) {
            const isFullyDone = isMulti ? isStage2 : true;
            return {
              ...prev,
              status: isFullyDone ? "submitted" : "partially_submitted",
              isSubmitted: true,
              hasStage1Image: true,
              hasStage2Image: isStage2,
              isFullySubmitted: isFullyDone,
              isGraded: false,
              score: null,
              submission: newSubObj
            };
          }
          return prev;
        });

        // 2. تحديث فوري لكائن المقرر المختار إن وجد
        setSelectedCourseForEval((prev: any) => {
          if (!prev) return prev;
          const oldSubs = (prev.submissions || []).filter((s: any) => (s.project_name || '').trim() !== projTitle);
          const updatedSubs = [newSubObj, ...oldSubs];
          const updatedAssigned = (prev.assignedProjects || []).map((p: any) => {
            if ((p.title || '').trim() === projTitle) {
              return { ...p, status: "submitted", submission: newSubObj };
            }
            return p;
          });
          return {
            ...prev,
            submissions: updatedSubs,
            assignedProjects: updatedAssigned
          };
        });

        // 3. تحديث فوري لبيانات لوحة الطالب dashboardData
        setDashboardData((prevData: any) => {
          if (!prevData || !prevData.projects) return prevData;
          return {
            ...prevData,
            projects: prevData.projects.map((c: any) => {
              if (c.courseId === courseId) {
                const oldSubs = (c.submissions || []).filter((s: any) => (s.project_name || '').trim() !== projTitle);
                const updatedSubs = [newSubObj, ...oldSubs];
                const updatedAssigned = (c.assignedProjects || []).map((p: any) => {
                  if ((p.title || '').trim() === projTitle) {
                    return { ...p, status: "submitted", submission: newSubObj };
                  }
                  return p;
                });
                return {
                  ...c,
                  submissions: updatedSubs,
                  assignedProjects: updatedAssigned
                };
              }
              return c;
            })
          };
        });

        // 4. تثبيت التاب النشط على المشروع المرفوع
        setSelectedProjectTab(projTitle);

        setShowArtworkCamera(false);
        setCapturedPhotos([]);
        setCurrentPhotoStep(1);
        setActiveProjectForUpload(null);

        alert("✓ تم تسليم العمل الفني بنجاح!\nالعمل الآن محفوظ في تبويب المشروع وبانتظار رصد الدرجة من أستاذ المقرر.");

        // 5. مزامنة البيانات في الخلفية
        loadDashboard(currentStudent.student_code);
      }
    } catch (e: any) {
      alert("خطأ أثناء رفع المشروع: " + e.message);
    } finally {
      setUploadingProject(false);
    }
  };

  // Open Smart Camera for a specific Assigned Project (Strict Live Camera)
  const handleOpenSmartCameraForProject = (proj: any, targetStage?: 'stage1' | 'stage2') => {
    setActiveProjectForUpload(proj);
    const stageToUpload = targetStage || (proj.multiStageEnabled && proj.hasStage1Image ? 'stage2' : 'stage1');
    setActiveUploadStage(stageToUpload);
    const mode: "2d" | "3d" = (proj.cameraMode || proj.camera_mode) === "3d" ? "3d" : "2d";
    setCameraMode(mode);
    const reqPhotos = proj.requiredPhotos || proj.required_photos || (mode === "3d" ? 2 : 1);
    setRequiredPhotosCount(reqPhotos);
    setCapturedPhotos([]);
    setCurrentPhotoStep(1);

    const isLandscape = typeof window !== "undefined" && window.innerWidth > window.innerHeight;
    setOrientationFrame(isLandscape ? "landscape" : "portrait");

    startCamera("artwork", mode);
  };

  // Handle Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCode.trim()) {
      setErrorMsg("يرجى إدخال كود الطالب الجامعي");
      return;
    }
    if (!regMobile.trim()) {
      setErrorMsg("يرجى إدخال رقم الموبايل للتواصل");
      return;
    }
    if (!idCardPhoto) {
      setErrorMsg("يرجى تصوير أو إرفاق صورة بطاقة الرقم القومي أو كارنيه الكلية (إجباري لإتمام التسجيل)");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: regCode.trim(),
          full_name: regName.trim(),
          mobile: regMobile.trim(),
          id_card_image: idCardPhoto,
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyActive) {
          setAuthMode("login");
          setErrorMsg(data.error);
        } else {
          setErrorMsg(data.error || "فشل التسجيل");
        }
      } else {
        const registeredPin = data.student?.pin_code;
        setSuccessMsg(
          registeredPin
            ? `${data.message} رقمك السري للدخول: ${registeredPin} — احتفظ به ولا تشاركه مع أحد.`
            : data.message
        );
        const pendingSession = { ...data.student, status: "pending" };
        delete pendingSession.pin_code;
        setCurrentStudent(pendingSession);
        setAccountStatus("pending");
        fetchCoordinators(data.student.student_code);
        localStorage.setItem("fania_student_session", JSON.stringify(pendingSession));
        localStorage.setItem("fania_student_code", data.student.student_code);
        if (typeof window !== "undefined") {
          window.history.replaceState({}, '', window.location.pathname);
          localStorage.removeItem("fania_pending_reg_code");
          sessionStorage.removeItem("fania_prefetched_student");
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCode.trim()) {
      setErrorMsg("يرجى إدخال كود الطالب الجامعي");
      return;
    }
    if (!enteredPin.trim()) {
      setErrorMsg("يرجى إدخال الرقم السري الخاص بك");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: regCode.trim(),
          pin_code: enteredPin.trim(),
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.device_locked) {
          setErrorMsg(data.error || "هذا الحساب مقيّد بجهاز آخر. يرجى التوجه إلى منسقك لفك القيد.");
        } else {
          setErrorMsg(data.error || "بيانات الدخول غير صحيحة");
        }
      } else {
        const safeSession = {
          ...data.student,
          status: "active",
          is_pin_used: true
        };
        setCurrentStudent(safeSession);
        setAccountStatus("active");
        localStorage.setItem("fania_student_session", JSON.stringify(safeSession));
        localStorage.setItem("fania_student_code", data.student.student_code);
        if (data.token) localStorage.setItem("fania_student_token", data.token);
        setEnteredPin("");
        setSuccessMsg("🎉 تم تسجيل الدخول بنجاح! مرحباً بك في منظومة فنية.");
        loadDashboard(data.student.student_code);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify PIN Submit (immediate session save without re-login)
  const handleVerifyPinSubmit = async () => {
    if (!enteredPin || !currentStudent) {
      setErrorMsg("يرجى إدخال الرقم السري الممنوح لك من المنسق");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const deviceInfo = getOrCreateDeviceInfo();
      const res = await fetch("/api/students/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          pin_code: enteredPin.trim(),
          device_info: deviceInfo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "الرقم السري غير صحيح");
      } else {
        const updatedStudent = {
          ...currentStudent,
          ...(data.student || {}),
          status: "active",
          is_pin_used: true
        };
        delete (updatedStudent as any).pin_code;
        localStorage.setItem("fania_student_session", JSON.stringify(updatedStudent));
        if (data.token) localStorage.setItem("fania_student_token", data.token);
        setCurrentStudent(updatedStudent);
        setAccountStatus("active");
        setEnteredPin("");
        setSuccessMsg("تم تفعيل حسابك بنجاح! جاري تحميل مقرراتك وحضورك...");
        loadDashboard(updatedStudent.student_code);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "خطأ أثناء التحقق من الرقم السري");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('student-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${currentStudent?.student_code}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Handle Logout
  const handleLogout = () => {
    const doLogoutRequest = () => fetch("/api/students/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    let pushTok = "";
    try { pushTok = localStorage.getItem("fania_push_token") || ""; localStorage.removeItem("fania_push_token"); localStorage.removeItem("fania_student_token"); } catch (e) {}
    if (pushTok) {
      // احذف رمز الجهاز قبل مسح الجلسة حتى لا تصل إشعارات الحساب السابق
      fetch("/api/students/push-token", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ token: pushTok }) })
        .catch(() => {})
        .finally(doLogoutRequest);
    } else {
      doLogoutRequest();
    }
    localStorage.removeItem("fania_student_session");
    localStorage.removeItem("fania_student_code");
    localStorage.removeItem("fania_pending_reg_code");
    localStorage.removeItem("fania_cached_dashboard_data");
    localStorage.removeItem("fania_last_sync_time");
    setCurrentStudent(null);
    setAccountStatus(null);
    setDashboardData(null);
    setSelectedCourseForEval(null);
    setEnteredPin("");
    setRegCode("");
    setRegMobile("");
    setAuthMode("login");
  };

  // Handle Complaint Submit
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) return;

    setSubmittingComplaint(true);
    setComplaintSuccessMsg("");
    try {
      const res = await fetch("/api/students/complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_code: currentStudent.student_code,
          student_name: currentStudent.full_name,
          academic_year: currentStudent.academic_year,
          target_entity: complaintTarget,
          subject: `شكوى/مقترح طلابي موجه إلى: ${complaintTarget}`,
          content: complaintText.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setComplaintSuccessMsg("✅ تم إرسال شكوتك بنجاح. سوف يتم مراجعتها والرد عليك قريباً. يرجى متابعة هذا القسم للاطلاع على الرد فور اعتماده.");
        setComplaintText("");
        loadDashboard(currentStudent.student_code);
      } else {
        alert(data.error || "تعذر إرسال الشكوى");
      }
    } catch (e: any) {
      alert("خطأ في الإرسال: " + e.message);
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // ==========================================
  // ==========================================
  // ==========================================
  // VIEW 0: شاشة إشعار الترقية لتطبيق الأندرويد الجديد (Student Migration to Mobile App)
  // ==========================================
  if (showMigrationModal && migrationStudentData) {
    return (
      <StudentMigrationNotice
        student={migrationStudentData}
        apkDownloadUrl={apkInfo?.downloadUrl}
        apkVersion={apkInfo?.version}
        isTestMode={isTestMigrationMode}
        onContinueToWeb={() => {
          localStorage.setItem("fania_bypass_update_notice", "1");
          setShowMigrationModal(false);
          if (isTestMigrationMode && typeof window !== "undefined") {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
          }
        }}
        onSwitchStudentCode={(newCode) => {
          fetchMigrationInfo(newCode);
        }}
      />
    );
  }

  // VIEW 1: شاشة انتظار اعتماد المنسق (Pending Approval)
  // ==========================================
  if (currentStudent && accountStatus === "pending") {
    return (
      <div style={{ minHeight: "100vh", padding: "16px", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        
        {/* شريط أعلى به اسم الطالب وزر خروج مدمج */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          gap: "10px",
          padding: "10px 14px", 
          background: "#141b29", 
          borderRadius: "14px", 
          border: "1px solid #2a374f", 
          marginBottom: "16px" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
            <div style={{ width: "36px", height: "36px", minWidth: "36px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
              <UserCheck size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: "bold", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentStudent.full_name}</div>
              <div style={{ color: "#94a3b8", fontSize: "11px" }}>كود: {formatStudentCode(currentStudent.student_code)}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn-compact"
            title="تسجيل الخروج"
            style={{ 
              background: "rgba(239, 68, 68, 0.12)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "6px 12px",
              cursor: "pointer"
            }}
          >
            <LogOut size={13} />
            <span>خروج</span>
          </button>
        </div>

        {/* كارت انتظار اعتماد الهوية */}
        <div className="glass-card animate-fade-in" style={{ padding: "20px 16px", textAlign: "center", marginBottom: "16px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "12px", boxShadow: "0 0 20px rgba(245, 158, 11, 0.2)" }}>
            <ShieldCheck size={36} />
          </div>

          <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#ffffff", marginBottom: "8px", lineHeight: "1.3" }}>
            الحساب مسجل وبانتظار اعتماد المنسق ⏳
          </h2>

          <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.7", marginBottom: "16px" }}>
            أهلاً بك يا <b>{currentStudent.full_name}</b>. تم استلام بيانات تسجيلك وصورة بطاقتك بنجاح. لتفعيل حسابك، يرجى التوجه إلى منسق النظام لمطابقة الهوية وتفعيل الحساب:
          </p>

          {errorMsg && (
            <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "10px", borderRadius: "8px", marginBottom: "16px", fontSize: "12px" }}>
              ✓ {successMsg}
            </div>
          )}

          {/* قائمة المنسقين بالأسماء فقط بدون أي وصف أو صفة إضافية */}
          {coordinators.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
              {coordinators.slice(0, 2).map((c, idx) => (
                <div key={c.id || idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    background: "rgba(56, 189, 248, 0.12)",
                    border: "1px solid #38bdf8",
                    padding: "10px 18px",
                    borderRadius: "12px",
                    color: "#38bdf8",
                    fontWeight: "bold",
                    fontSize: "14px",
                    boxShadow: "0 2px 10px rgba(56, 189, 248, 0.15)"
                  }}>
                    👤 {c.full_name}
                  </div>
                  {idx < Math.min(coordinators.length, 2) - 1 && (
                    <span style={{ color: "#94a3b8", fontSize: "13px", fontWeight: "bold" }}>أو</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px dashed #38bdf8", padding: "10px 16px", borderRadius: "10px", color: "#38bdf8", fontWeight: "bold", fontSize: "13px", display: "inline-block", marginBottom: "18px" }}>
              👤 منسق النظام المعتمد
            </div>
          )}

          {/* مؤشر الفحص التلقائي الحي */}
          <div style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "16px",
            textAlign: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#34d399", fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
              <span>جاري التحقق من التفعيل تلقائياً...</span>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
              بمجرد أن يقوم المنسق بمطابقة بياناتك واعتماد حسابك، ستظهر لك شاشة الدخول لإدخال رقمك السري وفتح لوحة تحكمك ومقرراتك.
            </p>
          </div>

          {/* زر الفحص والتحديث اليدوي الفوري المباشر */}
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const devInfo = getOrCreateDeviceInfo();
                const res = await fetch(`/api/students/lookup?code=${encodeURIComponent(currentStudent.student_code)}&deviceId=${encodeURIComponent(devInfo.deviceId)}&_t=${Date.now()}`);
                const data = await res.json();
                if (data.isAlreadyActive) {
                  localStorage.removeItem("fania_student_session");
                  localStorage.removeItem("fania_student_code");
                  const approvedCode = currentStudent.student_code;
                  setCurrentStudent(null);
                  setAccountStatus(null);
                  setRegCode(approvedCode);
                  setEnteredPin("");
                  setAuthMode("login");
                  if (typeof window !== "undefined") {
                    window.history.replaceState({}, '', window.location.pathname);
                  }
                  setSuccessMsg("🎉 تم اعتماد حسابك بنجاح! يرجى إدخال الرقم السري لتسجيل الدخول.");
                } else if (data.isNew) {
                  localStorage.removeItem("fania_student_session");
                  setCurrentStudent(null);
                  setAccountStatus(null);
                  setAuthMode("register");
                  setErrorMsg("⚠️ تم إعادة تعيين بيانات التسجيل من قبل المنسق. يرجى إعادة إدخال بياناتك بشكل صحيح.");
                } else {
                  alert("الحساب ما زال بانتظار اعتماد المنسق. بمجرد أن يعتمد المنسق حسابك، ستظهر لك شاشة الدخول بالرقم السري.");
                }
              } catch(e) {
                alert("تعذر التحقق من حالة الاتصال حالياً.");
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              border: "none",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)"
            }}
          >
            <RotateCw size={16} className={loading ? "animate-spin" : ""} />
            <span>تحديث حالة الاعتماد الآن (دخول فوري) 🔄</span>
          </button>

          {/* خيار يدوي لإدخال الرقم السري (PIN) */}
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            {!showManualPinBox ? (
              <button
                type="button"
                className="btn-compact"
                onClick={() => setShowManualPinBox(true)}
                style={{
                  background: "rgba(51, 65, 85, 0.4)",
                  border: "1px dashed #475569",
                  borderRadius: "8px",
                  color: "#94a3b8",
                  fontSize: "12px",
                  padding: "8px 14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                <KeyRound size={14} color="#f59e0b" />
                <span>لديك رمز PIN يدوي من المنسق؟ اضغط هنا لكتابته</span>
              </button>
            ) : (
              <div style={{
                background: "rgba(15, 23, 42, 0.9)",
                border: "1.5px solid #3b82f6",
                borderRadius: "14px",
                padding: "16px",
                textAlign: "right",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", borderBottom: "1px solid #1e293b", paddingBottom: "8px" }}>
                  <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                    <KeyRound size={16} color="#fbbf24" />
                    <span>إدخال رمز التفعيل اليدوي (PIN)</span>
                  </div>
                  <button
                    type="button"
                    className="btn-compact"
                    onClick={() => { setShowManualPinBox(false); setEnteredPin(""); }}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "none",
                      color: "#94a3b8",
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                  >
                    إلغاء ✕
                  </button>
                </div>

                <p style={{ color: "#94a3b8", fontSize: "11px", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                  إذا سلمك المنسق رمز PIN ورقياً، أدخله هنا لتفعيل حسابك فوراً:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="رمز PIN المكون من 6 أرقام..."
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyPinSubmit()}
                    style={{
                      width: "100%",
                      height: "46px",
                      padding: "0 14px",
                      background: "#090d16",
                      border: "1.5px solid #2563eb",
                      borderRadius: "10px",
                      color: "#fbbf24",
                      fontSize: "16px",
                      fontWeight: "bold",
                      textAlign: "center",
                      letterSpacing: "4px",
                      boxSizing: "border-box",
                      margin: 0,
                      outline: "none"
                    }}
                  />

                  <button
                    type="button"
                    className="btn-compact"
                    onClick={handleVerifyPinSubmit}
                    disabled={loading || !enteredPin.trim()}
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "0 16px",
                      background: (!enteredPin.trim() || loading) 
                        ? "#1e293b" 
                        : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      color: (!enteredPin.trim() || loading) ? "#64748b" : "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: (!enteredPin.trim() || loading) ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxSizing: "border-box",
                      margin: 0,
                      boxShadow: (!enteredPin.trim() || loading) ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)"
                    }}
                  >
                    <span>تفعيل الحساب بالرمز 🔓</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: "center", color: "#64748b", fontSize: "11px", marginBottom: "10px" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: شاشة لوحة بيانات الطالب المفعل (Active Student Dashboard)
  // ==========================================
  if (currentStudent && accountStatus === "active") {
    return (
      <div style={{ minHeight: "100vh", padding: "10px 14px", maxWidth: "550px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        
        {/* شريط وضع تصفح الإدارة العائم */}
        {isImpersonating && (
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            background: "linear-gradient(135deg, #b91c1c, #991b1b)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: "12px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
            fontSize: "12px",
            fontWeight: "bold",
            border: "1px solid #ef4444"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span>👑</span>
              <span>وضع تصفح الإدارة — حساب: {currentStudent.full_name} ({formatStudentCode(currentStudent.student_code)})</span>
            </div>
            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = "/";
                }
              }}
              className="btn-compact"
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.4)",
                padding: "4px 8px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "bold"
              }}
            >
              الرجوع للوحة الإدارة ✕
            </button>
          </div>
        )}

        {/* شريط حالة الاتصال ومزامنة البيانات (Telecom-style Offline/Sync Banner) */}
        {isOffline ? (
          <div style={{
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.16), rgba(217, 119, 6, 0.12))",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "14px",
            padding: "9px 13px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#fbbf24",
            boxShadow: "0 2px 10px rgba(0,0,0,0.25)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>📡</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "12px" }}>أنت غير متصل بالإنترنت</div>
                <div style={{ fontSize: "10px", color: "rgba(251, 191, 36, 0.85)" }}>تتصفح البيانات المحفوظة محلياً على جهازك</div>
              </div>
            </div>
            {lastSyncTime && (
              <div style={{
                textAlign: "left",
                fontSize: "10.5px",
                color: "#fef3c7",
                background: "rgba(0,0,0,0.3)",
                padding: "4px 8px",
                borderRadius: "8px",
                border: "1px solid rgba(245, 158, 11, 0.2)"
              }}>
                <span style={{ opacity: 0.8 }}>آخر تحديث: </span>
                <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block", fontWeight: 600 }}>{lastSyncTime}</span>
              </div>
            )}
          </div>
        ) : lastSyncTime ? (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            marginBottom: "6px",
            fontSize: "10.5px",
            color: "#64748b"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
              <span style={{ color: "#94a3b8" }}>متصل بالخادم</span>
            </div>
            <div style={{ fontFamily: "monospace", direction: "ltr" }}>
              آخر مزامنة: {lastSyncTime}
            </div>
          </div>
        ) : null}

        {/* شريط أعلى منظم: دائرة الحساب، اسم الطالب وكوده بوضوح، وأزرار التحكم الثلاثة */}
        <div className="student-top-bar">
          {/* قسم بيانات وهوية الطالب ودائرة الحساب */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, width: "100%" }}>
            {/* الدائرة المخصصة للحساب: تعرض الصورة الشخصية النقية بعد الالتقاط وتختفي علامة + تلقائياً */}
            <div 
              onClick={handleOpenSelfieModal}
              style={{ 
                position: "relative", 
                cursor: "pointer", 
                flexShrink: 0,
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: (currentStudent?.avatar_url || currentStudent?.photo_url)
                  ? "#0f172a"
                  : "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                border: (currentStudent?.avatar_url || currentStudent?.photo_url)
                  ? "2px solid #38bdf8"
                  : "2.5px solid #10b981",
                boxShadow: (currentStudent?.avatar_url || currentStudent?.photo_url)
                  ? "0 2px 8px rgba(0, 0, 0, 0.4)"
                  : "0 0 10px rgba(16, 185, 129, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                transition: "transform 0.15s ease"
              }}
              title={currentStudent?.avatar_url || currentStudent?.photo_url ? "صورتك الشخصية (اضغط لتغييرها) 📷" : "اضغط هنا لالتقاط صورتك الشخصية 📷"}
            >
              {currentStudent?.avatar_url || currentStudent?.photo_url ? (
                <img 
                  src={currentStudent.avatar_url || currentStudent.photo_url} 
                  alt={currentStudent.full_name || "صورة الطالب"} 
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                />
              ) : (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                  color: "#ffffff",
                  fontSize: "30px",
                  fontWeight: "900",
                  lineHeight: 1,
                  userSelect: "none"
                }}>
                  +
                </div>
              )}
            </div>

            {/* الاسم الكامل والكود والفرقة بحجم متناسق ومصغر مع شاشات الهواتف */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div 
                style={{ 
                  color: "#ffffff", 
                  fontWeight: "bold", 
                  fontSize: "13px", 
                  lineHeight: "1.25",
                  letterSpacing: "-0.2px",
                  wordBreak: "break-word"
                }}
                title={currentStudent.full_name}
              >
                {currentStudent.full_name}
              </div>
              <div style={{ 
                color: "#38bdf8", 
                fontSize: "10.5px", 
                display: "flex", 
                alignItems: "center", 
                gap: "4px", 
                flexWrap: "wrap",
                marginTop: "2px",
                lineHeight: "1.2"
              }}>
                <span style={{ fontWeight: "700" }}>كود: {formatStudentCode(currentStudent.student_code)}</span>
                {currentStudent.academic_year && (
                  <>
                    <span style={{ opacity: 0.35 }}>•</span>
                    <span style={{ color: "#94a3b8" }}>{currentStudent.academic_year}</span>
                  </>
                )}
                {currentStudent.section && (
                  <>
                    <span style={{ opacity: 0.35 }}>•</span>
                    <span style={{ color: "#cbd5e1" }}>سكشن {currentStudent.section}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* مجموعة أزرار التحكم الثلاثة: متساوية العرض والارتفاع تماماً 1fr 1fr 1fr */}
          <div 
            className="student-actions-group"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
              width: "100%",
              marginTop: "4px"
            }}
          >
            {/* زر رمز QR */}
            <button 
              onClick={() => setShowQRModal(true)} 
              className="btn-compact"
              title="عرض رمز QR الذكي الخاص بي"
              style={{ 
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: "bold",
                height: "32px",
                width: "100%",
                padding: "0 2px",
                whiteSpace: "nowrap"
              }}
            >
              <QrCode size={13} />
              <span>رمز QR</span>
            </button>

            {/* زر التحديث */}
            <button 
              onClick={() => loadDashboard(currentStudent.student_code)} 
              className="btn-compact"
              disabled={loading}
              title="تحديث البيانات فورياً"
              style={{ 
                background: "rgba(56, 189, 248, 0.12)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: "bold",
                height: "32px",
                width: "100%",
                padding: "0 2px",
                whiteSpace: "nowrap"
              }}
            >
              <RotateCw size={13} className={loading ? "animate-spin" : ""} />
              <span>تحديث</span>
            </button>

            {/* زر الخروج */}
            <button 
              onClick={handleLogout} 
              className="btn-compact"
              title="تسجيل الخروج من الحساب"
              style={{ 
                background: "rgba(239, 68, 68, 0.12)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: "bold",
                height: "32px",
                width: "100%",
                padding: "0 2px",
                whiteSpace: "nowrap"
              }}
            >
              <LogOut size={13} />
              <span>تسجيل خروج</span>
            </button>
          </div>
        </div>

        {/* شريط الوصول السريع لبيانات تطبيق الأندرويد الجديد (كود الدخول وكلمة المرور) */}
        {migrationStudentData && (
          <div 
            onClick={() => setShowMigrationModal(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(168, 85, 247, 0.12))',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '8px 12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📱</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>تطبيق الأندرويد الجديد متاح الآن</div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>اضغط هنا لعرض كودك وكلمة المرور الخاصة بك وتحميل التطبيق</div>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: 'bold', background: 'rgba(168, 85, 247, 0.2)', padding: '3px 8px', borderRadius: '6px' }}>عرض البيانات ↗</span>
          </div>
        )}

        {/* تابات التنقل الرئيسية لشاشة الطالب (4 تابات متساوية العرض تماماً تغطي كامل الشاشة) */}
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: `repeat(${dashboardData?.hide_warnings_tab ? 3 : 4}, 1fr)`, 
            gap: "4px", 
            marginBottom: "12px",
            width: "100%"
          }}
        >
          {[
            { id: "evaluation", label: "المشاريع 🎨", color: "#10b981", badge: unreadProjectsCount },
            { id: "attendance", label: "الحضور 📅", color: "#38bdf8", badge: unreadAttendanceCount },
            ...(!dashboardData?.hide_warnings_tab ? [{ id: "warnings", label: "الإنذارات ⚠️", color: "#ef4444", badge: unreadWarningsCount }] : []),
            { id: "lockers", label: "الدواليب 🗄️", color: "#a855f7", badge: unreadLockersCount }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === "attendance") markAttendanceAsSeen();
                  if (tab.id === "warnings") markWarningsAsSeen();
                  if (tab.id === "lockers") markLockerAsSeen();
                  if (tab.id !== "evaluation") {
                    setSelectedProjectForView(null);
                    setSelectedCourseForEval(null);
                  }
                }}
                className="btn-compact"
                style={{
                  width: "100%",
                  padding: "7px 2px",
                  borderRadius: "8px",
                  border: isActive ? `1px solid ${tab.color}` : "1px solid rgba(255,255,255,0.08)",
                  background: isActive ? `${tab.color}22` : "rgba(255,255,255,0.03)",
                  color: isActive ? "#fff" : "#94a3b8",
                  fontWeight: isActive ? "bold" : "normal",
                  fontSize: "11px",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  lineHeight: "1.2"
                }}
              >
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span 
                    title={`${tab.badge} جديد`}
                    style={{
                      position: "absolute",
                      top: "-7px",
                      left: "-2px",
                      background: "#ef4444",
                      color: "#fff",
                      borderRadius: "999px",
                      minWidth: "19px",
                      height: "19px",
                      padding: "0 4px",
                      fontSize: "10px",
                      fontWeight: "900",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 10px rgba(239, 68, 68, 0.85), 0 2px 4px rgba(0,0,0,0.5)",
                      border: "2px solid #0b1120",
                      zIndex: 10,
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }}
                  >
                    {tab.badge > 99 ? "+99" : tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: EVALUATION & PROJECTS (شبكة كروت المشاريع والتسليم المباشر) */}
        {/* ========================================================= */}
        {activeTab === "evaluation" && (
          <div className="animate-fade-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            
            {/* 1.1 عندما لا يكون هناك مشروع مفتوح: عرض شبكة كروت المشاريع */}
            {!selectedProjectForView ? (
              <div>

                {/* شريط الفلترة حسب المقرر إن وُجد أكثر من مقرر */}
                {dashboardData?.projects?.length > 1 && (
                  <div 
                    className="no-scrollbar"
                    style={{ 
                      display: "flex", 
                      gap: "6px", 
                      overflowX: "auto", 
                      paddingBottom: "10px", 
                      marginBottom: "12px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    <button
                      onClick={() => setProjectCourseFilter("all")}
                      className="btn-compact"
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        border: projectCourseFilter === "all" ? "1px solid #38bdf8" : "1px solid #2a374f",
                        background: projectCourseFilter === "all" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.03)",
                        color: projectCourseFilter === "all" ? "#fff" : "#94a3b8",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span>كافة المقررات ({allStudentProjects.length})</span>
                      {unreadProjectsCount > 0 && (
                        <span style={{
                          background: "#ef4444",
                          color: "#fff",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          padding: "1px 6px"
                        }}>
                          {unreadProjectsCount}
                        </span>
                      )}
                    </button>
                    {dashboardData.projects.map((c: any) => {
                      const courseUnread = allStudentProjects.filter((p: any) => {
                        if (p.courseId !== c.courseId) return false;
                        const k = `${p.courseId}_${p.title || p.id}`;
                        const r = seenNotifications.seenProjects?.[k];
                        if (!r) return true;
                        if (p.isGraded) {
                          const ss = r.seenScore;
                          if (ss === undefined || ss === null || Number(ss) !== Number(p.score)) return true;
                        }
                        return false;
                      }).length;

                      return (
                        <button
                          key={c.courseId}
                          onClick={() => setProjectCourseFilter(c.courseId)}
                          className="btn-compact"
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            border: projectCourseFilter === c.courseId ? "1px solid #10b981" : "1px solid #2a374f",
                            background: projectCourseFilter === c.courseId ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.03)",
                            color: projectCourseFilter === c.courseId ? "#fff" : "#94a3b8",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <span>{c.courseName}</span>
                          {c.instructorTitle && (
                            <span style={{ fontSize: "10.5px", opacity: 0.8, fontWeight: "normal" }}>({c.instructorTitle})</span>
                          )}
                          {courseUnread > 0 && (
                            <span style={{
                              background: "#ef4444",
                              color: "#fff",
                              borderRadius: "999px",
                              fontSize: "10px",
                              fontWeight: "bold",
                              padding: "1px 6px",
                              boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)"
                            }}>
                              {courseUnread}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* شريط التبويب: المشروعات المطلوبة / المشروعات المُسلَّمة */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                  <button
                    onClick={() => setProjectSubTab("required")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      border: projectSubTab === "required" ? "2px solid #38bdf8" : "1px solid #2a374f",
                      background: projectSubTab === "required" ? "rgba(56, 189, 248, 0.16)" : "#141b29",
                      color: projectSubTab === "required" ? "#38bdf8" : "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    <span>⏳ المشروعات المطلوبة</span>
                    <span style={{
                      background: projectSubTab === "required" ? "#0284c7" : "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontWeight: "bold"
                    }}>
                      {requiredProjects.length}
                    </span>
                    {unreadRequiredCount > 0 && (
                      <span style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: "999px",
                        minWidth: "16px",
                        height: "16px",
                        padding: "0 4px",
                        fontSize: "9px",
                        fontWeight: "900",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 8px rgba(239, 68, 68, 0.8)",
                        border: "1.5px solid #0b1120",
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                      }}>
                        {unreadRequiredCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setProjectSubTab("submitted")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      border: projectSubTab === "submitted" ? "2px solid #10b981" : "1px solid #2a374f",
                      background: projectSubTab === "submitted" ? "rgba(16, 185, 129, 0.16)" : "#141b29",
                      color: projectSubTab === "submitted" ? "#34d399" : "#94a3b8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative"
                    }}
                  >
                    <span>✅ المشروعات المُسلَّمة</span>
                    <span style={{
                      background: projectSubTab === "submitted" ? "#059669" : "rgba(255,255,255,0.1)",
                      color: "#fff",
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontWeight: "bold"
                    }}>
                      {submittedProjects.length}
                    </span>
                    {unreadSubmittedCount > 0 && (
                      <span style={{
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: "999px",
                        minWidth: "16px",
                        height: "16px",
                        padding: "0 4px",
                        fontSize: "9px",
                        fontWeight: "900",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 8px rgba(239, 68, 68, 0.8)",
                        border: "1.5px solid #0b1120",
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                      }}>
                        {unreadSubmittedCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* شبكة كروت المشاريع */}
                {displayedProjects.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
                    {displayedProjects.map((proj: any) => {
                      const projKey = `${proj.courseId}_${proj.title || proj.id}`;
                      const seenRec = seenNotifications.seenProjects?.[projKey];
                      const isNewProject = !seenRec;
                      const hasNewGrade = proj.isGraded && (seenRec?.seenScore === undefined || seenRec?.seenScore === null || Number(seenRec?.seenScore) !== Number(proj.score));
                      const isCardUnread = isNewProject || hasNewGrade;

                      const activeDeadline = proj.multiStageEnabled
                        ? (!proj.hasStage1Image ? (proj.stage1Deadline || proj.submissionDeadline) : (!proj.hasStage2Image ? (proj.stage2Deadline || proj.submissionDeadline) : null))
                        : (!proj.isSubmitted ? proj.submissionDeadline : null);

                      const countdown = formatRemainingTime(activeDeadline);

                      return (
                        <div
                          key={`${proj.courseId}_${proj.id || proj.title}`}
                          onClick={() => handleSelectProjectForView(proj)}
                          style={{
                            background: "#141b29",
                            border: isCardUnread 
                              ? "2px solid #ef4444" 
                              : (proj.isGraded ? "1px solid rgba(239, 68, 68, 0.6)" : "1px solid #2a374f"),
                            boxShadow: isCardUnread ? "0 0 16px rgba(239, 68, 68, 0.35)" : "none",
                            borderRadius: "12px",
                            padding: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            position: "relative"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = isCardUnread ? "#f87171" : "#38bdf8";
                            e.currentTarget.style.transform = "translateY(-2px)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isCardUnread ? "#ef4444" : (proj.isGraded ? "rgba(239, 68, 68, 0.6)" : "#2a374f");
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
                        >
                          {/* شارة إشعار غير مقروء لكارت المشروع */}
                          {isCardUnread && (
                            <div style={{
                              position: "absolute",
                              top: "-9px",
                              left: "14px",
                              background: "#ef4444",
                              color: "#fff",
                              padding: "2px 9px",
                              borderRadius: "999px",
                              fontSize: "10px",
                              fontWeight: "900",
                              boxShadow: "0 0 10px rgba(239, 68, 68, 0.85)",
                              border: "2px solid #0b1120",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              zIndex: 4,
                              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                            }}>
                              <span style={{ fontSize: "8px" }}>🔴</span>
                              <span>{hasNewGrade ? `درجة جديدة: ${proj.score}` : "مشروع جديد"}</span>
                            </div>
                          )}
                          {/* رأس الكارت: اسم المشروع وحالة الرفع والمؤقت */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13.5px", lineHeight: "1.3" }}>
                              🎨 {proj.title}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                              {/* شارة حالة الرفع */}
                              <span style={{
                                flexShrink: 0,
                                fontSize: "11px",
                                fontWeight: "bold",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: proj.multiStageEnabled 
                                  ? (proj.hasStage1Image && proj.hasStage2Image ? "rgba(16, 185, 129, 0.18)" : proj.hasStage1Image ? "rgba(56, 189, 248, 0.18)" : "rgba(245, 158, 11, 0.18)")
                                  : (proj.isSubmitted ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)"),
                                color: proj.multiStageEnabled
                                  ? (proj.hasStage1Image && proj.hasStage2Image ? "#34d399" : proj.hasStage1Image ? "#38bdf8" : "#fbbf24")
                                  : (proj.isSubmitted ? "#34d399" : "#fbbf24"),
                                border: `1px solid ${
                                  proj.multiStageEnabled
                                    ? (proj.hasStage1Image && proj.hasStage2Image ? "rgba(16, 185, 129, 0.4)" : proj.hasStage1Image ? "rgba(56, 189, 248, 0.4)" : "rgba(245, 158, 11, 0.4)")
                                    : (proj.isSubmitted ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)")
                                }`
                              }}>
                                {proj.multiStageEnabled
                                  ? (proj.hasStage1Image && proj.hasStage2Image ? "✅ مرحلتين مكتملتين" : proj.hasStage1Image ? "1️⃣ بانتظار المرحلة 2" : "⏳ بانتظار المرحلة 1")
                                  : (proj.isSubmitted ? "✅ تم الرفع" : "⏳ بانتظار الرفع")}
                              </span>

                              {/* عداد التنازلي للرفع */}
                              {countdown.text && !proj.isFullySubmitted && (
                                <span style={{
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: countdown.isExpired ? "rgba(239, 68, 68, 0.2)" : countdown.isUrgent ? "rgba(245, 158, 11, 0.2)" : "rgba(56, 189, 248, 0.15)",
                                  color: countdown.isExpired ? "#fca5a5" : countdown.isUrgent ? "#fde047" : "#38bdf8",
                                  border: `1px solid ${countdown.isExpired ? "#ef4444" : countdown.isUrgent ? "#f59e0b" : "#0284c7"}`
                                }}>
                                  {countdown.text}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* بيانات المقرر وأستاذ المقرر */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
                            <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "#38bdf8" }}>📚</span>
                              <span style={{ color: "#e2e8f0", fontWeight: "600" }}>{proj.courseName}</span>
                            </div>
                            <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                              <span>👨‍🏫</span>
                              <span>أستاذ المقرر: <b style={{ color: "#fff" }}>{proj.instructorTitle}</b></span>
                            </div>
                          </div>

                          {/* الدرجة العظمى والوضعية والنمط */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px" }}>
                            <span style={{ color: "#94a3b8" }}>
                              الدرجة: <b style={{ color: "#fbbf24" }}>من {proj.maxScore}</b>
                            </span>
                            <span style={{ color: "#94a3b8" }}>
                              {proj.multiStageEnabled ? "🎨 مرحلتين (تجهيز + إنهاء)" : (proj.cameraMode === "3d" ? "🗿 مجسم 3D" : "🖼️ لوحة 2D")}
                            </span>
                          </div>

                          {/* تذييل حالة التقييم والرفع */}
                          <div style={{ paddingTop: "4px" }}>
                            {proj.isGraded ? (
                              <div style={{
                                background: "rgba(239, 68, 68, 0.18)",
                                border: "1px solid #ef4444",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "6px"
                              }}>
                                <span style={{ color: "#fca5a5", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", display: "inline-block", boxShadow: "0 0 8px #ef4444" }}></span>
                                  تم التقييم
                                </span>
                                <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13px" }}>
                                  {proj.score} / {proj.maxScore}
                                </span>
                              </div>
                            ) : proj.isFullySubmitted ? (
                              <div style={{
                                background: "rgba(56, 189, 248, 0.1)",
                                border: "1px solid rgba(56, 189, 248, 0.25)",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                color: "#38bdf8",
                                fontSize: "11px",
                                textAlign: "center"
                              }}>
                                ⏳ قيد التقييم (بانتظار رصد الدرجة)
                              </div>
                            ) : proj.multiStageEnabled && proj.hasStage1Image && !proj.hasStage2Image ? (
                              <div style={{
                                background: countdown.isExpired ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.12)",
                                border: `1px solid ${countdown.isExpired ? "#ef4444" : "#f59e0b"}`,
                                borderRadius: "8px",
                                padding: "6px 10px",
                                color: countdown.isExpired ? "#fca5a5" : "#fbbf24",
                                fontSize: "11px",
                                textAlign: "center",
                                fontWeight: "bold"
                              }}>
                                {countdown.isExpired ? "⛔ انتهى موعد رفع المرحلة 2" : `📷 اضغط لرفع: ${proj.stage2Title || 'العمل النهائي'}`}
                              </div>
                            ) : countdown.isExpired ? (
                              <div style={{
                                background: "rgba(239, 68, 68, 0.12)",
                                border: "1px solid #ef4444",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                color: "#fca5a5",
                                fontSize: "11px",
                                textAlign: "center",
                                fontWeight: "bold"
                              }}>
                                ⛔ انتهت المهلة المحددة لرفع الصور
                              </div>
                            ) : (
                              <div style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px dashed rgba(255, 255, 255, 0.12)",
                                borderRadius: "8px",
                                padding: "6px 10px",
                                color: "#94a3b8",
                                fontSize: "11px",
                                textAlign: "center"
                              }}>
                                اضغط للاطلاع على التفاصيل والتصوير 📷
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card" style={{ padding: "32px 20px", textAlign: "center", color: "#94a3b8", borderRadius: "14px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>
                      {projectSubTab === "required" ? "🎉" : "📁"}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#fff", marginBottom: "6px" }}>
                      {projectSubTab === "required" 
                        ? "لا توجد مشروعات مطلوبة حالياً!" 
                        : "لم تقم بتسليم أي مشروعات حتى الآن."}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {projectSubTab === "required"
                        ? "لقد قمت بتسليم كافة الأعمال الفنية بنجاح، يمكنك متابعة تقييماتها في تبويب (المشروعات المُسلَّمة)."
                        : "تصفح تبويب (المشروعات المطلوبة) للاطلاع على المشاريع المعينة والتقاط صورها ورفعها."}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 1.2 شاشة تفاصيل المشروع المحدد وتصويره أو استعراض درجته المعتمدة */
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* شريط العودة */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={() => setSelectedProjectForView(null)}
                    className="btn-compact"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#38bdf8",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>←</span>
                    <span>الرجوع لكافة المشاريع</span>
                  </button>

                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    تفاصيل المشروع والتسليم
                  </span>
                </div>

                {/* كارت مواصفات المشروع */}
                <div style={{
                  background: "#141b29",
                  border: "1px solid #2a374f",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div>
                      <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: "bold", margin: "0 0 4px 0" }}>
                        🎨 {selectedProjectForView.title}
                      </h2>
                      <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "600" }}>
                        📚 مقرر: {selectedProjectForView.courseName}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: "bold",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: selectedProjectForView.isSubmitted ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: selectedProjectForView.isSubmitted ? "#34d399" : "#fbbf24",
                      border: selectedProjectForView.isSubmitted ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)"
                    }}>
                      {selectedProjectForView.isSubmitted ? "✅ تم الرفع" : "⏳ بانتظار الرفع"}
                    </span>
                  </div>

                  {/* تفاصيل المواصفات في شبكة مصغرة */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "10px",
                    padding: "12px"
                  }}>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>أستاذ المقرر:</div>
                      <div style={{ color: "#fff", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                        👨‍🏫 {selectedProjectForView.instructorTitle}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>الدرجة القصوى:</div>
                      <div style={{ color: "#fbbf24", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                        ⭐ {selectedProjectForView.maxScore} درجات
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>وضعية العمل الفني:</div>
                      <div style={{ color: "#34d399", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                        {selectedProjectForView.cameraMode === "3d" ? "🗿 مجسم ثلاثي الأبعاد" : "🖼️ لوحة ثنائية الأبعاد"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8", fontSize: "11px" }}>الصور المطلوبة:</div>
                      <div style={{ color: "#a78bfa", fontSize: "12px", fontWeight: "bold", marginTop: "2px" }}>
                        📸 {selectedProjectForView.requiredPhotos || 1} صور بزوايا مختلفة
                      </div>
                    </div>
                  </div>
                </div>

                {/* كارت تسليم واستعراض العمل الفني */}
                <div style={{
                  background: "#0e1524",
                  border: "1px solid #1e293b",
                  borderRadius: "16px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}>
                  {(() => {
                    const isMulti = !!selectedProjectForView.multiStageEnabled;
                    let imageList: any[] = [];
                    const sub = selectedProjectForView.submission;
                    const ev = selectedProjectForView.evaluation;
                    if (sub) {
                      if (Array.isArray(sub.images)) {
                        imageList = sub.images;
                      } else if (typeof sub.images === 'string') {
                        try { imageList = JSON.parse(sub.images); } catch(e) { imageList = []; }
                      } else if (sub.images && typeof sub.images === 'object') {
                        imageList = [sub.images];
                      }
                    }
                    if (imageList.length === 0 && ev?.photo_url) {
                      imageList = [{ url: ev.photo_url }];
                    }

                    const now = Date.now();

                    // حالة المشروع متعدد المراحل
                    if (isMulti) {
                      const stage1Img = imageList.find((i: any) => i.stage === 'stage1') || (imageList.length > 0 ? imageList[0] : null);
                      const stage2Img = imageList.find((i: any) => i.stage === 'stage2') || (imageList.length > 1 ? imageList[1] : null);

                      const s1Dead = selectedProjectForView.stage1Deadline || selectedProjectForView.submissionDeadline;
                      const s2Dead = selectedProjectForView.stage2Deadline || selectedProjectForView.submissionDeadline;
                      const isS1Expired = s1Dead ? new Date(s1Dead).getTime() < now : false;
                      const isS2Expired = s2Dead ? new Date(s2Dead).getTime() < now : false;
                      const cd1 = formatRemainingTime(s1Dead);
                      const cd2 = formatRemainingTime(s2Dead);

                      const stage1Url = typeof stage1Img === 'string' ? stage1Img : (stage1Img?.url || '');
                      const stage2Url = typeof stage2Img === 'string' ? stage2Img : (stage2Img?.url || '');

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          {/* استعراض مرحلتي المشروع جنباً إلى جنب */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                            {/* كارت المرحلة الأولى */}
                            <div style={{ background: "#141b29", border: "1px solid #2a374f", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "13px" }}>
                                  1️⃣ {selectedProjectForView.stage1Title || 'مرحلة التحضير'}
                                </span>
                                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: stage1Url ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)", color: stage1Url ? "#34d399" : "#fbbf24" }}>
                                  {stage1Url ? "✓ تم التسليم" : "⏳ مطلوب"}
                                </span>
                              </div>

                              {stage1Url ? (
                                <div>
                                  <div
                                    onClick={() => setPreviewModalImage(stage1Url)}
                                    style={{ width: "100%", height: "160px", background: "#000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", position: "relative" }}
                                  >
                                    <img src={stage1Url} alt="المرحلة 1" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                    <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                                      🔍 تكبير
                                    </div>
                                  </div>
                                  <div style={{ color: "#34d399", fontSize: "11px", fontWeight: "bold", marginTop: "6px", textAlign: "center" }}>
                                    ✓ تم رفع صورة مرحلة التحضير بنجاح
                                  </div>
                                </div>
                              ) : isS1Expired ? (
                                <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid #ef4444", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
                                  <div style={{ fontSize: "24px" }}>⛔🔒</div>
                                  <div style={{ color: "#fca5a5", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>
                                    انتهت المهلة المحددة لرفع المرحلة الأولى
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center", padding: "8px 0" }}>
                                  {cd1.text && (
                                    <div style={{ fontSize: "11px", color: cd1.isUrgent ? "#fbbf24" : "#38bdf8", fontWeight: "bold" }}>
                                      {cd1.text}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleOpenSmartCameraForProject(selectedProjectForView, 'stage1')}
                                    style={{
                                      padding: "10px 14px",
                                      background: "linear-gradient(135deg, #2563eb, #38bdf8)",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "8px",
                                      fontWeight: "bold",
                                      fontSize: "12px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px"
                                    }}
                                  >
                                    <Camera size={16} />
                                    <span>تصوير ورفع المرحلة الأولى 📷</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* كارت المرحلة الثانية */}
                            <div style={{ background: "#141b29", border: "1px solid #2a374f", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "13px" }}>
                                  2️⃣ {selectedProjectForView.stage2Title || 'العمل النهائي'}
                                </span>
                                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: stage2Url ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)", color: stage2Url ? "#34d399" : "#fbbf24" }}>
                                  {stage2Url ? "✓ تم التسليم" : "⏳ مطلوب"}
                                </span>
                              </div>

                              {stage2Url ? (
                                <div>
                                  <div
                                    onClick={() => setPreviewModalImage(stage2Url)}
                                    style={{ width: "100%", height: "160px", background: "#000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #333", position: "relative" }}
                                  >
                                    <img src={stage2Url} alt="المرحلة 2" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                                    <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                                      🔍 تكبير
                                    </div>
                                  </div>
                                  <div style={{ color: "#34d399", fontSize: "11px", fontWeight: "bold", marginTop: "6px", textAlign: "center" }}>
                                    ✓ تم رفع صورة العمل النهائي المكتمل
                                  </div>
                                </div>
                              ) : !stage1Url ? (
                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "8px", padding: "20px 10px", textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                                  ⏳ يتطلب تصوير ورفع المرحلة الأولى أولاً لفتح المرحلة الثانية
                                </div>
                              ) : isS2Expired ? (
                                <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid #ef4444", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
                                  <div style={{ fontSize: "24px" }}>⛔🔒</div>
                                  <div style={{ color: "#fca5a5", fontSize: "11px", fontWeight: "bold", marginTop: "4px" }}>
                                    انتهت المهلة المحددة لرفع المرحلة الثانية
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center", padding: "8px 0" }}>
                                  {cd2.text && (
                                    <div style={{ fontSize: "11px", color: cd2.isUrgent ? "#fbbf24" : "#34d399", fontWeight: "bold" }}>
                                      {cd2.text}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleOpenSmartCameraForProject(selectedProjectForView, 'stage2')}
                                    style={{
                                      padding: "10px 14px",
                                      background: "linear-gradient(135deg, #059669, #10b981)",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: "8px",
                                      fontWeight: "bold",
                                      fontSize: "12px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px"
                                    }}
                                  >
                                    <Camera size={16} />
                                    <span>تصوير ورفع المرحلة النهائية 📷</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* حالة التقييم والدرجة للعمل متعدد المراحل */}
                          {selectedProjectForView.isGraded ? (
                            <div style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))", border: "2px solid #10b981", borderRadius: "14px", padding: "16px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div style={{ color: "#34d399", fontWeight: "bold", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                <span>🌟 الدرجة المرصودة للمشروع:</span>
                                <span style={{ fontSize: "20px", color: "#fff", background: "#059669", padding: "2px 12px", borderRadius: "8px" }}>
                                  {selectedProjectForView.score} من {selectedProjectForView.maxScore}
                                </span>
                              </div>
                              <div style={{ color: "#86efac", fontSize: "12px", fontWeight: "600" }}>
                                ✓ تم اعتماد تقييم المشروع ومراحله رسمياً
                              </div>
                            </div>
                          ) : stage1Url && stage2Url ? (
                            <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "14px", padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "14px" }}>
                                ⏳ قيد التقييم (تم تسليم المرحلتين بنجاح)
                              </div>
                              <div style={{ color: "#94a3b8", fontSize: "11px", lineHeight: "1.5" }}>
                                تم حفظ مرحلتي عملك الفني بالسحابة، والمشروع الآن بانتظار المراجعة والتقييم ورصد الدرجة من أستاذ المقرر.
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                              يرجى الالتزام بمواعيد تسليم كل مرحلة لضمان احتساب درجات المشروع كاملة.
                            </div>
                          )}
                        </div>
                      );
                    }

                    // حالة المشروع أحادي المرحلة (عادي)
                    const singleDead = selectedProjectForView.submissionDeadline;
                    const isSingleExpired = singleDead ? new Date(singleDead).getTime() < now : false;
                    const singleCd = formatRemainingTime(singleDead);

                    if (selectedProjectForView.isSubmitted) {
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
                              🖼️ صورة العمل الفني المسلم:
                            </span>
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                              (اضغط على الصورة للتكبير بدقة عالية)
                            </span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: imageList.length === 1 ? "1fr" : "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px" }}>
                            {imageList.map((img: any, idx: number) => {
                              const imgUrl = typeof img === 'string' ? img : (img?.url || img?.dataUrl || '');
                              if (!imgUrl) return null;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => setPreviewModalImage(imgUrl)}
                                  style={{
                                    height: imageList.length === 1 ? "220px" : "140px",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    border: "2px solid rgba(56, 189, 248, 0.3)",
                                    background: "#000",
                                    position: "relative",
                                    cursor: "pointer"
                                  }}
                                >
                                  <img src={imgUrl} alt={`عمل فني ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                                    🔍 تكبير
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {selectedProjectForView.submission?.created_at && (
                            <div style={{ color: "#94a3b8", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>📅 تاريخ الرفع:</span>
                              <span style={{ color: "#e2e8f0" }}>
                                {new Date(selectedProjectForView.submission.created_at).toLocaleString("ar-EG", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                            </div>
                          )}

                          {selectedProjectForView.isGraded ? (
                            <div style={{
                              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.15))",
                              border: "2px solid #10b981",
                              borderRadius: "14px",
                              padding: "16px",
                              textAlign: "center",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px"
                            }}>
                              <div style={{ color: "#34d399", fontWeight: "bold", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                <span>🌟 الدرجة المرصودة:</span>
                                <span style={{ fontSize: "20px", color: "#fff", background: "#059669", padding: "2px 12px", borderRadius: "8px" }}>
                                  {selectedProjectForView.score} من {selectedProjectForView.maxScore}
                                </span>
                              </div>
                              <div style={{ color: "#86efac", fontSize: "12px", fontWeight: "600" }}>
                                ✓ تم تقييم المشروع واعتماده رسمياً
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              background: "rgba(56, 189, 248, 0.08)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              borderRadius: "14px",
                              padding: "16px",
                              textAlign: "center",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px"
                            }}>
                              <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                <span>⏳</span>
                                <span>قيد التقييم (بانتظار رصد الدرجة)</span>
                              </div>
                              <div style={{ color: "#94a3b8", fontSize: "12px", lineHeight: "1.5" }}>
                                تم استلام وحفظ عملك الفني بنجاح بالسحابة، والعمل الآن بانتظار المراجعة والتقييم ورصد الدرجة من قِبل أستاذ المقرر.
                              </div>
                            </div>
                          )}

                          <div style={{ color: "#64748b", fontSize: "11px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "10px" }}>
                            🔒 تم قفل خيار الرفع لمنع التكرار. في حال الرغبة في إعادة التصوير، يرجى مراجعة أستاذ المقرر لفك القفل.
                          </div>
                        </div>
                      );
                    }

                    // لم يتم الرفع بعد: فحص المهلة قبل إظهار الكاميرا
                    if (isSingleExpired) {
                      return (
                        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid #ef4444", borderRadius: "14px", padding: "24px 16px", textAlign: "center" }}>
                          <div style={{ fontSize: "40px", marginBottom: "8px" }}>⛔🔒</div>
                          <div style={{ color: "#f87171", fontWeight: "bold", fontSize: "16px", marginBottom: "6px" }}>
                            انتهت المهلة المحددة لرفع صور هذا المشروع
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "340px", margin: "0 auto", lineHeight: "1.6" }}>
                            تم إغلاق إمكانية رفع الصور لهذا المشروع لانتهاء المهلة الزمنية المحددة من قِبل أستاذ المقرر. في حال الحاجة لرفع العمل، يرجى مراجعة أستاذ المقرر لتمديد الموعد.
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px", textAlign: "center", padding: "10px 0" }}>
                        <div style={{ fontSize: "40px" }}>📷</div>
                        <div>
                          <div style={{ color: "#fff", fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>
                            تصوير العمل الفني ورفعه مباشرة
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "12px", maxWidth: "340px", margin: "0 auto", lineHeight: "1.5" }}>
                            قم بتوجيه الكاميرا إلى عملك الفني مباشرة. تأكد من ثبات اليد وحسن الإضاءة، وسيتحول الإطار إلى الأخضر عند جاهزية اللقطة.
                          </div>
                        </div>

                        {singleCd.text && (
                          <div style={{
                            display: "inline-block",
                            margin: "0 auto",
                            padding: "4px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            background: singleCd.isUrgent ? "rgba(245, 158, 11, 0.15)" : "rgba(56, 189, 248, 0.15)",
                            color: singleCd.isUrgent ? "#fbbf24" : "#38bdf8",
                            border: `1px solid ${singleCd.isUrgent ? "#f59e0b" : "#0284c7"}`
                          }}>
                            {singleCd.text}
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenSmartCameraForProject(selectedProjectForView)}
                          style={{
                            width: "100%",
                            maxWidth: "360px",
                            margin: "6px auto 0",
                            padding: "14px 20px",
                            background: "linear-gradient(135deg, #2563eb, #10b981)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            fontSize: "15px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "10px",
                            boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)"
                          }}
                        >
                          <Camera size={20} />
                          <span>التقاط ورفع صور المشروع لايف 📸</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ATTENDANCE (سجل الحضور والغياب مع جدول التواريخ التلقائي) */}
        {/* ========================================================= */}
        {activeTab === "attendance" && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "13.5px", color: "#fff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CalendarCheck size={16} color="#38bdf8" />
              <span>سجلات حضور المحاضرات والسكاشن:</span>
            </h3>

            {dashboardData?.attendance?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dashboardData.attendance.map((c: any) => (
                  <div key={c.courseId} className="glass-card" style={{ padding: "12px", borderRadius: "12px" }}>
                    {/* رأس المقرر بدون نسبة الحضور */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ color: "#fff", fontWeight: "bold", fontSize: "13.5px" }}>{c.courseName}</span>
                        {(c.instructorTitle || c.instructorName) && (
                          <span style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "normal" }}>
                            👨‍🏫 أستاذ المقرر: {c.instructorTitle || c.instructorName}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: "10.5px",
                        color: "#38bdf8",
                        background: "rgba(56, 189, 248, 0.12)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid rgba(56, 189, 248, 0.25)"
                      }}>
                        {c.courseType === 'sections' ? 'سكشن عملي' : 'محاضرة'}
                      </span>
                    </div>

                    {/* بطاقتان فقط متساويتان: حضور ✅ وغياب ❌ (بدون نسبة) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                      {/* بطاقة الحضور */}
                      <div style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        borderRadius: "10px",
                        padding: "6px 4px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "bold", color: "#34d399", marginBottom: "1px" }}>
                          حضور ✅
                        </span>
                        <span style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", lineHeight: "1.1" }}>
                          {c.attended}
                        </span>
                        <span style={{ fontSize: "10px", color: "#a7f3d0", marginTop: "1px" }}>
                          {c.courseType === 'sections' ? 'سكشن' : 'محاضرة'}
                        </span>
                      </div>

                      {/* بطاقة الغياب */}
                      <div style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "10px",
                        padding: "6px 4px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "bold", color: "#f87171", marginBottom: "1px" }}>
                          غياب ❌
                        </span>
                        <span style={{ fontSize: "20px", fontWeight: "900", color: "#ffffff", lineHeight: "1.1" }}>
                          {c.absent}
                        </span>
                        <span style={{ fontSize: "10px", color: "#fca5a5", marginTop: "1px" }}>
                          {c.excused > 0 ? `(${c.excused} عذر)` : (c.courseType === 'sections' ? 'سكشن' : 'محاضرة')}
                        </span>
                      </div>
                    </div>

                    {/* جدول تواريخ الحضور بشكل تلقائي تحت كل مقرر بدون أزرار فتح/إغلاق */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "8px" }}>
                      <div style={{ fontSize: "10.5px", color: "#94a3b8", fontWeight: "bold", marginBottom: "6px" }}>
                        📅 سجل التواريخ المفصلة:
                      </div>
                      {c.records && c.records.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {c.records.map((rec: any, rIdx: number) => {
                            const isPresent = rec.status === "حاضر";
                            const isExcused = rec.status === "إذن" || rec.status === "عذر";
                            return (
                              <div
                                key={rIdx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  background: isPresent ? "rgba(16, 185, 129, 0.08)" : isExcused ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.08)",
                                  border: isPresent ? "1px solid rgba(16, 185, 129, 0.2)" : isExcused ? "1px solid rgba(245, 158, 11, 0.2)" : "1px solid rgba(239, 68, 68, 0.2)",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px"
                                }}
                              >
                                <span style={{ color: "#ffffff", fontWeight: "600", fontSize: "11px" }}>
                                  📅 {rec.formattedDate || rec.date}
                                </span>
                                <span style={{
                                  fontWeight: "bold",
                                  fontSize: "10.5px",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: isPresent ? "rgba(16, 185, 129, 0.25)" : isExcused ? "rgba(245, 158, 11, 0.25)" : "rgba(239, 68, 68, 0.25)",
                                  color: isPresent ? "#34d399" : isExcused ? "#fbbf24" : "#f87171"
                                }}>
                                  {isPresent ? "حاضر ✅" : isExcused ? "عذر 📝" : "غائب ❌"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color: "#64748b", fontSize: "10.5px", textAlign: "center", padding: "6px" }}>
                          لا توجد تواريخ تفصيلية مسجلة بعد.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                لا توجد سجلات حضور مسجلة لك حتى الآن.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: WARNINGS (الإنذارات وتجاوز نسب الغياب) */}
        {/* ========================================================= */}
        {activeTab === "warnings" && !dashboardData?.hide_warnings_tab && (
          <div className="animate-fade-in">
            <h3 style={{ fontSize: "15px", color: "#f87171", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={18} />
              <span>إنذارات الغياب وتجاوز النسبة المقررة:</span>
            </h3>

            {dashboardData?.warnings?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {dashboardData.warnings.map((w: any) => (
                  <div
                    key={w.courseId}
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      borderRadius: "14px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ color: "#fca5a5", fontWeight: "bold", fontSize: "15px" }}>
                        ⚠️ إنذار غياب رسمي: {w.courseName}
                        {(w.instructorTitle || w.instructorName) && (
                          <span style={{ fontSize: "11px", color: "#fecaca", fontWeight: "normal", marginRight: "6px" }}>
                            ({w.instructorTitle || w.instructorName})
                          </span>
                        )}
                      </div>
                      <span style={{ background: "#ef4444", color: "#fff", fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "6px" }}>
                        مستوى الخطر 🚨
                      </span>
                    </div>

                    <div style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: "1.5" }}>
                      لقد تجاوزت الحد الأقصى للغياب في هذا المقرر، حيث سُجل لك <b>{w.absent}</b> مرات غياب (الحد المسموح به: {w.warningLimit || 3} مرات).
                    </div>

                    {w.absentDates && w.absentDates.length > 0 && (
                      <div style={{ background: "rgba(0,0,0,0.25)", padding: "8px 12px", borderRadius: "8px", fontSize: "11px", color: "#fca5a5" }}>
                        📌 تواريخ الغياب المسجلة: {w.absentDates.join(" ، ")}
                      </div>
                    )}

                    <div style={{ color: "#f87171", fontSize: "11px", fontWeight: "600", borderTop: "1px solid rgba(239, 68, 68, 0.2)", paddingTop: "8px" }}>
                      يرجى مراجعة أستاذ المقرر وإدارة الكلية فوراً تجنباً لتطبيق عقوبة الحرمان من دخول الامتحان النهائي.
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-card" style={{ padding: "34px 20px", textAlign: "center", color: "#34d399", borderRadius: "14px" }}>
                <CheckCircle2 size={42} color="#10b981" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>سجلك الأكاديمي ممتاز!</div>
                <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "6px" }}>
                  لا توجد أي إنذارات غياب مسجلة بحقك، ونسبة حضورك ضمن المعدل النظامي المسموح به.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {activeTab === "lockers" && currentStudent && (
          <div className="animate-fade-in">
            <StudentLockerTab student={currentStudent} />
          </div>
        )}

        {/* ========================================================= */}
        {/* نافذة الكاميرا المباشرة الذكية - لايف فقط بدون رفع ملفات */}
        {/* ========================================================= */}
        {showArtworkCamera && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            inset: 0,
            width: "100vw",
            height: "100dvh",
            maxHeight: "100dvh",
            background: "#000",
            zIndex: 999999,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            direction: "rtl"
          }}>
            {/* هيدر الكاميرا: اسم المشروع، وضع التصوير، زر تدوير الإطار، الفلاش، والإغلاق */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "10px 14px",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)",
              zIndex: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px"
            }}>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📷 {activeProjectForUpload?.title || "العمل الفني"}</span>
                  <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: cameraMode === "3d" ? "rgba(168, 85, 247, 0.3)" : "rgba(56, 189, 248, 0.3)", color: cameraMode === "3d" ? "#c084fc" : "#38bdf8", border: "1px solid currentColor" }}>
                    {cameraMode === "3d" ? "مجسم 3D" : "مسطح 2D"}
                  </span>
                </div>
                <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                  الزاوية ({currentPhotoStep} من {requiredPhotosCount})
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {/* زر التبديل الفوري بين الإطار الرأسي والأفقي */}
                <button
                  type="button"
                  onClick={() => setOrientationFrame(prev => prev === "portrait" ? "landscape" : "portrait")}
                  className="btn-compact"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    padding: "6px 10px",
                    fontSize: "11px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                  title="تبديل اتجاه الإطار بين طولي وعرضي"
                >
                  <RotateCw size={13} />
                  <span>{orientationFrame === "portrait" ? "إطار طولي 📱" : "إطار عرضي 🔄"}</span>
                </button>

                {/* زر كشاف الفلاش */}
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="btn-compact"
                  style={{
                    background: torchOn ? "#fbbf24" : "rgba(255,255,255,0.18)",
                    color: torchOn ? "#000" : "#fff",
                    border: "none",
                    padding: "6px 10px",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  <Sun size={14} />
                  <span>{torchOn ? "الفلاش شغال" : "فلاش"}</span>
                </button>

                {/* زر الإلغاء والخروج */}
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setShowArtworkCamera(false);
                  }}
                  className="btn-compact"
                  style={{
                    background: "rgba(239, 68, 68, 0.4)",
                    color: "#fff",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    padding: "6px 10px",
                    cursor: "pointer"
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* معاينة الفيديو المباشر للكاميرا بدون أي وميض أو اهتزاز */}
            <div style={{ flex: "1 1 0%", minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#000" }}>
              {/* وميض الالتقاط البصري للشاشة (Shutter Flash) */}
              {isShutterFlashing && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "#ffffff",
                  zIndex: 999999,
                  opacity: 0.92,
                  pointerEvents: "none",
                  transition: "opacity 0.12s ease-out"
                }} />
              )}
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "translateZ(0)",
                  willChange: "transform"
                }}
              />

              {/* إطار التصوير التوجيهي الذكي المستقر */}
              <div style={{
                position: "absolute",
                width: orientationFrame === "landscape" ? "88%" : "72%",
                height: orientationFrame === "landscape" ? "56%" : "76%",
                border: `3px dashed ${cameraFrameState.frameColor}`,
                borderRadius: "16px",
                pointerEvents: "none",
                boxShadow: `0 0 25px ${cameraFrameState.frameColor}44`,
                transition: "width 0.25s ease, height 0.25s ease, border-color 0.25s ease"
              }}>
                {/* أركان الإطار لتحديد حدود العمل الفني بدقة */}
                <div style={{ position: "absolute", top: -3, left: -3, width: 22, height: 22, borderTop: `4px solid ${cameraFrameState.frameColor}`, borderLeft: `4px solid ${cameraFrameState.frameColor}` }} />
                <div style={{ position: "absolute", top: -3, right: -3, width: 22, height: 22, borderTop: `4px solid ${cameraFrameState.frameColor}`, borderRight: `4px solid ${cameraFrameState.frameColor}` }} />
                <div style={{ position: "absolute", bottom: -3, left: -3, width: 22, height: 22, borderBottom: `4px solid ${cameraFrameState.frameColor}`, borderLeft: `4px solid ${cameraFrameState.frameColor}` }} />
                <div style={{ position: "absolute", bottom: -3, right: -3, width: 22, height: 22, borderBottom: `4px solid ${cameraFrameState.frameColor}`, borderRight: `4px solid ${cameraFrameState.frameColor}` }} />
              </div>

              {/* شريط الإرشادات الذكي الفوري المعتدل */}
              <div style={{
                position: "absolute",
                bottom: "95px",
                left: "20px",
                right: "20px",
                background: "rgba(15, 23, 42, 0.88)",
                border: `1px solid ${cameraFrameState.frameColor}`,
                color: "#fff",
                padding: "8px 14px",
                borderRadius: "10px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 15px rgba(0,0,0,0.5)"
              }}>
                {cameraFrameState.message}
              </div>
            </div>

            {/* شريط التحكم السفلي: التقاط لايف إجباري 100% بدون أي زر لرفع ملفات */}
            <div style={{
              padding: "16px 20px",
              paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
              background: "rgba(0,0,0,0.95)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0
            }}>
              {/* مصغرات الصور السابقة للمشروع متعدد الزوايا */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", minWidth: "60px" }}>
                {capturedPhotos.map((p, idx) => (
                  <div key={idx} style={{ width: "38px", height: "38px", borderRadius: "6px", overflow: "hidden", border: "2px solid #10b981", position: "relative" }}>
                    <img src={p.url} alt="زاوية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ))}
              </div>

              {/* زر الالتقاط الدائري الفوري - يستجيب دائماً مع وميض بصري وهزة خفيفة */}
              <button
                type="button"
                onClick={handleSnapArtworkPhoto}
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: cameraFrameState.isReady ? "#fff" : "rgba(255,255,255,0.85)",
                  border: `4px solid ${cameraFrameState.frameColor}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: cameraFrameState.isReady ? "0 0 25px rgba(16, 185, 129, 0.8)" : "0 0 10px rgba(0,0,0,0.5)",
                  transition: "all 0.15s ease",
                  transform: "scale(1)",
                  outline: "none"
                }}
                title="انقر لالتقاط العمل الفني مباشرة"
              >
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: cameraFrameState.isReady ? "#10b981" : "#475569", transition: "background 0.2s" }} />
              </button>

              {/* مؤشر أمني إجباري يوضح أن النظام يفرض التصوير الحي المباشر فقط */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: "#34d399",
                fontSize: "11px",
                fontWeight: "bold",
                background: "rgba(16, 185, 129, 0.12)",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid rgba(16, 185, 129, 0.3)"
              }}>
                <ShieldCheck size={14} color="#10b981" />
                <span>تصوير مباشر 🔒</span>
              </div>
            </div>
          </div>
        )}

        {/* نافذة مراجعة الصور الملتقطة واعتماد الرفع النهائي */}
        {!showArtworkCamera && capturedPhotos.length >= requiredPhotosCount && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.85)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            direction: "rtl"
          }}>
            <div style={{ background: "#141b29", border: "1px solid #2a374f", borderRadius: "16px", padding: "20px", maxWidth: "460px", width: "100%" }}>
              <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "bold", margin: "0 0 8px 0" }}>
                معاينة الصور قبل الرفع للأستاذ 🎨
              </h3>
              <div style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "14px" }}>
                مشروع: <b>{activeProjectForUpload?.title}</b> ({capturedPhotos.length} صور تم التقاطها)
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                {capturedPhotos.map((p, idx) => (
                  <div key={idx} style={{ height: "130px", borderRadius: "10px", overflow: "hidden", border: "1px solid #334155", background: "#000" }}>
                    <img src={p.url} alt="معاينة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={handleSubmitArtwork}
                  disabled={uploadingProject}
                  style={{
                    flex: 1,
                    padding: "10px", background: "linear-gradient(135deg, #10b981, #059669)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    fontSize: "13px",
                    cursor: uploadingProject ? "not-allowed" : "pointer"
                  }}
                >
                  {uploadingProject ? "جاري الرفع..." : "✓ اعتماد ورفع هذا المشروع"}
                </button>

                <button
                  onClick={() => {
                    setCapturedPhotos([]);
                    setCurrentPhotoStep(1);
                    startCamera("artwork", cameraMode);
                  }}
                  className="btn-compact"
                  style={{
                    background: "#334155",
                    color: "#fff",
                    padding: "12px",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  إعادة التصوير
                </button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة تكبير الصورة (Lightbox Modal) */}
        {previewModalImage && (
          <div 
            onClick={() => setPreviewModalImage(null)}
            style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.92)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", cursor: "pointer" }}
          >
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
              <img src={previewModalImage} alt="عرض مكبر" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "10px", objectFit: "contain" }} />
              <button 
                onClick={() => setPreviewModalImage(null)}
                className="btn-compact"
                style={{ position: "absolute", top: "-15px", right: "-15px", background: "#ef4444", color: "#fff", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ملف الـ Input المخفي لبطاقة الرقم القومي وعنصر الـ canvas لفحص الجودة */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={idFileInputRef} 
          style={{ display: "none" }} 
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              try {
                const comp = await compressImageToWebP(f, 1000, 0.75);
                setIdCardPhoto(comp.dataUrl);
              } catch {
                const r = new FileReader();
                r.onload = (ev) => setIdCardPhoto(ev.target?.result as string);
                r.readAsDataURL(f);
              }
            }
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* QR Code Modal */}
      {showQRModal && currentStudent && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: "20px"
        }}>
          <div className="glass-card animate-fade-in" style={{
            background: "#1e293b",
            borderRadius: "20px",
            padding: "30px",
            width: "100%",
            maxWidth: "350px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            border: "1px solid rgba(56, 189, 248, 0.3)"
          }}>
            <div style={{ marginBottom: "20px", color: "#fff", fontWeight: "bold", fontSize: "16px", textAlign: "center" }}>
              كارت الـ QR الخاص بك
            </div>

            <div style={{ 
              background: "#fff", 
              padding: "20px", 
              borderRadius: "16px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
            }}>
              <QRCode 
                id="student-qr-code"
                value={`كود الطالب: ${formatStudentCode(currentStudent.student_code)}\nاسم الطالب: ${currentStudent.full_name}`} 
                size={220} 
                level="H"
              />
            </div>

            <div style={{ marginTop: "15px", color: "#94a3b8", fontSize: "14px", fontWeight: "bold" }}>
              {currentStudent.student_code}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "25px", width: "100%" }}>
              <button 
                onClick={handleDownloadQR}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                <Download size={16} />
                <span>تحميل الصورة</span>
              </button>
              
              <button 
                onClick={() => setShowQRModal(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: "pointer"
                }}
              >
                <X size={16} />
                <span>إغلاق</span>
              </button>
            </div>
          </div>
        </div>
      )}

        {/* نافذة التقاط الصورة الشخصية السيلفي وحفظها على التليجرام */}
        {showSelfieModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            maxHeight: "100dvh",
            background: "#000",
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            direction: "rtl"
          }}>
            {/* شريط العنوان وزر الإلغاء */}
            <div style={{
              flexShrink: 0,
              padding: "10px 14px",
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(8px)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              zIndex: 10
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>🤳</span>
                <span style={{ color: "#fff", fontSize: "13px", fontWeight: "bold" }}>التقاط صورة شخصية للحساب</span>
              </div>
              <button
                type="button"
                onClick={() => { stopSelfieCamera(); setShowSelfieModal(false); setSelfiePhoto(null); setSelfieMsg(""); }}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0
                }}
                title="إغلاق"
              >
                <X size={15} />
              </button>
            </div>

            {/* منطقة الكاميرا الحية أو المعاينة */}
            <div style={{
              flex: "1 1 0%",
              minHeight: 0,
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#05070f"
            }}>
              {!selfiePhoto ? (
                <>
                  <video
                    ref={selfieVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: "scaleX(-1)"
                    }}
                  />
                  {/* إطار دائري لتوجيه الوجه مع التعرف الذكي على الوجه */}
                  <div style={{
                    position: "absolute",
                    width: "230px",
                    height: "230px",
                    borderRadius: "50%",
                    border: faceDetected ? "3.5px solid #10b981" : "2.5px dashed rgba(56, 189, 248, 0.75)",
                    boxShadow: faceDetected 
                      ? "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px rgba(16, 185, 129, 0.75)"
                      : "0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.3)",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.25s ease"
                  }}>
                    <span style={{
                      color: faceDetected ? "#34d399" : "#38bdf8",
                      fontSize: "11px",
                      fontWeight: "bold",
                      background: "rgba(0, 0, 0, 0.75)",
                      border: faceDetected ? "1px solid #10b981" : "1px solid rgba(56, 189, 248, 0.3)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px"
                    }}>
                      {faceDetected ? "🟢 تم التعرف على الوجه بنجاح ✅" : "👤 اضبط وجهك داخل الدائرة"}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px"
                }}>
                  <div style={{
                    width: "200px",
                    height: "200px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "3px solid #10b981",
                    boxShadow: "0 0 25px rgba(16, 185, 129, 0.5)",
                    marginBottom: "12px"
                  }}>
                    <img src={selfiePhoto} alt="معاينة الصورة الشخصية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ color: "#34d399", fontSize: "12px", fontWeight: "bold" }}>
                    تم التقاط صورتك بنجاح! جاهزة للحفظ ✅
                  </div>
                </div>
              )}
            </div>

            {/* رسالة الحالة إن وجدت */}
            {selfieMsg && (
              <div style={{
                padding: "8px 12px",
                background: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                fontSize: "11px",
                textAlign: "center",
                fontWeight: "bold",
                borderTop: "1px solid rgba(16, 185, 129, 0.3)"
              }}>
                {selfieMsg}
              </div>
            )}

            {/* شريط التحكم السفلي */}
            <div style={{
              flexShrink: 0,
              padding: "12px 16px",
              paddingBottom: "max(18px, env(safe-area-inset-bottom, 18px))",
              background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95), #070a12)",
              borderTop: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              zIndex: 10
            }}>
              {!selfiePhoto ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const photo = captureSelfieFrame();
                      if (photo) setSelfiePhoto(photo);
                    }}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      border: faceDetected ? "4px solid #10b981" : "4px solid #38bdf8",
                      boxShadow: faceDetected ? "0 0 25px rgba(16, 185, 129, 0.9)" : "0 0 15px rgba(56, 189, 248, 0.5)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      outline: "none",
                      transition: "all 0.2s ease"
                    }}
                    title="التقاط الصورة الشخصية"
                  >
                    <div style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "50%",
                      background: faceDetected ? "#059669" : "#0284c7",
                      transition: "all 0.2s ease"
                    }} />
                  </button>
                  <span style={{ color: faceDetected ? "#34d399" : "#38bdf8", fontSize: "11px", fontWeight: "bold" }}>
                    {faceDetected ? "الوجه جاهز! اضغط للالتقاط 📸" : "التقاط الصورة الشخصية 📸"}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "340px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelfiePhoto(null);
                      setSelfieMsg("");
                      startSelfieCamera();
                    }}
                    disabled={isSavingSelfie}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "rgba(255, 255, 255, 0.1)",
                      color: "#fff",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    إعادة التقاط 🔄
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSelfie}
                    disabled={isSavingSelfie}
                    style={{
                      flex: 1.4,
                      padding: "10px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      cursor: isSavingSelfie ? "wait" : "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    {isSavingSelfie ? (
                      <>
                        <RotateCw size={14} className="animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>حفظ الصورة 💾</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <footer style={{ textAlign: "center", paddingTop: "24px", paddingBottom: "16px", color: "#64748b", fontSize: "11px" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </footer>
      </div>
    );
  }

    // ==========================================
  // VIEW 3: شاشة تسجيل الدخول والتسجيل الجديد للطلاب (Auth Screen)
  // ==========================================
  if (!isClientReady) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#fff",
        padding: "20px",
        direction: "rtl"
      }}>
        <div style={{
          width: "68px",
          height: "68px",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "16px",
          boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)"
        }}>
          <img src="/icon-192.png" alt="بوابة الطالب" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#f8fafc", marginBottom: "6px" }}>
          بوابة الطالب — قسم التربية الفنية
        </div>
        <div style={{ fontSize: "12px", color: "#38bdf8" }}>
          جاري فتح البوابة والتحقق من الحساب...
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px", maxWidth: "440px", margin: "0 auto", direction: "rtl" }}>
      
      <div>
        {/* زر سحب الكيو ار كود */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <Link 
            href="/?tab=qr" 
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("fania_last_portal");
                localStorage.setItem("fania_bypass_update_notice", "1");
              }
            }}
            style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12.5px", fontWeight: "bold" }}
          >
            <QrCode size={15} />
            <span>سحب الكيو ار كود</span>
          </Link>
          <span style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>نظام فنية الموحد</span>
        </div>

        <header style={{ textAlign: "center", paddingTop: "10px", marginBottom: "16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "14px", overflow: "hidden", marginBottom: "6px", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)" }}>
            <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginBottom: "3px" }}>
            بوابة فنية الذكية
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            تسجيل الحضور، متابعة التقييمات، ورفع الأعمال الفنية
          </p>
        </header>

        {/* مفتاح التبديل بين تسجيل جديد وتسجيل الدخول (تسجيل طالب جديد أولاً) */}
        <div style={{ display: "flex", background: "#141b29", padding: "4px", borderRadius: "12px", border: "1px solid #2a374f", marginBottom: "18px" }}>
          <button
            type="button"
            onClick={() => { setAuthMode("register"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "register" ? "#2563eb" : "transparent",
              color: authMode === "register" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل طالب جديد 📝
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode("login"); setErrorMsg(""); }}
            className="btn-compact"
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              background: authMode === "login" ? "#2563eb" : "transparent",
              color: authMode === "login" ? "#fff" : "#94a3b8",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
              border: "none"
            }}
          >
            تسجيل الدخول 🔐
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", borderRadius: "10px", marginBottom: "14px", fontSize: "12px" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        {authMode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                كود الطالب الجامعي:
              </label>
              <input
                type="text"
                placeholder="أدخل كودك (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px" }}
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>
                  الرقم السري (PIN):
                </label>
                <span style={{ color: "#64748b", fontSize: "11px" }}>مشفر وخاص بالطالب</span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showLoginPin ? "text" : "password"}
                  placeholder="أدخل الرقم السري الخاص بك..."
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  style={{
                    width: "100%",
                    height: "46px",
                    padding: "0 44px 0 14px",
                    textAlign: "center",
                    direction: "ltr",
                    background: "#141b29",
                    border: "1px solid #2a374f",
                    borderRadius: "10px",
                    color: "#fbbf24",
                    fontSize: "16px",
                    fontWeight: "bold",
                    letterSpacing: showLoginPin ? "normal" : "4px",
                    boxSizing: "border-box",
                    margin: 0
                  }}
                />
                <button
                  type="button"
                  className="btn-compact"
                  onClick={() => setShowLoginPin(!showLoginPin)}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "32px",
                    height: "32px",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    margin: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  title={showLoginPin ? "إخفاء الرقم السري" : "إظهار الرقم السري"}
                >
                  {showLoginPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span style={{ color: "#38bdf8", fontSize: "11px", lineHeight: "1.4", display: "inline-block" }}>
                  💡 الدخول يتطلب كود الطالب والرقم السري المعتمد. إذا لم يكن لديك رقم سري، راجع منسق المنظومة.
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "جاري التحقق..." : "تسجيل الدخول 🚀"}
            </button>
          </form>
        ) : (
          /* نموذج تسجيل طالب جديد */
          <form onSubmit={handleRegisterSubmit} className="glass-card" style={{ padding: "20px" }}>
            {matchedStudent && (
              <div style={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(37, 99, 235, 0.2))",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "16px",
                textAlign: "right"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px" }}>✨</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#34d399" }}>
                    استكمال تفعيل الحساب وتأكيد الهوية
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#e2e8f0", lineHeight: "1.5" }}>
                  مرحباً <b>{matchedStudent.full_name}</b> ({matchedStudent.academic_year} • سكشن {matchedStudent.section || 'عام'}).
                  <div style={{ color: "#93c5fd", marginTop: "2px" }}>
                    يرجى إدخال رقم هاتفك ورفع بطاقة الرقم القومي أو الكارنيه لإرسال طلب الاعتماد فوراً.
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "bold" }}>
                  كود الطالب الجامعي:
                </label>
                {matchedStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      setMatchedStudent(null);
                      setRegCode("");
                      setRegName("");
                      setLookupStatus(null);
                      setLookupMessage(null);
                    }}
                    style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
                  >
                    تغيير الكود 🔄
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="أدخل كودك الجامعي (مثل: 0001)..."
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                readOnly={!!matchedStudent}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: matchedStudent ? "rgba(16, 185, 129, 0.08)" : "#141b29",
                  border: matchedStudent ? "1px solid #10b981" : "1px solid #2a374f",
                  borderRadius: "10px",
                  color: matchedStudent ? "#34d399" : "#fff",
                  fontSize: "14px",
                  fontWeight: matchedStudent ? "bold" : "normal"
                }}
              />
              {isLookingUpCode && (
                <div style={{ color: "#38bdf8", fontSize: "11px", marginTop: "4px" }}>جاري التحقق من الكود...</div>
              )}
              {matchedStudent && (
                <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", color: "#34d399", padding: "6px 10px", borderRadius: "8px", marginTop: "6px", fontSize: "12px" }}>
                  ✓ {matchedStudent.full_name} • {matchedStudent.academic_year} (سكشن {matchedStudent.section || 'عام'})
                </div>
              )}
              {lookupStatus?.isAlreadyActive && (
                <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid #10b981", color: "#34d399", padding: "12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px" }}>🎉 حسابك مسجل ومفعل بالفعل على المنظومة!</div>
                  <div style={{ fontSize: "11px", color: "#a7f3d0", marginBottom: "10px" }}>تم اعتماد وتفعيل حسابك بنجاح. يمكنك الدخول للوحة تحكمك ومقرراتك فوراً.</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRegCode(matchedStudent?.student_code || regCode);
                        setEnteredPin("");
                        setAuthMode("login");
                        setErrorMsg("");
                      }}
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", fontWeight: "bold", fontSize: "13px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>🔐</span>
                      <span>تسجيل الدخول بالرقم السري</span>
                    </button>
                  </div>
                </div>
              )}
              {lookupStatus?.isPending && (
                <div style={{ background: "rgba(56, 189, 248, 0.15)", border: "1px solid #38bdf8", color: "#bae6fd", padding: "10px 12px", borderRadius: "10px", marginTop: "8px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>⏳ حسابك مسجل وبانتظار اعتماد المنسق</div>
                  <div style={{ fontSize: "11px", color: "#e0f2fe", marginBottom: "8px" }}>تم استلام بياناتك وبطاقتك وهي بانتظار اعتماد المنسق.</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (matchedStudent) {
                        setCurrentStudent(matchedStudent);
                        setAccountStatus("pending");
                      }
                    }}
                    style={{ background: "#38bdf8", color: "#000", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}
                  >
                    عرض شاشة الاعتماد والمنسقين 🔍
                  </button>
                </div>
              )}
              {lookupMessage && (
                <div style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>{lookupMessage}</div>
              )}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                الاسم الكامل:
              </label>
              <input
                type="text"
                placeholder="اسم الطالب الرباعي..."
                value={regName || matchedStudent?.full_name || ""}
                onChange={(e) => setRegName(e.target.value)}
                readOnly={!!matchedStudent}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: matchedStudent ? "rgba(255, 255, 255, 0.05)" : "#141b29",
                  border: "1px solid #2a374f",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "14px"
                }}
              />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                رقم الموبايل (واتساب):
              </label>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value)}
                style={{ width: "100%", padding: "12px", background: "#141b29", border: "1px solid #2a374f", borderRadius: "10px", color: "#fff", fontSize: "14px", direction: "ltr", textAlign: "right" }}
              />
            </div>

            {/* تصوير بطاقة الهوية القومية */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", fontWeight: "bold", marginBottom: "6px" }}>
                صورة بطاقة الرقم القومي أو كارنيه الكلية (إجباري لتأكيد الهوية): *
              </label>
              {idCardPhoto ? (
                <div style={{ position: "relative", height: "130px", borderRadius: "10px", overflow: "hidden", border: "2px solid #10b981", background: "#000" }}>
                  <img src={idCardPhoto} alt="البطاقة" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  <button
                    type="button"
                    onClick={() => setIdCardPhoto(null)}
                    className="btn-compact"
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239, 68, 68, 0.8)", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                  >
                    تغيير الصورة
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => startCamera("id")}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#38bdf8", border: "1px dashed #38bdf8", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <Camera size={16} />
                    <span>فتح الكاميرا 📷</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => idFileInputRef.current?.click()}
                    style={{ flex: 1, padding: "10px", background: "#1e293b", color: "#94a3b8", border: "1px dashed #475569", borderRadius: "8px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <FolderOpen size={16} />
                    <span>من الهاتف 📁</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !regCode || !regMobile || !idCardPhoto}
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #2563eb, #10b981)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "bold",
                fontSize: "15px",
                cursor: (loading || !regCode || !regMobile || !idCardPhoto) ? "not-allowed" : "pointer",
                opacity: (loading || !regCode || !regMobile || !idCardPhoto) ? 0.6 : 1,
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              <CheckCircle2 size={18} />
              <span>{loading ? "جاري إرسال البيانات..." : "تأكيد واستكمال تفعيل الحساب 🚀"}</span>
            </button>
          </form>
        )}
      </div>

      <footer style={{ textAlign: "center", paddingTop: "16px", color: "#64748b", fontSize: "11px" }}>
        جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
      </footer>

      {/* نافذة كاميرا بطاقة الهوية الذكية المتوافقة مع جميع شاشات الهواتف */}
      {showIdCamera && (
        <div style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          background: "#000",
          zIndex: 999999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          direction: "rtl"
        }}>
          {/* شريط العنوان وزر الإلغاء */}
          <div style={{
            flexShrink: 0,
            padding: "12px 16px",
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            zIndex: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🪪</span>
              <span style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>تصوير بطاقة الرقم القومي</span>
            </div>
            <button
              type="button"
              onClick={() => { stopCamera(); setShowIdCamera(false); }}
              style={{
                background: "rgba(239, 68, 68, 0.25)",
                color: "#ef4444",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                borderRadius: "8px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              إلغاء ✕
            </button>
          </div>

          {/* منطقة الكاميرا الحية مع إطار توجيه البطاقة */}
          <div style={{
            flex: "1 1 0%",
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#05070f"
          }}>
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* إطار توجيه بطاقة الهوية */}
            <div style={{
              position: "absolute",
              width: "84%",
              maxWidth: "380px",
              height: "56%",
              maxHeight: "240px",
              border: "3px dashed #38bdf8",
              borderRadius: "14px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 25px rgba(56, 189, 248, 0.4)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <span style={{
                color: "#38bdf8",
                fontSize: "11px",
                fontWeight: "bold",
                background: "rgba(0, 0, 0, 0.65)",
                padding: "4px 10px",
                borderRadius: "6px"
              }}>
                ضع البطاقة داخل الإطار 🪪
              </span>
            </div>
          </div>

          {/* شريط التحكم السفلي الثابت مع زر الالتقاط الكبير البارز */}
          <div style={{
            flexShrink: 0,
            padding: "16px 20px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
            background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95), #070a12)",
            borderTop: "1px solid rgba(56, 189, 248, 0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            zIndex: 10
          }}>
            <button
              type="button"
              onClick={async () => {
                const photo = captureVideoFrame();
                if (photo) {
                  try {
                    const comp = await compressImageToWebP(photo, 1000, 0.75);
                    setIdCardPhoto(comp.dataUrl);
                  } catch {
                    setIdCardPhoto(photo);
                  }
                  stopCamera();
                  setShowIdCamera(false);
                }
              }}
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "#ffffff",
                border: "5px solid #38bdf8",
                boxShadow: "0 0 25px rgba(56, 189, 248, 0.8)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
                transition: "transform 0.15s ease",
                margin: "0 auto"
              }}
              title="التقاط صورة البطاقة"
            >
              <div style={{ width: "50px", height: "50px", borderRadius: "50%", background: "#0284c7" }} />
            </button>
            <span style={{ color: "#38bdf8", fontSize: "12px", fontWeight: "bold" }}>
              اضغط هنا لالتقاط الصورة 📸
            </span>
          </div>
        </div>
      )}

      {/* نافذة تثبيت تطبيق فنية لطلاب الأندرويد والهواتف الذكية */}
      {showPwaPrompt && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          zIndex: 999999,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "16px",
          direction: "rtl"
        }}>
          <div className="animate-fade-in" style={{
            width: "100%",
            maxWidth: "420px",
            background: "linear-gradient(180deg, #182235, #0d131f)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "20px",
            padding: "24px 20px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
            textAlign: "center"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              overflow: "hidden",
              margin: "0 auto 14px",
              boxShadow: "0 8px 25px rgba(37, 99, 235, 0.5)",
              border: "2px solid #38bdf8"
            }}>
              <img src="/icon-192.png" alt="فنية" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: "900", color: "#fff", margin: "0 0 6px" }}>
              قم بتثبيت تطبيق فنية 📱
            </h3>
            <div style={{ color: "#38bdf8", fontSize: "13px", fontWeight: "bold", marginBottom: "16px" }}>
              لمتابعة حضورك وتقييماتك بشكل دائم
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.04)", padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: "18px", textAlign: "right", fontSize: "12px", color: "#cbd5e1", lineHeight: "1.9" }}>
              <div>⚡ <b>وصول فوري:</b> بنقرة واحدة من شاشتك الرئيسية دون الحاجة للرابط.</div>
              <div>🔔 <b>إشعارات حية:</b> متابعة فورية لدرجات التقييم والغياب.</div>
              <div>📷 <b>كاميرا ذكية:</b> رفع ومزامنة الأعمال الفنية ثلاثية وثنائية الأبعاد.</div>
            </div>

            {pwaHintVisible && (
              <div style={{ background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b", color: "#fbbf24", padding: "10px", borderRadius: "10px", fontSize: "12px", marginBottom: "14px" }}>
                💡 اضغط على قائمة المتصفح (الثلاث نقاط ⋮ أعلى الشاشة) ثم اختر <b>"تثبيت التطبيق"</b> أو <b>"إضافة إلى الشاشة الرئيسية"</b>.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="button"
                onClick={async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const choice = await deferredPrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      setShowPwaPrompt(false);
                      sessionStorage.setItem("pwa_install_dismissed", "1");
                    }
                    setDeferredPrompt(null);
                  } else {
                    setPwaHintVisible(true);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 15px rgba(37, 99, 235, 0.4)"
                }}
              >
                <span>تثبيت التطبيق الآن 📱</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPwaPrompt(false);
                  sessionStorage.setItem("pwa_install_dismissed", "1");
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                المتابعة عبر المتصفح 🌐
              </button>
            </div>
          </div>
        </div>
      )}

      {/* عناصر input و canvas مخفية للكاميرا */}
      <input type="file" accept="image/*" capture="environment" ref={idFileInputRef} style={{ display: "none" }} onChange={async (e) => {
        const f = e.target.files?.[0];
        if (f) {
          try {
            const comp = await compressImageToWebP(f, 1000, 0.75);
            setIdCardPhoto(comp.dataUrl);
          } catch {
            const r = new FileReader();
            r.onload = (ev) => setIdCardPhoto(ev.target?.result as string);
            r.readAsDataURL(f);
          }
        }
      }} />
    </div>
  );
}
