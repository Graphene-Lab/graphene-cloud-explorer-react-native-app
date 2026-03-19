import { fileTypes } from "../constants";

const getFileType = (file) => {
    file = file?.split('.').reverse()[0].toLowerCase();
    return fileTypes[file] ? fileTypes[file] : 'other';
};

const parseDateTime = (dateTime) => {
    let date = new Date(dateTime);
    // return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    return date.toLocaleDateString();
};

const normalizeRelativePath = (value) => {
    if (!value) return '';
    return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
};

const buildFullPath = (name, loc) => {
    const cleanName = normalizeRelativePath(name);
    const cleanLoc = normalizeRelativePath(loc);
    if (!cleanLoc) return cleanName;
    if (cleanName === cleanLoc || cleanName.startsWith(cleanLoc + '/')) return cleanName;
    if (!cleanName) return cleanLoc;
    return `${cleanLoc}/${cleanName}`;
};

export const parseSingle = (obj, path) => {
    const name = obj?.Name?.replace('loudBoxNuget/Cloud0/', '');
    const fullPath = buildFullPath(name, path);
    return {
        title: name,
        type: getFileType(obj?.Name),
        name: name?.split('/').reverse()[0],
        source: 'data:image/png;base64,' + obj?.Thumbnail,
        Thumbnail: obj?.Thumbnail,
        description: parseDateTime(obj?.Date),
        rawDate: obj?.Date,
        path: fullPath,
        location: normalizeRelativePath(path),
    };
};
