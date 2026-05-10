const INVISIBLE_NOTE_SENTINELS = /[\u2063\u2064]/g;
const SENTINEL_NOTE_BLOCK = /\u2063NOTE:[A-Za-z0-9_-]+\u2064[\s\S]*?\u2063\/NOTE\u2064/g;
const RAW_NOTE_PROTOCOL = /\bNOTE:[A-Za-z0-9_-]+\b|\/NOTE\b/gi;
const RAW_NOTE_ID_FRAGMENT = /\bNOTE[A-Za-z0-9_-]{6,}\b/g;
const RAW_PATCH_ID_FRAGMENT = /\bPATCH[A-Za-z0-9_-]{6,}\b/g;
const UUID_LIKE_NOTE_ID = /\b(?:note|patch)-[a-z0-9-]{6,}\b/gi;
const OBJECT_LEAK = /\[object Object\]/g;
const MARKER_DETECTORS = [
  /[\u2063\u2064]/,
  /\u2063NOTE:[A-Za-z0-9_-]+\u2064[\s\S]*?\u2063\/NOTE\u2064/,
  /\bNOTE:[A-Za-z0-9_-]+\b|\/NOTE\b/i,
  /\bNOTE[A-Za-z0-9_-]{6,}\b/,
  /\bPATCH[A-Za-z0-9_-]{6,}\b/,
  /\b(?:note|patch)-[a-z0-9-]{6,}\b/i,
  /\[object Object\]/
];

export function stripEditorKernelMarkers(value: string) {
  return value
    .replace(SENTINEL_NOTE_BLOCK, "")
    .replace(RAW_NOTE_PROTOCOL, "")
    .replace(INVISIBLE_NOTE_SENTINELS, "")
    .replace(RAW_NOTE_ID_FRAGMENT, "")
    .replace(RAW_PATCH_ID_FRAGMENT, "")
    .replace(UUID_LIKE_NOTE_ID, "")
    .replace(OBJECT_LEAK, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function hasEditorKernelMarkers(value: string) {
  return MARKER_DETECTORS.some((pattern) => pattern.test(value));
}

export function protectModuleText(value: string) {
  const cleaned = stripEditorKernelMarkers(value);
  if (cleaned !== value) {
    console.warn("EssayCraft stripped leaked editor note markers before saving module text.");
  }
  return cleaned;
}

export function normalizedForNoopCompare(value: string) {
  return stripEditorKernelMarkers(value).replace(/\s+/g, " ").trim().toLowerCase();
}
