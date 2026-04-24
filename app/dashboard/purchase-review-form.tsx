"use client";

import { useFormStatus } from "react-dom";

type PurchaseReviewFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  transactionId: string;
  requestId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="brand-button w-fit rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>
      {pending ? "Saving review..." : "Submit review"}
    </button>
  );
}

export function PurchaseReviewForm({ action, transactionId, requestId }: PurchaseReviewFormProps) {
  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field-label">
        Star rating
        <select name="rating" className="field-select" defaultValue="5">
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Good</option>
          <option value="3">3 - Fair</option>
          <option value="2">2 - Poor</option>
          <option value="1">1 - Bad</option>
        </select>
      </label>
      <label className="field-label">
        Review notes
        <textarea
          name="reviewText"
          className="field-textarea min-h-24"
          placeholder="Optional. Describe whether the item matched the listing, shipped on time, and worked as expected."
        />
      </label>
      <SubmitButton />
    </form>
  );
}
