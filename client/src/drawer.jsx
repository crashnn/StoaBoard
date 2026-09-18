// Task detail drawer — API-backed

import React, { useState as useDrawerState, useEffect as useDrawerEffect, useRef as useDrawerRef } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from './icons.jsx';
import { Avatar, AvatarStack } from './shell.jsx';
import { API, fmtTimeAgo } from './data.jsx';
import { DatePicker } from './modals.jsx';
import { WorkLogSection } from './worklog.jsx';
import { paragraflaraBol } from './belge.js';

// `tweaks` BİLEREK prop, global değil. Çekmece başka globalleri (DATA.COLUMNS,
// window.t) okuyor ama `window.__TWEAKS__` bunlardan farklı: o sunucunun
// gömdüğü BAŞLANGIÇ tohumu, canlı durum değil. Oradan okunsaydı anahtar
// açıldığında çekmece yeniden yükleme yapılana kadar eski değeri gösterirdi —
// ekran bir şey, ayar başka bir şey derdi. Prop, iki tarafı aynı kaynağa bağlıyor.
function TaskDrawer({ open, task, onClose, onMoveTask, onTaskUpdate, onDelete, onCreateTask, canManageTasks = true, pageMode = false, onOpenPage, tweaks = {} }) {
  const [detail, setDetail]             = useDrawerState(null);
  const [newComment, setNewComment]     = useDrawerState('');
  const [submitting, setSubmitting]     = useDrawerState(false);
  const [loadingDetail, setLoadingDetail] = useDrawerState(false);
  const [linkedNotes, setLinkedNotes]   = useDrawerState([]);
  const [loadingLinkedNotes, setLoadingLinkedNotes] = useDrawerState(false);
  const [statusOpen, setStatusOpen]     = useDrawerState(false);
  const [priorityOpen, setPriorityOpen] = useDrawerState(false);
  const [labelOpen, setLabelOpen]       = useDrawerState(false);
  const [assigneeOpen, setAssigneeOpen] = useDrawerState(false);
  const [confirmDelete, setConfirmDelete] = useDrawerState(false);
  const [mentionQuery, setMentionQuery] = useDrawerState(null);
  const [mentionIdx, setMentionIdx]     = useDrawerState(0);
  const [duplicating, setDuplicating]   = useDrawerState(false);

  // ── Sürükle-kapat (yalnızca dokunmatik) ────────────────────────────────
  //
  // İSTEK (17 Eylül 2026, kullanıcı): "kart açık iken kartı yukarıdan aşağı
  // çekince kartı küçültsün panoya atsın, sanırsam sadece mobilde işe yarar."
  //
  // NİÇİN GEREKLİ: mobilde kart tam ekran açılıyor ve kapatmanın tek yolu sağ
  // üstteki X — başparmağın en zor ulaştığı köşe. Telefon büyüdükçe daha da
  // zor. Bu yüzden süs değil erişilebilirlik işi.
  //
  // KAPSAM DARALTILDI, bilinçli: jest BAŞLIK + TUTAMAK bölgesinden kuruluyor,
  // kart gövdesinden değil. Gövdeden sürüklemeye izin vermek `scrollTop`
  // izlemeyi gerektiriyor ve uzun kartlarda OKUMA ile jest sürekli çakışıyor:
  // kullanıcı yukarı kaydırmak isterken kart kapanmaya başlıyor. Kullanıcının
  // kendi ifadesi de "YUKARIDAN aşağı çekince" idi. Dar kural hem güvenli
  // hem tarife sadık; genişletmek gerekirse sonradan yapılabilir, tersi
  // (kullanıcıyı kartı okuyamaz hâle getirmek) geri alınması zor bir hata.
  //
  // X BUTONU KALIYOR. Jest onun yerine geçmiyor, yanına ekleniyor: görünmez
  // bir jest, olmayan bir jesttir ve klavyeyle gezen kullanıcının da bir yolu
  // olmalı.
  const panelRef = useDrawerRef(null);
  const jestRef = useDrawerRef(null);

  const dokunmatikMi = () => (
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)')?.matches
  );

  const jestBasla = (e) => {
    // Ölçüt `pointer: coarse`, ekran GENİŞLİĞİ değil — #233'te aynı karar
    // verildi: aranan şey "dokunmatik mi", "pencere dar mı" değil. Dar bir
    // masaüstü penceresinde fare ile aşağı sürüklemek kapatma jesti değildir.
    if (!dokunmatikMi() || e.touches?.length !== 1) return;
    jestRef.current = { y0: e.touches[0].clientY, t0: Date.now(), y: 0 };
  };

  const jestSurukle = (e) => {
    const j = jestRef.current;
    const el = panelRef.current;
    if (!j || !el || e.touches?.length !== 1) return;
    // Yalnızca AŞAĞI. Yukarı sürükleme paneli tavana yapıştırmıyor; 0'da
    // duruyor ki kullanıcı yanlışlıkla yukarı çekince bir şey "bozulmasın".
    j.y = Math.max(0, e.touches[0].clientY - j.y0);
    // Doğrudan DOM: sürükleme kare başına durum güncellemesi demek ve uzun bir
    // kartın yeniden çizimi 60 kez/sn takılmaya yol açardı.
    el.style.transition = 'none';
    el.style.transform = `translateY(${j.y}px)`;
  };

  const jestBitir = () => {
    const j = jestRef.current;
    const el = panelRef.current;
    jestRef.current = null;
    if (!el) return;
    // Satır içi stiller temizleniyor ki CSS geri alsın: açıkken
    // `translateX(0)`, kapanırken geçiş animasyonu.
    el.style.transition = '';
    el.style.transform = '';
    if (!j) return;

    // İKİ EŞİK, çünkü iki farklı hareket de "kapat" demek: yavaş ama uzun
    // sürükleme ve kısa ama hızlı fiske. Tek eşik ikisinden birini yanlış
    // yorumlar.
    const yukseklik = window.innerHeight || 800;
    const sure = Math.max(1, Date.now() - j.t0);
    const uzun = j.y > yukseklik * 0.25;
    const fiske = j.y / sure > 0.6 && j.y > 60;
    if (uzun || fiske) onClose();
    // Eşiğin altındaysa hiçbir şey yapılmıyor: stil temizlendiği için panel
    // CSS geçişiyle yerine yaylanıyor.
  };

  const jestOzellikleri = {
    onTouchStart: jestBasla,
    onTouchMove: jestSurukle,
    onTouchEnd: jestBitir,
    onTouchCancel: jestBitir,
  };

  // ── Checklist (alt görevler) ───────────────────────────────────────────
  const [checkInput, setCheckInput]     = useDrawerState('');
  const [checkSaving, setCheckSaving]   = useDrawerState(false);
  const [editingCheckId, setEditingCheckId] = useDrawerState(null);
  const [editingCheckText, setEditingCheckText] = useDrawerState('');

  // ── Attachments ───────────────────────────────────────────────────────────
  const [attachments, setAttachments]   = useDrawerState([]);
  const [uploading, setUploading]       = useDrawerState(false);
  const [uploadProgress, setUploadProgress] = useDrawerState(0);
  const [imagePreview, setImagePreview] = useDrawerState(null); // { url, name }
  const [editingAttId, setEditingAttId] = useDrawerState(null);
  const [editingAttName, setEditingAttName] = useDrawerState('');
  const fileInputRef                    = useDrawerRef(null);

  // ── Doc state for inline editing ─────────────────────────────────────────
  const [docState, setDocState] = useDrawerState(null);
  // Blok düzenleyicinin kancaları BURADA, bileşenin erken dönüşünden
  // (`if (!task) return null`) önce: 15 Eylül'de aşağıda tanımlanınca kart
  // yokken atlanıyor, kart açılınca "Rendered more hooks" ile çöküyordu.
  const docLatest = useDrawerRef(null);
  const [docFocus, setDocFocus] = useDrawerState(null);
  const docRef = useDrawerRef(null);
  useDrawerEffect(() => {
    if (docFocus === null || !docRef.current) return;
    const el = docRef.current.querySelector(`[data-block-index="${docFocus}"]`);
    if (!el) return;
    el.focus();
    // İmleci sona koy: yeni blok boş, dönüştürülen blokta metin korunuyor.
    const sel = window.getSelection?.();
    if (sel && el.childNodes.length) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
    setDocFocus(null);
  }, [docFocus, docState]);

  // ── Note linking ─────────────────────────────────────────────────────────
  const [noteLinkOpen, setNoteLinkOpen] = useDrawerState(false);
  const [allNotes, setAllNotes]         = useDrawerState(null); // null = not loaded yet
  const [noteSearch, setNoteSearch]     = useDrawerState('');
  const [creatingNote, setCreatingNote] = useDrawerState(false);
  const noteLinkRef                     = useDrawerRef(null);
  const [dueVal, setDueVal]             = useDrawerState('');
  const [startVal, setStartVal]         = useDrawerState('');
  const [assigneeDatesVal, setAssigneeDatesVal] = useDrawerState({});
  const statusRef   = useDrawerRef(null);
  const priorityRef = useDrawerRef(null);
  const labelRef    = useDrawerRef(null);
  const assigneeRef = useDrawerRef(null);
  const textareaRef = useDrawerRef(null);

  useDrawerEffect(() => {
    setDueVal(task?.due || '');
    setStartVal(task?.start || '');
    setAssigneeDatesVal(task?.assignee_dates || {});
  }, [task?.id, task?.due, task?.start]);

  // Fetch full task detail (doc + comments + subtasks) when drawer opens
  useDrawerEffect(() => {
    if (!open || !task) { setDetail(null); setStatusOpen(false); return; }
    setLoadingDetail(true);
    API.getTaskDetail(task.id)
      .then(d => { setDetail(d); setDocState(d?.doc || null); docLatest.current = null; setLoadingDetail(false); })
      .catch(() => { setDetail(null); setDocState(null); setLoadingDetail(false); });
  }, [open, task?.id]);

  // Fetch linked notes for this task
  useDrawerEffect(() => {
    if (!open || !task) { setLinkedNotes([]); return; }
    setLoadingLinkedNotes(true);
    API.taskLinkedNotes(task.id)
      .then(rows => { setLinkedNotes(rows || []); setLoadingLinkedNotes(false); })
      .catch(() => { setLinkedNotes([]); setLoadingLinkedNotes(false); });
  }, [open, task?.id]);

  // Fetch attachments
  useDrawerEffect(() => {
    if (!open || !task) { setAttachments([]); return; }
    API.listAttachments(task.id).then(rows => setAttachments(rows || [])).catch(() => {});
  }, [open, task?.id]);

  const handleFileUpload = async (file) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const att = await API.uploadAttachment(task.id, fd);
      setAttachments(prev => [att, ...prev]);
      window.showToast?.(`"${att.file_name}" ${window.t?.('drawer_file_uploaded') || 'yüklendi'}.`, 'success');
    } catch (e) { window.showToast?.(e.message, 'error'); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const handleDeleteAttachment = async (attId) => {
    try {
      await API.deleteAttachment(attId);
      setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (e) { window.showToast?.(e.message, 'error'); }
  };

  const handleRenameAttachment = async (attId, newName) => {
    const n = newName.trim();
    if (!n) { setEditingAttId(null); return; }
    try {
      const updated = await API.renameAttachment(attId, n);
      setAttachments(prev => prev.map(a => a.id === attId ? { ...a, display_name: updated.display_name } : a));
    } catch (e) { window.showToast?.(e.message, 'error'); }
    setEditingAttId(null);
  };

  // Live updates: react to note_updated / note_deleted to keep panel fresh
  useDrawerEffect(() => {
    const sock = window.SOCKET;
    if (!sock || !open || !task) return;
    const onUpd = (note) => {
      if (!note) return;
      setLinkedNotes(prev => {
        const isLinkedNow = (note.linked_tasks || []).map(String).includes(String(task.id));
        const had = prev.some(n => n.id === note.id);
        if (isLinkedNow && !had) return [note, ...prev];
        if (!isLinkedNow && had) return prev.filter(n => n.id !== note.id);
        return prev.map(n => n.id === note.id ? { ...n, ...note } : n);
      });
    };
    const onDel = ({ id }) => setLinkedNotes(prev => prev.filter(n => n.id !== id));
    sock.on('note_updated', onUpd);
    sock.on('note_deleted', onDel);
    return () => {
      sock.off('note_updated', onUpd);
      sock.off('note_deleted', onDel);
    };
  }, [open, task?.id]);

  useDrawerEffect(() => {
    const handleClick = (e) => {
      if (statusOpen   && statusRef.current   && !statusRef.current.contains(e.target))   setStatusOpen(false);
      if (priorityOpen && priorityRef.current && !priorityRef.current.contains(e.target)) setPriorityOpen(false);
      if (labelOpen    && labelRef.current    && !labelRef.current.contains(e.target))    setLabelOpen(false);
      if (assigneeOpen && assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false);
      if (noteLinkOpen && noteLinkRef.current && !noteLinkRef.current.contains(e.target)) setNoteLinkOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusOpen, priorityOpen, labelOpen, assigneeOpen, noteLinkOpen]);

  // Yapılacaklar = kartın alt görevleri; tek kaynak `subtasks` tablosu.
  //
  // Liste eskiden `task.doc` içindeki bir `checklist` bloğunda tutuluyor ve
  // ilerleme burada, istemcide hesaplanıyordu; kart açma penceresi ve MCP ise
  // aynı listeyi `subtasks` tablosuna yazıyordu. 13 Eylül 2026'da iki kaynağı
  // birden taşıyan 5 kartın 3'ü birbirinden ayrışmış bulundu. Artık liste
  // yalnızca alt görev uçlarından geçiyor, ilerlemeyi sunucu türetiyor ve
  // kontrol listesi taşıyan `doc` yazımı sunucuda reddediliyor
  // (server/src/lib/checklist.js).
  const checklist = detail?.subtasks_detail || [];

  // Alt görev değişikliği kartın ilerlemesini ve "x/y" sayısını sunucuda
  // değiştiriyor; panodaki kart ikisini de gösterdiği için buradan tazeleniyor.
  // `subtasks` alt görev kalmayınca yanıtta hiç yok — açıkça undefined
  // verilmezse birleştirme eski "1/1"i kartta bırakırdı.
  const kartiTazele = async () => {
    const d = await API.getTaskDetail(task.id);
    setDetail(prev => ({ ...(prev || {}), subtasks_detail: d.subtasks_detail, progress: d.progress }));
    onTaskUpdate && onTaskUpdate({ id: task.id, progress: d.progress, subtasks: d.subtasks });
  };

  const altGorevIslemi = async (islem, iyimser) => {
    if (!task) return;
    const onceki = detail?.subtasks_detail || [];
    if (iyimser) setDetail(d => ({ ...(d || {}), subtasks_detail: iyimser(d?.subtasks_detail || []) }));
    const hataGoster = (e) =>
      window.showToast?.((window.t?.('drawer_err_checklist') || 'Checklist kaydedilemedi: ') + e.message, 'error');
    setCheckSaving(true);
    try {
      await islem();
    } catch (e) {
      // Yalnızca yazma başarısızsa geri sarılıyor.
      setDetail(d => ({ ...(d || {}), subtasks_detail: onceki }));
      hataGoster(e);
      setCheckSaving(false);
      return;
    }
    // Yazma oldu; tazeleme düşerse iyimser hâl doğru kalır, yalnızca söylenir.
    try { await kartiTazele(); } catch (e) { hataGoster(e); } finally { setCheckSaving(false); }
  };

  const toggleCheckItem = (id) => {
    const it = checklist.find(s => s.id === id);
    if (!it) return;
    altGorevIslemi(() => API.toggleSubtask(id, !it.done),
      liste => liste.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const addCheckItem = () => {
    const text = checkInput.trim();
    if (!text) return;
    setCheckInput('');
    // İyimser satır yok: kimliği sunucu veriyor, tazeleme listeyi getiriyor.
    altGorevIslemi(() => API.addSubtask(task.id, text));
  };

  const deleteCheckItem = (id) => {
    altGorevIslemi(() => API.deleteSubtask(id), liste => liste.filter(s => s.id !== id));
  };

  const renameCheckItem = (id, newText) => {
    const t = newText.trim();
    setEditingCheckId(null);
    if (!t) return;
    altGorevIslemi(() => API.renameSubtask(id, t),
      liste => liste.map(s => s.id === id ? { ...s, text: t } : s));
  };

  const patchTask = async (fields) => {
    onTaskUpdate && onTaskUpdate({ id: task.id, ...task, ...fields });
    try {
      const updated = await API.updateTask(task.id, fields);
      onTaskUpdate && onTaskUpdate({ id: task.id, ...updated });
    } catch (e) {
      console.error('patchTask:', e);
      onTaskUpdate && onTaskUpdate({ id: task.id, ...task });
    }
  };

  // ── Duplicate task ──────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const newTask = await API.createTask(task.project_id, {
        title: task.title + ' (' + (window.t('drawer_copy_suffix') || 'kopya') + ')',
        desc: task.desc,
        col: task.col,
        priority: task.priority,
        start: task.start || null,
        due: task.due || null,
        labels: task.labels || [],
        // Kopya yalnızca alanın bugünkü üyelerine atanır. Alandan çıkarılan
        // kişinin adı eski kartta kalır (ürün kararı) ama yeni karta taşınamaz:
        // sunucu yeni eklenen, üye olmayan atananı 400 ile reddediyor.
        assignees: (task.assignees || []).filter((slug) => DATA.MEMBERS.some((m) => m.id === slug)),
        assignee_dates: task.assignee_dates || null,
      });
      if (onCreateTask) onCreateTask(newTask);
      onClose();
    } catch (e) {
      window.showToast?.(window.t('drawer_err_duplicate') + e.message, 'error');
    } finally {
      setDuplicating(false);
    }
  };

  if (!task) return null;

  const members = (task.assignees || [])
    .map(id => DATA.MEMBERS.find(m => m.id === id))
    .filter(Boolean);
  const col = DATA.COLUMNS.find(c => c.id === task.col) || { title_tr: task.col };

  // Kontrol listesi blokları gösterilmiyor ve geri saklanmıyor: yapılacaklar
  // aşağıdaki bölümde, alt görevlerden geliyor. Blok bir kez daha kaydedilseydi
  // sunucu reddederdi (err_doc_checklist_retired).
  const doc        = _patchDocI18n(_kontrolListesiz(docState || detail?.doc || _basicDoc(task)));
  const comments   = detail?.comments_list || [];

  // ── Blok belge (Notion-lite, faz 1 — 15 Eylül 2026) ─────────────────────
  // Gövde blok listesi; her yapısal değişiklik (ekle, sil, tür değiştir)
  // hemen kaydedilir, metin değişikliği odak kaybında (DrawerDocBlock).
  // `_i18n` yalnızca üretilmiş "Açıklama" başlığının işareti; kullanıcı o
  // bloğa yazarsa artık onun metni olur, işaret düşer.
  // Yapısal işlemler (ekle/sil/dönüştür) render'daki `doc` kapanışını değil,
  // en son kaydedilen belgeyi okur. Enter akışı önce metni kaydedip sonra
  // blok ekliyor; kapanış eski metni taşıdığı için ekleme az önce
  // kaydedileni ezerdi (kod okumasında bulundu, 15 Eylül).
  const sonDoc = () => docLatest.current || doc;
  const saveDoc = async (newDoc) => {
    docLatest.current = newDoc;
    setDocState(newDoc);
    try {
      const updated = await API.updateTask(task.id, { doc: newDoc });
      onTaskUpdate && onTaskUpdate({ id: task.id, ...updated });
      return true;
    }
    catch (e) { window.showToast?.((window.t?.('drawer_err_save') || 'Kaydedilemedi: ') + e.message, 'error'); return false; }
  };
  const saveDocBlock = (index, newText) =>
    saveDoc(sonDoc().map((b, i) => i === index ? { kind: b.kind, text: newText } : b));

  // Enter: bu bloğun ardına boş paragraf, odak oraya.
  const insertBlockAfter = (index) => {
    const d = sonDoc();
    const newDoc = [...d.slice(0, index + 1), { kind: 'p', text: '' }, ...d.slice(index + 1)];
    setDocFocus(index + 1);
    return saveDoc(newDoc);
  };
  // Boş blokta Backspace: bloğu kaldır, odak bir öncekine. Tek blok kalmışsa
  // kaldırılmaz — gövde hiç boş kalmasın, kullanıcı nereye yazacağını görsün.
  const removeBlock = (index) => {
    const d = sonDoc();
    if (d.length <= 1) return false;
    setDocFocus(Math.max(0, index - 1));
    return saveDoc(d.filter((_, i) => i !== index));
  };
  // "/" menüsü: türü değiştir, metni koru.
  const convertBlock = (index, kind) => {
    setDocFocus(index);
    return saveDoc(sonDoc().map((b, i) => i === index ? { kind, text: b.text || '' } : b));
  };


  // ── Karttan yeni not ────────────────────────────────────────────────────
  // Kullanıcı isteği (15 Eylül): bağlı not yokken "not bağla" yalnızca var olan
  // notu arıyor; asıl ihtiyaç kartın içinden yeni bir not açıp bağlamak.
  // Not kartın başlığıyla açılır, karta bağlanır ve Notlar görünümünde açık
  // gelir; içerik orada yazılır. Görünürlük `workspace`: kartın bağlı notu
  // kartı görebilen herkes tarafından okunabilmeli, `private` olsaydı ekip
  // arkadaşı kartı açıp boş bir "bağlı not" görürdü. Kullanıcı notun içinden
  // kısabilir.
  const handleNewNote = async () => {
    if (creatingNote) return;
    setCreatingNote(true);
    try {
      const note = await API.createNote({ title: task.title, visibility: 'workspace' });
      await API.linkNoteTask(note.id, task.id);
      onClose && onClose();
      if (window.__SWITCH_VIEW__) window.__SWITCH_VIEW__('notes');
      setTimeout(() => { window.__NOTES_OPEN__ && window.__NOTES_OPEN__(note.id); }, 30);
    } catch (e) {
      window.showToast?.((window.t?.('drawer_err_save') || 'Kaydedilemedi: ') + e.message, 'error');
    } finally {
      setCreatingNote(false);
    }
  };

  // ── Delete own comment ──────────────────────────────────────────────────
  // Uç (`DELETE /api/comments/:id`, yalnızca kendi yorumu) ve API sarmalayıcısı
  // baştan beri vardı; arayüzde düğmesi yoktu, yani kimse kendi yorumunu
  // silemiyordu. 15 Eylül'de fark edildi: bozuk kodlamayla yazılmış bir yorum
  // demo kartında kaldı ve tarayıcıdan kaldırmanın yolu yoktu. Sunucu zaten
  // sahiplik kontrolü yapıyor; düğme yalnızca kendi yorumunda görünüyor.
  const handleCommentDelete = async (commentId) => {
    try {
      await API.deleteComment(commentId);
      setDetail(d => ({ ...(d || {}), comments_list: (d?.comments_list || []).filter(c => String(c.id) !== String(commentId)) }));
      onTaskUpdate({ id: task.id, comments: Math.max(0, (task.comments || 1) - 1) });
    } catch (e) {
      window.showToast?.(window.t('drawer_err_comment') + e.message, 'error');
    }
  };

  // ── Submit comment ──────────────────────────────────────────────────────
  const handleCommentSubmit = async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const comment = await API.addComment(task.id, text);
      setDetail(d => ({ ...(d || {}), comments_list: [...(d?.comments_list || []), comment] }));
      setNewComment('');
      setMentionQuery(null);
      onTaskUpdate({ id: task.id, comments: (task.comments || 0) + 1 });
    } catch (e) {
      window.showToast?.(window.t('drawer_err_comment') + e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── @ Mention logic ─────────────────────────────────────────────────────
  const handleCommentChange = (e) => {
    const val = e.target.value;
    setNewComment(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/@([\wçğıöşüÇĞİÖŞÜ]*)$/i);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const insertMention = (member) => {
    const el     = textareaRef.current;
    const cursor = el ? el.selectionStart : newComment.length;
    const before = newComment.slice(0, cursor);
    const after  = newComment.slice(cursor);
    const match  = before.match(/@([\wçğıöşüÇĞİÖŞÜ-]*)$/i);
    // İLK AD DEĞİL SLUG. İlk ad benzersiz değil: aynı alanda iki "Eray Atalay"
    // varken `@Eray` ikisine de uyuyor, sunucu belirsiz sayıyor ve kimseye
    // bildirim gitmiyor (kart #235). Slug benzersiz olduğu için belirsizlik
    // doğmuyor; sohbet tarafı zaten yıllardır slug yazıyor ve çalışan taraf o.
    // Kullanıcı yine adı görüyor — çip çözümleyici slug'ı ada çeviriyor.
    const prefix = match ? before.slice(0, before.length - match[0].length) : before;
    setNewComment(prefix + '@' + member.id + ' ' + after);
    setMentionQuery(null);
    setTimeout(() => el && el.focus(), 0);
  };

  const mentionMembers = mentionQuery !== null
    ? DATA.MEMBERS.filter(m => m.name.toLowerCase().includes(mentionQuery))
    : [];

  const bodyContent = (
    <>
      <div className="doc-title" contentEditable={canManageTasks} suppressContentEditableWarning
        onBlur={(e) => {
          if (!canManageTasks) return;
          const newTitle = e.target.textContent?.trim();
          if (newTitle && newTitle !== task.title) {
            API.updateTask(task.id, { title: newTitle })
              .then(() => onTaskUpdate({ id: task.id, title: newTitle }))
              .catch(console.error);
          }
        }}>
        {task.title}
      </div>

      {/* Properties */}
      <div className="props-grid">
        <div className="prop-label"><Icon name="circleHalf" size={13} /> {window.t('drawer_status')}</div>
        <div className="prop-value custom-dropdown" ref={statusRef}>
          <button type="button" className="custom-dropdown-btn" disabled={!canManageTasks} onClick={() => canManageTasks && setStatusOpen(o => !o)}>
            <span className="dropdown-label">{col.title_tr}</span>
            <Icon name="chevronDown" size={12} />
          </button>
          {statusOpen && canManageTasks && (
            <div className="custom-dropdown-menu">
              {DATA.COLUMNS.map(c => (
                <button key={c.id} type="button" className={"custom-dropdown-item" + (c.id === task.col ? ' active' : '')}
                  onClick={() => { onMoveTask(task.id, c.id); setStatusOpen(false); }}>
                  {c.title_tr}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="prop-label"><Icon name="flag" size={13} /> {window.t('drawer_priority')}</div>
        <div className="prop-value custom-dropdown" ref={priorityRef}>
          <button type="button" className="custom-dropdown-btn" disabled={!canManageTasks}
            onClick={() => canManageTasks && setPriorityOpen(o => !o)}>
            <span className="priority-dot" data-p={task.priority} />
            <span className="dropdown-label">{task.priority === 'high' ? window.t('board_priority_high') : task.priority === 'mid' ? window.t('board_priority_mid') : window.t('board_priority_low')}</span>
            {canManageTasks && <Icon name="chevronDown" size={12} />}
          </button>
          {priorityOpen && canManageTasks && (
            <div className="custom-dropdown-menu">
              {[['high', window.t('board_priority_high')],['mid', window.t('board_priority_mid')],['low', window.t('board_priority_low')]].map(([p, label]) => (
                <button key={p} type="button" className={'custom-dropdown-item' + (task.priority === p ? ' active' : '')}
                  onClick={() => { patchTask({ priority: p }); setPriorityOpen(false); }}>
                  <span className="priority-dot" data-p={p} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="prop-label"><Icon name="users" size={13} /> {window.t('drawer_assignee')}</div>
        <div className="prop-value custom-dropdown" ref={assigneeRef}>
          <button type="button" className="custom-dropdown-btn" disabled={!canManageTasks}
            onClick={() => canManageTasks && setAssigneeOpen(o => !o)}>
            {members.length > 0
              ? <><AvatarStack members={members} size="sm" max={3} /><span style={{ color:'var(--ink-muted)', fontSize:12 }}>{members.map(m => m.name.split(' ')[0]).join(', ')}</span></>
              : <span style={{ color:'var(--ink-muted)' }}>{window.t('drawer_assign_placeholder')}</span>
            }
            {canManageTasks && <Icon name="chevronDown" size={12} />}
          </button>
          {assigneeOpen && canManageTasks && (
            <div className="custom-dropdown-menu" style={{ minWidth: 180 }}>
              {DATA.MEMBERS.map(m => {
                const assigned = (task.assignees || []).includes(m.id);
                return (
                  <button key={m.id} type="button" className="custom-dropdown-item"
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => {
                      const cur = task.assignees || [];
                      const next = assigned ? cur.filter(a => a !== m.id) : [...cur, m.id];
                      patchTask({ assignees: next });
                    }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Avatar member={m} size="sm" /> {m.name.split(' ')[0]}
                    </span>
                    {assigned && <Icon name="check" size={12} strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="prop-label"><Icon name="calendar" size={13} /> {window.t('drawer_dates')}</div>
        <div className="prop-value" style={{ gap: 4, flexDirection: 'column', alignItems: 'stretch' }}>
          {canManageTasks ? (
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <DatePicker value={startVal} onChange={(v) => { setStartVal(v || ''); patchTask({ start: v || null }); }} />
              <span style={{ color:'var(--ink-muted)', fontSize:12, flexShrink:0 }}>–</span>
              <DatePicker value={dueVal} onChange={(v) => { setDueVal(v || ''); patchTask({ due: v || null }); }} />
            </div>
          ) : (
            <span style={{ fontSize:13, color: dueVal && DATA.isOverdue(dueVal, task.col) ? 'var(--status-rose)' : 'var(--ink)' }}>
              {startVal && dueVal ? `${DATA.fmtDate(startVal)} – ${DATA.fmtDate(dueVal)}`
                : dueVal ? DATA.fmtDate(dueVal)
                : startVal ? DATA.fmtDate(startVal)
                : '—'}
            </span>
          )}
          {members.filter(m => assigneeDatesVal[m.id]?.start || assigneeDatesVal[m.id]?.end).map(m => {
            const d = assigneeDatesVal[m.id] || {};
            const patchAd = (field, val) => {
              const next = { ...assigneeDatesVal, [m.id]: { ...(assigneeDatesVal[m.id] || {}), [field]: val || null } };
              setAssigneeDatesVal(next);
              patchTask({ assignee_dates: next });
            };
            return (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:m.color, flexShrink:0 }} />
                <span style={{ fontSize:11, color:'var(--ink-muted)', minWidth:44 }}>{m.name.split(' ')[0]}</span>
                {canManageTasks ? (
                  <div style={{ display:'flex', gap:4, flex:1 }}>
                    <DatePicker value={d.start || ''} onChange={(v) => patchAd('start', v)} />
                    <DatePicker value={d.end   || ''} onChange={(v) => patchAd('end',   v)} />
                  </div>
                ) : (
                  <span style={{ fontSize:11, color:'var(--ink)' }}>
                    {d.start && d.end ? `${DATA.fmtDate(d.start)} – ${DATA.fmtDate(d.end)}`
                      : DATA.fmtDate(d.start || d.end)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="prop-label"><Icon name="tag" size={13} /> {window.t('drawer_labels')}</div>
        <div className="prop-value" style={{ gap: 4, flexWrap: 'wrap' }} ref={labelRef}>
          {(task.labels || []).map(l => {
            const lab = DATA.LABELS[l];
            return lab && (
              <span key={l} className="tag" data-tone={lab.tone}
                style={{ cursor: canManageTasks ? 'pointer' : 'default' }}
                onClick={() => {
                  if (!canManageTasks) return;
                  patchTask({ labels: (task.labels || []).filter(x => x !== l) });
                }}
                title={canManageTasks ? window.t('drawer_label_remove_hint') : undefined}>
                {lab.tr}
              </span>
            );
          })}
          {canManageTasks && (
            <>
              <button className="tag" style={{ cursor:'pointer', borderStyle:'dashed' }}
                onClick={(e) => { e.stopPropagation(); setLabelOpen(o => !o); }}>
                <Icon name="plus" size={10} strokeWidth={2} />
              </button>
              {labelOpen && (
                <div className="custom-dropdown-menu" style={{ minWidth: 180 }}>
                  {Object.entries(DATA.LABELS).map(([slug, lab]) => {
                    const active = (task.labels || []).includes(slug);
                    return (
                      <button key={slug} type="button" className="custom-dropdown-item"
                        style={{ justifyContent:'space-between' }}
                        onClick={() => {
                          const cur = task.labels || [];
                          patchTask({ labels: active ? cur.filter(x => x !== slug) : [...cur, slug] });
                        }}>
                        <span className="tag" data-tone={lab.tone}>{lab.tr}</span>
                        {active && <Icon name="check" size={12} strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Document content */}
      {loadingDetail ? (
        <div style={{ padding: '24px 0', color: 'var(--ink-muted)', fontSize: 13 }}>{window.t('drawer_loading')}</div>
      ) : (
        <div className="doc-content" ref={docRef}>
          {doc.map((b, i) => (
            <DrawerDocBlock key={i} index={i} block={b}
              onUpdate={canManageTasks ? (newText) => saveDocBlock(i, newText) : undefined}
              onEnter={canManageTasks ? () => insertBlockAfter(i) : undefined}
              onRemove={canManageTasks ? () => removeBlock(i) : undefined}
              onConvert={canManageTasks ? (kind) => convertBlock(i, kind) : undefined}
              onMove={canManageTasks ? (dir) => setDocFocus(Math.min(doc.length - 1, Math.max(0, i + dir))) : undefined} />
          ))}
        </div>
      )}

      {/* ── Checklist ── */}
      <div className={`comments-section drw-sec${checklist.length ? '' : ' drw-sec--empty'}`}>
        <h3 className="drw-h3">
          {window.t?.('drawer_checklist') || 'Yapılacaklar'}
          {checklist.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)', fontWeight: 400 }}>
              {checklist.filter(i => i.done).length}/{checklist.length}
            </span>
          )}
          {checkSaving && <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontFamily: 'var(--font-ui)', fontWeight: 400 }}>{window.t?.('drawer_saving') || 'kaydediliyor…'}</span>}
        </h3>
        {checklist.length > 0 && (
          <div className="checklist-progress-bar" style={{ marginBottom: 10 }}>
            <div className="checklist-progress-fill" style={{ width: `${Math.round(checklist.filter(i => i.done).length / checklist.length * 100)}%` }} />
          </div>
        )}
        <div className="drawer-checklist">
          {checklist.map(it => (
            <div key={it.id} className="drawer-check-row" data-done={it.done}>
              <div
                className="drawer-check-box"
                data-done={it.done}
                onClick={() => canManageTasks && editingCheckId !== it.id && toggleCheckItem(it.id)}
              >
                {it.done && <Icon name="check" size={10} />}
              </div>
              {editingCheckId === it.id ? (
                <div style={{ display: 'flex', flex: 1, gap: 4, alignItems: 'center' }}>
                  <input
                    autoFocus
                    className="drawer-check-edit-input"
                    value={editingCheckText}
                    onChange={e => setEditingCheckText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameCheckItem(it.id, editingCheckText || it.text);
                      if (e.key === 'Escape') setEditingCheckId(null);
                    }}
                  />
                  <button
                    className="drawer-check-action save"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => renameCheckItem(it.id, editingCheckText || it.text)}
                    title={window.t?.('notes_save') || 'Kaydet'}
                  >
                    <Icon name="check" size={11} />
                  </button>
                  <button
                    className="drawer-check-action cancel"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setEditingCheckId(null)}
                    title={window.t?.('drawer_cancel') || 'İptal'}
                  >
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ) : (
                <span className="drawer-check-text">{it.text}</span>
              )}
              {canManageTasks && editingCheckId !== it.id && (
                <button className="drawer-check-del" onClick={() => { setEditingCheckId(it.id); setEditingCheckText(it.text); }} title={window.t?.('notes_edit') || 'Düzenle'}>
                  <Icon name="pen" size={10} />
                </button>
              )}
              {canManageTasks && editingCheckId !== it.id && (
                <button className="drawer-check-del" onClick={() => deleteCheckItem(it.id)} title={window.t?.('notes_unlink_task') || 'Kaldır'}>
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
          ))}
          {canManageTasks && (
            <div className="drawer-check-add">
              <input
                placeholder={window.t?.('modal_checklist_placeholder') || 'Yeni madde ekle…'}
                value={checkInput}
                onChange={e => setCheckInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCheckItem(); }}
              />
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={addCheckItem} disabled={!checkInput.trim()}>
                {window.t?.('modal_checklist_add') || '+ Ekle'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Linked notes ── */}
      <div className={`comments-section drw-sec${linkedNotes.length ? '' : ' drw-sec--empty'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <h3 className="drw-h3" style={{ margin: 0, flex: 1 }}>
            {window.t('drawer_linked_notes')} <span style={{ color: 'var(--ink-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>· {linkedNotes.length}</span>
          </h3>
          {canManageTasks && (
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={handleNewNote} disabled={creatingNote}>
              <Icon name="note" size={11} /> {creatingNote ? (window.t?.('drawer_saving') || 'kaydediliyor…') : (window.t?.('drawer_new_note') || 'Yeni not')}
            </button>
          )}
          {canManageTasks && (
            <div style={{ position: 'relative' }} ref={noteLinkRef}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '3px 9px' }}
                onClick={() => {
                  setNoteLinkOpen(o => !o);
                  setNoteSearch('');
                  if (!allNotes) API.listNotes().then(setAllNotes).catch(() => setAllNotes([]));
                }}
              >
                <Icon name="plus" size={11} /> {window.t?.('drawer_link_note') || 'Not bağla'}
              </button>
              {noteLinkOpen && (
                <div className="note-link-dropdown">
                  <input
                    autoFocus
                    placeholder={window.t?.('drawer_note_search_ph') || 'Not ara…'}
                    value={noteSearch}
                    onChange={e => setNoteSearch(e.target.value)}
                    className="note-link-search"
                  />
                  <div className="note-link-list">
                    {allNotes === null
                      ? <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-faint)' }}>{window.t?.('drawer_loading') || 'Yükleniyor…'}</div>
                      : (allNotes || [])
                          .filter(n => !linkedNotes.some(ln => ln.id === n.id))
                          .filter(n => !noteSearch || (n.title || '').toLowerCase().includes(noteSearch.toLowerCase()))
                          .slice(0, 12)
                          .map(n => (
                            <button
                              key={n.id}
                              className="note-link-item"
                              onClick={async () => {
                                try {
                                  await API.linkNoteTask(n.id, task.id);
                                  setLinkedNotes(prev => [n, ...prev]);
                                  setNoteLinkOpen(false);
                                  window.showToast?.(window.t?.('drawer_note_linked') || 'Not bağlandı.', 'success');
                                } catch (e) { window.showToast?.(e.message, 'error'); }
                              }}
                            >
                              <Icon name="note" size={12} />
                              <span>{n.title || window.t?.('drawer_untitled_note') || '(başlıksız)'}</span>
                            </button>
                          ))
                    }
                    {allNotes !== null && (allNotes || []).filter(n => !linkedNotes.some(ln => ln.id === n.id)).length === 0 && (
                      <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink-faint)' }}>{window.t?.('drawer_no_linkable_notes') || 'Bağlanacak not yok.'}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {loadingLinkedNotes ? (
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '8px 0' }}>{window.t('drawer_loading')}</div>
        ) : linkedNotes.length === 0 ? (
          <div className="drw-empty" style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '8px 0' }}>{window.t('drawer_no_linked_notes')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linkedNotes.map(n => {
              const author = DATA.MEMBERS.find(m => m.id === n.author);
              return (
                <div key={n.id} className="note-linked-item"
                  onClick={() => {
                    onClose && onClose();
                    if (window.__SWITCH_VIEW__) window.__SWITCH_VIEW__('notes');
                    setTimeout(() => { window.__NOTES_OPEN__ && window.__NOTES_OPEN__(n.id); }, 30);
                  }}>
                  <Icon name="note" size={12} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || window.t('drawer_untitled_note')}</span>
                  {author && <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{author.name?.split(' ')[0]}</span>}
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>{fmtTimeAgo(n.updated_ago)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attachments */}
      <div className={`comments-section drw-sec${attachments.length ? '' : ' drw-sec--empty'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h3 className="drw-h3" style={{ margin: 0, flex: 1 }}>
            {window.t?.('drawer_attachments') || 'Dosyalar'}
            {attachments.length > 0 && <span style={{ color: 'var(--ink-muted)', fontSize: 13, fontFamily: 'var(--font-ui)', marginLeft: 6 }}>· {attachments.length}</span>}
          </h3>
          {canManageTasks && (
            <>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }}
                onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Icon name="paperclip" size={11} /> {uploading ? (window.t?.('drawer_uploading') || 'Yükleniyor…') : (window.t?.('drawer_attach') || '+ Ekle')}
              </button>
            </>
          )}
        </div>
        {/* Drop zone */}
        {canManageTasks && (
          <div className="attachment-drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}>
            <Icon name="upload" size={14} />
            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{window.t?.('drawer_drop_files') || 'Dosyayı buraya sürükle veya tıkla'}</span>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="attachment-list">
            {attachments.map(att => {
              const isImage = att.file_type.startsWith('image/');
              const isVideo = att.file_type.startsWith('video/');
              const displayName = att.display_name || att.file_name.replace(/\.[^/.]+$/, '');
              const isEditingThis = editingAttId === att.id;
              return (
                <div key={att.id} className="attachment-item">
                  {isImage ? (
                    <div
                      className="attachment-thumb"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setImagePreview({ url: att.url, name: displayName })}
                    >
                      <img src={att.url} alt={displayName} />
                    </div>
                  ) : (
                    <a href={att.url} download={att.file_name} className="attachment-icon-wrap">
                      <Icon name={isVideo ? 'video' : 'file'} size={18} />
                    </a>
                  )}
                  <div className="attachment-meta">
                    {isEditingThis ? (
                      <input
                        autoFocus
                        className="attachment-name-input"
                        value={editingAttName}
                        onChange={e => setEditingAttName(e.target.value)}
                        onBlur={() => handleRenameAttachment(att.id, editingAttName || displayName)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameAttachment(att.id, editingAttName || displayName);
                          if (e.key === 'Escape') setEditingAttId(null);
                        }}
                      />
                    ) : isImage ? (
                      <span className="attachment-name" style={{ cursor: 'pointer' }}
                        onClick={() => setImagePreview({ url: att.url, name: displayName })}
                        onDoubleClick={canManageTasks ? () => { setEditingAttId(att.id); setEditingAttName(displayName); } : undefined}
                        title={canManageTasks ? (window.t?.('drawer_rename_hint') || 'Yeniden adlandırmak için çift tıkla') : undefined}>
                        {displayName}
                      </span>
                    ) : (
                      <a href={att.url} download={att.file_name} className="attachment-name"
                        onDoubleClick={canManageTasks ? (e) => { e.preventDefault(); setEditingAttId(att.id); setEditingAttName(displayName); } : undefined}
                        title={canManageTasks ? (window.t?.('drawer_rename_hint') || 'Yeniden adlandırmak için çift tıkla') : undefined}>
                        {displayName}
                      </a>
                    )}
                    <span className="attachment-sub">{DATA.MEMBERS.find(m => m.id === att.uploader)?.name?.split(' ')[0] || ''} · {fmtTimeAgo(att.created_at)}</span>
                  </div>
                  {canManageTasks && !isEditingThis && (
                    <button className="drawer-check-del" style={{ opacity: 0.6 }}
                      onClick={() => { setEditingAttId(att.id); setEditingAttName(displayName); }} title={window.t?.('board_col_rename') || 'Yeniden adlandır'}>
                      <Icon name="pen" size={11} />
                    </button>
                  )}
                  {canManageTasks && !isEditingThis && (
                    <button className="drawer-check-del" style={{ opacity: 1 }} onClick={() => handleDeleteAttachment(att.id)} title={window.t?.('notes_delete') || 'Sil'}>
                      <Icon name="trash" size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* Image preview lightbox */}
        {imagePreview && ReactDOM.createPortal(
          <div className="img-preview-overlay" onClick={() => setImagePreview(null)}>
            <div className="img-preview-box" onClick={e => e.stopPropagation()}>
              <button className="img-preview-close" onClick={() => setImagePreview(null)}>
                <Icon name="x" size={16} />
              </button>
              <img src={imagePreview.url} alt={imagePreview.name} className="img-preview-img" />
              <div className="img-preview-name">{imagePreview.name}</div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Harcanan süre — raporlamanın emek tarafı */}
      {task?.id && <WorkLogSection taskId={task.id} />}

      {/* Comments */}
      <div className="comments-section drw-sec">
        <h3 className="drw-h3">
          {window.t('drawer_comments')} <span style={{ color: 'var(--ink-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>· {comments.length}</span>
        </h3>
        {comments.map((c, i) => {
          const m = DATA.MEMBERS.find(mm => mm.id === c.author);
          return (
            <div className="comment-row" key={i}>
              <Avatar member={m || { initials: '?', color: 'var(--ink-faint)' }} size="sm" />
              <div className="comment-body">
                <div className="comment-head">
                  <span className="comment-name">{m?.name || c.author}</span>
                  <span className="comment-time">{fmtTimeAgo(c.time)}</span>
                  {c.author === window.CURRENT_USER?.id && (
                    <button className="drawer-check-del comment-del" onClick={() => handleCommentDelete(c.id)} title={window.t?.('drawer_comment_delete') || 'Yorumu sil'}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </div>
                <div className="comment-text">
                  {c.text.split(/(@[\w\-çğışöüÇĞİŞÖÜ]+)/g).map((part, pi) => {
                    if (part.startsWith('@')) {
                      const slug = part.slice(1);
                      const mentioned = DATA.MEMBERS.find(mm => mm.id === slug || mm.name.toLowerCase() === slug.toLowerCase() || mm.name.toLowerCase().split(' ')[0] === slug.toLowerCase());
                      if (mentioned) {
                        return (
                          <span key={pi} className="comment-mention"
                            onClick={() => {
                              window.__CHAT_MENTION_TASK__ = { id: task.id, title: task.title };
                              if (window.__OPEN_CHAT__) window.__OPEN_CHAT__(mentioned.id);
                            }}>
                            {/* Tam ad: iki "Eray Atalay" varken "@Eray" çipi
                                hangisinin bahsedildiğini söylemiyordu. Sohbet
                                çipi de tam ad gösteriyor (kart #235). */}
                            @{mentioned.name}
                          </span>
                        );
                      }
                    }
                    return part;
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div className="comment-compose">
          <Avatar member={DATA.MEMBERS.find(m => m.id === window.CURRENT_USER?.id) || DATA.MEMBERS[0]} size="sm" />
          <div className="comment-input-wrap">
            {mentionMembers.length > 0 && (
              <div className="mention-dropdown">
                {mentionMembers.map(m => (
                  <button key={m.id} className="mention-item"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}>
                    <Avatar member={m} size="sm" />
                    <span className="mention-name">{m.name}</span>
                    <span className="mention-role">{m.role}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              placeholder={window.t('drawer_comment_placeholder')}
              value={newComment}
              onChange={handleCommentChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setMentionQuery(null); return; }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCommentSubmit();
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>{window.t('app_cancel')}</button>
          <button className="btn btn-primary" onClick={handleCommentSubmit} disabled={submitting || !newComment.trim()}>
            {submitting ? window.t('drawer_sending') : window.t('drawer_send')}
          </button>
        </div>
      </div>
    </>
  );

  const deleteBtn = onDelete && canManageTasks && (
    confirmDelete ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--status-rose)', borderColor: 'var(--status-rose)' }}
          onClick={() => { onDelete(task.id); setConfirmDelete(false); }}>
          {window.t('drawer_delete')}
        </button>
        <button className="icon-btn" title={window.t('drawer_cancel')} onClick={() => setConfirmDelete(false)}>
          <Icon name="x" size={13} />
        </button>
      </div>
    ) : (
      <button className="icon-btn" title={window.t('drawer_delete')} onClick={() => setConfirmDelete(true)}>
        <Icon name="trash" size={14} />
      </button>
    )
  );

  if (pageMode) {
    return (
      <div className="task-page">
        <div className="task-page-head">
          <button className="task-page-back" onClick={onClose}>
            <Icon name="chevronLeft" size={14} />
            {window.t('board_view_kanban') || 'Board'}
          </button>
          <div className="task-page-crumbs">
            <Icon name="chevronRight" size={11} style={{ color: 'var(--ink-faint)' }} />
            <span>{col.title_tr}</span>
          </div>
          <div className="task-page-head-actions">
            <button className="icon-btn" title={window.t('drawer_duplicate')} onClick={handleDuplicate} disabled={duplicating}>
              <Icon name="copy" size={15} />
            </button>
            {deleteBtn}
          </div>
        </div>
        <div className="task-page-body">
          {bodyContent}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="drawer-overlay" data-open={open} onClick={onClose} />
      <div className="drawer" data-open={open} ref={panelRef}>
        {/* Jest bölgesi başlığı da kapsıyor: kullanıcı çubuğu tam
            yakalayamadığında başlıktan çekmesi de çalışsın. Başlıktaki
            düğmeler etkilenmiyor — eşik hareket istiyor, dokunup bırakmak
            jesti tetiklemiyor ve `preventDefault` çağrılmadığı için tıklama
            olayları normal akıyor. */}
        <div className="drawer-drag" {...jestOzellikleri}>
          {/* Tutamak yalnızca dokunmatik cihazda görünüyor (CSS). Görünmez bir
              jest, olmayan bir jesttir: kullanıcı çubuğu görünce çekilebildiğini
              anlıyor. */}
          <div className="drawer-grab" aria-hidden="true"><span /></div>
          <div className="drawer-head">
            <div className="drawer-crumbs">
              <span>StoaBoard Web</span>
              <span className="sep"><Icon name="chevronRight" size={11} /></span>
              <span style={{ color: 'var(--ink)' }}>{col.title_tr}</span>
              {/* Kart numarası — Ayarlar → Görünüm → Geliştirici ile açılıyor.
                  Kırıntı satırının sonunda, çünkü çalışırken göz zaten orada. */}
              {tweaks.showCardIds && (
                <span className="card-id" title={window.t?.('board_card_id') || 'Kart numarası'}>
                  #{task.id}
                </span>
              )}
            </div>
            <div className="drawer-head-actions">
              <button className="icon-btn" title={window.t('drawer_duplicate')} onClick={handleDuplicate} disabled={duplicating}>
                <Icon name="copy" size={15} />
              </button>
              {onOpenPage && (
                <button className="icon-btn drawer-fullscreen-btn" title={window.t('drawer_fullscreen')} onClick={() => onOpenPage(task)}>
                  <Icon name="expand" size={14} />
                </button>
              )}
              {deleteBtn}
              <button className="icon-btn" title={window.t('drawer_close')} onClick={onClose}><Icon name="x" size={15} /></button>
            </div>
          </div>
        </div>

        <div className="drawer-body">{bodyContent}</div>
      </div>
    </>
  );
}

// ── Doc block renderer / editor ─────────────────────────────────────────────
//
// Notion-lite, faz 1 (15 Eylül 2026). Tek metinli bloklar (başlık, alt
// başlık, paragraf, alıntı, kod, uyarı kutusu) yerinde düzenlenir:
// contentEditable, kutu yok, düğme yok, kayıt odak kaybında, Escape vazgeçer.
//   Enter            → ardına yeni paragraf (kod bloğunda satır sonu)
//   Backspace (boş)  → bloğu kaldır, odak öncekine
//   "/" (boş blokta) → tür menüsü
//   ↑ / ↓ (kenarda)  → önceki / sonraki blok
// Liste (`ul`) bu fazda yalnızca çizilir; düzenleyicisi faz 2. Metin her
// zaman React metni olarak çizilir, HTML asla — güvenlik sınırı sunucuda
// değil burada (lib/doc.js başındaki not).

const DOC_MENU = [
  { kind: 'p',       k: 'doc_kind_p',       fb: 'Paragraf' },
  { kind: 'h2',      k: 'doc_kind_h2',      fb: 'Başlık' },
  { kind: 'h3',      k: 'doc_kind_h3',      fb: 'Alt başlık' },
  { kind: 'quote',   k: 'doc_kind_quote',   fb: 'Alıntı' },
  { kind: 'pre',     k: 'doc_kind_pre',     fb: 'Kod' },
  { kind: 'callout', k: 'doc_kind_callout', fb: 'Uyarı kutusu' },
];
const DOC_TAG = { h1: 'h2', h2: 'h2', h3: 'h3', p: 'p', quote: 'blockquote', pre: 'pre', callout: 'div' };

function _caretAtEdge(el) {
  const sel = window.getSelection?.();
  if (!sel || !sel.rangeCount) return { start: true, end: true };
  const r = sel.getRangeAt(0);
  const pre = r.cloneRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  const post = r.cloneRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
  return { start: pre.toString().length === 0, end: post.toString().length === 0 };
}

function DrawerDocBlock({ block, index, onUpdate, onEnter, onRemove, onConvert, onMove }) {
  const [dirty, setDirty] = useDrawerState(false);
  const [saved, setSaved] = useDrawerState(false);
  const [menuOpen, setMenuOpen] = useDrawerState(false);
  const [menuIdx, setMenuIdx] = useDrawerState(0);
  const ref = useDrawerRef(null);

  // Liste: yalnızca çizim (faz 2'de düzenlenir).
  if (block.kind === 'ul') return <ul>{(block.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>;
  if (block.kind === 'checklist') return null;

  const Tag = DOC_TAG[block.kind] || 'p';
  const text = block._i18n ? (window.t?.(block._i18n) || block.text) : (block.text || '');
  const editable = !!onUpdate;

  const commit = async (el) => {
    const t = el.textContent ?? '';
    const t2 = block.kind === 'pre' ? t.replace(/\s+$/, '') : t.trim();
    if (!dirty || t2 === (block.text || '')) { setDirty(false); return; }
    setDirty(false);
    const ok = await onUpdate(t2);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1400); }
  };

  const onKeyDown = (e) => {
    const el = e.currentTarget;
    const empty = (el.textContent || '').trim() === '';
    if (menuOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIdx(i => (i + 1) % DOC_MENU.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMenuIdx(i => (i - 1 + DOC_MENU.length) % DOC_MENU.length); return; }
      if (e.key === 'Enter')     { e.preventDefault(); setMenuOpen(false); onConvert?.(DOC_MENU[menuIdx].kind); return; }
      if (e.key === 'Escape')    { e.preventDefault(); setMenuOpen(false); return; }
      // Menü açıkken yazılan her şey menüyü kapatır; "/" karakteri bloğa girmemişti.
      setMenuOpen(false);
    }
    if (e.key === '/' && empty && onConvert) { e.preventDefault(); setMenuIdx(0); setMenuOpen(true); return; }
    if (e.key === 'Escape') {
      el.textContent = block.text || '';
      setDirty(false);
      el.blur();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && block.kind !== 'pre' && onEnter) {
      e.preventDefault();
      // Önce bu bloğun metni kaydedilsin, sonra yeni blok açılsın; iki ayrı
      // PATCH ama sıralı — aksi hâlde ikinci kayıt ilkinin metnini ezerdi.
      Promise.resolve(commit(el)).then(() => onEnter());
      return;
    }
    if (e.key === 'Backspace' && empty && onRemove) { e.preventDefault(); onRemove(); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && onMove && block.kind !== 'pre') {
      const edge = _caretAtEdge(el);
      if (e.key === 'ArrowUp' && edge.start)  { e.preventDefault(); commit(el); onMove(-1); }
      if (e.key === 'ArrowDown' && edge.end)  { e.preventDefault(); commit(el); onMove(1); }
    }
  };

  const props = editable ? {
    contentEditable: true,
    suppressContentEditableWarning: true,
    'data-editable': true,
    'data-block-index': index,
    'data-placeholder': window.t?.('doc_placeholder') || "Yazmaya başla, tür için “/”",
    onInput: () => setDirty(true),
    onBlur: (e) => commit(e.currentTarget),
    onKeyDown,
    style: { outline: 'none', cursor: 'text' },
  } : { 'data-block-index': index };

  return (
    <div className="doc-block" style={{ position: 'relative' }}>
      <Tag
        className={block.kind === 'callout' ? 'doc-callout' : undefined}
        data-role={block._i18n ? 'section' : undefined}
        {...props}
      >{text}</Tag>
      {saved && (
        <span aria-live="polite" className="doc-saved">{window.t?.('notes_saved') || 'Kaydedildi'}</span>
      )}
      {menuOpen && (
        <div className="doc-slash-menu" role="listbox">
          {DOC_MENU.map((m, i) => (
            <button key={m.kind} type="button" role="option" aria-selected={i === menuIdx}
              className={`doc-slash-item${i === menuIdx ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setMenuOpen(false); onConvert?.(m.kind); }}>
              {window.t?.(m.k) || m.fb}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Kontrol listesi bloklarını ayıklar. Saklı doc'lardaki bloklar (ve önlerindeki
// üretilmiş başlık) `scripts/altgorev-gocu.js` ile bir kez temizlendi; bu
// yalnızca eski bir sekmenin göçten önce yazdığı blok ekrana düşmesin diye.
// Başlık eşleştirmesi bilerek burada yok — o iş sunucudaki
// `docKontrolListesiz`in (lib/checklist.js).
function _kontrolListesiz(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.filter(b => b?.kind !== 'checklist');
}

// Known i18n keys by their possible stored text values (legacy fix for docs saved in Turkish)
const _DOC_I18N_MAP = {
  'Açıklama': 'drawer_description',
  'Description': 'drawer_description',
  'Beschreibung': 'drawer_description',
};

function _patchDocI18n(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map(b => {
    if ((b.kind === 'h2' || b.kind === 'h3') && !b._i18n && _DOC_I18N_MAP[b.text]) {
      return { ...b, _i18n: _DOC_I18N_MAP[b.text] };
    }
    return b;
  });
}

// Generate basic doc from task description when no stored doc
//
// KUSUR (17 Eylül 2026, kullanıcı): "kartta açıklama girince çok karmaşık
// görünüyor... karta işlenince text area olur da rastgele yazarsın, bir nizam
// yoktur." Ölçüldü ve haklıydı: metnin YAPISI KAYITTA VARDI, ekranda yoktu.
//
// Açıklamanın TAMAMI tek bir `p` bloğuna giriyordu, satır sonlarıyla birlikte.
// HTML'de `\n` boşluğa çöktüğü için başlıklar, madde imleri ve ayraçlar tek
// bir paragrafa akıyordu — MCP ile yazılmış uzun kart açıklamaları okunamaz
// hâldeydi. Veri hiç bozulmamıştı; kayıp yalnızca çizimdeydi.
//
// İki ayrı düzeltme gerekiyor ve ikisi farklı şeyi kurtarıyor:
//   1) BURASI — boş satır PARAGRAF sınırıdır, ayrı bloklara ayrılıyor. Blok
//      aralığı tipografiden geliyor, metne gömülü boşluktan değil.
//   2) `styles.css`, `white-space: pre-wrap` — blok İÇİNDEKİ tek satır sonları
//      (madde imi listeleri, ayraç satırları) korunuyor.
// Yalnızca biri yapılırsa yarım kalır: (1)siz liste tek satıra akar, (2)siz
// paragraflar birbirine yapışır.
function _basicDoc(task) {
  const doc = [];
  if (task?.desc) {
    doc.push({ kind: 'h2', text: window.t?.('drawer_description') || 'Description', _i18n: 'drawer_description' });
    // Kural `belge.js`te ve saf: sunucu testi onu doğrudan içe aktarıp
    // davranışı ölçüyor, kaynak taramak gerekmiyor.
    for (const p of paragraflaraBol(task.desc)) doc.push({ kind: 'p', text: p });
  }
  if (!doc.length) {
    doc.push({ kind: 'p', text: window.t?.('drawer_no_description') || 'Bu kart için henüz detaylı açıklama eklenmedi.' });
  }
  return doc;
}

export { TaskDrawer };
