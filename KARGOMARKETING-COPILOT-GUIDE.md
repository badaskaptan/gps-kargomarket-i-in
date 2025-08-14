---

## Kargomarketing & GPS Dual Backend Süreci ve Tablo Yapısı

### Kargomarketing Süreci (Supabase 1)
- Kullanıcı (müşteri) Kargomarketing’e üye olur.
- İlan açar, iş emri oluşturur.
- Supabase 1’de kullanıcı, ilan ve iş emri tabloları bulunur.
- Supabase 1’den Supabase 2’ye iş emri aktarılır (örn. ilan_no, müşteri_id ile).

### GPS Şöför Süreci (Supabase 2)
- Şöför GPS programına üye olur (auth.users ile Supabase 2’de kayıt).
- GPS verisi Supabase 2’deki gps tablosuna kaydedilir.
- Şöförler sadece Supabase 2’de kimlik doğrulaması ile işlem yapar.

### Tablo ve Akış Önerisi

Supabase 1: users (müşteri), ilanlar, is_emirleri
Supabase 2: auth.users (şöför), gps_kayitlari, is_emirleri (Kargomarketing’den gelenler)

Bu mimari ile:
- Kargomarketing ve GPS backendleri birbirinden bağımsız, yük dengeli ve güvenli olur.
- Her sistem kendi kullanıcı ve veri tabanını yönetir.
- İş emirleri ve GPS verisi ilan_no veya iş_emri_id ile eşleştirilebilir.

---
### Süreç Akışı

**KARGOMARKETING SÜRECİ (Supabase 1)**
─────────────────────────────────────────────
[Müşteri]
  │
  ├─► Kargomarketing'e üye olur
  ├─► İlan açar, iş emri oluşturur
  ├─► [İlan No] + [İş Emri] + [Şöför Adı] (büyük/küçük harf uyumlu)
  └─► Supabase 1 → görevler tablosuna yazar
      │
      └─► Aynı veri Supabase 2 → görevler tablosuna da yazılır

**ŞÖFÖR SÜRECİ (Supabase 2)**
─────────────────────────────────────────────
[Şöför]
  │
  ├─► GPS backend'e üye olur (auth.users tablosu)
  ├─► public.profiles tablosuna kaydı oluşur
  ├─► Kendi adına atanmış iş emirlerini kontrol eder (görevler tablosu)
  ├─► İş emrini kabul eder
  └─► GPS verisi göndermeye başlar (gps tablosu)

**VERİ EŞLEŞMESİ**
─────────────────────────────────────────────
Kargomarketing paneli:
  └─► [İlan No] + [Şöför Adı/Kimliği] ile Supabase 2'den verileri çeker

---

### Özet Akış

1. Müşteri Kargomarketing’de ilan ve iş emri açar, görevler tablosuna yazar.
2. Aynı iş emri Supabase 2’ye de aktarılır.
3. Şöför GPS backend’e üye olur, kendi iş emirlerini görür ve kabul eder.
4. GPS verisi Supabase 2’ye kaydedilir.
5. Kargomarketing, ilan no ve şöför kimliği ile Supabase 2’den GPS verisini çeker.

---

## Tablo Yapısı ve İlişkiler

### Kargomarketing Backend (Supabase 1)

**Tablolar:**

- users (müşteriler)
 	- id (PK)
 	- ad, soyad, email, vs.
- ilanlar
 	- id (PK)
 	- user_id (FK → users.id)
 	- ilan_no (benzersiz)
 	- başlık, açıklama, vs.
- gorevler
 	- id (PK)
 	- ilan_id (FK → ilanlar.id)
 	- ilan_no
 	- sofor_adi
 	- durum
 	- created_at

**İlişkiler:**

- ilanlar.user_id → users.id (her ilan bir kullanıcıya ait)
- gorevler.ilan_id → ilanlar.id (her görev bir ilana ait)

### GPS Backend (Supabase 2)

**Tablolar:**

- auth.users (şöförler)
 	- id (PK)
 	- email, ad, vs.
- profiles (şöför profili)
 	- id (PK, FK → auth.users.id)
 	- ad, soyad, plaka, vs.
- gorevler
 	- id (PK)
 	- ilan_no
 	- sofor_id (FK → auth.users.id)
 	- durum
 	- kabul_edildi_mi
 	- created_at
- gps_kayitlari
 	- id (PK)
 	- gorev_id (FK → gorevler.id)
 	- sofor_id (FK → auth.users.id)
 	- konum_verisi
 	- timestamp

**İlişkiler:**

- profiles.id → auth.users.id (her profil bir kullanıcıya ait)
- gorevler.sofor_id → auth.users.id (her görev bir şöföre atanabilir)
- gps_kayitlari.gorev_id → gorevler.id (her GPS kaydı bir göreve ait)
- gps_kayitlari.sofor_id → auth.users.id (her GPS kaydı bir şöföre ait)

---

## Foreign Key ve Trigger Önerileri

**FK:** Tablolar arası bağlantı için yukarıdaki FK alanlarını kullan.
**Trigger:**

- Kargomarketing’de yeni iş emri açıldığında Supabase 2’ye otomatik görev eklemek için bir trigger veya webhook kullanabilirsin.
- GPS backend’de şöför iş emrini kabul ettiğinde, durumunu güncelleyen bir trigger ekleyebilirsin.
- GPS verisi eklendiğinde, ilgili görevin durumunu “aktif” yapacak bir trigger eklenebilir.

---

## Özet

- Kargomarketing’de müşteri, ilan ve görev tablosu; GPS backend’de şöför, görev, GPS kaydı tablosu olmalı.
- Görevler ilan_no ve şöför kimliği ile iki backend arasında eşleşir.
- Foreign key ile veri bütünlüğü sağlanır.
- Trigger ile otomatik veri akışı ve durum güncellemesi yapılır.

# Kargomarketing Copilot Guide

## Yeni Durum

Bu rehberin önceki sürümünde Kargomarketing ve GPS entegrasyonu için adım adım kurulum ve hata giderme desteği sağlanıyordu.

Artık Kargomarketing backend entegrasyonu ve kodları projeden tamamen kaldırıldı.
Sadece GPS backend ile çalışan sade bir mobil uygulama kullanılmaktadır.

## Son Durum

- Kargomarketing ve Bridge API kodları kaldırıldı.
- Sadece GPS backend ile çalışan sade mobil uygulama mevcut.

## Kullanım

- Mobil uygulama sadece GPS backend ile çalışır.
- Kargomarketing entegrasyonu ve kodları projeden çıkarıldı.

---
Bu rehber artık sadece GPS backend ile çalışan sistem için referans niteliğindedir.
