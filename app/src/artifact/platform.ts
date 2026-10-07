// claude.ai 아티팩트용 플랫폼: AI 는 sample 기능(보는 사람의 Claude 계정), 파일 저장은 downloads 기능.
import type { Platform } from "@/lib/platform";
import { buildReplyPrompt } from "@/lib/domain/review";
import { buildCopyPrompt, type PosterCopy } from "@/lib/domain/poster";

const sampleP = () => window.claude?.use("sample").catch(() => null) ?? Promise.resolve(null);
const downloadsP = () => window.claude?.use("downloads").catch(() => null) ?? Promise.resolve(null);

export const artifactPlatform: Platform = {
  async reviewReply(input) {
    const sample = await sampleP();
    if (!sample) return null;
    const { system, user } = buildReplyPrompt(input);
    try {
      const { text } = await sample(`${system}\n\n---\n${user}`, { cache: false });
      return text.trim() || null;
    } catch {
      return null;
    }
  },
  async posterCopies(req) {
    const sample = await sampleP();
    if (!sample) return null;
    const { system, user } = buildCopyPrompt(req);
    try {
      const arr = await sample.json<PosterCopy[]>(`${system}\n\n---\n${user}`, { modelTier: "quick", cache: false });
      if (!Array.isArray(arr)) return null;
      const copies = arr.filter((x) => x && typeof x.headline === "string").map((x) => ({ headline: String(x.headline), sub: String(x.sub ?? "") }));
      return copies.length ? copies : null;
    } catch {
      return null;
    }
  },
  async saveFile(filename, data) {
    const downloads = await downloadsP();
    if (!downloads) return false;
    try {
      await downloads.save({ filename, data });
      return true;
    } catch {
      return false;
    }
  },
  canPrint: false,
  canShareFiles: false,
};
