// claude.ai 아티팩트 진입점: 해시 라우팅으로 모든 화면을 한 페이지에 담는다.
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/AppShell";
import { setPlatform } from "@/lib/platform";
import { startPersistence } from "@/lib/persistence";
import { artifactPlatform } from "./platform";
import { artifactAdapter } from "./dbAdapter";
import { usePathname } from "./shims/next-navigation";
import Home from "@/app/page";
import MenuPage from "@/app/menu/page";
import SalesPage from "@/app/sales/page";
import PnlPage from "@/app/pnl/page";
import AnalysisPage from "@/app/analysis/page";
import ReviewsPage from "@/app/reviews/page";
import StaffPage from "@/app/staff/page";
import PosterPage from "@/app/poster/page";
import SettingsPage from "@/app/settings/page";

const ROUTES: Record<string, () => React.ReactElement> = {
  "/": Home,
  "/menu": MenuPage,
  "/sales": SalesPage,
  "/pnl": PnlPage,
  "/analysis": AnalysisPage,
  "/reviews": ReviewsPage,
  "/staff": StaffPage,
  "/poster": PosterPage,
  "/settings": SettingsPage,
};

function Router() {
  const path = usePathname();
  const Page = ROUTES[path] ?? Home;
  return <Page key={path} />;
}

setPlatform(artifactPlatform);
startPersistence(artifactAdapter(), { onEmpty: "ask" });

createRoot(document.getElementById("root")!).render(
  <AppShell>
    <Router />
  </AppShell>,
);
