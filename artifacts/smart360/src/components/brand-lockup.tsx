/** The official mark and the browser-rendered CGP wordmark on a white field. */
export function BrandLockup({ className = "", markSize = 52, textSize = 26 }: {
  className?: string;
  markSize?: number;
  textSize?: number;
}) {
  return (
    <div className={className} role="img" aria-label="Smart360" style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, background: "#FFFFFF", whiteSpace: "nowrap",
    }}>
      <img src={`${import.meta.env.BASE_URL}brand/smart360-znak-40.png`}
        width={markSize} height={markSize} alt="" style={{ display: "block" }} />
      <span aria-hidden="true" style={{
        fontFamily: "Archivo, sans-serif", fontSize: textSize, fontWeight: 800,
        letterSpacing: "0.02em", color: "#121A14", lineHeight: 1,
      }}>SMART360</span>
    </div>
  );
}