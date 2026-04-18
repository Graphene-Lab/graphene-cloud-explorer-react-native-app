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
        header: "Who are we?",
        text: 'Our platform has many competitive advantages. We provide a user-friendly interface to explore and manage your files.'
    },
    {
        header: 'What is Graphene Cloud Explorer?',
        text: 'Lorem, ipsum dolor sit amet consectetur adipisicing elit. Unde id eligendi porro excepturi ipsa debitis cum facilis possimus quos necessitatibus placeat dolore nostrum esse aliquid sunt corrupti voluptates autem maiores voluptatum culpa hic neque, qui molestiae? A saepe blanditiis quasi accusantium porro earum in magnam, tenetur, itaque laudantium deserunt harum!'
    },
    {
        header: 'How to use Graphene Cloud Explorer?',
        text: 'Your physical wallet probably contains your money, a form of ID, and maybe pictures of your loved ones.'
    },
    {
        header: 'How can I upgrade my storage?',
        text: 'Your physical wallet probably contains your money, a form of ID, and maybe pictures of your loved ones.'
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
        title: 'Turn on Graphene Cloud Explorer',
        svg: 1,
        description:
            'To turn your Cloud-Services device, plug on end of a Type-C Cable into your Cloud-Services device, and the other end plug into the power adapter into a wall outlet.',
    },
    {
        title: 'Connect to the Internet',
        svg: 2,
        description:
            'Plug one end of an Ethernet cable into the Ethernet port on your WiFi router, the another end plug  into the Ethernet port of Cloud-Services',
    },
    {
        title: 'Connect app with the device',
        svg: 3,
        description:
            'Find the instruction document in the package box. To connect app to Cloud-Services box, you need to do the following steps: \n \n 1. Scan QR Code \n \n 2. Then enter 6-digit secure code',
    },
    {
        title: 'Manage your files',
        description:
            'Save your files and media to Cloud-Services and access them from any device, anywhere.',
        svg: 4,
    },
];

