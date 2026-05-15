import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
    },
    head: {
        color: '#22215B',
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 15,
    },
    content: {
        fontSize: 16,
        fontWeight: '300',
        color: '#B0C0D0',
        textAlign: 'center',
        marginBottom: 15,
    },
    buttonGroup: {
        flexDirection: 'column',
        width: '100%',
        marginTop: 16,
    },
    gap: {
        height: 10,
        backgroundColor: 'transparent',
    },
    input: {
        borderWidth: 1,
        borderColor: '#415EB6',
        backgroundColor: '#fff',
        borderRadius: 10,
        fontSize: 16,
        color: "#22215B",
        paddingHorizontal: 12,
        paddingVertical: 16,
        width: '100%',
    },
    indicators: {
        position: "absolute",
        backgroundColor: "#fff",
        height: "100%",
        width: "100%",
        zIndex: 100,
        alignSelf: "center",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
        marginTop: -10,
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    errorHint: {
        color: '#FF4D4F',
        fontSize: 12,
        marginTop: 5,
        textAlign: 'left',
        width: '100%',
    }
})
