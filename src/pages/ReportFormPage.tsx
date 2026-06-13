import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { createReport, createWeeklyReport, getChecksByItemId, getWeeklyChecksByItemId, getItem, getWeeklyItem } from "../lib/supabaseDb";
import { openCameraCapture, compressImage } from "../utils/imageUtils";
import { uploadImage } from "../lib/storage";
import type { ScanResult, ChecklistData, Item, CheckItem } from "../types";
import { motion, AnimatePresence } from "framer-motion";

// Helper function to generate check ID with format "label(code)"
function generateCheckId(label: string, code: string, index: number): string {
  const cleanCode = code.replace(/\s/g, "");
  return `${label}(${cleanCode})-${index}`;
}

// Fetch checks from database for a specific item
async function fetchChecklistFromDb(
  itemId: string,
  reportType: 'daily' | 'weekly' = 'daily'
): Promise<ChecklistData | null> {
  let item: Item | null
  if (reportType === 'weekly') {
    item = await getWeeklyItem(itemId);
  } else {
    item = await getItem(itemId);
  }
  if (!item) {
    console.error("Item not found:", itemId, "type:", reportType);
    return null;
  }

  // Then get checks
  const checks: CheckItem[] = [];
  try {
    const itemChecks = reportType === 'weekly'
      ? await getWeeklyChecksByItemId(itemId)
      : await getChecksByItemId(itemId);
    checks.push(
      ...itemChecks.map((c, index) => ({
        id: generateCheckId(c.checkLabel, item!.code, index),
        label: c.checkLabel,
        code: item!.code,
        options: c.checkOptions,
        order: c.displayOrder,
      })),
    );
  } catch (e) {
    console.error("Failed to fetch checks, using fallback");
  }

  const items: Record<string, Item> = {
    [itemId]: {
      id: item.id,
      areaId: item.areaId,
      code: item.code,
      name: item.name,
      order: item.order,
      checks,
      examplePhotoUrl: item.examplePhotoUrl,
    },
  };

  return {
    areaId: itemId,
    items,
    hasIssues: false,
  };
}

// Helper to determine option status based on array position
// 2 options: [0]=positive (green), [1]=negative (red)
// 3 options: [0]=positive (green), [1]=neutral (yellow), [2]=negative (red)
export function getOptionStatus(
  option: string,
  options: string[],
): "positive" | "neutral" | "negative" {
  const index = options.indexOf(option);
  if (index === -1) return "positive"; // Default to positive if not found

  if (options.length === 2) {
    return index === 0 ? "positive" : "negative";
  }

  if (options.length === 3) {
    if (index === 0) return "positive";
    if (index === 1) return "neutral";
    return "negative";
  }

  // For other array lengths, last option is considered negative
  return index === options.length - 1 ? "negative" : "positive";
}

// Check if option requires photo and description (negative or neutral)
export function requiresEvidence(option: string, options: string[]): boolean {
  const status = getOptionStatus(option, options);
  return status === "negative" || status === "neutral";
}

// Helper to determine if a selected option indicates an issue (memoized for efficiency)
function isIssueOption(option: string, options: string[]): boolean {
  const status = getOptionStatus(option, options);
  return status === "negative" || status === "neutral";
}

// Get button style based on option status
function getOptionButtonStyle(
  isSelected: boolean,
  status: "positive" | "neutral" | "negative",
) {
  if (!isSelected) {
    return "bg-factory-border/30 text-factory-muted border border-factory-border";
  }

  switch (status) {
    case "positive":
      return "bg-green-900/50 text-green-300 border border-green-800";
    case "neutral":
      return "bg-yellow-900/50 text-yellow-300 border border-yellow-800";
    case "negative":
      return "bg-red-900/50 text-red-300 border border-red-800";
  }
}

// Get after photo button style based on status
function getAfterPhotoButtonStyle(
  hasAfterPhoto: boolean,
  status: "positive" | "neutral" | "negative",
) {
  const baseStyle = hasAfterPhoto
    ? "bg-green-900/50 text-green-300 border border-green-800"
    : "bg-factory-accent/20 hover:bg-factory-accent/30 text-factory-accent";

  // For pending status, show orange
  if (status === "neutral") {
    return hasAfterPhoto
      ? "bg-yellow-900/50 text-yellow-300 border border-yellow-800"
      : "bg-factory-accent/20 hover:bg-factory-accent/30 text-factory-accent";
  }

  return baseStyle;
}

export default function ReportFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser } = useAuth();

  const scanResult = location.state?.scanResult as ScanResult | undefined;

  // State for checklist
  const [checklistData, setChecklistData] = useState<ChecklistData>({
    areaId: "",
    items: {},
    hasIssues: false,
  });

  // Cleanup check-level preview URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(checklistData.items).forEach((item) => {
        item.checks.forEach((check) => {
          if (check.issuePhotoPreview) {
            URL.revokeObjectURL(check.issuePhotoPreview);
          }
          if (check.afterPhotoPreview) {
            URL.revokeObjectURL(check.afterPhotoPreview);
          }
        });
      });
    };
  }, []);

  // Load checklist when scanResult changes
  useEffect(() => {
    if (scanResult) {
      void fetchChecklistFromDb(scanResult.areaId, scanResult.reportType).then((data) => {
        if (data) setChecklistData(data);
      });
    }
  }, [scanResult]);

  // State for form submission
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Track pending evidence uploads (check-level photos)
  const pendingEvidenceUploads = useRef<
    Map<string, { photoFile: File; description: string }>
  >(new Map());
  // Track pending after photo uploads
  const pendingAfterUploads = useRef<Map<string, File>>(new Map());

  // Redirect if no scan result
  useEffect(() => {
    if (!scanResult) navigate("/home", { replace: true });
  }, [scanResult, navigate]);

  // Update hasIssues when checklist changes
  useEffect(() => {
    const hasIssues = Object.values(checklistData.items).some((item) =>
      item.checks.some(
        (check) =>
          check.selectedOption &&
          isIssueOption(check.selectedOption, check.options),
      ),
    );
    if (hasIssues !== checklistData.hasIssues) {
      setChecklistData((prev) => ({ ...prev, hasIssues }));
    }
  }, [checklistData.items]);

  // Handle taking photo for check item evidence (before/issue)
  async function handleTakeIssuePhoto(itemId: string, checkId: string) {
    try {
      const file = await openCameraCapture();

      // Store in pending uploads map
      const currentCheck = checklistData.items[itemId]?.checks.find(
        (c) => c.id === checkId,
      );
      const currentDesc = currentCheck?.issueDescription || "";
      pendingEvidenceUploads.current.set(checkId, {
        photoFile: file,
        description: currentDesc,
      });

      // Create preview URL
      const url = URL.createObjectURL(file);

      // Update checklist with preview
      setChecklistData((prev) => {
        const newItems = { ...prev.items };
        if (newItems[itemId]) {
          newItems[itemId] = {
            ...newItems[itemId],
            checks: newItems[itemId].checks.map((check) =>
              check.id === checkId
                ? { ...check, issuePhotoPreview: url, issuePhotoFile: file }
                : check,
            ),
          };
        }
        return { ...prev, items: newItems };
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "Camera cancelled") {
        setSubmitError("Could not access camera. " + err.message);
      }
    }
  }

  // Handle taking after photo for check item (fix/cleanup)
  async function handleTakeAfterPhoto(itemId: string, checkId: string) {
    try {
      const file = await openCameraCapture();

      // Store in pending uploads map
      pendingAfterUploads.current.set(checkId, file);

      // Create preview URL
      const url = URL.createObjectURL(file);

      // Update checklist with preview
      setChecklistData((prev) => {
        const newItems = { ...prev.items };
        if (newItems[itemId]) {
          newItems[itemId] = {
            ...newItems[itemId],
            checks: newItems[itemId].checks.map((check) =>
              check.id === checkId
                ? { ...check, afterPhotoPreview: url, afterPhotoFile: file }
                : check,
            ),
          };
        }
        return { ...prev, items: newItems };
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "Camera cancelled") {
        setSubmitError("Could not access camera. " + err.message);
      }
    }
  }

  // Handle after photo description change
  function handleAfterDescription(
    itemId: string,
    checkId: string,
    desc: string,
  ) {
    setChecklistData((prev) => {
      const newItems = { ...prev.items };
      if (newItems[itemId]) {
        newItems[itemId] = {
          ...newItems[itemId],
          checks: newItems[itemId].checks.map((check) =>
            check.id === checkId
              ? { ...check, afterDescription: desc }
              : check,
          ),
        };
      }
      return { ...prev, items: newItems };
    });
  }

  // Handle check description change
  function handleCheckDescription(
    itemId: string,
    checkId: string,
    desc: string,
  ) {
    // Update pending uploads map
    const currentCheck = checklistData.items[itemId]?.checks.find(
      (c) => c.id === checkId,
    );
    if (currentCheck?.issuePhotoFile) {
      pendingEvidenceUploads.current.set(checkId, {
        photoFile: currentCheck.issuePhotoFile,
        description: desc,
      });
    }

    setChecklistData((prev) => {
      const newItems = { ...prev.items };
      if (newItems[itemId]) {
        newItems[itemId] = {
          ...newItems[itemId],
          checks: newItems[itemId].checks.map((check) =>
            check.id === checkId ? { ...check, issueDescription: desc } : check,
          ),
        };
      }
      return { ...prev, items: newItems };
    });
  }

  // Handle check option selection
  function handleCheckSelection(
    itemId: string,
    checkId: string,
    option: string,
  ) {
    const check = checklistData.items[itemId]?.checks.find(
      (c) => c.id === checkId,
    );
    const options = check?.options || [];

    setChecklistData((prev) => {
      const newItems = { ...prev.items };
      if (newItems[itemId]) {
        const existingCheck = newItems[itemId].checks.find(
          (c) => c.id === checkId,
        );
        const wasIssue =
          existingCheck?.selectedOption &&
          isIssueOption(existingCheck.selectedOption, existingCheck.options);
        const isNowIssue = isIssueOption(option, options);

        // If switching from issue to non-issue, clear evidence
        if (wasIssue && !isNowIssue) {
          if (prev.items[itemId]) {
            const checkToClear = prev.items[itemId].checks.find(
              (c) => c.id === checkId,
            );
            // Clean up preview URLs for the specific check
            if (checkToClear?.issuePhotoPreview) {
              URL.revokeObjectURL(checkToClear.issuePhotoPreview);
            }
            if (checkToClear?.afterPhotoPreview) {
              URL.revokeObjectURL(checkToClear.afterPhotoPreview);
            }
            // Remove from pending uploads
            pendingEvidenceUploads.current.delete(checkId);
            pendingAfterUploads.current.delete(checkId);
          }
        }

        newItems[itemId] = {
          ...newItems[itemId],
          checks: newItems[itemId].checks.map((check) =>
            check.id === checkId ? { ...check, selectedOption: option } : check,
          ),
        };
      }
      // Recalculate hasIssues
      const hasIssues = Object.values(newItems).some((item) =>
        item.checks.some(
          (check) =>
            check.selectedOption &&
            isIssueOption(check.selectedOption, check.options),
        ),
      );
      return { ...prev, items: newItems, hasIssues };
    });
  }

  async function handleSubmit() {
    if (!scanResult || !appUser) {
      setSubmitError("Please scan a QR code to submit a report");
      return;
    }

    // Validate all checks have selections
    const allChecksSelected = Object.values(checklistData.items).every((item) =>
      item.checks.every((check) => check.selectedOption),
    );
    if (!allChecksSelected) {
      setSubmitError("Please complete all checklist items");
      return;
    }

    // Validate evidence for negative/neutral selections
    const missingEvidence = Object.values(checklistData.items).flatMap((item) =>
      item.checks
        .filter(
          (check) =>
            check.selectedOption &&
            requiresEvidence(check.selectedOption, check.options),
        )
        .filter(
          (check) =>
            !check.issuePhotoFile &&
            !pendingEvidenceUploads.current.has(check.id),
        )
        .map((check) => check.label),
    );
    if (missingEvidence.length > 0) {
      setSubmitError(
        `Before photo required for: ${missingEvidence.join(", ")}`,
      );
      return;
    }

    // Validate description for negative/neutral selections
    const missingDescription = Object.values(checklistData.items).flatMap(
      (item) =>
        item.checks
          .filter(
            (check) =>
              check.selectedOption &&
              requiresEvidence(check.selectedOption, check.options),
          )
          .filter((check) => !check.issueDescription?.trim())
          .map((check) => check.label),
    );
    if (missingDescription.length > 0) {
      setSubmitError(
        `Abnormality description required for: ${missingDescription.join(", ")}`,
      );
      return;
    }

    // Validate after photo for negative/neutral selections
    const missingAfterPhoto = Object.values(checklistData.items).flatMap(
      (item) =>
        item.checks
          .filter(
            (check) =>
              check.selectedOption &&
              requiresEvidence(check.selectedOption, check.options),
          )
          .filter(
            (check) =>
              !check.afterPhotoFile &&
              !pendingAfterUploads.current.has(check.id),
          )
          .map((check) => check.label),
    );
    if (missingAfterPhoto.length > 0) {
      setSubmitError(
        `After photo (fix) required for: ${missingAfterPhoto.join(", ")}`,
      );
      return;
    }

    // Validate after description for negative/neutral selections
    const missingAfterDescription = Object.values(checklistData.items).flatMap(
      (item) =>
        item.checks
          .filter(
            (check) =>
              check.selectedOption &&
              requiresEvidence(check.selectedOption, check.options),
          )
          .filter((check) => !check.afterDescription?.trim())
          .map((check) => check.label),
    );
    if (missingAfterDescription.length > 0) {
      setSubmitError(
        `Action description required for: ${missingAfterDescription.join(", ")}`,
      );
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    setUploadProgress(0);

    try {
      // Collect all evidence photos to upload (issue photos + after photos)
      const evidenceToUpload: Array<{
        checkId: string;
        photoFile: File;
        description: string;
        type: "issue" | "after";
      }> = [];

      // Get issue photos from pending uploads map
      for (const [checkId, evidence] of pendingEvidenceUploads.current) {
        evidenceToUpload.push({
          checkId,
          photoFile: evidence.photoFile,
          description: evidence.description,
          type: "issue",
        });
      }

      // Also check checklist items for existing issue photo files not yet in pending
      for (const item of Object.values(checklistData.items)) {
        for (const check of item.checks) {
          if (
            check.issuePhotoFile &&
            !pendingEvidenceUploads.current.has(check.id)
          ) {
            evidenceToUpload.push({
              checkId: check.id,
              photoFile: check.issuePhotoFile,
              description: check.issueDescription || "",
              type: "issue",
            });
          }
        }
      }

      // Get after photos from pending uploads map
      for (const [checkId, photoFile] of pendingAfterUploads.current) {
        const checkDesc = Object.values(checklistData.items)
          .flatMap((item) => item.checks)
          .find((c) => c.id === checkId)?.afterDescription || "";
        evidenceToUpload.push({
          checkId,
          photoFile,
          description: checkDesc,
          type: "after",
        });
      }

      // Also check checklist items for existing after photo files not yet in pending
      for (const item of Object.values(checklistData.items)) {
        for (const check of item.checks) {
          if (
            check.afterPhotoFile &&
            !pendingAfterUploads.current.has(check.id)
          ) {
            evidenceToUpload.push({
              checkId: check.id,
              photoFile: check.afterPhotoFile,
              description: check.afterDescription || "",
              type: "after",
            });
          }
        }
      }

      const totalPending = evidenceToUpload.length;
      let uploaded = 0;

      // Track uploaded URLs - separate maps for issue and after photos
      const uploadedIssueUrls = new Map<string, string>();
      const uploadedAfterUrls = new Map<string, string>();
      const uploadedDescriptions = new Map<string, string>();

      // Upload all photos
      for (const evidence of evidenceToUpload) {
        const compressed = await compressImage(evidence.photoFile);
        const result = await uploadImage(compressed);

        if (evidence.type === "issue") {
          uploadedIssueUrls.set(evidence.checkId, result.url);
        } else {
          uploadedAfterUrls.set(evidence.checkId, result.url);
        }
        uploadedDescriptions.set(evidence.checkId, evidence.description);

        uploaded++;
        setUploadProgress(Math.round((uploaded / totalPending) * 100));
      }

      // Build final checklist with uploaded URLs (deep clone to preserve hasIssues)
      const finalChecklist = JSON.parse(JSON.stringify(checklistData));

      // Apply uploaded issue photo URLs
      for (const [checkId, url] of uploadedIssueUrls) {
        for (const itemId in finalChecklist.items) {
          const checkIndex = finalChecklist.items[itemId].checks.findIndex(
            (c: any) => c.id === checkId,
          );
          if (checkIndex !== -1) {
            finalChecklist.items[itemId].checks[checkIndex].issuePhotoUrl = url;
            finalChecklist.items[itemId].checks[checkIndex].issuePhotoFile =
              undefined;
            finalChecklist.items[itemId].checks[
              checkIndex
            ].issuePhotoPreview = undefined;
            const desc = uploadedDescriptions.get(checkId);
            if (desc) {
              finalChecklist.items[itemId].checks[
                checkIndex
              ].issueDescription = desc;
            }
            break;
          }
        }
      }

      // Apply uploaded after photo URLs
      for (const [checkId, url] of uploadedAfterUrls) {
        for (const itemId in finalChecklist.items) {
          const checkIndex = finalChecklist.items[itemId].checks.findIndex(
            (c: any) => c.id === checkId,
          );
          if (checkIndex !== -1) {
            finalChecklist.items[itemId].checks[checkIndex].afterPhotoUrl = url;
            finalChecklist.items[itemId].checks[checkIndex].afterPhotoFile =
              undefined;
            finalChecklist.items[itemId].checks[
              checkIndex
            ].afterPhotoPreview = undefined;
            const desc = uploadedDescriptions.get(checkId);
            if (desc) {
              finalChecklist.items[itemId].checks[
                checkIndex
              ].afterDescription = desc;
            }
            break;
          }
        }
      }

      const isWeekly = scanResult.reportType === 'weekly';
      if (isWeekly) {
        // Determine week start (start of current week, Monday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekStart = monday.getTime();

        await createWeeklyReport(
          {
            areaId: scanResult.areaId,
            description: checklistData.hasIssues ? 'Report with issues' : 'Routine report',
            gpsLat: scanResult.gpsLat,
            gpsLng: scanResult.gpsLng,
            sessionId: scanResult.sessionId,
            checklistData: finalChecklist,
            reportType: 'weekly',
            weekStart,
          },
          appUser.uid,
        );
      } else {
        await createReport(
          {
            areaId: scanResult.areaId,
            description: checklistData.hasIssues ? 'Report with issues' : 'Routine report',
            gpsLat: scanResult.gpsLat,
            gpsLng: scanResult.gpsLng,
            sessionId: scanResult.sessionId,
            checklistData: finalChecklist,
          },
          appUser.uid,
        );
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-factory-dark flex flex-col items-center justify-center p-6 gap-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
        >
          <svg
            className="w-12 h-12 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </motion.div>
        <div className="text-center">
          <h2 className="text-white text-2xl font-bold">Report Submitted</h2>
          <p className="text-factory-muted mt-2">
            Your report has been sent to the team leader.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/home")}
          className="bg-factory-accent text-white px-8 py-3.5 rounded-xl font-semibold min-h-[44px]"
        >
          Back to Home
        </motion.button>
      </motion.div>
    );
  }

  if (!scanResult) return null;

  const sortedItems = Object.values(checklistData.items).sort(
    (a, b) => a.order - b.order,
  );
  const scanItem = sortedItems[0]; // Get the scanned item for example photo

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-factory-dark flex flex-col"
    >
      {/* Header */}
      <header className="bg-factory-card border-b border-factory-border px-4 py-4 flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
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
        <div>
          <h1 className="text-white font-semibold">Report Issue</h1>
          <p className="text-factory-accent text-xs font-medium">
            {scanResult.areaName}
          </p>
        </div>
      </header>

      {/* Example Photo Section */}
      {scanItem?.examplePhotoUrl && (
        <div className="p-4 bg-factory-card border-b border-factory-border">
          <p className="text-xs text-factory-muted mb-2">Example Reference:</p>
          <img
            src={scanItem.examplePhotoUrl}
            alt="Example reference"
            className="w-full max-h-48 object-cover rounded-xl"
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Checklist Section */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Inspection Checklist <span className="text-red-400">*</span>
          </label>

          <div className="space-y-4">
            {sortedItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: item.order * 0.01 }}
                className="bg-factory-card border border-factory-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{item.name}</h3>
                    <p className="text-factory-accent text-xs">{item.code}</p>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center rounded-full">
                    {item.checks.every(
                      (check) =>
                        check.selectedOption &&
                        !isIssueOption(check.selectedOption, check.options),
                    ) ? (
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {item.checks
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((check) => {
                      const showEvidence =
                        check.selectedOption &&
                        requiresEvidence(check.selectedOption, check.options);
                      const optStatus = check.selectedOption
                        ? getOptionStatus(check.selectedOption, check.options)
                        : "positive";

                      return (
                        <div key={check.id} className="flex flex-col gap-2">
                          <span className="text-white text-sm font-medium">
                            {check.label}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {check.options.map((option) => {
                              const isSelected =
                                check.selectedOption === option;
                              const optStatus = getOptionStatus(
                                option,
                                check.options,
                              );
                              return (
                                <button
                                  key={option}
                                  onClick={() =>
                                    handleCheckSelection(
                                      item.id,
                                      check.id,
                                      option,
                                    )
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${getOptionButtonStyle(
                                    isSelected,
                                    optStatus,
                                  )}`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>

                          {/* Evidence section - show only for negative/neutral options */}
                          {showEvidence && (
                            <div className="mt-2 p-3 bg-factory-border/20 rounded-lg space-y-3">
                              {/* Issue/Before Photo capture */}
                              <div>
                                <span className="text-xs text-red-400 block mb-1">
                                  Foto Masalah (Before) <span className="text-red-400">*</span>
                                </span>
                                {check.issuePhotoPreview ? (
                                  <div className="relative rounded-lg overflow-hidden bg-factory-card border border-factory-border max-w-xs">
                                    <img
                                      src={check.issuePhotoPreview}
                                      alt="Evidence"
                                      className="w-full max-h-32 object-cover"
                                    />
                                    <button
                                      onClick={() => {
                                        setChecklistData((prev) => {
                                          const newItems = { ...prev.items };
                                          if (newItems[item.id]) {
                                            newItems[item.id] = {
                                              ...newItems[item.id],
                                              checks: newItems[
                                                item.id
                                              ].checks.map((c) =>
                                                c.id === check.id
                                                  ? {
                                                      ...c,
                                                      issuePhotoPreview:
                                                        undefined,
                                                      issuePhotoFile: undefined,
                                                      issuePhotoUrl: undefined,
                                                    }
                                                  : c,
                                              ),
                                            };
                                          }
                                          return { ...prev, items: newItems };
                                        });
                                        pendingEvidenceUploads.current.delete(
                                          check.id,
                                        );
                                      }}
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
                                ) : (
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() =>
                                      void handleTakeIssuePhoto(
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
                                    Ambil Foto Masalah
                                  </motion.button>
                                )}
                              </div>

                              {/* Description */}
                              <div>
                                <span className="text-xs text-yellow-400 block mb-1">
                                  Deskripsikan Masalah
                                </span>
                                <textarea
                                  value={check.issueDescription || ""}
                                  onChange={(e) =>
                                    handleCheckDescription(
                                      item.id,
                                      check.id,
                                      e.target.value,
                                    )
                                  }
                                  rows={2}
                                  maxLength={300}
                                  placeholder="Deskripsikan masalah..."
                                  className="w-full bg-factory-card border border-factory-border rounded-lg px-3 py-2 text-white placeholder-factory-muted focus:outline-none focus:border-yellow-500 transition-colors resize-none text-xs"
                                />
                              </div>

                              {/* After/Fix Photo capture - required for issues */}
                              <div>
                                <span className="text-xs text-green-400 block mb-1">
                                  Ambil Foto Setelah Tindakan <span className="text-red-400">*</span>
                                </span>
                                {check.afterPhotoPreview ? (
                                  <div className="relative rounded-lg overflow-hidden bg-factory-card border border-factory-border max-w-xs">
                                    <img
                                      src={check.afterPhotoPreview}
                                      alt="After"
                                      className="w-full max-h-32 object-cover"
                                    />
                                    <button
                                      onClick={() => {
                                        setChecklistData((prev) => {
                                          const newItems = { ...prev.items };
                                          if (newItems[item.id]) {
                                            newItems[item.id] = {
                                              ...newItems[item.id],
                                              checks: newItems[
                                                item.id
                                              ].checks.map((c) =>
                                                c.id === check.id
                                                  ? {
                                                      ...c,
                                                      afterPhotoPreview:
                                                        undefined,
                                                      afterPhotoFile: undefined,
                                                      afterPhotoUrl: undefined,
                                                      afterDescription: undefined,
                                                    }
                                                  : c,
                                              ),
                                            };
                                          }
                                          return { ...prev, items: newItems };
                                        });
                                        pendingAfterUploads.current.delete(
                                          check.id,
                                        );
                                      }}
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
                                ) : (
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() =>
                                      void handleTakeAfterPhoto(
                                        item.id,
                                        check.id,
                                      )
                                    }
                                    className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 min-h-[44px] ${getAfterPhotoButtonStyle(
                                      !!check.afterPhotoUrl,
                                      optStatus,
                                    )}`}
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
                                    Ambil Foto Setelah Tindakan
                                  </motion.button>
                                )}
                              </div>

                              {/* Action description - required for issues */}
                              <div>
                                <span className="text-xs text-green-400 block mb-1">
                                  Deskripsi Tindakan yang Dilakukan <span className="text-red-400">*</span>
                                </span>
                                <textarea
                                  value={check.afterDescription || ""}
                                  onChange={(e) =>
                                    handleAfterDescription(
                                      item.id,
                                      check.id,
                                      e.target.value,
                                    )
                                  }
                                  rows={2}
                                  maxLength={300}
                                  placeholder="Jelaskan tindakan yang dilakukan..."
                                  className="w-full bg-factory-card border border-factory-border rounded-lg px-3 py-2 text-white placeholder-factory-muted focus:outline-none focus:border-green-500 transition-colors resize-none text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-3"
            >
              {submitError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload progress */}
        <AnimatePresence>
          {submitting && uploadProgress > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex justify-between text-xs text-factory-muted mb-1">
                <span>Uploading photos...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-factory-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-factory-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Submit button */}
      <div className="p-4 bg-factory-dark border-t border-factory-border">
        <motion.button
          whileTap={{
            scale: submitting ? 1 : 0.97,
          }}
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="w-full bg-factory-accent hover:bg-factory-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 transition-colors min-h-[52px] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </>
          ) : (
            "Submit Report"
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
