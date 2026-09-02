// DefaultDropdown — uygulamanın tek standart seçim bileşeni.
//
// Native <select> her yerde farklı görünüyordu (işletim sisteminin çizdiği
// liste, temaya uymuyor). Ayarlar'daki rol seçici ise özel, güzel bir
// dropdown'dı. Bu bileşen o görünümü genelleştirip tüm seçicilere taşıyor:
//   - Temaya duyarlı (yalnızca CSS token'ları: --line, --accent, --bg-raised…),
//     açık/koyu ikisinde de doğru.
//   - Tıklama-dışı ve Escape ile kapanır; ok tuşlarıyla gezilir, Enter seçer.
//   - Seçenekte renk noktası ve alt metin opsiyonel.
//
// API:
//   value       seçili değer (string)
//   onChange    (value) => void   — event değil, doğrudan değer
//   options     [{ value, label, color?, sub? }]
//   placeholder buton boşken görünen metin
//   disabled, fullWidth, align ('left'|'right'), ariaLabel

import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './icons.jsx';

export function DefaultDropdown({
  value,
  onChange,
  options = [],
  placeholder = '— Seç —',
  disabled = false,
  fullWidth = false,
  align = 'left',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // klavyeyle vurgulanan seçenek
  const ref = useRef(null);
  const listRef = useRef(null);

  const current = options.find((o) => String(o.value) === String(value));
  const selectedIdx = options.findIndex((o) => String(o.value) === String(value));

  // Açılırken vurguyu seçili öğeye getir.
  useEffect(() => {
    if (open) setActive(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tıklama-dışı kapatma.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = useCallback(
    (v) => {
      onChange?.(v);
      setOpen(false);
    },
    [onChange],
  );

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = options[active];
      if (opt) choose(opt.value);
    }
  };

  return (
    <div
      ref={ref}
      className="dd-root"
      style={{ position: 'relative', width: fullWidth ? '100%' : undefined }}
    >
      <button
        type="button"
        className="dd-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        data-open={open || undefined}
        data-placeholder={current ? undefined : true}
        style={{ width: fullWidth ? '100%' : undefined }}
      >
        <span className="dd-value">
          {current?.color && <span className="dd-dot" style={{ background: current.color }} />}
          <span className="dd-label">{current ? current.label : placeholder}</span>
        </span>
        <span className="dd-caret" data-open={open || undefined}>
          <Icon name="chevronDown" size={12} />
        </span>
      </button>

      {open && (
        <div
          ref={listRef}
          className="dd-menu"
          role="listbox"
          data-align={align}
        >
          {options.map((o, i) => {
            const isSel = String(o.value) === String(value);
            return (
              <button
                key={`${o.value}-${i}`}
                type="button"
                role="option"
                aria-selected={isSel}
                className="dd-option"
                data-selected={isSel || undefined}
                data-active={i === active || undefined}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
              >
                {o.color && <span className="dd-dot" style={{ background: o.color }} />}
                <span className="dd-option-text">
                  <span className="dd-option-label">{o.label}</span>
                  {o.sub && <span className="dd-option-sub">{o.sub}</span>}
                </span>
                {isSel && <Icon name="check" size={13} className="dd-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
