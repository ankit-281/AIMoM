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

const hardcodedSummary = `A bill for an ordinance amending the Denver Zoning Code by adding Section 8-6.7 related to 60-50 lots on parking and storage spaces, establishing parking standards and restrictions in certain zoning districts and prohibiting parking uses on lots under a certain size. Approves an amended version of Council Bill 21 - 1111. Amends Chapter 8 of the Denver Revised Municipal Code (DRMC) by adding Section 8-6.7 to establish parking standards and restrictions for small multi-unit developments in residential zoning districts, as well as prohibitions on parking uses on lots under a certain size. The Committee approved filing this item at its meeting on 1-19-22. In Council Action, the Council referred this bill to the Transportation and Public Works Committee. On 2-15-22, the committee held a public hearing for the bill. The Transportation & Public Works Committee voted unanimously to pass the bill with amendments on 2-23-22. On 3-8-22, Councilwoman Sandoval called out the bill for a separate vote. On 3-28-22, the full council referred this item back to transportation and public works for further consideration and possible action before the full Council. The Committee approved filing this item on 4-19-22. In Council Action, the Council voted unanimously to approve filing this item at its meeting on 5-24-22. On 5-23-22, the Transportation and Public Works Committee voted unanimously to pass the bill with amendments on 5-25-22. The bill was sent to the full council for a final vote. Councilmember Sandoval called out the bill on 6-21-22. On 6-28-22, the bill passed in a do pass manner by unanimous votes. On 7-5-22, Councilwoman CdeBaca called out the bill on 7-19-22, and it was placed on the consent agenda. The full council approved filing this item at its meeting on 7-19-22. The final vote occurred in the full council on 8-2-22. Madam Secretary, will you please close the voting and announce the results? Nine eyes, two nays. Council Bill 21 -1111 has passed. Thank you so much for all your time this evening. And thank you very much. Councilman Flynn. Will you put Councilwoman Ortega up on mute? Yes. I'm not sure what we did wrong there. She was there when she got off the mute, and then it went away again. Okay, let's try that. You're good to go, Madam President. And thank you for all your time tonight. I'm going to make a quick point. This bill is very important because this has been in discussion for nine months, nine months of public comment. It's not just one group of people talking about this issue. It's many different groups that have talked about this over the past year and a half, including the Denver Zoning Code Advisory Committee. I think we heard from three different subgroups on it. One was our affordable housing subgroup which really focused on making sure that we're providing for units that are going to be used by people who have difficulty finding parking and storage space in their current homes, or not being able to afford cars altogether. So these units were designed with accessibility in mind from the beginning. And then there is a small business subgroup which focused on ensuring that when you're doing your development, that you have enough space for a commercial tenant. So this legislation makes sure we don't create conditions where you're going to have a tenant and they have to park in someone's driveway. And it also addresses the concerns of folks who are worried about their parking and storage spaces on a lot less than 60 square feet. There is another subgroup that I think was just recently called upon for public comment by this bill, which has focused on addressing the environmental justice impacts that these parking and storage units could have on low income communities that may already be suffering from poor air quality because of transportation emissions and pollution, not only from cars, but also from trucks. So this legislation addresses those concerns as well. And it's really important to say that we had three different groups of people in our conversations over the past nine months who all came to similar conclusions about this bill, and it was unanimous support on these three subgroups. And so I just want to make sure that everyone understands what a collaborative process this has been. And I'm grateful for the work that our zoning code advisory committee has done over the last few years in bringing people together across the city on this important issue of affordable housing, transportation and mobility. So thank you for your time, Mr. President. Thank you. Councilman Flynn. Are we going to vote? Do we need to vote? Yes, I guess. All right. Madam Secretary. Raquel. Robb I. Sandoval. Sawyer. I think Clark. I can eat. I. Herndon. I. Hines. Hi. Cashman. Lopez. I knew Ortega. I. Torres. I. Black eye. Mr. President. I. Madam Secretary, close the voting and announce results. Nine eyes, two nays. Council Bill 21 -1111 has passed. Thank you so much for your time this evening, everyone. And we will be adjourned. Is there any other business to come before the council? All right. Seeing none. We stand adjourned. This concludes our agenda. Our next regularly scheduled meeting is on Monday, September 6th, 2021.

The Committee approved filing this item at its meeting on 4-19-22. In Council Action, the Council voted unanimously to approve filing this item at its meeting on 5-24-22. On 5-25-22, the bill was sent to full council for a final vote by unanimous votes from both the Transportation and Public Works Committee and full council.`;

const emptyMindmap: MindmapJson = {
  title: "Mindmap",
  summary: "Generate from the hardcoded summary to view a Mermaid mindmap.",
  participants: [],
  topics: [],
  decisions: [],
  actions: [],
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
  const [mindmap, setMindmap] = useState<MindmapJson>(emptyMindmap);
  const [jsonOutput, setJsonOutput] = useState<string>("");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
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

  async function generateFromSummary() {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/summary-to-mindmap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ summary: hardcodedSummary }),
      });

      const text = await response.text();
      const payload = JSON.parse(text) as {
        mindmap?: MindmapJson;
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(
          `${payload.error ?? "Failed to generate mindmap JSON."}${payload.details ? ` ${payload.details}` : ""}`,
        );
      }

      if (!payload.mindmap) {
        throw new Error("Groq returned no mindmap data.");
      }

      setMindmap(payload.mindmap);
      setJsonOutput(JSON.stringify(payload.mindmap, null, 2));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Generation failed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(165deg,#f7fbff_0%,#eff6ff_45%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:px-6 md:py-4">
        <header className="shrink-0 rounded-3xl bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 backdrop-blur md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Groq + Mermaid
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
            Hardcoded Summary to Mermaid Mindmap
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-slate-600 md:text-sm">
            The summary below is fixed in code. Click the button to have Groq
            generate valid JSON, then the app converts that JSON into Mermaid
            syntax and renders the mindmap.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-700 ring-1 ring-cyan-200">
              Source: hardcoded summary
            </span>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-200">
              Output: strict JSON + Mermaid
            </span>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="min-w-0 rounded-3xl bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 backdrop-blur md:p-6">
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Hardcoded summary</h2>
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

              <pre className="mt-3 h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 shadow-inner">
                {hardcodedSummary}
              </pre>

              <div className="mt-3 flex shrink-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={generateFromSummary}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                      Generating...
                    </>
                  ) : (
                    "Generate JSON and Mermaid"
                  )}
                </button>

                <p className="text-xs text-slate-500">
                  Uses Groq to produce valid JSON before rendering.
                </p>
              </div>

              {error ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

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
