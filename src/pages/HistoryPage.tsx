import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getReportsByWorkerId, updateCheckAfterPhoto } from "../lib/supabaseDb";
import { openCameraCapture } from "../utils/imageUtils";
import type { Report } from "../types";
import { motion, AnimatePresence } from "framer-motion";

export default function HistoryPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingCheckId, setUpdatingCheckId] = useState<string | null>(null);

  // Track pending after photo uploads
  const pendingAfterUploads = useRef<Map<string, File>>(new Map());
  // Track pending after action text (checkId -> action text)
  const pendingAfterActions = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!appUser) {
      navigate("/login", { replace: true });
      return;
    }

    loadReports();
  }, [appUser, navigate]);

  async function loadReports() {
    try {
      setLoading(true);
      setError(null);
      const userReports = await getReportsByWorkerId(appUser!.uid);
      setReports(userReports);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load report history",
      );
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function getStatusColor(
    status: Report["status"],
    hasIssues: boolean,
  ): string {
    if (status === "pending" && hasIssues) {
      return "bg-red-900/50 text-red-300 border-red-800"; // Issues pending
    }
    switch (status) {
      case "pending":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-800";
      case "in_progress":
        return "bg-blue-900/50 text-blue-300 border-blue-800";
      case "resolved":
        return "bg-green-900/50 text-green-300 border-green-800";
      default:
        return "bg-factory-border/50 text-factory-muted border-factory-border";
    }
  }

  function getStatusLabel(status: Report["status"]): string {
    switch (status) {
      case "pending":
        return "Pending";
      case "in_progress":
        return "In Progress";
      case "resolved":
        return "Resolved";
      default:
        return "Unknown";
    }
  }

  // Check if check needs after photo (negative/neutral without after photo)
  function needsAfterPhoto(check: any): boolean {
    if (!check.selectedOption) return false;
    const option = check.selectedOption;
    const options = check.options || [];
    const index = options.indexOf(option);
    // Negative or neutral - but also needs to NOT have after photo
    const isIssue =
      options.length === 2
        ? index === 1
        : options.length === 3
          ? index >= 1
          : index === options.length - 1;
    return isIssue && !check.afterPhotoUrl;
  }

  async function handleUpdateAfterPhoto(reportId: string, checkId: string, afterAction?: string) {
    try {
      const file = pendingAfterUploads.current.get(checkId);
      if (!file) return;

      setUpdatingCheckId(checkId);

      await updateCheckAfterPhoto(reportId, checkId, file, afterAction);

      // Remove from pending
      pendingAfterUploads.current.delete(checkId);
      pendingAfterActions.current.delete(checkId);

      // Reload reports to get updated data
      loadReports();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update after photo",
      );
    } finally {
      setUpdatingCheckId(null);
    }
  }

  // Handle taking after photo for a check
  async function handleTakeAfterPhoto(
    reportId: string,
    itemId: string,
    checkId: string,
  ) {
    try {
      const file = await openCameraCapture();

      // Create preview URL
      const url = URL.createObjectURL(file);

      // Store in pending uploads
      pendingAfterUploads.current.set(checkId, file);
      // Get existing action text if any
      const existingAction = pendingAfterActions.current.get(checkId) || "";
      pendingAfterActions.current.set(checkId, existingAction);

      // Update local state to show preview
      setReports((prev) =>
        prev.map((report) => {
          if (report.reportId === reportId && report.checklistData) {
            const updatedItems = { ...report.checklistData.items };
            if (updatedItems[itemId]) {
              const checkIndex = updatedItems[itemId].checks.findIndex(
                (c) => c.id === checkId,
              );
              if (checkIndex !== -1) {
                updatedItems[itemId].checks[checkIndex].afterPhotoPreview = url;
                updatedItems[itemId].checks[checkIndex].afterAction =
                  existingAction;
              }
            }
            return {
              ...report,
              checklistData: { ...report.checklistData, items: updatedItems },
            };
          }
          return report;
        }),
      );
    } catch (err) {
      if (err instanceof Error && err.message !== "Camera cancelled") {
        setError("Could not access camera: " + err.message);
      }
    }
  }

  // Handle action text change for a pending after photo
  function handleAfterActionChange(
    reportId: string,
    itemId: string,
    checkId: string,
    actionText: string,
  ) {
    // Store in pending actions map
    pendingAfterActions.current.set(checkId, actionText);

    // Update local state
    setReports((prev) =>
      prev.map((report) => {
        if (report.reportId === reportId && report.checklistData) {
          const updatedItems = { ...report.checklistData.items };
          if (updatedItems[itemId]) {
            const checkIndex = updatedItems[itemId].checks.findIndex(
              (c) => c.id === checkId,
            );
            if (checkIndex !== -1) {
              updatedItems[itemId].checks[checkIndex].afterAction =
                actionText;
            }
          }
          return {
            ...report,
            checklistData: { ...report.checklistData, items: updatedItems },
          };
        }
        return report;
      }),
    );
  }

  // Remove preview and pending upload
  function handleRemoveAfterPreview(
    reportId: string,
    itemId: string,
    checkId: string,
  ) {
    const report = reports.find((r) => r.reportId === reportId);
    const check = report
      ?.checklistData?.items[itemId]?.checks.find((c) => c.id === checkId);

    if (check?.afterPhotoPreview) {
      URL.revokeObjectURL(check.afterPhotoPreview);
    }
    pendingAfterUploads.current.delete(checkId);
    pendingAfterActions.current.delete(checkId);

    setReports((prev) =>
      prev.map((report) => {
        if (report.reportId === reportId && report.checklistData) {
          const updatedItems = { ...report.checklistData.items };
          if (updatedItems[itemId]) {
            updatedItems[itemId].checks = updatedItems[itemId].checks.map(
              (c) =>
                c.id === checkId
                  ? {
                      ...c,
                      afterPhotoPreview: undefined,
                      afterPhotoFile: undefined,
                      afterAction: undefined,
                    }
                  : c,
            );
          }
          return {
            ...report,
            checklistData: { ...report.checklistData, items: updatedItems },
          };
        }
        return report;
      }),
    );
  }

  if (!appUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark flex flex-col"
    >
      {/* Header */}
      <header className="bg-factory-card border-b border-factory-border px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold">Report History</h1>
          <p className="text-factory-accent text-xs font-medium">
            Your submitted reports
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/home")}
          className="w-11 h-11 rounded-xl bg-factory-border/50 flex items-center justify-center text-white"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </motion.button>
      </header>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-3 mx-4 my-4"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-factory-accent/30 border-t-factory-accent animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-factory-muted">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-4xl mb-3">📋</p>
              <p>No reports found</p>
              <p className="text-sm mt-2">
                Start scanning QR codes to submit reports
              </p>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <motion.div
                key={report.reportId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: report.reportId.length * 0.01 }}
                className="bg-factory-card border border-factory-border rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-white font-medium text-sm truncate">
                    {report.areaName || report.areaId}
                  </p>
                  <span
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${getStatusColor(report.status, report.checklistData?.hasIssues ?? false)}`}
                  >
                    {getStatusLabel(report.status)}
                  </span>
                </div>

                <div className="text-factory-muted/60 text-xs mb-3">
                  Submitted: {formatDate(report.timestamp)}
                </div>

                {/* Checklist data with condition photos */}
                {report.checklistData && (
                  <div className="space-y-3">
                    {Object.values(report.checklistData.items).map((item) => (
                      <div
                        key={item.id}
                        className="border-t border-factory-border pt-3"
                      >
                        <p className="text-factory-accent text-xs font-medium mb-2">
                          {item.name} ({item.code})
                        </p>
                        <div className="space-y-2">
                          {item.checks.map((check) => {
                            const needsPhoto = needsAfterPhoto(check);
                            const hasAfterPhoto = !!check.afterPhotoUrl;

                            return (
                              <div
                                key={check.id}
                                className="p-2 bg-factory-dark/50 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white text-xs font-medium">
                                    {check.label}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      check.selectedOption
                                        ? "bg-red-900/50 text-red-300"
                                        : "bg-factory-border/50 text-factory-muted"
                                    }`}
                                  >
                                    {check.selectedOption || "Not selected"}
                                  </span>
                                </div>

                                {/* Show before photo */}
                                {check.issuePhotoUrl && (
                                  <div className="mt-2">
                                    <span className="text-red-400 text-xs block mb-1">
                                      Before:
                                    </span>
                                    <img
                                      src={check.issuePhotoUrl}
                                      alt="Before"
                                      className="w-full max-h-24 object-cover rounded border border-factory-border"
                                    />
                                  </div>
                                )}

                                {/* Description */}
                                {check.issueDescription && (
                                  <p className="text-factory-muted text-xs mt-1 line-clamp-1">
                                    {check.issueDescription}
                                  </p>
                                )}

                                {/* After photo or upload button */}
                                {needsPhoto && (
                                  <div className="mt-2">
                                    {hasAfterPhoto ? (
                                      <div>
                                        <span className="text-green-400 text-xs block mb-1">
                                          After:
                                        </span>
                                        <img
                                          src={check.afterPhotoUrl}
                                          alt="After"
                                          className="w-full max-h-24 object-cover rounded border border-factory-border"
                                        />
                                        {check.afterAction && (
                                          <p className="text-factory-muted text-xs mt-1 line-clamp-2">
                                            Tindakan: {check.afterAction}
                                          </p>
                                        )}
                                      </div>
                                    ) : check.afterPhotoPreview ? (
                                      <div>
                                        <span className="text-yellow-400 text-xs block mb-1">
                                          After (Pending):
                                        </span>
                                        <div className="relative">
                                          <img
                                            src={check.afterPhotoPreview}
                                            alt="After"
                                            className="w-full max-h-24 object-cover rounded border border-factory-border"
                                          />
                                          <button
                                            onClick={() =>
                                              handleRemoveAfterPreview(
                                                report.reportId,
                                                item.id,
                                                check.id,
                                              )
                                            }
                                            className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded"
                                          >
                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth={2}
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 18L18 6M6 6l12 12"
                                              />
                                            </svg>
                                          </button>
                                        </div>
                                        <textarea
                                          value={
                                            pendingAfterActions.current.get(
                                              check.id,
                                            ) || check.afterAction || ""
                                          }
                                          onChange={(e) =>
                                            handleAfterActionChange(
                                              report.reportId,
                                              item.id,
                                              check.id,
                                              e.target.value,
                                            )
                                          }
                                          placeholder="Tindakan yang dilakukan..."
                                          rows={2}
                                          maxLength={300}
                                          className="w-full bg-factory-card border border-factory-border rounded-lg px-3 py-2 text-white placeholder-factory-muted focus:outline-none focus:border-yellow-500 transition-colors resize-none text-xs mt-1"
                                        />
                                        <button
                                          onClick={() =>
                                            handleUpdateAfterPhoto(
                                              report.reportId,
                                              check.id,
                                              pendingAfterActions.current.get(
                                                check.id,
                                              ) || check.afterAction,
                                            )
                                          }
                                          disabled={
                                            updatingCheckId === check.id
                                          }
                                          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 min-h-[36px] mt-1"
                                        >
                                          {updatingCheckId === check.id
                                            ? "Mengupload..."
                                            : "Submit Fix"}
                                        </button>
                                      </div>
                                    ) : (
                                      <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() =>
                                          void handleTakeAfterPhoto(
                                            report.reportId,
                                            item.id,
                                            check.id,
                                          )
                                        }
                                        className="bg-factory-accent/20 hover:bg-factory-accent/30 text-factory-accent text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[44px]"
                                      >
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                                          />
                                        </svg>
                                        Take After Photo
                                      </motion.button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-factory-muted/60 text-xs mt-2">
                  Submitted: {formatDate(report.timestamp)}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </motion.div>
  );
}
