// TODO save each theme to its own file, use indexedDB to save client-side
export type Theme = {
    name: string,
    id: string,
    description: string
};

const themes: Theme[] = [
    {
        name: 'Dracula',
        id: 'dracula',
        description: 'The default dark theme'
    },
    {
        name: 'Light',
        id: 'light',
        description: 'The default light theme'
    },
    {
        name: 'Cherry',
        id: 'cherry',
        description: 'A colorful light theme'
    }
];

export default themes;