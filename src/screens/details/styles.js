import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 42,
    },
    forDot: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    chart: {
        alignSelf: 'center'
    },
    view: {
        borderColor: 'red',
        marginTop: 8,
    },
    textView: {
        borderColor: 'purple',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
    },
    textHead: {
        color: '#37415180',
        fontWeight: '400',
        fontSize: 14,
    },
    textMain: {
        color: '#374151',
        fontSize: 18,
        fontWeight: '600',
    },
    zeroKnowledgeInfo: {
        marginTop: 16,
        paddingHorizontal: 24,
        color: '#6B7280',
        fontSize: 13,
        lineHeight: 18,
    },
    storageLegend: {
        marginTop: 12,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    storageLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    storageLegendLabel: {
        marginLeft: 8,
        color: '#374151',
        fontSize: 13,
        fontWeight: '500',
    },
    textBox: {
        marginLeft: 10,
    },
    progressView: {
        borderColor: 'blue',
        marginTop: 30,
        paddingHorizontal: 14,

    },
    progressContiner: {
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    content: {
        marginTop: 8,
        color: '#22215B99',
        fontSize: 14,
        fontWeight: '400'
    },
    porgressText: {
        fontSize: 16,
        fontWeight: '500',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 50,
    }
})
