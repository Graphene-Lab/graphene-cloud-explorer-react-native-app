import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        paddingHorizontal: 25,
    },
    buttonView: {
        width: '100%',
        alignItems: 'center',
        marginVertical: 20,
    },
    buttonsGroup: {
        borderColor: 'red',
        alignItems: 'center',
        width: '100%',
    },
    viewGuideContainer: {
        paddingVertical: 20,
        width: '100%',
        borderTopWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'column',
        borderTopColor: '#EEF2FE',
    },
    viewGuide: {
        paddingTop: 10,
    },

    viewGuideText: {
        color: '#B0C0D0',
        fontWeight: '500'
    }
})