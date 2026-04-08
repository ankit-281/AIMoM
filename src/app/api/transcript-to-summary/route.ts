import { NextResponse } from "next/server";

type OllamaGenerateResponse = {
  response?: unknown;
  error?: unknown;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    transcript?: unknown;
  } | null;
  const transcript = asText(body?.transcript);

  if (!transcript) {
    return NextResponse.json(
      { error: "Transcript text is required." },
      { status: 400 },
    );
  }

  const prompt = `
### Instruction:
You are an AI assistant that summarizes meeting transcripts. Generate a concise and accurate summary of the following meeting transcript.

### Input:
${transcript}

### Response:
`;

  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
  const ollamaModel =
    process.env.TRANSCRIPT_SUMMARIZER_MODEL?.trim() || "transcript-summarizer";
  const timeoutMs = readPositiveInt(
    process.env.TRANSCRIPT_SUMMARIZER_TIMEOUT_MS,
    180000,
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        {
          error: `Summarizer request failed with status ${response.status}.`,
          details: details.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const data = (await response
      .json()
      .catch(() => null)) as OllamaGenerateResponse | null;

    const summary = asText(data?.response);
    if (!summary) {
      return NextResponse.json(
        {
          error: "Summarizer returned no summary text.",
          details: asText(data?.error),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Summarizer request timed out after ${timeoutMs}ms. Increase TRANSCRIPT_SUMMARIZER_TIMEOUT_MS if needed.`
        : error instanceof Error
          ? error.message
          : "Unexpected error while generating summary.";

    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
