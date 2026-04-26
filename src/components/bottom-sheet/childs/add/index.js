import { DeviceEventEmitter } from "react-native"
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
    const { closeBottomSheet } = useContextApi();
    const { connection, type } = useSelector(state => state.network)
    const dispatch = useDispatch();

    const networkFilter = async (index) => {

        if (connection === false) {
            dispatch(openModal({
                content: 'Make sure your phone has an active internet connection and checking the network.',
                type: 'info',
                head: 'Network connection failed',
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
            content: 'Cellular data usage is off. Are you sure you want to use cellular data for this action?',
            head: "You use cellular connection",
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
            <OptionButton text='Upload new file' func={() => networkFilter(1)} icon={<PaperIcon />} />
            <OptionButton text='Create new folder' func={() => networkFilter(2)} icon={<FolderIcon />} />
            <OptionButton text='Log out' func={logOutHandler} icon={<LogOutIcon />} />
        </BottomSheetScrollView>
    )
}
