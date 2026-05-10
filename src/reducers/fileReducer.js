import { createSlice } from "@reduxjs/toolkit"
const initialState = {
    selectedFile: null,
    selectedFiles: [],
    mode: false,
    favorites: [],
    location: '',
    order: { type: 'name', ascending: false },
    filterResults: [],
    filterStatus: false,
    found: null,
    favoritesContent: [],
}

export const fileManagerReducer = createSlice({
    name: 'fileManager',
    initialState,
    reducers: {
        goToLocation: (state, action) => {
            if (action.payload === '') state.location = action.payload;
            else if (state.location === '') state.location = action.payload;
            else if (state.location === action.payload) state.location = state.location;
            else state.location = `${state.location}/${action.payload}`
        },
        setMode: (state, action) => {
            state.mode = action.payload
        },
        goBackLocation: (state, action) => {
            const pastLocation = action.payload.split('/')
            pastLocation.pop();
            state.location = pastLocation.join('/');
        },
        setLocation: (state, action) => {
            state.location = action.payload
        },
        setSelectedFile: (state, action) => {
            state.selectedFile = action.payload;
        },
        setSelectedFiles: (state, action) => {
            state.selectedFiles = [...state.selectedFiles, action.payload];
        },
        removeSelectedFiles: (state, action) => {
            state.selectedFiles = state.selectedFiles.filter(file => file.title !== action.payload.title);
        },
        setEmptySelectedFiles: (state) => {
            state.selectedFiles = [];
        },
        setFavoritesList: (state, action) => {
            state.favorites = action.payload;
        },
        setOrder: (state, action) => {
            state.order = action.payload
        },
        setFilterResults: (state, action) => {
            state.filterResults = action.payload
        },
        setFound: (state, action) => {
            state.found = action.payload
        },
        setFilterStatus: (state, action) => {
            state.filterStatus = action.payload
        },
        setFavoritesContent: (state, action) => {
            state.favoritesContent = action.payload
        },
    }
})

export const { setSelectedFile, setFavoritesContent, setFilterStatus, setFound, setFilterResults, setLocation, setOrder, setMode, setFavoritesList, setSelectedFiles, goToLocation, goBackLocation, removeSelectedFiles, setEmptySelectedFiles } = fileManagerReducer.actions
export default fileManagerReducer.reducer