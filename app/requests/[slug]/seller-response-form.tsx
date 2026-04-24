"use client";

import { useState, useTransition } from "react";
import { ImagePicker } from "@/app/components/image-picker";
import { uploadCompressedImages } from "@/lib/browser-media";

export function SellerResponseForm({
  action,
  requestId,
  slug,
  hasExistingConversation,
  sellerDisplayName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  requestId: string;
  slug: string;
  hasExistingConversation: boolean;
  sellerDisplayName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [images, setImages] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setUploadMessage("");

    startTransition(async () => {
      try {
        const imageUrls = images.length > 0 ? await uploadCompressedImages({ files: images, folder: "offers" }) : [];
        formData.set("imageUrls", JSON.stringify(imageUrls));
        await action(formData);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "Unable to upload seller offer photos right now.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-6 grid gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="rounded-[1rem] border border-white/15 bg-white/8 px-4 py-3 text-sm leading-7 text-teal-50">
        Sending as: <span className="font-medium">{sellerDisplayName || "Your account display name"}</span>
      </div>
      <label className="field-label text-teal-50">
        Offer price (USD)
        <input
          name="offeredPrice"
          className="field-input border-white/15 bg-white/8 text-white placeholder:text-teal-100/60"
          placeholder="165"
          required
        />
      </label>
      <label className="field-label text-teal-50">
        Proposed claim window
        <select name="claimWindowHours" defaultValue="48" className="field-select border-white/15 bg-white/8 text-white">
          <option value="24">24 hours</option>
          <option value="36">36 hours</option>
          <option value="48">48 hours</option>
          <option value="72">72 hours</option>
          <option value="96">96 hours</option>
          <option value="120">120 hours</option>
        </select>
      </label>
      <label className="field-label text-teal-50">
        Proposal comments
        <textarea
          name="message"
          className="field-textarea min-h-32 border-white/15 bg-white/8 text-white placeholder:text-teal-100/60"
          placeholder="Introduce yourself, explain your price, and note why this claim window works for you."
          required
        />
      </label>
      <ImagePicker
        label="Seller photos"
        helperText="Optional. Show the exact item or part you want to offer. Large phone photos are compressed automatically before upload."
        files={images}
        onFilesChange={setImages}
        maxFiles={6}
      />
      {uploadMessage ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {uploadMessage}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Uploading offer photos..." : "Send Claim Offer"}
      </button>
      <p className="text-xs leading-6 text-teal-100/80">
        {hasExistingConversation
          ? "Messaging has started. Now the buyer can compare your offer and decide whether to approve your claim window."
          : "The first step is sending your offer. Once the buyer reviews it, they can approve, deny, or counter."} BuyerBoard blocks firearms, illegal items, and threatening language.
      </p>
    </form>
  );
}
