"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatStoredUsPhoneNumber, formatUsPhoneInput, normalizeUsPhoneNumber } from "@/lib/phone";

type PhoneVerificationPanelProps = {
  initialPhoneNumber: string;
  phoneVerified: boolean;
};

export function PhoneVerificationPanel({ initialPhoneNumber, phoneVerified }: PhoneVerificationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const savedPhoneNumber = formatStoredUsPhoneNumber(initialPhoneNumber);

  async function sendCode() {
    setLocalError(null);
    setLocalNotice(null);

    const normalizedPhone = normalizeUsPhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      setLocalError("Enter a valid 10-digit US phone number.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        phone: normalizedPhone,
      });

      if (error) {
        throw error;
      }

      setCodeSent(true);
      setLocalNotice("Verification code sent. Enter the 6-digit code from your text message.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send SMS verification code.";
      setLocalError(message);
    }
  }

  async function verifyCode() {
    setLocalError(null);
    setLocalNotice(null);

    const normalizedPhone = normalizeUsPhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      setLocalError("Enter a valid 10-digit US phone number.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode.trim(),
        type: "phone_change",
      });

      if (error) {
        throw error;
      }

      const response = await fetch("/api/phone/verification/sync", {
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to sync verified phone.");
      }

      startTransition(() => {
        router.push("/dashboard?notice=Phone verified by SMS");
        router.refresh();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to verify SMS code.";
      setLocalError(message);
    }
  }

  if (phoneVerified) {
    return (
      <div className="rounded-[1.25rem] border border-emerald-300/70 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
        Your phone number is verified and ready for seller trust checks.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <label className="field-label">
        Phone number for SMS verification
        <input
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(formatUsPhoneInput(event.target.value))}
          className="field-input"
          placeholder="555-555-5555"
          inputMode="tel"
          autoComplete="tel-national"
        />
      </label>
      {savedPhoneNumber ? (
        <p className="field-help">
          Saved number on file: {savedPhoneNumber}. Enter a number above only if you want to verify or change it.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void sendCode()}
          disabled={isPending || !phoneNumber.trim()}
          className="brand-button rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send SMS code
        </button>
      </div>
      {codeSent ? (
        <>
          <label className="field-label">
            6-digit verification code
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              className="field-input"
              placeholder="123456"
              inputMode="numeric"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={isPending || otpCode.trim().length < 6}
              className="secondary-button rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              Verify code
            </button>
          </div>
        </>
      ) : null}
      {localNotice ? (
        <div className="rounded-[1.25rem] border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-950">
          {localNotice}
        </div>
      ) : null}
      {localError ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {localError}
        </div>
      ) : null}
      <p className="field-help">
        Enter a normal 10-digit US number. BuyerBoard converts it to the carrier format automatically. If SMS is still blocked, you can use the manual review fallback below.
      </p>
    </div>
  );
}
