import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        alignItems: 'center',
        height: 60,
    },
    right: {
        flexDirection: 'row',
        width: 100
    },
    text: {
        color: "#22215B",
        textAlign: "center",
        fontWeight: "600",
        fontSize: 16,
    },
    left: {
        width: 100,
    },
    icons: {
        marginHorizontal: 5,
    },
    disabled: {
        opacity: 0.4,
    },
})