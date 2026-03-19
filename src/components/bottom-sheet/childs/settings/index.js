import { Text, View } from "react-native"
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


const Settings = () => {
    const { selectedFile, favorites } = useSelector(state => state.files);
    const { downloadQueue } = useSelector(state => state.newFileTransfer);
    const networkStatus = useSelector(state => state.network);

    const { bottomSheetController, closeBottomSheet } = useContextApi()
    const dispatch = useDispatch();
    const fullFileName = selectedFile?.name || (selectedFile?.path ? selectedFile.path.split('/').reverse()[0] : '') || '';
    const selectedItemLabel = selectedFile?.type === 'folder' ? 'Folder' : 'File';

    const downloadFile = async (file) => {
        const { uri, source } = await fileExistsCheck(file);
        if (uri || source) {
            dispatch(openModal({
                content: 'File already downloaded.',
                head: file.name,
                type: 'info',
                icon: 'check'
            }))

            return
        }
        downloadManager(dispatch, file.screen, file, downloadQueue, networkStatus)
    }

    return (
        <View>
            {!!fullFileName && (
                <View style={styles.fileNameContainer}>
                    <Text style={styles.fileNameLabel}>{selectedItemLabel}</Text>
                    <Text style={styles.fileNameText}>{fullFileName}</Text>
                </View>
            )}
            {
                favorites?.includes(selectedFile?.path) ?
                    <OptionButton text='Remove from favorites' func={removeFromFavorite} icon={<StarIcon />} />
                    : <OptionButton text='Add to favorites' func={addToFavorite} icon={<StarIcon />} />
            }
            {selectedFile?.type !== 'folder' && <OptionButton text='Download' func={() => downloadFile(selectedFile)} icon={<DownIcon />} disabled={selectedFile?.type === 'folder'} />}
            {selectedFile?.type !== 'folder' && <OptionButton text='Share with' func={shareFile} icon={<ShareIcon />} disabled={selectedFile?.type === 'folder'} />}
            <OptionButton text='Copy' func={() => openCopyMoveSheet(bottomSheetController, closeBottomSheet, 1)} icon={<CopyIcon />} />
            <OptionButton text='Move' func={() => openCopyMoveSheet(bottomSheetController, closeBottomSheet, 2)} icon={<MoveIcon />} />
            <OptionButton text='Delete' func={remove} icon={<DeleteIcon />} />
            {/* <OptionButton text='Sync now' func={test} icon={<SyncIcon />} /> */}
            <OptionButton text='Rename' func={renameFile} icon={<RenameIcon />} />
        </View>
    )
}

export default memo(Settings)
