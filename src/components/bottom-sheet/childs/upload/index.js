import { View } from "react-native"
import { useTranslation } from "react-i18next"
import { OptionButton } from "../../../option-button"
import FolderIcon from '../../../../assets/icons/bottomSheet/folder.svg'
import { pickMultiply } from "../../../../utils/settings-utils"
import { useContextApi } from "../../../../context/ContextApi"
import { useDispatch, useSelector } from "react-redux"
import { openModal } from "../../../../reducers/modalReducer"

export const UploadSettings = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { bottomSheetController } = useContextApi();
    const { connection } = useSelector(state => state.network)
    const { fromScreen } = useSelector(state => state.bottomSheetManager)

    const uploadMultiplyButton = () => {
        if (connection) return pickMultiply(bottomSheetController, fromScreen);

        dispatch(openModal({
            content: t('signin.network_failed_desc'),
            type: 'info',
            head: t('signin.network_failed_head'),
            icon: 'ex',
        }))
    }

    return (
        <View>
            <OptionButton text={t('upload.upload_file')} func={uploadMultiplyButton} icon={<FolderIcon />} />
            <OptionButton text={t('upload.upload_multiple')} func={uploadMultiplyButton} icon={<FolderIcon />} />
        </View>
    )
}
