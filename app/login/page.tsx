import { listProfiles } from "@/lib/queries";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profiles = await listProfiles();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="mb-1 text-center text-2xl font-bold">누구야?</h1>
      <p className="mb-8 text-center text-sm text-slate-500">
        이름을 누르고 비밀번호 4자리를 눌러줘
      </p>
      <LoginForm profiles={profiles} />
    </main>
  );
}
