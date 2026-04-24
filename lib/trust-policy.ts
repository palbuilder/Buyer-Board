export const trustPolicy = {
  warningTriggers: [
    "Trying to move payment or shipping off-platform through private messages.",
    "Repeated listing or offer reports for unsafe, illegal, or misleading content.",
    "A growing pattern of buyer disputes, wrong-item complaints, or delivery issues.",
  ],
  suspensionTriggers: [
    "Selling illegal items or attempting to facilitate firearm sales through the platform.",
    "Repeated scam signals, harassment, or refusal to stop after prior warning.",
    "High-risk trust activity that makes payouts or marketplace use unsafe to continue.",
  ],
  reinstatementGuidelines: [
    "The member explains what happened clearly and acknowledges the rule they broke.",
    "The member gives a believable correction plan, such as keeping negotiation and payment on-platform.",
    "Recent activity no longer suggests active scam, harassment, or repeat-risk behavior.",
  ],
  adminChecklist: [
    "Read the latest trust-history timeline before changing account status.",
    "Check flagged private messages, disputes, and listing reports together before suspending a member.",
    "Use warning / probation for behavior that may be fixable. Use suspension when safety or payout risk is too high.",
    "When approving an appeal, leave a note that explains why reinstatement was allowed.",
  ],
} as const;

