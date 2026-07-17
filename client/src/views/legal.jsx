import React, { useState as useS } from 'react';

// Fallback SVG logo in case PNG logo isn't available
const StoaLogoSVG = ({ color = '#1a4a70', size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="15" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="25" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="3" y="89" width="32" height="5" rx="2" fill={color} />
    <rect x="1" y="94" width="36" height="4" rx="2" fill={color} />
    <rect x="59" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="69" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="79" y="52" width="8" height="42" rx="2" fill={color} />
    <rect x="57" y="89" width="32" height="5" rx="2" fill={color} />
    <rect x="55" y="94" width="36" height="4" rx="2" fill={color} />
    <rect x="44" y="52" width="10" height="46" rx="2" fill={color} />
    <rect x="41" y="94" width="16" height="4" rx="2" fill={color} />
    <path d="M8 8 C4 8 1 11 1 15 C1 19 4 21 9 23 L16 26 C21 28 24 30 24 35 C24 40 21 43 16 43 C11 43 8 40 7 36 L3 37.5 C5 43 10 47 16 47 C23 47 28 43 28 35 C28 30 25 27 20 25 L13 22 C9 20 5 18 5 15 C5 12 7 10 10 10 C13 10 15 11.5 16 14 L20 12 C18 9 14 8 8 8Z" fill={color} />
    <path d="M32 8 L32 47 L37 47 L37 30 L45 30 L51 47 L57 47 L50 29.5 C54 28 56 24.5 56 20 C56 13 51 8 44 8 L32 8Z M37 12.5 L43 12.5 C47 12.5 50 15 50 20 C50 25 47 27.5 43 27.5 L37 27.5 L37 12.5Z" fill={color} />
  </svg>
);

const StoaLogo = ({ size = 32, color = 'var(--accent)' }) => {
  const [pngFailed, setPngFailed] = useS(false);
  if (pngFailed) return <StoaLogoSVG color={color} size={size} />;
  return (
    <img
      src="/static/StoaBoard_symbol.png"
      width={size}
      height={size}
      alt="StoaBoard"
      style={{
        objectFit: 'contain',
        display: 'block',
        ...(color === 'white' ? { filter: 'brightness(0) invert(1)' } : {})
      }}
      onError={() => setPngFailed(true)}
    />
  );
};

export function LegalPage({ type, onViewChange, authed }) {
  // Generate random particles for unauthenticated mode
  const [particles] = useS(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 1.2,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 6}s`,
      duration: `${Math.random() * 16 + 10}s`,
    }));
  });

  const handleClose = () => {
    if (authed) {
      // Return to main dashboard view or whatever is stored in local storage
      const stored = localStorage.getItem('stoa.view') || 'board';
      onViewChange(stored === 'gizlilik-sartlari' || stored === 'hizmet-sartlari' ? 'board' : stored);
    } else {
      // When unauthenticated, refresh or reset view back to auth view
      onViewChange('auth');
    }
  };

  const isPrivacy = type === 'gizlilik-sartlari';
  const title = isPrivacy ? 'Gizlilik Sözleşmesi & Şartları' : 'Kullanım & Hizmet Şartları';
  const dateStr = 'Son Güncelleme: 17 Temmuz 2026';

  const renderPrivacyContent = () => (
    <>
      <p>StoaBoard olarak, kişisel verilerinizin güvenliği ve gizliliği bizim için en yüksek önceliğe sahiptir. Bu Gizlilik Sözleşmesi, uygulamamızı ve platformumuzu kullanırken edindiğimiz kişisel bilgilerinizi nasıl topladığımızı, işlediğimizi, sakladığımızı ve koruduğumuzu açıklamaktadır.</p>

      <h2>1. Toplanan Veriler</h2>
      <p>Platformumuzu kullanabilmeniz için gerekli olan ve sizden talep edebileceğimiz veri türleri şunlardır:</p>
      <ul>
        <li><strong>Hesap Bilgileri:</strong> Kayıt olurken girdiğiniz ad, soyad ve e-posta adresiniz.</li>
        <li><strong>Profil Bilgileri:</strong> Tercihinize bağlı olarak yüklediğiniz profil fotoğrafı ve belirlediğiniz unvan/rol bilgisi.</li>
        <li><strong>Kullanım ve İşlem Bilgileri:</strong> Oluşturduğunuz çalışma alanları (odalar), panolar, görev kartları, takvim kayıtları, notlar, sohbet kanallarında gönderdiğiniz mesajlar ve dosya ekleri.</li>
        <li><strong>Teknik Veriler:</strong> IP adresiniz, tarayıcı türünüz, cihaz bilgileriniz ve oturum loglarınız.</li>
      </ul>

      <h2>2. Verilerin Kullanım Amaçları</h2>
      <p>Toplanan kişisel ve sistemsel verileriniz aşağıdaki amaçlar doğrultusunda işlenmektedir:</p>
      <ul>
        <li>Hizmetlerimizin sorunsuz bir şekilde sunulması, hesabınızın doğrulanması ve yönetilmesi.</li>
        <li>Gerçek zamanlı sohbet, anlık bildirimler, iş birliği ve proje yönetimi araçlarının işlevselliğinin sağlanması.</li>
        <li>Kullanıcı deneyiminin iyileştirilmesi, görünüm ve tema tercihlerinizin kaydedilmesi.</li>
        <li>Sistem güvenliğinin ve bütünlüğünün korunması, kötüye kullanım veya yasa dışı faaliyetlerin engellenmesi.</li>
      </ul>

      <h2>3. Veri Güvenliği ve Saklama</h2>
      <p>Kişisel verileriniz, yetkisiz erişim, kayıp, ifşa veya değiştirilmeye karşı korumak amacıyla gelişmiş teknik ve idari güvenlik önlemleriyle korunmaktadır. Verileriniz, yasal süreler ve hesabınız aktif kaldığı müddetçe sunucularımızda saklanmaya devam eder.</p>

      <h2>4. Çerezler (Cookies) ve Üçüncü Taraf Entegrasyonları</h2>
      <p>Oturumunuzu açık tutmak, dil ve tema tercihlerinizi hatırlamak ve sistem performansını analiz etmek amacıyla tarayıcı çerezleri kullanılmaktadır. Google ile Giriş (Google Sign-In) özelliğini kullandığınız takdirde, ilgili oturum açma işlemleri Google Gizlilik Politikası'na tabi olacaktır.</p>

      <h2>5. Kullanıcı Hakları (KVKK / GDPR)</h2>
      <p>Kişisel Verilerin Korunması Kanunu (KVKK) ve Genel Veri Koruma Yönetmeliği (GDPR) kapsamında aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme ve bilgi talep etme.</li>
        <li>Verilerinizin işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.</li>
        <li>Eksik veya yanlış işlenmiş verilerinizin düzeltilmesini veya güncellenmesini isteme.</li>
        <li>Hesabınızı silerek verilerinizin tamamen yok edilmesini talep etme.</li>
      </ul>

      <div className="legal-note-card">
        <h3>Önemli Bilgi</h3>
        <p>Hesabınızı ve çalışma alanınızı Ayarlar ekranından dilediğiniz zaman silebilirsiniz. Hesap silme işleminin ardından, sisteme yüklediğiniz tüm veriler ve özel dosyalarınız sunucularımızdan kalıcı olarak silinecektir.</p>
      </div>

      <h2>6. İletişim</h2>
      <p>Gizlilik şartlarımızla ilgili her türlü soru, görüş ve veri silme talebiniz için destek ekibimizle iletişime geçebilirsiniz.</p>
    </>
  );

  const renderTermsContent = () => (
    <>
      <p>StoaBoard web uygulamasını ve ilgili servislerini kullanarak, aşağıda belirtilen kullanım ve hizmet şartlarını tamamen kabul etmiş sayılırsınız. Lütfen bu şartları dikkatle okuyunuz.</p>

      <h2>1. Hizmet Tanımı ve Kullanım Amacı</h2>
      <p>StoaBoard; ekiplerin projelerini, panolarını, takvimlerini, notlarını ve takım içi iletişimini tek bir merkezden yönetmelerini sağlayan hafif (lightweight), gerçek zamanlı bir proje ve iş birliği yönetim platformudur. Hizmetlerimizin kapsamı, özellikleri ve teknik altyapısı zaman içerisinde güncellenebilir veya geliştirilebilir.</p>

      <h2>2. Üyelik ve Hesap Güvenliği</h2>
      <ul>
        <li>Kullanıcılar, kayıt sırasında verdikleri e-posta adresi ve diğer bilgilerin doğruluğundan sorumludur.</li>
        <li>Hesabınızın parola güvenliğini korumak tamamen sizin sorumluluğunuzdadır. Yetkisiz bir kullanım tespit ettiğinizde derhal tarafımıza bildirmeniz gerekir.</li>
        <li>StoaBoard, kötü amaçlı kullanım, spam veya sahte hesap oluşturma faaliyetlerinde bulunan kullanıcıların hesaplarını askıya alma veya sonlandırma hakkını saklı tutar.</li>
      </ul>

      <h2>3. Kullanım Kuralları ve Sorumluluklar</h2>
      <p>StoaBoard kullanırken aşağıdaki kurallara uymayı taahhüt edersiniz:</p>
      <ul>
        <li>Uygulamayı hiçbir yasa dışı, telif hakkı ihlali barındıran veya genel ahlaka aykırı amaç için kullanamazsınız.</li>
        <li>Sistem altyapısına zarar verebilecek, sunucuları aşırı yükleyecek veya diğer kullanıcıların deneyimini engelleyecek (DDoS, güvenlik açığı tarama vb.) eylemlerde bulunamazsınız.</li>
        <li>Çalışma alanına davet ettiğiniz üyelerin ve bu alanda paylaşılan içeriklerin sorumluluğu çalışma alanı yöneticisine (sahibine) aittir.</li>
      </ul>

      <h2>4. Fikri Mülkiyet</h2>
      <p>StoaBoard uygulamasına ait tüm kodlar, tasarımlar, arayüz öğeleri, logolar, marka bileşenleri ve grafiksel tasarımlar StoaBoard'un fikri mülkiyetindedir. Yazılı iznimiz olmadan kopyalanamaz, çoğaltılamaz veya ticari amaçla dağıtılamaz. Sisteme yüklediğiniz proje verileri ve içeriklerin fikri mülkiyeti ise tamamen size ve ekibinize aittir.</p>

      <h2>5. Sorumluluğun Sınırlandırılması</h2>
      <p>StoaBoard, hizmeti "olduğu gibi" ve "kullanılabilir olduğu sürece" esasıyla sunmaktadır. Hizmetin kesintisiz, hatasız veya veri kayıpsız olacağına dair açık veya zımni hiçbir garanti verilmemektedir. Olası veri kayıplarını önlemek adına önemli projelerinizi düzenli olarak dışa aktarmanız veya yedeklemeniz önerilir.</p>

      <h2>6. Hizmet Şartlarında Değişiklik</h2>
      <p>StoaBoard, bu kullanım şartlarını herhangi bir zamanda tek taraflı olarak güncelleme hakkını saklı tutar. Güncellenen şartlar web sitemizde yayınlandığı andan itibaren geçerlilik kazanacaktır. Hizmeti kullanmaya devam etmeniz, güncel şartları kabul ettiğiniz anlamına gelir.</p>

      <div className="legal-note-card">
        <h3>Kullanım Limiti ve Adil Kullanım</h3>
        <p>StoaBoard, takım verimliliğinizi korumak amacıyla sunucu kaynaklarını adil şekilde paylaştırır. Bireysel dosya yükleme limitleri, API istek frekansları ve veri saklama koşulları sistem kararlılığı için optimize edilmiştir.</p>
      </div>

      <h2>7. Yürürlük ve Uygulanacak Hukuk</h2>
      <p>Bu hizmet şartlarından doğacak ihtilaflarda Türkiye Cumhuriyeti kanunları uygulanacak ve İstanbul Mahkemeleri ile İcra Daireleri yetkili olacaktır.</p>
    </>
  );

  // Authenticated inline view (shows in dashboard workspace)
  if (authed) {
    return (
      <div className="legal-view-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-raised)',
          zIndex: 5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--accent-softer)' }}>
              <StoaLogo size={20} color="var(--accent)" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{title}</h1>
              <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{dateStr}</span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={handleClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, borderRadius: 'var(--r-sm)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            Kapat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
          <div className="legal-article" style={{
            maxWidth: 780,
            margin: '0 auto',
            fontFamily: 'var(--font-ui)',
            color: 'var(--ink-2)',
            fontSize: 14.5,
            lineHeight: 1.65
          }}>
            {isPrivacy ? renderPrivacyContent() : renderTermsContent()}
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .legal-article h2 {
            font-family: var(--font-display);
            font-size: 20px;
            font-weight: 600;
            color: var(--ink);
            margin-top: 32px;
            margin-bottom: 12px;
            letter-spacing: -0.01em;
          }
          .legal-article p {
            margin-top: 0;
            margin-bottom: 16px;
          }
          .legal-article ul {
            margin-top: 0;
            margin-bottom: 20px;
            padding-left: 20px;
          }
          .legal-article li {
            margin-bottom: 8px;
          }
          .legal-note-card {
            background: var(--bg-raised);
            border: 1px solid var(--line);
            border-left: 4px solid var(--accent);
            border-radius: var(--r-md);
            padding: 16px 20px;
            margin: 28px 0;
          }
          .legal-note-card h3 {
            margin: 0 0 6px 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--ink);
          }
          .legal-note-card p {
            margin: 0;
            font-size: 13.5px;
            color: var(--ink-muted);
          }
        `}} />
      </div>
    );
  }

  // Unauthenticated view (renders with auth dust particles and full background)
  return (
    <div className="legal-page-public" style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: 'var(--bg)',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background dust particles (matching AuthPage) */}
      <div className="dust-overlay" style={{ pointerEvents: 'none' }}>
        {particles.map(p => (
          <div
            key={p.id}
            className="dust-particle"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration
            }}
          />
        ))}
      </div>

      <div style={{
        width: '100%',
        maxWidth: 720,
        background: 'var(--bg-raised)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-lg)',
        borderRadius: 'var(--r-xl)',
        position: 'relative',
        zIndex: 10,
        padding: '36px 40px',
        animation: 'fadeIn 0.4s var(--ease)'
      }}>
        {/* Header Branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', marginBottom: 28, borderBottom: '1px solid var(--line)', paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StoaLogo size={32} />
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Stoa<em style={{ fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-muted)' }}>Board</em>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Geri Dön
          </button>
        </div>

        {/* Title and Date */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>{title}</h1>
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{dateStr}</span>
        </div>

        {/* Readable legal document content */}
        <div className="legal-article" style={{
          fontFamily: 'var(--font-ui)',
          color: 'var(--ink-2)',
          fontSize: 14.5,
          lineHeight: 1.65
        }}>
          {isPrivacy ? renderPrivacyContent() : renderTermsContent()}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .legal-article h2 {
          font-family: var(--font-display);
          font-size: 19px;
          font-weight: 600;
          color: var(--ink);
          margin-top: 32px;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .legal-article p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .legal-article ul {
          margin-top: 0;
          margin-bottom: 20px;
          padding-left: 20px;
        }
        .legal-article li {
          margin-bottom: 8px;
        }
        .legal-note-card {
          background: var(--bg-subtle);
          border: 1px solid var(--line);
          border-left: 4px solid var(--accent);
          border-radius: var(--r-md);
          padding: 16px 20px;
          margin: 28px 0;
        }
        .legal-note-card h3 {
          margin: 0 0 6px 0;
          font-size: 14.5px;
          font-weight: 600;
          color: var(--ink);
        }
        .legal-note-card p {
          margin: 0;
          font-size: 13px;
          color: var(--ink-muted);
        }
        
        /* Fade in animation */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
