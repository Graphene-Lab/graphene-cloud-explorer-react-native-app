import { DeviceEventEmitter } from "react-native"
import { useTranslation } from "react-i18next"
import { BottomSheetScrollView } from "@gorhom/bottom-sheet"
import { OptionButton } from "../../../option-button"
import FolderIcon from '../../../../assets/icons/bottomSheet/folder.svg'
import PaperIcon from '../../../../assets/icons/bottomSheet/paper.svg'
import { createDirectory, onlyPick } from "../../../../utils/settings-utils"
import { useContextApi } from "../../../../context/ContextApi"
import { useDispatch, useSelector } from "react-redux"
import { openModal } from "../../../../reducers/modalReducer"
import LogOutIcon from '../../../../assets/icons/setting/logout.svg';
import { enqueue } from "../../../../reducers/refreshQueueReducer"
import { getCellularInfoMMKV } from "../../../../utils/mmkv"
import { styles } from "./styles"

export const AddSettings = () => {
    const { t } = useTranslation();
    const { closeBottomSheet } = useContextApi();
    const { connection, type } = useSelector(state => state.network)
    const dispatch = useDispatch();

    const networkFilter = async (index) => {

        if (connection === false) {
            dispatch(openModal({
                content: t('signin.network_failed_desc'),
                type: 'info',
                head: t('signin.network_failed_head'),
                icon: 'ex',
            }))

            return
        }

        if (index == 2) {
            createDirectory()
            return;
        }

        const isToggled = await getCellularInfoMMKV();
        if (type === 'wifi' || isToggled) return onlyPick(closeBottomSheet);

        dispatch(openModal({
            content: t('cellular.off_desc'),
            head: t('cellular.head'),
            type: 'confirm',
            icon: 'ex',
            callback: () => onlyPick(closeBottomSheet)
        }))
    }

    const logOutHandler = () => {
        DeviceEventEmitter.emit('logOut');
        DeviceEventEmitter.emit('spoolerCleaner');
        return dispatch(enqueue(['CloudScreen', 'FavoriteScreen', 'MediaScreen', 'ProfileScreen']));
    }

    return (
        <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            <OptionButton text={t('options.upload_file')} func={() => networkFilter(1)} icon={<PaperIcon />} />
            <OptionButton text={t('options.create_folder')} func={() => networkFilter(2)} icon={<FolderIcon />} />
            <OptionButton text={t('options.logout')} func={logOutHandler} icon={<LogOutIcon />} />
        </BottomSheetScrollView>
    )
}
