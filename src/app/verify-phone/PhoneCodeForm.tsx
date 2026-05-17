"use client";

import { useEffect, useRef, useState } from "react";

import {
  restartPhoneVerificationAction,
  sendPhoneCodeAction,
  verifyPhoneCodeAction,
} from "./actions";

const RESEND_SECONDS = 30;

export function PhoneCodeForm({
  phone,
  error,
}: {
  phone: string;
  error?: string;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const code = digits.join("");

  function place(start: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 0) {
      setDigits((d) => d.map((c, i) => (i === start ? "" : c)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      for (let k = 0; k < cleaned.length && start + k < 6; k++) {
        next[start + k] = cleaned[k]!;
      }
      return next;
    });
    const landed = Math.min(start + cleaned.length, 5);
    refs.current[landed]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <div className="mt-7 flex flex-col gap-4">
      <form action={verifyPhoneCodeAction} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={code} />
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => place(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => {
                e.preventDefault();
                place(i, e.clipboardData.getData("text"));
              }}
              inputMode="numeric"
              maxLength={1}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              className={`h-14 w-12 rounded-2xl border-2 bg-fv-bg-card text-center text-2xl font-bold text-fv-text-primary focus:outline-none ${
                d ? "border-fv-accent-strong" : "border-fv-border"
              }`}
            />
          ))}
        </div>

        <p className="text-center text-sm text-fv-text-secondary">
          Didn&apos;t get it?{" "}
          {seconds > 0 ? (
            <span className="font-semibold text-fv-accent-strong">
              Resend in {seconds}s
            </span>
          ) : (
            <button
              type="submit"
              form="fv-resend"
              className="font-semibold text-fv-accent-strong"
            >
              Resend code
            </button>
          )}
        </p>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={code.length < 6}
          className="rounded-2xl bg-fv-accent-strong px-4 py-4 text-lg font-bold text-white hover:opacity-95 disabled:opacity-40"
        >
          Verify &amp; continue
        </button>
      </form>

      {/* Resend posts the same number through the send action again. */}
      <form id="fv-resend" action={sendPhoneCodeAction}>
        <input type="hidden" name="phone" value={phone} />
      </form>

      <form action={restartPhoneVerificationAction}>
        <button
          type="submit"
          className="w-full rounded-2xl bg-fv-bg-soft px-4 py-4 text-base font-bold text-fv-text-primary hover:opacity-90"
        >
          Change number
        </button>
      </form>
    </div>
  );
}
