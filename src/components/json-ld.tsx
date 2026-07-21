type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Inyecta JSON-LD válido para Google y otros buscadores. */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
