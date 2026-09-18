// Main app — API-backed with real-time chat

import React, { useState as useS, useEffect as useEf, useRef as useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { Icon } from './icons.jsx';
import { API, renderNotifText, htmlCoz } from './data.jsx';
import { Sidebar, Topbar, ToastContainer } from './shell.jsx';
import { AddTaskModal } from './modals.jsx';
import { TaskDrawer } from './drawer.jsx';
import { NotifPanel, notifType } from './notifications.jsx';
import { yeniOkunmamisSayisi, sonBakisOku, sonBakisYaz, panelGorunur } from './rozet.js';
import { durumdanYol, yoldanDurum, girisNoktasiMi, HUKUKI_YOLLAR, hatirlananGorunumuOku,
  girisSonrasiKaydet, girisSonrasiOku, girisSonrasiSil, baslangicYolu,
  projeyiHatirla, hatirlananProje } from './rota.js';
import { komsuKartlar } from './komsu.js';
import { CommandPalette } from './palette.jsx';
import { ErrorBoundary } from './error-boundary.jsx';
import { TweaksPanel } from './tweaks.jsx';
import { ChatPanel } from './chat.jsx';
import { AuthPage, WorkspaceSetupPage } from './views/auth.jsx';
import { BoardView } from './views/board.jsx';
import { LegalPage } from './views/legal.jsx';

// Açılış-dışı ağır görünümler tembel yükleniyor. Açılış görünümü daima 'board';
// aşağıdakilerin hiçbiri ilk boyada gerekmiyor, yalnızca ilgili sekmeye
// girildiğinde iniyorlar. Ana paketten ayrılınca ilk açılış küçülüyor.
// Hepsi named export olduğu için React.lazy'nin beklediği default'a sarılıyor.
const lazyView = (loader, name) =>
  React.lazy(() => loader().then((m) => ({ default: m[name] })));

const ReportsView   = lazyView(() => import('./views/reports.jsx'),   'ReportsView');
const NotesView     = lazyView(() => import('./views/notes.jsx'),     'NotesView');
const SettingsView  = lazyView(() => import('./views/settings.jsx'),  'SettingsView');
const CalendarView  = lazyView(() => import('./views/calendar.jsx'),  'CalendarView');
const DashboardView = lazyView(() => import('./views/dashboard.jsx'), 'DashboardView');
const TrashView     = lazyView(() => import('./views/trash.jsx'),     'TrashView');

// Tembel görünümleri saran ortak Suspense — parça inerken kısa yükleme çubuğu.
function Lazy({ children }) {
  return (
    <React.Suspense fallback={<div className="loading-bar-wrap"><div className="loading-bar" /></div>}>
      {children}
    </React.Suspense>
  );
}

function _playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx  = new Ctx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.28);
    osc.onended = () => ctx.close();
  } catch (e) {}
}

function App() {
  const [authed, setAuthed]                 = useS(false);
  const [loading, setLoading]               = useS(true);
  const [needsWorkspace, setNeedsWorkspace] = useS(false);
  const [view, setView]                     = useS(() => {
    const path = window.location.pathname;
    if (path === '/gizlilik-sartlari') return 'gizlilik-sartlari';
    if (path === '/hizmet-sartlari') return 'hizmet-sartlari';

    // Adres bir görünümü söylüyorsa o kazanıyor (kart #228): yenilenen ya da
    // paylaşılan bağlantı doğru ekranı açmalı. Söylemiyorsa (kök, giriş,
    // tanınmayan adres) bugünkü gibi son ekran hatırlanıyor.
    // Açılış adresi uygulama içiyse sekmeye hedef olarak yazılıyor (#248):
    // misafirse adres birazdan /giris olacak ve kart ancak buradan bulunur.
    girisSonrasiKaydet(path);
    const adresten = yoldanDurum(baslangicYolu(path, girisSonrasiOku()));
    if (adresten) return adresten.gorunum;

    // Tek okuyucu (rota.js): eski 'list' göçü ve geçersiz kayıt orada.
    return hatirlananGorunumuOku();
  });
  const [tasks, setTasks]                   = useS([]);
  const [currentProject, setCurrentProject] = useS(null);
  const [drawerTask, setDrawerTask]         = useS(null);
  // Görev drawer'ı kapanınca dönülecek görünüm. Raporlardan bir göreve
  // tıklanınca pano açılıp kart drawer'ı geliyor; drawer kapanınca kullanıcı
  // panoda kalmak yerine geldiği rapora dönsün diye tutuluyor.
  const [taskReturnView, setTaskReturnView] = useS(null);
  const [taskPageTask, setTaskPageTask]     = useS(null);
  const [modalOpen, setModalOpen]           = useS(false);
  const [modalCol, setModalCol]             = useS('todo');
  const [modalInitialDates, setModalInitialDates] = useS(null);
  const [cmdOpen, setCmdOpen]               = useS(false);
  const [notifOpen, setNotifOpen]           = useS(false);
  const [preNotifView, setPreNotifView]     = useS('dashboard');
  const [chatOpen, setChatOpen]             = useS(false);
  const [chatDmWith, setChatDmWith]         = useS(null);
  const [chatChannel, setChatChannel]       = useS(null);
  const [chatHighlightMsgId, setChatHighlightMsgId] = useS(null);
  const [onlineUsers, setOnlineUsers]       = useS(new Map()); // slug → status
  const [members, setMembers]               = useS([]);
  const [isOwner, setIsOwner]               = useS(false);
  const [projectModal, setProjectModal]     = useS(false);
  const [tweaksAvailable, setTweaksAvailable] = useS(false);
  const [socket, setSocket]                 = useS(null);
  const [workspaces, setWorkspaces]         = useS([]);
  const [wsSwitcherOpen, setWsSwitcherOpen] = useS(false);
  const [wsJoinModalOpen, setWsJoinModalOpen] = useS(false);
  const [wsJoinInitialCode, setWsJoinInitialCode] = useS('');
  const [wsLogoUrl, setWsLogoUrl]           = useS(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useS(false);
  const [projectSwitching, setProjectSwitching]   = useS(false);
  const [trashTasks, setTrashTasks]               = useS([]);
  const [trashNotes, setTrashNotes]               = useS([]);
  const switchAbortRef = useRef(null);

  const activityTimer  = useRef(null);
  const currentStatus  = useRef('online');
  const autoAwayStatus = useRef(false);
  const manualAwayStatus = useRef(false);
  const pendingGTimer  = useRef(null);
  const [myStatusState, setMyStatusState] = useS('online');
  const [notifCount, setNotifCount]       = useS(0);
  // İKİ AYRI SAYI, çünkü iki ayrı soruya cevap veriyorlar:
  //   notifCount  — son bakıştan SONRA gelen okunmamışlar → rozet
  //   notifUnread — hâlâ okunmamış olanların tamamı       → nokta
  // Zile bakmak "okudum" demek değil; okumak ayrı bir eylem (kart #242).
  const [notifUnread, setNotifUnread]     = useS(0);
  // Rozet "son bakıştan beri gelen okunmamış" sayar (rozet.js). Paneli
  // açan/kapatan her yol buradan geçer: yerel sayaç sıfırlanır VE bakış anı
  // tarayıcıya yazılır. Önceden beş ayrı `setNotifCount(0)` vardı, hiçbiri
  // kalıcı bir şey yazmıyordu; sonraki girişte rozet geri geliyordu.
  const rozetBakildi = () => {
    sonBakisYaz(localStorage, window.CURRENT_USER?.id);
    setNotifCount(0);
  };
  const [notesCount, setNotesCount]       = useS(0);
  const [currentWsId, setCurrentWsId]   = useS(() => window.DATA?.WORKSPACE?.id || null);

  const [unreadCounts, setUnreadCounts] = useS(() => {
    try { return JSON.parse(localStorage.getItem('stoa.unread') || '{}'); }
    catch { return {}; }
  });

  const [tweaks, setTweaks] = useS(() => {
    const saved = localStorage.getItem('stoa.tweaks');
    const initial = saved ? JSON.parse(saved) : (window.__TWEAKS__ || {});
    return initial.fontPair === 'instrument' ? { ...initial, fontPair: 'sans' } : initial;
  });

  const setTweak = (key, value) => {
    setTweaks(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('stoa.tweaks', JSON.stringify(next));
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*'); } catch (e) {}
      return next;
    });
  };

  // ── Global translation fn — always current before any child renders ─────────
  const _appLang = tweaks.locale || localStorage.getItem('stoa.lang') || 'tr';
  window.t = (key) => (window.APP_I18N?.[_appLang] || window.APP_I18N?.tr || {})[key] || (window.APP_I18N?.tr || {})[key] || key;

  // Belge dili de arayüz dilini izlemeli. index.html'de sabit lang="tr" yazıyor
  // ve hiçbir yer güncellemiyordu: İngilizce arayüzde sayfa Türkçe ilan
  // ediliyordu. Ekran okuyucu telaffuzu, tarayıcının çeviri önerisi ve metin
  // alanlarındaki yazım denetimi bu özniteliğe bakıyor.
  if (typeof document !== 'undefined') document.documentElement.lang = _appLang;

  const myMember = members.find(m => m.id === window.CURRENT_USER?.id) || {};
  const myPerms = myMember.role_permissions || [];
  const canManageTasks = isOwner || myPerms.includes('manage_tasks');
  const canManageProjects = isOwner || myPerms.includes('manage_projects');
  const canManageChannels = isOwner || myPerms.includes('manage_channels');
  const canDeleteMessages = isOwner || myPerms.includes('delete_messages');
  const canManageWorkspace = isOwner || myPerms.includes('manage_workspace');

  // Adres çubuğu ile ekranın eşitlenmesi.
  //
  // KUSUR (17 Eylül 2026, mobil saha turu, kart #192): giriş ekranında dili
  // değiştiren kullanıcı vitrine düşüyordu. Zinciri kuran şey buradaydı.
  //
  // Koşul `view === 'auth'` yazılmıştı ama `setView('auth')` HİÇBİR YERDE
  // çağrılmıyor — giriş ekranı `view` ile değil `authed` bayrağıyla açılıyor
  // (aşağıda `if (!authed)`). Yani o dal ÖLÜ KOD'du ve giriş ekranındaki
  // kullanıcı `else` dalına düşüyordu: `view` varsayılanı 'board' olduğu için
  // adres `/giris` iken sessizce `/` yapılıyordu.
  //
  // Tek başına görünmezdi — pushState sayfayı yeniden yüklemiyor, ekran giriş
  // ekranı olarak kalıyor. Ama `switchLang` (`views/auth.jsx`) dili yazdıktan
  // sonra `location.reload()` çağırıyor ve o an yüklenen adres artık `/`.
  // Oturum yokken `/` vitrini veriyor (app.js, 6c9b60a). Kullanıcı akıştan
  // çıkıyor, dil ise gerçekten değişmiş oluyor — kartta tarif edilen tam bu.
  //
  // Ölçüt artık `authed`, yani ekranı açan bayrağın kendisi: aynı olgunun iki
  // okuyucusu kalmadı.
  //
  // `loading` kapısı şart: önyükleme bitene kadar `authed` false, ve o aralıkta
  // adres yazılırsa GİRİŞ YAPMIŞ kullanıcı da bir an `/giris`e itilir, sonra
  // `/`ye geri döner. İki sahte geçmiş kaydı kalır ve geri tuşu kullanıcıyı
  // giriş ekranına atar. Kimlik bilinmeden adres yazılmaz.
  useEf(() => {
    if (loading) return;
    if (view === 'gizlilik-sartlari' || view === 'hizmet-sartlari') {
      if (window.location.pathname !== `/${view}`) {
        window.history.pushState({}, '', `/${view}`);
      }
    } else if (!authed) {
      // Giriş ekranının adresi /giris: kök artık misafire vitrini veriyor
      // (app.js). Sorgu korunuyor ki ?join=KOD ve ?kayit=1 kaybolmasın.
      //
      // Hukuki sayfadan gelinmediyse kayıt DEĞİŞTİRİLİYOR, eklenmiyor (#248):
      // misafirin gördüğü /pano/kart/193 değil giriş ekranı. Eklenseydi geri
      // tuşu o adrese döner, adres yine /giris'e itilir ve misafir geri
      // tuşuyla siteden bile çıkamazdı. Hukuki sayfadan gelen ise oraya geri
      // dönebilmeli.
      const simdiki = window.location.pathname;
      if (simdiki !== '/giris') {
        const yaz = HUKUKI_YOLLAR.has(simdiki) ? 'pushState' : 'replaceState';
        window.history[yaz]({}, '', `/giris${window.location.search}`);
      }
    } else {
      localStorage.setItem('stoa.view', view);
      // ── Görünüm başına adres (kart #228) ──────────────────────────────
      //
      // Adres DURUMDAN türetiliyor ve durum adresle zaten eşleşiyorsa hiçbir
      // şey yazılmıyor. Geri/ileri tuşundan gelen değişiklik bu yüzden
      // döngüye girmiyor: popstate önce durumu adrese eşitliyor, bu etki de
      // eşitliği görüp çekiliyor. Ayrı bir "popstate'ten mi geldi" bayrağı
      // yok — öyle bir bayrak, etki çalışmadığı turda takılı kalırdı.
      if (bekleyenGeri.current || bekleyenKart.current) return;
      const kartId = drawerTask?.id ?? taskPageTask?.id ?? null;
      const hedef = durumdanYol(view, kartId);
      const simdiki = window.location.pathname;
      if (simdiki === hedef) return;

      // Kart ARAYÜZDEN kapandı (X, Esc, silme) ve o kaydı BİZ ekledik: geri
      // git. Yoksa adres /pano'ya itilir, geçmiş "pano, kart, pano" olur ve
      // bir sonraki geri tuşu az önce kapatılan kartı YENİDEN açar.
      // Karta doğrudan bağlantıyla gelinmişse kaydı biz eklemedik; geri gitmek
      // siteden çıkarırdı — o zaman yalnızca adres değiştiriliyor.
      if (!kartId && window.history.state?.kartItildi) {
        bekleyenGeri.current = true;
        window.history.back();
        return;
      }

      // Karttan karta geçiş (kart #246): kayıt DEĞİŞTİRİLİR, eklenmez. Aynı
      // kolonda on kart gezip X'e basan kullanıcı panoya dönmeli; her geçiş
      // kayıt ekleseydi geri tuşu onu kart kart geriye yürütürdü ve X'in
      // back() çağrısı da panoya değil bir önceki karta düşerdi. Tek kayıt:
      // "pano, kart". `kartItildi` korunuyor — doğrudan bağlantıyla gelinen
      // kart geçişle "bizim eklediğimiz" kayda dönüşmez, back() siteden
      // çıkarmaya devam ederdi.
      if (kartId && yoldanDurum(simdiki)?.kart) {
        window.history.replaceState({ kart: String(kartId), kartItildi: !!window.history.state?.kartItildi }, '', hedef);
        return;
      }

      const durum = kartId ? { kart: String(kartId), kartItildi: true } : {};
      if (girisNoktasiMi(simdiki)) {
        // Kök, giriş ve tanınmayan adresler DEĞİŞTİRİLİR, eklenmez: yoksa geri
        // tuşu kullanıcıyı bir kez daha `/`ye ya da giriş ekranına götürür.
        window.history.replaceState(kartId ? { kart: String(kartId) } : {}, '', hedef);
      } else {
        window.history.pushState(durum, '', hedef);
      }
    }
  }, [view, authed, loading, drawerTask?.id, taskPageTask?.id]);

  // Geri tuşunun beklenen dönüşü sürerken adres etkisi yazmıyor: back()
  // eşzamansız ve arada ikinci bir back() çağrılırsa kullanıcı bir ekran fazla
  // geri gider. Aynı şekilde adresten açılmayı bekleyen kart varken de yazmıyor
  // — kart sunucudan gelene kadar durum "pano, kart yok" görünür ve etki
  // adresi /pano'ya ezerdi.
  const bekleyenGeri = useRef(false);
  // Adresten BAŞLATILIYOR, etkiden değil: ilk yüklemede adres etkisi "kartı aç"
  // etkisinden ÖNCE çalışıyor ve o anda kart açık olmadığı için /pano/kart/5'i
  // /pano ile ezerdi — derin bağlantı kaybolurdu. Render sırasında dolu olunca
  // etki bekliyor.
  // Misafir kart bağlantısıyla geldiyse adres /giris olur; kart sekmedeki
  // hedeften okunuyor (#248), yoksa giriş anında adres etkisi beklemez.
  const bekleyenKart = useRef(yoldanDurum(baslangicYolu(window.location.pathname, girisSonrasiOku()))?.kart || null);

  // Adresteki kartı aç. Başarısızsa (silinmiş, erişim yok) adres panoya
  // çekiliyor — kullanıcı açılmayan bir kartın adresinde kalmasın.
  const adrestekiKartiAc = (kartId) => {
    bekleyenKart.current = kartId;
    const ac = window.__OPEN_TASK_BY_ID__;
    Promise.resolve(ac ? ac(kartId) : false).then((acildi) => {
      bekleyenKart.current = null;
      if (!acildi) window.history.replaceState({}, '', durumdanYol('board'));
    });
  };

  // İlk yükleme: adres bir kart söylüyorsa, önyükleme bitince aç.
  useEf(() => {
    if (loading || !authed) return;
    //
    // Misafir kart adresiyle geldiyse adres artık /giris; hedef sekmede
    // bekliyor (#248). Tek kullanımlık: okunur okunmaz siliniyor, yoksa
    // sonraki bir girişte beklenmedik bir kart açılırdı.
    const adresten = yoldanDurum(baslangicYolu(window.location.pathname, girisSonrasiOku()));
    girisSonrasiSil();
    // Görünüm de hedefe eşitleniyor: misafir girişten önce hukuki sayfayı açıp
    // kapattıysa görünüm hatırlanan ekrana dönmüş olabilir.
    if (adresten) setView(adresten.gorunum);
    if (adresten?.kart) {
      adrestekiKartiAc(adresten.kart);
    } else {
      // Bekleyen kart temizlenmezse adres etkisi sonsuza kadar beklerdi.
      bekleyenKart.current = null;
    }
  }, [loading, authed]);

  useEf(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      bekleyenGeri.current = false;
      if (HUKUKI_YOLLAR.has(path)) {
        setView(path.slice(1));
        return;
      }
      const adresten = yoldanDurum(path);
      if (adresten) {
        setView(adresten.gorunum);
        if (adresten.kart) {
          adrestekiKartiAc(adresten.kart);
        } else {
          // Geri tuşu kartı KAPATIYOR — kararın kendisi.
          setDrawerTask(null);
          setTaskPageTask(null);
        }
      } else {
        setView(hatirlananGorunumuOku());
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  useEf(() => { document.documentElement.dataset.theme    = tweaks.theme;    }, [tweaks.theme]);
  useEf(() => { document.documentElement.dataset.accent   = tweaks.accent;   }, [tweaks.accent]);
  useEf(() => { document.documentElement.dataset.fontpair = tweaks.fontPair; }, [tweaks.fontPair]);
  useEf(() => { document.documentElement.dataset.density  = tweaks.density;  }, [tweaks.density]);
  // Özel vurgu rengi: seçilen hex `--accent-custom` olarak veriliyor, `--accent`
  // olarak DEĞİL (kart #210). `--accent` doğrudan satır içi yazılınca CSS'in
  // koyu tema kuralı ona hiç dokunamıyordu: hazır altı renk koyu zeminde
  // açılıyor (L %68-72), özel renk olduğu gibi kalıyordu — koyu bir seçim
  // koyu zeminde okunmuyordu. Ham değer ayrı değişkende durunca kural CSS'te
  // tek yerden uygulanıyor (styles.css, [data-accent="custom"]).
  useEf(() => {
    const root = document.documentElement;
    if (tweaks.accent === 'custom' && tweaks.accentHex) {
      root.style.setProperty('--accent-custom', tweaks.accentHex);
    } else {
      root.style.removeProperty('--accent-custom');
    }
  }, [tweaks.accent, tweaks.accentHex]);

  useEf(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')        setTweaksAvailable(true);
      else if (e.data?.type === '__deactivate_edit_mode') setTweaksAvailable(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
    return () => window.removeEventListener('message', handler);
  }, []);

  // Listen for cross-component "go to settings" event (from NotifPanel preferences shortcut)
  useEf(() => {
    const handler = () => setView('settings');
    window.addEventListener('stoa:gotoSettings', handler);
    return () => window.removeEventListener('stoa:gotoSettings', handler);
  }, []);

  // Auto-close slide-out chat popup whenever the active view changes
  // (especially when user navigates to the full-page chat route)
  useEf(() => {
    if (!chatOpen) return;
    setChatOpen(false);
    setChatDmWith(null);
    setChatHighlightMsgId(null);
    window.__CHAT_OPEN__ = false;
  }, [view]);

  // Keyboard shortcuts
  useEf(() => {
    const isEditing = () => {
      const ae = document.activeElement;
      return ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable;
    };
    const clearG = () => { clearTimeout(pendingGTimer.current); pendingGTimer.current = null; };
    // G+key navigation. 'l' (list) and 'b' (board) both go to board view; list sets sub-view.
    const G_MAP = { b: 'board', l: 'board', c: 'calendar', d: 'dashboard', s: 'settings', m: 'chat', n: 'notes', r: 'reports', t: 'trash' };

    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); clearG(); setCmdOpen(true); return; }
      if (e.key === 'Escape') {
        clearG();
        setDrawerTask(null); setModalOpen(false); setCmdOpen(false);
        setNotifOpen(false); setChatOpen(false); setProjectModal(false);
        setWsSwitcherOpen(false);
        return;
      }
      if (isEditing()) return;

      // Second key of a G+key sequence
      if (pendingGTimer.current !== null) {
        clearG();
        const k = e.key.toLowerCase();
        const dest = G_MAP[k];
        if (dest) {
          e.preventDefault();
          if (k === 'l') localStorage.setItem('stoa.boardSubView', 'list');
          else if (k === 'b') localStorage.setItem('stoa.boardSubView', 'kanban');
          setView(dest);
        }
        return;
      }

      if (e.key?.toLowerCase() === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        pendingGTimer.current = setTimeout(clearG, 600);
        return;
      }

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        if (canManageTasks) openModal('todo');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearG(); };
  }, [canManageTasks]);

  // ── Auth + bootstrap on mount ────────────────────────────────────────────
  useEf(() => {
    API.me()
      .then(() => onyukle())
      .then((data) => {
        if (data.needs_workspace) {
          window.CURRENT_USER = data.user;
          setAuthed(true); setNeedsWorkspace(true); setLoading(false);
          return;
        }
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setAuthed(true); setNeedsWorkspace(false); setLoading(false);
        // Auto-open join modal if ?join= param in URL
        try {
          const joinCode = new URLSearchParams(window.location.search).get('join');
          if (joinCode) {
            setWsJoinInitialCode(joinCode);
            setWsJoinModalOpen(true);
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (_) {}
      })
      .catch(() => { setAuthed(false); setLoading(false); });
  }, []);

  // ── Socket.IO connection ─────────────────────────────────────────────────
  useEf(() => {
    if (!authed || needsWorkspace) return;
    const sock = io({ transports: ['websocket', 'polling'] });
    window.SOCKET = sock;
    setSocket(sock);

    sock.on('online_users', ({ users }) => _applyOnlineUsers(users));
    sock.on('user_online',  ({ user, status }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.set(user, status || 'online'); return n;
    }));
    sock.on('user_offline', ({ user }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.delete(user); return n;
    }));
    sock.on('user_status',  ({ user, status }) => setOnlineUsers(prev => {
      const n = new Map(prev); n.set(user, status); return n;
    }));
    sock.on('member_joined', ({ member }) => {
      setMembers(prev => {
        if (prev.find(m => m.id === member.id)) return prev;
        const next = [...prev, member];
        window.DATA.MEMBERS = next;
        return next;
      });
    });
    // Olay yeni alanın kimliğini taşıyor: o alanda en son açık proje gelsin.
    sock.on('workspace_switched', ({ workspace_id } = {}) => {
      onyukle(workspace_id).then(data => {
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.workspaces) setWorkspaces(data.workspaces);
      }).catch(() => {});
    });
    sock.on('join_request_approved', ({ workspace_id }) => {
      window.showToast?.(window.t('app_join_approved'), 'success');
      handleSwitchWorkspace(workspace_id);
    });
    sock.on('join_request_rejected', () => {
      window.showToast?.(window.t('app_join_rejected'), 'error');
    });
    sock.on('member_removed', ({ id }) => {
      setMembers(prev => {
        const next = prev.filter(m => m.id !== id);
        window.DATA.MEMBERS = next;
        return next;
      });
    });
    sock.on('member_role_changed', (updatedMember) => {
      setMembers(prev => {
        const next = prev.map(m => m.id === updatedMember.id ? { ...m, ...updatedMember } : m);
        window.DATA.MEMBERS = next;
        return next;
      });
    });

    // Notes count maintenance (NotesView keeps its own list; we mirror count here)
    sock.on('note_created', (note) => {
      if (!note) return;
      if (note.actor === window.CURRENT_USER?.slug) return;
      setNotesCount(c => c + 1);
    });
    sock.on('note_deleted', (payload) => {
      if (!payload) return;
      if (payload.actor === window.CURRENT_USER?.slug) return;
      setNotesCount(c => Math.max(0, c - 1));
    });

    // ── Pano gerçek zamanlı (kart #235) ──────────────────────────────────
    //
    // 17 Eylül 2026'da ölçüldü: `routes/projects.js` ve `routes/tasks.js` tek
    // bir soket olayı yayınlamıyordu ve istemci de hiçbir pano olayı
    // dinlemiyordu. Kart eklemek, taşımak, kolon açmak, yorum yazmak — hiçbiri
    // karşı tarafa canlı gitmiyordu. Sohbet gidiyordu, çünkü onun kendi soket
    // yolu vardı. Kullanıcının cümlesi teşhisin kendisiydi: "sohbet anlık
    // gelirken kolon, comment F5 istiyor GÖRÜNMEK için."
    //
    // YANKI ELEMESİ: eylemi yapanın ekranı zaten iyimser güncellendi; kendi
    // yankısını uygulamak kart listesini iki kez oynatır ve sürüklerken
    // titreme yaratır. Sunucu her gövdeye `actor` koyuyor.
    //
    // PROJE SÜZGECİ: `tasks` yalnızca AKTİF projenin kartlarını tutuyor. Başka
    // projedeki bir kartı listeye eklemek panoyu sessizce yanlış yapardı —
    // ekranda görünür ama hiçbir kolona ait değil.
    const benimYankim = (actor) => actor && actor === window.CURRENT_USER?.slug;
    const aktifProjede = (t) => String(t?.project_id) === String(window.CURRENT_PROJECT_ID);

    sock.on('task_created', ({ task, actor }) => {
      if (!task || benimYankim(actor) || !aktifProjede(task)) return;
      // Kimlik elemesi: geri alma da bu olayı kullanıyor ve kart listede
      // duruyor olabilir.
      setTasks(prev => (prev.some(t => String(t.id) === String(task.id))
        ? prev.map(t => (String(t.id) === String(task.id) ? { ...t, ...task } : t))
        : [task, ...prev]));
    });

    sock.on('task_updated', ({ task, actor }) => {
      if (!task || benimYankim(actor) || !aktifProjede(task)) return;
      // Kolon değişimi de buradan geçiyor: taşıma ayrı bir uç değil.
      setTasks(prev => prev.map(t => (String(t.id) === String(task.id) ? { ...t, ...task } : t)));
    });

    sock.on('task_deleted', ({ id, actor }) => {
      if (!id || benimYankim(actor)) return;
      // Proje süzgeci yok: kart bu listede değilse süzme zaten etkisiz.
      setTasks(prev => prev.filter(t => String(t.id) !== String(id)));
    });

    sock.on('board_columns', ({ project_id, columns, actor }) => {
      if (benimYankim(actor)) return;
      if (String(project_id) !== String(window.CURRENT_PROJECT_ID)) return;
      // Sunucu kolon LİSTESİNİ bütün gönderiyor; ekleme/düzenleme/silme/sıralama
      // için ayrı birleştirme mantığı yazmak dört ayrı kusur yeri olurdu.
      window.DATA.COLUMNS = columns || [];
      // Pano kolonları kendi durumunda tutuyor (kart #235): liste yazıldıktan
      // SONRA haber ver, yoksa pano eski kopyayı çizmeye devam eder.
      window.dispatchEvent(new CustomEvent('stoa:kolonlarDegisti'));
      // Kolon silmek KARTLARI DA oynatıyor (sunucu onları ilk kolona taşıyor),
      // o yüzden görevler yeniden çekiliyor — tek kural, özel durum yok.
      // Başarısız olursa kolonlar yine de çizilsin diye liste tazeleniyor:
      // `DATA.COLUMNS` React durumu değil, kendi başına yeniden çizim
      // tetiklemiyor.
      API.projectTasks(project_id)
        .then(rows => setTasks(rows || []))
        .catch(() => setTasks(prev => [...prev]));
    });

    sock.on('task_comment', ({ task_id, actor }) => {
      if (!task_id || benimYankim(actor)) return;
      // Karttaki yorum sayacı. Açık çekmecenin kendi tazelemesi ayrı iş —
      // burada sayaç tutarlı kalıyor ki pano F5 istemesin.
      setTasks(prev => prev.map(t => (String(t.id) === String(task_id)
        ? { ...t, comments: (t.comments || 0) + 1 }
        : t)));
    });

    // Real-time notifications (from DM / @mention / task assignment)
    sock.on('notification', (notif) => {
      if (!notif) return;
      if (!window.DATA.NOTIFICATIONS) window.DATA.NOTIFICATIONS = [];
      if (!window.DATA.NOTIFICATIONS.some(n => n.id === notif.id)) {
        window.DATA.NOTIFICATIONS.unshift(notif);
        // Panelde görünmeyecek bildirim (başka alan) zili de doldurmasın —
        // aynı süzgeç, rozet.js.
        if (panelGorunur(notif, window.__CURRENT_WS_ID__, notifType(notif.text))) {
          setNotifCount(c => c + 1);
          setNotifUnread(c => c + 1);
        }
        const twks = JSON.parse(localStorage.getItem('stoa.tweaks') || '{}');
        const myStatus = window.__MY_STATUS__ || 'online';

        let tur = null;
        try { tur = JSON.parse(notif.text || '{}')?.type || null; } catch { tur = 'mention'; }
        // JSON olmayan gövde = eski biçimdeki bahsetme bildirimi.

        // KARAR (17 Eylül 2026, kart #121): atama ve bahsetme kullanıcının
        // işini keser; geri kalan her şey sessiz birikir.
        //
        // Gerekçe: kesme hakkı "senden bir şey bekleniyor" diyen bildirime
        // ait. Atama ve bahsetme bu ikisi; ötekiler "bir şey oldu" diyor ve
        // beklemeye tahammül eder. Her bildirim toast olursa toast
        // değersizleşir (BILDIRIMLER.md, S1).
        //
        // Liste eskiden beş tür taşıyordu (yorum, katılma isteği, kanala
        // eklendin de kesiyordu). Karar onu ikiye indirdi.
        //
        // SES DE AYNI KAPIDAN GEÇİYOR, ve bu bir düzeltme: önceden ding
        // KAPISIZDI — her bildirim ses çıkarıyordu, toast gösterilmese bile.
        // Yani "kesme" kararının iki okuyucusu vardı ve biri kuralı hiç
        // uygulamıyordu. Kolon eklendiğinde ekranda bir şey görünmüyor ama
        // ding geliyordu; kullanıcı sesin nereden geldiğini bulamıyordu.
        // Ses ve toast tek kümeden besleniyor, ayrışamazlar.
        const EKRANI_KESENLER = new Set(['task_assigned', 'mention']);

        // `tur === null` eski biçimdeki bahsetme; kesenlerden sayılıyor.
        const kesiyor = tur === null || EKRANI_KESENLER.has(tur);
        const izinVar = myStatus !== 'dnd' && twks.notifyTasks !== false;

        if (kesiyor && izinVar && twks.soundEnabled !== false) _playDing();

        if (kesiyor && izinVar) {
          const metin = renderNotifText(notif.text);
          // Toast düz metin gösteriyor: etiketler söküldükten sonra kaçış geri
          // çözülüyor, yoksa kullanıcı `&lt;img&gt;` gibi varlık kodları görürdü.
          // Metnin kendisi artık kaçışlı geliyor (bildirimMetni.js).
          if (metin) window.showToast?.(htmlCoz(String(metin).replace(/<[^>]*>/g, '')), 'info');
        }
      }
    });

    // Global chat_message handler — unread counts + sound + toast
    if (!window.__TOAST_LAST_MSG__) window.__TOAST_LAST_MSG__ = {};
    sock.on('chat_message', (msg) => {
      const me = window.CURRENT_USER?.id;
      if (!msg || msg.from === me) return;

      const isDM       = !!msg.to;
      const chatIsOpen = window.__CHAT_OPEN__;
      const chatDmWith = window.__CHAT_DM_WITH__;
      const isViewingThis = chatIsOpen && (
        (!isDM && !chatDmWith) ||
        (isDM && chatDmWith === msg.from)
      );

      // Muted check
      const muted = window.__MUTED_USERS__ ||
        new Set(JSON.parse(localStorage.getItem('stoa.muted') || '[]'));
      if (muted.has(msg.from)) return;

      const twks     = JSON.parse(localStorage.getItem('stoa.tweaks') || '{}');
      const myStatus = window.__MY_STATUS__ || 'online';

      // Unread counter — always increment unless currently viewing this conversation
      if (!isViewingThis && window.__INCREMENT_UNREAD__) {
        const wsKey = window.__CURRENT_WS_ID__ ? `general_${window.__CURRENT_WS_ID__}` : 'general';
        window.__INCREMENT_UNREAD__(isDM ? `dm_${msg.from}` : wsKey);
        // Track new media items separately for the Media tab badge
        if (msg.file_url) window.__INCREMENT_UNREAD__('media');
      }

      // Notification sound — not DND, sound enabled, messages enabled, not viewing this conversation
      if (!isViewingThis && myStatus !== 'dnd' && twks.soundEnabled !== false && twks.notifyMessages !== false) {
        _playDing();
      }

      // Toast notification
      if (isViewingThis) return;
      if (twks.notifyMessages === false || twks.notifyToasts === false) return;
      if (myStatus === 'dnd') return;
      if (isDM  && twks.notifyDMs       === false) return;
      if (!isDM && twks.notifyGroupChat === false) return;

      const now = Date.now();
      const key = String(msg.from);
      const lastTimes = window.__TOAST_LAST_MSG__;
      if (lastTimes[key] && (now - lastTimes[key]) < 2000) return;
      lastTimes[key] = now;

      if ((window.TOAST_QUEUE || []).length >= 3) return;

      const allMembers = window.DATA?.MEMBERS || [];
      const sender = allMembers.find(m => m.id === msg.from);
      if (sender && window.showToast) {
        window.showToast(messageToastPayload(msg, sender), 'message');
      }
    });

    return () => {
      sock.disconnect();
      window.SOCKET = null;
      setSocket(null);
    };
  }, [authed, needsWorkspace]);

  useEf(() => {
    window.__CHAT_OPEN__    = chatOpen;
    window.__CHAT_DM_WITH__ = chatDmWith;
  }, [chatOpen, chatDmWith]);

  // ── Activity tracking → presence status ─────────────────────────────────
  useEf(() => {
    if (!authed || needsWorkspace) return;

    const getTimeout = () => {
      const user = window.CURRENT_USER;
      return ((user?.away_timeout) || 15) * 60 * 1000;
    };

    const armAwayTimer = () => {
      clearTimeout(activityTimer.current);
      if (currentStatus.current === 'online') {
        activityTimer.current = setTimeout(() => {
          setOwnStatus('away', { auto: true });
        }, getTimeout());
      }
    };

    const resetTimer = () => {
      if (currentStatus.current === 'dnd' || manualAwayStatus.current) return;
      if (currentStatus.current === 'away' && autoAwayStatus.current) {
        setOwnStatus('online');
      }
      armAwayTimer();
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    // Go offline when page is closed/hidden
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(activityTimer.current);
        // Don't emit offline on visibility change — only on actual disconnect
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(activityTimer.current);
      events.forEach(ev => document.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authed, needsWorkspace, socket]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Expose stable unread increment function via window global (safe in socket handler)
  useEf(() => {
    window.__INCREMENT_UNREAD__ = (key) => {
      setUnreadCounts(prev => {
        const next = { ...prev, [key]: (prev[key] || 0) + 1 };
        localStorage.setItem('stoa.unread', JSON.stringify(next));
        return next;
      });
    };
  }, []); // setUnreadCounts is stable — no deps needed

  const markAsRead = (key) => {
    setUnreadCounts(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      localStorage.setItem('stoa.unread', JSON.stringify(next));
      return next;
    });
  };

  function setOwnStatus(status, options = {}) {
    const normalized = ['online', 'away', 'dnd'].includes(status) ? status : 'online';
    const isManualAway = options.manual && normalized === 'away';
    const isAutoAway = options.auto && normalized === 'away';

    currentStatus.current = normalized;
    autoAwayStatus.current = !!isAutoAway;
    manualAwayStatus.current = !!isManualAway;

    if (normalized === 'online' || normalized === 'dnd') {
      autoAwayStatus.current = false;
      manualAwayStatus.current = false;
    }

    setMyStatusState(normalized);
    window.__MY_STATUS__ = normalized;
    if (window.SOCKET) window.SOCKET.emit('set_status', { status: normalized });
    if (options.persist !== false) {
      API.updatePreferences({ status: normalized }).catch(() => {});
    }
  }

  function messageToastPayload(msg, sender) {
    const MAX_LEN = 80;
    const raw = msg.text || msg.file_name || window.t('app_msg_file');
    const truncated = raw.length > MAX_LEN;
    return {
      message: truncated ? raw.slice(0, MAX_LEN) + '…' : raw,
      meta: {
        sender: sender?.name || msg.from || window.t('app_msg_new_message'),
        senderId: sender?.id || msg.from,
        channel: msg.to ? window.t('app_msg_direct') : window.t('app_msg_general'),
        time: msg.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        truncated,
        dmWith: msg.to ? (typeof msg.from === 'string' ? msg.from : null) : null,
        channelSlug: msg.to ? null : (msg.channel || null),
      },
    };
  }

  function _applyOnlineUsers(users) {
    // users is array of {slug, status} objects
    const map = new Map();
    if (Array.isArray(users)) {
      users.forEach(u => {
        if (typeof u === 'string') map.set(u, 'online');
        else if (u.slug) map.set(u.slug, u.status || 'online');
      });
    }
    setOnlineUsers(map);
  }

  // Önyükleme her zaman buradan (kart #256). Proje kimliği gönderilmeyen
  // önyükleme sunucuda İLK projeyi seçer: F5, giriş ve alan değiştirme
  // kullanıcıyı her seferinde Ana Proje'ye atıyordu. Açık proje değiştirme
  // (switchProject) kimliği zaten gönderiyor, o yol buradan geçmiyor.
  function onyukle(alanId = null) {
    return API.bootstrap(hatirlananProje(alanId));
  }

  function _applyBootstrap(data) {
    // Tek yazan: alan ve proje kimliği ancak cevaptan sonra birlikte kesin.
    projeyiHatirla(data.workspace?.id, data.current_project);
    window.DATA.MEMBERS       = data.members       || [];
    setMembers(data.members || []);
    window.DATA.COLUMNS       = data.columns       || [];
    window.DATA.LABELS        = data.labels        || {};
    window.DATA.PROJECTS      = data.projects      || [];
    window.DATA.WORKSPACE     = data.workspace     || {};
    window.DATA.WORKSPACES    = data.workspaces    || [];
    window.DATA.CHANNELS      = data.channels      || [];
    setIsOwner(!!(data.workspace?.is_owner));
    setWsLogoUrl(data.workspace?.logo_url || null);
    window.DATA.NOTIFICATIONS = data.notifications || [];
    window.DATA.ACTIVITY      = data.activity      || [];
    window.CURRENT_USER       = data.user;
    window.CURRENT_PROJECT_ID = data.current_project;
    window.__CURRENT_WS_ID__  = data.workspace?.id || null;
    setCurrentWsId(data.workspace?.id || null);

    // Zil yalnızca panelin göstereceği bildirimleri sayar (panelGorunur):
    // başka alandan gelen okunmamış bildirim zili doldurup panelde
    // görünmüyordu, kullanıcı hiç okuyamıyordu (15 Eylül).
    const wsId = data.workspace?.id || null;
    const gorunurBildirimler = (data.notifications || [])
      .filter(n => panelGorunur(n, wsId, notifType(n.text)));
    setNotifCount(yeniOkunmamisSayisi(
      gorunurBildirimler,
      sonBakisOku(localStorage, data.user?.id),
    ));
    // Aynı süzgeç: panelde görünmeyecek bildirim noktayı da doldurmasın.
    setNotifUnread(gorunurBildirimler.filter(n => n.unread).length);
    if (typeof data.notes_count === 'number') setNotesCount(data.notes_count);

    // Background-prefetch notes so palette + sidebar badge stay in sync without opening the page
    if ((data.notes_count || 0) > 0 || (window.DATA.NOTES || []).length === 0) {
      API.listNotes().then((rows) => {
        window.DATA.NOTES = rows || [];
      }).catch(() => {});
    }

    const nextStatus = ['away', 'dnd'].includes(data.user?.status) ? data.user.status : 'online';
    setOwnStatus(nextStatus, { manual: nextStatus === 'away', persist: false });
  }

  // ── Workspace ready (after setup) ─────────────────────────────────────────
  const handleWorkspaceReady = () => {
    onyukle()
      .then((data) => {
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setNeedsWorkspace(false);
      })
      .catch((e) => window.showToast?.(window.t('app_err_load') + e.message, 'error'));
  };

  // ── Workspace switching ───────────────────────────────────────────────────
  const handleSwitchWorkspace = async (wsId) => {
    try {
      await API.switchWorkspace(wsId);
      // Notify socket server to update rooms
      if (window.SOCKET) window.SOCKET.emit('switch_workspace', { workspace_id: wsId });
      const data = await onyukle(wsId);
      _applyBootstrap(data);
      setTasks(data.tasks || []);
      setCurrentProject(data.current_project ? { id: data.current_project } : null);
      if (data.online_users) _applyOnlineUsers(data.online_users);
      if (data.workspaces)   setWorkspaces(data.workspaces);
      setWsSwitcherOpen(false);
    } catch (e) { window.showToast?.(window.t('app_err_switch_ws') + e.message, 'error'); }
  };

  const handleWsLogoChange = (logoUrl) => {
    setWsLogoUrl(logoUrl || null);
    window.DATA.WORKSPACE = { ...(window.DATA.WORKSPACE || {}), logo_url: logoUrl || null };
    setWorkspaces(prev => {
      const currentId = window.DATA.WORKSPACE?.id;
      const next = (prev || []).map(ws =>
        ws.id === currentId || ws.is_current ? { ...ws, logo_url: logoUrl || null } : ws
      );
      window.DATA.WORKSPACES = next;
      return next;
    });
  };

  // ── Task operations ───────────────────────────────────────────────────────

  const moveTask = async (id, colId) => {
    const prev = tasks;
    const col = DATA.COLUMNS.find(c => c.id === colId);
    setTasks(tasks.map(t => t.id === id ? { ...t, col: colId, progress: col?.is_done ? 100 : t.progress } : t));
    if (drawerTask?.id === id) setDrawerTask(dt => ({ ...dt, col: colId }));
    try {
      // İyimser değer yalnızca bekleme anı için. İlerleme sunucuda türetiliyor
      // (bitmemiş kolona dönen alt görevsiz kart 0 olur); yanıt birleştirilmezse
      // kart sayfa yenilenene kadar eski yüzdeyi gösterirdi.
      const updated = await API.updateTask(id, { col: colId });
      if (updated?.id) {
        setTasks(ts => ts.map(t => t.id === id ? { ...t, progress: updated.progress, subtasks: updated.subtasks } : t));
        if (drawerTask?.id === id) setDrawerTask(dt => (dt ? { ...dt, progress: updated.progress } : dt));
      }
    }
    catch (e) {
      setTasks(prev);
      // Çekmece açıksa o da geri sarılmalı; aksi halde kart eski kolona
      // dönerken çekmece yeni kolonu göstermeye devam ediyordu.
      if (drawerTask?.id === id) {
        const old = prev.find(t => t.id === id);
        if (old) setDrawerTask(dt => ({ ...dt, col: old.col, progress: old.progress }));
      }
      // Kolon geçiş kuralı gibi bilinçli engellemelerde sunucu açıklama
      // gönderiyor; sessizce geri sarmak yerine sebebi göster.
      window.showToast?.(e.message || window.t?.('app_err_move_task') || 'Görev taşınamadı', 'error');
      console.error('moveTask failed:', e.message);
    }
  };

  const updateTitle = async (id, title) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, title } : t));
    try { await API.updateTask(id, { title }); } catch (e) { console.error(e); }
  };

  const createTask = async (formData) => {
    const projectId = window.CURRENT_PROJECT_ID || 1;
    // Alt görevler karttan sonra tek tek yazılır (ayrı uç). Bu döngü eskiden
    // pencerede duruyordu ve panoya haber vermiyordu: kart "0/N" sayısını
    // F5'e kadar göstermiyordu (TODO, 13 Eylül). Hataları da yutuyordu —
    // bu depoda sessiz başarısızlık yasak; eklenemeyen sayısı toast'la
    // söyleniyor, eklenenler kartta hemen görünüyor.
    const { checklist = [], ...gorev } = formData || {};
    const created = await API.createTask(projectId, gorev);
    setTasks(prev => [created, ...prev]);
    if (created?.id && checklist.length > 0) {
      let eklenen = 0;
      for (const item of checklist) {
        try { await API.addSubtask(created.id, item); eklenen += 1; } catch (_) { /* aşağıda sayılıyor */ }
      }
      if (eklenen > 0) {
        setTasks(prev => prev.map(t => String(t.id) === String(created.id) ? { ...t, subtasks: `0/${eklenen}`, progress: 0 } : t));
      }
      const eksik = checklist.length - eklenen;
      if (eksik > 0) window.showToast?.(`${eksik} ${window.t?.('app_err_subtasks_partial') || 'alt görev eklenemedi'}`, 'error');
    }
    return created;
  };

  const deleteTask = async (id) => {
    const task = tasks.find(t => String(t.id) === String(id));
    setTasks(prev => prev.filter(t => String(t.id) !== String(id)));
    setDrawerTask(null);
    try {
      await API.deleteTask(id);
      if (task) setTrashTasks(prev => [{ ...task, deleted_at: new Date().toISOString() }, ...prev]);
    } catch (e) {
      console.error(e);
      if (task) setTasks(prev => [...prev, task]);
    }
  };

  const restoreTask = async (id) => {
    try {
      const restored = await API.restoreTask(id);
      setTrashTasks(prev => prev.filter(t => String(t.id) !== String(id)));
      setTasks(prev => [...prev, restored]);
      window.showToast?.(window.t?.('trash_restored') || 'Görev geri alındı', 'success');
    } catch (e) { console.error(e); }
  };

  const permanentDeleteTask = async (id) => {
    try {
      await API.permanentDeleteTask(id);
      setTrashTasks(prev => prev.filter(t => String(t.id) !== String(id)));
    } catch (e) { console.error(e); }
  };

  const restoreNote = async (id) => {
    try {
      await API.restoreNote(id);
      setTrashNotes(prev => prev.filter(n => n.id !== id));
      window.showToast?.(window.t?.('notes_trash_restored') || 'Not geri alındı', 'success');
    } catch (e) { console.error(e); }
  };

  const permanentDeleteNote = async (id) => {
    try {
      await API.permanentDeleteNote(id);
      setTrashNotes(prev => prev.filter(n => n.id !== id));
    } catch (e) { console.error(e); }
  };

  const emptyTrash = async () => {
    try {
      await API.emptyWorkspaceTrash();
      setTrashTasks([]);
    } catch (e) { console.error(e); }
  };

  // ── Project switch ────────────────────────────────────────────────────────

  const switchProject = async (projectId) => {
    if (switchAbortRef.current === projectId) return; // same project already loading
    switchAbortRef.current = projectId;
    setProjectSwitching(true);
    try {
      const data = await API.bootstrap(projectId);
      if (switchAbortRef.current !== projectId) return; // superseded by a newer click
      _applyBootstrap(data);
      setTasks(data.tasks || []);
      setCurrentProject(data.current_project ? { id: data.current_project } : null);
      setView('board');
    } catch (e) {
      // Sessiz kalmasın: başarısız geçişte ekranda eski projenin kartları
      // durur ve kullanıcı yeni projeye geçtiğini sanır.
      console.error('switchProject failed:', e.message);
      window.showToast?.(window.t?.('app_err_project_switch') || 'Proje açılamadı, eski proje yerinde kaldı.', 'error');
    } finally {
      if (switchAbortRef.current === projectId) {
        switchAbortRef.current = null;
        setProjectSwitching(false);
      }
    }
  };

  const handleCreateProject = async (name, color, icon) => {
    try {
      const p = await API.createProject({ name, color, icon });
      window.DATA.PROJECTS = [...(window.DATA.PROJECTS || []), p];
      await switchProject(p.id);
      setProjectModal(false);
    } catch (e) { window.showToast?.(window.t('app_err_create_project') + e.message, 'error'); }
  };

  const openChat = (dmWithSlug, msgId, channelSlug) => {
    // Bildirim acilirini kapat: ikisi de sag ustte ayni yerde aciliyor ve
    // bildirim paneli daha ustte kaldigi icin sohbet arkasinda gorunmez oluyordu.
    setNotifOpen(false);
    const slug = typeof dmWithSlug === 'string' ? dmWithSlug : null;
    if (slug && slug === window.CURRENT_USER?.id) {
      setChatDmWith(null);
      setChatChannel(null);
      setChatHighlightMsgId(null);
      setChatOpen(false);
      setView('settings');
      return;
    }
    const canOpenDm = !slug || members.some(m => m.id === slug);
    if (slug && !canOpenDm) {
      setChatDmWith(null);
      setChatChannel(channelSlug || null);
      setChatHighlightMsgId(null);
      setChatOpen(false);
      setView('chat');
      return;
    }
    setChatDmWith(slug);
    setChatChannel(slug ? null : (channelSlug || null));
    setChatHighlightMsgId(msgId || null);
    if (view === 'chat') {
      // Full-page chat is already open; let it react to initialDmWith change
      window.__CHAT_OPEN__ = true;
    } else {
      setChatOpen(true);
      window.__CHAT_OPEN__ = true;
    }
  };
  window.__OPEN_CHAT__ = openChat;
  window.__APP_TASKS__ = tasks;
  window.__SWITCH_VIEW__ = setView;
  window.__NOTIF_BADGE_RESET__ = rozetBakildi;
  // Panel okundu/okunmadı işaretlemesini kendisi yapıyor; nokta oradan
  // besleniyor. Panel kapalıyken sayıyı app.jsx kendi artırıyor, açıldığında
  // panel onu sunucudan gelen gerçekle hizalıyor.
  window.__NOTIF_UNREAD_SET__ = setNotifUnread;
  // Kimliğinden kart açma — bildirimlerin ve raporların ortak yolu.
  //
  // Raporlar bu yola 15 Eylül'de girdi: kişi raporu bütün projeleri
  // birleştirdiğinden satırdaki kart çoğu zaman aktif projede değil. Rapor
  // kendi kopyasını taşıyordu ve o kopya yalnızca yerel listeye bakıp
  // bulamayınca sessizce vazgeçiyordu — tıklama hiçbir şey yapmıyordu.
  //
  // `returnView` verilirse çekmece kapandığında oraya dönülür (rapordan
  // açılan kart panoda bırakılmaz).
  //
  // Kart başka projedeyse proje DEĞİŞTİRİLİR. TODO'da "proje değiştirmek şart
  // değil" yazıyordu; değil ama tehlikeli: kolonlar projeye ait ve çekmece
  // `DATA.COLUMNS`u aktif projeden okuyor. Değiştirmeden açılan kart kolon
  // adını ham kimlik olarak gösterir, "taşı" menüsü de BAŞKA projenin
  // kolonlarını sunar — seçilirse kart yanlış kolona yazılır. Çekmeceye
  // karta özel kolon listesi taşımak doğru çözüm ama daha geniş bir iş.
  const openTaskById = async (taskId, returnView = null) => {
    if (!taskId) return false;
    // Fast path: task is in the current project's list
    const local = tasks.find(x => String(x.id) === String(taskId));
    if (local) {
      if (returnView) setTaskReturnView(returnView);
      setDrawerTask(local);
      setNotifOpen(false);
      setView('board');
      return true;
    }
    // Slow path: fetch from backend; switch project if needed
    try {
      const detail = await API.getTaskDetail(taskId);
      // Sunucu 404'ü zaten fırlatıyor; bu dal boş gövdeye karşı. Sessiz
      // dönmek tıklamayı yine hiçbir şey yapmaz hâle getirirdi.
      if (!detail) {
        window.showToast?.(window.t?.('app_err_task_missing') || 'Görev bulunamadı — silinmiş ya da erişiminiz yok.', 'error');
        return false;
      }
      const targetProjectId = detail.project_id;
      const inCurrentProject = currentProject && String(currentProject.id) === String(targetProjectId);
      if (returnView) setTaskReturnView(returnView);
      if (!inCurrentProject && targetProjectId) {
        await switchProject(targetProjectId);
        // After project switch, find the task again from the freshly loaded list
        const fresh = (window.__APP_TASKS__ || []).find(x => String(x.id) === String(taskId));
        setDrawerTask(fresh || detail);
      } else {
        setDrawerTask(detail);
        setView('board');
      }
      setNotifOpen(false);
      return true;
    } catch (e) {
      window.showToast?.((window.t?.('app_err_open_task') || 'Görev açılamadı: ') + (e.message || ''), 'error');
      return false;
    }
  };
  window.__OPEN_TASK_BY_ID__ = (taskId) => openTaskById(taskId);

  const handleCmd = (action) => {
    if (action === 'goto:board-list') {
      localStorage.setItem('stoa.boardSubView', 'list');
      setView('board');
    }
    else if (action.startsWith('goto:')) setView(action.slice(5));
    // Paletten kart açma (17 Eylül 2026): "#193" aramasının ve başlıkla
    // görev aramasının hedefi. `openTaskById` zaten kartı yerel listede
    // arıyor, bulamazsa sunucudan çekiyor, gerekirse projeyi değiştiriyor
    // ve gerçekten yoksa toast gösteriyor — yani başka bir projedeki kart
    // da, silinmiş bir kart da doğru davranışı alıyor.
    else if (action.startsWith('open:task:')) {
      const taskId = parseInt(action.slice('open:task:'.length), 10);
      // Sayı değilse sessizce geçmiyoruz: paletten gelen her eylem bir
      // kullanıcı tıklamasıdır, yokluk hâli görünür olmalı.
      if (Number.isFinite(taskId) && taskId > 0) openTaskById(taskId);
      else window.showToast?.(window.t?.('app_err_task_missing') || 'Görev bulunamadı', 'error');
    }
    // Yalnızca yol gösteren satır (paletteki "#" ipucu); tıklanınca palet
    // kapanıyor, başka bir şey olmuyor.
    else if (action === 'noop') { /* bilerek boş */ }
    else if (action.startsWith('open:note:')) {
      const noteId = parseInt(action.slice('open:note:'.length), 10);
      if (Number.isFinite(noteId)) {
        setView('notes');
        // NotesView may need a tick to mount before __NOTES_OPEN__ exists
        setTimeout(() => {
          if (window.__NOTES_OPEN__) window.__NOTES_OPEN__(noteId);
          else window.location.hash = `note=${noteId}`;
        }, 30);
      }
    }
    else if (action === 'new:task')       { if (canManageTasks) openModal('todo'); }
    else if (action === 'new:note')       {
      setView('notes');
      setTimeout(() => { window.__NOTES_CREATE__?.(); }, 30);
    }
    else if (action === 'open:notifs')    setNotifOpen(true);
    else if (action === 'open:chat')      openChat();
    else if (action === 'new:project')    { if (canManageProjects) setProjectModal(true); }
    else if (action === 'toggle:theme') {
      const order = ['light','cream','dark'];
      setTweak('theme', order[(order.indexOf(tweaks.theme) + 1) % order.length]);
    }
    else if (action === 'toggle:sidebar') setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed);
    else if (action === 'logout')         handleLogout();
  };

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleSignIn = () => {
    onyukle()
      .then((data) => {
        if (data.needs_workspace) {
          window.CURRENT_USER = data.user;
          setAuthed(true); setNeedsWorkspace(true);
          return; // WorkspaceSetupPage reads ?join= from URL itself
        }
        _applyBootstrap(data);
        setTasks(data.tasks || []);
        setCurrentProject(data.current_project ? { id: data.current_project } : null);
        if (data.online_users) _applyOnlineUsers(data.online_users);
        if (data.workspaces)   setWorkspaces(data.workspaces);
        setAuthed(true); setNeedsWorkspace(false);
        // If user already has a workspace but signed in via an invite link, open join modal
        try {
          const joinCode = new URLSearchParams(window.location.search).get('join');
          if (joinCode) {
            setWsJoinInitialCode(joinCode);
            setWsJoinModalOpen(true);
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (_) {}
      })
      .catch((e) => window.showToast?.(window.t('app_err_load') + e.message, 'error'));
  };

  const handleLogout = async () => {
    if (window.SOCKET) { window.SOCKET.disconnect(); window.SOCKET = null; setSocket(null); }
    try { await API.logout(); } catch (_) {}
    window.DATA.MEMBERS = []; window.DATA.COLUMNS = []; window.DATA.LABELS = {};
    window.DATA.PROJECTS = []; window.DATA.WORKSPACE = {}; window.DATA.WORKSPACES = []; window.DATA.CHANNELS = [];
    setAuthed(false); setNeedsWorkspace(false); setIsOwner(false);
    setTasks([]); setOnlineUsers(new Map()); setWorkspaces([]);
    setWsLogoUrl(null);
    setTweak('theme', 'cream');
  };

  const openDrawer = (task) => setDrawerTask(task);
  const closeDrawer = () => setDrawerTask(null);

  // Açık kartın aynı kolondaki komşuları (kart #246). Panodaki `tasks`
  // dizisinden, panonun sırasıyla; kural `komsu.js`te. Çekmece ve tam sayfa
  // kart aynı hesabı okuyor, geçiş de aynı durumu değiştiriyor — ikisi ayrı
  // yoldan gitseydi biri güncellenip öteki eski kartta kalabilirdi.
  const cekmeceKomsu = komsuKartlar(tasks, drawerTask);
  const sayfaKomsu = komsuKartlar(tasks, taskPageTask);

  // Drawer kapandığında (kapat düğmesi ya da Escape — ikisi de drawerTask'i
  // null yapıyor) bir dönüş görünümü kayıtlıysa oraya dön. Raporlardan açılan
  // kart kapanınca panoda bırakmak yerine rapora geri getiriyor.
  useEf(() => {
    if (!drawerTask && taskReturnView) {
      setView(taskReturnView);
      setTaskReturnView(null);
    }
  }, [drawerTask]);
  const openTaskPage = (task) => { setTaskPageTask(task); setDrawerTask(null); };
  const closeTaskPage = () => setTaskPageTask(null);

  // Tam ekran görev açıkken view değişirse kapat
  useEf(() => { setTaskPageTask(null); }, [view]);

  // Load workspace-wide task trash (workspace-scoped).
  // Oturum kurulmadan calistirmiyoruz: [] bagimliligiyla mount aninda atilan
  // istekler giris ekraninda 401 donup konsolu kirletiyordu.
  useEf(() => {
    if (!authed) return;
    API.getWorkspaceTrash().then(setTrashTasks).catch(() => {});
    API.getNoteTrash().then(setTrashNotes).catch(() => {});
  }, [authed]);

  const openModal = (colId, dates = null) => {
    if (!canManageTasks) return;
    setModalCol(colId || 'todo');
    setModalInitialDates(dates || null);
    setModalOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo-wrap">
            <img
              src="/static/StoaBoard_symbol.png" alt=""
              style={{ width: 36, height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' }}
              onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'; }}
            />
          </div>
          <div className="loading-brand">Stoa<em>Board</em></div>
          <div className="loading-bar-wrap"><div className="loading-bar" /></div>
        </div>
      </div>
    );
  }

  if (!authed) {
    if (view === 'gizlilik-sartlari' || view === 'hizmet-sartlari') {
      return (
        <div className="app" data-auth="true">
          <LegalPage type={view} onViewChange={setView} authed={authed} />
        </div>
      );
    }
    return (
      <div className="app" data-auth="true">
        <AuthPage onSignIn={handleSignIn} />
      </div>
    );
  }

  if (needsWorkspace) {
    return (
      <div className="app" data-auth="true">
        <WorkspaceSetupPage onReady={handleWorkspaceReady} onLogout={handleLogout} />
      </div>
    );
  }

  const crumb = {
    board:window.t('crumb_board'),
    'board-list':window.t('crumb_list'),
    calendar:window.t('crumb_calendar'),
    dashboard:window.t('crumb_dashboard'),
    settings:window.t('crumb_settings'),
    chat:window.t('crumb_chat'),
    notifications:window.t('crumb_notifications'),
    notes:window.t('crumb_notes'),
    trash: window.t?.('nav_trash') || 'Çöp Kutusu',
    'gizlilik-sartlari': window.t?.('crumb_privacy') || 'Gizlilik Sözleşmesi',
    'hizmet-sartlari': window.t?.('crumb_terms') || 'Hizmet Şartları'
  }[view] || window.t('crumb_board');

  // My-tasks open count (assigned to me, not in a done column)
  const myId = window.CURRENT_USER?.id;
  const myTasksOpenCount = myId
    ? tasks.filter(t => {
        if (!(t.assignees || []).includes(myId)) return false;
        const c = (DATA.COLUMNS || []).find(c => c.id === t.col);
        return !c?.is_done;
      }).length
    : 0;
  const noProject = !currentProject && DATA.PROJECTS.length === 0;

  // Convert onlineUsers map to Set of online slugs (for backward compat) and expose full map
  const onlineSet = new Set(onlineUsers.keys());
  return (
    <div className="app">
      <ToastContainer />
      <div
        className="sidebar-backdrop"
        data-open={mobileSidebarOpen}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <Sidebar
        collapsed={tweaks.sidebarCollapsed}
        onCollapseToggle={() => setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed)}
        view={view} onView={(v) => { setView(v); setMobileSidebarOpen(false); }}
        projects={DATA.PROJECTS}
        members={members}
        openCmd={() => { setCmdOpen(true); setMobileSidebarOpen(false); }}
        onlineUsers={onlineSet}
        onlineStatuses={onlineUsers}
        onChatOpen={(...args) => { openChat(...args); setMobileSidebarOpen(false); }}
        onSwitchProject={(id) => { switchProject(id); setMobileSidebarOpen(false); }}
        onNewProject={() => { setProjectModal(true); setMobileSidebarOpen(false); }}
        canManageProjects={canManageProjects}
        workspaces={workspaces}
        wsLogoUrl={wsLogoUrl}
        onSwitchWorkspace={handleSwitchWorkspace}
        wsSwitcherOpen={wsSwitcherOpen}
        onWsSwitcherToggle={() => setWsSwitcherOpen(v => !v)}
        onAddWorkspace={() => { setWsSwitcherOpen(false); setWsJoinModalOpen(true); }}
        unreadCounts={unreadCounts}
        currentWsId={currentWsId}
        currentStatus={myStatusState}
        onStatusChange={(s) => {
          clearTimeout(activityTimer.current);
          setOwnStatus(s, { manual: s === 'away' });
          if (s === 'online') {
            activityTimer.current = setTimeout(() => {
              setOwnStatus('away', { auto: true });
            }, ((window.CURRENT_USER?.away_timeout) || 15) * 60 * 1000);
          }
        }}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        myTasksOpenCount={myTasksOpenCount}
        notifCount={notifCount}
        notesCount={notesCount}
        trashCount={trashTasks.length + trashNotes.length}
        onOpenNotifs={() => { if (view !== 'notifications') setPreNotifView(view); setView('notifications'); rozetBakildi(); }}
      />
      <div className="main" key={_appLang}>
        <Topbar
          view={view} onView={setView}
          openCmd={() => setCmdOpen(true)}
          openNotifs={() => { setNotifOpen(o => !o); rozetBakildi(); setChatOpen(false); }}
          openModal={() => openModal('todo')}
          activeCrumb={crumb}
          onChatOpen={() => openChat()}
          notifCount={notifCount}
          notifUnread={notifUnread}
          canManageTasks={canManageTasks}
          onMobileMenuToggle={() => setMobileSidebarOpen(v => !v)}
        />

        {/* Görünüm alanı bir hata boundary ile sarılı: bir görünüm render'da
            çökerse yalnızca bu bölüm bir "yeniden dene" kutusu gösterir; Topbar
            ve sidebar ayakta kalır. key={view} sayesinde başka görünüme geçince
            boundary yeniden kurulur ve hata kendiliğinden temizlenir. */}
        <ErrorBoundary key={view}>
        {noProject && view !== 'settings' && view !== 'gizlilik-sartlari' && view !== 'hizmet-sartlari' ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'var(--ink-muted)' }}>
            <Icon name="layoutBoard" size={48} strokeWidth={1} />
            <div style={{ fontSize:22, fontFamily:'var(--font-display)', color:'var(--ink)' }}>{window.t('nav_no_projects')}</div>
            <div style={{ fontSize:14 }}>{window.t('app_first_project')}</div>
            {canManageProjects && (
              <button className="btn btn-primary" onClick={() => setProjectModal(true)}>
                <Icon name="plus" size={14} /> {window.t('nav_new_project')}
              </button>
            )}
          </div>
        ) : (
          <>
            {taskPageTask ? (
              <TaskDrawer
                pageMode={true}
                open={true}
                task={taskPageTask}
                onClose={closeTaskPage}
                onMoveTask={moveTask}
                onTaskUpdate={(updated) => {
                  setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
                  setTaskPageTask(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
                }}
                onDelete={(id) => { deleteTask(id); closeTaskPage(); }}
                onCreateTask={(newTask) => setTasks(prev => [newTask, ...prev])}
                canManageTasks={canManageTasks}
                tweaks={tweaks}
                komsu={sayfaKomsu}
                onKomsu={setTaskPageTask}
              />
            ) : null}
            {(view === 'gizlilik-sartlari' || view === 'hizmet-sartlari') && (
              <LegalPage type={view} onViewChange={setView} authed={authed} />
            )}
            {!taskPageTask && view === 'board'     && <BoardView key={currentProject?.id || 'default'} tasks={tasks} onOpenTask={openDrawer} onMoveTask={moveTask} onDeleteTask={deleteTask} tweaks={tweaks} onOpenModal={openModal} onTitleChange={updateTitle} canManageTasks={canManageTasks} canManageProjects={canManageProjects} switching={projectSwitching} />}
            {view === 'notifications' && (
              <NotifPanel
                fullPage
                open
                onClose={() => setView(preNotifView || 'dashboard')}
                socket={socket}
                onOpenTask={(task) => { setView('board'); setDrawerTask(task); }}
                onOpenChat={(slug, msgId, channelSlug) => { openChat(slug, msgId, channelSlug); setView('chat'); }}
                currentWsId={currentWsId}
                tweaks={tweaks}
                setTweak={setTweak}
              />
            )}
            {!taskPageTask && view === 'calendar'  && <Lazy><CalendarView tasks={tasks} onOpenTask={openDrawer} onOpenModal={openModal} canCreateTasks={canManageTasks} /></Lazy>}
            {!taskPageTask && view === 'dashboard' && <Lazy><DashboardView tasks={tasks} onOpenTask={openDrawer} onView={setView} /></Lazy>}
            {!taskPageTask && view === 'reports' && (
              <Lazy>
                <ReportsView
                  canManageWorkspace={canManageWorkspace}
                  onOpenTask={(id) => openTaskById(id, 'reports')}
                />
              </Lazy>
            )}
            {view === 'notes'     && <Lazy><NotesView
              socket={socket}
              tasks={tasks}
              members={members}
              currentUserId={window.CURRENT_USER?.slug}
              isOwner={isOwner}
              canManageProjects={canManageProjects}
              onOpenTask={(t) => { setView('board'); setDrawerTask(t); }}
              onCountChange={setNotesCount}
            /></Lazy>}
            {!taskPageTask && view === 'trash' && <Lazy><TrashView tasks={trashTasks} onRestore={restoreTask} onPermanentDelete={permanentDeleteTask} canManageTasks={canManageTasks} notes={trashNotes} onRestoreNote={restoreNote} onPermanentDeleteNote={permanentDeleteNote} onEmptyTrash={emptyTrash} /></Lazy>}
            {view === 'chat' && (
              <ChatPanel
                open
                fullPage
                onClose={() => setView('dashboard')}
                onlineUsers={onlineSet}
                onlineStatuses={onlineUsers}
                members={members}
                socket={socket}
                initialDmWith={chatDmWith}
                initialChannel={chatChannel}
                canManageChannels={canManageChannels}
                canDeleteMessages={canDeleteMessages}
                unreadCounts={unreadCounts}
                markAsRead={markAsRead}
                wsId={currentWsId}
                highlightMsgId={chatHighlightMsgId}
              />
            )}
          </>
        )}
        {view === 'settings' && <Lazy><SettingsView key={currentWsId || "ws"} tweaks={tweaks} setTweak={setTweak} onLogout={handleLogout} onWsLogoChange={handleWsLogoChange} onMembersChange={setMembers} /></Lazy>}
        </ErrorBoundary>
      </div>

      {/* KAPLAMA KATMANI DA SARILIYOR (17 Eylül 2026).
          `ErrorBoundary`nin kendi açıklaması bu kusuru birebir tarif ediyor:
          "bir boundary yoksa TÜM ağaç unmount olur — ekran komple siyah
          kalır". Ders 2 Eylül'de GÖRÜNÜMLER için öğrenilmişti ve görünüm alanı
          sarılmıştı; çekmece, sohbet ve bildirim panelleri DIŞARIDA kaldı.
          Onlar da render ediyor, onlar da fırlatabiliyor.

          Kullanıcı bunu canlıda buldu: kart yorumundaki bahsetmeye basınca
          DM açılacakken sayfa tamamen beyazladı — ne üst çubuk ne kenar
          çubuğu, hiçbir şey. Tek bir panelin hatası bütün uygulamayı
          götürüyordu ve geriye hiçbir iz kalmıyordu.

          Her panel KENDİ boundary'sinde: biri çökerse ötekiler ayakta kalıyor
          ve kullanıcının kaçış yolu (kenar çubuğu, üst çubuk) hep duruyor. */}
      <ErrorBoundary key="drawer">
      <TaskDrawer
        open={!!drawerTask} task={drawerTask} onClose={closeDrawer}
        onMoveTask={moveTask}
        onTaskUpdate={(updated) => {
          setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
          setDrawerTask(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev);
        }}
        onDelete={deleteTask}
        onCreateTask={(newTask) => setTasks(prev => [newTask, ...prev])}
        canManageTasks={canManageTasks}
        onOpenPage={openTaskPage}
        tweaks={tweaks}
        komsu={cekmeceKomsu}
        onKomsu={openDrawer}
      />
      </ErrorBoundary>
      <ErrorBoundary key="modal">
      <AddTaskModal open={canManageTasks && modalOpen} onClose={() => { setModalOpen(false); setModalInitialDates(null); }} defaultCol={modalCol} onCreate={createTask} initialDates={modalInitialDates} />
      </ErrorBoundary>
      <ErrorBoundary key="palette">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmd} />
      </ErrorBoundary>
      <ErrorBoundary key="notif">
      <NotifPanel
        open={notifOpen}
        onClose={() => { setNotifOpen(false); rozetBakildi(); }}
        socket={socket}
        onOpenTask={(task) => { setNotifOpen(false); rozetBakildi(); setDrawerTask(task); }}
        onOpenChat={(slug, msgId, channelSlug) => { setNotifOpen(false); rozetBakildi(); openChat(slug, msgId, channelSlug); }}
        currentWsId={currentWsId}
        tweaks={tweaks}
        setTweak={setTweak}
      />
      </ErrorBoundary>
      {/* Slide-out popup chat — only when NOT on full-page chat route */}
      <ErrorBoundary key="chat">
      {view !== 'chat' && (
        <ChatPanel
          open={chatOpen}
          fullPage={false}
          onExpand={() => {
            setChatOpen(false); setChatDmWith(null); setChatChannel(null); setChatHighlightMsgId(null);
            window.__CHAT_OPEN__ = false;
            setView('chat');
          }}
          onClose={() => {
            setChatOpen(false); setChatDmWith(null); setChatChannel(null); setChatHighlightMsgId(null);
            window.__CHAT_OPEN__ = false;
          }}
          onlineUsers={onlineSet}
          onlineStatuses={onlineUsers}
          members={members}
          socket={socket}
          initialDmWith={chatDmWith}
          initialChannel={chatChannel}
          canManageChannels={canManageChannels}
          canDeleteMessages={canDeleteMessages}
          unreadCounts={unreadCounts}
          markAsRead={markAsRead}
          wsId={currentWsId}
          highlightMsgId={chatHighlightMsgId}
        />
      )}
      </ErrorBoundary>
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} visible={tweaksAvailable} />
      {projectModal && canManageProjects && <NewProjectModal onClose={() => setProjectModal(false)} onCreate={handleCreateProject} />}
      {wsJoinModalOpen && (
        <AddWorkspaceModal
          initialCode={wsJoinInitialCode}
          onClose={() => { setWsJoinModalOpen(false); setWsJoinInitialCode(''); }}
          onDone={async (wsId) => {
            setWsJoinModalOpen(false); setWsJoinInitialCode('');
            await handleSwitchWorkspace(wsId);
          }}
        />
      )}
    </div>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────

function ProjectIconPicker({ selected, color, onChange }) {
  const icons = window.PROJECT_ICONS || [];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:4, maxHeight:180, overflowY:'auto', padding:'2px 0' }}>
      {icons.map(({ id, label, label_en }) => (
        <button key={id+label} type="button" title={window.iconLabel?.({ label, label_en }) || label} onClick={() => onChange(id)}
          style={{
            width:32, height:32, borderRadius:8, display:'grid', placeItems:'center',
            background: selected === id ? color : 'var(--bg-raised)',
            color: selected === id ? 'white' : 'var(--ink-muted)',
            border: selected === id ? `2px solid ${color}` : '2px solid transparent',
            cursor:'pointer', transition:'all 0.12s', flexShrink:0,
          }}>
          <Icon name={id} size={15} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName]   = React.useState('');
  const [color, setColor] = React.useState('oklch(55% 0.13 25)');
  const [icon, setIcon]   = React.useState('folder');
  const [loading, setLoading] = React.useState(false);

  const colors = [
    ['Terracotta','oklch(55% 0.13 25)'], ['Sage','oklch(55% 0.09 150)'],
    ['Indigo','oklch(52% 0.15 270)'],    ['Plum','oklch(50% 0.14 340)'],
    ['Amber','oklch(65% 0.11 70)'],      ['Slate','oklch(50% 0.04 250)'],
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim(), color, icon);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" data-open="true" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{window.t('app_new_project')}</div>
          <div className="modal-sub">{window.t('app_new_project_sub')}</div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>{window.t('app_project_name')}</label>
              <input autoFocus placeholder={window.t('app_project_name_placeholder')} value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>{window.t('app_project_color')}</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'2px 0' }}>
                {colors.map(([label, val]) => (
                  <button key={val} type="button" title={label} onClick={() => setColor(val)}
                    style={{ width:28, height:28, borderRadius:7, background:val, cursor:'pointer', flexShrink:0,
                      border: color===val ? '3px solid var(--ink)' : '2px solid transparent',
                      boxShadow: color===val ? '0 0 0 1px var(--bg), 0 0 0 3px var(--ink)' : 'none',
                      transition: 'box-shadow 0.15s' }} />
                ))}
              </div>
            </div>
            <div className="field">
              <label>{window.t('app_project_icon')}</label>
              <ProjectIconPicker selected={icon} color={color} onChange={setIcon} />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{window.t('app_cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading}>
              {loading ? window.t('app_creating') : window.t('app_create_project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add/Join Workspace Modal ──────────────────────────────────────────────

function AddWorkspaceModal({ onClose, onDone, initialCode = '' }) {
  const [tab, setTab]         = React.useState(initialCode ? 'join' : 'create');
  const [wsName, setWsName]   = React.useState('');
  const [code, setCode]       = React.useState(initialCode);
  const [error, setError]     = React.useState('');
  const [busy, setBusy]       = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setError(''); setBusy(true);
    try {
      const res = await API.createWorkspace({ name: wsName.trim() });
      onDone(res.workspace_id);
    } catch (err) {
      setError(err.message || window.t?.('app_error_generic') || 'Bir hata oluştu');
      setBusy(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(''); setBusy(true);
    try {
      const res = await API.joinWorkspace(code.trim());
      if (res.pending) {
        setBusy(false);
        setPending(true);
      } else {
        onDone(res.workspace_id);
      }
    } catch (err) {
      setError(window.t?.('err_' + err.message) || err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" data-open="true" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <div className="modal-title">{window.t('app_add_workspace')}</div>
          <div className="modal-sub">{window.t('app_add_workspace_sub')}</div>
        </div>
        <div className="modal-body" style={{ paddingTop: 0 }}>
          {pending ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{window.t('app_request_sent')}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                {window.t('app_request_sent_desc')}<br />
                {window.t('app_request_sent_auto')}
              </div>
              <button className="btn btn-primary" onClick={onClose}>{window.t('app_ok')}</button>
            </div>
          ) : (
            <>
              <div className="modal-tabs" style={{ marginBottom: 20 }}>
                <button className="modal-tab-btn" data-active={tab === 'create'} onClick={() => { setTab('create'); setError(''); }}>{window.t('app_tab_create_ws')}</button>
                <button className="modal-tab-btn" data-active={tab === 'join'}   onClick={() => { setTab('join');   setError(''); }}>{window.t('app_tab_join_ws')}</button>
              </div>
              {error && (
                <div style={{ padding:'8px 12px', borderRadius:8, background:'oklch(58% 0.13 10 / 0.12)', color:'var(--status-rose)', fontSize:12, marginBottom:12 }}>
                  {error}
                </div>
              )}
              {tab === 'create' ? (
                <form onSubmit={handleCreate}>
                  <div className="field">
                    <label>{window.t('app_ws_name')}</label>
                    <input autoFocus placeholder={window.t('app_ws_name_placeholder')} value={wsName} onChange={e => setWsName(e.target.value)} required />
                  </div>
                  <div className="modal-foot">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>{window.t('app_cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !wsName.trim()}>
                      {busy ? window.t('app_creating') : window.t('app_create_ws')}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleJoin}>
                  <div className="field">
                    <label>{window.t('app_invite_code')}</label>
                    <input autoFocus placeholder="ABCD1234" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={8}
                      style={{ fontFamily:'var(--font-mono)', letterSpacing:'0.1em', fontSize:18, textAlign:'center' }} required />
                  </div>
                  <div className="modal-foot">
                    <button type="button" className="btn btn-ghost" onClick={onClose}>{window.t('app_cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy || code.length < 6}>
                      {busy ? window.t('app_sending') : window.t('app_send_join_request')}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
