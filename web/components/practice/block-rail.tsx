import Link from 'next/link';

type Block = {
  label: string;
  detail: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

/** A compact desktop index with an explicit touch-friendly equivalent. */
export function BlockRail({
  blocks,
  current,
  label,
}: {
  blocks: Block[];
  current?: number;
  label: string;
}) {
  const item = (block: Block, index: number, compact: boolean) => {
    const content = (
      <>
        {compact && <span aria-hidden="true" className="block-rail-tick" />}
        <span className={compact ? 'block-rail-label' : ''}>
          <strong className="block font-medium">
            {block.label}
            {current === index ? ' · Actual' : ''}
          </strong>
          <span className="text-muted-foreground mt-1 block text-xs">{block.detail}</span>
        </span>
      </>
    );
    const props = {
      className: compact
        ? 'block-rail-target'
        : 'block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted',
      'aria-label': `${block.label}. ${block.detail}`,
      'aria-current': current === index ? ('step' as const) : undefined,
    };
    return block.href && !block.disabled ? (
      <Link {...props} href={block.href}>
        {content}
      </Link>
    ) : (
      <button
        {...props}
        type="button"
        aria-disabled={block.disabled || !block.onSelect}
        onClick={block.disabled ? undefined : block.onSelect}
      >
        {content}
      </button>
    );
  };
  return (
    <>
      <nav aria-label={label} className="practice-block-rail">
        <ol>
          {blocks.map((block, index) => (
            <li key={block.label}>{item(block, index, true)}</li>
          ))}
        </ol>
      </nav>
      <details className="practice-block-touch">
        <summary className="bg-card cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-sm">
          Bloques{current !== undefined ? ` · ${current + 1}` : ''}
        </summary>
        <nav
          aria-label={`${label} · táctil`}
          className="bg-card mt-2 max-h-[60vh] w-64 overflow-auto rounded-xl border p-2 shadow-lg"
        >
          {blocks.map((block, index) => (
            <div key={block.label}>{item(block, index, false)}</div>
          ))}
        </nav>
      </details>
    </>
  );
}
