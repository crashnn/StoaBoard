// Command palette

import { useState as useP, useEffect as useE, useMemo as useM, useRef as useR } from 'react';
import { Icon } from './icons.jsx';

function CommandPalette({ open, onClose, onAction }) {
  const [q, setQ] = useP('');
  const [idx, setIdx] = useP(0);
  const inputRef = useR(null);

  useE(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open]);

  // ── Öneriler (kart #245) ─────────────────────────────────────────────────
  //
  // Palet boşken üç bölüm: son dokundukların, üzerindeki işler, hareketli.
  // Veri sunucudan (hareket kaydından türetiliyor, cihazlar arası aynı liste);
  // her açılışta yeniden çekiliyor. Yazmaya başlayınca öneriler çekilir,
  // normal arama devralır. Yükleme hatası sessizce boş liste DEĞİL: konsola
  // düşer, kullanıcıya komut listesi yine gelir — öneri ek, komutlar asıl.
  const [oneriler, setOneriler] = useP(null);
  useE(() => {
    if (!open) return undefined;
    let iptal = false;
    setOneriler(null);
    window.API?.oneriler?.()
      .then((o) => { if (!iptal) setOneriler(o); })
      .catch((e) => { console.warn('[palette] suggestions failed:', e?.message); });
    return () => { iptal = true; };
  }, [open]);

  const flat = useM(() => {
    // ── "#193" — kart numarasıyla arama ───────────────────────────────────
    //
    // Kullanıcı isteği (17 Eylül 2026): kart numaraları artık arayüzde
    // görünebiliyor (Ayarlar → Görünüm → Geliştirici) ama arama onları
    // bulamıyordu; numarayı bilip kartı gözle aramak gerekiyordu.
    //
    // ID kipinde YALNIZCA kart sonucu dönüyor, komut ve not göstermiyoruz:
    // "#193" yazan biri komut aramıyor, gürültü olurdu.
    const idEslesme = /^#\s*(\d*)$/.exec(q.trim());
    if (idEslesme) {
      const ham = idEslesme[1];
      const grup = window.t?.('palette_group_tasks') || 'Görevler';

      // Yalnızca "#" yazılmışsa ne yapacağını söyle. Boş liste "sonuç yok"
      // ekranına düşerdi ve kullanıcı özelliğin çalışmadığını sanardı.
      if (!ham) {
        return [{
          label: window.t?.('palette_id_hint') || 'Kart numarası yaz: #193',
          icon: 'search',
          action: 'noop',
          group: grup,
        }];
      }

      // `__APP_TASKS__` AKTİF PROJENİN kartları (app.jsx orada tutuyor).
      // Başka projedeki kart burada yok — aşağıdaki "yine de aç" dalı tam
      // bu yüzden var.
      const gorevler = window.__APP_TASKS__ || [];
      const tam = gorevler.filter(t => String(t.id) === ham);
      // Önek eşleşmesi bilinçli: "gözle seçmesi zor" denen sorun tam olarak
      // numarayı tam hatırlamamak. "#19" yazan #190–#199'u da görüyor.
      const onek = gorevler.filter(t => String(t.id) !== ham && String(t.id).startsWith(ham));

      const sonuclar = [...tam, ...onek].slice(0, 8).map(t => ({
        label: `#${t.id} · ${t.title}`,
        icon: 'circleCheck',
        action: 'open:task:' + t.id,
        group: grup,
        sub: t.col || null,
      }));

      // Aktif projede tam eşleşme yoksa yine de açmayı teklif et. Ölü bir
      // teklif değil: `openTaskById` kartı sunucudan çekiyor ve gerekirse
      // projeyi değiştiriyor; gerçekten yoksa "Görev bulunamadı" diyor.
      // Sessizce boş liste döndürmek, var olan bir kartı bulunamaz yapardı.
      if (!tam.length) {
        sonuclar.push({
          label: `#${ham}`,
          icon: 'search',
          action: 'open:task:' + ham,
          group: grup,
          sub: window.t?.('palette_task_elsewhere') || 'Bu projede değil — açmayı dene',
        });
      }
      return sonuclar;
    }

    const all = [];
    DATA.COMMANDS.forEach(g => g.items.forEach(it => all.push({ ...it, group: g.group })));
    let base = all;
    // Boş sorguda öneriler komutların ÖNÜNDE: kullanıcı paleti çoğu zaman bir
    // karta gitmek için açıyor. Bölüm boşsa başlığı da yok — boş başlık
    // "özellik bozuk" izlenimi verir.
    if (!q && oneriler) {
      const bolum = (anahtar, yedek, liste) => (liste || []).map(t => ({
        label: t.title,
        icon: 'circleCheck',
        action: 'open:task:' + t.id,
        group: window.t?.(anahtar) || yedek,
        sub: t.col_title || t.col || null,
      }));
      base = [
        ...bolum('palette_group_recent', 'Son dokundukların', oneriler.dokunulan),
        ...bolum('palette_group_mine', 'Üzerindeki işler', oneriler.atanmis),
        ...bolum('palette_group_active', 'Hareketli', oneriler.hareketli),
        ...all,
      ];
    }
    if (q) {
      const ql = q.toLowerCase();
      base = all.filter(it => it.label.toLowerCase().includes(ql));
    }

    // ── Başlıkla görev arama ──────────────────────────────────────────────
    //
    // KUSUR (17 Eylül 2026, `#id` işi sırasında görüldü): yer tutucu metni
    // "Komut, GÖREV veya sayfa ara..." diyordu ama palet görevleri hiç
    // aramıyordu — yalnızca komutlar ve notlar. Vaat edilen, yapılmıyordu.
    // Sessiz bir kusur: arama çalışıyor görünüyor, yalnızca sonuç vermiyor.
    if (q && (window.__APP_TASKS__ || []).length) {
      const ql = q.toLowerCase();
      const gorevHits = (window.__APP_TASKS__ || [])
        .filter(t => (t.title || '').toLowerCase().includes(ql))
        .slice(0, 6)
        .map(t => ({
          label: t.title,
          icon: 'circleCheck',
          action: 'open:task:' + t.id,
          group: window.t?.('palette_group_tasks') || 'Görevler',
          sub: t.col || null,
        }));
      base = [...base, ...gorevHits];
    }

    if (q && (DATA.NOTES || []).length) {
      const ql = q.toLowerCase();
      const noteHits = (DATA.NOTES || [])
        .filter(n => !n.archived)
        .filter(n => (n.title || '').toLowerCase().includes(ql) || (n.preview || '').toLowerCase().includes(ql))
        .slice(0, 6)
        .map(n => ({
          label: n.title || (window.t?.('notes_untitled')||'Başlıksız Not'),
          icon: 'note',
          action: 'open:note:' + n.id,
          group: window.t?.('notes_title')||'Notlar',
          sub: n.preview ? n.preview.slice(0, 60) : null,
        }));
      base = [...base, ...noteHits];
    }
    return base;
  }, [q, oneriler]);

  const grouped = useM(() => {
    const m = {};
    flat.forEach(it => { (m[it.group] = m[it.group] || []).push(it); });
    return m;
  }, [flat]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((idx + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((idx - 1 + flat.length) % flat.length); }
    else if (e.key === 'Enter' && flat[idx]) { e.preventDefault(); onAction(flat[idx].action); onClose(); }
    else if (e.key === 'Escape') onClose();
  };

  let counter = 0;
  return (
    <div className="palette-overlay" data-open={open} onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            placeholder={window.t?.('palette_ph') || 'Komut, görev veya sayfa ara...'}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onKey}
          />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '2px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--ink-muted)' }}>Esc</kbd>
        </div>
        <div className="palette-list">
          {Object.keys(grouped).length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13 }}>
              {window.t?.('palette_no_result')||'Sonuç yok. Başka bir ifade dene.'}
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="palette-group-title">{group}</div>
              {items.map(it => {
                const myIdx = counter++;
                return (
                  <div
                    key={`${it.group}-${it.label}-${myIdx}`}
                    className="palette-item"
                    data-active={myIdx === idx}
                    onMouseEnter={() => setIdx(myIdx)}
                    onClick={() => { onAction(it.action); onClose(); }}
                  >
                    <Icon name={it.icon} size={14} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
                      {it.sub && <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span>}
                    </span>
                    {it.shortcut && <kbd>{it.shortcut}</kbd>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="palette-hint">
          <span><kbd>↑</kbd><kbd>↓</kbd> {window.t?.('palette_navigate') || 'gez'}</span>
          <span><kbd>↵</kbd> {window.t?.('palette_select') || 'seç'}</span>
          <span><kbd>esc</kbd> {window.t?.('palette_close') || 'kapat'}</span>
        </div>
      </div>
    </div>
  );
}

export { CommandPalette };
