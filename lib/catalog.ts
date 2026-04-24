export const categoryOptions = {
  "Auto Parts": ["Engine", "Body", "Electrical", "Suspension", "Interior", "Wheels & Tires", "Other"],
  Tools: ["Power Tools", "Hand Tools", "Lawn Equipment", "Shop Equipment", "Measuring", "Other"],
  Electronics: ["Phones", "Wearables", "Computers", "Audio", "Gaming", "Other"],
  Collectibles: ["Sports Cards", "Toys", "Coins", "Memorabilia", "Comics", "Other"],
  Appliances: ["Kitchen", "Laundry", "HVAC", "Small Appliance", "Parts", "Other"],
  "Outdoor Gear": ["Hunting Accessories & Equipment", "Camping", "Fishing", "Optics", "Cycling", "Other"],
} as const;

export const categoryList = Object.keys(categoryOptions) as Array<keyof typeof categoryOptions>;

export function getSubcategoryOptions(category: string) {
  return categoryOptions[category as keyof typeof categoryOptions] ?? ["Other"];
}
