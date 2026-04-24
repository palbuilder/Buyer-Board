"use client";

import { useState, useTransition } from "react";
import { ImagePicker } from "@/app/components/image-picker";
import { uploadCompressedImages } from "@/lib/browser-media";

type OfferReportFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  requestId: string;
  slug: string;
  offerId: string;
};

export function OfferReportForm({ action, requestId, slug, offerId }: OfferReportFormProps) {
  const [isPending, startTransition] = useTransition();
  const [images, setImages] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setUploadMessage("");

    startTransition(async () => {
      try {
        const imageUrls = images.length > 0 ? await uploadCompressedImages({ files: images, folder: "offer-reports" }) : [];
        formData.set("imageUrls", JSON.stringify(imageUrls));
        await action(formData);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "Unable to upload offer report images right now.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="form-card mt-4 grid gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="reportTarget" value="offer" />
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Report this seller offer</p>
      <label className="field-label">
        Report reason
        <select name="reason" className="field-select">
          <option value="tos_violation">Terms of Service violation</option>
          <option value="illegal_item">Illegal item</option>
          <option value="unsafe_item">Unsafe or misleading photos</option>
          <option value="harassment">Harassment or abusive content</option>
          <option value="spam">Spam or scam offer</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className="field-label">
        Details
        <textarea
          name="details"
          className="field-textarea min-h-24"
          placeholder="Explain what is wrong with this seller offer or its photos."
        />
      </label>
      <ImagePicker
        label="Supporting images"
        helperText="Optional. Upload screenshots or comparison photos that help explain the report."
        files={images}
        onFilesChange={setImages}
        maxFiles={4}
      />
      {uploadMessage ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {uploadMessage}
        </div>
      ) : null}
      <button
        disabled={isPending}
        className="secondary-button w-fit rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Uploading report..." : "Report seller offer"}
      </button>
    </form>
  );
}
