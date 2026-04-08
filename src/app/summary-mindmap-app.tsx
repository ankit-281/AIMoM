"use client";

import { useEffect, useMemo, useState } from "react";

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
  actions: Array<{
    owner: string;
    task: string;
  }>;
};

const emptyMindmap: MindmapJson = {
  title: "Mindmap",
  summary: "Generate from transcript text to view a Mermaid mindmap.",
  participants: [],
  topics: [],
  decisions: [],
  actions: [],
};

type SummaryResponse = {
  summary?: string;
  error?: string;
  details?: string;
};

type MindmapResponse = {
  mindmap?: MindmapJson;
  error?: string;
  details?: string;
};

function safeLabel(value: string) {
  const cleaned = value
    .replace(/[\n\r]/g, " ")
    .replace(/[\[\](){}"']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Untitled";
  }

  return cleaned.slice(0, 90);
}

function toMermaid(mindmap: MindmapJson) {
  const lines: string[] = ["mindmap", `  root((${safeLabel(mindmap.title)}))`];

  const appendTopic = (topic: TopicNode, depth: number) => {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${safeLabel(topic.title)}`);

    for (const point of topic.points) {
      lines.push(`${"  ".repeat(depth + 1)}${safeLabel(point)}`);
    }

    for (const child of topic.children) {
      appendTopic(child, depth + 1);
    }
  };

  lines.push("    Topics");
  for (const topic of mindmap.topics) {
    appendTopic(topic, 3);
  }

  lines.push("    Decisions");
  for (const decision of mindmap.decisions) {
    lines.push(`      ${safeLabel(decision)}`);
  }

  lines.push("    Actions");
  for (const action of mindmap.actions) {
    lines.push(`      ${safeLabel(`${action.owner}: ${action.task}`)}`);
  }

  return lines.join("\n");
}

export default function SummaryMindmapApp() {
  const [transcriptInput, setTranscriptInput] = useState<string>("");
  const [summaryText, setSummaryText] = useState<string>("");
  const [mindmap, setMindmap] = useState<MindmapJson>(emptyMindmap);
  const [jsonOutput, setJsonOutput] = useState<string>("");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("Waiting for transcript input.");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);
  const hasResult = jsonOutput.length > 0;

  const mermaidCode = useMemo(() => toMermaid(mindmap), [mindmap]);

  useEffect(() => {
    let disposed = false;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "strict",
        });

        const id = `mm-${Date.now()}`;
        const rendered = await mermaid.render(id, mermaidCode);

        if (!disposed) {
          setSvg(rendered.svg);
        }
      } catch (nextError) {
        if (!disposed) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to render Mermaid diagram.",
          );
        }
      }
    }

    renderMermaid();

    return () => {
      disposed = true;
    };
  }, [mermaidCode]);

  async function parsePayload<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("API returned malformed JSON.");
    }
  }

  async function generateSummary(): Promise<string> {
    if (!transcriptInput.trim()) {
      throw new Error("Please paste a transcript first.");
    }

    setStatus("Generating summary from transcript...");
    setIsGeneratingSummary(true);

    try {
      const response = await fetch("/api/transcript-to-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: transcriptInput }),
      });

      const payload = await parsePayload<SummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          `${payload?.error ?? "Failed to generate summary."}${payload?.details ? ` ${payload.details}` : ""}`,
        );
      }

      const summary = payload?.summary?.trim();
      if (!summary) {
        throw new Error("Summarizer returned no summary text.");
      }

      setSummaryText(summary);
      setStatus("Summary generated. Ready to build mindmap.");
      return summary;
    } finally {
      setIsGeneratingSummary(false);
    }
  }

  async function generateMindmap(nextSummary?: string) {
    const summary = (nextSummary ?? summaryText).trim();
    if (!summary) {
      throw new Error("Please generate or paste a summary first.");
    }

    setStatus("Generating mindmap JSON from summary...");
    setIsGeneratingMindmap(true);

    try {
      const response = await fetch("/api/summary-to-mindmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ summary }),
      });

      const payload = await parsePayload<MindmapResponse>(response);
      if (!response.ok) {
        throw new Error(
          `${payload?.error ?? "Failed to generate mindmap JSON."}${payload?.details ? ` ${payload.details}` : ""}`,
        );
      }

      if (!payload?.mindmap) {
        throw new Error("Mindmap service returned no data.");
      }

      setMindmap(payload.mindmap);
      setJsonOutput(JSON.stringify(payload.mindmap, null, 2));
      setStatus("Mindmap generated and rendered.");
    } finally {
      setIsGeneratingMindmap(false);
    }
  }

  async function runFullFlow() {
    setError("");

    try {
      const generated = await generateSummary();
      await generateMindmap(generated);
    } catch (nextError) {
      setStatus("Flow failed.");
      setError(
        nextError instanceof Error ? nextError.message : "Generation failed.",
      );
    }
  }

  async function runSummaryOnly() {
    setError("");

    try {
      await generateSummary();
    } catch (nextError) {
      setStatus("Summary generation failed.");
      setError(
        nextError instanceof Error ? nextError.message : "Generation failed.",
      );
    }
  }

  async function runMindmapOnly() {
    setError("");

    try {
      await generateMindmap();
    } catch (nextError) {
      setStatus("Mindmap generation failed.");
      setError(
        nextError instanceof Error ? nextError.message : "Generation failed.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(165deg,#f7fbff_0%,#eff6ff_45%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
        <header className="shrink-0 rounded-3xl bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 backdrop-blur md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Ollama + Groq + Mermaid
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
            Transcript to Summary to Mermaid Mindmap
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-slate-600 md:text-sm">
            Paste transcript text, generate a concise summary using the local
            summarizer route, then transform the summary into strict JSON and
            Mermaid mindmap output.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700 ring-1 ring-cyan-200">
              Step 1: transcript to summary
            </span>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-200">
              Step 2: summary to JSON + Mermaid
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200">
              {status}
            </span>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="min-w-0 rounded-3xl bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 backdrop-blur md:p-6">
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Transcript and summary
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    hasResult
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {hasResult ? "JSON ready" : "Waiting to generate"}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Transcript input
              </h3>
              <textarea
                value={transcriptInput}
                onChange={(event) => setTranscriptInput(event.target.value)}
                placeholder="Paste your full meeting transcript here..."
                className="mt-2 h-[24vh] w-full resize-y rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none ring-cyan-300 transition focus:ring"
              />

              <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runFullFlow}
                  disabled={isGeneratingSummary || isGeneratingMindmap}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGeneratingSummary || isGeneratingMindmap ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                      Running full flow...
                    </>
                  ) : (
                    "Generate Summary and Mindmap"
                  )}
                </button>

                <button
                  type="button"
                  onClick={runSummaryOnly}
                  disabled={isGeneratingSummary || isGeneratingMindmap}
                  className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generate summary only
                </button>

                <button
                  type="button"
                  onClick={runMindmapOnly}
                  disabled={isGeneratingSummary || isGeneratingMindmap}
                  className="inline-flex items-center rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generate mindmap from summary
                </button>

                <p className="text-xs text-slate-500">
                  Step-by-step controls are useful when editing summaries
                  manually.
                </p>
              </div>

              {error ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Generated summary
              </h3>
              <textarea
                value={summaryText}
                onChange={(event) => setSummaryText(event.target.value)}
                placeholder="Summary will appear here after step 1. You can edit before generating the mindmap."
                className="mt-2 h-[18vh] w-full resize-y rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-800 outline-none ring-cyan-300 transition focus:ring"
              />

              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Generated JSON
              </h3>
              <pre className="mt-2 h-[30vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-inner">
                {jsonOutput || JSON.stringify(mindmap, null, 2)}
              </pre>
            </div>
          </div>

          <div className="min-w-0 rounded-3xl bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 backdrop-blur md:p-6">
            <div className="flex min-w-0 flex-col">
              <h2 className="text-lg font-semibold">Mermaid mindmap</h2>
              <div className="mt-3 min-w-0 overflow-visible rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4">
                {svg ? (
                  <div
                    className="mermaid-container w-full min-w-0 [&_svg]:block [&_svg]:max-w-full [&_svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <p className="text-sm text-slate-500">Rendering diagram...</p>
                )}
              </div>

              <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Mermaid source
              </h3>
              <pre className="mt-2 h-[30vh] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-inner">
                {mermaidCode}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
