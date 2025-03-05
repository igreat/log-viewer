export const DEFAULT_HIGHLIGHT_COLOR = "#ffbf00"; // Yellow
export const COLORS = [
    "#FFFF99", // Light Yellow
    "#FFD580", // Pale Orange
    "#FFB6C1", // Soft Pink
    "#CCFFCC", // Light Green
    "#ADD8E6", // Sky Blue
    "#FFC0CB", // Pink
    "#FFDAB9", // Peach Puff
    "#FDE74C", // Maize
];

export const DEFAULT_FILTER_GROUPS = [
    {
        title: 'Error Logs',
        description: 'Filters logs containing "ERROR"',
        filters: [{ regex: false, caseSensitive: false, text: 'ERROR', color: "#ff8282" }]
    },
    {
        title: 'User Alice',
        description: 'Filters logs mentioning user Alice',
        filters: [{ regex: false, caseSensitive: false, text: 'Alice', color: "#ffB6C1" }]
    },
    {
        title: 'ip of shape 192.*.1.2',
        description: 'Filters logs containing ip of shape 192.*.1.2',
        filters: [{ regex: true, caseSensitive: false, text: '192\..*\.1\.2' }]
    }
]

export const TOP_K = 5;

export const highlightText = (text, filters) => {
    let highlighted = text;

    // sort filters by length of text to avoid overlapping highlights
    filters.sort((a, b) => b.text.length - a.text.length);

    filters.forEach(({ text: filterText, regex, caseSensitive, color }) => {
        color = color || DEFAULT_HIGHLIGHT_COLOR; // default to yellow if no color is provided
        if (regex) {
            const pattern = new RegExp(filterText, caseSensitive ? '' : 'i');
            highlighted = highlighted.replace(pattern, (match) => {
                return `<span style="background-color: ${color};">${match}</span>`;
            });
        } else {
            // for safety, escape any special regex characters in the filter text
            const escapedFilterText = filterText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(escapedFilterText, caseSensitive ? '' : 'i');
            highlighted = highlighted.replace(pattern, (match) => {
                return `<span style="background-color: ${color};">${match}</span>`;
            });
        }
    });

    return highlighted;
}