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
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated
} from 'react-native';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// GPS Backend'e bağlantı
const SUPABASE_URL = 'https://iawqwfbvbigtbvipddao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhd3F3ZmJ2YmlndGJ2aXBkZGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDczNzgsImV4cCI6MjA3MDQ4MzM3OH0._ogKEgwB53m-BrIxVjxi9xfOCZ3JyWvix2MPHNaOdrg';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default function App() {
  // Oturum ve görevler için state
  const [session, setSession] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  // Arşivlenmiş tamamlanmış görev ID listesi
  const [archivedTaskIds, setArchivedTaskIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false); // Arşivdeki görevleri görüntüleme anahtarı
  const [registerData, setRegisterData] = useState({
    ad: '',
    soyad: '',
    tc_kimlik: '',
    email: '',
    telefon: '',
    password: ''
  });
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rainbowAnim] = useState(new Animated.Value(0));
  const [showLogin, setShowLogin] = useState(true); // true: giriş, false: kayıt

  // GPS Tracking states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null);
  // Arşiv bilgilerini oturum değiştiğinde yükle
  useEffect(() => {
    const loadArchived = async () => {
      try {
        const raw = await AsyncStorage.getItem('archived_tasks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setArchivedTaskIds(parsed);
        }
      } catch (e) {
        console.warn('Arşiv yükleme hatası', e);
      }
    };
    loadArchived();
  }, [session?.user?.id]);

  const archiveTask = async (taskId: string) => {
    try {
      if (archivedTaskIds.includes(taskId)) return;
      const updated = [...archivedTaskIds, taskId];
      setArchivedTaskIds(updated);
      await AsyncStorage.setItem('archived_tasks', JSON.stringify(updated));
    } catch (e: any) {
      Alert.alert('Hata', 'Görev arşivlenemedi: ' + (e?.message || ''));
    }
  };

  const clearArchive = async () => {
    if (!archivedTaskIds.length) return;
    Alert.alert('Arşivi Temizle', 'Tüm arşivlenmiş görevler listeden geri dönecek. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Temizle', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.removeItem('archived_tasks');
            setArchivedTaskIds([]);
          } catch (e: any) {
            Alert.alert('Hata', 'Arşiv silinemedi: ' + (e?.message || ''));
          }
        }
      }
    ]);
  };

  // GPS veri gönderme fonksiyonu (KargoMarketing uyumlu format)
  const sendGPSData = async (location: any, taskId: string, userId: string) => {
    try {
      // Device bilgilerini topla
      const deviceInfo = {
        model: Device.modelName || 'Unknown',
        os: `${Device.osName || 'Unknown'} ${Device.osVersion || ''}`,
        app_version: Application.nativeApplicationVersion || '1.0.0',
        battery_level: 85, // Static değer - gerçek batarya API'si için expo-battery gerekli
        signal_strength: 4 // Static değer - gerçek sinyal gücü API'si gerekli
      };

      // GPS metadata
      const gpsMetadata = {
        satellites: 8, // Static değer - expo-location bu bilgiyi sağlamıyor
        hdop: 1.2, // Static değer
        altitude: location.coords.altitude || 0,
        speed_accuracy: location.coords.speed || 0,
        bearing_accuracy: location.coords.heading || 0
      };

      // KargoMarketing uyumlu konum_verisi JSONB
      const konum_verisi = {
        device_info: deviceInfo,
        gps_metadata: gpsMetadata,
        timestamp_device: new Date().toISOString(),
        location_source: "GPS",
        collection_method: "automatic"
      };

      // GPS kaydını veritabanına ekle
      const { data, error } = await supabase
        .from('gps_kayitlari')
        .insert({
          gorev_id: taskId,
          sofor_id: userId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          hiz: location.coords.speed || 0,
          yon: location.coords.heading || 0,
          dogruluk: location.coords.accuracy || 0,
          konum_verisi: konum_verisi  // ✅ JSONB alan dolduruldu
        });

      if (error) {
        console.error('GPS veri gönderme hatası:', error);
        return false;
      }
      
      console.log('✅ GPS verisi KargoMarketing uyumlu formatta gönderildi:', data);
      console.log('📋 Gönderilen konum_verisi:', JSON.stringify(konum_verisi, null, 2));
      console.log('🔄 Trigger tetiklenmelidir: gorevler ve gps_tracking güncellenecek');
      console.log('📍 Koordinat:', location.coords.latitude, location.coords.longitude);
      console.log('🎯 Görev ID:', taskId, 'Şoför ID:', userId);
      return true;
    } catch (error) {
      console.error('GPS veri gönderme hatası:', error);
      return false;
    }
  };

  // Debug: Gerçek veritabanı durumu kontrolü
  const checkRealDatabaseStatus = async () => {
    if (!session?.user?.id) {
      Alert.alert('Hata', 'Oturum bulunamadı');
      return;
    }

    try {
      console.log('🔍 Gerçek veritabanı durumu kontrol ediliyor...');
      console.log('👤 User ID:', session.user.id);

      // 1. Bu kullanıcının profil bilgilerini kontrol et
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      console.log('📋 Kullanıcı Profili:', profile);
      console.log('❌ Profil Hatası:', profileError);

      if (!profile || !profile.tc_kimlik) {
        Alert.alert('Profil Sorunu', 'TC kimlik bilgisi eksik!');
        return;
      }

      // 2. KargoMarketing.com'dan gelen beklemede görevleri kontrol et
      const { data: pendingTasks, error: pendingError } = await supabase
        .from('gorevler')
        .select('*')
        .eq('tc_kimlik', profile.tc_kimlik)
        .is('sofor_id', null)
        .in('sefer_durumu', ['beklemede', 'yeni']);

      console.log('⏳ Beklemede Görevler:', pendingTasks);
      console.log('❌ Beklemede Görev Hatası:', pendingError);

      // 3. Bu kullanıcıya atanmış görevleri kontrol et
      const { data: assignedTasks, error: assignedError } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', session.user.id);

      console.log('✅ Atanmış Görevler:', assignedTasks);
      console.log('❌ Atanmış Görev Hatası:', assignedError);

      // 4. Tüm TC kimlik eşleştirmelerini kontrol et
      const { data: allMatchingTasks, error: allMatchingError } = await supabase
        .from('gorevler')
        .select('*')
        .eq('tc_kimlik', profile.tc_kimlik);

      console.log('🎯 TC Kimlik Eşleşen Tüm Görevler:', allMatchingTasks);

      // Sonuç raporu
      Alert.alert(
        'Gerçek Veritabanı Durumu',
        `👤 Profil: ${profile.ad} ${profile.soyad}\n` +
        `🆔 TC: ${profile.tc_kimlik}\n\n` +
        `⏳ Beklemede: ${pendingTasks?.length || 0} görev\n` +
        `✅ Atanmış: ${assignedTasks?.length || 0} görev\n` +
        `🎯 TC Eşleşen: ${allMatchingTasks?.length || 0} görev\n\n` +
        `💡 KargoMarketing.com'dan TC kimlik ile görev gelirse otomatik atanır.`
      );

    } catch (error: any) {
      console.error('Database kontrol hatası:', error);
      Alert.alert('Hata', 'Database kontrolü başarısız: ' + error.message);
    }
  };

  // Görevi Kabul Et fonksiyonu
  const acceptTask = async (taskId: string) => {
    try {
      setLoading(true);
      
      // Durum kolonunu 'atandi' yap VE kabul_edildi_mi'yi true yap
      const { error: updateError } = await supabase
        .from('gorevler')
        .update({ 
          durum: 'atandi',
          kabul_edildi_mi: true,  // ✅ Şoför görevi kabul etti
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) {
        setError('Görev kabul hatası: ' + updateError.message);
        return;
      }

      // Görevleri yeniden yükle
      const { data: updatedTasks } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', session.user.id)
        .order('created_at', { ascending: false });

      setTasks(updatedTasks || []);
      
      Alert.alert('Başarılı', 'Görev kabul edildi! Artık sefere başlayabilirsiniz.');
      
    } catch (error: any) {
      setError('Görev kabul hatası: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // GPS Tracking functions
  const startGPSTracking = async (taskId: string) => {
    try {
      // İzin iste
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('GPS izni gerekli');
        return;
      }

      setActiveTaskId(taskId);
      setGpsTracking(true);

      // Görevi 'yolda' durumuna güncelle VE başlangıç zamanını kaydet
      await supabase
        .from('gorevler')
        .update({ 
          sefer_durumu: 'yolda',
          baslangic_zamani: new Date().toISOString()  // ✅ Başlangıç timestamp'i
        })
        .eq('id', taskId);

      // İlk konumu al
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation = {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      };
      setCurrentLocation(newLocation);

      // GPS kaydını KargoMarketing uyumlu formatta gönder
      await sendGPSData(location, taskId, session.user.id);

      console.log('GPS tracking başlatıldı');
    } catch (error: any) {
      setError('GPS başlatma hatası: ' + error.message);
    }
  };

  const stopGPSTracking = async () => {
    if (!activeTaskId) return;

    try {
      // Görevi 'tamamlandi' durumuna güncelle VE bitiş zamanını kaydet
      await supabase
        .from('gorevler')
        .update({ 
          sefer_durumu: 'tamamlandi',
          bitis_zamani: new Date().toISOString()  // ✅ Bitiş timestamp'i
        })
        .eq('id', activeTaskId);

      setGpsTracking(false);
      setActiveTaskId(null);
      setCurrentLocation(null);

      // Görevleri yeniden yükle
      window.location.reload();

      console.log('GPS tracking durduruldu');
    } catch (error: any) {
      setError('GPS durdurma hatası: ' + error.message);
    }
  };

  // GPS location tracking interval (her 10 saniyede bir)
  useEffect(() => {
    let locationInterval: NodeJS.Timeout;

    if (gpsTracking && activeTaskId && session) {
      locationInterval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const newLocation = {
            lat: location.coords.latitude,
            lng: location.coords.longitude
          };
          setCurrentLocation(newLocation);

          // GPS kaydını KargoMarketing uyumlu formatta gönder
          await sendGPSData(location, activeTaskId, session.user.id);

          console.log('GPS location güncellendi:', newLocation);
        } catch (error) {
          console.error('GPS güncelleme hatası:', error);
        }
      }, 10000); // 10 saniye
    }

    return () => {
      if (locationInterval) {
        clearInterval(locationInterval);
      }
    };
  }, [gpsTracking, activeTaskId, session]);

  // Session monitoring
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Gerçek senaryo: Kullanıcı giriş yaptığında TC kimlik ile görev eşleştirmesi
  useEffect(() => {
    const fetchAndUpdateTasks = async () => {
      if (!session?.user?.id) {
        console.log('Session bulunamadı, görevler yüklenmiyor');
        return;
      }

      console.log('🔍 Gerçek senaryo: TC kimlik eşleştirmesi başlatılıyor...');
      setLoading(true);
      setError(null);

      try {
        // Kullanıcının profil bilgilerini al
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tc_kimlik, ad, soyad')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile?.tc_kimlik) {
          console.log('❌ Profil bilgileri eksik:', profileError);
          setError('TC kimlik bilgisi bulunamadı. Profil güncellenmesi gerekiyor.');
          setLoading(false);
          return;
        }

        console.log('👤 Kullanıcı profili:', profile);
        console.log(`🎯 TC kimlik eşleştirmesi: "${profile.tc_kimlik}"`);

        // KargoMarketing.com'dan gelen görevlerde TC kimlik ile eşleştirme yap
        const { data: pendingTasks, error: matchError } = await supabase
          .from('gorevler')
          .select('*')
          .eq('tc_kimlik', profile.tc_kimlik)  // Exact TC kimlik match
          .is('sofor_id', null)  // Henüz şoför atanmamış
          .in('sefer_durumu', ['beklemede', 'yeni']);  // Beklemede olan görevler

        console.log('📋 Beklemede olan görevler:', pendingTasks);
        
        if (pendingTasks && pendingTasks.length > 0) {
          console.log(`✅ ${pendingTasks.length} beklemede görev bulundu, atama yapılıyor...`);
          
          // Görevleri bu şoföre ata
          for (const task of pendingTasks) {
            console.log(`📌 Görev atanıyor: ${task.ilan_no} → ${profile.ad} ${profile.soyad}`);
            
            const { error: updateError } = await supabase
              .from('gorevler')
              .update({
                sofor_id: session.user.id,
                sefer_durumu: 'atandi',
                updated_at: new Date().toISOString()
              })
              .eq('id', task.id);

            if (updateError) {
              console.error(`❌ Görev atama hatası (${task.ilan_no}):`, updateError);
            } else {
              console.log(`✅ Görev başarıyla atandı: ${task.ilan_no}`);
            }
          }
        } else {
          console.log('📭 TC kimlik ile eşleşen beklemede görev bulunamadı');
          console.log('💡 Bu normal! KargoMarketing.com\'dan henüz görev atanmamış olabilir.');
        }

        // Kullanıcıya atanmış tüm görevleri getir (hem yeni atananlar hem eskiler)
        const { data: allUserTasks, error: tasksError } = await supabase
          .from('gorevler')
          .select('*')
          .eq('sofor_id', session.user.id)
          .order('created_at', { ascending: false });

        if (tasksError) {
          console.error('❌ Görev listesi alma hatası:', tasksError);
          setError('Görevler alınamadı: ' + tasksError.message);
        } else {
          setTasks(allUserTasks || []);
          console.log(`📊 Toplam atanmış görev sayısı: ${allUserTasks?.length || 0}`);
          
          // Dashboard için bilgi ver
          if (allUserTasks && allUserTasks.length > 0) {
            const durumlariGoster = allUserTasks.map(t => `${t.ilan_no}: ${t.sefer_durumu}`).join(', ');
            console.log('📈 Görev durumları:', durumlariGoster);
          }
        }
      } catch (error: any) {
        console.error('💥 Görev eşleştirme hatası:', error);
        setError('Görev eşleştirme hatası: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    if (session) fetchAndUpdateTasks();
  }, [session]);
  // Çıkış fonksiyonu (setSession erişimi için içeride tanımlanmalı)
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
    } catch (e) {
      // Hata yönetimi (opsiyonel)
    }
  };

  // Rainbow animation
  useEffect(() => {
    const startRainbowAnimation = () => {
      Animated.loop(
        Animated.timing(rainbowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        })
      ).start();
    };
    startRainbowAnimation();
  }, []);

  // Giriş, profil, kayıt modalı ve ilgili state'ler kaldırıldı
  // Sadece yeni kayıt modalı olacak



  // Giriş ve kayıt ekranı
  if (!session) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.brandingTopContainer}>
                <Animated.View
                  style={[styles.kmLogoRainbow, {
                    backgroundColor: rainbowAnim.interpolate({
                      inputRange: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
                      outputRange: ['#ff6b6b', '#feca57', '#48dbfb', '#0abde3', '#1dd1a1', '#5f27cd', '#ff9ff3']
                    })
                  }]}
                >
                  <Text style={styles.kmLogoText}>KM</Text>
                </Animated.View>
                <Text style={styles.brandingTop}>KargoMarketing.com için tasarlanmıştır</Text>
              </View>
              <View style={styles.logo}>
                <Text style={styles.logoText}>📍</Text>
              </View>
              <Text style={styles.title}>GPS Sefer Takip</Text>
              <Text style={styles.subtitle}>Şoför {showLogin ? 'Giriş' : 'Kayıt'}</Text>
              <Text style={styles.brandingBottom}>Powered by KargoMarketing.com</Text>
            </View>
          </View>

          <View style={styles.authModal}>
            {showLogin ? (
              <>
                <Text style={styles.title}>Giriş Yap</Text>
                <Text style={styles.subtitle}>Email ve şifrenizle giriş yapın</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={loginData.email}
                    onChangeText={text => setLoginData({ ...loginData, email: text })}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Şifre</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    value={loginData.password}
                    onChangeText={text => setLoginData({ ...loginData, password: text })}
                    secureTextEntry
                  />
                </View>
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.title}>Kayıt Ol</Text>
                <Text style={styles.subtitle}>Tüm alanları eksiksiz doldurun</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Ad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ad"
                    value={registerData.ad}
                    onChangeText={text => setRegisterData({ ...registerData, ad: text })}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Soyad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Soyad"
                    value={registerData.soyad}
                    onChangeText={text => setRegisterData({ ...registerData, soyad: text })}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>TC Kimlik No</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="TC Kimlik No (11 hane)"
                    value={registerData.tc_kimlik}
                    onChangeText={text => setRegisterData({ ...registerData, tc_kimlik: text.replace(/[^0-9]/g, '') })}
                    keyboardType="numeric"
                    maxLength={11}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={registerData.email}
                    onChangeText={text => setRegisterData({ ...registerData, email: text })}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Telefon</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Telefon (+905xxxxxxxxx)"
                    value={registerData.telefon}
                    onChangeText={text => setRegisterData({ ...registerData, telefon: text })}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Şifre</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    value={registerData.password}
                    onChangeText={text => setRegisterData({ ...registerData, password: text })}
                    secureTextEntry
                  />
                </View>
                {error && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </>
            )}
            {/* Butonlar yanyana */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 10 }}>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton, { flex: 1, opacity: showLogin ? 0.7 : 1 }]}
                onPress={async () => {
                  if (showLogin) {
                    // Giriş
                    setError(null);
                    if (!loginData.email.trim() || !loginData.password.trim()) {
                      setError('Email ve şifre zorunlu');
                      return;
                    }
                    setLoading(true);
                    try {
                      const { data, error: loginError } = await supabase.auth.signInWithPassword({
                        email: loginData.email.trim().toLowerCase(),
                        password: loginData.password
                      });
                      if (loginError) {
                        setError(loginError.message);
                        setLoading(false);
                        return;
                      }
                      setSession(data.session);
                      setError(null);
                    } catch (e: any) {
                      setError(e?.message || 'Giriş başarısız');
                    } finally {
                      setLoading(false);
                    }
                  } else {
                    // Kayıt
                    setError(null);
                    if (!registerData.ad.trim() || !registerData.soyad.trim() || !registerData.tc_kimlik.trim() || !registerData.email.trim() || !registerData.telefon.trim() || !registerData.password.trim()) {
                      setError('Tüm alanları doldurun');
                      return;
                    }
                    if (registerData.tc_kimlik.length !== 11) {
                      setError('TC Kimlik No 11 haneli olmalı');
                      return;
                    }
                    if (registerData.telefon.length < 10) {
                      setError('Telefon en az 10 hane olmalı');
                      return;
                    }
                    setLoading(true);
                    try {
                      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: registerData.email.trim().toLowerCase(),
                        password: registerData.password
                      });
                      if (signUpError) {
                        setError(signUpError.message);
                        setLoading(false);
                        return;
                      }
                      const userId = signUpData.user?.id;
                      if (!userId) {
                        setError('Kullanıcı oluşturulamadı');
                        setLoading(false);
                        return;
                      }
                      const { error: profileError } = await supabase.from('profiles').upsert({
                        id: userId,
                        ad: registerData.ad.trim(),
                        soyad: registerData.soyad.trim(),
                        tc_kimlik: registerData.tc_kimlik.trim(),
                        telefon: registerData.telefon.trim(),
                        email: registerData.email.trim().toLowerCase()
                      });
                      if (profileError) {
                        setError('Profil kaydı başarısız: ' + profileError.message);
                        setLoading(false);
                        return;
                      }
                      // Kayıt başarılı, giriş ekranına geç
                      setShowLogin(true);
                      setRegisterData({ ad: '', soyad: '', tc_kimlik: '', email: '', telefon: '', password: '' });
                      setError('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
                    } catch (e: any) {
                      setError(e?.message || 'Kayıt başarısız');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>{showLogin ? 'Giriş Yap' : 'Kayıt Ol'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, styles.disabledButton, { flex: 1, opacity: !showLogin ? 0.7 : 1 }]}
                onPress={() => {
                  setError(null);
                  setShowLogin(!showLogin);
                }}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>{showLogin ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Dashboard: atanmış görevler listesi
  return (
    <SafeAreaView style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View style={styles.dashboardHeaderContent}>
          <View style={styles.dashboardBrandingContainer}>
            <Animated.View
              style={[
                styles.dashboardKmLogoRainbow,
                {
                  backgroundColor: rainbowAnim.interpolate({
                    inputRange: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
                    outputRange: ['#ff6b6b', '#feca57', '#48dbfb', '#0abde3', '#1dd1a1', '#5f27cd', '#ff9ff3']
                  })
                }
              ]}
            >
              <Text style={styles.dashboardKmLogoText}>KM</Text>
            </Animated.View>
            <Text style={styles.dashboardBranding}>GPS Takip Sistemi</Text>
          </View>
          <Text style={styles.welcomeText}>Atanmış Görevler 📋</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={checkRealDatabaseStatus}
          >
            <Text style={styles.debugButtonText}>�</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.historyButton, showArchived && styles.historyButtonActive]}
            onPress={() => setShowArchived(!showArchived)}
          >
            <Text style={[styles.historyButtonText, showArchived && styles.historyButtonTextActive]}>
              {showArchived ? 'Aktif' : 'Arşiv'}
            </Text>
          </TouchableOpacity>
          {showArchived && (
            <TouchableOpacity
              style={[styles.historyButton, { backgroundColor: '#ef4444' }]}
              onPress={clearArchive}
              disabled={!archivedTaskIds.length}
            >
              <Text style={[styles.historyButtonText, { color: '#fff', fontWeight: '700' }]}>Temizle</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              signOut();
            }}
          >
            <Text style={styles.logoutButtonText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tasksSection}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.emptyStateSubText}>Görevler yükleniyor...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>🚚 Henüz atanmış göreviniz bulunmuyor</Text>
            <Text style={styles.emptyStateSubText}>
              KargoMarketing.com'dan TC kimlik numaranızla görev atandığında burada görünecek.
            </Text>
            <Text style={styles.emptyStateSubText}>
              Görev atanması otomatik olarak yapılır, beklemede kalabilirsiniz.
            </Text>
          </View>
        ) : (
            <FlatList
            data={(showArchived
              ? tasks.filter(t => t.sefer_durumu === 'tamamlandi' && archivedTaskIds.includes(t.id))
              : tasks.filter(t => !(t.sefer_durumu === 'tamamlandi' && archivedTaskIds.includes(t.id))))}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderLeft}>
                    <Text style={styles.taskTitle}>İlan No: {item.ilan_no}</Text>
                    {item.ad && (
                      <Text style={styles.taskSubTitle}>{item.ad}</Text>
                    )}
                  </View>
                  <View style={styles.taskStatusBadge}>
                    <Text style={styles.taskStatusBadgeText}>
                      {item.sefer_durumu === 'yolda' ? '🚛 Yolda' :
                       item.sefer_durumu === 'tamamlandi' ? '✅ Tamamlandı' :
                       item.kabul_edildi_mi ? '📋 Kabul Edildi' : '⏳ Bekliyor'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.taskInfoGrid}>
                  <View style={styles.taskInfoRow}>
                    <Text style={styles.taskInfoLabel}>Durum:</Text>
                    <Text style={styles.taskInfoValue}>
                      {item.durum === 'atandi' ? 'Kabul Edildi' : 'Beklemede'}
                    </Text>
                  </View>
                  <View style={styles.taskInfoRow}>
                    <Text style={styles.taskInfoLabel}>Sefer:</Text>
                    <Text style={styles.taskInfoValue}>
                      {item.sefer_durumu || 'Henüz başlamadı'}
                    </Text>
                  </View>
                  {item.tc_kimlik && (
                    <View style={styles.taskInfoRow}>
                      <Text style={styles.taskInfoLabel}>TC:</Text>
                      <Text style={styles.taskInfoValue}>{item.tc_kimlik}</Text>
                    </View>
                  )}
                </View>                <View style={styles.taskButtonsContainer}>
                  {/* 1. GÖREV KABUL ET BUTONU */}
                  {item.sofor_id === session.user.id && item.durum === 'sofor_bulunamadi' && (
                    <TouchableOpacity
                      style={[styles.acceptButton, styles.primaryButton]}
                      onPress={() => acceptTask(item.id)}
                      disabled={loading}
                    >
                      <Text style={styles.acceptButtonText}>
                        ✅ Görevi Kabul Et
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* 2. SEFERİ BAŞLAT BUTONU */}
                  {item.sofor_id === session.user.id && item.durum === 'atandi' && item.kabul_edildi_mi === true && (item.sefer_durumu === 'atandi' || !item.sefer_durumu) && (
                    <TouchableOpacity
                      style={[styles.gpsButton, styles.successButton]}
                      onPress={() => startGPSTracking(item.id)}
                      disabled={gpsTracking}
                    >
                      <Text style={styles.gpsButtonText}>
                        📍 Seferi Başlat
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* 3. SEFERİ TAMAMLA BUTONU */}
                  {item.sofor_id === session.user.id && item.sefer_durumu === 'yolda' && gpsTracking && activeTaskId === item.id && (
                    <View>
                      <TouchableOpacity
                        style={[styles.gpsButtonActive, styles.warningButton]}
                        onPress={() => stopGPSTracking()}
                      >
                        <Text style={styles.gpsButtonText}>
                          🏁 Seferi Tamamla
                        </Text>
                      </TouchableOpacity>
                      {currentLocation && (
                        <View style={styles.locationInfo}>
                          <Text style={styles.locationText}>
                            📍 Mevcut Konum: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                          </Text>
                          <Text style={styles.statusText}>
                            🔄 GPS Aktif - Anlık takip çalışıyor
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                {/* Tamamlanan görevler için Arşivle butonu */}
                {item.sefer_durumu === 'tamamlandi' && !archivedTaskIds.includes(item.id) && !showArchived && (
                  <TouchableOpacity
                    style={[styles.gpsButton, styles.primaryButton]}
                    onPress={() => archiveTask(item.id)}
                  >
                    <Text style={styles.gpsButtonText}>📦 Arşivle</Text>
                  </TouchableOpacity>
                )}
                {item.sefer_durumu === 'tamamlandi' && archivedTaskIds.includes(item.id) && showArchived && (
                  <View style={{ marginTop: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>📦 Arşivlendi</Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
        <View style={styles.footerBranding}>
          <Text style={styles.footerText}>KargoMarketing.com GPS Takip</Text>
          <Text style={styles.footerSubText}>© 2025 - Tüm hakları saklıdır</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Modern, mobil uyumlu stil tasarımı
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
  flexGrow: 1,
  justifyContent: 'center',
  minHeight: height,
  paddingHorizontal: 16, // Yan kenar boşlukları artırıldı
  paddingBottom: 64, // Alt boşluk artırıldı
  },
  header: {
    alignItems: 'center',
    paddingTop: height * 0.08, // Daha kompakt için %8'e düşürdük
    paddingBottom: 30,
    paddingHorizontal: 20, // Yan padding ekledik
  },
  logoContainer: {
    alignItems: 'center',
    width: '100%', // Full width for mobile
    maxWidth: 400, // Maximum width for larger screens
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: '#3b82f6',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoText: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  brandingTopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 15,
    flexWrap: 'nowrap', // Yan yana kalması için
    width: '100%',
  },
  kmLogoRainbow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10, // Biraz daha boşluk
    justifyContent: 'center',
    alignItems: 'center',
    // Animated background color will override this
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  kmLogoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  brandingTop: {
    fontSize: 16,
    color: '#4b5563',
    fontWeight: '600',
    textAlign: 'left', // Sol hizalama
    fontStyle: 'italic',
    flexShrink: 1, // Yazı uzunluğuna göre küçülsün
  },
  brandingBottom: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.8,
  },
  authModal: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    margin: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#ffffff',
  },
  form: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
  height: 60,
  borderWidth: 2.5,
  borderColor: '#0ea5e9',
  borderRadius: 16,
  paddingHorizontal: 20,
  fontSize: 18,
  backgroundColor: '#ffffff',
  color: '#1e293b',
  marginBottom: 10,
  elevation: 2,
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  submitButton: {
    height: 56,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  infoText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  // Dashboard stilleri
  dashboard: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  dashboardHeader: {
    backgroundColor: '#3b82f6',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardHeaderContent: {
    flex: 1,
  },
  dashboardBrandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dashboardKmLogoRainbow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
    // Animated background color will override
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 6,
  },
  dashboardKmLogoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  dashboardBranding: {
    fontSize: 14,
    color: '#e0e7ff',
    fontWeight: '600',
    opacity: 0.95,
  },
  welcomeText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  historyButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyButtonActive: {
    backgroundColor: '#3b82f6',
  },
  historyButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  historyButtonTextActive: {
    color: '#ffffff',
  },
  tasksSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  debugButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  debugButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  taskSubTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 4,
  },
  taskInfoText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  taskStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  gpsButton: {
  backgroundColor: '#10b981',
  borderRadius: 18,
  paddingVertical: 18,
  alignItems: 'center',
  marginTop: 18,
  elevation: 2,
  },
  acceptButton: {
  backgroundColor: '#3b82f6',
  borderRadius: 18,
  paddingVertical: 18,
  alignItems: 'center',
  marginTop: 18,
  elevation: 2,
  },
  gpsButtonActive: {
    backgroundColor: '#f59e0b',
  },
  gpsButtonText: {
  color: '#ffffff',
  fontSize: 20,
  fontWeight: '700',
  letterSpacing: 0.5,
  },
  acceptButtonText: {
  color: '#ffffff',
  fontSize: 20,
  fontWeight: '700',
  letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
  alignItems: 'center',
  padding: 48,
  backgroundColor: '#ffffff',
  borderRadius: 22,
  marginVertical: 28,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.13,
  shadowRadius: 12,
  elevation: 4,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  activeTaskPanel: {
  backgroundColor: '#10b981',
  borderRadius: 22,
  padding: 24,
  marginBottom: 24,
  marginHorizontal: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 16,
  elevation: 5,
  },
  activePanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  activePanelText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 4,
    opacity: 0.9,
  },
  footerBranding: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 2,
  },
  footerSubText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '400',
  },
  // GPS Tracking Styles
  locationInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
    borderWidth: 2,
    borderColor: '#0ea5e9',
  },
  locationText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '600',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  // Yeni dashboard stil tanımları
  taskHeaderLeft: {
    flex: 1,
  },
  taskStatusBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  taskStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
    textAlign: 'center',
  },
  taskInfoGrid: {
    marginVertical: 16,
  },
  taskInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  taskInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    flex: 1,
  },
  taskInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    flex: 2,
    textAlign: 'right',
  },
  // Button container ve ek buton stilleri
  taskButtonsContainer: {
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
});