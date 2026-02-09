import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export interface BarcodeProps {
  value: string;
  className?: string;
}

export function Barcode({ value, className }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        displayValue: false,
        height: 40,
        margin: 0,
      });
    } catch {
      // ignore barcode errors
    }
  }, [value]);

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-hidden="true"
      role="img"
      focusable="false"
    />
  );
}

export default Barcode;
