"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Zap, ZapOff, RefreshCw, X, Camera } from "lucide-react";
import { extractStudentCode } from "@/lib/scannerHelper";

// فحص موثوق لأجهزة آبل (آيفون، آيباد) للتعامل الدقيق مع محرك سفاري
const checkIsIOS = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export interface QRScannerProps {
  onScan: (result: string) => void;
  isBusy?: boolean;
  status?: "idle" | "success" | "error";
  statusText?: string;
  onClose?: () => void;
  title?: string;
  cooldownMs?: number;
  height?: string | number;
  compact?: boolean;
}

export default function QRScanner({
  onScan,
  isBusy = false,
  status: parentStatus,
  statusText: parentStatusText,
  onClose,
  title,
  cooldownMs = 2500,
  height = "320px",
  compact = false
}: QRScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;

  // Locks and Cooldowns
  const isLockedRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  // Device detection
  const [isIOS] = useState(() => checkIsIOS());

  // Apple Mode (وضع الآيفون الخاص - لتثبيت العدسة الرئيسية ومنع التبديل التلقائي للعدسة الواسعة)
  const [appleMode, setAppleMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qr_apple_mode");
      if (saved !== null) return saved === "true";
    }
    return false;
  });

  const [availableLenses, setAvailableLenses] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedLensIndex, setSelectedLensIndex] = useState<number>(0);

  const toggleAppleMode = () => {
    const next = !appleMode;
    setAppleMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("qr_apple_mode", next ? "true" : "false");
    }
  };

  const cycleLens = () => {
    if (availableLenses.length <= 1) return;
    setSelectedLensIndex((prev) => (prev + 1) % availableLenses.length);
  };

  // UI States
  const [internalStatus, setInternalStatus] = useState<"idle" | "success" | "error">("idle");
  const [internalStatusText, setInternalStatusText] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Determine current active status
  const currentStatus = parentStatus || internalStatus;
  const currentStatusText = parentStatusText || internalStatusText;

  // Process decoded QR text safely with 0ms lock & cooldown
  const handleDecoded = useCallback((rawText: string) => {
    if (!rawText || isBusyRef.current || isLockedRef.current) return;

    const cleanCode = extractStudentCode(rawText) || rawText.trim();
    const now = Date.now();

    // Check per-code cooldown (prevent duplicate flood of same code)
    if (lastScannedRef.current.code === cleanCode && (now - lastScannedRef.current.time) < cooldownMs) {
      return;
    }

    // 0ms Synchronous Lock
    isLockedRef.current = true;
    lastScannedRef.current = { code: cleanCode, time: now };

    // Fallback feedback only if parent didn't provide custom status
    if (!parentStatus) {
      setInternalStatus("success");
      setInternalStatusText(`تم الرصد: ${cleanCode} ✅`);
    }

    // Call consumer callback to validate and trigger exact vibration pattern
    onScanRef.current(rawText);

    // Release lock after short cooldown
    setTimeout(() => {
      isLockedRef.current = false;
      setInternalStatus("idle");
      setInternalStatusText("");
    }, 700);
  }, [cooldownMs]);

  // Handle direct photo capture or image file selection (Ideal backup for iOS macro lenses / low light)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so user can pick the same file again if desired
    e.target.value = "";

    setInternalStatus("idle");
    setInternalStatusText("جاري فحص الصورة... ⏳");

    const tempId = "temp-file-qr-" + Math.random().toString(36).slice(2, 9);
    const tempDiv = document.createElement("div");
    tempDiv.id = tempId;
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    try {
      const fileScanner = new Html5Qrcode(tempId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      const decodedText = await fileScanner.scanFile(file, false);
      try { await fileScanner.clear(); } catch (err) {}
      if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv);

      if (decodedText) {
        handleDecoded(decodedText);
      } else {
        setInternalStatus("error");
        setInternalStatusText("لم يتم العثور على باركود واضح في الصورة ❌");
        setTimeout(() => {
          setInternalStatus("idle");
          setInternalStatusText("");
        }, 2200);
      }
    } catch (err) {
      if (tempDiv.parentNode) tempDiv.parentNode.removeChild(tempDiv);
      setInternalStatus("error");
      setInternalStatusText("تعذر قراءة الصورة، يرجى التقاط صورة أقرب وأوضح ❌");
      setTimeout(() => {
        setInternalStatus("idle");
        setInternalStatusText("");
      }, 2500);
    }
  };

  // Scanner lifecycle
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isDestroyed = false;
    let isStarting = true;
    const scannerId = "unified-qr-" + Math.random().toString(36).slice(2, 9);

    const div = document.createElement("div");
    div.id = scannerId;
    div.style.width = "100%";
    div.style.height = "100%";

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(div);
    }

    // Default mode: Android & Desktop use hardware BarcodeDetector
    // Apple mode: iOS uses ZXing to avoid experimental WebKit BarcodeDetector stubs
    const scanner = new Html5Qrcode(scannerId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: !appleMode
      },
      verbose: false
    });
    scannerRef.current = scanner;

    const startScannerSession = async () => {
      let cameraIdOrConfig: any = { facingMode };
      let scanConfig: any;

      if (!appleMode) {
        // EXACT UNTOUCHED WORKING DEFAULT CONFIG FOR ANDROID & DESKTOP (100% PRESERVED)
        scanConfig = {
          fps: 25,
          aspectRatio: 1.0,
          qrbox: (viewWidth: number, viewHeight: number) => {
            const edge = Math.min(viewWidth, viewHeight);
            return { width: Math.floor(edge * 0.72), height: Math.floor(edge * 0.72) };
          }
        };
        cameraIdOrConfig = { facingMode };
      } else {
        // APPLE MODE FOR IPHONE:
        // Enumerate cameras and lock to standard 1x sensor to prevent iOS from auto-switching to ultra-wide
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const backCams = devices.filter(d => {
              const lbl = (d.label || "").toLowerCase();
              return !lbl.includes("front") && !lbl.includes("user") && !lbl.includes("selfie");
            });

            // Filter out ultra-wide lenses (labels containing ultra, 0.5, wide angle)
            const mainBackCams = backCams.filter(d => {
              const lbl = (d.label || "").toLowerCase();
              return !lbl.includes("ultra") && !lbl.includes("0.5") && !lbl.includes("wide angle") && !lbl.includes("واسعة");
            });

            const candidateLenses = mainBackCams.length > 0 ? mainBackCams : (backCams.length > 0 ? backCams : devices);
            setAvailableLenses(candidateLenses);

            const chosen = candidateLenses[selectedLensIndex % candidateLenses.length] || candidateLenses[0];
            if (chosen && chosen.id) {
              cameraIdOrConfig = chosen.id; // Passing ID locks WebKit to this specific physical sensor!
            }
          }
        } catch (e) {
          console.warn("Apple mode camera enum warning:", e);
        }

        scanConfig = {
          fps: 15,
          qrbox: (viewWidth: number, viewHeight: number) => {
            const edge = Math.min(viewWidth, viewHeight);
            return { width: Math.floor(edge * 0.75), height: Math.floor(edge * 0.75) };
          }
        };
      }

      if (isDestroyed) return;

      await scanner.start(
        cameraIdOrConfig,
        scanConfig,
        (text: string) => {
          if (!isDestroyed) {
            handleDecoded(text);
          }
        },
        () => {}
      );

      isStarting = false;
      if (isDestroyed) {
        try {
          if (scanner.isScanning) {
            scanner.stop().then(() => scanner.clear()).catch(() => {});
          } else {
            scanner.clear();
          }
        } catch (e) {}
        return;
      }

      // Check torch capabilities
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if ((capabilities as any)?.torch) {
          setHasTorch(true);
        }
      } catch (e) {}

      // Intercept underlying stream for emergency instant track stop and iOS video inline enforcement
      try {
        const videoEl = div.querySelector("video") as HTMLVideoElement;
        if (videoEl) {
          videoEl.setAttribute("playsinline", "true");
          videoEl.setAttribute("webkit-playsinline", "true");
          videoEl.muted = true;
          videoEl.autoplay = true;
          if (videoEl.srcObject instanceof MediaStream) {
            streamRef.current = videoEl.srcObject;
          }
        }
      } catch (e) {}
    };

    startScannerSession().catch(err => {
      isStarting = false;
      if (!isDestroyed) {
        console.warn("Unified camera warning:", err);
        setCameraError("تعذر تشغيل الكاميرا، يرجى التأكد من صلاحيات المتصفح.");
      }
    });

    return () => {
      isDestroyed = true;

      // 1. Immediately kill all camera tracks to turn off camera hardware in 0ms!
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {}
        streamRef.current = null;
      }

      // 2. Kill any running vibrations immediately!
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(0); } catch (e) {}
      }

      // 3. Stop scanner instance
      if (scannerRef.current) {
        try {
          if (!isStarting && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
            }).catch(() => {});
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {}
      }
    };
  }, [facingMode, handleDecoded, appleMode, selectedLensIndex]);

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn("Torch toggle error:", e);
    }
  };

  // Flip Camera
  const flipCamera = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
    setTorchOn(false);
    setHasTorch(false);
  };

  // Visual reticle styling based on status
  const borderColor = currentStatus === "success" 
    ? "#10b981" 
    : currentStatus === "error" 
    ? "#ef4444" 
    : "#38bdf8";

  const glowShadow = currentStatus === "success"
    ? "0 0 25px rgba(16, 185, 129, 0.7), 0 0 0 4000px rgba(0, 0, 0, 0.55)"
    : currentStatus === "error"
    ? "0 0 25px rgba(239, 68, 68, 0.7), 0 0 0 4000px rgba(0, 0, 0, 0.55)"
    : "0 0 15px rgba(56, 189, 248, 0.4), 0 0 0 4000px rgba(0, 0, 0, 0.5)";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: height,
        minHeight: "260px",
        background: "#05070c",
        overflow: "hidden",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <style>{`
        #qr-shaded-region,
        [id^="qr-shaded-region"],
        #qr-shaded-region div {
          display: none !important;
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
        }
        video {
          object-fit: ${appleMode ? "contain" : "cover"} !important;
          width: 100% !important;
          height: 100% !important;
        }
        @keyframes laserSweep {
          0% { top: 12px; opacity: 0.3; }
          50% { top: calc(100% - 14px); opacity: 1; }
          100% { top: 12px; opacity: 0.3; }
        }
      `}</style>

      {/* Video Container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Camera Error Message */}
      {cameraError && (
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", padding: "16px", background: "rgba(239, 68, 68, 0.9)", color: "#fff", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", textAlign: "center", maxWidth: "85%", zIndex: 30 }}>
          {cameraError}
        </div>
      )}

      {/* Top HUD Controls (Torch, Flip Camera, Apple Button, Photo, Close) */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "12px",
          right: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 25,
          pointerEvents: "auto"
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              title={torchOn ? "إطفاء الكشاف" : "تشغيل الكشاف"}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: torchOn ? "rgba(245, 158, 11, 0.9)" : "rgba(15, 23, 42, 0.75)",
                border: `1px solid ${torchOn ? "#f59e0b" : "rgba(255,255,255,0.2)"}`,
                color: torchOn ? "#000" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: torchOn ? "0 0 15px rgba(245, 158, 11, 0.6)" : "none",
                transition: "all 0.2s"
              }}
            >
              {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            title="تبديل الكاميرا (أمامية / خلفية)"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            <RefreshCw size={17} />
          </button>

          {/* زر تفاحة خاص بهواتف الآيفون (لتثبيت العدسة الرئيسية ومنع العدسة الواسعة) */}
          <button
            type="button"
            onClick={toggleAppleMode}
            title={appleMode ? "إلغاء وضع الآيفون والرجوع للوضع القياسي" : "تفعيل وضع الآيفون (تثبيت العدسة الرئيسية والفوكس)"}
            style={{
              height: "36px",
              padding: "0 10px",
              borderRadius: "10px",
              background: appleMode ? "rgba(16, 185, 129, 0.25)" : "rgba(15, 23, 42, 0.75)",
              border: `1px solid ${appleMode ? "#10b981" : isIOS ? "#f59e0b" : "rgba(255,255,255,0.25)"}`,
              color: appleMode ? "#34d399" : "#fff",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
              boxShadow: appleMode ? "0 0 12px rgba(16, 185, 129, 0.5)" : isIOS ? "0 0 8px rgba(245, 158, 11, 0.4)" : "none",
              transition: "all 0.2s"
            }}
          >
            <span style={{ fontSize: "15px" }}>🍎</span>
            <span style={{ whiteSpace: "nowrap" }}>
              {appleMode ? "آيفون نشط ✓" : "وضع الآيفون"}
            </span>
          </button>

          {/* زر تبديل عدسة الآيفون إذا توفرت أكثر من عدسة خلفية */}
          {appleMode && availableLenses.length > 1 && (
            <button
              type="button"
              onClick={cycleLens}
              title="تبديل عدسة الآيفون"
              style={{
                height: "36px",
                padding: "0 8px",
                borderRadius: "10px",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid #38bdf8",
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "bold",
                transition: "all 0.2s"
              }}
            >
              <RefreshCw size={13} />
              <span>عدسة {selectedLensIndex + 1}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="التقاط صورة واضحة بالكاميرا أو اختيار صورة من المعرض"
            style={{
              height: "36px",
              padding: "0 10px",
              borderRadius: "10px",
              background: appleMode ? "rgba(245, 158, 11, 0.2)" : "rgba(15, 23, 42, 0.75)",
              border: `1px solid ${appleMode ? "#f59e0b" : "rgba(255,255,255,0.2)"}`,
              color: appleMode ? "#fbbf24" : "#38bdf8",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
              transition: "all 0.2s"
            }}
          >
            <Camera size={16} />
            <span style={{ whiteSpace: "nowrap" }}>التقاط صورة</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
        </div>

        {title && (
          <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold", background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: "8px", backdropFilter: "blur(4px)" }}>
            {title}
          </span>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="إغلاق الكاميرا"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(239, 68, 68, 0.8)",
              border: "none",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Target Reticle (محدد الهدف الموحد) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: currentStatus === "success" ? "translate(-50%, -50%) scale(1.03)" : "translate(-50%, -50%) scale(1)",
          width: compact ? "170px" : "210px",
          height: compact ? "170px" : "210px",
          border: `2px solid ${borderColor}`,
          borderRadius: "18px",
          pointerEvents: "none",
          boxShadow: glowShadow,
          transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 15
        }}
      >
        {/* 4 Neon Target Corners */}
        <div style={{ position: "absolute", top: "-2px", left: "-2px", width: "24px", height: "24px", borderTop: `4px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`, borderTopLeftRadius: "14px", transition: "border-color 0.2s" }} />
        <div style={{ position: "absolute", top: "-2px", right: "-2px", width: "24px", height: "24px", borderTop: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderTopRightRadius: "14px", transition: "border-color 0.2s" }} />
        <div style={{ position: "absolute", bottom: "-2px", left: "-2px", width: "24px", height: "24px", borderBottom: `4px solid ${borderColor}`, borderLeft: `4px solid ${borderColor}`, borderBottomLeftRadius: "14px", transition: "border-color 0.2s" }} />
        <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "24px", height: "24px", borderBottom: `4px solid ${borderColor}`, borderRight: `4px solid ${borderColor}`, borderBottomRightRadius: "14px", transition: "border-color 0.2s" }} />

        {/* Animated Laser Scanning Line */}
        {!isBusy && currentStatus !== "success" && (
          <div
            style={{
              position: "absolute",
              left: "8px",
              right: "8px",
              height: "2px",
              background: "linear-gradient(90deg, transparent, #38bdf8, #fff, #38bdf8, transparent)",
              boxShadow: "0 0 10px #38bdf8",
              animation: "laserSweep 2s ease-in-out infinite"
            }}
          />
        )}
      </div>

      {/* Floating Status Pill Badge (أسفل شباك الكاميرا) */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          background: currentStatus === "success" 
            ? "rgba(16, 185, 129, 0.95)" 
            : currentStatus === "error" 
            ? "rgba(239, 68, 68, 0.95)" 
            : isBusy 
            ? "rgba(245, 158, 11, 0.9)" 
            : "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          padding: "7px 18px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "bold",
          zIndex: 20,
          boxShadow: "0 4px 15px rgba(0,0,0,0.5)",
          border: `1px solid ${currentStatus === "success" ? "#34d399" : currentStatus === "error" ? "#f87171" : "rgba(255,255,255,0.15)"}`,
          transition: "all 0.2s ease"
        }}
      >
        {isBusy 
          ? "جاري المعالجة والفحص... ⏳" 
          : currentStatusText || (currentStatus === "success" 
            ? "تم الرصد بنجاح! ✅" 
            : currentStatus === "error" 
            ? "كود غير صالح ❌" 
            : appleMode 
            ? "🍎 وضع الآيفون نشط (العدسة مثبتة) | حافظ على مسافة 15-20 سم" 
            : isIOS 
            ? "💡 هواتف آبل: اضغط زر (وضع الآيفون 🍎) لتثبيت الفوكس والعدسة" 
            : "وجه الكاميرا داخل الإطار الأزرق 📷")}
      </div>
    </div>
  );
}
