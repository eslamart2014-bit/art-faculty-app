"use client";

import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Ban,
  BookOpen,
  Box,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FolderOpen,
  Image as ImageIcon,
  Lock,
  Palette,
  Star,
  User,
  ZoomIn,
} from "lucide-react";

function formatRemainingTime(deadlineStr?: string | null): { text: string; isExpired: boolean; isUrgent: boolean } {
  if (!deadlineStr) return { text: '', isExpired: false, isUrgent: false };
  const target = new Date(deadlineStr).getTime();
  if (isNaN(target)) return { text: '', isExpired: false, isUrgent: false };
  const diff = target - Date.now();
  if (diff <= 0) {
    return { text: 'انتهى موعد الرفع', isExpired: true, isUrgent: false };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) {
    return { text: `متبقي: ${days} يوم و ${hours} س`, isExpired: false, isUrgent: days <= 1 };
  }
  if (hours > 0) {
    return { text: `متبقي: ${hours} س و ${minutes} د`, isExpired: false, isUrgent: true };
  }
  return { text: `متبقي: ${minutes} دقيقة`, isExpired: false, isUrgent: true };
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
                  fontWeight: 500,
                  border: projectCourseFilter === "all" ? "1px solid var(--accent-ink)" : "1px solid var(--border-light)",
                  background: projectCourseFilter === "all" ? "rgba(56, 189, 248, 0.14)" : "var(--surface)",
                  color: projectCourseFilter === "all" ? "var(--text)" : "var(--text-secondary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span className="tabular-nums">كافة المقررات ({allStudentProjects.length})</span>
                {unreadProjectsCount > 0 && (
                  <span className="tabular-nums" style={{
                    background: "var(--error)",
                    color: "#ffffff",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: 600,
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
                      fontWeight: 500,
                      border: projectCourseFilter === c.courseId ? "1px solid var(--success)" : "1px solid var(--border-light)",
                      background: projectCourseFilter === c.courseId ? "rgba(16, 185, 129, 0.14)" : "var(--surface)",
                      color: projectCourseFilter === c.courseId ? "var(--text)" : "var(--text-secondary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>{c.courseName}</span>
                    {c.instructorTitle && (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 400 }}>({c.instructorTitle})</span>
                    )}
                    {courseUnread > 0 && (
                      <span className="tabular-nums" style={{
                        background: "var(--error)",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "1px 6px"
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
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 500,
                border: projectSubTab === "required" ? "1.5px solid var(--accent-ink)" : "1px solid var(--border-light)",
                background: projectSubTab === "required" ? "rgba(56, 189, 248, 0.12)" : "var(--surface)",
                color: projectSubTab === "required" ? "var(--accent-ink)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer",
                transition: "background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out)",
                position: "relative"
              }}
            >
              <Clock size={14} strokeWidth={1.5} />
              <span>المشروعات المطلوبة</span>
              <span className="tabular-nums" style={{
                background: projectSubTab === "required" ? "var(--primary)" : "var(--surface-hover)",
                color: projectSubTab === "required" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "6px",
                fontWeight: 600
              }}>
                {requiredProjects.length}
              </span>
              {unreadRequiredCount > 0 && (
                <span className="tabular-nums" style={{
                  background: "var(--error)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  minWidth: "16px",
                  height: "16px",
                  padding: "0 4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {unreadRequiredCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setProjectSubTab("submitted")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 500,
                border: projectSubTab === "submitted" ? "1.5px solid var(--success)" : "1px solid var(--border-light)",
                background: projectSubTab === "submitted" ? "rgba(16, 185, 129, 0.12)" : "var(--surface)",
                color: projectSubTab === "submitted" ? "var(--success-ink)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                cursor: "pointer",
                transition: "background-color 0.2s var(--ease-out), border-color 0.2s var(--ease-out)",
                position: "relative"
              }}
            >
              <CheckCircle2 size={14} strokeWidth={1.5} />
              <span>المشروعات المُسلَّمة</span>
              <span className="tabular-nums" style={{
                background: projectSubTab === "submitted" ? "var(--success)" : "var(--surface-hover)",
                color: projectSubTab === "submitted" ? "#ffffff" : "var(--text-secondary)",
                fontSize: "11px",
                padding: "1px 6px",
                borderRadius: "6px",
                fontWeight: 600
              }}>
                {submittedProjects.length}
              </span>
              {unreadSubmittedCount > 0 && (
                <span className="tabular-nums" style={{
                  background: "var(--error)",
                  color: "#ffffff",
                  borderRadius: "6px",
                  minWidth: "16px",
                  height: "16px",
                  padding: "0 4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {unreadSubmittedCount}
                </span>
              )}
            </button>
          </div>

          {/* شبكة كروت المشاريع */}
          {displayedProjects.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {displayedProjects.map((proj: any) => {
                const projKey = `${proj.courseId}_${proj.title || proj.id}`;
                const seenRec = seenNotifications.seenProjects?.[projKey];
                const isNewProject = !seenRec;
                const hasNewGrade = proj.isGraded && (seenRec?.seenScore === undefined || seenRec?.seenScore === null || Number(seenRec?.seenScore) !== Number(proj.score));
                const isCardUnread = isNewProject || hasNewGrade;

                const s1En = proj.stage1Enabled !== false;
                const s2En = proj.stage2Enabled !== false;
                const activeDeadline = proj.multiStageEnabled
                  ? ((s1En && !proj.hasStage1Image) ? (proj.stage1Deadline || proj.submissionDeadline) : ((s2En && !proj.hasStage2Image) ? (proj.stage2Deadline || proj.submissionDeadline) : null))
                  : (!proj.isSubmitted ? proj.submissionDeadline : null);

                const countdown = formatRemainingTime(activeDeadline);

                return (
                  <div
                    key={`${proj.courseId}_${proj.id || proj.title}`}
                    onClick={() => handleSelectProjectForView(proj)}
                    style={{
                      background: "var(--surface)",
                      border: isCardUnread 
                        ? "1.5px solid var(--error)" 
                        : (proj.isGraded ? "1px solid rgba(16, 185, 129, 0.4)" : proj.isScoreLockedByUpload ? "1.5px solid var(--warning)" : "1px solid var(--border-light)"),
                      borderRadius: "12px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "border-color 0.2s var(--ease-out), transform 0.2s var(--ease-out)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      position: "relative"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isCardUnread ? "var(--error-ink)" : "var(--accent-ink)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isCardUnread ? "var(--error)" : (proj.isGraded ? "rgba(16, 185, 129, 0.4)" : proj.isScoreLockedByUpload ? "var(--warning)" : "var(--border-light)");
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* شارة إشعار غير مقروء لكارت المشروع */}
                    {isCardUnread && (
                      <div className="tabular-nums" style={{
                        position: "absolute",
                        top: "-9px",
                        left: "12px",
                        background: "var(--error)",
                        color: "#ffffff",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 600,
                        border: "1.5px solid var(--background)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        zIndex: 4
                      }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ffffff", display: "inline-block" }} />
                        <span>{hasNewGrade ? `درجة جديدة: ${proj.score}` : proj.isScoreLockedByUpload ? "ارفع المشروع لإظهار درجتك" : "مشروع جديد"}</span>
                      </div>
                    )}
                    {/* رأس الكارت: اسم المشروع وحالة الرفع والمؤقت */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px", lineHeight: 1.35, display: "flex", alignItems: "center", gap: "6px" }}>
                        <Palette size={15} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0 }} />
                        <span>{proj.title}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <span style={{
                          flexShrink: 0,
                          fontSize: "11px",
                          fontWeight: 500,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: proj.multiStageEnabled 
                            ? (proj.isFullySubmitted ? "rgba(16, 185, 129, 0.14)" : (proj.hasStage1Image || proj.hasStage2Image) ? "rgba(56, 189, 248, 0.14)" : "rgba(245, 158, 11, 0.14)")
                            : (proj.isSubmitted ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)"),
                          color: proj.multiStageEnabled
                            ? (proj.isFullySubmitted ? "var(--success-ink)" : (proj.hasStage1Image || proj.hasStage2Image) ? "var(--accent-ink)" : "var(--warning-ink)")
                            : (proj.isSubmitted ? "var(--success-ink)" : "var(--warning-ink)"),
                          border: `1px solid ${
                            proj.multiStageEnabled
                              ? (proj.isFullySubmitted ? "rgba(16, 185, 129, 0.35)" : (proj.hasStage1Image || proj.hasStage2Image) ? "rgba(56, 189, 248, 0.35)" : "rgba(245, 158, 11, 0.35)")
                              : (proj.isSubmitted ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.35)")
                          }`
                        }}>
                          {proj.multiStageEnabled
                            ? (proj.isFullySubmitted
                                ? <><Check size={12} strokeWidth={1.5} /><span>مكتمل التسليم</span></>
                                : (s2En && !proj.hasStage2Image && (!s1En || proj.hasStage1Image))
                                ? <><Clock size={12} strokeWidth={1.5} /><span>بانتظار المرحلة 2</span></>
                                : (s1En && !proj.hasStage1Image && (!s2En || proj.hasStage2Image))
                                ? <><Clock size={12} strokeWidth={1.5} /><span>بانتظار المرحلة 1</span></>
                                : <><Clock size={12} strokeWidth={1.5} /><span>بانتظار رفع المراحل</span></>)
                            : (proj.isSubmitted ? <><Check size={12} strokeWidth={1.5} /><span>تم الرفع</span></> : <><Clock size={12} strokeWidth={1.5} /><span>بانتظار الرفع</span></>)}
                        </span>

                        {countdown.text && !proj.isFullySubmitted && (
                          <span className="tabular-nums" style={{
                            fontSize: "10.5px",
                            fontWeight: 500,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            background: countdown.isExpired ? "rgba(239, 68, 68, 0.14)" : countdown.isUrgent ? "rgba(245, 158, 11, 0.14)" : "rgba(56, 189, 248, 0.12)",
                            color: countdown.isExpired ? "var(--error-ink)" : countdown.isUrgent ? "var(--warning-ink)" : "var(--accent-ink)",
                            border: `1px solid ${countdown.isExpired ? "rgba(239, 68, 68, 0.35)" : countdown.isUrgent ? "rgba(245, 158, 11, 0.35)" : "rgba(56, 189, 248, 0.3)"}`
                          }}>
                            {countdown.isExpired ? <Ban size={11} strokeWidth={1.5} /> : <Clock size={11} strokeWidth={1.5} />}
                            <span>{countdown.text}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* بيانات المقرر وأستاذ المقرر */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
                      <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <BookOpen size={13} strokeWidth={1.5} color="var(--accent-ink)" style={{ flexShrink: 0 }} />
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{proj.courseName}</span>
                      </div>
                      <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px" }}>
                        <User size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                        <span>أستاذ المقرر: <strong style={{ color: "var(--text)", fontWeight: 500 }}>{proj.instructorTitle}</strong></span>
                      </div>
                    </div>

                    {/* الدرجة العظمى والوضعية والنمط */}
                    <div className="tabular-nums" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "11.5px" }}>
                      <span style={{ color: "var(--text-secondary)" }}>
                        الدرجة: <strong style={{ color: "var(--warning-ink)", fontWeight: 600 }}>من {proj.maxScore}</strong>
                      </span>
                      <span style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        {proj.multiStageEnabled ? <Palette size={12} strokeWidth={1.5} /> : proj.cameraMode === "3d" ? <Box size={12} strokeWidth={1.5} /> : <ImageIcon size={12} strokeWidth={1.5} />}
                        <span>{proj.multiStageEnabled ? "مرحلتين (كل مرحلة منفصلة)" : (proj.cameraMode === "3d" ? "مجسم 3D" : "لوحة 2D")}</span>
                      </span>
                    </div>

                    {/* تذييل حالة التقييم والرفع */}
                    <div style={{ paddingTop: "2px" }}>
                      {proj.isGraded ? (
                        <div style={{
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px"
                        }}>
                          <span style={{ color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                            <Award size={14} strokeWidth={1.5} />
                            <span>تم التقييم</span>
                          </span>
                          <span className="tabular-nums" style={{ color: "var(--text)", fontWeight: 600, fontSize: "13px" }}>
                            {proj.score} / {proj.maxScore}
                          </span>
                        </div>
                      ) : proj.isScoreLockedByUpload ? (
                        <div style={{
                          background: "rgba(245, 158, 11, 0.14)",
                          border: "1px solid rgba(245, 158, 11, 0.45)",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          color: "var(--warning-ink)",
                          fontSize: "11.5px",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          textAlign: "center"
                        }}>
                          <Lock size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                          <span>تم رصد الدرجة — شرط لإظهارها: قم برفع المشروع أولاً</span>
                        </div>
                      ) : proj.isFullySubmitted ? (
                        <div style={{
                          background: "rgba(56, 189, 248, 0.08)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          color: "var(--accent-ink)",
                          fontSize: "11.5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}>
                          <Clock size={13} strokeWidth={1.5} />
                          <span>قيد التقييم (بانتظار رصد الدرجة)</span>
                        </div>
                      ) : proj.multiStageEnabled ? (
                        <div style={{
                          background: "rgba(56, 189, 248, 0.1)",
                          border: "1px solid rgba(56, 189, 248, 0.35)",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          color: "var(--accent-ink)",
                          fontSize: "11.5px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}>
                          <Camera size={13} strokeWidth={1.5} />
                          <span>اضغط لتصوير ورفع المراحل المتاحة (شرط لظهور الدرجة)</span>
                        </div>
                      ) : countdown.isExpired ? (
                        <div style={{
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          color: "var(--error-ink)",
                          fontSize: "11.5px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}>
                          <Ban size={13} strokeWidth={1.5} />
                          <span>انتهت المهلة المحددة لرفع الصور</span>
                        </div>
                      ) : (
                        <div style={{
                          background: "var(--bg-deep)",
                          border: "1px dashed var(--border-light)",
                          borderRadius: "8px",
                          padding: "7px 10px",
                          color: "var(--text-secondary)",
                          fontSize: "11.5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px"
                        }}>
                          <Camera size={13} strokeWidth={1.5} />
                          <span>اضغط للتصوير والرفع (شرط لظهور الدرجة)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-secondary)", borderRadius: "12px" }}>
              <div style={{ marginBottom: "10px", display: "flex", justifyContent: "center", color: projectSubTab === "required" ? "var(--success)" : "var(--text-muted)" }}>
                {projectSubTab === "required" ? <CheckCircle2 size={36} strokeWidth={1.5} /> : <FolderOpen size={36} strokeWidth={1.5} />}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", marginBottom: "6px" }}>
                {projectSubTab === "required" 
                  ? "لا توجد مشروعات مطلوبة حالياً" 
                  : "لم تقم بتسليم أي مشروعات حتى الآن."}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {projectSubTab === "required"
                  ? "لقد قمت بتسليم كافة الأعمال الفنية بنجاح، يمكنك متابعة تقييماتها في تبويب (المشروعات المُسلَّمة)."
                  : "تصفح تبويب (المشروعات المطلوبة) للاطلاع على المشاريع المعينة والتقاط صورها ورفعها."}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 1.2 شاشة تفاصيل المشروع المحدد وتصويره أو استعراض درجته المعتمدة */
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => setSelectedProjectForView(null)}
              className="btn-compact"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-light)",
                color: "var(--accent-ink)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowRight size={15} strokeWidth={1.5} />
              <span>الرجوع لكافة المشاريع</span>
            </button>

            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              تفاصيل المشروع والتسليم
            </span>
          </div>

          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
              <div>
                <h2 style={{ color: "var(--text)", fontSize: "17px", fontWeight: 600, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Palette size={17} strokeWidth={1.5} color="var(--accent-ink)" />
                  <span>{selectedProjectForView.title}</span>
                </h2>
                <div style={{ color: "var(--accent-ink)", fontSize: "13px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}>
                  <BookOpen size={14} strokeWidth={1.5} />
                  <span>مقرر: {selectedProjectForView.courseName}</span>
                </div>
              </div>
              <span style={{
                fontSize: "12px",
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: selectedProjectForView.isSubmitted ? "rgba(16, 185, 129, 0.14)" : "rgba(245, 158, 11, 0.14)",
                color: selectedProjectForView.isSubmitted ? "var(--success-ink)" : "var(--warning-ink)",
                border: selectedProjectForView.isSubmitted ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(245, 158, 11, 0.35)"
              }}>
                {selectedProjectForView.isSubmitted ? <Check size={13} strokeWidth={1.5} /> : <Clock size={13} strokeWidth={1.5} />}
                <span>{selectedProjectForView.isSubmitted ? "تم الرفع" : "بانتظار الرفع"}</span>
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "10px",
              background: "var(--bg-deep)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "12px"
            }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>أستاذ المقرر:</div>
                <div style={{ color: "var(--text)", fontSize: "12.5px", fontWeight: 500, marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <User size={13} strokeWidth={1.5} color="var(--text-secondary)" />
                  <span>{selectedProjectForView.instructorTitle}</span>
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>الدرجة القصوى:</div>
                <div className="tabular-nums" style={{ color: "var(--warning-ink)", fontSize: "12.5px", fontWeight: 600, marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Star size={13} strokeWidth={1.5} />
                  <span>{selectedProjectForView.maxScore} درجات</span>
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>وضعية العمل الفني:</div>
                <div style={{ color: "var(--success-ink)", fontSize: "12.5px", fontWeight: 500, marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                  {selectedProjectForView.cameraMode === "3d" ? <Box size={13} strokeWidth={1.5} /> : <ImageIcon size={13} strokeWidth={1.5} />}
                  <span>{selectedProjectForView.cameraMode === "3d" ? "مجسم ثلاثي الأبعاد" : "لوحة ثنائية الأبعاد"}</span>
                </div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>الصور المطلوبة:</div>
                <div className="tabular-nums" style={{ color: "var(--accent-ink)", fontSize: "12.5px", fontWeight: 500, marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Camera size={13} strokeWidth={1.5} />
                  <span>{selectedProjectForView.requiredPhotos || 1} صور بزوايا مختلفة</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}>
            {(() => {
              const isMulti = !!selectedProjectForView.multiStageEnabled;
              const stage1Enabled = selectedProjectForView.stage1Enabled !== false;
              const stage2Enabled = selectedProjectForView.stage2Enabled !== false;
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

              const gradeRequirementBanner = !selectedProjectForView.isGraded && (
                <div style={{
                  background: selectedProjectForView.isScoreLockedByUpload ? "rgba(245, 158, 11, 0.14)" : "rgba(56, 189, 248, 0.1)",
                  border: selectedProjectForView.isScoreLockedByUpload ? "1.5px solid var(--warning)" : "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  textAlign: "right"
                }}>
                  <Lock size={18} strokeWidth={1.5} color={selectedProjectForView.isScoreLockedByUpload ? "var(--warning-ink)" : "var(--accent-ink)"} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: selectedProjectForView.isScoreLockedByUpload ? "var(--warning-ink)" : "var(--accent-ink)", fontWeight: 600, fontSize: "13px", marginBottom: "3px" }}>
                      {selectedProjectForView.isScoreLockedByUpload
                        ? "تم رصد درجتك — شرط أساسي لظهور الدرجة: قم برفع صورة المشروع أولاً"
                        : "شرط أساسي لظهور درجة المشروع: تصوير ورفع العمل الفني أولاً"}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "11.5px", lineHeight: 1.55 }}>
                      {selectedProjectForView.isScoreLockedByUpload
                        ? "قام أستاذ المقرر بتقييم هذا المشروع، ولن تظهر درجتك المرصودة إلا بعد قيامك بتصوير ورفع العمل الفني المطلوب الآن. بمجرد الرفع ستظهر الدرجة فوراً."
                        : "يشترط نظام المقرر رفع صورة العمل الفني عبر الكاميرا المباشرة حتى تظهر لك الدرجة فور رصدها من أستاذ المقرر."}
                    </div>
                  </div>
                </div>
              );

              const nonDeletableWarningBanner = (
                <div style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  color: "var(--error-ink)",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  lineHeight: 1.55,
                  textAlign: "right",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px"
                }}>
                  <AlertTriangle size={16} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ fontWeight: 600 }}>تنبيه هام قبل التصوير:</strong> الصورة التي ستقوم برفعها لن تستطيع حذفها أو استبدالها نهائياً بعد الاعتماد، وتظهر مباشرة لأستاذ المقرر للمراجعة.
                  </div>
                </div>
              );

              if (isMulti) {
                const stage1Img = imageList.find((i: any) => typeof i === 'string' || i?.stage === 'stage1' || !i?.stage) || null;
                const stage2Img = imageList.find((i: any) => typeof i === 'object' && i?.stage === 'stage2') || null;

                const s1Dead = selectedProjectForView.stage1Deadline || selectedProjectForView.submissionDeadline;
                const s2Dead = selectedProjectForView.stage2Deadline || selectedProjectForView.submissionDeadline;
                const isS1Expired = (s1Dead ? new Date(s1Dead).getTime() < now : false) && !selectedProjectForView.isScoreLockedByUpload;
                const isS2Expired = (s2Dead ? new Date(s2Dead).getTime() < now : false) && !selectedProjectForView.isScoreLockedByUpload;
                const cd1 = formatRemainingTime(s1Dead);
                const cd2 = formatRemainingTime(s2Dead);

                const stage1Url = typeof stage1Img === 'string' ? stage1Img : (stage1Img?.url || '');
                const stage2Url = typeof stage2Img === 'string' ? stage2Img : (stage2Img?.url || '');

                const canUploadAnyStage = (stage1Enabled && !stage1Url && !isS1Expired) || (stage2Enabled && !stage2Url && !isS2Expired);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {gradeRequirementBanner}
                    {canUploadAnyStage && nonDeletableWarningBanner}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                      {/* المرحلة 1 */}
                      <div style={{ background: "var(--bg-deep)", border: stage1Enabled ? "1px solid var(--border-light)" : "1px dashed var(--border)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", opacity: (!stage1Enabled && !stage1Url) ? 0.75 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                          <span className="tabular-nums" style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "13px" }}>
                            1. {selectedProjectForView.stage1Title || 'مرحلة التحضير'}
                          </span>
                          <span style={{
                            fontSize: "10.5px",
                            fontWeight: 500,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: stage1Url ? "rgba(16, 185, 129, 0.16)" : !stage1Enabled ? "var(--surface)" : "rgba(245, 158, 11, 0.16)",
                            color: stage1Url ? "var(--success-ink)" : !stage1Enabled ? "var(--text-muted)" : "var(--warning-ink)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            {stage1Url ? <Check size={11} strokeWidth={1.5} /> : !stage1Enabled ? <Lock size={11} strokeWidth={1.5} /> : <Clock size={11} strokeWidth={1.5} />}
                            <span>{stage1Url ? "تم التسليم" : !stage1Enabled ? "غير مفعّلة حالياً" : "مطلوب"}</span>
                          </span>
                        </div>

                        {stage1Url ? (
                          <div>
                            <div
                              onClick={() => setPreviewModalImage(stage1Url)}
                              style={{ width: "100%", height: "160px", background: "#000000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-light)", position: "relative" }}
                            >
                              <img src={stage1Url} alt="المرحلة 1" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                              <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(11, 13, 20, 0.8)", color: "#ffffff", fontSize: "10.5px", padding: "3px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <ZoomIn size={12} strokeWidth={1.5} />
                                <span>تكبير</span>
                              </div>
                            </div>
                            <div style={{ color: "var(--success-ink)", fontSize: "11.5px", fontWeight: 500, marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                              <Check size={13} strokeWidth={1.5} />
                              <span>تم رفع صورة مرحلة التحضير بنجاح</span>
                            </div>
                          </div>
                        ) : !stage1Enabled ? (
                          <div style={{ background: "var(--surface)", border: "1px dashed var(--border-light)", borderRadius: "8px", padding: "18px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "11.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <Lock size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                            <span>رفع المرحلة الأولى غير مفعل حالياً من أستاذ المقرر</span>
                          </div>
                        ) : isS1Expired ? (
                          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
                            <div style={{ color: "var(--error-ink)", display: "flex", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
                              <Ban size={20} strokeWidth={1.5} />
                              <Lock size={20} strokeWidth={1.5} />
                            </div>
                            <div style={{ color: "var(--error-ink)", fontSize: "11.5px", fontWeight: 500 }}>
                              انتهت المهلة المحددة لرفع المرحلة الأولى
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center", padding: "8px 0" }}>
                            {cd1.text && (
                              <div className="tabular-nums" style={{ fontSize: "11.5px", color: cd1.isUrgent ? "var(--warning-ink)" : "var(--accent-ink)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                                <Clock size={12} strokeWidth={1.5} />
                                <span>{cd1.text}</span>
                              </div>
                            )}
                            <button
                              onClick={() => handleOpenSmartCameraForProject(selectedProjectForView, 'stage1')}
                              style={{
                                padding: "10px 14px",
                                background: "var(--primary)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: 500,
                                fontSize: "12.5px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                              }}
                            >
                              <Camera size={16} strokeWidth={1.5} />
                              <span>تصوير ورفع المرحلة الأولى</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* المرحلة 2 — منفصلة ومستقلة تماماً عن المرحلة الأولى */}
                      <div style={{ background: "var(--bg-deep)", border: stage2Enabled ? "1px solid var(--border-light)" : "1px dashed var(--border)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", opacity: (!stage2Enabled && !stage2Url) ? 0.75 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                          <span className="tabular-nums" style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "13px" }}>
                            2. {selectedProjectForView.stage2Title || 'العمل النهائي'}
                          </span>
                          <span style={{
                            fontSize: "10.5px",
                            fontWeight: 500,
                            padding: "2px 6px",
                            borderRadius: "6px",
                            background: stage2Url ? "rgba(16, 185, 129, 0.16)" : !stage2Enabled ? "var(--surface)" : "rgba(245, 158, 11, 0.16)",
                            color: stage2Url ? "var(--success-ink)" : !stage2Enabled ? "var(--text-muted)" : "var(--warning-ink)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px"
                          }}>
                            {stage2Url ? <Check size={11} strokeWidth={1.5} /> : !stage2Enabled ? <Lock size={11} strokeWidth={1.5} /> : <Clock size={11} strokeWidth={1.5} />}
                            <span>{stage2Url ? "تم التسليم" : !stage2Enabled ? "غير مفعّلة حالياً" : "مطلوب"}</span>
                          </span>
                        </div>

                        {stage2Url ? (
                          <div>
                            <div
                              onClick={() => setPreviewModalImage(stage2Url)}
                              style={{ width: "100%", height: "160px", background: "#000000", borderRadius: "8px", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-light)", position: "relative" }}
                            >
                              <img src={stage2Url} alt="المرحلة 2" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                              <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(11, 13, 20, 0.8)", color: "#ffffff", fontSize: "10.5px", padding: "3px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <ZoomIn size={12} strokeWidth={1.5} />
                                <span>تكبير</span>
                              </div>
                            </div>
                            <div style={{ color: "var(--success-ink)", fontSize: "11.5px", fontWeight: 500, marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                              <Check size={13} strokeWidth={1.5} />
                              <span>تم رفع صورة العمل النهائي المكتمل</span>
                            </div>
                          </div>
                        ) : !stage2Enabled ? (
                          <div style={{ background: "var(--surface)", border: "1px dashed var(--border-light)", borderRadius: "8px", padding: "18px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "11.5px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <Lock size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                            <span>رفع المرحلة الثانية غير مفعل حالياً من أستاذ المقرر</span>
                          </div>
                        ) : isS2Expired ? (
                          <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "8px", padding: "14px", textAlign: "center" }}>
                            <div style={{ color: "var(--error-ink)", display: "flex", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
                              <Ban size={20} strokeWidth={1.5} />
                              <Lock size={20} strokeWidth={1.5} />
                            </div>
                            <div style={{ color: "var(--error-ink)", fontSize: "11.5px", fontWeight: 500 }}>
                              انتهت المهلة المحددة لرفع المرحلة الثانية
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center", padding: "8px 0" }}>
                            {cd2.text && (
                              <div className="tabular-nums" style={{ fontSize: "11.5px", color: cd2.isUrgent ? "var(--warning-ink)" : "var(--success-ink)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                                <Clock size={12} strokeWidth={1.5} />
                                <span>{cd2.text}</span>
                              </div>
                            )}
                            <button
                              onClick={() => handleOpenSmartCameraForProject(selectedProjectForView, 'stage2')}
                              style={{
                                padding: "10px 14px",
                                background: "var(--success)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                fontWeight: 500,
                                fontSize: "12.5px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                              }}
                            >
                              <Camera size={16} strokeWidth={1.5} />
                              <span>تصوير ورفع المرحلة الثانية</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedProjectForView.isGraded ? (
                      <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1.5px solid var(--success)", borderRadius: "12px", padding: "16px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                          <Award size={18} strokeWidth={1.5} />
                          <span>الدرجة المرصودة للمشروع:</span>
                          <span className="tabular-nums" style={{ fontSize: "18px", color: "#ffffff", background: "var(--success)", padding: "2px 12px", borderRadius: "6px", fontWeight: 600 }}>
                            {selectedProjectForView.score} من {selectedProjectForView.maxScore}
                          </span>
                        </div>
                        <div style={{ color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          <Check size={14} strokeWidth={1.5} />
                          <span>تم اعتماد تقييم المشروع ومراحله رسمياً</span>
                        </div>
                      </div>
                    ) : (stage1Url || stage2Url) && !selectedProjectForView.isScoreLockedByUpload ? (
                      <div style={{ background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", padding: "14px", textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <Clock size={15} strokeWidth={1.5} />
                          <span>قيد التقييم (تم حفظ الصور المرفوعة بنجاح)</span>
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.55 }}>
                          تم حفظ صور عملك الفني بالسحابة، والمشروع بانتظار المراجعة والتقييم ورصد الدرجة من أستاذ المقرر.
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: "var(--text-muted)", fontSize: "11.5px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                        كل مرحلة منفصلة ومستقلة، ويمكنك رفع المرحلة المفعّلة مباشرة لإظهار درجة المشروع.
                      </div>
                    )}
                  </div>
                );
              }

              const singleDead = selectedProjectForView.submissionDeadline;
              const isSingleExpired = (singleDead ? new Date(singleDead).getTime() < now : false) && !selectedProjectForView.isScoreLockedByUpload;
              const singleCd = formatRemainingTime(singleDead);

              if (selectedProjectForView.isSubmitted) {
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                      <span style={{ color: "var(--text)", fontWeight: 600, fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <ImageIcon size={16} strokeWidth={1.5} color="var(--accent-ink)" />
                        <span>صورة العمل الفني المسلم:</span>
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
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
                              borderRadius: "10px",
                              overflow: "hidden",
                              border: "1px solid var(--border-light)",
                              background: "#000000",
                              position: "relative",
                              cursor: "pointer"
                            }}
                          >
                            <img src={imgUrl} alt={`عمل فني ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            <div style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(11, 13, 20, 0.8)", color: "#ffffff", fontSize: "10.5px", padding: "3px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <ZoomIn size={12} strokeWidth={1.5} />
                              <span>تكبير</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedProjectForView.submission?.created_at && (
                      <div className="tabular-nums" style={{ color: "var(--text-secondary)", fontSize: "11.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Calendar size={13} strokeWidth={1.5} />
                        <span>تاريخ الرفع:</span>
                        <span style={{ color: "var(--text)" }}>
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
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1.5px solid var(--success)",
                        borderRadius: "12px",
                        padding: "16px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px"
                      }}>
                        <div style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                          <Award size={18} strokeWidth={1.5} />
                          <span>الدرجة المرصودة:</span>
                          <span className="tabular-nums" style={{ fontSize: "18px", color: "#ffffff", background: "var(--success)", padding: "2px 12px", borderRadius: "6px", fontWeight: 600 }}>
                            {selectedProjectForView.score} من {selectedProjectForView.maxScore}
                          </span>
                        </div>
                        <div style={{ color: "var(--success-ink)", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                          <Check size={14} strokeWidth={1.5} />
                          <span>تم تقييم المشروع واعتماده رسمياً</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        background: "rgba(56, 189, 248, 0.08)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "12px",
                        padding: "16px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px"
                      }}>
                        <div style={{ color: "var(--accent-ink)", fontWeight: 600, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <Clock size={16} strokeWidth={1.5} />
                          <span>قيد التقييم (بانتظار رصد الدرجة)</span>
                        </div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "12px", lineHeight: 1.55 }}>
                          تم استلام وحفظ عملك الفني بنجاح بالسحابة، والعمل الآن بانتظار المراجعة والتقييم ورصد الدرجة من قِبل أستاذ المقرر.
                        </div>
                      </div>
                    )}

                    <div style={{ color: "var(--text-muted)", fontSize: "11.5px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <Lock size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                      <span>تم قفل خيار الرفع لمنع التكرار، والصورة المرفوعة لا يمكن حذفها إلا بمراجعة أستاذ المقرر.</span>
                    </div>
                  </div>
                );
              }

              if (isSingleExpired) {
                return (
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.35)", borderRadius: "12px", padding: "24px 16px", textAlign: "center" }}>
                    <div style={{ color: "var(--error-ink)", display: "flex", justifyContent: "center", gap: "8px", marginBottom: "10px" }}>
                      <Ban size={32} strokeWidth={1.5} />
                      <Lock size={32} strokeWidth={1.5} />
                    </div>
                    <div style={{ color: "var(--error-ink)", fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>
                      انتهت المهلة المحددة لرفع صور هذا المشروع
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "12px", maxWidth: "340px", margin: "0 auto", lineHeight: 1.6 }}>
                      تم إغلاق إمكانية رفع الصور لهذا المشروع لانتهاء المهلة الزمنية المحددة من قِبل أستاذ المقرر. في حال الحاجة لرفع العمل، يرجى مراجعة أستاذ المقرر لتمديد الموعد.
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", textAlign: "center", padding: "8px 0" }}>
                  {gradeRequirementBanner}
                  {nonDeletableWarningBanner}

                  <div style={{ display: "flex", justifyContent: "center", color: "var(--accent-ink)" }}>
                    <Camera size={36} strokeWidth={1.5} />
                  </div>
                  <div>
                    <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>
                      تصوير العمل الفني ورفعه مباشرة
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "12px", maxWidth: "340px", margin: "0 auto", lineHeight: 1.55 }}>
                      قم بتوجيه الكاميرا إلى عملك الفني مباشرة. تأكد من ثبات اليد وحسن الإضاءة، وسيتحول الإطار إلى الأخضر عند جاهزية اللقطة.
                    </div>
                  </div>

                  {singleCd.text && (
                    <div className="tabular-nums" style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      margin: "0 auto",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: singleCd.isUrgent ? "rgba(245, 158, 11, 0.14)" : "rgba(56, 189, 248, 0.14)",
                      color: singleCd.isUrgent ? "var(--warning-ink)" : "var(--accent-ink)",
                      border: `1px solid ${singleCd.isUrgent ? "rgba(245, 158, 11, 0.35)" : "rgba(56, 189, 248, 0.35)"}`
                    }}>
                      <Clock size={13} strokeWidth={1.5} />
                      <span>{singleCd.text}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleOpenSmartCameraForProject(selectedProjectForView)}
                    style={{
                      width: "100%",
                      maxWidth: "360px",
                      margin: "6px auto 0",
                      padding: "12px 20px",
                      background: "var(--primary)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      fontWeight: 500,
                      fontSize: "14.5px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <Camera size={18} strokeWidth={1.5} />
                    <span>التقاط ورفع صور المشروع لايف</span>
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
