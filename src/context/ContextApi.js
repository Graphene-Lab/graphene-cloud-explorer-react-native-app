import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { setBottomCommandId } from "../reducers/bottomSheetReducer";
import { ModalBox } from "../components/modal";

const ContextApi = createContext({});
export const useContextApi = () => useContext(ContextApi);
export const ContextApiProvider = ({ children }) => {
    const bottomSheetRef = useRef(null);
    const [wsScreen, setWsScreen] = useState(false);
    const dispatch = useDispatch();

    const tryCloseBottomSheet = useCallback(() => {
        const sheet = bottomSheetRef.current;
        if (sheet?.close) {
            sheet.close();
            return true;
        }
        return false;
    }, []);

    const tryOpenBottomSheet = useCallback((command) => {
        const sheet = bottomSheetRef.current;
        if (sheet?.snapToIndex) {
            sheet.snapToIndex(command);
            return true;
        }
        return false;
    }, []);

    const closeBottomSheet = useCallback(() => {
        if (tryCloseBottomSheet()) return;
        requestAnimationFrame(() => {
            tryCloseBottomSheet();
        });
    }, [tryCloseBottomSheet]);

    const bottomSheetController = useCallback((command = 1, name) => {
        dispatch(setBottomCommandId({ command: command === -1 ? 1 : command, screenName: name }));
        if (tryOpenBottomSheet(command)) return;
        requestAnimationFrame(() => {
            tryOpenBottomSheet(command);
        });
    }, [dispatch, tryOpenBottomSheet]);

    return (
        <ContextApi.Provider value={{ closeBottomSheet, bottomSheetRef, bottomSheetController, wsScreen, setWsScreen }}>
            {children}
            <ModalBox />
        </ContextApi.Provider>
    );
};
