type ImageStripProps = {
  imageUrls: string[];
  altPrefix: string;
};

export function ImageStrip({ imageUrls, altPrefix }: ImageStripProps) {
  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {imageUrls.map((imageUrl, index) => (
        <a
          key={`${imageUrl}-${index}`}
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="data-card overflow-hidden rounded-[1rem] transition hover:-translate-y-0.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${altPrefix} ${index + 1}`} src={imageUrl} className="h-44 w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
