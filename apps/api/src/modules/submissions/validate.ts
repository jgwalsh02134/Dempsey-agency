import imageSize from "image-size";

export interface ValidationSummary {
  passed: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    widthPx: number | null;
    heightPx: number | null;
    dpi: number | null;
    colorSpace: string | null;
  };
}

export interface ValidationResult {
  status: "UPLOADED" | "VALIDATION_FAILED";
  widthPx: number | null;
  heightPx: number | null;
  dpi: number | null;
  colorSpace: string | null;
  validationSummary: ValidationSummary;
}

const DIGITAL_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
]);

const DIGITAL_ALLOWED_SIZES = [
  { w: 300, h: 250, label: "300×250 (Medium Rectangle)" },
  { w: 728, h: 90, label: "728×90 (Leaderboard)" },
  { w: 320, h: 50, label: "320×50 (Mobile Banner)" },
  { w: 300, h: 600, label: "300×600 (Half Page)" },
];

const MAX_DIGITAL_BYTES = 5 * 1024 * 1024; // 5 MB for digital ads

function extractImageDimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  try {
    const result = imageSize(buffer);
    if (result.width && result.height) {
      return { width: result.width, height: result.height };
    }
    return null;
  } catch {
    return null;
  }
}

export function validateDigital(
  buffer: Buffer,
  mimeType: string,
  sizeBytes: number,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let widthPx: number | null = null;
  let heightPx: number | null = null;

  if (!DIGITAL_ALLOWED_MIME.has(mimeType)) {
    errors.push(
      `File type "${mimeType}" is not allowed for digital creatives. Accepted: PNG, JPEG, GIF.`,
    );
  }

  if (sizeBytes > MAX_DIGITAL_BYTES) {
    errors.push(
      `File size ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 5 MB limit for digital creatives.`,
    );
  }

  const dims = extractImageDimensions(buffer);
  if (dims) {
    widthPx = dims.width;
    heightPx = dims.height;
    const match = DIGITAL_ALLOWED_SIZES.find(
      (s) => s.w === dims.width && s.h === dims.height,
    );
    if (!match) {
      const allowed = DIGITAL_ALLOWED_SIZES.map((s) => s.label).join(", ");
      errors.push(
        `Dimensions ${dims.width}×${dims.height} do not match any accepted ad size. Allowed: ${allowed}.`,
      );
    }
  } else if (!errors.length) {
    warnings.push("Could not extract image dimensions from file.");
  }

  const passed = errors.length === 0;
  return {
    status: passed ? "UPLOADED" : "VALIDATION_FAILED",
    widthPx,
    heightPx,
    dpi: null,
    colorSpace: null,
    validationSummary: {
      passed,
      errors,
      warnings,
      metadata: { widthPx, heightPx, dpi: null, colorSpace: null },
    },
  };
}

const PRINT_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/tiff",
]);

export function validatePrint(
  buffer: Buffer,
  mimeType: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let widthPx: number | null = null;
  let heightPx: number | null = null;

  if (!PRINT_ALLOWED_MIME.has(mimeType)) {
    errors.push(
      `File type "${mimeType}" is not accepted for print creatives. Accepted: PDF, TIFF.`,
    );
  }

  if (!errors.length) {
    if (mimeType === "image/tiff") {
      const dims = extractImageDimensions(buffer);
      if (dims) {
        widthPx = dims.width;
        heightPx = dims.height;
      }
      warnings.push(
        "TIFF DPI and color space could not be verified in this version. Please confirm print resolution with your publisher.",
      );
    } else {
      warnings.push(
        "DPI could not be verified from PDF in this version. Please confirm print resolution meets publisher requirements.",
      );
      warnings.push(
        "Color space (CMYK/RGB) could not be verified from PDF in this version. Confirm with your print vendor.",
      );
    }
  }

  const passed = errors.length === 0;
  return {
    status: passed ? "UPLOADED" : "VALIDATION_FAILED",
    widthPx,
    heightPx,
    dpi: null,
    colorSpace: null,
    validationSummary: {
      passed,
      errors,
      warnings,
      metadata: { widthPx, heightPx, dpi: null, colorSpace: null },
    },
  };
}

export function validateMasterAsset(
  buffer: Buffer,
  mimeType: string,
): ValidationResult {
  const warnings: string[] = [];
  let widthPx: number | null = null;
  let heightPx: number | null = null;

  const isImage = mimeType.startsWith("image/");
  if (isImage) {
    const dims = extractImageDimensions(buffer);
    if (dims) {
      widthPx = dims.width;
      heightPx = dims.height;
    } else {
      warnings.push("Could not extract image dimensions.");
    }
  } else {
    warnings.push(
      "Dimension extraction is not supported for this file type.",
    );
  }

  return {
    status: "UPLOADED",
    widthPx,
    heightPx,
    dpi: null,
    colorSpace: null,
    validationSummary: {
      passed: true,
      errors: [],
      warnings,
      metadata: { widthPx, heightPx, dpi: null, colorSpace: null },
    },
  };
}

export function validateCreative(
  creativeType: string,
  buffer: Buffer,
  mimeType: string,
  sizeBytes: number,
): ValidationResult {
  switch (creativeType) {
    case "DIGITAL":
      return validateDigital(buffer, mimeType, sizeBytes);
    case "PRINT":
      return validatePrint(buffer, mimeType);
    case "MASTER_ASSET":
      return validateMasterAsset(buffer, mimeType);
    default:
      return {
        status: "VALIDATION_FAILED",
        widthPx: null,
        heightPx: null,
        dpi: null,
        colorSpace: null,
        validationSummary: {
          passed: false,
          errors: [`Unknown creative type: ${creativeType}`],
          warnings: [],
          metadata: {
            widthPx: null,
            heightPx: null,
            dpi: null,
            colorSpace: null,
          },
        },
      };
  }
}
