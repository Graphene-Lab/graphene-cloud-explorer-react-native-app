import { StyleSheet } from 'react-native';

export const indicatorStyles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 50, marginHorizontal: 3 },
});

export const itemStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'space-evenly',
    // justifyContent: 'center',
    // justifyContent: 'flex-end',
    paddingHorizontal: 20,
    flex: 1,
  },
  text: {
    color: '#22215B',
    fontWeight: '500',
    fontSize: 30,
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    // paddingTop: 24,
    fontSize: 16,
    color: '#22215B',
    fontWeight: '300',
    textAlign: 'center',
  },
});

export const onBoardingStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 24,
    marginBottom: 15,
    backgroundColor: '#fff',
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
