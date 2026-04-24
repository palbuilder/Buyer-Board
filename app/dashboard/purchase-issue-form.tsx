"use client";

import { useState, useTransition } from "react";
import { ImagePicker } from "@/app/components/image-picker";
import { uploadCompressedImages } from "@/lib/browser-media";

type PurchaseIssueFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  transactionId: string;
  requestId: string;
};

export function PurchaseIssueForm({ action, transactionId, requestId }: PurchaseIssueFormProps) {
  const [isPending, startTransition] = useTransition();
  const [images, setImages] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setUploadMessage("");

    startTransition(async () => {
      try {
        const imageUrls = images.length > 0 ? await uploadCompressedImages({ files: images, folder: "buyer-disputes" }) : [];
        formData.set("buyerEvidenceImageUrls", JSON.stringify(imageUrls));
        await action(formData);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "Unable to upload evidence images right now.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 grid gap-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="field-label">
        What went wrong?
        <select name="reason" className="field-select">
          <option value="wrong_item">Seller sent the wrong part or item</option>
          <option value="defective_item">Item arrived defective or non-working</option>
          <option value="not_as_described">Item does not match the description</option>
          <option value="shipping_issue">Shipping or packaging issue</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="field-label">
        Issue details
        <textarea
          name="details"
          className="field-textarea min-h-28"
          placeholder="Example: Seller sent a 1998 alternator instead of a 1990 Ford Ranger alternator, or the alternator failed bench testing on install."
        />
      </label>
      <label className="field-label">
        Evidence notes
        <textarea
          name="buyerEvidence"
          className="field-textarea min-h-24"
          placeholder="Add bench-test notes, screenshots, or shipping details that support your claim."
        />
      </label>
      <ImagePicker
        label="Evidence photos"
        helperText="Optional. Upload photos of the part, labels, packaging, or test results. Large phone photos are compressed automatically."
        files={images}
        onFilesChange={setImages}
        maxFiles={6}
      />
      {uploadMessage ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {uploadMessage}
        </div>
      ) : null}
      <button disabled={isPending} className="brand-button w-fit rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
        {isPending ? "Uploading evidence..." : "Report purchase issue"}
      </button>
    </form>
  );
}
