"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categoryList, getSubcategoryOptions } from "@/lib/catalog";

type RequestFiltersProps = {
  searchQuery: string;
  category: string;
  subcategory: string;
  shipping: string;
  status: string;
  sort: string;
  photoFilter: "all" | "has-photo";
  savedFilters: Array<{
    id: string;
    name: string;
    searchQuery: string;
    category: string;
    subcategory: string;
    shipping: string;
    status: string;
    sort: string;
    alertEnabled: boolean;
  }>;
};

export function RequestFilters({ searchQuery, category, subcategory, shipping, status, sort, photoFilter, savedFilters }: RequestFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const availableSubcategories = useMemo(
    () => (category === "All categories" ? ["All subcategories", "Other"] : ["All subcategories", ...getSubcategoryOptions(category)]),
    [category],
  );

  function updateFilters(next: Partial<RequestFiltersProps>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = {
      searchQuery,
      category,
      subcategory,
      shipping,
      status,
      sort,
      photoFilter,
      ...next,
    };

    if (!merged.searchQuery.trim()) {
      params.delete("q");
    } else {
      params.set("q", merged.searchQuery.trim());
    }

    if (merged.category === "All categories") {
      params.delete("category");
      merged.subcategory = "All subcategories";
      params.delete("subcategory");
    } else {
      params.set("category", merged.category);
    }

    if (merged.subcategory === "All subcategories") {
      params.delete("subcategory");
    } else {
      params.set("subcategory", merged.subcategory);
    }

    if (merged.shipping === "Any") {
      params.delete("shipping");
    } else {
      params.set("shipping", merged.shipping);
    }

    if (merged.status === "All statuses") {
      params.delete("status");
    } else {
      params.set("status", merged.status);
    }

    if (merged.sort === "Newest first") {
      params.delete("sort");
    } else {
      params.set("sort", merged.sort);
    }

    if (merged.photoFilter === "all") {
      params.delete("photos");
    } else {
      params.set("photos", merged.photoFilter);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="section-card mt-6 grid gap-3 rounded-[1.15rem] p-4 sm:grid-cols-2 lg:grid-cols-7">
      <label className="sm:col-span-2 lg:col-span-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Search</p>
        <input
          name="q"
          value={searchQuery}
          onChange={(event) => updateFilters({ searchQuery: event.target.value })}
          className="field-input mt-2 text-sm"
          placeholder="Search title, category, location, or details"
        />
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Saved</p>
        <select
          value=""
          onChange={(event) => {
            const selected = savedFilters.find((filter) => filter.id === event.target.value);

            if (!selected) {
              return;
            }

            updateFilters({
              searchQuery: selected.searchQuery,
              category: selected.category,
              subcategory: selected.subcategory,
              shipping: selected.shipping,
              status: selected.status,
              sort: selected.sort,
            });
          }}
          className="field-select mt-2 text-sm"
          disabled={savedFilters.length === 0}
        >
          <option value="">{savedFilters.length > 0 ? "Apply saved filter" : "No saved filters yet"}</option>
          {savedFilters.map((filter) => (
            <option key={filter.id} value={filter.id}>
              {filter.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Category</p>
        <select
          name="category"
          value={category}
          onChange={(event) =>
            updateFilters({
              category: event.target.value,
              subcategory: "All subcategories",
            })
          }
          className="field-select mt-2 text-sm"
        >
          <option>All categories</option>
          {categoryList.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
          <option>Other</option>
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Subcategory</p>
        <select
          name="subcategory"
          value={availableSubcategories.includes(subcategory) ? subcategory : "All subcategories"}
          onChange={(event) => updateFilters({ subcategory: event.target.value })}
          className="field-select mt-2 text-sm"
        >
          {availableSubcategories.map((entry) => (
            <option key={entry}>{entry}</option>
          ))}
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Shipping</p>
        <select
          name="shipping"
          value={shipping}
          onChange={(event) => updateFilters({ shipping: event.target.value })}
          className="field-select mt-2 text-sm"
        >
          <option>Any</option>
          <option>Ship only</option>
          <option>Pickup only</option>
          <option>Other</option>
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Status</p>
        <select
          name="status"
          value={status}
          onChange={(event) => updateFilters({ status: event.target.value })}
          className="field-select mt-2 text-sm"
        >
          <option>All statuses</option>
          <option value="open">open</option>
          <option value="negotiating">negotiating</option>
          <option value="claimed">claimed</option>
          <option value="fulfilled">fulfilled</option>
          <option value="closed">closed</option>
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Sort</p>
        <select
          name="sort"
          value={sort}
          onChange={(event) => updateFilters({ sort: event.target.value })}
          className="field-select mt-2 text-sm"
        >
          <option>Newest first</option>
          <option>Budget high to low</option>
          <option>Budget low to high</option>
        </select>
      </label>

      <label>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-stone-500">Photos</p>
        <select
          name="photos"
          value={photoFilter}
          onChange={(event) => updateFilters({ photoFilter: event.target.value as "all" | "has-photo" })}
          className="field-select mt-2 text-sm"
        >
          <option value="all">All requests</option>
          <option value="has-photo">Has photo</option>
        </select>
      </label>
    </div>
  );
}
