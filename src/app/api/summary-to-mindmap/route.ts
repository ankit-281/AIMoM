import { NextResponse } from "next/server";

type TopicNode = {
  title: string;
  points: string[];
  children: TopicNode[];
};

type MindmapJson = {
  title: string;
  summary: string;
  participants: string[];
  topics: TopicNode[];
  decisions: string[];
  actions: Array<{ owner: string; task: string }>;
};

type GroqResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const fallbackMindmap: MindmapJson = {
  title: "Meeting Summary",
  summary: "Structured output from summary text.",
  participants: [],
  topics: [],
  decisions: [],
  actions: [],
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.map((item) => asText(item)).filter(Boolean);
}

function normalizeTopic(value: unknown): TopicNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const obj = value as Record<string, unknown>;
  const title = asText(obj.title);

  if (!title) {
    return null;
  }

  const children = Array.isArray(obj.children)
    ? obj.children
        .map((entry) => normalizeTopic(entry))
        .filter((entry): entry is TopicNode => Boolean(entry))
    : [];

  return {
    title,
    points: asList(obj.points),
    children,
  };
}

function normalizeMindmap(value: unknown): MindmapJson {
  if (!value || typeof value !== "object") {
    return fallbackMindmap;
  }

  const obj = value as Record<string, unknown>;
  const topics = Array.isArray(obj.topics)
    ? obj.topics
        .map((entry) => normalizeTopic(entry))
        .filter((entry): entry is TopicNode => Boolean(entry))
    : [];

  const actions = Array.isArray(obj.actions)
    ? obj.actions
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const item = entry as Record<string, unknown>;
          return {
            owner: asText(item.owner, "Unassigned"),
            task: asText(item.task, "Follow up"),
          };
        })
        .filter((entry): entry is { owner: string; task: string } =>
          Boolean(entry),
        )
    : [];

  return {
    title: asText(obj.title, fallbackMindmap.title),
    summary: asText(obj.summary, fallbackMindmap.summary),
    participants: asList(obj.participants),
    topics,
    decisions: asList(obj.decisions),
    actions,
  };
}

function parseGroqJson(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Groq did not return valid JSON.");
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY environment variable." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    summary?: unknown;
  } | null;
  const summary = asText(body?.summary);

  if (!summary) {
    return NextResponse.json(
      { error: "Summary text is required." },
      { status: 400 },
    );
  }

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Convert a meeting summary into valid JSON only. Return exactly one JSON object with keys: title, summary, participants, topics, decisions, actions. topics is an array of topic objects {title, points, children}. children is the same shape recursively. actions is an array of objects {owner, task}. Keep values concise.",
          },
          {
            role: "user",
            content: `Summary:\n${summary}`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      {
        error: `Groq request failed with status ${response.status}.`,
        details: details.slice(0, 500),
      },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as GroqResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    return NextResponse.json(
      { error: "Groq returned an empty completion." },
      { status: 502 },
    );
  }

  try {
    const parsed = parseGroqJson(content);
    const mindmap = normalizeMindmap(parsed);
    return NextResponse.json({ mindmap });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to parse Groq JSON response.",
      },
      { status: 502 },
    );
  }
}
