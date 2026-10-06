import { buildReplyPrompt, type ReplyInput } from "@/lib/domain/review";
import { generateText } from "@/lib/server/claude";

export async function POST(req: Request) {
  const input = (await req.json()) as ReplyInput;
  if (!input?.text || typeof input.rating !== "number") return Response.json({ error: "bad_request" }, { status: 400 });
  const { system, user } = buildReplyPrompt({ ...input, text: String(input.text).slice(0, 2000) });
  try {
    const reply = await generateText(system, user);
    if (!reply) return Response.json({ error: "ai_unavailable" }, { status: 503 });
    return Response.json({ reply });
  } catch (e) {
    console.error("review reply generation failed", e);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
