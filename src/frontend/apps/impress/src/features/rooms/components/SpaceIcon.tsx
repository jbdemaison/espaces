/** The icon of a space: a pale blue block, with a narrow column and a wide pane. */
export const SpaceIcon = ({
  width = 40,
  height = 40,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="104 36 92 92"
    width={width}
    height={height}
    {...props}
  >
    <rect x="104" y="36" width="92" height="92" rx="18" fill="#E3E7F8" />
    <rect
      x="122"
      y="54"
      width="16"
      height="56"
      rx="6"
      fill="#C3CAF0"
      opacity="0.55"
    />
    <rect x="144" y="54" width="34" height="56" rx="8" fill="#C3CAF0" />
  </svg>
);

/** The same icon for the brand-coloured "New" button: a white block, with the two panes in the button's colour. */
export const SpaceButtonIcon = ({
  width = 24,
  height = 24,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="104 36 92 92"
    width={width}
    height={height}
    {...props}
  >
    <rect x="104" y="36" width="92" height="92" rx="18" fill="#FFFFFF" />
    <rect
      x="122"
      y="54"
      width="16"
      height="56"
      rx="6"
      fill="var(--c--globals--colors--brand-500, #5958d6)"
      opacity="0.55"
    />
    <rect
      x="144"
      y="54"
      width="34"
      height="56"
      rx="8"
      fill="var(--c--globals--colors--brand-500, #5958d6)"
    />
  </svg>
);
