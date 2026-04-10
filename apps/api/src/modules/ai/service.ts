import OpenAI from "openai";
import { env } from "../../env.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

export interface CreativeReview {
  verdict: "approve" | "revise" | "reject";
  summary: string;
  issues: string[];
  suggestions: string[];
  nextAction: string;
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif"]);
/** Max object size downloaded from storage for AI review (matches vision payload cap). */
export const MAX_AI_REVIEW_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = MAX_AI_REVIEW_DOWNLOAD_BYTES;

const SYSTEM_PROMPT = `You are a senior creative director at a media advertising agency reviewing creative assets submitted for advertising campaigns.

Evaluate the creative for:
- Visual quality and clarity
- Brand professionalism
- Technical suitability (resolution, format, composition)
- Effectiveness for the intended ad placement

Respond ONLY with a JSON object containing exactly these fields:
- "verdict": one of "approve", "revise", or "reject"
  - "approve": ready to send to publisher as-is
  - "revise": has potential but needs specific changes
  - "reject": fundamentally unsuitable
- "summary": 1–2 sentence overview of the creative's quality
- "issues": array of 0–3 specific problems found (empty if none)
- "issues" should be specific and factual (e.g. "Text is too small to read at 300x250")
- "suggestions": array of 2–4 short, actionable improvement recommendations
- "nextAction": one sentence telling the reviewer exactly what to do next (e.g. "Approve and send to publisher" or "Return to client with resize request")`;

function buildContext(opts: {
  title: string;
  description: string | null;
  creativeType: string;
  mimeType: string;
  filename: string;
}): string {
  const lines = [
    `Creative: "${opts.title}"`,
    opts.description ? `Description: ${opts.description}` : null,
    `Type: ${opts.creativeType}`,
    `Format: ${opts.mimeType} (${opts.filename})`,
  ];
  return lines.filter(Boolean).join("\n");
}

const VALID_VERDICTS = new Set(["approve", "revise", "reject"]);

function parseResponse(raw: string): CreativeReview {
  try {
    const parsed = JSON.parse(raw);
    const filterStrings = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr.filter((s): s is string => typeof s === "string")
        : [];
    return {
      verdict: VALID_VERDICTS.has(parsed.verdict) ? parsed.verdict : "revise",
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "Review could not be generated.",
      issues: filterStrings(parsed.issues),
      suggestions: filterStrings(parsed.suggestions),
      nextAction:
        typeof parsed.nextAction === "string"
          ? parsed.nextAction
          : "Review manually before proceeding.",
    };
  } catch {
    return {
      verdict: "revise",
      summary: "Review response could not be parsed.",
      issues: [],
      suggestions: [],
      nextAction: "Review manually before proceeding.",
    };
  }
}

export async function reviewCreative(opts: {
  title: string;
  description: string | null;
  creativeType: string;
  mimeType: string;
  filename: string;
  fileBuffer: Buffer;
}): Promise<CreativeReview> {
  const client = getClient();
  const context = buildContext(opts);

  const canSendImage =
    IMAGE_MIMES.has(opts.mimeType) &&
    opts.fileBuffer.length <= MAX_IMAGE_BYTES;

  if (canSendImage) {
    const base64 = opts.fileBuffer.toString("base64");
    const dataUrl = `data:${opts.mimeType};base64,${base64}`;

    const res = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Review this advertising creative:\n\n${context}`,
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    return parseResponse(res.choices[0]?.message?.content ?? "");
  }

  const qualifier = IMAGE_MIMES.has(opts.mimeType)
    ? "The image file is too large to preview directly."
    : `The file is a ${opts.mimeType} and cannot be previewed directly.`;

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review this advertising creative based on its metadata. ${qualifier}\n\n${context}\n\nProvide general creative review guidance and suggestions applicable to this type of advertising asset.`,
      },
    ],
  });

  return parseResponse(res.choices[0]?.message?.content ?? "");
}
