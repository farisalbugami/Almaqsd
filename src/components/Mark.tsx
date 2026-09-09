/** علامة مستوحاة من النقشة الهندسية في هوية المقصد */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="mark">
      <g fill="currentColor">
        <rect x="0" y="0" width="6" height="6" />
        <rect x="14" y="0" width="6" height="6" />
        <rect x="0" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
        <rect x="8" y="8" width="4" height="4" />
      </g>
    </svg>
  );
}
