import { createFileRoute } from "@tanstack/react-router";
import { DeviceFrame } from "@/components/solvera/DeviceFrame";
import { QrPoster } from "@/components/solvera/QrPoster";

export const Route = createFileRoute("/qr")({
  component: Page,
  head: () => ({
    meta: [
      { title: "SOOPSAI 접속 QR 코드 — 7-Day Bloom Report" },
      {
        name: "description",
        content: "SOOPSAI 7-Day Bloom Report 접속용 QR 코드. 인쇄하거나 이미지로 저장해 매장·패키지에 활용하세요.",
      },
      { property: "og:title", content: "SOOPSAI 접속 QR 코드" },
      { property: "og:description", content: "7-Day Bloom Report 접속용 QR 코드를 인쇄하거나 저장하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Page() {
  return (
    <DeviceFrame>
      <QrPoster />
    </DeviceFrame>
  );
}
