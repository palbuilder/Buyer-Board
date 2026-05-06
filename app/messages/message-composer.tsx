"use client";

import { useState } from "react";

type MessageComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
  threadId: string;
  isBlocked: boolean;
  blockNotice?: string;
  requestTitle?: string;
};

const promptTemplates = [
  {
    label: "Ask condition",
    body: "Can you confirm the condition, any defects, and exactly what is included?",
  },
  {
    label: "Confirm fit",
    body: "Can you confirm this matches the request details before we move forward?",
  },
  {
    label: "Check final price",
    body: "Can you confirm the final all-in price and whether shipping is included?",
  },
  {
    label: "Claim timing",
    body: "What claim window would work for you if we agree on this offer?",
  },
];

export function MessageComposer({ action, threadId, isBlocked, blockNotice, requestTitle }: MessageComposerProps) {
  const [body, setBody] = useState("");

  function applyTemplate(template: string) {
    const next = requestTitle ? `About "${requestTitle}": ${template}` : template;
    setBody(next);
  }

  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="threadId" value={threadId} />
      <div className="subtle-panel rounded-[1rem] px-4 py-3">
        <p className="text-sm leading-7 text-[var(--ink-soft)]">
          Best use of this thread: confirm price, condition, fitment, what is included, and the claim window. Keep payment and contact details on BuyerBoard.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {promptTemplates.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => applyTemplate(template.body)}
            className="secondary-button rounded-full px-3 py-2 text-xs font-medium"
          >
            {template.label}
          </button>
        ))}
      </div>
      <label className="field-label">
        New private message
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="field-textarea min-h-28"
          placeholder="Keep the conversation about the request itself. Do not share phone numbers, emails, or off-site payment options."
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="brand-button tight-button text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBlocked || !body.trim()}
        >
          Send message
        </button>
        {isBlocked ? <p className="text-sm leading-7 text-rose-900">{blockNotice ?? "Private messaging is blocked in this thread."}</p> : null}
        {!isBlocked && body.trim() ? <p className="text-sm leading-7 text-[var(--ink-soft)]">Send only the details needed to move the deal forward.</p> : null}
      </div>
    </form>
  );
}
