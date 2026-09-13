// Kişinin kendi ürettiği MCP anahtarlarının veritabanı işleri.
//
// Saf parçalar (üretim, etiket, kaydın geçerliliği) `lib/mcpToken.js`te ve
// orada test ediliyor; burası yalnızca okuma ve yazma. İki ayrı dosya
// `mcpToken.js`in "bağımlılıksız, veritabanı istemeyen" sözünü korumak için.

import { prisma } from '../db.js';
import { hashToken, kayittanKullanici, MIN_TOKEN_LENGTH } from './mcpToken.js';

/** Son kullanım yazımı en fazla bu aralıkla — her MCP isteğinde bir UPDATE olmasın. */
const SON_KULLANIM_ARALIGI_MS = 5 * 60 * 1000;

/**
 * Sunulan anahtarın veritabanındaki sahibi; geçersizse `null`.
 *
 * Arama özetle ve benzersiz indeksle yapılıyor, yani karşılaştırma anahtarın
 * içeriğine göre kısalmıyor. İptal edilmiş anahtar yok sayılıyor ve çağıran
 * onu geçersiz anahtarla aynı 401'e çeviriyor: "bu anahtar vardı ama iptal
 * edildi" bilgisi anahtarı eline geçirmiş birine yarar, sahibine yaramaz.
 *
 * İptal edilmiş anahtarda `sahip` dolu dönüyor — kimlik vermek için değil,
 * başarısız denemenin denetim satırını sahibine bağlamak için.
 *
 * @returns {Promise<{ user: object|null, tokenId: number, iptal: boolean, sahip?: object } | null>}
 */
export async function anahtarSahibiniBul(sunulan) {
  if (typeof sunulan !== 'string' || sunulan.length < MIN_TOKEN_LENGTH) return null;
  const satir = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(sunulan) },
    include: { user: true },
  });
  if (!satir) return null;
  const user = kayittanKullanici(satir);
  if (!user) {
    return { user: null, tokenId: satir.id, iptal: Boolean(satir.revokedAt), sahip: satir.user || null };
  }

  // Son kullanım bilgisi "hangi anahtar hâlâ kullanılıyor" sorusu için; isteği
  // bekletmemeli ve yazılamaması kimliği bozmamalı.
  const simdi = Date.now();
  if (!satir.lastUsedAt || simdi - new Date(satir.lastUsedAt).getTime() > SON_KULLANIM_ARALIGI_MS) {
    prisma.mcpToken.update({ where: { id: satir.id }, data: { lastUsedAt: new Date(simdi) } })
      .catch((err) => console.warn('[mcp] son kullanım yazılamadı:', err.message));
  }
  return { user, tokenId: satir.id, iptal: false };
}

/**
 * Bir kullanıcının bütün etkin anahtarlarını iptal eder; iptal edilen sayıyı döner.
 *
 * Parola sıfırlanınca ya da değişince çağrılıyor. Oturumlarla aynı ders
 * (GUVENLIK.md, "parola değiştirmek erişimi kesmiyorsa işe yaramaz"): hesabı
 * ele geçiren biri kendine bir MCP anahtarı üretirse, kurbanın parolasını
 * değiştirmesi o anahtarı öldürmeli. Öldürmeseydi anahtar, oturumlar düşse
 * bile içeride kalmanın yolu olurdu.
 *
 * Ortam değişkenindeki anahtarlar kapsam dışı — onlar Railway'de yönetiliyor ve
 * parola akışının onlara erişimi yok.
 */
export async function kullanicininAnahtarlariniIptalEt(userId) {
  if (!userId) return 0;
  try {
    const { count } = await prisma.mcpToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  } catch (err) {
    // Parola değişikliğinin kendisi başarılı; burada patlamak kullanıcıyı yarım
    // bir işlemle bırakırdı. Ama sessiz de geçmiyor.
    console.warn('[mcp] anahtarlar iptal edilemedi:', err.message);
    return 0;
  }
}
