import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');

export interface InAppNotificationProps {
    title: string;
    body: string;
    visible: boolean;
    onDismiss: () => void;
    onPress?: () => void;
    type?: 'default' | 'success' | 'warning' | 'error' | 'info';
    duration?: number; // Auto-dismiss after X milliseconds
}

export const InAppNotification: React.FC<InAppNotificationProps> = ({
    title,
    body,
    visible,
    onDismiss,
    onPress,
    type = 'default',
    duration = 4000,
}) => {
    const translateY = useRef(new Animated.Value(-200)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Slide down and fade in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss after duration
            if (duration > 0) {
                const timer = setTimeout(() => {
                    handleDismiss();
                }, duration);
                return () => clearTimeout(timer);
            }
        } else {
            handleDismiss();
        }
    }, [visible]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    backgroundColor: colors.successLight,
                    borderColor: colors.success,
                    iconColor: colors.success,
                };
            case 'warning':
                return {
                    backgroundColor: colors.warningLight,
                    borderColor: colors.warning,
                    iconColor: colors.warning,
                };
            case 'error':
                return {
                    backgroundColor: colors.errorLight,
                    borderColor: colors.error,
                    iconColor: colors.error,
                };
            case 'info':
                return {
                    backgroundColor: colors.infoLight,
                    borderColor: colors.info,
                    iconColor: colors.info,
                };
            default:
                return {
                    backgroundColor: colors.primaryBgLight,
                    borderColor: colors.primary,
                    iconColor: colors.primary,
                };
        }
    };

    const typeStyles = getTypeStyles();

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.notification,
                    {
                        backgroundColor: typeStyles.backgroundColor,
                        borderLeftColor: typeStyles.borderColor,
                    },
                ]}
                onPress={onPress}
                activeOpacity={onPress ? 0.7 : 1}
            >
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: typeStyles.borderColor }]}>
                    <Bell size={20} color={colors.white} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={styles.body} numberOfLines={2}>
                        {body}
                    </Text>
                </View>

                {/* Close button */}
                <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
                    <X size={20} color={colors.gray600} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    notification: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.gray900,
        marginBottom: 2,
    },
    body: {
        fontSize: 13,
        color: colors.gray600,
        lineHeight: 18,
    },
    closeButton: {
        padding: 4,
    },
});
