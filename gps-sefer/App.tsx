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
  ScrollView
} from 'react-native';
import * as Location from 'expo-location';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [gpsActive, setGpsActive] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isLogin, setIsLogin] = useState(true); // Login/Register toggle

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Cleanup tracking interval on unmount
  useEffect(() => {
    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [trackingInterval]);

  useEffect(() => {
    if (session) {
      fetchTasks();
    }
  }, [session]);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      Alert.alert('Giriş başarılı', `Kullanıcı: ${data.user?.email}`);
    } catch (e: any) {
      setError(e?.message || 'Giriş başarısız');
      Alert.alert('Giriş başarısız', e?.message || '');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      Alert.alert('Kayıt başarılı', `Kullanıcı oluşturuldu: ${data.user?.email}. Şimdi giriş yapabilirsiniz.`);
    } catch (e: any) {
      setError(e?.message || 'Kayıt başarısız');
      Alert.alert('Kayıt başarısız', e?.message || '');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', session?.user?.id);
      if (error) throw error;
      setTasks(data || []);
    } catch (e: any) {
      setError(e?.message || 'Görevler alınamadı');
    } finally {
      setLoading(false);
    }
  };

  // GPS Tracking Functions
  const startGpsTracking = async (gorevId: number) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum izni reddedildi');
        return;
      }

      setGpsActive(true);
      setActiveTaskId(gorevId.toString());

      // İlk GPS verisini gönder ve görevi başlat
      await sendSingleGps(gorevId, true);

      // 15 saniyede bir GPS verisi gönder (akıllı filtreleme ile)
      const interval = setInterval(async () => {
        try {
          await sendSingleGps(gorevId, false);
        } catch (e) {
          console.error('GPS tracking error:', e);
        }
      }, 15000); // 3 saniye → 15 saniye

      setTrackingInterval(interval);
      Alert.alert('Sefer başladı', 'Akıllı GPS takibi aktif - sadece hareket halinde konum gönderir');
    } catch (e: any) {
      console.error('GPS tracking start error:', e);
      Alert.alert('Hata', e?.message || 'GPS takibi başlatılamadı');
      setGpsActive(false);
    }
  };

  const stopGpsTracking = async () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
    }

    if (activeTaskId) {
      try {
        // Görevi tamamla
        const { error: updateError } = await supabase
          .from('gorevler')
          .update({ 
            sefer_durumu: 'tamamlandi',
            bitis_zamani: new Date().toISOString()
          })
          .eq('id', parseInt(activeTaskId))
          .eq('sofor_id', session?.user?.id);

        if (updateError) {
          console.error('Task completion error:', updateError);
        }
      } catch (e) {
        console.error('Stop tracking error:', e);
      }
    }

    setGpsActive(false);
    setActiveTaskId(null);
    Alert.alert('Sefer tamamlandı', 'GPS takibi durduruldu');
    fetchTasks(); // Görevleri yenile
  };

  const sendSingleGps = async (gorevId: number, isFirstGps: boolean = false) => {
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude, speed, accuracy, heading } = location.coords;
    
    // Akıllı filtreleme: Sadece hareket halinde ve anlamlı değişiklik varsa kaydet
    const currentLocation = { lat: latitude, lon: longitude };
    const minDistance = 10; // 10 meter minimum hareket
    const minSpeed = 1; // 1 km/h minimum hız
    
    if (!isFirstGps && lastLocation) {
      const distance = calculateDistance(lastLocation, currentLocation);
      const currentSpeed = (speed || 0) * 3.6; // m/s to km/h
      
      // Hareket etmiyorsa ve yavaşsa kaydetme
      if (distance < minDistance && currentSpeed < minSpeed) {
        console.log('GPS skipped: No significant movement', { distance, speed: currentSpeed });
        return;
      }
    }
    
    // GPS kayıtları tablosuna veri ekle
    const { error: gpsError } = await supabase
      .from('gps_kayitlari')
      .insert({
        gorev_id: gorevId,
        sofor_id: session?.user?.id,
        latitude: latitude,
        longitude: longitude,
        hiz: speed || 0,
        yon: heading || 0,
        dogruluk: accuracy || 0,
        konum_verisi: {
          lat: latitude,
          lon: longitude,
          speed,
          accuracy,
          bearing: heading,
          ts: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    if (gpsError) {
      throw gpsError;
    }

    // Son konumu güncelle
    setLastLocation(currentLocation);

    // İlk GPS'te görevi "seferde" durumuna getir
    if (isFirstGps) {
      const { error: updateError } = await supabase
        .from('gorevler')
        .update({ 
          sefer_durumu: 'seferde',
          kabul_edildi_mi: true,
          baslangic_zamani: new Date().toISOString()
        })
        .eq('id', gorevId)
        .eq('sofor_id', session?.user?.id);

      if (updateError) {
        throw updateError;
      }
    }

    console.log('GPS sent:', { lat: latitude, lon: longitude, speed });
  };

  // Mesafe hesaplama (Haversine formula)
  const calculateDistance = (pos1: {lat: number, lon: number}, pos2: {lat: number, lon: number}) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = pos1.lat * Math.PI/180;
    const φ2 = pos2.lat * Math.PI/180;
    const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
    const Δλ = (pos2.lon-pos1.lon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const sendGps = async (gorevId: number) => {
    if (gpsActive && activeTaskId === gorevId.toString()) {
      stopGpsTracking();
    } else {
      startGpsTracking(gorevId);
    }
  };

  if (!session) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>📍</Text>
              </View>
              <Text style={styles.title}>GPS Sefer Takip</Text>
              <Text style={styles.subtitle}>Şoför Girişi</Text>
            </View>
          </View>

          {/* Auth Modal */}
          <View style={styles.authModal}>
            {/* Tab Toggle */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Giriş Yap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                  Kayıt Ol
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ornek@email.com"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Şifre</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={isLogin ? signIn : signUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isLogin ? 'Giriş Yap' : 'Hesap Oluştur'}
                  </Text>
                )}
              </TouchableOpacity>

              {!isLogin && (
                <Text style={styles.infoText}>
                  Hesap oluşturduktan sonra giriş yapabilirsiniz.
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={styles.dashboard}>
      {/* Header */}
      <View style={styles.dashboardHeader}>
        <Text style={styles.welcomeText}>Hoşgeldiniz 👋</Text>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      {/* Tasks Section */}
      <View style={styles.tasksSection}>
        <Text style={styles.sectionTitle}>Atanmış Görevleriniz</Text>
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}

        {!loading && tasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Henüz atanmış göreviniz bulunmuyor.
            </Text>
          </View>
        )}

        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id?.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle}>İlan No: {item.ilan_no}</Text>
                <View style={styles.taskStatus}>
                  <Text style={styles.taskStatusText}>{item.sefer_durumu}</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.gpsButton, 
                  (gpsActive && activeTaskId === item.id.toString()) && styles.gpsButtonActive
                ]}
                onPress={() => sendGps(item.id)}
              >
                <Text style={styles.gpsButtonText}>
                  {(gpsActive && activeTaskId === item.id.toString()) 
                    ? "� Seferi Bitir" 
                    : "� Sefere Başla"
                  }
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
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
  },
  header: {
    alignItems: 'center',
    paddingTop: height * 0.1,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
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
    height: 56,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#374151',
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
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  gpsButtonActive: {
    backgroundColor: '#f59e0b',
  },
  gpsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
  },
});

// Tüm eski ve duplicate kodlar kaldırıldı. Sadece tek bir export default function App() ve sade GPS uygulama kodu kaldı.
