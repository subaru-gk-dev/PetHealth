import { useEffect, useState } from 'preact/hooks';

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  /** 'decimal' shows a keypad with a decimal point on phones. */
  inputMode?: 'decimal' | 'numeric';
  required?: boolean;
  testId?: string;
}

/**
 * Numeric field that keeps what the user is typing as text, so intermediate
 * states like "6." survive re-renders. The parent only ever sees a number.
 * A plain text input is used on purpose: type="number" sanitises "6." to ""
 * while typing, which is what made decimals impossible to enter on a phone.
 */
export function NumberInput({ value, onChange, inputMode = 'decimal', required, testId }: Props) {
  const [text, setText] = useState(() => toText(value));

  // Take the parent's value only when it really differs from what is typed
  // (e.g. the derived "drunk ml" changing), never while "6." or "0" is in
  // progress. A parent that maps 0 to undefined must not wipe the field.
  useEffect(() => {
    if (value !== undefined && parse(text) !== value) setText(toText(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode={inputMode}
      pattern={inputMode === 'numeric' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
      autocomplete="off"
      required={required}
      data-testid={testId}
      value={text}
      onInput={(ev) => {
        const t = ev.currentTarget.value;
        setText(t);
        onChange(parse(t));
      }}
    />
  );
}

function toText(v: number | undefined): string {
  return v === undefined ? '' : String(v);
}

function parse(t: string): number | undefined {
  const s = t.trim().replace(',', '.');
  if (s === '' || s === '.' || s === '-') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
