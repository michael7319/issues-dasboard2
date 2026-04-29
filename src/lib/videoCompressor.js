// Video compression using the browser-native MediaRecorder + Canvas API.
// No WASM, no external libraries — works everywhere without loading delays.
//
// Trade-off vs FFmpeg.wasm: compression runs in real-time (not faster than
// playback speed), but the progress bar reflects actual video time so the
// UI always shows meaningful movement. For typical task-attachment videos
// (under 5 minutes) this is perfectly acceptable.

const TARGET_SIZE_MB = 20;
const TARGET_SIZE_BYTES = TARGET_SIZE_MB * 1024 * 1024;
// Safety headroom: target 90% so output reliably lands under 20 MB
// (file server confirmed limit is 32 MB)
const TARGET_BYTES_SAFE = TARGET_SIZE_BYTES * 0.9;
// Above this we refuse to attempt compression
const MAX_COMPRESSIBLE_MB = 500;
const MAX_COMPRESSIBLE_BYTES = MAX_COMPRESSIBLE_MB * 1024 * 1024;
// Non-video files above this are rejected upfront
const MAX_ANY_FILE_MB = 30;
const MAX_ANY_FILE_BYTES = MAX_ANY_FILE_MB * 1024 * 1024;
// Max output canvas width (reduces resolution for large videos)
const MAX_WIDTH = 1280;

/** Returns true if the file is a video (by MIME type or extension). */
export function isVideoFile(file) {
  if (file.type.startsWith("video/")) return true;
  const ext = file.name.split(".").pop().toLowerCase();
  return ["mp4", "webm", "mov", "avi", "mkv", "ogg", "m4v", "3gp", "flv", "wmv", "ts"].includes(ext);
}

/** Returns human-readable size string, e.g. "34.2 MB". */
export function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Validates a file against size limits.
 * Returns an error string, or null if the file is acceptable.
 * Videos over TARGET_SIZE_MB but under MAX_COMPRESSIBLE_MB are allowed
 * (compression will run automatically).
 */
export function validateFileSize(file) {
  if (isVideoFile(file)) {
    if (file.size > MAX_COMPRESSIBLE_BYTES) {
      return (
        `Video is too large (${formatFileSize(file.size)}). ` +
        `Maximum video size is ${MAX_COMPRESSIBLE_MB} MB. ` +
        `Please trim or reduce the video size before uploading.`
      );
    }
    return null;
  }
  if (file.size > MAX_ANY_FILE_BYTES) {
    return (
      `File is too large (${formatFileSize(file.size)}). ` +
      `Maximum file size is ${MAX_ANY_FILE_MB} MB.`
    );
  }
  return null;
}

/** Returns true if the video needs compression (over 20 MB). */
export function needsCompression(file) {
  return isVideoFile(file) && file.size > TARGET_SIZE_BYTES;
}

/**
 * Chooses the best supported WebM MIME type for MediaRecorder.
 */
function getBestMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
}

/**
 * Compresses a video file to <= 20 MB using MediaRecorder + Canvas.
 * Progress is based on video.currentTime / duration (real-time playback).
 *
 * @param {File} file            The original video File object
 * @param {Function} onProgress  Called with a 0–100 integer as compression progresses
 * @returns {Promise<File>}      A new File with the compressed video (webm)
 */
export function compressVideo(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_COMPRESSIBLE_BYTES) {
      return reject(new Error(
        `Video is too large (${formatFileSize(file.size)}). Maximum is ${MAX_COMPRESSIBLE_MB} MB.`
      ));
    }

    const videoEl = document.createElement("video");
    videoEl.muted = true; // Must be muted to allow autoplay
    videoEl.playsInline = true;
    videoEl.preload = "auto";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const objectUrl = URL.createObjectURL(file);
    let recorder = null;
    let chunks = [];
    let rafId = null;
    let audioCtx = null;
    let terminated = false;

    const cleanup = () => {
      terminated = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx) { try { audioCtx.close(); } catch {} }
      URL.revokeObjectURL(objectUrl);
      videoEl.src = "";
    };

    videoEl.onerror = () => {
      cleanup();
      reject(new Error(
        "Failed to load the video. The format may not be supported by your browser. " +
        "Try a different video or convert it to MP4 first."
      ));
    };

    videoEl.onloadedmetadata = () => {
      const duration = videoEl.duration;

      if (!isFinite(duration) || duration <= 0) {
        cleanup();
        return reject(new Error(
          "Could not read the video duration. The file may be corrupted."
        ));
      }

      // Calculate target bitrates
      const audioBps = 96_000;
      const videoBps = Math.floor((TARGET_BYTES_SAFE * 8) / duration) - audioBps;

      if (videoBps < 50_000) {
        cleanup();
        const maxMins = Math.floor((TARGET_BYTES_SAFE * 8) / (audioBps + 50_000) / 60);
        return reject(new Error(
          `This video is too long to compress below ${TARGET_SIZE_MB} MB ` +
          `(${Math.round(duration / 60)} min). ` +
          `Try trimming it to under ${maxMins} minutes first.`
        ));
      }

      // Set canvas size (reduce resolution if needed)
      const scale = Math.min(1, MAX_WIDTH / videoEl.videoWidth);
      canvas.width = Math.round(videoEl.videoWidth * scale);
      canvas.height = Math.round(videoEl.videoHeight * scale);

      // Set up canvas stream first (always works)
      const canvasStream = canvas.captureStream(30);

      // Attempt audio capture from the video element.
      // This is best-effort: if AudioContext is unavailable (e.g., browser
      // suspends it after the async file-change handler), we fall back to
      // video-only compression rather than rejecting entirely.
      try {
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaElementSource(videoEl);
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        // Note: don't connect to audioCtx.destination (keep it silent in the UI)
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      } catch (audioErr) {
        console.warn("Audio capture unavailable, compressing video only:", audioErr.message);
        if (audioCtx) { try { audioCtx.close(); } catch {} audioCtx = null; }
      }

      const mimeType = getBestMimeType();
      try {
        recorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: videoBps,
          audioBitsPerSecond: audioBps,
        });
      } catch (recErr) {
        cleanup();
        return reject(new Error(`MediaRecorder setup failed: ${recErr.message}. Try a different browser.`));
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });

        if (blob.size > TARGET_SIZE_BYTES) {
          return reject(new Error(
            `Compression produced a ${formatFileSize(blob.size)} file, still above ${TARGET_SIZE_MB} MB. ` +
            `Please trim the video in a video editor and try again.`
          ));
        }

        onProgress?.(100);
        const baseName = file.name.replace(/\.[^.]+$/, "");
        resolve(new File([blob], `${baseName}_compressed.webm`, { type: mimeType }));
      };

      recorder.onerror = (e) => {
        cleanup();
        reject(new Error(`Recording failed: ${e.error?.message ?? "Unknown error"}`));
      };

      // Draw frames loop
      const drawFrame = () => {
        if (terminated) return;
        if (!videoEl.paused && !videoEl.ended) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const pct = Math.min(99, Math.round((videoEl.currentTime / duration) * 100));
          onProgress?.(pct);
        }
        rafId = requestAnimationFrame(drawFrame);
      };

      videoEl.onplay = () => {
        rafId = requestAnimationFrame(drawFrame);
        recorder.start(200);
      };

      videoEl.onended = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      // Unmute AFTER recorder is set up (AudioContext captures the source)
      videoEl.muted = false;
      videoEl.play().catch((err) => {
        cleanup();
        reject(new Error(`Could not start video playback: ${err.message}`));
      });
    };

    videoEl.src = objectUrl;
  });
}

// Internal helper — exposed for reuse in AttachmentManager
export function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout reading video metadata"));
    }, 8000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Could not load video metadata"));
    };
    video.src = url;
  });
}
