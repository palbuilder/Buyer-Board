export const vehicleYears = Array.from({ length: 47 }, (_, index) => String(1980 + index)).reverse();

export const vehicleMakes = [
  "Ford",
  "Chevrolet",
  "Toyota",
  "Honda",
  "Nissan",
  "Dodge",
  "GMC",
  "Jeep",
  "Subaru",
  "Hyundai",
  "Kia",
  "Mazda",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Lexus",
  "Other",
] as const;

export const vehicleModelsByMake: Record<string, string[]> = {
  Ford: ["F-150", "F-250", "F-350", "Ranger", "Escape", "Explorer", "Focus", "Mustang", "Expedition", "Other"],
  Chevrolet: ["Silverado", "Colorado", "Tahoe", "Suburban", "Malibu", "Impala", "Equinox", "Camaro", "Other"],
  Toyota: ["Tacoma", "Tundra", "4Runner", "RAV4", "Corolla", "Camry", "Highlander", "Prius", "Other"],
  Honda: ["Civic", "Accord", "CR-V", "Pilot", "Odyssey", "Ridgeline", "Fit", "Other"],
  Nissan: ["Altima", "Sentra", "Frontier", "Titan", "Rogue", "Pathfinder", "Maxima", "Other"],
  Dodge: ["Ram 1500", "Ram 2500", "Durango", "Charger", "Challenger", "Journey", "Other"],
  GMC: ["Sierra 1500", "Sierra 2500", "Canyon", "Yukon", "Terrain", "Acadia", "Other"],
  Jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Renegade", "Gladiator", "Other"],
  Subaru: ["Outback", "Forester", "Crosstrek", "Impreza", "Legacy", "WRX", "Other"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Accent", "Other"],
  Kia: ["Forte", "Optima", "Sorento", "Sportage", "Telluride", "Soul", "Other"],
  Mazda: ["Mazda3", "Mazda6", "CX-5", "CX-9", "MX-5 Miata", "Other"],
  Volkswagen: ["Jetta", "Passat", "Tiguan", "Atlas", "Golf", "Beetle", "Other"],
  BMW: ["3 Series", "5 Series", "X3", "X5", "X1", "Other"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "Sprinter", "Other"],
  Lexus: ["IS", "ES", "RX", "GX", "LX", "Other"],
  Other: ["Other"],
};

export function getVehicleModels(make: string) {
  return vehicleModelsByMake[make] ?? ["Other"];
}
