export var chunkSize = 1024 * 512; // The size of the chunks (blocks) for the file transfer. Set 0 to let the server decide the size of the chunks
export var thumbnailSize = 80; // Parameter that is passed to the server and indicates the size of the larger side of the image preview
export var defaultProxyPort = 5050;
export var proxy = 'http://proxy.cloudservices.agency:' + defaultProxyPort;
export const command = {
    SetClient: 0,
    Authentication: 1,
    Pair: 2,
    GetPushNotifications: 3,
    Error: 4,
    GetDir: 5,
    GetFile: 6,
    Share: 7,
    SetFile: 8,
    Delete: 9,
    Rename: 10,
    Move: 11,
    Copy: 12,
    CreateDir: 13,
    Search: 14,
    GetGroup: 15,
    AddToGroup: 16,
    RemoveFromGroup: 17,
    GetStorageInfo: 18,
    GetOccupiedSpace: 19,
    GetEncryptedQR: 20,
    GetFreeSpace: 21,
    GetUsedSpace: 22,
};

export const fileTypes = {
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    ico: 'image',
    gif: 'image',
    mp4: 'video',
    mov: 'video',
    avi: 'video',
    mp3: 'audio',
    wav: 'audio',
    pdf: 'pdf',
    txt: 'txt',
    doc: 'document',
    docx: 'document',
    ppt: 'presentation',
    pptx: 'presentation',
    xls: 'spreadsheet',
    xlsx: 'spreadsheet',
    zip: 'archive',
    rar: 'archive',
    html: 'code',
    css: 'code',
    php: 'code',
    javascript: 'code',
    typescript: 'code',
};

export const existsTypes = ['image', 'audio', 'video'];

export const faqs = [
    {
        header: "faqs.q1",
        text: 'faqs.a1'
    },
    {
        header: 'faqs.q2',
        text: 'faqs.a2'
    },
    {
        header: 'faqs.q3',
        text: 'faqs.a3'
    },
    {
        header: 'faqs.q4',
        text: 'faqs.a4'
    },
];

export const sliceColor = ['#FFBB34', '#39C0B8', '#567DF4', '#FF842A', '#6C56F4', '#567DF4'];

export const spacesCommands = {
    video: '[^\\s]+(.*?)\\.(mov|mp4|mpeg4|avi|MOV|MP4|MPEG4|AVI)',
    image: '[^\\s]+(.*?)\\.(jpg|jpeg|png|gif|JPG|JPEG|PNG|GIF)',
    document: '[^\\s]+(.*?)\\.(docx|txt|pdf|xls|DOCX|TXT|PDF|XLS|epub|EPUB)',
    other:
        '[^\\s]+(.*?)\\.(mov|mp4|mpeg4|avi|MOV|MP4|MPEG4|AVI|jpg|jpeg|png|gif|JPG|JPEG|PNG|GIF|docx|txt|pdf|xls|DOCX|TXT|PDF|XLS|epub|EPUB|MP3|mp3|avi|AAC|aac|WAV|wav|ogg)',
    music: '[^\\s]+(.*?)\\.(MP3|mp3|avi|AAC|aac|WAV|wav|ogg)',
};

export const ONBOARDING_DATA = [
    {
        title: 'onboarding.title1',
        svg: 1,
        description:
            'onboarding.desc1',
    },
    {
        title: 'onboarding.title2',
        svg: 2,
        description:
            'onboarding.desc2',
    },
    {
        title: 'onboarding.title3',
        svg: 3,
        description:
            'onboarding.desc3',
    },
    {
        title: 'onboarding.title4',
        description:
            'onboarding.desc4',
        svg: 4,
    },
];

