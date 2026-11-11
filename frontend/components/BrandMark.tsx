/** RepairCall mark: a wrench across a guide page. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="RepairCall">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#1E2226" /><rect x="5.5" y="5.5" width="13" height="17.5" rx="1.5" fill="#FFFCF6" /><path d="M8 10h8M8 13.5h8M8 17h5" stroke="#1E2226" strokeWidth="1.5" strokeLinecap="round" /><path d="M14.5 27.5L22.4 19.6" stroke="#E8590C" strokeWidth="3.2" strokeLinecap="round" /><circle cx="23.5" cy="18.5" r="4.2" fill="#E8590C" /><path d="M23.8 18.2L27.4 14.6" stroke="#1E2226" strokeWidth="3.1" strokeLinecap="round" />
    </svg>
  );
}
