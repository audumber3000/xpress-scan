import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Dimensions } from 'react-native';
import { Smartphone, Server } from 'lucide-react-native';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

const LOADING_MESSAGES = [
    "Connecting...",
    "Verifying the role...",
    "Logging in...",
    "Syncing clinic data...",
    "Establishing secure session...",
    "Almost there..."
];

export const ConnectingScreen = () => {
    const dotPosition = useRef(new Animated.Value(0)).current;
    const progressPosition = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        // Dot flow animation (smaller, subtle dots)
        Animated.loop(
            Animated.timing(dotPosition, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();

        // Progress bar to-and-fro animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(progressPosition, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(progressPosition, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Text rotation logic
        const interval = setInterval(() => {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
                // Fade in
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start();
            });
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    const translateXDot1 = dotPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 80],
    });

    const translateXDot2 = dotPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 40],
    });

    const translateXProgress = progressPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 120],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            <View style={styles.animationContainer}>
                {/* Phone Icon */}
                <View style={styles.iconBox}>
                    <View style={styles.phoneIcon}>
                        <Smartphone size={32} color={colors.white} />
                    </View>
                </View>

                {/* Dotted Line and Subtle Pulse */}
                <View style={styles.connector}>
                    <View style={styles.dottedLine} />
                    <Animated.View
                        style={[
                            styles.subtlePulse,
                            { transform: [{ translateX: translateXDot1 }] }
                        ]}
                    />
                </View>

                {/* Server Icon */}
                <View style={styles.iconBoxServer}>
                    <View style={styles.serverIcon}>
                        <Server size={32} color={colors.white} />
                    </View>
                </View>
            </View>

            <View style={styles.textContainer}>
                <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                    {LOADING_MESSAGES[messageIndex]}
                </Animated.Text>
                <Text style={styles.subtitle}>Establishing secure connection</Text>
            </View>

            <View style={styles.loaderContainer}>
                <View style={styles.progressBarBg}>
                    <Animated.View
                        style={[
                            styles.progressBarFill,
                            { transform: [{ translateX: translateXProgress }] }
                        ]}
                    />
                </View>
                <Text style={styles.loaderLabel}>SECURITY HANDSHAKE</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    animationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 60,
    },
    iconBox: {
        width: 80,
        height: 120,
        backgroundColor: '#2A276E',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    iconBoxServer: {
        width: 80,
        height: 120,
        backgroundColor: '#4B5563',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    phoneIcon: {
        opacity: 0.9,
    },
    serverIcon: {
        opacity: 0.8,
    },
    connector: {
        width: 100,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    dottedLine: {
        width: '100%',
        height: 1,
        borderWidth: 1,
        borderColor: '#9CA3AF',
        borderStyle: 'dashed',
        opacity: 0.3,
    },
    subtlePulse: {
        position: 'absolute',
        left: 10,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#2A276E',
        opacity: 0.6,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 60,
        height: 80, // Fixed height to prevent layout jumps
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    loaderContainer: {
        width: 200,
        alignItems: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        width: 80,
        height: '100%',
        backgroundColor: '#2A276E',
        borderRadius: 3,
    },
    loaderLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1.5,
    },
});
