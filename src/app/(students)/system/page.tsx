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
  KeyRound,
  Palette,
  Shield,
  WifiOff
} from "lucide-react";
import { formatStudentCode } from "@/lib/students/codeHelper";
import { getOrCreateDeviceInfo, isAndroidAppClient, isInstalledPWA, isIOSClient } from "@/lib/auth/deviceFingerprint";
import { saveStudentQrCard } from "@/lib/students/qrCardDownloader";
import { compressImageToWebP } from "@/lib/students/imageCompressor";
import StudentLockerTab from "@/components/lockers/StudentLockerTab";
import QRCode from "react-qr-code";
import StudentMigrationNotice from "@/components/students/StudentMigrationNotice";
import StudentAttendanceTab from "@/components/students/StudentAttendanceTab";
import StudentWarningsTab from "@/components/students/StudentWarningsTab";
import StudentQrModal from "@/components/students/StudentQrModal";
import StudentSelfieModal from "@/components/students/StudentSelfieModal";
import StudentArtworkCameraModal from "@/components/students/StudentArtworkCameraModal";
import StudentPendingView from "@/components/students/StudentPendingView";
import StudentAuthView from "@/components/students/StudentAuthView";
import StudentProjectsTab from "@/components/students/StudentProjectsTab";

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
        setSelfieMsg("تم حفظ صورتك الشخصية واعتمادها بنجاح!");
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

    // تهيئة بيئة Telegram WebApp داخل بوابة الطالب لضمان عمل التحميلات والإشعارات
    if (typeof window !== "undefined") {
      try {
        const initTgWebApp = () => {
          const tg = (window as any).Telegram?.WebApp;
          if (tg) {
            try {
              tg.ready();
              tg.expand();
              if (tg.initDataUnsafe?.user?.id) {
                localStorage.setItem("fania_tg_id", String(tg.initDataUnsafe.user.id));
              }
            } catch {}
          }
        };
        if ((window as any).Telegram?.WebApp) {
          initTgWebApp();
        } else if (!document.querySelector('script[src*="telegram-web-app.js"]')) {
          const s = document.createElement("script");
          s.src = "https://telegram.org/js/telegram-web-app.js";
          s.async = true;
          s.onload = initTgWebApp;
          document.head.appendChild(s);
        }
      } catch {}
    }

    // حقن تلقائي لتوكن الطالب المحفوظ في جميع طلبات الـ API لضمان عدم خروج الطالب أبداً في بيئة تيليجرام
    if (typeof window !== "undefined" && !(window as any).__faniaFetchPatched) {
      const origFetch = window.fetch.bind(window);
      (window as any).__faniaFetchPatched = true;
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request)?.url || "";
          if (urlStr.startsWith("/api/")) {
            const stuToken = localStorage.getItem("fania_student_token");
            if (stuToken) {
              const headers = new Headers(init?.headers || {});
              if (!headers.has("x-student-token")) {
                headers.set("x-student-token", stuToken);
              }
              return origFetch(input, { ...init, headers });
            }
          }
        } catch {}
        return origFetch(input, init);
      };
    }

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

      const isNativeApp = isAndroidAppClient();
      const isPWA = isInstalledPWA();
      const isTelegramClient =
        !isNativeApp &&
        !isPWA &&
        (params.get("tg") === "1" ||
          sessionStorage.getItem("fania_tg_verified") === "1" ||
          Boolean(
            (window as any).Telegram?.WebApp?.initData ||
              (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id
          ));

      if (isTelegramClient) {
        try {
          sessionStorage.setItem("fania_tg_verified", "1");
        } catch (e) {}
      }

      // إغلاق كامل لبوابة الطلاب من أي تطبيق أندرويد (APK) أو تطبيق مثبت (PWA) أو أي رابط ويب خارج بوت تليجرام (أندرويد أو آيفون أو متصفح)
      if (isNativeApp || isPWA || !isTelegramClient) {
        setShowMigrationModal(true);
        return;
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

      // إذا كانت هناك جلسة محفوظة للطالب: الدخول الفوري الدائم دون تسجيل خروج تلقائي أبداً
      if (savedSession?.student_code) {
        setCurrentStudent(savedSession);
        setAccountStatus(savedSession.status || "active");

        // إذا كان الجهاز غير متصل بالإنترنت: اعرض البيانات المحفوظة محلياً فوراً
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setIsOffline(true);
          return;
        }

        // إذا كان متصلاً بالإنترنت: نجدد توكن الجلسة في الخلفية ونحمّل البيانات دون إخراج الطالب
        try {
          const sessionRes = await fetch(`/api/students/session?code=${encodeURIComponent(savedSession.student_code)}`, {
            cache: "no-store",
            credentials: "same-origin"
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData?.token) {
              localStorage.setItem("fania_student_token", sessionData.token);
            }
          }
          if (typeof window !== "undefined" && window.location.search) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          await loadDashboard(savedSession.student_code);
          fetchCoordinators(savedSession.student_code);
          return;
        } catch (netErr) {
          // اتصال ضعيف أو تعذر الوصول للسيرفر: استمر في عرض البيانات المحلية كوضع أوفلاين
          setIsOffline(true);
          return;
        }
      } else {
        // إذا لم تكن هناك جلسة محلية، نفحص إن كان الطالب يفتح من داخل تيليجرام لاستعادة حسابه المربوط تلقائياً
        const tgUserId =
          (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) ||
          (typeof window !== "undefined" ? localStorage.getItem("fania_tg_id") : null);

        if (tgUserId) {
          try {
            const tgRes = await fetch(`/api/tg/auth?tg_id=${encodeURIComponent(String(tgUserId))}`, {
              cache: "no-store",
              credentials: "same-origin"
            });
            const tgData = await tgRes.json();
            if (tgData?.authenticated && tgData.student) {
              const restoredSession = {
                student_code: tgData.student.student_code,
                full_name: tgData.student.full_name,
                academic_year: tgData.student.academic_year,
                section: tgData.student.section,
                status: "active"
              };
              localStorage.setItem("fania_student_session", JSON.stringify(restoredSession));
              localStorage.setItem("fania_student_code", tgData.student.student_code);
              if (tgData.token) localStorage.setItem("fania_student_token", tgData.token);
              setCurrentStudent(restoredSession);
              setAccountStatus("active");
              await loadDashboard(tgData.student.student_code);
              fetchCoordinators(tgData.student.student_code);
              return;
            }
          } catch {}
        }

        // لا يوجد حساب مربوط داخل البوت: توجيه لشاشة دخول البوت المباشرة بالكود ومعرف تليجرام
        if (typeof window !== "undefined") {
          window.location.replace("/tg/portal");
          return;
        }
      }
    } catch (e) {}
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

  // Sync session with Native Android App for Background Notifications & Track Install
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const isNative = isAndroidAppClient();
      const bridge = (window as any).ArtEduNativeBridge;
      const code = currentStudent?.student_code;

      if ((isNative || bridge) && code) {
        fetch("/api/students/track-install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            student_code: code,
            action: "install",
            version: "1.0.6",
            source: "android_native_app_session"
          })
        }).catch(() => {});
      }

      if (bridge) {
        if (code) {
          const token = localStorage.getItem("fania_student_token") || "";
          bridge.saveStudentSession(code, currentStudent.full_name || "", token);
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
                  body: JSON.stringify({ token: pt, student_code: code })
                }).catch(() => {});
              } else if (tries > 0) {
                setTimeout(() => registerPush(tries - 1), 2000);
              }
            } catch (e) {}
          };
          registerPush(10);
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
          setSuccessMsg("تم اعتماد حسابك بنجاح! يرجى إدخال الرقم السري لتسجيل الدخول.");
          if (typeof window !== "undefined") {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } else if (data.isNew) {
          localStorage.removeItem("fania_student_session");
          setCurrentStudent(null);
          setAccountStatus(null);
          setAuthMode("register");
          setErrorMsg("تم إعادة تعيين بيانات التسجيل من قبل المنسق. يرجى إعادة إدخال بياناتك بشكل صحيح.");
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

  // Load Dashboard Data (with automatic session token renewal — never auto-logouts a bound student)
  const loadDashboard = async (code: string, isImpersonationMode?: boolean, isRetry?: boolean) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const dev = getOrCreateDeviceInfo();
      const impParam = isImpersonationMode || isImpersonating ? "&impersonate=true" : "";
      const savedToken = typeof window !== "undefined" ? localStorage.getItem("fania_student_token") || "" : "";
      const res = await fetch(`/api/students/dashboard-data?code=${encodeURIComponent(code)}&deviceId=${encodeURIComponent(dev.deviceId)}${impParam}&_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "x-device-id": dev.deviceId,
          ...(savedToken ? { "x-student-token": savedToken } : {})
        }
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403 && data?.suspended && !isImpersonationMode && !isImpersonating) {
          try {
            localStorage.removeItem("fania_student_session");
            localStorage.removeItem("fania_student_code");
            localStorage.removeItem("fania_student_token");
            localStorage.removeItem("fania_cached_dashboard_data");
          } catch {}
          if (typeof window !== "undefined") {
            window.location.replace("/tg/portal");
          }
          return;
        }
        if (res.status === 401 && !isRetry) {
          // تجديد صامت للتوكن في الخلفية وإعادة المحاولة دون تسجيل خروج الطالب أبداً
          try {
            const refreshRes = await fetch(`/api/students/session?code=${encodeURIComponent(code)}`, {
              cache: "no-store",
              credentials: "same-origin"
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData?.token) {
                localStorage.setItem("fania_student_token", refreshData.token);
                return await loadDashboard(code, isImpersonationMode, true);
              }
            }
          } catch {}
        } else if (res.status !== 401) {
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

  // تسجيل تنقل الطالب بين الأقسام (المشاريع، الحضور، الدواليب، الإنذارات) في سجل نشاط البوت للإدارة
  const lastTrackedTabRef = useRef<{ tab: string; time: number } | null>(null);
  useEffect(() => {
    const code = currentStudent?.student_code || (typeof window !== "undefined" ? localStorage.getItem("fania_student_code") : null);
    if (!code || isImpersonating) return;

    const actionMap: Record<string, string> = {
      evaluation: "view_projects",
      attendance: "view_attendance",
      warnings: "view_warnings",
      lockers: "view_lockers"
    };

    const action = actionMap[activeTab];
    if (!action) return;

    const now = Date.now();
    if (lastTrackedTabRef.current && lastTrackedTabRef.current.tab === action && now - lastTrackedTabRef.current.time < 30_000) {
      return; // منع التكرار خلال 30 ثانية
    }
    lastTrackedTabRef.current = { tab: action, time: now };

    fetch("/api/students/search-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        student_code: code,
        student_name: currentStudent?.full_name || "",
        academic_year: currentStudent?.academic_year || "",
        section: currentStudent?.section || ""
      })
    }).catch(() => {});
  }, [activeTab, currentStudent?.student_code, isImpersonating]);

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
        setSuccessMsg("تم تسجيل الدخول بنجاح. مرحباً بك في منظومة فنية.");
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

  const [isSavingQr, setIsSavingQr] = useState(false);
  const [qrSavedSuccess, setQrSavedSuccess] = useState(false);

  const handleDownloadQR = async () => {
    if (!currentStudent) return;
    setIsSavingQr(true);
    setQrSavedSuccess(false);
    try {
      const res = await saveStudentQrCard({
        student_code: currentStudent.student_code,
        full_name: currentStudent.full_name || '',
        academic_year: currentStudent.academic_year || '',
        section: currentStudent.section || '',
        svgElementId: 'student-qr-code'
      });
      if (res.success && res.method !== 'share_aborted') {
        setQrSavedSuccess(true);
        setTimeout(() => setQrSavedSuccess(false), 3500);
      }
    } catch (err: any) {
      console.error('QR download failed:', err);
      alert('تعذر حفظ كارت الـ QR تلقائياً، يمكنك أخذ لقطة شاشة (Screenshot) للرمز.');
    } finally {
      setIsSavingQr(false);
    }
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
        setComplaintSuccessMsg("تم إرسال شكوتك بنجاح. سوف يتم مراجعتها والرد عليك قريباً. يرجى متابعة هذا القسم للاطلاع على الرد فور اعتماده.");
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
  // VIEW 0: شاشة انتقال البوابة إلى بوت تليجرام (Student Migration to Telegram Bot)
  // ==========================================
  if (showMigrationModal) {
    return <StudentMigrationNotice />;
  }

  // ==========================================
  // VIEW 2: شاشة لوحة بيانات الطالب المفعل (Active Student Dashboard)
  // ==========================================
  if (currentStudent) {
    return (
      <div style={{ minHeight: "100vh", padding: "12px 16px", maxWidth: "550px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        
        {/* شريط وضع تصفح الإدارة العائم */}
        {isImpersonating && (
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            background: "var(--danger)",
            color: "#ffffff",
            padding: "10px 14px",
            borderRadius: "10px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid var(--error)"
          }}>
            <div className="tabular-nums" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={15} strokeWidth={1.5} style={{ flexShrink: 0 }} />
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
                background: "rgba(255, 255, 255, 0.16)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                padding: "4px 8px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0
              }}
            >
              <span>الرجوع للوحة الإدارة</span>
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* شريط حالة الاتصال ومزامنة البيانات */}
        {isOffline ? (
          <div style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "10px",
            padding: "10px 14px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "12px",
            color: "var(--warning-ink)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <WifiOff size={16} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "12px" }}>أنت غير متصل بالإنترنت</div>
                <div style={{ fontSize: "10.5px", color: "var(--text-secondary)" }}>تتصفح البيانات المحفوظة محلياً على جهازك</div>
              </div>
            </div>
            {lastSyncTime && (
              <div style={{
                textAlign: "left",
                fontSize: "11px",
                color: "var(--warning-ink)",
                background: "var(--bg-deep)",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--border)"
              }}>
                <span style={{ color: "var(--text-secondary)" }}>آخر تحديث: </span>
                <span className="tabular-nums" style={{ direction: "ltr", display: "inline-block", fontWeight: 600 }}>{lastSyncTime}</span>
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
            fontSize: "11px",
            color: "var(--text-muted)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", display: "inline-block" }}></span>
              <span style={{ color: "var(--text-secondary)" }}>متصل بالخادم</span>
            </div>
            <div className="tabular-nums" style={{ direction: "ltr" }}>
              آخر مزامنة: {lastSyncTime}
            </div>
          </div>
        ) : null}

        {/* شريط أعلى منظم: دائرة الحساب، اسم الطالب وكوده بوضوح، وأزرار التحكم */}
        <div className="student-top-bar">
          {/* قسم بيانات وهوية الطالب ودائرة الحساب */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, width: "100%" }}>
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
                  ? "var(--bg-deep)"
                  : "var(--success)",
                border: (currentStudent?.avatar_url || currentStudent?.photo_url)
                  ? "2px solid var(--accent-ink)"
                  : "2px solid var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                transition: "border-color 0.2s var(--ease-out)"
              }}
              title={currentStudent?.avatar_url || currentStudent?.photo_url ? "صورتك الشخصية (اضغط لتغييرها)" : "اضغط هنا لالتقاط صورتك الشخصية"}
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
                  fontSize: "22px",
                  fontWeight: 600,
                  lineHeight: 1,
                  userSelect: "none"
                }}>
                  +
                </div>
              )}
            </div>

            {/* الاسم الكامل والكود والفرقة */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div 
                style={{ 
                  color: "var(--text)", 
                  fontWeight: 600, 
                  fontSize: "13.5px", 
                  lineHeight: 1.3,
                  wordBreak: "break-word"
                }}
                title={currentStudent.full_name}
              >
                {currentStudent.full_name}
              </div>
              <div className="tabular-nums" style={{ 
                color: "var(--accent-ink)", 
                fontSize: "11px", 
                display: "flex", 
                alignItems: "center", 
                gap: "4px", 
                flexWrap: "wrap",
                marginTop: "2px",
                lineHeight: 1.25
              }}>
                <span style={{ fontWeight: 600 }}>كود: {formatStudentCode(currentStudent.student_code)}</span>
                {currentStudent.academic_year && (
                  <>
                    <span style={{ color: "var(--text-muted)" }}>•</span>
                    <span style={{ color: "var(--text-secondary)" }}>{currentStudent.academic_year}</span>
                  </>
                )}
                {currentStudent.section && (
                  <>
                    <span style={{ color: "var(--text-muted)" }}>•</span>
                    <span style={{ color: "var(--text)" }}>سكشن {currentStudent.section}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* مجموعة أزرار التحكم للطالب المثبت */}
          <div 
            className="student-actions-group"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
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
                color: "var(--success-ink)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                fontSize: "11.5px",
                fontWeight: 500,
                height: "32px",
                width: "100%",
                padding: "0 4px",
                whiteSpace: "nowrap"
              }}
            >
              <QrCode size={14} strokeWidth={1.5} />
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
                color: "var(--accent-ink)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                fontSize: "11.5px",
                fontWeight: 500,
                height: "32px",
                width: "100%",
                padding: "0 4px",
                whiteSpace: "nowrap"
              }}
            >
              <RotateCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* تابات التنقل الرئيسية لشاشة الطالب */}
        <div 
          style={{ 
            display: "grid", 
            gridTemplateColumns: `repeat(${dashboardData?.hide_warnings_tab ? 3 : 4}, 1fr)`, 
            gap: "6px", 
            marginBottom: "12px",
            width: "100%"
          }}
        >
          {[
            { id: "evaluation", label: "المشاريع", Icon: Palette, color: "#10b981", badge: unreadProjectsCount },
            { id: "attendance", label: "الحضور", Icon: CalendarCheck, color: "#38bdf8", badge: unreadAttendanceCount },
            ...(!dashboardData?.hide_warnings_tab ? [{ id: "warnings", label: "الإنذارات", Icon: AlertTriangle, color: "#ef4444", badge: unreadWarningsCount }] : []),
            { id: "lockers", label: "الدواليب", Icon: Archive, color: "#f59e0b", badge: unreadLockersCount }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.Icon;
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
                  padding: "8px 4px",
                  borderRadius: "8px",
                  border: isActive ? `1px solid ${tab.color}` : "1px solid var(--border)",
                  background: isActive ? `${tab.color}1a` : "var(--surface)",
                  color: isActive ? "var(--text)" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  textAlign: "center",
                  lineHeight: 1.2
                }}
              >
                <TabIcon size={14} strokeWidth={1.5} color={isActive ? tab.color : "currentColor"} />
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span 
                    title={`${tab.badge} جديد`}
                    className="tabular-nums"
                    style={{
                      position: "absolute",
                      top: "-6px",
                      left: "-2px",
                      background: "var(--error)",
                      color: "#ffffff",
                      borderRadius: "6px",
                      minWidth: "18px",
                      height: "18px",
                      padding: "0 4px",
                      fontSize: "10px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid var(--background)",
                      zIndex: 10
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
          <StudentProjectsTab
            dashboardData={dashboardData}
            allStudentProjects={allStudentProjects}
            requiredProjects={requiredProjects}
            submittedProjects={submittedProjects}
            displayedProjects={displayedProjects}
            projectCourseFilter={projectCourseFilter}
            setProjectCourseFilter={setProjectCourseFilter}
            projectSubTab={projectSubTab}
            setProjectSubTab={setProjectSubTab}
            unreadProjectsCount={unreadProjectsCount}
            unreadRequiredCount={unreadRequiredCount}
            unreadSubmittedCount={unreadSubmittedCount}
            seenNotifications={seenNotifications}
            selectedProjectForView={selectedProjectForView}
            setSelectedProjectForView={setSelectedProjectForView}
            handleSelectProjectForView={handleSelectProjectForView}
            handleOpenSmartCameraForProject={handleOpenSmartCameraForProject}
            setPreviewModalImage={setPreviewModalImage}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 2: ATTENDANCE (سجل الحضور والغياب مع جدول التواريخ التلقائي) */}
        {/* ========================================================= */}
        {activeTab === "attendance" && (
          <StudentAttendanceTab attendance={dashboardData?.attendance} />
        )}

        {/* ========================================================= */}
        {/* TAB 3: WARNINGS (الإنذارات وتجاوز نسب الغياب) */}
        {/* ========================================================= */}
        {activeTab === "warnings" && !dashboardData?.hide_warnings_tab && (
          <StudentWarningsTab warnings={dashboardData?.warnings} />
        )}

        {/* ========================================================= */}
        {/* TAB 4: LOCKERS (حجز الدواليب) */}
        {/* ========================================================= */}
        {activeTab === "lockers" && currentStudent && (
          <div className="animate-fade-in">
            <StudentLockerTab student={currentStudent} />
          </div>
        )}

        {/* نافذة الكاميرا المباشرة الذكية ومراجعة الصور قبل الرفع */}
        <StudentArtworkCameraModal
          showArtworkCamera={showArtworkCamera}
          setShowArtworkCamera={setShowArtworkCamera}
          activeProjectForUpload={activeProjectForUpload}
          cameraMode={cameraMode}
          currentPhotoStep={currentPhotoStep}
          setCurrentPhotoStep={setCurrentPhotoStep}
          requiredPhotosCount={requiredPhotosCount}
          orientationFrame={orientationFrame}
          setOrientationFrame={setOrientationFrame}
          torchOn={torchOn}
          toggleTorch={toggleTorch}
          stopCamera={stopCamera}
          startCamera={startCamera}
          isShutterFlashing={isShutterFlashing}
          setVideoRef={setVideoRef}
          cameraFrameState={cameraFrameState}
          capturedPhotos={capturedPhotos}
          setCapturedPhotos={setCapturedPhotos}
          handleSnapArtworkPhoto={handleSnapArtworkPhoto}
          handleSubmitArtwork={handleSubmitArtwork}
          uploadingProject={uploadingProject}
        />

        {/* نافذة تكبير الصورة (Lightbox Modal) */}
        {previewModalImage && (
          <div 
            onClick={() => setPreviewModalImage(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(11, 13, 20, 0.92)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", cursor: "pointer" }}
          >
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
              <img src={previewModalImage} alt="عرض مكبر" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: "10px", objectFit: "contain", border: "1px solid var(--border-light)" }} />
              <button 
                onClick={() => setPreviewModalImage(null)}
                className="btn-compact"
                style={{ position: "absolute", top: "-12px", right: "-12px", background: "var(--error)", color: "#ffffff", border: "none", width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              >
                <X size={16} strokeWidth={1.5} />
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
          <StudentQrModal
            student={currentStudent}
            isSavingQr={isSavingQr}
            qrSavedSuccess={qrSavedSuccess}
            onDownloadQr={handleDownloadQR}
            onClose={() => setShowQRModal(false)}
          />
        )}

        {/* نافذة التقاط الصورة الشخصية السيلفي وحفظها على التليجرام */}
        {showSelfieModal && (
          <StudentSelfieModal
            selfieVideoRef={selfieVideoRef}
            selfiePhoto={selfiePhoto}
            setSelfiePhoto={setSelfiePhoto}
            selfieMsg={selfieMsg}
            setSelfieMsg={setSelfieMsg}
            faceDetected={faceDetected}
            isSavingSelfie={isSavingSelfie}
            startSelfieCamera={startSelfieCamera}
            stopSelfieCamera={stopSelfieCamera}
            captureSelfieFrame={captureSelfieFrame}
            handleSaveSelfie={handleSaveSelfie}
            onClose={() => setShowSelfieModal(false)}
          />
        )}

        <footer style={{ textAlign: "center", paddingTop: "24px", paddingBottom: "16px", color: "var(--text-muted)", fontSize: "11px" }}>
          جامعة قنا • كلية التربية النوعية • قسم التربية الفنية
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: إذا لم يكن مسجلاً أو فتح خارج تليجرام -> شاشة الانتقال إلى تليجرام
  // ==========================================
  if (!isClientReady) {
    return <div style={{ minHeight: "100vh", background: "var(--background)" }} />;
  }

  return <StudentMigrationNotice />;
}