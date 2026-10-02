// Çöp Kutusu — soft-deleted tasks + notes, 30 gün içinde silinir veya geri alınabilir

import { useState as useTrashState } from 'react';
import { Icon } from '../icons.jsx';
import { kolonAdi } from '../data.jsx';
import { topluCalistir, topluSonucMetni, secimiDegistir, hepsiniSec } from '../topluIslem.js';
import { copAnahtari, copAyristir, copSuzgeci, secilebilirAnahtarlar } from '../copToplu.js';

const DAYS_RETENTION = 30;

function daysLeft(deletedAt) {
  if (!deletedAt) return DAYS_RETENTION;
  const exp = new Date(new Date(deletedAt).getTime() + DAYS_RETENTION * 86400000);
  return Math.max(0, Math.ceil((exp - Date.now()) / 86400000));
}

function TrashActions({ itemKey, confirmId, setConfirmId, busy, onRestore, onPermDelete, canDelete = true }) {
  return (
    <div className="trash-item-actions">
      <button
        className="trash-restore-btn"
        onClick={() => onRestore()}
        disabled={busy.has(`r-${itemKey}`)}
        title={window.t?.('trash_restore') || 'Geri Al'}
      >
        <Icon name="undo" size={13} />
        {window.t?.('trash_restore') || 'Geri Al'}
      </button>
      {canDelete && (
        confirmId === itemKey ? (
          <div className="trash-confirm">
            <span>{window.t?.('trash_confirm') || 'Kalıcı silinsin mi?'}</span>
            <button className="trash-confirm-yes" onClick={() => onPermDelete()} disabled={busy.has(`d-${itemKey}`)}>
              {window.t?.('trash_confirm_yes') || 'Evet, sil'}
            </button>
            <button className="trash-confirm-no" onClick={() => setConfirmId(null)}>
              {window.t?.('trash_confirm_no') || 'İptal'}
            </button>
          </div>
        ) : (
          <button className="trash-delete-btn" onClick={() => setConfirmId(itemKey)} title={window.t?.('trash_permanent_delete') || 'Kalıcı Sil'}>
            <Icon name="trash" size={13} />
          </button>
        )
      )}
    </div>
  );
}

export function TrashView({ tasks, onRestore, onPermanentDelete, canManageTasks, notes = [], onRestoreNote, onPermanentDeleteNote, onEmptyTrash }) {
  const [confirmId, setConfirmId] = useTrashState(null);
  const [busy, setBusy] = useTrashState(new Set());
  const [search, setSearch] = useTrashState('');
  const [emptyConfirm, setEmptyConfirm] = useTrashState(false);
  const [emptyBusy, setEmptyBusy] = useTrashState(false);
  const [secili, setSecili] = useTrashState(new Set());
  const [topluMesgul, setTopluMesgul] = useTrashState(false);
  const [topluSilOnay, setTopluSilOnay] = useTrashState(false);

  const q = search.trim();
  // Süzgeç KOLON ADINI da tarıyor: ad satırda yazıyor, aranmaması
  // kullanıcıya "ekranda gördüğüm kelime çalışmıyor" diyordu.
  const { gorevler: filteredTasks, notlar: filteredNotes } = copSuzgeci(
    { gorevler: tasks, notlar: notes },
    q,
    (t) => [kolonAdi(DATA.COLUMNS?.find(c => c.id === t.col) || {})],
  );

  // Seçim yalnızca GÖRÜNEN ve işlem yapılabilen satırları kapsıyor.
  const secilebilir = secilebilirAnahtarlar(
    { gorevler: filteredTasks, notlar: filteredNotes },
    { gorevYetkisi: canManageTasks },
  );
  const seciliGorunen = secilebilir.filter(k => secili.has(k));
  const hepsiSecili = secilebilir.length > 0 && seciliGorunen.length === secilebilir.length;

  // `topluSonucMetni` "kart" diyor; çöpte not da var ve "3 kart geri alındı"
  // mesajı iki notu kart sayardı. Çeviri işlevi zaten dışarıdan geliyor —
  // modülün saf kalması için konan o seam tam buna yarıyor.
  const COP_METIN = {
    bulk_done: ['trash_bulk_done', '{n} öğe işlendi'],
    bulk_all_failed: ['trash_bulk_all_failed', 'Hiçbir öğe işlenemedi'],
    bulk_partial: ['trash_bulk_partial', '{n} öğe işlendi, {m} tanesi başarısız'],
  };
  const copCeviri = (k, fb) => {
    const e = COP_METIN[k];
    return e ? (window.t?.(e[0]) || e[1]) : (window.t?.(k) || fb);
  };

  const topluBitir = (sonuc) => {
    const mesaj = topluSonucMetni(sonuc, copCeviri);
    if (mesaj) window.showToast?.(mesaj, sonuc.basarisiz.length ? 'error' : 'info');
    setSecili(new Set());
    setTopluMesgul(false);
    setTopluSilOnay(false);
  };

  // Geri alma ve kalıcı silme AYNI iskeleti kullanıyor; fark yalnızca hangi
  // ucun çağrıldığı. İki ayrı kopya yazmak, birinde `seciliGorunen`
  // süzgecini atlamanın yolunu açardı.
  //
  // `seciliGorunen` üzerinden yürüyor, `secili` üzerinden değil: arama
  // daraldıktan sonra kümede kalan, ekranda olmayan satır işlem görmüyor.
  const topluIsle = async (tur) => {
    if (topluMesgul || seciliGorunen.length === 0) return;
    setTopluMesgul(true);
    topluBitir(await topluCalistir(seciliGorunen, (anahtar) => {
      const { tur: cins, id } = copAyristir(anahtar);
      if (tur === 'restore') return cins === 'task' ? onRestore(id) : onRestoreNote(id);
      return cins === 'task' ? onPermanentDelete(id) : onPermanentDeleteNote(id);
    }));
  };

  const handleRestore = async (id, type) => {
    const key = `r-${type}-${id}`;
    setBusy(b => new Set([...b, key]));
    try {
      if (type === 'task') await onRestore(id);
      else await onRestoreNote(id);
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(key); return n; });
    }
  };

  const handlePermDelete = async (id, type) => {
    const key = `d-${type}-${id}`;
    setBusy(b => new Set([...b, key]));
    try {
      if (type === 'task') await onPermanentDelete(id);
      else await onPermanentDeleteNote(id);
      setConfirmId(null);
    } finally {
      setBusy(b => { const n = new Set(b); n.delete(key); return n; });
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyBusy(true);
    try {
      await onEmptyTrash?.();
      setEmptyConfirm(false);
    } finally {
      setEmptyBusy(false);
    }
  };

  const isEmpty = tasks.length === 0 && notes.length === 0;
  const hasItems = tasks.length > 0 || notes.length > 0;

  return (
    <div className="trash-view">
      <div className="trash-header">
        <div className="trash-header-top">
          <div>
            <div className="trash-title">
              <Icon name="trash" size={20} strokeWidth={1.5} />
              {window.t?.('trash_title') || 'Çöp Kutusu'}
            </div>
            <div className="trash-subtitle">
              {window.t?.('trash_subtitle') || `Silinen öğeler ${DAYS_RETENTION} gün içinde kalıcı olarak silinir`}
            </div>
          </div>
          {hasItems && canManageTasks && (
            emptyConfirm ? (
              <div className="trash-empty-confirm">
                <span>{window.t?.('trash_empty_all_confirm') || 'Tüm öğeler kalıcı olarak silinsin mi?'}</span>
                <button className="trash-confirm-yes" onClick={handleEmptyTrash} disabled={emptyBusy}>
                  {emptyBusy ? (window.t?.('trash_emptying') || 'Boşaltılıyor...') : (window.t?.('trash_empty_all_yes') || 'Evet, tümünü sil')}
                </button>
                <button className="trash-confirm-no" onClick={() => setEmptyConfirm(false)}>
                  {window.t?.('trash_empty_all_cancel') || 'İptal'}
                </button>
              </div>
            ) : (
              <button className="trash-empty-btn" onClick={() => setEmptyConfirm(true)}>
                <Icon name="trash" size={13} />
                {window.t?.('trash_empty_all') || 'Tümünü boşalt'}
              </button>
            )
          )}
        </div>
        {hasItems && (
          <div className="trash-search-wrap">
            <Icon name="search" size={13} />
            <input
              className="trash-search"
              placeholder={window.t?.('trash_search_placeholder') || 'Çöp kutusunda ara...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="trash-search-clear" onClick={() => setSearch('')} title={window.t?.('ui_clear') || 'Temizle'}>
                <Icon name="x" size={11} />
              </button>
            )}
          </div>
        )}

        {/* TOPLU IŞLEM — yalnizca secim varken. Bos ekranda duran bir cubuk,
            hic kullanilmayan bir ozellik icin herkesin odedigi yer olurdu
            (toplu islem cubugundaki ayni karar). */}
        {seciliGorunen.length > 0 && (
          <div className="toplu-cubuk trash-toplu">
            <span className="toplu-sayi">
              {(window.t?.('trash_bulk_selected') || '{n} öğe seçili').replace('{n}', seciliGorunen.length)}
            </span>
            <span className="toplu-ayirac" />
            <button type="button" className="toplu-dugme" disabled={topluMesgul}
              onClick={() => topluIsle('restore')}>
              <Icon name="undo" size={12} /> {window.t?.('trash_bulk_restore') || 'Seçilenleri geri al'}
            </button>
            {/* KALICI SILME IKI ADIMLI — tek tikla geri alinamayan islem yok.
                Satir basina onay da boyle, "Tumunu bosalt" da. */}
            {topluSilOnay ? (
              <>
                <span className="toplu-etiket">{window.t?.('trash_confirm') || 'Kalıcı silinsin mi?'}</span>
                <button type="button" className="toplu-dugme toplu-tehlike" disabled={topluMesgul}
                  onClick={() => topluIsle('delete')}>
                  {window.t?.('trash_confirm_yes') || 'Evet, sil'}
                </button>
                <button type="button" className="toplu-dugme" disabled={topluMesgul}
                  onClick={() => setTopluSilOnay(false)}>
                  {window.t?.('trash_confirm_no') || 'İptal'}
                </button>
              </>
            ) : (
              <button type="button" className="toplu-dugme toplu-tehlike" disabled={topluMesgul}
                onClick={() => setTopluSilOnay(true)}>
                <Icon name="trash" size={12} /> {window.t?.('trash_bulk_delete') || 'Seçilenleri kalıcı sil'}
              </button>
            )}
            <span className="toplu-ayirac" />
            <button type="button" className="toplu-dugme" disabled={topluMesgul}
              onClick={() => setSecili(new Set())}>
              {window.t?.('bulk_clear') || 'Seçimi bırak'}
            </button>
          </div>
        )}

        {secilebilir.length > 0 && (
          <label className="trash-hepsi">
            <input
              type="checkbox"
              checked={hepsiSecili}
              onChange={() => setSecili(hepsiniSec(secili, secilebilir))}
            />
            {hepsiSecili
              ? (window.t?.('trash_select_none') || 'Seçimi kaldır')
              : (window.t?.('trash_select_all') || 'Hepsini seç')}
            <span className="trash-section-count">{secilebilir.length}</span>
          </label>
        )}
      </div>

      {isEmpty ? (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <Icon name="trash" size={32} strokeWidth={1.1} />
          <div>{window.t?.('trash_empty') || 'Çöp kutusu boş'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            {window.t?.('trash_empty_sub') || 'Silinen öğeler burada görünür'}
          </div>
        </div>
      ) : (
        <div className="trash-list">

          {/* ── Görevler ── */}
          {filteredTasks.length > 0 && (
            <>
              <div className="trash-section-head">
                <Icon name="checkSquare" size={13} strokeWidth={1.8} />
                {window.t?.('trash_section_tasks') || 'Görevler'}
                <span className="trash-section-count">{filteredTasks.length}</span>
              </div>
              {filteredTasks.map(task => {
                const col = DATA.COLUMNS?.find(c => c.id === task.col);
                const days = daysLeft(task.deleted_at);
                const urgent = days <= 3;
                const itemKey = copAnahtari('task', task.id);
                return (
                  <div key={task.id} className="trash-item">
                    {/* Kutu YALNIZCA islem yapilabilen satirda. Yetkisiz
                        satirda kutu cizip sonra sessizce atlamak, "12 secili"
                        deyip "5 geri alindi" demek olurdu. */}
                    {canManageTasks && (
                      <input
                        type="checkbox"
                        className="trash-item-check"
                        aria-label={task.title}
                        checked={secili.has(itemKey)}
                        onChange={() => setSecili(secimiDegistir(secili, itemKey))}
                      />
                    )}
                    <div className="trash-item-info">
                      <div className="trash-item-title">{task.title}</div>
                      <div className="trash-item-meta">
                        {task.project_name && (
                          <span className="trash-item-project">
                            <Icon name="folder" size={11} />
                            {task.project_name}
                          </span>
                        )}
                        {col && (
                          <span className="trash-item-col">
                            <span className="col-dot" style={{ background: col.color }} />
                            {kolonAdi(col)}
                          </span>
                        )}
                        <span className="trash-item-expiry" data-urgent={urgent}>
                          <Icon name="clock" size={11} />
                          {days === 0
                            ? (window.t?.('trash_expires_today') || 'Bugün silinecek')
                            : `${days} ${window.t?.('trash_days_left') || 'gün kaldı'}`}
                        </span>
                      </div>
                    </div>
                    {canManageTasks && (
                      <TrashActions
                        itemKey={itemKey}
                        confirmId={confirmId}
                        setConfirmId={setConfirmId}
                        busy={busy}
                        onRestore={() => handleRestore(task.id, 'task')}
                        onPermDelete={() => handlePermDelete(task.id, 'task')}
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* ── Notlar ── */}
          {filteredNotes.length > 0 && (
            <>
              <div className="trash-section-head" style={{ marginTop: filteredTasks.length > 0 ? 20 : 0 }}>
                <Icon name="note" size={13} strokeWidth={1.8} />
                {window.t?.('trash_section_notes') || 'Notlar'}
                <span className="trash-section-count">{filteredNotes.length}</span>
              </div>
              {filteredNotes.map(note => {
                const days = daysLeft(note.deleted_at);
                const urgent = days <= 3;
                const itemKey = copAnahtari('note', note.id);
                return (
                  <div key={note.id} className="trash-item">
                    <input
                      type="checkbox"
                      className="trash-item-check"
                      aria-label={note.title || (window.t?.('notes_untitled') || 'Başlıksız Not')}
                      checked={secili.has(itemKey)}
                      onChange={() => setSecili(secimiDegistir(secili, itemKey))}
                    />
                    <div className="trash-item-info">
                      <div className="trash-item-title">{note.title || (window.t?.('notes_untitled') || 'Başlıksız Not')}</div>
                      <div className="trash-item-meta">
                        {note.preview && (
                          <span style={{ fontSize: 11, color: 'var(--ink-muted)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.preview}
                          </span>
                        )}
                        <span className="trash-item-expiry" data-urgent={urgent}>
                          <Icon name="clock" size={11} />
                          {days === 0
                            ? (window.t?.('trash_expires_today') || 'Bugün silinecek')
                            : `${days} ${window.t?.('trash_days_left') || 'gün kaldı'}`}
                        </span>
                      </div>
                    </div>
                    <TrashActions
                      itemKey={itemKey}
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                      busy={busy}
                      onRestore={() => handleRestore(note.id, 'note')}
                      onPermDelete={() => handlePermDelete(note.id, 'note')}
                    />
                  </div>
                );
              })}
            </>
          )}

          {q && filteredTasks.length === 0 && filteredNotes.length === 0 && (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <Icon name="search" size={24} strokeWidth={1.1} />
              <div style={{ fontSize: 14 }}>"{search}" {window.t?.('trash_no_results') || 'için sonuç bulunamadı'}</div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
