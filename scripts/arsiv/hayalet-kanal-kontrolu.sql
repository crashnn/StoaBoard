-- Hayalet kanal kontrolü — SALT OKUNUR, hiçbir şeyi değiştirmez.
--
-- Nerede çalıştırılır: Neon konsolu → stoaboard projesi → SQL Editor
-- (tarayıcı içinden, HTTPS üzerinden çalışır; 5432 portuna ihtiyaç yok)
--
-- Ne arıyor: kanal satırı olmayan bir slug'a yazılmış sohbet mesajları.
-- Bunlar kanal listesinde görünmeyen, üyeliği ve moderasyonu olmayan
-- "hayalet kanallar"dı. Kusur 1 Eylül 2026'da kapatıldı; bu sorgu geçmişte
-- oluşmuş kayıt var mı diye bakıyor.
--
-- Boş sonuç = temiz, yapacak bir şey yok.

select
  m.workspace_id,
  m.channel,
  count(*)          as mesaj_sayisi,
  count(distinct m.sender_id) as kisi_sayisi,
  min(m.created_at) as ilk_mesaj,
  max(m.created_at) as son_mesaj
from chat_messages m
where m.receiver_id is null          -- kanal mesajı (DM değil)
  and m.channel is not null
  and m.channel <> 'general'         -- general'ın kanal satırı olmayabilir, normal
  and not exists (
    select 1
    from channels c
    where c.workspace_id = m.workspace_id
      and c.slug = m.channel
  )
group by m.workspace_id, m.channel
order by mesaj_sayisi desc;


-- Sonuç boş çıkmazsa, silmeden ÖNCE içeriğine bak. Aşağıdaki sorgu
-- bulunanların ilk birkaç mesajını gösterir; <SLUG> yerine üstteki
-- sonuçtan gelen kanal adını yaz.
--
-- select m.id, m.created_at, u.name, left(m.text, 120) as onizleme
-- from chat_messages m
-- left join users u on u.id = m.sender_id
-- where m.receiver_id is null and m.channel = '<SLUG>'
-- order by m.created_at
-- limit 20;
