"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { getCurrencySpec } from "@/lib/money";

interface Separators {
  group: string;
  decimal: string;
}

// Locale formatting for the field. IDR has no decimals; USD/SGD use
// comma grouping + dot decimal; EUR uses dot grouping + comma decimal.
const CURRENCY_SEPARATORS: Record<string, Separators> = {
  IDR: { group: ".", decimal: "" },
  USD: { group: ",", decimal: "." },
  SGD: { group: ",", decimal: "." },
  EUR: { group: ".", decimal: "," },
};

function separatorsFor(currency: string): Separators {
  return (
    CURRENCY_SEPARATORS[currency] ?? { group: ",", decimal: "." }
  );
}

function safeSpec(currency?: string) {
  try {
    return getCurrencySpec(currency);
  } catch {
    return getCurrencySpec("IDR");
  }
}

function countChar(value: string, char: string): number {
  let count = 0;
  for (const ch of value) {
    if (ch === char) count++;
  }
  return count;
}

/**
 * Normalize raw field text into a canonical value string:
 * digits only for IDR, or `int.frac` (frac capped at the currency's
 * minor units) for decimal currencies. Separators follow the locale.
 */
function toNormalized(
  raw: string,
  spec: { code: string; minorUnits: number },
): string {
  const decimals = spec.minorUnits;
  if (decimals === 0) {
    return raw.replace(/[^\d]/g, "");
  }
  const seps = separatorsFor(spec.code);
  const primary = seps.decimal;
  const alt = primary === "." ? "," : ".";
  let decIndex = raw.indexOf(primary);
  if (decIndex === -1 && countChar(raw, alt) === 1) {
    decIndex = raw.indexOf(alt);
  }
  const int = (decIndex === -1 ? raw : raw.slice(0, decIndex)).replace(
    /[^\d]/g,
    "",
  );
  if (decIndex === -1) {
    return int;
  }
  const frac = raw
    .slice(decIndex + 1)
    .replace(/[^\d]/g, "")
    .slice(0, decimals);
  return frac === "" ? int : `${int}.${frac}`;
}

function toDisplay(normalized: string, seps: Separators): string {
  const dot = normalized.indexOf(".");
  const int = dot === -1 ? normalized : normalized.slice(0, dot);
  const frac = dot === -1 ? "" : normalized.slice(dot + 1);
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, seps.group);
  return frac === "" ? grouped : `${grouped}${seps.decimal}${frac}`;
}

function valueToNormalized(value: number | null, decimals: number): string {
  if (value === null) return "";
  if (decimals === 0) return String(Math.trunc(value));
  return value.toFixed(decimals);
}

function toDisplayValue(
  value: number | null,
  decimals: number,
  seps: Separators,
): string {
  if (value === null || value === 0) return "";
  return toDisplay(valueToNormalized(value, decimals), seps);
}

function readCursor(input: HTMLInputElement): number {
  return input.selectionStart ?? input.value.length;
}

interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  id?: string;
}

export function MoneyInput({
  value,
  onValueChange,
  currency,
  className,
  placeholder,
  disabled,
  required,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  id,
  ...props
}: MoneyInputProps) {
  const spec = safeSpec(currency);
  const seps = separatorsFor(spec.code);
  const decimals = spec.minorUnits;
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ digits: number; afterDec: boolean }>({
    digits: 0,
    afterDec: false,
  });

  const [text, setText] = useState<string>(() =>
    toDisplayValue(value, decimals, seps),
  );

  useEffect(() => {
    if (document.activeElement === ref.current) return;
    setText(toDisplayValue(value, decimals, seps));
  }, [value, currency, decimals, seps]);

  const computeCaret = (input: HTMLInputElement) => {
    const caret = readCursor(input);
    const raw = input.value;
    let digits = 0;
    for (let i = 0; i < caret; i++) {
      if (/\d/.test(raw[i])) digits++;
    }
    const decIndex = raw.lastIndexOf(seps.decimal);
    caretRef.current = {
      digits,
      afterDec: decIndex !== -1 && caret > decIndex,
    };
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const normalized = toNormalized(input.value, spec);
    computeCaret(input);
    onValueChange(normalized === "" ? null : parseFloat(normalized));
    setText(toDisplay(normalized, seps));
  };

  useLayoutEffect(() => {
    if (document.activeElement !== ref.current) return;
    const input = ref.current;
    if (!input) return;

    let position = 0;
    let seen = 0;
    const target = caretRef.current.digits;
    const value = input.value;
    for (let i = 0; i < value.length; i++) {
      if (/\d/.test(value[i])) {
        seen++;
        if (seen === target) {
          position = i + 1;
          break;
        }
      }
    }

    const decIndex = value.lastIndexOf(seps.decimal);
    if (caretRef.current.afterDec && decIndex !== -1 && position <= decIndex) {
      position = decIndex + 1;
    }

    input.setSelectionRange(position, position);
  }, [text, seps]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    if (ref.current) {
      computeCaret(ref.current);
    }
    props.onClick?.(event);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (ref.current) {
      computeCaret(ref.current);
    }
    props.onSelect?.(event);
  };

  const handleCompositionStart = () => {
    // keep IME composition intact
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement>) => {
    handleChange(event as unknown as React.ChangeEvent<HTMLInputElement>);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text");
    const normalized = toNormalized(pastedText, spec);
    onValueChange(normalized === "" ? null : parseFloat(normalized));
    caretRef.current = {
      digits: normalized.replace(/[^\d]/g, "").length,
      afterDec: normalized.includes("."),
    };
    setText(toDisplay(normalized, seps));
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      placeholder={placeholder ?? "0"}
      value={text}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onSelect={handleSelect}
      onPaste={handlePaste}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      aria-invalid={ariaInvalid}
      id={id}
      className={className}
      style={{
        ...props.style,
        MozAppearance: "textfield",
      }}
      {...props}
    />
  );
}
