import { StyleSheet } from 'react-native';

export const indicatorStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 50, marginHorizontal: 3 },
});

export const itemStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flex: 1,
  },
  textBlock: {
    alignItems: 'center',
    maxWidth: 360,
  },
  text: {
    color: '#22215B',
    fontWeight: '500',
    fontSize: 30,
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#22215B',
    fontWeight: '300',
    textAlign: 'center',
  },
});

export const onBoardingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 24,
    marginBottom: 15,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
    marginBottom: 0,
    backgroundColor: 'rgba(34, 33, 91, 0.28)',
  },
  modalCard: {
    width: '90%',
    height: '58%',
    minHeight: 360,
    maxHeight: 460,
    flex: 0,
    borderRadius: 24,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  flatView: {
    // height: Dimensions.get('window').height / 2,
    flex: 1,
  },
  skipWrapper: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  skipText: {
    color: '#415EB6',
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonWrapper: {
    minHeight: 48,
    paddingHorizontal: 32,
    flexDirection: 'row',
    marginTop: 16,
  },
});
