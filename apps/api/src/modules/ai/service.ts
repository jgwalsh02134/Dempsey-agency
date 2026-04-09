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
  summary: string;
  suggestions: string[];
}

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/gif"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const SYSTEM_PROMPT = `You are a senior creative director at a media advertising agency. You review creative assets submitted for advertising campaigns.

Provide a concise, professional review with actionable suggestions.

Respond ONLY with a JSON object containing exactly two fields:
- "summary": a 1–2 sentence overview of the creative's quality and effectiveness
- "suggestions": an array of 3–5 short, specific improvement recommendations`;

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

function parseResponse(raw: string): CreativeReview {
  try {
    const parsed = JSON.parse(raw);
    return {
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "Review could not be generated.",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter(
            (s: unknown): s is string => typeof s === "string",
          )
        : [],
    };
  } catch {
    return { summary: "Review response could not be parsed.", suggestions: [] };
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
