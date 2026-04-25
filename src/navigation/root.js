import { navigationRef } from "./NavigationService"

export const navigationPush = (screenName) => {
    if (navigationRef.isReady()) {
        navigationRef.navigate(screenName);
    }
}
