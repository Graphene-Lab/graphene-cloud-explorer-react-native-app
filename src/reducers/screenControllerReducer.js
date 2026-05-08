import { createSlice } from "@reduxjs/toolkit"

const initialState = {
    CloudScreen: {
        loader: false,
        blocker: false,
    },
    FavoriteScreen: {
        loader: false,
        blocker: false,
    },
    HomeScreen: {
        loader: false,
        blocker: false,
    },
    MediaScreen: {
        loader: false,
        blocker: false,
    },
    ProfileScreen: {
        loader: false,
        blocker: false,
    },
    SignInScreen: {
        loader: false,
        blocker: false,
    },
    QRScreen: {
        loader: false,
        blocker: false,
    },
    SettingsScreen: {
        loader: false,
        blocker: false,
    },
    UpdateScreen: {
        loader: false,
        blocker: false,
    },
    FAQScreen: {
        loader: false,
        blocker: false
    },
    TermsAndCondition: {
        loader: false,
        blocker: false
    },
    DetailsScreen: {
        loader: false,
        blocker: false
    },
    PaymentScreen: {
        loader: false,
        blocker: false
    },
    'QR Selection': {
        loader: false,
        blocker: false
    }
}

export const screenControllerReducer = createSlice({
    name: 'screenControllerReducer',
    initialState,
    reducers: {
        setScreenBehavior: (state, action) => {
            const route = action.payload.routeName
            state[route].loader = action.payload.loader
            state[route].blocker = action.payload.blocker
        }
    }
})

export const { setScreenBehavior } = screenControllerReducer.actions
export default screenControllerReducer.reducer