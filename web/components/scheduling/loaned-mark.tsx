export function LoanedMark({ homeCompanyName }: { homeCompanyName?: string | null }) {
  const label = homeCompanyName ? `Loaned from ${homeCompanyName}` : "Loaned employee";
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-bold leading-none text-white"
      title={label}
    >
      L<span className="sr-only">{label}</span>
    </span>
  );
}
