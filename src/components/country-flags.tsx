const FLAGS = {
  AR: { src: "/intl/flags/argentina.svg", alt: "" },
  BR: { src: "/intl/flags/brazil.svg", alt: "" },
  CO: { src: "/intl/flags/colombia.svg", alt: "" },
} as const;

export function CountryFlagImage({
  id,
}: {
  id: keyof typeof FLAGS;
}) {
  const flag = FLAGS[id];
  return (
    <img
      src={flag.src}
      alt=""
      width={900}
      height={600}
      draggable={false}
      className="block h-full w-full object-cover"
    />
  );
}
