interface SiemensLogoProps {
  /** Height class e.g. "h-8". Controls the overall height. */
  heightClass?: string;
  /** Whether to show the SIEMENS wordmark next to the icon */
  showWordmark?: boolean;
}

/**
 * Siemens brand logo — teal "S" mark + optional wordmark.
 * Colours: Siemens teal #009999, navy #000028.
 */
export default function SiemensLogo({
  heightClass = "h-8",
  showWordmark = true,
}: SiemensLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${heightClass}`}>
      {/* Siemens "S" mark — geometric teal square with white S */}
      <svg
        viewBox="0 0 40 40"
        className="h-full w-auto flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Siemens logo mark"
      >
        <rect width="40" height="40" rx="6" fill="#009999" />
        {/* Stylised S path */}
        <path
          d="M26.5 13C26.5 11.067 24.933 9.5 23 9.5H14.5V16.5H23C23.828 16.5 24.5 17.172 24.5 18C24.5 18.828 23.828 19.5 23 19.5H17C15.067 19.5 13.5 21.067 13.5 23V27C13.5 28.933 15.067 30.5 17 30.5H25.5V23.5H17C16.172 23.5 15.5 22.828 15.5 22C15.5 21.172 16.172 20.5 17 20.5H23C24.933 20.5 26.5 18.933 26.5 17V13Z"
          fill="white"
        />
      </svg>

      {showWordmark && (
        <span
          className="font-bold tracking-widest uppercase select-none leading-none"
          style={{ color: "#009999", fontSize: "1.05rem", letterSpacing: "0.18em" }}
        >
          Siemens
        </span>
      )}
    </div>
  );
}
