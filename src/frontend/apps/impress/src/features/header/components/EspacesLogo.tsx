/** The logo of the product: two rounded squares, one in front of the other. */
export const EspacesLogo = ({ size = 32 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="208 72 220 216"
    width={size}
    height={size}
    aria-hidden="true"
    data-testid="espaces-logo"
    style={{ flexShrink: 0, marginRight: 6 }}
  >
    <rect x="244" y="104" width="184" height="184" rx="40" fill="#B94A4E" />
    <rect x="208" y="72" width="184" height="184" rx="40" fill="#2F43BE" />
    <rect x="248" y="112" width="104" height="104" rx="24" fill="#fff" />
  </svg>
);
