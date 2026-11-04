"use client";

import React from "react";
import { Camera } from "lucide-react";

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

interface StudentProjectsTabProps {
  dashboardData: any;
  allStudentProjects: any[];
  requiredProjects: any[];
  submittedProjects: any[];
  displayedProjects: any[];
  projectCourseFilter: string;
  setProjectCourseFilter: (filter: string) => void;
  projectSubTab: "required" | "submitted";
  setProjectSubTab: (tab: "required" | "submitted") => void;
  unreadProjectsCount: number;
  unreadRequiredCount: number;
  unreadSubmittedCount: number;
  seenNotifications: any;
  selectedProjectForView: any;
  setSelectedProjectForView: (proj: any) => void;
  handleSelectProjectForView: (proj: any) => void;
  handleOpenSmartCameraForProject: (proj: any, stage?: "stage1" | "stage2") => void;
  setPreviewModalImage: (url: string | null) => void;
}

export default function StudentProjectsTab({
  dashboardData,
  allStudentProjects,
  requiredProjects,
  submittedProjects,
  displayedProjects,
  projectCourseFilter,
  setProjectCourseFilter,
  projectSubTab,
  setProjectSubTab,
  unreadProjectsCount,
  unreadRequiredCount,
  unreadSubmittedCount,
  seenNotifications,
  selectedProjectForView,
  setSelectedProjectForView,
  handleSelectProjectForView,
  handleOpenSmartCameraForProject,
  setPreviewModalImage,
}: StudentProjectsTabProps) {
  return (
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
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
  );
}
