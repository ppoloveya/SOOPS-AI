import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { name: "description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
      { property: "og:title", content: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { property: "og:description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { name: "twitter:description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7554041d-dee6-49e8-9e0a-e917742d7ed5/id-preview-d96f4117--d2f36cce-6bbb-4b27-8039-b12aa545a565.lovable.app-1785367826148.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7554041d-dee6-49e8-9e0a-e917742d7ed5/id-preview-d96f4117--d2f36cce-6bbb-4b27-8039-b12aa545a565.lovable.app-1785367826148.png" },
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
