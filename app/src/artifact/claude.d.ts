// claude.ai 아티팩트 런타임이 주입하는 window.claude 의 최소 타입 (runtime contract 0.2.x)
interface ClaudeRuntime {
  use(name: "db"): Promise<ArtifactDB | null>;
  use(name: "sample"): Promise<ArtifactSample | null>;
  use(name: "downloads"): Promise<ArtifactDownloads | null>;
}

interface ArtifactDocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface ArtifactDocRef {
  get(): Promise<ArtifactDocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface ArtifactCollection {
  doc(id: string): ArtifactDocRef;
  get(): Promise<{ docs: ArtifactDocSnap[]; empty: boolean }>;
}
interface ArtifactDB {
  doc(path: string): ArtifactDocRef;
  collection(path: string): ArtifactCollection;
}

interface ArtifactSample {
  (input: string, options?: { modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, options?: { modelTier?: "quick" | "default" | "complex"; cache?: boolean }): Promise<T>;
}

interface ArtifactDownloads {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: "saved" | "delivered" }>;
}

interface Window {
  claude?: ClaudeRuntime;
}
