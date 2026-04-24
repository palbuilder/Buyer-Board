"use client";

import { useState, useTransition } from "react";
import { ImagePicker } from "@/app/components/image-picker";
import { uploadCompressedImages } from "@/lib/browser-media";

type SellerDisputeResponseFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  disputeId: string;
};

export function SellerDisputeResponseForm({ action, disputeId }: SellerDisputeResponseFormProps) {
  const [isPending, startTransition] = useTransition();
  const [images, setImages] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");

  async function handleSubmit(formData: FormData) {
    setUploadMessage("");

    startTransition(async () => {
      try {
        const imageUrls = images.length > 0 ? await uploadCompressedImages({ files: images, folder: "seller-disputes" }) : [];
        formData.set("sellerEvidenceImageUrls", JSON.stringify(imageUrls));
        await action(formData);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "Unable to upload seller evidence right now.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-4 grid gap-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <label className="field-label">
        Seller response
        <textarea
          name="response"
          className="field-textarea min-h-28"
          placeholder="Explain what you shipped, whether you can replace the item, and what resolution you are offering."
        />
      </label>
      <label className="field-label">
        Evidence notes
        <textarea
          name="sellerEvidence"
          className="field-textarea min-h-24"
          placeholder="Add test notes, part numbers, shipment proof, or context supporting your response."
        />
      </label>
      <ImagePicker
        label="Seller evidence photos"
        helperText="Optional. Upload part photos, test results, labels, or shipment proof. BuyerBoard compresses large photos automatically."
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
        {isPending ? "Uploading evidence..." : "Send seller response"}
      </button>
    </form>
  );
}
