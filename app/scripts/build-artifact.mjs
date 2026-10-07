// claude.ai 아티팩트용 단일 HTML 빌드.
//   React 는 cdnjs 의 UMD 빌드를 쓰고(아티팩트 CSP 허용 호스트), 앱 코드와 CSS 는 한 파일에 인라인한다.
//   next/link·next/navigation 은 해시 라우팅 shim 으로 바꾼다.
// 사용: npm run build:artifact  →  dist-artifact/cafedam.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
const out = path.join(root, "dist-artifact");
mkdirSync(out, { recursive: true });

const REACT_VERSION = "18.3.1";

const globals = {
  name: "umd-globals",
  setup(b) {
    const map = { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM" };
    b.onResolve({ filter: /^(react|react-dom|react-dom\/client)$/ }, (a) => ({ path: a.path, namespace: "umd" }));
    b.onLoad({ filter: /.*/, namespace: "umd" }, (a) => ({ contents: `module.exports = window.${map[a.path]};`, loader: "js" }));
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(src, "artifact/shims/next-link.tsx") }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: path.join(src, "artifact/shims/next-navigation.ts") }));
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "umd-empty" }));
    b.onLoad({ filter: /.*/, namespace: "umd-empty" }, () => ({ contents: "", loader: "js" }));
  },
};

const js = await build({
  entryPoints: [path.join(src, "artifact/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  // tsconfig.json 의 "react-jsx"(React 19 런타임)를 덮어써 UMD React 18 의 createElement 로 변환한다
  tsconfigRaw: { compilerOptions: { jsx: "react", jsxFactory: "React.createElement", jsxFragmentFactory: "React.Fragment" } },
  banner: { js: "var React = window.React;" },
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@": src },
  plugins: [globals],
  logLevel: "warning",
});
const code = js.outputFiles[0].text.replaceAll("</script", "<\\/script");

const cssFile = path.join(out, "app.css");
execFileSync("npx", ["@tailwindcss/cli", "-i", path.join(src, "app/globals.css"), "-o", cssFile, "--minify"], { cwd: root, stdio: "inherit" });
const css = readFileSync(cssFile, "utf8");

const html = `<title>카페댐</title>
<meta name="description" content="카페 운영 올인원: 리뷰 답글, 원가 계산, 알바 근태, 홍보 포스터, 손익, 메뉴 분석">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/${REACT_VERSION}/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/${REACT_VERSION}/umd/react-dom.production.min.js"></script>
<script>${code}</script>
`;
writeFileSync(path.join(out, "cafedam.html"), html);
console.log(`dist-artifact/cafedam.html  ${(html.length / 1024).toFixed(0)} KB`);
