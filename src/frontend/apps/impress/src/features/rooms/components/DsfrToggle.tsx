import styled from 'styled-components';

/**
 * The look of the DSFR toggle (`fr-toggle`, label on the left): a 40×24 track outlined
 * in blue France and filled when on, a round thumb that slides and shows a check,
 * and the state written beside it. The rules come from the DSFR stylesheet.
 */
const Root = styled.div<{ $disabled: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};

  .label {
    font-size: 1rem;
    line-height: 1.5rem;
    color: #161616;
  }

  .state {
    min-width: 4.75rem;
    font-size: 0.75rem;
    line-height: 1.25rem;
    text-align: right;
    color: #000091;
  }

  input {
    position: absolute;
    right: 0;
    width: 2.5rem;
    height: 1.5rem;
    margin: 0;
    opacity: 0;
    z-index: 1;
    cursor: inherit;
  }

  .track {
    position: relative;
    flex-shrink: 0;
    width: 2.5rem;
    height: 1.5rem;
    background-repeat: no-repeat;
    background-image: url("data:image/svg+xml;charset=utf-8,<svg width='40' stroke='%23000091' height='24' viewBox='0 0 40 24' fill='transparent' xmlns='http://www.w3.org/2000/svg'><rect x='0.5' y='0.5' width='39' height='23' rx='11.5' /></svg>");
  }

  .track::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background-color: #fff;
    background-repeat: no-repeat;
    background-size: 1rem;
    background-position: center;
    box-shadow: inset 0 0 0 1px #000091;
    transition: transform 0.15s ease;
  }

  input:checked + .track {
    background-image: url("data:image/svg+xml;charset=utf-8,<svg width='40' stroke='%23000091' height='24' viewBox='0 0 40 24' fill='%23000091' xmlns='http://www.w3.org/2000/svg'><rect x='0.5' y='0.5' width='39' height='23' rx='11.5' /></svg>");
  }

  input:checked + .track::after {
    transform: translateX(1rem);
    background-image: url("data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23000091' d='M10 15.17l9.2-9.2 1.4 1.42L10 18l-6.36-6.36 1.4-1.42z'/></svg>");
  }

  input:focus-visible + .track {
    outline: 2px solid #0a76f6;
    outline-offset: 2px;
  }
`;

interface DsfrToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** hides the label visually: it stays the accessible name */
  hideLabel?: boolean;
  /** text written beside the switch for each state, as the DSFR does */
  stateLabels?: { on: string; off: string };
  disabled?: boolean;
  title?: string;
  'data-testid'?: string;
}

/** A toggle drawn like the DSFR one, built on a native checkbox (keyboard, screen readers). */
export const DsfrToggle = ({
  checked,
  onChange,
  label,
  hideLabel = false,
  stateLabels,
  disabled = false,
  title,
  'data-testid': testId,
}: DsfrToggleProps) => (
  <Root $disabled={disabled} title={title}>
    {!hideLabel && <span className="label">{label}</span>}
    {stateLabels && (
      <span className="state" aria-hidden="true">
        {checked ? stateLabels.on : stateLabels.off}
      </span>
    )}
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={hideLabel ? label : undefined}
      data-testid={testId}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span className="track" aria-hidden="true" />
  </Root>
);
