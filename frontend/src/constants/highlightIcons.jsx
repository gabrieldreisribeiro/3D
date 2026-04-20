export const HIGHLIGHT_ICON_OPTIONS = [
  'truck',
  'shield',
  'star',
  'package',
  'gift',
  'clock',
  'sparkles',
  'badge-check',
  'shopping-bag',
  'box',
];

export function renderHighlightIcon(iconName = 'badge-check', className = 'h-4 w-4') {
  const baseProps = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  const name = String(iconName || '').trim().toLowerCase();
  if (name === 'truck') {
    return (
      <svg {...baseProps}>
        <path d="M10 17h4" />
        <path d="M1 3h12v10H1z" />
        <path d="M13 8h5l3 3v2h-8z" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg {...baseProps}>
        <path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (name === 'star') {
    return (
      <svg {...baseProps}>
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
      </svg>
    );
  }
  if (name === 'package') {
    return (
      <svg {...baseProps}>
        <path d="M12 3 3 8l9 5 9-5-9-5z" />
        <path d="M3 16l9 5 9-5" />
        <path d="M3 12l9 5 9-5" />
      </svg>
    );
  }
  if (name === 'gift') {
    return (
      <svg {...baseProps}>
        <path d="M20 12v8H4v-8" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 22V7" />
        <path d="M12 7h-2.5a2.5 2.5 0 1 1 0-5c2 0 2.5 2 2.5 5z" />
        <path d="M12 7h2.5a2.5 2.5 0 1 0 0-5c-2 0-2.5 2-2.5 5z" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    );
  }
  if (name === 'sparkles') {
    return (
      <svg {...baseProps}>
        <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4z" />
        <path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8z" />
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
      </svg>
    );
  }
  if (name === 'shopping-bag') {
    return (
      <svg {...baseProps}>
        <path d="M6 8h12l-1 12H7L6 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  if (name === 'box') {
    return (
      <svg {...baseProps}>
        <path d="M12 3 3 8l9 5 9-5-9-5z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </svg>
    );
  }
  return (
    <svg {...baseProps}>
      <path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
