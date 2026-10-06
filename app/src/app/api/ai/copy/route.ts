import { buildCopyPrompt, parseCopies, type PosterPurpose } from "@/lib/domain/poster";
import { generateText } from "@/lib/server/claude";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    storeName: string;
    menuName: string;
    description?: string;
    price: number;
    purpose: PosterPurpose;
    praise: string[];
  };
  if (!body?.menuName) return Response.json({ error: "bad_request" }, { status: 400 });
  const { system, user } = buildCopyPrompt(body);
  try {
    const text = await generateText(system, user);
    const copies = text ? parseCopies(text) : null;
    if (!copies) return Response.json({ error: "ai_unavailable" }, { status: 503 });
    return Response.json({ copies });
  } catch (e) {
    console.error("poster copy generation failed", e);
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
