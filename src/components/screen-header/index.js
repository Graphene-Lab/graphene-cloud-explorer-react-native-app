import { TouchableOpacity, View } from "react-native"
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



const cons = {
    'HomeScreen': {
        display: 'flex',
        title: 'Dashboard'

    },
    'CloudScreen': {
        title: 'Graphene Cloud Explorer',
        display: 'flex',
        leftItem: <MoreIcon />,
        leftItemPress: (nav) => nav.bottomSheetController(0)
    },
    'FavoriteScreen': {
        title: 'Favorites',
        display: 'flex',
    },
    'MediaScreen': {
        title: 'Images',
        display: 'flex',
    },
    'ProfileScreen': {
        title: 'Account',
        display: 'flex',
        leftItem: <SettingsIcon />,

        leftItemPress: (nav) => nav.navigate("SettingsScreen")
    },
    'Details': {
        title: 'Details',
        display: 'flex',
        leftItem: <BackIcon />,
    },
    'QRScreen': {
        title: 'Scan QR code',
        display: 'flex',
        rightItem: <BackIcon />,
        rightItemPress: (nav) => nav.pop(),
    },
    'SignInScreen': {
        display: 'none'
    },
    UpdateScreen: {
        title: 'Upload Progress',
        display: 'flex',
        rightItem: <BackIcon />,
        rightItemPress: (nav) => nav.pop()
    },
    SettingsScreen: {
        title: 'Settings',
        display: 'flex',
        rightItem: <BackIcon />,
        leftItem: <ScanIcon />,
        leftItemPress: (nav) => store.dispatch(openModal({
            head: 'Connect New Cloud-Services Device',
            content: 'If you want connect new device, your will be disconnected from current device',
            type: 'confirm',
            icon: 'qr',
            buttonText: 'Continue',
            callback: async () => {
                nav.navigate("QRScreen");
            }
        })),
        rightItemPress: (nav) => nav.pop(),
    },

    FAQScreen: {
        display: 'flex',
        title: 'FAQ',
        rightItem: <BackIcon />,
        rightItemPress: (nav) => nav.pop(),
    },
    TermsAndCondition: {
        display: 'flex',
        title: 'Terms & Conditions',
        rightItem: <BackIcon />,
        rightItemPress: (nav) => nav.pop(),
    },
    'PaymentScreen': {
        title: 'Payment',
        display: 'flex',
    },
    // DetailsScreen: {
    //     display: 'flex',
    //     title: 'Details',
    //     rightItem: <BackIcon />,
    //     rightItemPress: (nav) => nav.pop(),
    // }
}

export const ScreenHeader = ({ name }) => {
    const navigation = useNavigation()
    const { bottomSheetController } = useContextApi()
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


