export function Ankh({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        fill="currentColor"
        d="M32 4c-8.3 0-14 6.6-14 14.6 0 6.3 3.8 12 8.2 16.4H12v7h17v18h6V42h17v-7H37.8C42.2 30.6 46 24.9 46 18.6 46 10.6 40.3 4 32 4zm0 7c4.2 0 7 3.4 7 7.8 0 4.6-3.2 9.3-7 13.2-3.8-3.9-7-8.6-7-13.2 0-4.4 2.8-7.8 7-7.8z"
      />
    </svg>
  );
}
