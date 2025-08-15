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
  const [destinationCoords, setDestinationCoords] = useState<{lat: number, lon: number} | null>(null);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [isLogin, setIsLogin] = useState(true); // Login/Register toggle
  const [rainbowAnim] = useState(new Animated.Value(0));

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

  useEffect(() => {
    const initializeApp = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      
      // Aktif sefer kontrolü - kesintisiz çalışma
      if (data.session) {
        await checkActiveTrip();
      }
    };
    
    initializeApp();
    
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

  // Aktif sefer kontrolü - kesintisiz çalışma
  const checkActiveTrip = async () => {
    try {
      const { data, error } = await supabase
        .from('gorevler')
        .select('*')
        .eq('sofor_id', session?.user?.id)
        .eq('sefer_durumu', 'aktif')
        .single();
      
      if (data && !error) {
        console.log('Active trip found, resuming GPS tracking:', data.id);
        setCurrentTask(data);
        setActiveTaskId(data.id.toString());
        setGpsActive(true);
        
        // Hedef koordinatlarını varsa ayarla
        if (data.hedef_lat && data.hedef_lon) {
          setDestinationCoords({ lat: data.hedef_lat, lon: data.hedef_lon });
        } else {
          // Varsayılan hedef koordinatı (örnek: İstanbul merkez)
          setDestinationCoords({ lat: 41.0082, lon: 28.9784 });
        }
        
        // GPS tracking'i devam ettir
        await resumeGpsTracking(data.id);
      }
    } catch (e) {
      console.log('No active trip found or error:', e);
    }
  };

  const resumeGpsTracking = async (gorevId: number) => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum izni reddedildi');
        return;
      }

      // GPS tracking interval'ını başlat
      const interval = setInterval(async () => {
        try {
          await sendSingleGps(gorevId, false);
        } catch (e) {
          console.error('GPS tracking error:', e);
        }
      }, 15000);

      setTrackingInterval(interval);
      Alert.alert('Sefer devam ediyor', 'GPS takibi kaldığı yerden devam etti');
    } catch (e: any) {
      console.error('Resume GPS tracking error:', e);
    }
  };

  const signIn = async () => {
    console.log('SignIn başlatıldı, email:', email, 'isLogin:', isLogin);
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      });
      if (error) {
        console.error('SignIn error:', error);
        throw error;
      }
      console.log('SignIn başarılı:', data.user?.email);
      Alert.alert('Giriş başarılı', `Kullanıcı: ${data.user?.email}`);
    } catch (e: any) {
      console.error('SignIn catch error:', e);
      setError(e?.message || 'Giriş başarısız');
      Alert.alert('Giriş başarısız', e?.message || '');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Aktif GPS tracking'i durdur
      if (trackingInterval) {
        clearInterval(trackingInterval);
        setTrackingInterval(null);
      }
      
      // State'leri temizle
      setGpsActive(false);
      setActiveTaskId(null);
      setDestinationCoords(null);
      setCurrentTask(null);
      setLastLocation(null);
      setTasks([]);
      setError(null);
      
      // Supabase'den çıkış yap
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        Alert.alert('Çıkış Hatası', error.message);
      } else {
        Alert.alert('Başarılı', 'Çıkış yapıldı');
      }
    } catch (e: any) {
      console.error('Sign out error:', e);
      Alert.alert('Hata', e?.message || 'Çıkış yapılamadı');
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

      // Hedef koordinatlarını ayarla (task'tan al veya varsayılan ayarla)
      const selectedTask = tasks.find(task => task.id === gorevId);
      if (selectedTask && selectedTask.hedef_lat && selectedTask.hedef_lon) {
        setDestinationCoords({ lat: selectedTask.hedef_lat, lon: selectedTask.hedef_lon });
      } else {
        // Varsayılan hedef koordinatı (örnek: İstanbul merkez)
        setDestinationCoords({ lat: 41.0082, lon: 28.9784 });
      }
      setCurrentTask(selectedTask);

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
          .eq('id', activeTaskId)
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
    setDestinationCoords(null);
    setCurrentTask(null);
    setLastLocation(null);
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
    
    // Otomatik varış kontrolü
    if (destinationCoords) {
      const distanceToDestination = calculateDistance(currentLocation, destinationCoords);
      const arrivalRadius = 100; // 100 metre yaklaştığında sefer biter
      
      if (distanceToDestination <= arrivalRadius) {
        console.log(`Arrived at destination! Distance: ${distanceToDestination}m`);
        Alert.alert(
          'Varış Noktasına Ulaştınız!', 
          `Hedefe ${Math.round(distanceToDestination)}m mesafede. Sefer otomatik olarak tamamlandı.`,
          [
            {
              text: 'Tamam',
              onPress: () => stopGpsTracking()
            }
          ]
        );
        return;
      }
    }

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
              <View style={styles.brandingTopContainer}>
                <Animated.View 
                  style={[
                    styles.kmLogoRainbow,
                    {
                      backgroundColor: rainbowAnim.interpolate({
                        inputRange: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
                        outputRange: ['#ff6b6b', '#feca57', '#48dbfb', '#0abde3', '#1dd1a1', '#5f27cd', '#ff9ff3']
                      })
                    }
                  ]}
                >
                  <Text style={styles.kmLogoText}>KM</Text>
                </Animated.View>
                <Text style={styles.brandingTop}>KargoMarketing.com için tasarlanmıştır</Text>
              </View>
              <View style={styles.logo}>
                <Text style={styles.logoText}>📍</Text>
              </View>
              <Text style={styles.title}>GPS Sefer Takip</Text>
              <Text style={styles.subtitle}>Şoför Girişi</Text>
              <Text style={styles.brandingBottom}>Powered by KargoMarketing.com</Text>
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
                onPress={() => {
                  console.log('Submit butonu tıklandı, isLogin:', isLogin);
                  if (isLogin) {
                    console.log('SignIn çağrılıyor...');
                    signIn();
                  } else {
                    console.log('SignUp çağrılıyor...');
                    signUp();
                  }
                }}
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
            <Text style={styles.dashboardBranding}>KargoMarketing.com GPS Takip Sistemi</Text>
          </View>
          <Text style={styles.welcomeText}>Hoşgeldiniz 👋</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={signOut}
        >
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

      {/* Tasks Section */}
      <View style={styles.tasksSection}>
        <Text style={styles.sectionTitle}>Atanmış Görevleriniz</Text>
        
        {/* Aktif Sefer Durumu */}
        {gpsActive && currentTask && (
          <View style={styles.activeTaskPanel}>
            <Text style={styles.activePanelTitle}>🚛 Aktif Sefer</Text>
            <Text style={styles.activePanelText}>İlan No: {currentTask.ilan_no}</Text>
            <Text style={styles.activePanelText}>Durum: {currentTask.sefer_durumu}</Text>
            {destinationCoords && (
              <Text style={styles.activePanelText}>
                📍 Hedef: {destinationCoords.lat.toFixed(4)}, {destinationCoords.lon.toFixed(4)}
              </Text>
            )}
          </View>
        )}
        
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
        
        {/* Footer Branding */}
        <View style={styles.footerBranding}>
          <Text style={styles.footerText}>© 2025 KargoMarketing.com</Text>
          <Text style={styles.footerSubText}>Tüm hakları saklıdır</Text>
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
    paddingHorizontal: 10, // Yan kenar boşlukları
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
  activeTaskPanel: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
});

// Tüm eski ve duplicate kodlar kaldırıldı. Sadece tek bir export default function App() ve sade GPS uygulama kodu kaldı.
