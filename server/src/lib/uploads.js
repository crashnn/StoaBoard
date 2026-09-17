// Python karşılığı: api.py _store_file_in_db + multer setup
//
// Dosyaları memory'de tut → uploaded_files tablosuna bytes olarak yaz.
// (Python tarafı da DB'de saklıyordu — Railway efemer disk için.)

import multer from 'multer';
import { prisma } from '../db.js';

// Bellek-içi storage; small files için yeterli.
const storage = multer.memoryStorage();

// GERÇEK sınır burası. 16 Eylül 2026'ya kadar route'lardaki `size > 50 MB`
// (sohbet) ve `size > 20 MB` (kart eki) kontrolleri ERİŞİLEMEZ koddu: multer
// isteği zaten 10 MB'da kesiyordu, yani kullanıcıya söylenen sınır gerçek
// sınır değildi. Sayı tek yerde dursun diye dışa aktarılıyor; mesaj metni de
// buradan türetiliyor ki ikisi bir daha ayrışmasın.
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

// Avatar için ayrı, daha sıkı bir limit
export const avatarUpload = multer({
  storage,
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (!ok) return cb(new Error('Geçersiz dosya türü'));
    cb(null, true);
  },
});

/**
 * Memory'deki dosyayı uploaded_files tablosuna kaydeder.
 * Python _store_file_in_db karşılığı.
 */
export async function storeFile(file, purpose = 'chat') {
  return prisma.uploadedFile.create({
    data: {
      filename: file.originalname || 'file',
      contentType: file.mimetype || 'application/octet-stream',
      purpose,
      data: file.buffer,
      size: file.size,
    },
  });
}

/**
 * Multer'ın reddettiği isteği anlamlı bir yanıta çevirir.
 *
 * NİÇİN: multer sınırı aşan isteği `MulterError` ile reddediyor ve bu hata
 * hiçbir yerde yakalanmadığı için genel hata işleyiciye düşüyordu. Kullanıcı
 * 413 ve "dosya çok büyük" yerine 500 ve "Şu an bağlanılamıyor. Lütfen
 * birazdan tekrar deneyin." görüyordu — yani düzeltilebilir bir kullanıcı
 * hatası, sunucu arızası gibi raporlanıyordu. Sessiz başarısızlığın kardeşi:
 * yanlış sınıfta başarısızlık.
 *
 * Yükleme alan her route'a `upload.single(...)` SONRASINDA takılır.
 */
export function uploadErrorHandler(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024));
      return res.status(413).json({
        error: 'err_file_too_large',
        message: `Dosya ${mb} MB sınırını aşıyor`,
      });
    }
    return res.status(400).json({ error: 'err_invalid_file', message: 'Geçersiz dosya' });
  }
  return next(err);
}
