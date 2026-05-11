import { fileTypes } from "../constants";

import { getFileType, parseDateTime, buildFullPath, normalizeRelativePath } from "./essential-functions";

export const parseSingle = (obj, path) => {
    const name = obj?.Name?.replace('loudBoxNuget/Cloud0/', '');
    const fullPath = buildFullPath(name, path);
    return {
        title: name,
        type: obj?.IsDirectory ? 'folder' : getFileType(obj?.Name),
        name: name?.split('/').reverse()[0],
        source: 'data:image/png;base64,' + obj?.Thumbnail,
        Thumbnail: obj?.Thumbnail,
        description: parseDateTime(obj?.Date),
        rawDate: obj?.Date,
        path: fullPath,
        location: normalizeRelativePath(path),
    };
};
