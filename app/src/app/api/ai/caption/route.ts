import { buildCaptionPrompt, type CaptionRequest } from "@/lib/domain/poster";
import { generateText } from "@/lib/server/claude";

export async function POST(req: Request) {
  const body = (await req.json()) as CaptionRequest;
  if (!body?.menuName || !body?.copy) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const caption = await generateText("당신은 동네 카페의 SNS 담당자입니다.", buildCaptionPrompt(body));
    if (!caption) return Response.json({ error: "ai_unavailable" }, { status: 503 });
    return Response.json({ caption });
  } catch (e) {
    console.error("caption generation failed", e);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
