// İzin mantığı — saf, bağımlılıksız.
//
// Veritabanından ayrı tutuluyor: yetkilendirme kodun en kritik parçası ve
// test edilebilmesi için bir veritabanına ihtiyaç duymamalı.

/**
 * Sunucunun tanıdığı bütün izinler.
 *
 * Bu liste, arayüzdeki izin listesiyle (client/src/views/settings.jsx içindeki
 * PERM_LABELS_KEYS) birebir aynı olmak zorunda. Uyuşmazlık iki yönde de
 * tehlikeli:
 *   - Arayüzde olup burada olmayan izin: yönetici verdiğini sandığı yetkiyi
 *     vermemiş olur (1 Eylül 2026'da 'invite_members' böyleydi).
 *   - Burada olup arayüzde olmayan izin: hiçbir role verilemez, pratikte
 *     yalnızca sahip erişebilir ('manage_workspace' böyleydi).
 * Bu eşleşme testle korunuyor.
 */
export const ALL_PERMISSIONS = [
  'manage_tasks',
  'manage_projects',
  'manage_labels',
  'invite_members',
  'manage_members',
  'manage_channels',
  'delete_messages',
  'view_reports',
  'manage_workspace',
];

/**
 * Üyenin sahip olduğu izinlerin listesi.
 *
 * Sahip için tüm izinler döner. Önceden sabit üç izinlik eski bir liste
 * dönüyordu; hasPermission sahibi kısa devre yaptığı için fark edilmiyordu ama
 * bu fonksiyonu doğrudan çağıran her yer (örn. lib/notes.js) sahibi yanlışlıkla
 * yetkisiz sayabilirdi.
 */
export function memberPermissions(member) {
  if (!member) return [];
  if (member.role === 'owner') return [...ALL_PERMISSIONS];
  if (member.workspaceRole) {
    const perms = member.workspaceRole.permissions;
    return Array.isArray(perms) ? perms : [];
  }
  return [];
}

/**
 * Üyenin belirli bir izni var mı?
 *
 * Üye yoksa daima false — kapalı başarısızlık.
 */
export function hasPermission(member, permission) {
  if (!member) return false;
  if (member.role === 'owner') return true;
  return memberPermissions(member).includes(permission);
}

/** Verilen izinlerden en az birine sahip mi? */
export function hasAnyPermission(member, permissions = []) {
  return permissions.some((p) => hasPermission(member, p));
}
