import { View, Text, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { itemStyles as styles } from './styles';

export const OnBoardingItem = ({ item, itemWidth }) => {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    return (
        <View style={[styles.container, { width: itemWidth || width }]}>
            <View style={styles.textBlock}>
                <Text style={styles.text}>{t(item.title)}</Text>
                <Text style={styles.description} >{t(item.description)}</Text>
            </View>
        </View>
    );
};
