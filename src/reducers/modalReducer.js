import { createSlice } from "@reduxjs/toolkit"

const initialState = {
    visible: false,
    text: null,
    type: null,
    content: null,
    head: null,
    icon: null,
    callback: null,
    cancelCallback: null,
    wait: false,
    buttonText: null,
    cancelButtonText: null,
    pending: false,
    overlayColor: null,
}

export const modalReducer = createSlice({
    name: 'modalReducer',
    initialState,
    reducers: {
        closeModal: (state) => {
            state.visible = false;
            state.text = null;
            state.type = null;
            state.content = null;
            state.head = null;
            state.icon = null;
            state.callback = null;
            state.cancelCallback = null;
            state.wait = false;
            state.buttonText = null;
            state.cancelButtonText = null;
            state.pending = false;
            state.overlayColor = null;
        },
        openModal: (state, action) => {
            state.type = action.payload.type;
            state.text = action.payload.text;
            state.content = action.payload.content;
            state.head = action.payload.head;
            state.icon = action.payload.icon;
            state.buttonText = action.payload.buttonText
            state.cancelButtonText = action.payload.cancelButtonText;
            state.callback = action.payload.callback;
            state.cancelCallback = action.payload.cancelCallback;
            state.visible = true;
            state.wait = false;
            state.pending = action.payload.pending
            state.overlayColor = action.payload.overlayColor || null;

        },
        setText: (state, action) => {
            state.text = action.payload;
        },
        setWait: (state, action) => {
            state.wait = action.payload;
        }
    }
})

export const { closeModal, setWait, setText, openModal } = modalReducer.actions
export default modalReducer.reducer
