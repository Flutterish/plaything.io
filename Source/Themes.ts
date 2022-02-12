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
        description: 'A colorful light theme'
    }
];

export default themes;