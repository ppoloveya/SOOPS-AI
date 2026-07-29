import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SOLVÉRA 7-Day Bloom Report" },
      { name: "description", content: "솔베라 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. 하루 30초, 나만의 리커버리 기록." },
      { property: "og:title", content: "SOLVÉRA 7-Day Bloom Report" },
      { property: "og:description", content: "7일 동안 피부 상태와 생활을 기록하고, 나만의 리커버리 리포트를 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/gh/wanteddev/maru-buri@1.2/dist/MaruBuri.css" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" />
    </>
  );
}
