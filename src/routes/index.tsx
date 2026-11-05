import { createFileRoute } from "@tanstack/react-router";
import { DeviceFrame } from "@/components/solvera/DeviceFrame";
import { SolveraApp } from "@/components/solvera/App";

export const Route = createFileRoute("/")({
  component: Page,
  head: () => ({
    meta: [
      { title: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { name: "description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
      { property: "og:title", content: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { property: "og:description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SOOPSAI 7-Day Bloom Report — 나만의 리커버리 리포트" },
      { name: "twitter:description", content: "SOOPSAI 찔레꽃 리커버리 앰플과 함께하는 7일 셀프 피부 리포트. QR로 접속해 하루 30초씩 기록하고 개인 리포트를 확인하세요." },
    ],
  }),
});

function Page() {
  return (
    <DeviceFrame>
      <SolveraApp />
    </DeviceFrame>
  );
}
