import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { closeModal, setText, setWait } from '../../../reducers/modalReducer'
import { Button } from '../../button'
import { iconManager } from '../iconManager'
import { styles } from '../info/styles'
import * as bip39 from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

const InputModal = () => {

    const { t } = useTranslation();
    const dispatch = useDispatch()
    const { content, head, icon, callback, cancelCallback, wait, cancelButtonText, showBackButton } = useSelector(state => state.modalController);
    const [data, setData] = useState(content || '')
    
    const isPassphrase = head === t('zeroknowledge.enter_passphrase');

    const validatePassphrase = (text) => {
        if (!text) return false;
        const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
        const words = normalized.split(' ');
        if (words.length !== 12 && words.length !== 24) return false;
        try {
            return bip39.validateMnemonic(normalized, wordlist);
        } catch (e) {
            return false;
        }
    }

    const isDataValid = isPassphrase ? validatePassphrase(data) : (content !== data);

    const callbackHandler = () => {
        dispatch(setText(data))
        dispatch(setWait(true))
        callback()
    }
    
    const cancelHandler = () => {
        dispatch(closeModal())
        cancelCallback && cancelCallback()
    }

    return (
        <View style={styles.container}>
            {icon && iconManager(icon)}
            <Text style={styles.head}>{head}</Text>
            <TextInput
                autoCapitalize="none"
                style={styles.input}
                onChangeText={setData}
                value={data}
                multiline={isPassphrase}
                numberOfLines={isPassphrase ? 3 : 1}
                placeholder={isPassphrase ? t('zeroknowledge.passphrase_placeholder') || 'word1 word2 ...' : ''}
            />
            {isPassphrase && data.length > 0 && !isDataValid && (
                <Text style={styles.errorHint}>{t('zeroknowledge.invalid_mnemonic') || 'Invalid 12 or 24-word passphrase'}</Text>
            )}
            <View style={styles.buttonGroup}>
                {!isPassphrase && !showBackButton && (
                    <>
                        <Button variant='outlined' text={cancelButtonText ? cancelButtonText : t('common.cancel')} callback={cancelHandler} />
                        <View style={styles.gap}></View>
                    </>
                )}
                <Button 
                    text={t('common.ok')} 
                    callback={callbackHandler} 
                    disabled={!isDataValid || wait} 
                    wait={wait} 
                />
            </View>
        </View >
    )
}

export default InputModal
