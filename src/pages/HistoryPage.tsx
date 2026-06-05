import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getReportsByWorkerId, updateCheckAfterPhoto } from "../lib/supabaseDb";
import { openCameraCapture, dataUrlToFile } from "../utils/imageUtils";
import type { Report } from "../types";
import { motion, AnimatePresence } from "framer-motion";

// Storage key for persisting after photo state
const AFTER_PHOTO_STORAGE_KEY = 'history-after-photo-state';

interface PendingAfterPhotoState {
  reportId: string;
  itemId: string;
  checkId: string;
  description: string;
  dataUrl: string;
  timestamp: number;
}

export default function HistoryPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingCheckId, setUpdatingCheckId] = useState<string | null>(null);

  // Track pending after photo uploads
  const pendingAfterUploads = useRef<
    Map<string, { photoFile: File | null; description: string; previewUrl: string }>
  >(new Map());

  // Track if we just made changes (to prevent restoration loop)
  const isRestoringRef = useRef(false);

  // Restore preview state from sessionStorage on mount (handles mobile page reloads)
  useEffect(() => {
    // Only restore if we have reports loaded and not already restoring
    if (reports.length === 0 || isRestoringRef.current) return;
    
    const saved = sessionStorage.getItem(AFTER_PHOTO_STORAGE_KEY);
    if (saved) {
      try {
        const parsed: PendingAfterPhotoState = JSON.parse(saved);
        if (parsed && parsed.checkId) {
          // Check if this report still exists in the loaded reports
          const reportExists = reports.find(r => r.reportId === parsed.reportId);
          if (reportExists) {
            // Check if we've already restored this state (preview URL already exists)
            const alreadyRestored = reportExists.checklistData?.items[parsed.itemId]?.checks.find(
              (c: any) => c.id === parsed.checkId && c.afterPhotoPreview
            );
            if (alreadyRestored) {
              sessionStorage.removeItem(AFTER_PHOTO_STORAGE_KEY);
              return;
            }
            
            isRestoringRef.current = true;
            
            // Convert dataUrl back to File for upload
            dataUrlToFile(parsed.dataUrl, `after-${parsed.checkId}.jpg`).then((file) => {
              const previewUrl = URL.createObjectURL(file);
              pendingAfterUploads.current.set(parsed.checkId, {
                photoFile: file,
                description: parsed.description || "",
                previewUrl,
              });
              
              // Update state to show preview
              setReports((prev) => {
                isRestoringRef.current = false;
                return prev.map((r) => {
                  if (r.reportId === parsed.reportId && r.checklistData) {
                    const updatedItems = { ...r.checklistData.items };
                    if (updatedItems[parsed.itemId]) {
                      const checkIndex = updatedItems[parsed.itemId].checks.findIndex(
                        (c) => c.id === parsed.checkId,
                      );
                      if (checkIndex !== -1) {
                        updatedItems[parsed.itemId].checks[checkIndex] = {
                          ...updatedItems[parsed.itemId].checks[checkIndex],
                          afterPhotoPreview: previewUrl,
                          afterDescription: parsed.description || "",
                        };
                      }
                    }
                    return {
                      ...r,
                      checklistData: { ...r.checklistData, items: updatedItems },
                    };
                  }
                  return r;
                });
              });
            }).catch(() => {
              isRestoringRef.current = false;
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse saved preview state', e);
      }
    }
  }, [reports]);

  // Clear preview state after submit
  function clearPreviewState() {
    sessionStorage.removeItem(AFTER_PHOTO_STORAGE_KEY);
  }

  useEffect(() => {
    if (!appUser) {
      navigate("/login", { replace: true });
      return;
    }

    loadReports();
  }, [appUser, navigate]);

  // Cleanup on unmount - revoke all pending preview URLs
  useEffect(() => {
    return () => {
      pendingAfterUploads.current.forEach((pending) => {
        if (pending.previewUrl) {
          URL.revokeObjectURL(pending.previewUrl);
        }
      });
      pendingAfterUploads.current.clear();
    };
  }, []);

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

  async function handleUpdateAfterPhoto(reportId: string, checkId: string) {
    try {
      const pending = pendingAfterUploads.current.get(checkId);
      if (!pending?.photoFile) return;

      setUpdatingCheckId(checkId);

      // Revoke preview URL before upload
      if (pending.previewUrl) {
        URL.revokeObjectURL(pending.previewUrl);
      }

      await updateCheckAfterPhoto(reportId, checkId, pending.photoFile, undefined, pending.description);

      // Remove from pending and clear storage
      pendingAfterUploads.current.delete(checkId);
      clearPreviewState();

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

      // Store file in ref for upload
      pendingAfterUploads.current.set(checkId, {
        photoFile: file,
        description: "",
        previewUrl: url,
      });

      // Convert file to dataUrl for sessionStorage persistence
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const state: PendingAfterPhotoState = {
            reportId,
            itemId,
            checkId,
            description: "",
            dataUrl,
            timestamp: Date.now()
          };
          sessionStorage.setItem(AFTER_PHOTO_STORAGE_KEY, JSON.stringify(state));
        };
        reader.readAsDataURL(file);
      } catch {
        // Ignore storage errors
      }

      // Update local state to show preview - use functional update to ensure we get latest state
      setReports((prev) => {
        const report = prev.find((r) => r.reportId === reportId);
        const existingDesc = report?.checklistData?.items[itemId]?.checks.find((c) => c.id === checkId)?.afterDescription || "";

        // Update the description in ref (for upload later)
        pendingAfterUploads.current.set(checkId, {
          ...pendingAfterUploads.current.get(checkId)!,
          description: existingDesc,
        });

        // Update the description in sessionStorage as well
        try {
          const saved = sessionStorage.getItem(AFTER_PHOTO_STORAGE_KEY);
          if (saved) {
            const parsed: PendingAfterPhotoState = JSON.parse(saved);
            parsed.description = existingDesc;
            sessionStorage.setItem(AFTER_PHOTO_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {
          // Ignore storage errors
        }

        return prev.map((r) => {
          if (r.reportId === reportId && r.checklistData) {
            const updatedItems = { ...r.checklistData.items };
            if (updatedItems[itemId]) {
              const checkIndex = updatedItems[itemId].checks.findIndex(
                (c) => c.id === checkId,
              );
              if (checkIndex !== -1) {
                updatedItems[itemId].checks[checkIndex] = {
                  ...updatedItems[itemId].checks[checkIndex],
                  afterPhotoPreview: url,
                  afterDescription: existingDesc,
                };
              }
            }
            return {
              ...r,
              checklistData: { ...r.checklistData, items: updatedItems },
            };
          }
          return r;
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "Camera cancelled") {
        setError("Could not access camera: " + err.message);
      }
    }
  }

  // Handle after description change
  function handleAfterDescription(
    reportId: string,
    itemId: string,
    checkId: string,
    desc: string,
  ) {
    const pending = pendingAfterUploads.current.get(checkId);
    if (pending) {
      pendingAfterUploads.current.set(checkId, {
        ...pending,
        description: desc,
      });
    }

    setReports((prev) =>
      prev.map((report) => {
        if (report.reportId === reportId && report.checklistData) {
          const updatedItems = { ...report.checklistData.items };
          if (updatedItems[itemId]) {
            updatedItems[itemId].checks = updatedItems[itemId].checks.map(
              (c) =>
                c.id === checkId
                  ? { ...c, afterDescription: desc }
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

// Remove preview and pending upload
   function handleRemoveAfterPreview(
     reportId: string,
     itemId: string,
     checkId: string,
   ) {
     // Clean up preview URL from pending uploads ref
     const pending = pendingAfterUploads.current.get(checkId);
     if (pending?.previewUrl) {
       URL.revokeObjectURL(pending.previewUrl);
       clearPreviewState();
     }
    
     // Also clean up from current state if it exists
     setReports((prev) => {
       const report = prev.find((r) => r.reportId === reportId);
       const check = report?.checklistData?.items[itemId]?.checks.find((c) => c.id === checkId);
       // Only revoke if not already done above
       if (check?.afterPhotoPreview && !pending?.previewUrl) {
         URL.revokeObjectURL(check.afterPhotoPreview);
       }
       return prev.map((r) => {
         if (r.reportId === reportId && r.checklistData) {
           const updatedItems = { ...r.checklistData.items };
           if (updatedItems[itemId]) {
             updatedItems[itemId].checks = updatedItems[itemId].checks.map(
               (c) =>
                 c.id === checkId
                   ? {
                       ...c,
                       afterPhotoPreview: undefined,
                       afterPhotoFile: undefined,
                     }
                   : c,
             );
           }
           pendingAfterUploads.current.delete(checkId);
           return {
             ...r,
             checklistData: { ...r.checklistData, items: updatedItems },
           };
         }
         return r;
       });
     });
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
                            const hasPreview = !!check.afterPhotoPreview;

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
                                  <div className="mt-2 space-y-2">
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
                                        {/* Show after description if exists */}
                                        {check.afterDescription && (
                                          <p className="text-factory-muted text-xs mt-1 line-clamp-1">
                                            {check.afterDescription}
                                          </p>
                                        )}
                                      </div>
                                    ) : hasPreview ? (
                                      <div>
                                        <span className="text-yellow-400 text-xs block mb-1">
                                          After (Pending):
                                        </span>
                                        <div className="relative rounded-lg overflow-hidden">
                                          <img
                                            src={check.afterPhotoPreview}
                                            alt="After preview"
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
                                        
                                        {/* After description input */}
                                        <textarea
                                          value={check.afterDescription || ""}
                                          onChange={(e) =>
                                            handleAfterDescription(
                                              report.reportId,
                                              item.id,
                                              check.id,
                                              e.target.value,
                                            )
                                          }
                                          rows={2}
                                          maxLength={300}
                                          placeholder="Describe what you did to fix..."
                                          className="w-full mt-2 bg-factory-card border border-factory-border rounded-lg px-2 py-1 text-white placeholder-factory-muted focus:outline-none focus:border-yellow-500 transition-colors resize-none text-xs"
                                        />
                                        
                                        <motion.button
                                          whileTap={{ scale: 0.97 }}
                                          onClick={() =>
                                            void handleUpdateAfterPhoto(
                                              report.reportId,
                                              check.id,
                                            )
                                          }
                                          disabled={
                                            updatingCheckId === check.id
                                          }
                                          className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 min-h-[44px]"
                                        >
                                          {updatingCheckId === check.id
                                            ? "Submitting..."
                                            : "Submit Fix"}
                                        </motion.button>
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