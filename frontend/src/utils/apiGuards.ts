import type {
  JobsSearchFailureResponse,
  JobsSearchResponse,
  JobsSearchSuccessResponse,
  ResumeUploadFailureResponse,
  ResumeUploadResponse,
  ResumeUploadSuccessResponse,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseResumeUploadResponse(json: unknown): ResumeUploadResponse {
  if (!isRecord(json) || typeof json.success !== "boolean") {
    return { success: false, error: "Invalid response from server" };
  }
  if (json.success === true) {
    const text = json.resume_text;
    const len = json.text_length;
    if (typeof text !== "string" || typeof len !== "number") {
      return { success: false, error: "Invalid upload payload" };
    }
    const ok: ResumeUploadSuccessResponse = {
      success: true,
      resume_text: text,
      text_length: len,
    };
    return ok;
  }
  const err = json.error;
  const fail: ResumeUploadFailureResponse = {
    success: false,
    error: typeof err === "string" ? err : "Upload failed",
  };
  return fail;
}

export function parseJobsSearchResponse(json: unknown): JobsSearchResponse {
  if (!isRecord(json) || typeof json.success !== "boolean") {
    const fail: JobsSearchFailureResponse = {
      success: false,
      error: "Invalid response from server",
    };
    return fail;
  }
  if (json.success === true) {
    if (!Array.isArray(json.jobs)) {
      const fail: JobsSearchFailureResponse = {
        success: false,
        error: "Invalid jobs payload",
      };
      return fail;
    }
    const ok: JobsSearchSuccessResponse = {
      success: true,
      jobs: json.jobs as JobsSearchSuccessResponse["jobs"],
      matched: typeof json.matched === "boolean" ? json.matched : undefined,
      total_count: typeof json.total_count === "number" ? json.total_count : undefined,
      filtered: typeof json.filtered === "boolean" ? json.filtered : undefined,
    };
    return ok;
  }
  const err = json.error;
  const fail: JobsSearchFailureResponse = {
    success: false,
    error: typeof err === "string" ? err : "Search failed",
  };
  return fail;
}
