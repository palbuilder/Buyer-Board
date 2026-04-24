"use client";

import { useMemo, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ImagePicker } from "@/app/components/image-picker";
import { uploadCompressedImages } from "@/lib/browser-media";
import { categoryList, getSubcategoryOptions } from "@/lib/catalog";
import { getVehicleModels, vehicleMakes, vehicleYears } from "@/lib/vehicle-data";

const conditions = ["Any", "New", "Used - good", "Used - fair", "For parts only", "Other"];
const shippingOptions = [
  { label: "Any", value: "Any" },
  { label: "Ship only", value: "Ship only" },
  { label: "Pickup only", value: "Pickup only" },
  { label: "Other", value: "Other" },
];

type RequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function RequestForm({ action }: RequestFormProps) {
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState<string>(categoryList[0]);
  const subcategories = useMemo(() => getSubcategoryOptions(category), [category]);
  const [subcategory, setSubcategory] = useState<string>(subcategories[0]);
  const [vehicleMake, setVehicleMake] = useState<string>(vehicleMakes[0]);
  const vehicleModels = useMemo(() => getVehicleModels(vehicleMake), [vehicleMake]);
  const [vehicleModel, setVehicleModel] = useState<string>(vehicleModels[0]);
  const [images, setImages] = useState<File[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const showVehicleFields = category === "Auto Parts";

  async function handleSubmit(formData: FormData) {
    setUploadMessage("");

    startTransition(async () => {
      try {
        const imageUrls = images.length > 0 ? await uploadCompressedImages({ files: images, folder: "requests" }) : [];
        formData.set("imageUrls", JSON.stringify(imageUrls));
        await action(formData);
      } catch (error) {
        if (isRedirectError(error)) {
          throw error;
        }
        setUploadMessage(error instanceof Error ? error.message : "Unable to upload request photos right now.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-8 grid gap-4">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="field-label">
          Item title
          <input
            name="title"
            className="field-input"
            placeholder={showVehicleFields ? "Example: 2018 Tacoma tailgate" : "Example: DeWalt planer DW734"}
            required
          />
        </label>
        <label className="field-label">
          Category
          <select
            name="category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategory(nextCategory);
              setSubcategory(getSubcategoryOptions(nextCategory)[0]);
            }}
            className="field-select"
            required
          >
            {categoryList.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
            <option>Other</option>
          </select>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="field-label">
          Subcategory
          <select
            name="subcategory"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            className="field-select"
            required
          >
            {subcategories.map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
        </label>
      </div>

      {showVehicleFields ? (
        <div className="grid gap-5 md:grid-cols-3">
          <label className="field-label">
            Vehicle year
            <select
              name="vehicleYear"
              className="field-select"
              defaultValue={vehicleYears[0]}
              required
            >
              {vehicleYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Make
            <select
              name="vehicleMake"
              value={vehicleMake}
              onChange={(event) => {
                const nextMake = event.target.value;
                setVehicleMake(nextMake);
                setVehicleModel(getVehicleModels(nextMake)[0]);
              }}
              className="field-select"
              required
            >
              {vehicleMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Model
            <select
              name="vehicleModel"
              value={vehicleModel}
              onChange={(event) => setVehicleModel(event.target.value)}
              className="field-select"
              required
            >
              {vehicleModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="field-label">
          Target price
          <div className="flex items-center rounded-2xl border border-black/10 bg-white px-4 py-3">
            <span className="mr-2 text-sm font-medium text-stone-500">USD</span>
            <input name="targetPrice" className="w-full border-0 bg-transparent p-0 outline-none ring-0" placeholder="350" required />
          </div>
        </label>
        <label className="field-label">
          Desired condition
          <select name="conditionPreference" className="field-select">
            {conditions.map((condition) => (
              <option key={condition}>{condition}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="field-label">
          Shipping preference
          <select name="shippingPreference" defaultValue="Any" className="field-select" required>
            {shippingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="field-help">BuyerBoard now uses the safer city/state already saved in your dashboard profile instead of asking for public location again here.</span>
        </label>
      </div>

      <label className="field-label">
        Description
        <textarea
          name="description"
          className="field-textarea min-h-40"
          placeholder="Describe the exact item, acceptable wear, must-have parts, and anything the seller should confirm before claiming."
          required
        />
      </label>

      <ImagePicker
        label="Request photos"
        helperText="Add up to 6 photos. BuyerBoard compresses large phone photos automatically before upload to keep quality high and file sizes manageable."
        files={images}
        onFilesChange={setImages}
        maxFiles={6}
      />

      {uploadMessage ? (
        <div className="rounded-[1.25rem] border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-950">
          {uploadMessage}
        </div>
      ) : null}

      <div className="form-card border-dashed border-teal-900/20 bg-[var(--accent-soft)]">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-teal-900">Temporary MVP behavior</p>
        <p className="mt-2 text-sm leading-7 text-teal-950/85">
          BuyerBoard blocks firearms, illegal items, and threatening language. Members can report listings that violate Terms of Service or feel unsafe.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={isPending} className="brand-button tight-button text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60">
          {isPending ? "Compressing and uploading photos..." : "Publish request"}
        </button>
      </div>
    </form>
  );
}
