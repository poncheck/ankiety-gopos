import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function BarcodeDisplay({ value }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        lineColor: "#111827",
        background: "transparent",
        width: 2,
        height: 64,
        displayValue: false,
        margin: 4,
      });
    } catch (e) {
      // Jeśli kod nie jest kompatybilny z CODE128, pokaż tylko tekst
      console.warn("Barcode generation failed:", e);
    }
  }, [value]);

  if (!value) return null;

  return (
    <div style={{ textAlign: "center" }}>
      <svg ref={svgRef} style={{ maxWidth: "100%", display: "block", margin: "0 auto" }} />
      <span style={{
        display: "block",
        marginTop: "0.4rem",
        fontSize: "1rem",
        fontFamily: "monospace",
        letterSpacing: "0.12em",
        color: "#374151",
      }}>
        {value}
      </span>
    </div>
  );
}
