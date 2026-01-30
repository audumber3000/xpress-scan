import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AppSkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    radius?: number;
    show?: boolean;
    children?: React.ReactNode;
}

export const AppSkeleton: React.FC<AppSkeletonProps> = ({
    width = '100%',
    height = 20,
    radius = 8,
    show = true,
    children,
}) => {
    const shimmerValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (show) {
            Animated.loop(
                Animated.timing(shimmerValue, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            shimmerValue.stopAnimation();
        }
    }, [show]);

    const translateX = shimmerValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, 350], // Adjust based on common widths
    });

    if (!show) {
        return <>{children}</>;
    }

    return (
        <View
            style={[
                styles.skeletonBase,
                { width, height, borderRadius: radius },
            ]}
        >
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    skeletonBase: {
        backgroundColor: '#E5E7EB', // Gray-200
        overflow: 'hidden',
        position: 'relative',
    },
});
