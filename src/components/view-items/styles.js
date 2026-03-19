import { Dimensions, StyleSheet } from "react-native"

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    selector: {
        marginBottom: 14,
        alignItems: 'flex-end'
    },
    selectorIconGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    touchableOpacityOne: {
        paddingHorizontal: 10,
    },
    touchableOpacityTwo: {
        paddingLeft: 10,
    },
    pageTitleView: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between'
    },
    backIconView: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleText: {
        fontSize: 16,
        color: "#22215B",
        width: '70%'
    },
    pageTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },

})

export const rowStyles = StyleSheet.create({
    rowContainer: {
        // flex: 1,
        // height: Dimensions.get('window').width / 3 - 20,
        // width: Dimensions.get('window').width / 3 - 20,
        paddingHorizontal: 5,
        paddingVertical: 8,
    },
    iconSections: {
        alignItems: 'center',
        justifyContent: 'center',
        height: Dimensions.get('window').width / 3 - 20,
        width: Dimensions.get('window').width / 3 - 20,
        backgroundColor: '#F7FAFF',
        borderWidth: 1,
        borderColor: '#EEF2FE',
        borderRadius: 15
    },
    found: {
        alignItems: 'center',
        justifyContent: 'center',
        height: Dimensions.get('window').width / 3 - 20,
        width: Dimensions.get('window').width / 3 - 20,
        backgroundColor: '#F7FAFF',
        borderWidth: 1,
        borderColor: '#1a4feb',
        borderRadius: 15
    },
    box: {
        alignItems: 'center',
        justifyContent: 'center',
        height: Dimensions.get('window').width / 3 - 20,
        width: Dimensions.get('window').width / 3 - 20,
        borderWidth: 1,
        backgroundColor: '#F7FAFF',
        // borderColor: "#00000043",
        borderColor: '#EEF2FE',
        borderRadius: 15,
    },
    textSections: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: Dimensions.get('window').width / 3 - 20,
    },
    textContent: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        color: '#22215B',
        fontSize: 14,
        fontWeight: '400',
        flexShrink: 1,
    },
    date: {
        color: 'rgba(34, 33, 91, 0.5)',
        fontSize: 10,
        fontWeight: '400'
    },
    overlay: {
        position: 'absolute',
        top: 3,
        left: 3,
    },
    overlayStar: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    overlayDownload: {
        position: 'absolute',
        bottom: 7,
        right: 9,
    },
    overlayProgress: {
        position: 'absolute',
        bottom: 4,
        left: 6,
        fontSize: 10,
        color: '#22215B',
        backgroundColor: '#ffffffcc',
        paddingHorizontal: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
    setting: {
        padding: 5,
        marginLeft: 4,
    }
})

export const ColumnStyles = StyleSheet.create({
    container: {
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
        height: 56,
        justifyContent: 'space-between',
        backgroundColor: '#F7FAFF',
        borderColor: '#EEF2FE',
        borderRadius: 10,
        paddingHorizontal: 19,
    },
    found: {

        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
        height: 56,
        justifyContent: 'space-between',
        backgroundColor: '#F7FAFF',
        borderColor: '#1a4feb',
        borderRadius: 10,
        paddingHorizontal: 19,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    textArea: {
        marginLeft: 19.4,
        flex: 1,
    },
    title: {
        color: '#22215B',
        fontSize: 14,
    },
    description: {
        color: 'rgba(34, 33, 91, 0.5)',
        fontSize: 10,
        marginTop: 3
    },
    thumbnail: {
        borderColor: 'orange',
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overlay: {
        position: 'absolute',
        // top: 5,
        right: 0,
    },
    overlayStar: {
        position: 'absolute',
        top: 4,
        right: 4,
    },

    onSelect: {
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
        height: 56,
        justifyContent: 'space-between',
        backgroundColor: '#F7FAFF',
        borderColor: "#00000043",
        borderRadius: 10,
        paddingHorizontal: 19,
    },
    setting: {
        // padding: 8,
        paddingLeft: 16,
        paddingVertical: 8,
    },
    overlayDownload: {
        position: 'absolute',
        left: 5,
    },
    overlayProgress: {
        position: 'absolute',
        left: 20,
        top: 4,
        fontSize: 10,
        color: '#22215B',
        backgroundColor: '#ffffffcc',
        paddingHorizontal: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
})

