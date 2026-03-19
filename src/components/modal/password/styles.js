import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        height: 211,
        width: '100%',
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 20,
        marginTop: 20,
    },
    view: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
    text: {
        fontSize: 18,
        fontWeight: '500',
        color: '#22215B',
    },
    buttonsGroup: {
        flexDirection: 'row',
    },
    gap: {
        width: 15,
        backgroundColor: 'transparent',
    },
    codeFieldRoot: {
        marginTop: 56,
        paddingHorizontal: 24,
    },
    cell: {
        width: 50,
        height: 50,
        lineHeight: 50,
        fontSize: 20,
        borderWidth: 1,
        color: '#22215B',
        borderRadius: 10,
        backgroundColor: '#fff',
        borderColor: '#e4e6ea',
        textAlign: 'center',
        fontWeight: '600'
    },
    focusCell: {
        borderColor: '#415EB6'
    },
    blueText: {
        color: '#0095FF',
        fontSize: 14,
        marginLeft: 7,
    },
    wrongOpt: {
        alignSelf: 'center', marginTop: 10, color: 'red'
    },
    errorContainer: {

        alignItems: 'center',
        flex: 1,
        justifyContent: 'space-between',
        width: '100%'
    },
    errorText: {
        fontSize: 18,
        textAlign: 'center',
    },
    loadingRoot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    loadingText: {
        marginTop: 16,
        textAlign: 'center',
        color: '#22215B',
        fontSize: 16,
        lineHeight: 22,
    },
})
