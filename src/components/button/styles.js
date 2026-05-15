import { StyleSheet } from "react-native";



export const styles = StyleSheet.create({
    primary: {
        borderWidth: 1,
        backgroundColor: '#415EB6',
        borderColor: '#415EB6',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
        width: '100%',
    },
    primaryText: {
        color: '#fff',
        fontWeight: '500',
        fontSize: 16,
    },
    outlined: {
        borderWidth: 2,
        borderColor: '#415EB6',
        backgroundColor: '#fff',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: 45,
        width: '100%',
    },
    outlinedText: {
        color: '#415EB6',
        fontWeight: '500',
        fontSize: 16,
    },

    disabled: {
        borderWidth: 1,
        width: '100%',
        // width: '100%',
        // backgroundColor: '#415EB6',
        borderColor: "#fff",
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        // maxHeight: 50,

        height: 50,
        backgroundColor: "#e4e4e4",
    }


})