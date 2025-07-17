import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 165 152"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
    >
      <g>
        <path
          d="M152.062 16.5125C152.062 16.5125 106.963 -13.6875 51.0122 10.4375L8.33722 34.6625C-11.2378 45.4125 10.6622 79.4125 10.6622 79.4125L42.2622 131.738C42.2622 131.738 80.3622 167.338 132.812 135.613L159.212 115.538C176.662 106.038 164.662 80.0375 164.662 80.0375L152.062 16.5125Z"
          className="fill-primary"
        />
        <path
          d="M0.8125 71.9375L108.637 50.8875L137.962 64.9125L94.0125 76.5375L0.8125 71.9375Z"
          className="fill-accent"
        />
        <path
          d="M109 46L119 51"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M126 55L144 63"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M132 68L144 75"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="99" cy="41" r="4" fill="white" />
        <circle cx="150" cy="67" r="4" fill="white" />
        <circle cx="150" cy="79" r="4" fill="white" />
        <path
          d="M62 82L45 88"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M57 91L34 100"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M52 101L37 109"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="72" cy="78" r="4" fill="white" />
        <circle cx="28" cy="104" r="4" fill="white" />
        <circle cx="30" cy="115" r="4" fill="white" />
      </g>
    </svg>
  );
}
