import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getReportsByWorkerId } from "../lib/supabaseDb";
import type { Report, CheckItem } from "../types";
import { motion, AnimatePresence } from "framer-motion";

// Determine background class based on option status
function getCheckStatusBg(check: CheckItem): string {
  const options = check.options || [];
  const selectedOption = check.selectedOption;
  if (!selectedOption) return "";

  const index = options.indexOf(selectedOption);
  if (index === -1) return "";

  if (options.length === 2) {
    return index === 0 ? "bg-green-900/30" : "bg-red-900/30";
  }
  if (options.length === 3) {
    if (index === 0) return "bg-green-900/30";
    if (index === 1) return "bg-yellow-900/30";
    return "bg-red-900/30";
  }
  // Default: last option = negative
  return index === options.length - 1 ? "bg-red-900/30" : "bg-green-900/30";
}

// Determine badge color class for the option label pill
function getCheckBadgeColor(check: CheckItem): string {
  const options = check.options || [];
  const selectedOption = check.selectedOption;
  if (!selectedOption) return "bg-factory-border/50 text-factory-muted";

  const index = options.indexOf(selectedOption);
  if (index === -1) return "bg-factory-border/50 text-factory-muted";

  if (options.length === 2) {
    return index === 0
      ? "bg-green-900/50 text-green-300"
      : "bg-red-900/50 text-red-300";
  }
  if (options.length === 3) {
    if (index === 0) return "bg-green-900/50 text-green-300";
    if (index === 1) return "bg-yellow-900/50 text-yellow-300";
    return "bg-red-900/50 text-red-300";
  }
  // Default: last option = negative
  return index === options.length - 1
    ? "bg-red-900/50 text-red-300"
    : "bg-green-900/50 text-green-300";
}

export default function HistoryPage() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                            const checkBg = getCheckStatusBg(check);

                            return (
                              <div
                                key={check.id}
                                className={`p-2 bg-factory-dark/50 rounded-lg ${checkBg}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white text-xs font-medium">
                                    {check.label}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${getCheckBadgeColor(check)}`}
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

                                {/* After photo (read-only, already submitted with report) */}
                                {check.afterPhotoUrl && (
                                  <div className="mt-2">
                                    <span className="text-green-400 text-xs block mb-1">
                                      After:
                                    </span>
                                    <img
                                      src={check.afterPhotoUrl}
                                      alt="After"
                                      className="w-full max-h-24 object-cover rounded border border-factory-border"
                                    />
                                  </div>
                                )}

                                {/* Action description (read-only) */}
                                {check.afterDescription && (
                                  <p className="text-factory-muted text-xs mt-1 line-clamp-2 italic">
                                    Action taken: {check.afterDescription}
                                  </p>
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
