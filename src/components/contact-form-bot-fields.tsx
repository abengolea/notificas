"use client";

import { useRef, type RefObject } from "react";
import {
  CONTACT_FORM_CLIENT_HEADER,
  CONTACT_FORM_CLIENT_HEADER_VALUE,
} from "@/lib/contact-form-guard";

export function useContactFormGuard() {
  const startedAtRef = useRef(Date.now());
  const websiteRef = useRef<HTMLInputElement>(null);

  function body(fields: Record<string, unknown>): string {
    return JSON.stringify({
      ...fields,
      website: websiteRef.current?.value ?? "",
      formStartedAt: startedAtRef.current,
    });
  }

  function headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      [CONTACT_FORM_CLIENT_HEADER]: CONTACT_FORM_CLIENT_HEADER_VALUE,
    };
  }

  return { websiteRef, body, headers };
}

export function ContactFormBotFields({
  id,
  inputRef,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -left-[10000px] h-px w-px overflow-hidden opacity-0"
    >
      <input
        ref={inputRef}
        id={id}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        aria-hidden="true"
      />
    </div>
  );
}
