import { useCallback, useMemo, useState, type FC } from "react";
import {
  useDropzone,
  type DropEvent,
  type FileRejection,
} from "react-dropzone";

const MAX_FILE_BYTES = 16 * 1024 * 1024;

/** MIME + extensions accepted by the dropzone (must match backend). */
const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

function rejectionMessage(rejections: FileRejection[]): string {
  const first = rejections[0];
  if (!first) {
    return "Could not accept this file.";
  }
  const code = first.errors[0]?.code;
  if (code === "file-invalid-type") {
    return "Only PDF, .doc, and .docx files are allowed.";
  }
  if (code === "file-too-large") {
    return "File is too large (max 16 MB).";
  }
  if (code === "too-many-files") {
    return "Please upload one file at a time.";
  }
  return first.errors[0]?.message ?? "Could not accept this file.";
}

function CloudUploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
      />
    </svg>
  );
}

export interface ResumeSectionProps {
  statusText: string;
  statusClassName: string;
  onUploadResume: (file: File | null) => Promise<void>;
}

export const ResumeSection: FC<ResumeSectionProps> = ({
  statusText,
  statusClassName,
  onUploadResume,
}) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const isUploading =
    statusText.startsWith("Uploading") || statusText.startsWith("Saving to cloud");

  const onDropAccepted = useCallback(
    async (acceptedFiles: File[], _event: DropEvent): Promise<void> => {
      setLocalError(null);
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      setSelectedFileName(file.name);
      try {
        await onUploadResume(file);
      } catch {
        /* Parent sets statusText on failure */
      }
    },
    [onUploadResume],
  );

  const onDropRejected = useCallback((rejections: FileRejection[]): void => {
    setLocalError(rejectionMessage(rejections));
    setSelectedFileName(null);
  }, []);

  const dropzone = useDropzone({
    onDropAccepted,
    onDropRejected,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled: isUploading,
    noClick: false,
    noKeyboard: false,
  });

  const { getRootProps, getInputProps, isDragActive, isDragReject } = dropzone;

  const rootClassName = useMemo((): string => {
    const base =
      "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";
    if (isUploading) {
      return `${base} cursor-wait border-slate-200 bg-slate-100/90 opacity-90`;
    }
    if (isDragReject) {
      return `${base} border-red-300 bg-red-50/90 ring-2 ring-red-100`;
    }
    if (isDragActive) {
      return `${base} scale-[1.01] border-solid border-slate-400 bg-white shadow-card-hover ring-2 ring-slate-900/10`;
    }
    return `${base} border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/80`;
  }, [isDragActive, isDragReject, isUploading]);

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-slate-900">
        Resume <span className="font-normal text-slate-500">(optional)</span>
      </h2>

      <div {...getRootProps()} className={rootClassName}>
        <input {...getInputProps()} aria-label="Upload resume file" />
        <CloudUploadIcon
          className={`h-12 w-12 shrink-0 ${
            isDragReject
              ? "text-red-500"
              : isDragActive
                ? "text-slate-700"
                : "text-slate-500"
          }`}
        />
        <div>
          <p className="text-sm font-medium text-slate-800">
            Drag &amp; drop your CV here,{" "}
            <span className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2">
              or click to browse
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PDF, .doc, or .docx · up to 16 MB
          </p>
        </div>

        {selectedFileName ? (
          <p
            className="mt-1 max-w-full truncate rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
            title={selectedFileName}
          >
            <span className="text-slate-500">Selected: </span>
            {selectedFileName}
          </p>
        ) : null}
      </div>

      {localError ? (
        <p
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {localError}
        </p>
      ) : null}

      {statusText ? (
        <p className={`mt-3 text-sm ${statusClassName}`}>{statusText}</p>
      ) : null}
    </section>
  );
};
