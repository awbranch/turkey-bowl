import { renderSVG } from "uqr";

/** Server-rendered QR code (inline SVG). */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const svg = renderSVG(value, { border: 2 });
  return <div className={`[&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
