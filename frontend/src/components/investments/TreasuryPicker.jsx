import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { marketAPI } from '../../services/api.js';

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatRate(rate) {
  return rate == null ? '—' : `${Number(rate).toFixed(2).replace('.', ',')}%`;
}

function formatMaturity(iso) {
  if (!iso) return '';
  return iso.split('-').reverse().join('/');
}

/** Remove acento e caixa, para "ipca 2050" achar "Tesouro IPCA+ 2050". */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Seleção de título do Tesouro Direto a partir do catálogo oficial.
 *
 * Antes o título era deduzido de indexador + vencimento, mas isso não identifica um
 * papel: oito vencimentos têm duas versões, com e sem juros semestrais, e a dedução
 * pegava a primeira que encontrasse. Escolher da lista resolve — e ainda traz o PU e
 * a taxa do dia junto.
 */
export default function TreasuryPicker({ value, onSelect, disabled }) {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const container = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    marketAPI
      .getTreasuryTitles()
      .then((data) => {
        if (!cancelled) setTitles(data.titles || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (container.current && !container.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selected = useMemo(
    () => titles.find((t) => t.ticker === value) || null,
    [titles, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return titles;
    const terms = q.split(/\s+/);
    return titles.filter((t) => {
      const haystack = normalize(`${t.name} ${t.indexer} ${t.maturityDate} ${t.couponType}`);
      return terms.every((term) => haystack.includes(term));
    });
  }, [titles, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  function choose(title) {
    onSelect(title);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (filtered[highlighted]) choose(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  useEffect(() => {
    const el = listRef.current?.children?.[highlighted];
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-[11px] text-amber-900 dark:text-amber-200">
        Não foi possível carregar a lista de títulos ({error}). Verifique a conexão e reabra o formulário.
      </div>
    );
  }

  return (
    <div ref={container} className="relative">
      <label className="label" htmlFor="treasury-search">
        Título <span className="text-red-400">*</span>
      </label>

      {selected && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="input flex w-full items-center justify-between gap-2 text-left disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium text-gray-900 dark:text-white">{selected.name}</span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
              Vence {formatMaturity(selected.maturityDate)} · compra a {formatRate(selected.buyRate)} ·{' '}
              PU {formatBRL(selected.buyPrice)}
            </span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-gray-400" aria-hidden />
        </button>
      ) : (
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            id="treasury-search"
            type="text"
            className="input pl-9"
            autoComplete="off"
            disabled={disabled || loading}
            placeholder={loading ? 'Carregando títulos…' : 'Digite: ipca 2050, selic, prefixado…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded={open}
            aria-controls="treasury-options"
          />
          {selected && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Cancelar troca de título"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {open && !loading && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
              Nenhum título encontrado para “{query}”.
            </p>
          ) : (
            <ul id="treasury-options" ref={listRef} role="listbox" className="max-h-64 overflow-y-auto">
              {filtered.map((t, i) => {
                const isSelected = t.ticker === value;
                return (
                  <li key={t.ticker} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => choose(t)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                        i === highlighted ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {t.name}
                          </span>
                          {t.couponType === 'semestral' && (
                            <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                              cupom
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
                          Vence {formatMaturity(t.maturityDate)} · {formatRate(t.buyRate)} ·{' '}
                          PU {formatBRL(t.buyPrice)}
                        </span>
                      </span>
                      {isSelected && (
                        <Check size={15} className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-gray-100 dark:border-gray-700 px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            {filtered.length} de {titles.length} títulos · fonte Tesouro Transparente
          </p>
        </div>
      )}

      {!selected && !open && (
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Vencimentos como 2050 têm duas versões — com e sem juros semestrais. Escolha a sua.
        </p>
      )}
    </div>
  );
}
