import { createSlice } from "@reduxjs/toolkit"

const initialState = {
    loginError: false,
    wait: false,
    zeroKnowledgeMasterKeyB64: null,
    zeroKnowledgeEnabled: false,
    zeroKnowledgePrompted: false,
}

export const userSecretDataReducer = createSlice({
    name: 'userSecretDataReducer',
    initialState,
    reducers: {
        setAuthWait: (state, action) => {
            state.wait = action.payload;
        },
        setUserSecretDataToRedux: (state, action) => {
            state = Object.assign(state, { ...action.payload });
        },
        cleanUserSecretsData: () => {
            return { ...initialState };
        },
        setUserLoginError: (state, action) => {
            state.loginError = action.payload
        }
    }
})

export const { setUserSecretDataToRedux, cleanUserSecretsData, setUserLoginError, setAuthWait } = userSecretDataReducer.actions
export default userSecretDataReducer.reducer
