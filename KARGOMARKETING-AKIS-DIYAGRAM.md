# KargoMarketing GPS Takip - Görsel Akış Diyagramı

## 🎯 SİSTEM AKIŞ ŞEMASI

```mermaid
graph TD
    A[KargoMarketing Dashboard] --> B[İş Emri Oluştur Butonu]
    B --> C[Modal Açılır]
    C --> D[Zorunlu Alanları Doldur]
    D --> E{Form Valid mi?}
    E -->|Hayır| C
    E -->|Evet| F[Supabase 2 API Çağrısı]
    F --> G[Authentication Check]
    G --> H{API Key Doğru mu?}
    H -->|Hayır| I[Hata Mesajı]
    H -->|Evet| J[gorevler Tablosuna INSERT]
    J --> K[TC Kimlik Trigger Çalışır]
    K --> L{Şoför Bulundu mu?}
    L -->|Hayır| M[durum: sofor_bulunamadi]
    L -->|Evet| N[durum: atandi]
    M --> O[Kart Oluştur - Hata Durumu]
    N --> P[Kart Oluştur - Başarı]
    P --> Q[Şoför Mobil App Bildirim]
    Q --> R{Şoför Kabul Etti mi?}
    R -->|Hayır| S[kabul_edildi_mi: false]
    R -->|Evet| T[kabul_edildi_mi: true]
    T --> U[GPS Tracking Başlar]
    U --> V[Real-time Konum Güncelleme]
    V --> W[Dashboard Kartı Otomatik Güncellenir]
    
    style A fill:#e1f5fe
    style F fill:#fff3e0
    style J fill:#e8f5e8
    style U fill:#fce4ec
    style W fill:#f3e5f5
```

## 📊 VERİ AKIŞ DİYAGRAMI

```mermaid
sequenceDiagram
    participant KM as KargoMarketing Frontend
    participant API as Supabase API
    participant DB as PostgreSQL Database
    participant TRG as Triggers/Functions
    participant APP as Şoför Mobile App
    
    KM->>API: 1. authenticate_kargomarketing_api()
    API-->>KM: Authentication Success
    
    KM->>API: 2. INSERT gorevler table
    API->>DB: Store job data
    
    DB->>TRG: 3. auto_assign_driver() trigger
    TRG->>DB: Search driver by TC
    
    alt Şoför Bulundu
        TRG->>DB: Update sofor_id, durum='atandi'
        DB-->>KM: Success Response
        DB->>APP: Notification (şoför assigned)
        
        APP->>DB: Accept job (kabul_edildi_mi=true)
        DB->>TRG: notify_task_status_change() trigger
        TRG-->>KM: Real-time update
        
        APP->>DB: Start GPS tracking
        DB->>TRG: update_gps_tracking() trigger
        TRG-->>KM: Location updates
    else Şoför Bulunamadı
        TRG->>DB: Update durum='sofor_bulunamadi'
        DB-->>KM: Error Response
    end
```

## 🏗️ TABLO İLİŞKİ DİYAGRAMI

```mermaid
erDiagram
    GOREVLER {
        uuid id PK
        varchar ilan_no UK "KargoMarketing"
        varchar tc_kimlik "KargoMarketing"
        varchar sofor_adi "KargoMarketing"
        text teslimat_adresi "KargoMarketing"
        text musteri_bilgisi "KargoMarketing"
        uuid sofor_id FK "System Assigned"
        boolean kabul_edildi_mi "Driver Response"
        decimal son_konum_lat "GPS Data"
        decimal son_konum_lng "GPS Data"
        varchar sefer_durumu "Driver Status"
        varchar durum "System Status"
    }
    
    PROFILES {
        uuid id PK
        varchar ad
        varchar soyad
        varchar tc_kimlik UK
        boolean aktif
    }
    
    GPS_KAYITLARI {
        uuid id PK
        uuid gorev_id FK
        uuid sofor_id FK
        decimal latitude
        decimal longitude
        timestamp recorded_at
    }
    
    ADMIN_LOGS {
        bigint id PK
        varchar log_type
        varchar tc_kimlik
        jsonb error_details
        timestamp created_at
    }
    
    GOREVLER ||--o{ GPS_KAYITLARI : "tracks"
    PROFILES ||--o{ GOREVLER : "assigned to"
    PROFILES ||--o{ GPS_KAYITLARI : "creates"
    GOREVLER ||--o{ ADMIN_LOGS : "logs errors"
```

## 🔄 KargoMarketing DASHBOARD AKIŞ

```mermaid
flowchart LR
    subgraph "KargoMarketing Dashboard"
        A[GPS Takip Bölümü] --> B[İş Emri Oluştur Butonu]
        B --> C[Modal Form]
        C --> D[Form Submit]
        D --> E[API Call]
        E --> F{Success?}
        F -->|Yes| G[Modal Kapatılır]
        F -->|No| H[Hata Mesajı]
        G --> I[Yeni Kart Oluşturulur]
        I --> J[Otomatik Yenileme]
        J --> K[Kart Güncellenir]
        
        subgraph "Kart İçeriği"
            L[Gönderilen Bilgiler]
            M[Sistem Durumu]
            N[GPS Konum]
            O[Yenile Butonu]
        end
        
        I --> L
        K --> M
        K --> N
        O --> J
    end
    
    style A fill:#e3f2fd
    style G fill:#e8f5e8
    style H fill:#ffebee
    style I fill:#f3e5f5
```

## 📱 MOBİL APP vs DASHBOARD SYNC

```mermaid
graph TB
    subgraph "KargoMarketing Dashboard"
        A[İş Emri Kartı]
        B[Durum: Bekliyor]
        C[Konum: Yok]
        D[Yenile Butonu]
    end
    
    subgraph "Supabase Database"
        E[gorevler Table]
        F[gps_kayitlari Table]
        G[Real-time Triggers]
    end
    
    subgraph "Şoför Mobile App"
        H[Görev Bildirimi]
        I[Kabul Et Butonu]
        J[GPS Tracking]
        K[Konum Gönder]
    end
    
    A -.->|SELECT Query| E
    E -->|Notify| H
    I -->|UPDATE| E
    E -->|Trigger| G
    G -.->|Real-time| A
    J -->|INSERT| F
    F -->|Trigger| G
    K -.->|Location Data| C
    D -->|Manual Refresh| E
    
    style A fill:#e1f5fe
    style E fill:#fff3e0
    style H fill:#e8f5e8
```

Bu görsel diyagramlar KargoMarketing ekibinin sistem akışını daha iyi anlamasını sağlayacak! 🎯
