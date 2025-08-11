import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  Text,
  Button,
  Alert,
  ActivityIndicator,
  FlatList,
  View,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';

// TEMP: react-native-web "props.pointerEvents is deprecated. Use style.pointerEvents" uyarısını
// üçüncü parti bileşen (navigasyon / gesture) tetikliyor. Kodumuzda pointerEvents prop'u yok.
// Geçici olarak bu spesifik uyarıyı bastırıyoruz; kalıcı çözüm: ilgili paket güncellendiğinde kaldır.
if (typeof console !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('props.pointerEvents is deprecated')) return;
    origWarn(...args);
  };
}

// ✅ Şoför sadece GPS Backend'ine bağlı (ÇALIŞAN PROJE)
// Kullanıcıdan gelen mevcut çalışan proje referansı (iawqwfbvbigtbvipddao)
const SUPABASE_URL = 'https://iawqwfbvbigtbvipddao.supabase.co';
// Bu ANON KEY kullanıcı mesajında paylaşılan anahtar ile eşleşiyor
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3F3ZmJ2YmlndGJ2aXBkZGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDczNzgsImV4cCI6MjA3MDQ4MzM3OH0._ogKEgwB53m-BrIxVjxi9xfOCZ3JyWvix2MPHNaOdrg';

// Bridge API endpoint'leri (Edge Functions)
// 🌉 Bridge API URL (GPS Backend Edge Functions)
// İsteğe bağlı: Bridge API (şimdilik gerek yok, direkt tablo yazıyoruz)
const BRIDGE_API_URL = 'https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/bridge-api'

// ✅ TEK BACKEND: Sadece GPS sistemi  
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Realtime kapatma: herhangi bir channel açmayacağız. (Supabase-js v2'de direkt disable flag yok)
});

// NOT: Service role key kaldırıldı. 401 hatası muhtemelen yanlış / eski key yüzünden.
// Supabase JS client + anon key ve RLS politikaları ile çalışıyoruz.
async function selectIlanAtanmamis(ilanNo: string) {
  const { data, error } = await supabase
    .from('gorevler')
    .select('*')
    .eq('ilan_no', ilanNo)
    .eq('sefer_durumu', 'atanmamis')
    .limit(1);
  if (error) throw error;
  return data?.[0];
}

async function selectIlanAny(ilanNo: string) {
  const { data, error } = await supabase
    .from('gorevler')
    .select('*')
    .eq('ilan_no', ilanNo)
    .limit(1);
  if (error) throw error;
  return data?.[0];
}

async function updateGorev(rowId: string, patch: any) {
  const { data, error } = await supabase
    .from('gorevler')
    .update(patch)
    .eq('id', rowId)
    .select();
  if (error) throw error;
  return data?.[0];
}

const BG_TASK = 'gps_location_task';

// Arka plan task (mobil) – basitleştirilmiş doğrudan tablo güncellemesi
TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = data as any;
  const loc = locations?.[0];
  if (!loc) return;
  const { latitude, longitude, speed, accuracy, heading, timestamp } = loc.coords;
  try {
    // Aktif görev: sefer_durumu 'devam_ediyor' olan ve mevcut şoföre ait ilk satır
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) return;
    const uid = authData?.user?.id;
    if (!uid) return;

    const { data: aktif } = await supabase
      .from('gorevler')
      .select('id')
      .eq('sefer_durumu', 'devam_ediyor')
      .eq('sofor_id', uid)
      .limit(1);
    const g = aktif?.[0];
    if (!g) return;
    await supabase
      .from('gorevler')
      .update({
        konum_verisi: {
          lat: latitude,
          lon: longitude,
          speed,
          accuracy,
          bearing: heading,
          ts: new Date(timestamp).toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', g.id);
  } catch {}
});

function AuthScreen({ setSession }: { setSession: (session: any) => void }) {
  const [email, setEmail] = React.useState('test@test.com');
  const [password, setPassword] = React.useState('test123');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange listener already updates session
      Alert.alert('Giriş başarılı', `Kullanıcı: ${data.user?.email}`);
    } catch (e: any) {
      setError(e?.message || 'Giriş başarısız');
      Alert.alert('Giriş başarısız', e?.message || '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 20 }}>GPS Sefer Takip</Text>
  <Text style={{ fontSize: 16, marginBottom: 10 }}>Email:</Text>
  <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ padding: 8, backgroundColor: '#f0f0f0', marginBottom: 10 }} />
  <Text style={{ fontSize: 16, marginBottom: 10 }}>Şifre:</Text>
  <TextInput value={password} onChangeText={setPassword} secureTextEntry style={{ padding: 8, backgroundColor: '#f0f0f0', marginBottom: 20 }} />
  <Button title={loading ? "Giriş yapılıyor..." : "Giriş Yap"} onPress={signIn} disabled={loading} />
  {!!error && <Text style={{ color: 'red', marginTop: 8 }}>{error}</Text>}
      <Text style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
        Not: Önce Supabase Auth'da test@test.com kullanıcısını oluşturun.
      </Text>
    </SafeAreaView>
  );
}

function TasksScreen() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [ilanNo, setIlanNo] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [lastInfo, setLastInfo] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Aktif görevler (beklemede + devam_ediyor), arşivli olmayanlar
      const { data: active, error: errActive } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', userId || '')
        .in('sefer_durumu', ['beklemede', 'devam_ediyor'])
        .eq('arsivli', false)
        .order('created_at', { ascending: false });

      if (errActive) throw errActive;

      // Son tamamlanan (yalnızca 1 tane), arşivli olmayan
      const { data: lastDoneArr, error: errDone } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', userId || '')
        .eq('sefer_durumu', 'tamamlandı')
        .eq('arsivli', false)
        .order('bitis_zamani', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (errDone) throw errDone;

      const combined = [...(active ?? []), ...(lastDoneArr?.[0] ? [lastDoneArr[0]] : [])];
      setTasks(combined);
    } catch (e) {
      console.log('Görev yükleme hatası:', e);
    } finally {
      setLoading(false);
    }
  };

  // ✅ DOĞRU MİMARİ: Sadece kendi backend'inden ilan bul
  const connectToIlan = async () => {
    const notify = (title: string, msg?: string) => {
      const text = msg ? `${title}\n\n${msg}` : title;
      if (typeof window !== 'undefined') {
        window.alert(text);
      } else {
        Alert.alert(title, msg || '');
      }
      setLastInfo(text);
    };

    if (!ilanNo.trim()) {
      notify('Hata', 'İlan numarası boş olamaz');
      return;
    }

    setConnecting(true);
    try {
      console.log('🔍 İlan aranıyor:', ilanNo.trim());

      // İlan numarasına göre boşta (atanmamış) kayıt ara
      let gpsTask: any = null;
      try {
        gpsTask = await selectIlanAtanmamis(ilanNo.trim());
      } catch (e) {
        console.log('Select ilan hatası:', e);
      }
      if (!gpsTask) {
        // Fallback: ilan var ama atanabilir durumda olmayabilir; mevcut durumunu gösterelim
        let anyTask: any = null;
        try {
          anyTask = await selectIlanAny(ilanNo.trim());
        } catch (e) {
          console.log('Fallback ilan sorgu hatası:', e);
        }
        if (anyTask) {
          notify(
            'İlan atanamaz durumda',
            `İlan bulundu fakat durumu: ${anyTask.sefer_durumu}.\n\n` +
              `Atanabilir olması için sefer_durumu = 'atanmamis' olmalı.\n` +
              `Gerekiyorsa SQL ile güncelleyin: UPDATE gorevler SET sefer_durumu='atanmamis' WHERE ilan_no='${ilanNo.trim()}';`
          );
        } else {
          notify(
            'İlan Bulunamadı',
            `İlan numarası "${ilanNo}" GPS sisteminde bulunamadı.\n\n` +
              'Bu ilan henüz kargomarketing.com tarafından GPS sistemine gönderilmemiş olabilir.\n\n' +
              'Bridge sistemi çalışıyor mu kontrol edin veya test için kayıt ekleyin.'
          );
        }
        setConnecting(false);
        return;
      }

      console.log('✅ İlan bulundu:', gpsTask);

      // 3. Şoförü göreve ata (test user)
      try {
        if (!userId) throw new Error('Kullanıcı oturumu yok');
        await updateGorev(gpsTask.id, { sofor_id: userId, sefer_durumu: 'beklemede', updated_at: new Date().toISOString() });
      } catch (e: any) {
        notify('Atama Hatası', 'Görev ataması yapılamadı: ' + e.message);
        setConnecting(false);
        return;      }

      // 4. Bridge API'ye bilgilendirme gönder (Edge Function)
  console.log('Görev atandı (beklemede).');

      // 5. Başarı mesajı
      notify(
        'Bağlantı Başarılı! ✅',
        `İlan "${ilanNo}" ile bağlantı kuruldu.\n\n` +
          `Müşteri: ${gpsTask.customer_info?.name || 'Bilgi yok'}\n` +
          `Telefon: ${gpsTask.customer_info?.phone || 'Bilgi yok'}\n\n` +
          'Artık GPS takibi başlatabilirsiniz!'
      );
      
      setShowConnectModal(false);
      setIlanNo('');
      load(); // Görev listesini yenile

    } catch (error: any) {
      const msg = error?.message || 'GPS sistemi bağlantısı sırasında hata oluştu';
      const text = `Bağlantı Hatası\n\n${msg}`;
      if (typeof window !== 'undefined') window.alert(text); else Alert.alert('Bağlantı Hatası', msg);
      setLastInfo(text);
    }
    setConnecting(false);
  };

  useEffect(() => { if (userId) load(); }, [userId]);

  // ✅ GPS verilerini Backend2'de depola, Bridge API ile Backend1'e anlık gönder
  const sendLocationUpdate = async (taskId: string, location: any) => {
    try {
      await supabase
        .from('gorevler')
        .update({ konum_verisi: location, updated_at: new Date().toISOString() })
        .eq('id', taskId);
    } catch (e) { console.log('Konum güncelleme hatası:', e); }
  };

  const startSefer = async (id: string) => {
  await updateGorev(id, { sefer_durumu: 'devam_ediyor', baslama_zamani: new Date().toISOString(), updated_at: new Date().toISOString() });
    await ensureTracking();
    load();
  };

  const stopSefer = async (id: string) => {
    // Web'de Alert.alert çalışmaz, confirm kullan
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        'Seferi sonlandırmak istediğinize emin misiniz?\n\nSefer manuel sonlandırıldığında yeni emir gelmeden tekrar başlatılamaz.'
      );
      if (confirmed) {
        try {
          console.log('Sefer sonlandırılıyor:', id);
          await updateGorev(id, { sefer_durumu: 'tamamlandı', bitis_zamani: new Date().toISOString(), updated_at: new Date().toISOString() });
          await stopTracking();
          load();
        } catch (error) {
          console.error('Sefer sonlandırma hatası:', error);
        }
      }
      return;
    }

    // Mobil platform için Alert
    Alert.alert(
      'Seferi Sonlandır',
      'Seferi sonlandırmak istediğinize emin misiniz? Sefer manuel sonlandırıldığında yeni emir gelmeden tekrar başlatılamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Evet', style: 'destructive', onPress: async () => { 
          await updateGorev(id, { sefer_durumu: 'tamamlandı', bitis_zamani: new Date().toISOString(), updated_at: new Date().toISOString() });
          await stopTracking();
          load();
        }},
      ]
    );
  };

  const archiveTask = async (id: string) => {
    try {
      await updateGorev(id, { arsivli: true, updated_at: new Date().toISOString() });
      load();
    } catch (e) {
      console.log('Arşivleme hatası:', e);
      Alert.alert('Arşivleme Hatası', 'Görev arşivlenemedi');
    }
  };

  const ensureTracking = async () => {
    // Web'de TaskManager çalışmaz, basit konum takibi yapalım
    if (typeof window !== 'undefined') {
      // Web platformu
      if (!navigator.geolocation) {
        Alert.alert('Konum desteği yok', 'Tarayıcınız konum desteği sunmuyor');
        return;
      }

      // Zaten bir interval çalışıyorsa yenisini başlatma (çoğalmayı engelle)
      if ((window as any).locationInterval) {
        console.log('Web konum takibi zaten aktif, yeni interval başlatılmıyor');
        return;
      }
      
      // Konum izni iste
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        console.log('Web konum alındı:', position.coords);
        
        // Web'de 5 saniyede bir konum al (basit timer)
        const interval = setInterval(async () => {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude, speed, accuracy, heading } = pos.coords;
            try {
              const { data: activeArr, error: activeErr } = await supabase
                .from('gorevler')
                .select('id')
                .eq('sefer_durumu', 'devam_ediyor')
                .eq('sofor_id', userId || '')
                .limit(1);
              if (activeErr) throw activeErr;
              const g = activeArr?.[0];
              if (!g) {
                console.log('Aktif görev bulunamadı, konum takibi durduruluyor');
                clearInterval(interval);
                (window as any).locationInterval = null;
                return;
              }
              
              console.log('Konum güncelleniyor:', { g_id: g.id, lat: latitude, lon: longitude });
              const locationPayload = {
                lat: latitude,
                lon: longitude,
                speed,
                accuracy,
                bearing: heading,
                ts: new Date().toISOString(),
              };
              await updateGorev(g.id, { konum_verisi: locationPayload, updated_at: new Date().toISOString() });
              console.log('Konum gönderildi:', locationPayload);
            } catch (err) {
              console.error('Konum gönderme hatası:', err);
            }
          });
        }, 5000);
        
        // Global'e kaydet ki durdurabilelim
        (window as any).locationInterval = interval;
        
      } catch (error) {
        Alert.alert('Konum izni', 'Konum izni verilmedi');
      }
      return;
    }

    // Mobil platform (orijinal kod)
  const { granted } = await Location.requestForegroundPermissionsAsync();
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!granted || bg.status !== 'granted') { Alert.alert('Konum izni gerekli'); return; }
    const hasStarted = await TaskManager.isTaskRegisteredAsync(BG_TASK);
    const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (!hasStarted || !running) {
      await Location.startLocationUpdatesAsync(BG_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: 'Sefer Takibi Açık',
          notificationBody: 'Konumunuz arka planda güncelleniyor',
        },
      });
    }
  };

  const stopTracking = async () => {
    // Web'de interval'i durdur
    if (typeof window !== 'undefined') {
      const interval = (window as any).locationInterval;
      if (interval) {
        clearInterval(interval);
        (window as any).locationInterval = null;
        console.log('Web konum takibi durduruldu');
      }
      return;
    }

    // Mobil platform
    const running = await Location.hasStartedLocationUpdatesAsync(BG_TASK);
    if (running) await Location.stopLocationUpdatesAsync(BG_TASK);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} /> as any;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      {/* İlan Bağlantı Butonu */}
      <View style={{ marginBottom: 16, backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>📋 İlan Bağlantısı</Text>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
          Kargomarketing.com'dan aldığınız ilan numarası ile bağlantı kurun
        </Text>
        <Button 
          title="İlan No ile Bağlan" 
          onPress={() => setShowConnectModal(true)}
          color="#007AFF"
        />
        {!!lastInfo && (
          <Text style={{ marginTop: 10, color: '#495057' }}>{lastInfo}</Text>
        )}
      </View>

      {/* İlan Bağlantı Modal */}
      {showConnectModal && (
        <View style={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <View style={{ 
            backgroundColor: 'white', 
            padding: 20, 
            borderRadius: 10, 
            width: '80%',
            maxWidth: 400
          }}>
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
              📋 İlan Numarası Girin
            </Text>
            <Text style={{ marginBottom: 12, color: '#666' }}>
              Kargomarketing.com'dan aldığınız ilan numarasını girin:
            </Text>
            <TextInput 
              value={ilanNo}
              onChangeText={setIlanNo}
              placeholder="Örn: KRG2025001"
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button 
                title="İptal"
                onPress={() => setShowConnectModal(false)}
                color="#6c757d"
              />
              <Button 
                title={connecting ? 'Bağlanıyor...' : 'Bağlan'}
                onPress={connectToIlan}
                disabled={connecting}
                color="#007AFF"
              />
            </View>
          </View>
        </View>
      )}

      {/* Görev Listesi */}
      {tasks.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#666' }}>
            Henüz görev bulunmuyor
          </Text>
          <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' }}>
            Üstteki "İlan No ile Bağlan" butonunu kullanarak yeni görev bağlantısı kurabilirsiniz
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff', marginBottom: 8, borderRadius: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontWeight: '600', fontSize: 16 }}>📦 {item.ilan_no}</Text>
                <Text style={{ 
                  color: item.sefer_durumu === 'devam_ediyor' ? '#28a745' : item.sefer_durumu === 'beklemede' ? '#ffc107' : '#6c757d',
                  fontWeight: '500'
                }}>
                  {item.sefer_durumu}
                </Text>
              </View>
              
              {item.customer_info && (
                <Text style={{ color: '#666', marginBottom: 4 }}>
                  Müşteri: {item.customer_info.name || 'Belirtilmemiş'}
                </Text>
              )}
              
              {item.delivery_address && (
                <Text style={{ color: '#666', marginBottom: 8 }}>
                  Adres: {item.delivery_address.city || 'Belirtilmemiş'}
                </Text>
              )}
              
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {item.sefer_durumu === 'beklemede' && (
                  <Button title="✅ Sefer Başlat" onPress={() => startSefer(item.id)} color="#28a745" />
                )}
                {item.sefer_durumu !== 'tamamlandı' && (
                  <Button title="🛑 Seferi Sonlandır" color="#dc3545" onPress={() => stopSefer(item.id)} />
                )}
                {item.sefer_durumu === 'tamamlandı' && (
                  <Button title="📦 Arşivle" color="#6c757d" onPress={() => archiveTask(item.id)} />
                )}
              </View>
            </View>
          )}
        />
      )}
      
      <View style={{ height: 12 }} />
      <Button title="🔄 Yenile" onPress={load} />
    </SafeAreaView>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setReady(true);
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
      });
      return () => {
        authListener.subscription.unsubscribe();
      };
    })();
  }, []);

  if (!ready) return <ActivityIndicator style={{ marginTop: 50 }} /> as any;

  return (
    <NavigationContainer>
      {session ? <TasksScreen /> : <AuthScreen setSession={setSession} />}
    </NavigationContainer>
  );
}
