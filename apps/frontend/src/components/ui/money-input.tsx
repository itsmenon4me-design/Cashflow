"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
  className,
  placeholder,
  disabled,
  required,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  id,
  ...props
}: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigitsRef = useRef(0);

  const toDisplay = (val: number | null): string => {
    if (val === null || val === 0) return "";
    return groupDigits(String(Math.trunc(val)));
  };

  const [text, setText] = useState<string>(() => toDisplay(value));

  useEffect(() => {
    if (document.activeElement === ref.current) return;
    setText(toDisplay(value));
  }, [value]);

  const processInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      onValueChange(null);
      setText("");
      return;
    }
    onValueChange(parseInt(digits, 10));
    setText(groupDigits(digits));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const caret = readCursor(input);
    const rawDigitsBefore = input.value.slice(0, caret).replace(/[^\d]/g, "").length;
    caretDigitsRef.current = rawDigitsBefore;
    processInput(input.value);
  };

  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || document.activeElement !== input) return;

    let position = 0;
    let seen = 0;
    const target = caretDigitsRef.current;
    for (let i = 0; i < input.value.length; i++) {
      if (/\d/.test(input.value[i])) {
        seen++;
        if (seen === target) {
          position = i + 1;
          break;
        }
      }
    }
    input.setSelectionRange(position, position);
  }, [text]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    if (ref.current) {
      const caret = readCursor(ref.current);
      caretDigitsRef.current = ref.current.value.slice(0, caret).replace(/[^\d]/g, "").length;
    }
    props.onClick?.(event);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    if (ref.current) {
      const caret = readCursor(ref.current);
      caretDigitsRef.current = ref.current.value.slice(0, caret).replace(/[^\d]/g, "").length;
    }
    props.onSelect?.(event);
  };

  const handleCompositionEnd = (event: React.CompositionEvent<HTMLInputElement>) => {
    processInput(event.currentTarget.value);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const digits = pasted.replace(/[^\d]/g, "");
    caretDigitsRef.current = digits.length;
    if (digits === "") {
      onValueChange(null);
      setText("");
    } else {
      onValueChange(parseInt(digits, 10));
      setText(groupDigits(digits));
    }
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? "0"}
      value={text}
      onChange={handleChange}
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
