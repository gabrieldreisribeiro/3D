const LOGO_SIZE_STORAGE_KEY = 'store_logo_size';
const DEFAULT_LOGO_SIZE = 'md';

export const LOGO_SIZE_OPTIONS = [
  { value: 'sm', label: 'Pequena' },
  { value: 'md', label: 'Media' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Extra grande' },
];

const SIZE_CONFIG = {
  sm: {
    headerHeight: 44,
    headerMaxWidth: 210,
    headerBarHeight: 76,
    adminHeight: 44,
    adminMaxWidth: 210,
    previewHeight: 56,
    previewMaxWidth: 300,
    pdfMaxWidth: 180,
    pdfMaxHeight: 50,
  },
  md: {
    headerHeight: 56,
    headerMaxWidth: 280,
    headerBarHeight: 88,
    adminHeight: 56,
    adminMaxWidth: 280,
    previewHeight: 84,
    previewMaxWidth: 360,
    pdfMaxWidth: 220,
    pdfMaxHeight: 62,
  },
  lg: {
    headerHeight: 68,
    headerMaxWidth: 340,
    headerBarHeight: 98,
    adminHeight: 68,
    adminMaxWidth: 340,
    previewHeight: 100,
    previewMaxWidth: 420,
    pdfMaxWidth: 260,
    pdfMaxHeight: 74,
  },
  xl: {
    headerHeight: 80,
    headerMaxWidth: 420,
    headerBarHeight: 110,
    adminHeight: 80,
    adminMaxWidth: 420,
    previewHeight: 116,
    previewMaxWidth: 500,
    pdfMaxWidth: 300,
    pdfMaxHeight: 86,
  },
};

function isValidSize(value) {
  return LOGO_SIZE_OPTIONS.some((item) => item.value === value);
}

export function getLogoSizeKey() {
  if (typeof window === 'undefined') return DEFAULT_LOGO_SIZE;
  const saved = window.localStorage.getItem(LOGO_SIZE_STORAGE_KEY);
  return isValidSize(saved) ? saved : DEFAULT_LOGO_SIZE;
}

export function setLogoSizeKey(sizeKey) {
  if (!isValidSize(sizeKey)) return;
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOGO_SIZE_STORAGE_KEY, sizeKey);
  window.dispatchEvent(new CustomEvent('logo-size-change', { detail: sizeKey }));
}

export function getLogoSizeConfig(sizeKey = getLogoSizeKey()) {
  return SIZE_CONFIG[sizeKey] || SIZE_CONFIG[DEFAULT_LOGO_SIZE];
}
