import { TouchableOpacity, View } from "react-native"
import { useTranslation } from "react-i18next"
import ScanIcon from "../../assets/icons/profile/scan.svg"
import SettingsIcon from "../../assets/icons/profile/setting.svg"
import BackIcon from "../../assets/icons/profile/back.svg"
import MoreIcon from "../../assets/icons/more.svg"
import { CustomText } from "../../components/text"
import { useNavigation } from "@react-navigation/native"
import { styles } from "./styles"
import { useContextApi } from "../../context/ContextApi"
import { store } from '../../store';
import { openModal } from "../../reducers/modalReducer"



export const ScreenHeader = ({ name }) => {
    const { t } = useTranslation();
    const navigation = useNavigation()
    const { bottomSheetController } = useContextApi()

    const cons = {
        'HomeScreen': {
            display: 'flex',
            title: t('screens.dashboard')
        },
        'CloudScreen': {
            title: t('screens.explorer'),
            display: 'flex',
            leftItem: <MoreIcon />,
            leftItemPress: (nav) => nav.bottomSheetController(0)
        },
        'FavoriteScreen': {
            title: t('screens.favorites'),
            display: 'flex',
        },
        'MediaScreen': {
            title: t('screens.images'),
            display: 'flex',
        },
        'ProfileScreen': {
            title: t('screens.account'),
            display: 'flex',
            leftItem: <SettingsIcon />,
            leftItemPress: (nav) => nav.navigate("SettingsScreen")
        },
        'Details': {
            title: t('screens.details'),
            display: 'flex',
            leftItem: <BackIcon />,
        },
        'QRScreen': {
            title: t('screens.scan_qr'),
            display: 'flex',
            rightItem: <BackIcon />,
            rightItemPress: (nav) => nav.pop(),
        },
        'SignInScreen': {
            display: 'none'
        },
        UpdateScreen: {
            title: t('screens.upload_progress'),
            display: 'flex',
            rightItem: <BackIcon />,
            rightItemPress: (nav) => nav.pop()
        },
        SettingsScreen: {
            title: t('screens.settings'),
            display: 'flex',
            rightItem: <BackIcon />,
            leftItem: <ScanIcon />,
            leftItemPress: (nav) => store.dispatch(openModal({
                head: t('popups.connect_new_device_head'),
                content: t('popups.connect_new_device_desc'),
                type: 'confirm',
                icon: 'qr',
                buttonText: t('popups.continue'),
                callback: async () => {
                    nav.navigate("QRScreen");
                }
            })),
            rightItemPress: (nav) => nav.pop(),
        },
        FAQScreen: {
            display: 'flex',
            title: t('screens.faq'),
            rightItem: <BackIcon />,
            rightItemPress: (nav) => nav.pop(),
        },
        TermsAndCondition: {
            display: 'flex',
            title: t('screens.terms_conditions'),
            rightItem: <BackIcon />,
            rightItemPress: (nav) => nav.pop(),
        },
        'PaymentScreen': {
            title: t('screens.payment'),
            display: 'flex',
        },
    }

    navigation.bottomSheetController = bottomSheetController;
    return (
        <View style={[{}, styles.container]}>
            <View style={styles.iconBox}>
                {
                    cons[name].rightItem && <TouchableOpacity onPress={() => cons[name].rightItemPress(navigation)} style={styles.leftRight} >
                        {cons[name].rightItem}
                    </TouchableOpacity>
                }
            </View>
            <View style={styles.textView}>
                <CustomText color="#000">{cons[name].title}</CustomText>
            </View>
            <View style={styles.iconBox}>
                {
                    cons[name].leftItem && <TouchableOpacity onPress={() => cons[name].leftItemPress(navigation)} style={styles.leftRight}>
                        {cons[name].leftItem}
                    </TouchableOpacity>
                }
            </View>
        </View >
    )
}


