import i18n from '../i18n';
import { store } from '../store';
import { openModal } from '../reducers/modalReducer';
import { useErrorAlert } from '../hooks/useErrorAlert';
import { openFileNatively } from './file-opening';

export const showSavedDownload = (file, saved) => {
    store.dispatch(openModal({
        head: file.name,
        content: i18n.t('downloads.saved_to', { path: saved.displayPath }),
        type: 'confirm',
        icon: 'check',
        buttonText: i18n.t('downloads.open'),
        cancelButtonText: i18n.t('common.close'),
        callback: async () => {
            if (!(await openFileNatively(saved.uri, saved.mime, saved.source))) {
                useErrorAlert(i18n.t('common.error'), i18n.t('downloads.open_failed'));
            }
        },
    }));
};
