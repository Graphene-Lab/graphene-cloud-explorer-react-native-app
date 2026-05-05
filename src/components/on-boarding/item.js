import { View, Text, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next';
import { itemStyles as styles } from './styles';
import Index1Icon from '../../assets/icons/guide/index1.svg'
import Index2Icon from '../../assets/icons/guide/index2.svg'
import Index3Icon from '../../assets/icons/guide/index3.svg'
import Index4Icon from '../../assets/icons/guide/index4.svg'

const icons = {
    1: <Index1Icon />,
    2: <Index2Icon />,
    3: <Index3Icon />,
    4: <Index4Icon />,
}

export const OnBoardingItem = ({ item }) => {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    return (
        <View style={[styles.container, { width }]}>
            <View style={{ alignItems: 'center' }}>
                <Text style={styles.text}>{t(item.title)}</Text>
                <Text style={styles.description} >{t(item.description)}</Text>
            </View>
            {icons[item.svg]}
        </View>
    )
}