// import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react'
import { View, FlatList, Animated, SafeAreaView } from 'react-native'
import { useTranslation } from 'react-i18next';
import { ONBOARDING_DATA } from '../../constants';
import { useContextApi } from '../../context/ContextApi';
import { setGuideMMKV } from '../../utils/mmkv';
import { Button } from '../button';
import { Indicator } from './indicator'
import { OnBoardingItem } from './item'
import { onBoardingStyles as styles } from './styles';
import { getGuideMMKV } from '../../utils/mmkv';

const OnBoarding = () => {
    const { t } = useTranslation();

    const scrollX = useRef(new Animated.Value(0)).current
    const slidersRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0)
    const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
    const { wsScreen, setWsScreen } = useContextApi();
    const { navigate } = useNavigation();

    const viewableItemsChanged = useRef(({ viewableItems }) => {
        setActiveIndex(viewableItems[0].key);
    }).current

    const firstOpenFunction = () => {
        if (activeIndex == 4) {
            return navigate('SignInScreen');
        }
        slidersRef.current.scrollToIndex({ index: activeIndex })
    }

    const nextButtonHandler = async () => {
        const guide = await getGuideMMKV()
        if (guide === true) {
            firstOpenFunction()
            return;
        }

        if (activeIndex == 4) {
            setWsScreen(!wsScreen);
            await setGuideMMKV();
            return;
        }
        slidersRef.current.scrollToIndex({ index: activeIndex })
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.flatView}>
                <FlatList
                    data={ONBOARDING_DATA}
                    keyExtractor={(item) => item.svg}
                    renderItem={({ item }) => <OnBoardingItem item={item} />}
                    horizontal
                    pagingEnabled
                    scrollEventThrottle={32}
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    ref={slidersRef}
                />

            </View>
            <View>
                <Indicator currentIndex={activeIndex} />
                <View style={styles.buttonWrapper}>
                    <Button text={t('common.next')} callback={nextButtonHandler} />
                </View>
            </View>
        </SafeAreaView >
    )
}

export default OnBoarding