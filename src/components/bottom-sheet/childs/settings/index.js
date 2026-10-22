import { Platform, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { BottomSheetScrollView } from "@gorhom/bottom-sheet"
import { OptionButton } from '../../..//option-button'
import StarIcon from '../../../../assets/icons/bottomSheet/star.svg'
import DownIcon from '../../../../assets/icons/bottomSheet/down.svg'
import ShareIcon from '../../../../assets/icons/bottomSheet/share.svg'
import CopyIcon from '../../../../assets/icons/bottomSheet/copy.svg'
import MoveIcon from '../../../../assets/icons/bottomSheet/move.svg'
import DeleteIcon from '../../../../assets/icons/bottomSheet/delete.svg'
import RenameIcon from '../../../../assets/icons/bottomSheet/rename.svg'
import { addToFavorite, openCopyMoveSheet, remove, removeFromFavorite, renameFile, shareFile } from "../../../../utils/settings-utils"
import { useDispatch, useSelector } from "react-redux"
import { useContextApi } from "../../../../context/ContextApi"
import { memo } from "react"
import { downloadManager } from "../../../view-items/functions"
import { fileExistsCheck } from "../../../../utils/local-files"
import { openModal } from "../../../../reducers/modalReducer"
import { styles } from "./styles"
import { showSavedDownload } from '../../../../utils/download-feedback';
import { downloadFile as saveDownload } from '../../../../utils/settings-utils';


const Settings = () => {
    const { t } = useTranslation();
    const { selectedFile, favorites } = useSelector(state => state.files);
    const pathChangesDisabled = useSelector(state => !!state.userSecret.zeroKnowledgeEnabled);
    const { downloadQueue } = useSelector(state => state.newFileTransfer);
    const networkStatus = useSelector(state => state.network);

    const { bottomSheetController, closeBottomSheet } = useContextApi()
    const dispatch = useDispatch();
    const fullFileName = selectedFile?.name || (selectedFile?.path ? selectedFile.path.split('/').reverse()[0] : '') || '';
    const selectedItemLabel = selectedFile?.type === 'folder' ? t('options.folder') : t('options.file');

    const downloadFile = async (file) => {
        const saved = await fileExistsCheck(file);
        if (Platform.OS === 'android' && saved?.publicDownload) {
            showSavedDownload(file, saved);
            return;
        }
        if (Platform.OS === 'android' && saved?.uri) return saveDownload();
        if (saved?.uri || saved?.source) {
            dispatch(openModal({
                content: t('popups.file_downloaded'),
                head: file.name,
                type: 'info',
                icon: 'check'
            }))

            return
        }
        downloadManager(dispatch, file.screen, file, downloadQueue, networkStatus)
    }

    return (
        <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
        >
            {!!fullFileName && (
                <View style={styles.fileNameContainer}>
                    <Text style={styles.fileNameLabel}>{selectedItemLabel}</Text>
                    <Text style={styles.fileNameText}>{fullFileName}</Text>
                </View>
            )}
            {
                favorites?.includes(selectedFile?.path) ?
                    <OptionButton text={t('options.remove_favorite')} func={removeFromFavorite} icon={<StarIcon />} />
                    : <OptionButton text={t('options.add_favorite')} func={addToFavorite} icon={<StarIcon />} />
            }
            {selectedFile?.type !== 'folder' && <OptionButton text={t('options.download')} func={() => downloadFile(selectedFile)} icon={<DownIcon />} disabled={selectedFile?.type === 'folder'} />}
            {selectedFile?.type !== 'folder' && <OptionButton text={t('options.share_with')} func={shareFile} icon={<ShareIcon />} disabled={selectedFile?.type === 'folder'} />}
            {pathChangesDisabled && <Text style={styles.fileNameLabel}>{t('zeroknowledge.file_operations_unavailable')}</Text>}
            <OptionButton text={t('options.copy')} func={() => openCopyMoveSheet(bottomSheetController, closeBottomSheet, 1)} icon={<CopyIcon />} disabled={pathChangesDisabled} />
            <OptionButton text={t('options.move')} func={() => openCopyMoveSheet(bottomSheetController, closeBottomSheet, 2)} icon={<MoveIcon />} disabled={pathChangesDisabled} />
            <OptionButton text={t('options.delete')} func={remove} icon={<DeleteIcon />} />
            {/* <OptionButton text='Sync now' func={test} icon={<SyncIcon />} /> */}
            <OptionButton text={t('options.rename')} func={renameFile} icon={<RenameIcon />} disabled={pathChangesDisabled} />
        </BottomSheetScrollView>
    )
}

export default memo(Settings)
