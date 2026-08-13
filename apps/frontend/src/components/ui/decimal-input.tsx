"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

function extractDecimalDigits(value: string): string {
  let raw = value.replace(/[^\d.]/g, "");
  const firstDot = raw.indexOf(".");
  if (firstDot !== -1) {
    raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
  }
  return raw;
}

function readCursor(input: HTMLInputElement): number {
  return input.selectionStart ?? input.value.length;
}

interface DecimalInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode"> {
  value: number | null;
  onValueChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  id?: string;
}

export function DecimalInput({
  value,
  onValueChange,
  className,
  placeholder,
  disabled,
  required,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  id,
  ...props
}: DecimalInputProps) {
  const [text, setText] = useState<string>(() => (value === null ? "" : String(value)));
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ digitBefore: number; afterDot: boolean }>({
    digitBefore: 0,
    afterDot: false,
  });

  useEffect(() => {
    if (document.activeElement === ref.current) return;
    setText(value === null ? "" : String(value));
  }, [value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const rawValue = input.value;
    const digits = extractDecimalDigits(rawValue);

    computeCaret(input, rawValue);
    onValueChange(digits === "" ? null : Number(digits));
    setText(digits);
  };

  const computeCaret = (input: HTMLInputElement, raw: string) => {
    const caret = readCursor(input);
    const dotIndex = raw.indexOf(".");
    let digitBefore = 0;
    for (let i = 0; i < caret; i++) {
      if (/\d/.test(raw[i])) digitBefore++;
    }
    caretRef.current = {
      digitBefore,
      afterDot: dotIndex !== -1 && caret > dotIndex,
    };
  };

  useLayoutEffect(() => {
    if (document.activeElement !== ref.current) return;
    const input = ref.current;
    if (!input) return;

    const { digitBefore, afterDot } = caretRef.current;
    const value = input.value;

    let position = 0;
    let seen = 0;
    for (let i = 0; i < value.length; i++) {
      if (/\d/.test(value[i])) {
        seen++;
        if (seen === digitBefore) {
          position = i + 1;
          break;
        }
      }
    }

    if (afterDot) {
      const dotIndex = value.indexOf(".");
      if (dotIndex !== -1 && position <= dotIndex) {
        position = dotIndex + 1;
      }
    }

    input.setSelectionRange(position, position);
  }, [text]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    if (ref.current) {
      computeCaret(ref.current, ref.current.value);
    }
    props.onClick?.(event);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (ref.current) {
      computeCaret(ref.current, ref.current.value);
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
    const digits = extractDecimalDigits(pastedText);
    onValueChange(digits === "" ? null : Number(digits));

    caretRef.current = { digitBefore: digits.length, afterDot: digits.includes(".") };
    setText(digits);

    if (ref.current) {
      ref.current.setSelectionRange(digits.length, digits.length);
    }
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
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