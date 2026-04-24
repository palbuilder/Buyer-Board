const blockedListingTerms = [
  "gun",
  "firearm",
  "rifle",
  "shotgun",
  "pistol",
  "handgun",
  "ammo",
  "ammunition",
  "silencer",
  "suppressor",
  "ghost gun",
  "cocaine",
  "heroin",
  "meth",
  "fentanyl",
] as const;

const harassmentTerms = ["kill yourself", "i will kill you", "stupid idiot", "piece of trash", "go die"] as const;

function containsTerm(text: string, terms: readonly string[]) {
  const normalized = text.toLowerCase();
  return terms.find((term) => normalized.includes(term));
}

export function validateMarketplaceListing(input: {
  title: string;
  description: string;
}) {
  const combined = `${input.title}\n${input.description}`;
  const blockedTerm = containsTerm(combined, blockedListingTerms);

  if (blockedTerm) {
    return "BuyerBoard does not allow firearms or illegal items to be listed.";
  }

  const harassmentTerm = containsTerm(combined, harassmentTerms);

  if (harassmentTerm) {
    return "Harassment or threatening language is not allowed in listings.";
  }

  return null;
}

export function validateMarketplaceMessage(input: {
  message: string;
}) {
  const harassmentTerm = containsTerm(input.message, harassmentTerms);

  if (harassmentTerm) {
    return "Harassment or threatening language is not allowed in seller messages.";
  }

  return null;
}
