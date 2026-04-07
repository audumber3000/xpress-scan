import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  AppState,
  AppStateStatus
} from 'react-native';
import * as Network from 'expo-network';
import { Wifi, WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

// Fallback listener-like behavior using polling and AppState
export const ConnectivityBanner = () => {
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [visible, setVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  
  const bannerHeight = 48 + insets.top;

  const checkConnection = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const connected = state.isConnected && state.isInternetReachable !== false;
      
      handleConnectionChange(!!connected);
    } catch (error) {
      // If Network call fails, assume connected to avoid false alarms
      console.log('Connectivity check failed:', error);
    }
  };

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    
    if (!connected) {
      if (!wasOffline) {
        setWasOffline(true);
        showBanner();
      }
    } else if (connected && wasOffline) {
      showBanner();
      // Hide after 3 seconds when back online
      setTimeout(() => {
        hideBanner();
      }, 3000);
    }
  };

  useEffect(() => {
    // Initial check
    checkConnection();

    // Poll every 10 seconds for background changes
    pollInterval.current = setInterval(checkConnection, 10000);

    // Also check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    });

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      subscription.remove();
    };
  }, [wasOffline]);

  const showBanner = () => {
    setVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -bannerHeight,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      if (isConnected) {
        setWasOffline(false);
      }
    });
  };

  if (!visible) return null;

  const bgColor = isConnected ? colors.success : colors.error;
  const icon = isConnected ? <Wifi size={20} color="#FFFFFF" /> : <WifiOff size={20} color="#FFFFFF" />;
  const message = isConnected 
    ? "Back online! Syncing your data..." 
    : "You're offline. Some features may be limited.";

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: bgColor,
          height: bannerHeight,
          paddingTop: insets.top,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.content}>
        {icon}
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 48,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
