import { useNavigation } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { View, FlatList, Animated, SafeAreaView, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ONBOARDING_DATA } from '../../constants';
import { useContextApi } from '../../context/ContextApi';
import { setGuideMMKV } from '../../utils/mmkv';
import { Button } from '../button';
import { Indicator } from './indicator';
import { OnBoardingItem } from './item';
import { onBoardingStyles as styles } from './styles';

const OnBoarding = ({ presentation = 'screen', onComplete }) => {
  const { t } = useTranslation();

  const scrollX = useRef(new Animated.Value(0)).current;
  const slidersRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalWidth, setModalWidth] = useState(null);
  const { width } = useWindowDimensions();
  const isModal = presentation === 'modal';
  const slideWidth = isModal ? modalWidth || width : width;
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
  const { setWsScreen } = useContextApi();
  const navigation = useNavigation();

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    const index = viewableItems[0]?.index;
    if (Number.isInteger(index)) {
      setActiveIndex(index);
    }
  }).current;

  const closeGuide = async () => {
    await setGuideMMKV();

    if (onComplete) {
      onComplete();
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    setWsScreen((value) => !value);
  };

  const nextButtonHandler = () => {
    if (activeIndex === ONBOARDING_DATA.length - 1) {
      closeGuide();
      return;
    }

    slidersRef.current?.scrollToIndex({ index: activeIndex + 1 });
  };

  return (
    <SafeAreaView style={[styles.container, isModal && styles.modalBackdrop]}>
      <View
        style={[styles.content, isModal && styles.modalCard]}
        onLayout={({ nativeEvent }) => {
          if (isModal) {
            const nextWidth = nativeEvent.layout.width;
            setModalWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
          }
        }}
      >
        <View style={styles.skipWrapper}>
          <TouchableOpacity onPress={closeGuide} accessibilityRole="button">
            <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.flatView}>
          <FlatList
            data={ONBOARDING_DATA}
            keyExtractor={(item) => String(item.svg)}
            renderItem={({ item }) => <OnBoardingItem item={item} itemWidth={slideWidth} />}
            horizontal
            pagingEnabled
            scrollEventThrottle={32}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
              useNativeDriver: false,
            })}
            onViewableItemsChanged={viewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ref={slidersRef}
            getItemLayout={(_, index) => ({
              length: slideWidth,
              offset: slideWidth * index,
              index,
            })}
          />
        </View>
        <View>
          <Indicator currentIndex={activeIndex} count={ONBOARDING_DATA.length} />
          <View style={styles.buttonWrapper}>
            <Button
              text={t(
                activeIndex === ONBOARDING_DATA.length - 1 ? 'onboarding.get_started' : 'common.next'
              )}
              callback={nextButtonHandler}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OnBoarding;
