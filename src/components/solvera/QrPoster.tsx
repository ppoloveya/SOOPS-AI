import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export function QrPoster() {
  const [origin, setOrigin] = useState("");
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const target = useMemo(() => (origin ? `${origin}/` : ""), [origin]);

  useEffect(() => {
    if (!target) return;
    QRCode.toDataURL(target, {
      width: 1024,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#24152B", light: "#F4EFE8" },
    }).then(setDataUrl);
  }, [target]);

  return (
    <div className="min-h-full bg-ivory px-6 py-12 flex flex-col items-center text-center">
      <p className="tracking-brand text-[11px] uppercase text-muted-foreground">Solvéra</p>
      <h1 className="font-serif text-2xl text-plum mt-3">7-Day Bloom Report</h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        카메라로 QR을 스캔하면
        <br />
        7일 셀프 피부 리포트가 시작됩니다.
      </p>

      <div className="print-avoid-break mt-8 rounded-3xl border border-border bg-card p-5 shadow-[0_16px_40px_-24px_rgba(36,21,43,0.5)]">
        {dataUrl ? (
          <img src={dataUrl} alt="SOLVÉRA 7-Day Bloom Report 접속 QR 코드" className="h-56 w-56" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-xl bg-muted" />
        )}
      </div>

      <p className="mt-5 break-all text-[11px] text-muted-foreground">{target}</p>

      <div className="no-print mt-8 flex flex-col gap-3 w-full max-w-[260px]">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-plum px-6 py-3 text-sm text-ivory"
        >
          포스터 인쇄하기
        </button>
        <a
          href={dataUrl || "#"}
          download="solvera-qr.png"
          className="rounded-full border border-border px-6 py-3 text-sm text-plum"
        >
          QR 이미지 저장
        </a>
      </div>
    </div>
  );
}
